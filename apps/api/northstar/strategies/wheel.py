"""Wheel state machine (simplified v1).

Per underlying:
  no shares & no short put  -> sell cash-secured put (delta band, DTE band)
  short put open            -> wait (roll management is A-milestone)
  >=100 shares held         -> sell covered call
  1..99 shares              -> wait (odd lot; no naked calls, ever)

The concrete contract is chosen by the options compiler, not here.
"""

from __future__ import annotations

from northstar.domain import StrategyInstance, TradeProposal
from northstar.strategies.base import EngineContext


def _occ_is_put(symbol: str) -> bool:
    return len(symbol) > 9 and symbol[-9] == "P"


def _occ_is_call(symbol: str) -> bool:
    return len(symbol) > 9 and symbol[-9] == "C"


def propose(instance: StrategyInstance, weight: float, ctx: EngineContext) -> list[TradeProposal]:
    p = instance.params
    underlyings: list[str] = p.get("underlyings", [])
    if not underlyings:
        return []
    per_name_budget = ctx.allocation_equity(weight) / len(underlyings)
    proposals: list[TradeProposal] = []

    for und in underlyings:
        if ctx.has_open_order_for(und):
            continue
        # affordability: a delta-0.25 put's collateral is roughly price*0.90 x100
        df = ctx.bars.get(und)
        if df is not None and len(df):
            est_collateral = float(df["close"].iloc[-1]) * 0.90 * 100
            if est_collateral > per_name_budget:
                continue  # honest skip: this name is too expensive for the budget
        opts = ctx.option_positions(und)
        short_puts = [o for o in opts if _occ_is_put(o["symbol"]) and float(o["qty"]) < 0]
        short_calls = [o for o in opts if _occ_is_call(o["symbol"]) and float(o["qty"]) < 0]
        shares = ctx.stock_qty(und)

        if shares >= 100 and not short_calls:
            proposals.append(
                TradeProposal(
                    source=f"strategy:{instance.id}",
                    underlying=und,
                    direction="neutral_bullish",
                    strategy_type="covered_call",
                    horizon_days=int(p.get("dte_max", 45)),
                    thesis_human=(
                        f"Holding {int(shares)} {und} shares - renting them out with a covered call "
                        f"to collect premium while we wait."
                    ),
                    invalidation="shares called away (that's a win: sold at the strike)",
                    params={
                        "target_delta": float(p.get("target_delta", 0.25)),
                        "dte_min": int(p.get("dte_min", 21)),
                        "dte_max": int(p.get("dte_max", 45)),
                        "contracts": int(shares // 100),
                    },
                )
            )
        elif shares < 100 and not short_puts:
            proposals.append(
                TradeProposal(
                    source=f"strategy:{instance.id}",
                    underlying=und,
                    direction="neutral_bullish",
                    strategy_type="cash_secured_put",
                    horizon_days=int(p.get("dte_max", 45)),
                    thesis_human=(
                        f"Selling a cash-secured put on {und}: we get paid today and only buy "
                        f"if the price drops to our chosen level."
                    ),
                    invalidation="assignment (fine - wheel then sells covered calls)",
                    params={
                        "target_delta": float(p.get("target_delta", 0.25)),
                        "dte_min": int(p.get("dte_min", 21)),
                        "dte_max": int(p.get("dte_max", 45)),
                        "capital_cap": per_name_budget,
                    },
                )
            )
    return proposals
