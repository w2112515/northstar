"""RSI(2) mean reversion with a long-term trend filter.

Buy short-term panics in uptrending names; exit on the bounce or when the
uptrend itself breaks. Classic Connors-style setup, deterministic on daily bars:

  entry: RSI(rsi_period) < entry_rsi  AND  close > SMA(trend_sma)
  exit:  RSI(rsi_period) > exit_rsi   OR   close < SMA(trend_sma)

Sizing: the strategy's allocation is split into `max_names` fixed slots.
"""

from __future__ import annotations

from northstar.domain import StrategyInstance, TradeProposal
from northstar.indicators import rsi, sma
from northstar.strategies.base import EngineContext, effective_universe


def propose(instance: StrategyInstance, weight: float, ctx: EngineContext) -> list[TradeProposal]:
    p = instance.params
    universe: list[str] = effective_universe(p, ctx)
    period = int(p.get("rsi_period", 2))
    entry_th = float(p.get("entry_rsi", 10))
    exit_th = float(p.get("exit_rsi", 70))
    trend_days = int(p.get("trend_sma", 200))
    max_names = int(p.get("max_names", 3))
    slot = ctx.allocation_equity(weight) / max(max_names, 1)

    held = {
        pos["symbol"]: float(pos["qty"])
        for pos in ctx.positions
        if pos["asset_class"] == "us_equity" and pos["symbol"] in universe and float(pos["qty"]) > 0
    }
    proposals: list[TradeProposal] = []
    open_slots = max_names - len(held)

    for sym in universe:
        df = ctx.bars.get(sym)
        if df is None or len(df) < trend_days + 5 or ctx.has_open_order_for(sym):
            continue
        closes = df["close"]
        last_rsi = float(rsi(closes, period).iloc[-1])
        price = float(closes.iloc[-1])
        trend = float(sma(closes, trend_days).iloc[-1])

        if sym in held and (last_rsi > exit_th or price < trend):
            why = (
                f"{sym} bounced (RSI {last_rsi:.0f} > {exit_th:.0f})"
                if last_rsi > exit_th
                else f"{sym} broke below its {trend_days}-day trend"
            )
            proposals.append(
                TradeProposal(
                    source=f"strategy:{instance.id}",
                    underlying=sym,
                    direction="neutral",
                    strategy_type="rsi_mean_reversion",
                    horizon_days=5,
                    thesis_human=f"{why} - taking the exit this strategy planned from day one.",
                    invalidation="n/a (exit)",
                    params={"action": "sell", "qty": held[sym]},
                )
            )
        elif sym not in held and open_slots > 0 and last_rsi < entry_th and price > trend:
            qty = int(slot // price)
            if qty < 1:
                continue
            open_slots -= 1
            proposals.append(
                TradeProposal(
                    source=f"strategy:{instance.id}",
                    underlying=sym,
                    direction="bullish",
                    strategy_type="rsi_mean_reversion",
                    conviction=0.55,
                    horizon_days=5,
                    thesis_human=(
                        f"{sym} had a short-term overreaction (RSI({period}) = {last_rsi:.0f}) while "
                        f"still above its {trend_days}-day trend - buying the dip, selling the bounce."
                    ),
                    invalidation=f"close below the {trend_days}-day average",
                    params={"action": "buy", "qty": qty},
                )
            )
    return proposals
