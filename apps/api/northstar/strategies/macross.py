"""MA cross trend following: hold names whose fast SMA is above the slow SMA.

  in:  SMA(fast) > SMA(slow)   ("golden cross" state, not just the cross day)
  out: SMA(fast) <= SMA(slow)

Equal weight across names currently in the golden-cross state, within the
strategy's allocation.
"""

from __future__ import annotations

from northstar.domain import StrategyInstance, TradeProposal
from northstar.indicators import sma
from northstar.strategies.base import EngineContext, effective_universe


def targets(bars: dict, universe: list[str], fast: int, slow: int) -> list[str]:
    out = []
    for sym in universe:
        df = bars.get(sym)
        if df is None or len(df) < slow + 5:
            continue
        closes = df["close"]
        if float(sma(closes, fast).iloc[-1]) > float(sma(closes, slow).iloc[-1]):
            out.append(sym)
    return out


def propose(instance: StrategyInstance, weight: float, ctx: EngineContext) -> list[TradeProposal]:
    p = instance.params
    universe: list[str] = effective_universe(p, ctx)
    fast = int(p.get("fast", 20))
    slow = int(p.get("slow", 100))
    if fast >= slow:
        return []

    crossed = targets(ctx.bars, universe, fast, slow)
    held = {
        pos["symbol"]: float(pos["qty"])
        for pos in ctx.positions
        if pos["asset_class"] == "us_equity" and pos["symbol"] in universe and float(pos["qty"]) > 0
    }
    proposals: list[TradeProposal] = []

    for sym, qty in held.items():
        if sym not in crossed and not ctx.has_open_order_for(sym):
            proposals.append(
                TradeProposal(
                    source=f"strategy:{instance.id}",
                    underlying=sym,
                    direction="neutral",
                    strategy_type="ma_cross_trend",
                    horizon_days=int(p.get("hold_days", 20)),
                    thesis_human=(
                        f"{sym}'s {fast}-day average slipped below the {slow}-day - the trend this "
                        f"position rode is over, stepping out."
                    ),
                    invalidation="n/a (exit)",
                    params={"action": "sell", "qty": qty},
                )
            )

    if not crossed:
        return proposals
    per_name = ctx.allocation_equity(weight) / len(crossed)
    for sym in crossed:
        df = ctx.bars.get(sym)
        if df is None or sym in held or ctx.has_open_order_for(sym):
            continue
        price = float(df["close"].iloc[-1])
        qty = int(per_name // price)
        if qty < 1:
            continue
        proposals.append(
            TradeProposal(
                source=f"strategy:{instance.id}",
                underlying=sym,
                direction="bullish",
                strategy_type="ma_cross_trend",
                conviction=0.55,
                horizon_days=int(p.get("hold_days", 20)),
                thesis_human=(
                    f"{sym} is in an uptrend ({fast}-day average above {slow}-day) - riding the "
                    f"trend until the averages cross back."
                ),
                invalidation=f"{fast}-day average closes back below the {slow}-day",
                params={"action": "buy", "qty": qty},
            )
        )
    return proposals
