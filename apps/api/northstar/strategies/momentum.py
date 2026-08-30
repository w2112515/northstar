"""Momentum rotation Top-N. Deterministic daily-bar program.

Signal: rank universe by lookback return, hold top N equal-weight within the
strategy's allocation. Rebalance at most every `rebalance_days` trading days
(tracked via last_rebalance in the instance state doc).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from northstar.domain import StrategyInstance, TradeProposal
from northstar.strategies.base import EngineContext, effective_universe


def momentum_targets(
    bars: dict[str, Any], universe: list[str], lookback_days: int, top_n: int
) -> list[str]:
    scores: dict[str, float] = {}
    for sym in universe:
        df = bars.get(sym)
        if df is None or len(df) < lookback_days + 2:
            continue
        closes = df["close"]
        scores[sym] = float(closes.iloc[-1] / closes.iloc[-lookback_days] - 1.0)
    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    return [s for s, _ in ranked[:top_n]]


def propose(instance: StrategyInstance, weight: float, ctx: EngineContext) -> list[TradeProposal]:
    p = instance.params
    universe: list[str] = effective_universe(p, ctx)
    lookback = int(p.get("lookback_days", 90))
    top_n = int(p.get("top_n", 3))

    targets = momentum_targets(ctx.bars, universe, lookback, top_n)
    if not targets:
        return []

    alloc = ctx.allocation_equity(weight)
    per_name = alloc / max(len(targets), 1)
    proposals: list[TradeProposal] = []

    held = {
        pos["symbol"]: float(pos["qty"])
        for pos in ctx.positions
        if pos["asset_class"] == "us_equity" and pos["symbol"] in universe
    }

    # sells: held but no longer in targets
    for sym, qty in held.items():
        if sym not in targets and qty > 0 and not ctx.has_open_order_for(sym):
            proposals.append(
                TradeProposal(
                    source=f"strategy:{instance.id}",
                    underlying=sym,
                    direction="neutral",
                    strategy_type="momentum_rotation",
                    horizon_days=int(p.get("rebalance_days", 5)),
                    thesis_human=f"{sym} dropped out of the top {top_n} momentum ranks - rotating out.",
                    invalidation="re-enters top ranks",
                    params={"action": "sell", "qty": qty},
                )
            )

    # Sleeve budget: capital already deployed across the universe counts
    # against this rebalance's buys. Names rotating out this pass are excluded
    # (their sale frees the budget); if those sells don't fill, the gate's
    # sleeve_budget rule backstops against the live positions.
    selling = {p.underlying for p in proposals}
    sleeve_value = 0.0
    for sym, qty in held.items():
        if sym in selling or qty <= 0:
            continue
        df = ctx.bars.get(sym)
        if df is not None and len(df):
            sleeve_value += qty * float(df["close"].iloc[-1])
    budget_left = max(alloc - sleeve_value, 0.0)

    # buys: in targets but not held (or underweight by >25%), within budget
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
            lookback_ret = float(df["close"].iloc[-1] / df["close"].iloc[-lookback] - 1.0)
            proposals.append(
                TradeProposal(
                    source=f"strategy:{instance.id}",
                    underlying=sym,
                    direction="bullish",
                    strategy_type="momentum_rotation",
                    conviction=min(0.5 + lookback_ret, 0.9),
                    horizon_days=int(p.get("rebalance_days", 5)),
                    thesis_human=(
                        f"{sym} is a top-{top_n} momentum name ({lookback_ret:+.1%} over "
                        f"{lookback} trading days) - rotating in."
                    ),
                    invalidation=f"falls out of top {top_n} at next rebalance",
                    params={"action": "buy", "qty": buy_qty},
                )
            )
    return proposals


def should_rebalance(instance_state: dict[str, Any], rebalance_days: int) -> bool:
    last = instance_state.get("last_rebalance")
    if not last:
        return True
    last_dt = datetime.fromisoformat(last)
    return (datetime.now(timezone.utc) - last_dt).days >= rebalance_days
