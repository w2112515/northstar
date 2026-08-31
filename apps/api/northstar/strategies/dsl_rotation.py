"""Live adapter for shipyard-built DSL rotation specs.

The instance's params carry a validated StrategySpec (params["spec"]). This
program executes it exactly the way the backtest defined it: composite factor
rank over the spec universe, hold top-N equal weight, optional SPY-trend cash
brake. Mechanics (sizing, sells-then-buys, sleeve budget) mirror momentum.py,
so a promoted spec runs under all the same discipline - and every proposal
still faces the 17-rule gate.
"""

from __future__ import annotations

from northstar.domain import StrategyInstance, TradeProposal
from northstar.dsl import composite_scores, validate_spec
from northstar.strategies.base import EngineContext


def rotation_targets(bars: dict, spec: dict) -> list[str]:
    """Top-N symbols by the spec's composite factor rank, on the latest bar."""
    uni_bars = {s: df for s, df in bars.items() if s in spec["universe"] and df is not None and len(df) >= 70}
    if len(uni_bars) < 2:
        return []
    scores = composite_scores(uni_bars, spec["signal"]["factors"])
    if scores.empty:
        return []
    row = scores.iloc[-1].dropna()
    return list(row.sort_values(ascending=False).index[: int(spec["top_n"])])


def risk_on(bars: dict, spec: dict) -> bool:
    trend = spec["filter"].get("spy_trend_sma")
    if not trend:
        return True
    spy = bars.get("SPY")
    if spy is None or len(spy) < int(trend) + 1:
        return True  # no data to judge -> don't pretend the brake fired
    closes = spy["close"]
    return float(closes.iloc[-1]) > float(closes.rolling(int(trend)).mean().iloc[-1])


def propose(instance: StrategyInstance, weight: float, ctx: EngineContext) -> list[TradeProposal]:
    spec, errors = validate_spec(instance.params.get("spec") or {})
    if errors or spec is None:
        return []  # malformed spec trades nowhere; the journal recorded its birth

    universe = spec["universe"]
    held = {
        pos["symbol"]: float(pos["qty"])
        for pos in ctx.positions
        if pos["asset_class"] == "us_equity" and pos["symbol"] in universe
    }

    targets = rotation_targets(ctx.bars, spec) if risk_on(ctx.bars, spec) else []
    proposals: list[TradeProposal] = []

    # sells first: rotated out, or the trend brake says cash
    for sym, qty in held.items():
        if sym not in targets and qty > 0 and not ctx.has_open_order_for(sym):
            why = (
                f"{sym} dropped out of {spec['name']}'s top {spec['top_n']} composite ranks - rotating out."
                if targets else
                f"SPY fell below its {spec['filter'].get('spy_trend_sma')}SMA - {spec['name']} goes to cash."
            )
            proposals.append(
                TradeProposal(
                    source=f"strategy:{instance.id}",
                    underlying=sym,
                    direction="neutral",
                    strategy_type="dsl_rotation",
                    horizon_days=int(spec["rebalance_days"]),
                    thesis_human=why,
                    invalidation="re-enters the top ranks",
                    params={"action": "sell", "qty": qty},
                )
            )
    if not targets:
        return proposals

    alloc = ctx.allocation_equity(weight)
    per_name = alloc / max(len(targets), 1)
    selling = {p.underlying for p in proposals}
    sleeve_value = 0.0
    for sym, qty in held.items():
        if sym in selling or qty <= 0:
            continue
        df = ctx.bars.get(sym)
        if df is not None and len(df):
            sleeve_value += qty * float(df["close"].iloc[-1])
    budget_left = max(alloc - sleeve_value, 0.0)

    for sym in targets:
        df = ctx.bars.get(sym)
        if df is None or ctx.has_open_order_for(sym):
            continue
        price = float(df["close"].iloc[-1])
        target_qty = int(per_name // price)
        cur = held.get(sym, 0.0)
        if target_qty >= 1 and cur < target_qty * 0.75:
            buy_qty = min(target_qty - int(cur), int(budget_left // price))
            if buy_qty < 1:
                continue
            budget_left -= buy_qty * price
            proposals.append(
                TradeProposal(
                    source=f"strategy:{instance.id}",
                    underlying=sym,
                    direction="bullish",
                    strategy_type="dsl_rotation",
                    conviction=0.6,
                    horizon_days=int(spec["rebalance_days"]),
                    thesis_human=(
                        f"{sym} ranks top-{spec['top_n']} on {spec['name']}'s composite factor blend - rotating in."
                    ),
                    invalidation=f"falls out of top {spec['top_n']} at next rebalance",
                    params={"action": "buy", "qty": buy_qty},
                )
            )
    return proposals
