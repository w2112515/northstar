"""Defined-risk vertical spreads: bull put, bear call, iron condor, bull call.

One program serves all four families - the instance's strategy_type picks the
shape, a simple daily-bar regime filter decides IF we propose today:

  bull_put_spread   close > SMA(trend)                    (up/sideways market)
  bear_call_spread  close < SMA(trend)                    (down/sideways market)
  iron_condor       |close/SMA - 1| < range_band AND      (quiet, range-bound)
                    short-window realized vol < long-window
  bull_call_spread  close > SMA(trend) by min_trend       (clear uptrend; the
                    one net-DEBIT shape: pay a capped cost for capped upside)

Strike/width/credit selection lives in the compiler; max loss is enforced by
the gate (defined-risk cap). Wing width is quoted as a % of spot and passed in
dollars so the compiler stays regime-agnostic.
"""

from __future__ import annotations

from northstar.domain import StrategyInstance, TradeProposal
from northstar.indicators import realized_vol, sma
from northstar.strategies.base import EngineContext, effective_underlyings

SPREAD_TYPES = ("bull_put_spread", "bear_call_spread", "iron_condor", "bull_call_spread")


def propose(instance: StrategyInstance, weight: float, ctx: EngineContext) -> list[TradeProposal]:
    p = instance.params
    stype = instance.strategy_type
    if stype not in SPREAD_TYPES:
        return []
    underlyings = effective_underlyings(p, ctx)
    if not underlyings:
        return []
    per_name_budget = ctx.allocation_equity(weight) / len(underlyings)
    # per-trade $ risk the compiler may size up to (contracts = budget // per-
    # contract max loss). Bounded by the plan's per-trade cap AND this name's
    # sleeve share; the gate re-checks the same cap on the compiled order.
    g = ctx.plan.guardrails if ctx.plan else None
    per_trade_cap = ctx.equity() * (g.max_loss_per_trade_pct if g else 0.01)
    trend_days = int(p.get("trend_sma", 50))
    width_pct = float(p.get("width_pct", 0.05))
    proposals: list[TradeProposal] = []

    for und in underlyings:
        if ctx.has_open_order_for(und) or ctx.has_open_option_order_for(und) or ctx.option_positions(und):
            continue  # one options structure per name at a time
        df = ctx.bars.get(und)
        if df is None or len(df) < trend_days + 5:
            continue
        closes = df["close"]
        spot = float(closes.iloc[-1])
        trend = float(sma(closes, trend_days).iloc[-1])
        width = max(round(spot * width_pct), 1.0)

        # honest affordability: worst case ~= width x100 must fit this name's budget
        if width * 100 > per_name_budget:
            continue

        direction, thesis = _regime_call(stype, und, spot, trend, closes, p)
        if direction is None:
            continue

        params = {
            "target_delta": float(p.get("target_delta", 0.20 if stype == "iron_condor" else 0.25)),
            "width": width,
            "dte_min": int(p.get("dte_min", 21)),
            "dte_max": int(p.get("dte_max", 45)),
            "min_credit_ratio": float(p.get("min_credit_ratio", 0.15)),
            "risk_budget": round(min(per_trade_cap, per_name_budget), 2),
        }
        invalidation = "price breaks through the short strike - loss stays capped at the wing"
        if stype == "bull_call_spread":
            params["long_delta"] = float(p.get("long_delta", 0.55))
            params["max_debit_ratio"] = float(p.get("max_debit_ratio", 0.60))
            invalidation = "the rise stalls below the long strike - loss stays capped at the debit paid"

        proposals.append(
            TradeProposal(
                source=f"strategy:{instance.id}",
                underlying=und,
                direction=direction,
                strategy_type=stype,
                horizon_days=int(p.get("dte_max", 45)),
                thesis_human=thesis,
                invalidation=invalidation,
                params=params,
            )
        )
    return proposals


def _regime_call(stype, und, spot, trend, closes, p):
    """(direction, thesis) when today's regime fits the shape, else (None, '')."""
    rel = spot / trend - 1 if trend > 0 else 0.0

    trend_days = int(p.get("trend_sma", 50))
    if stype == "bull_put_spread":
        if rel <= 0:
            return None, ""
        return "neutral_bullish", (
            f"{und} trades {rel:+.1%} above its {trend_days}-day average - selling a put spread "
            f"below the market: we win if it simply doesn't fall hard."
        )
    if stype == "bear_call_spread":
        if rel >= 0:
            return None, ""
        return "neutral_bearish", (
            f"{und} trades {rel:+.1%} below its {trend_days}-day average - selling a call spread "
            f"above the market: we win if the bounce stays modest."
        )
    if stype == "bull_call_spread":
        # the one debit shape: needs a CLEAR uptrend, not just any close above trend
        min_trend = float(p.get("min_trend", 0.02))
        if rel < min_trend:
            return None, ""
        return "bullish", (
            f"{und} trades {rel:+.1%} above its {trend_days}-day average - buying a call spread: "
            f"a capped-cost bet that the climb continues."
        )
    # iron condor: quiet + range-bound
    band = float(p.get("range_band", 0.03))
    rv_short = realized_vol(closes, int(p.get("vol_short", 21)))
    rv_long = realized_vol(closes, int(p.get("vol_long", 63)))
    if abs(rel) > band or rv_short is None or rv_long is None or rv_short >= rv_long:
        return None, ""
    return "neutral", (
        f"{und} sits within {abs(rel):.1%} of its average and recent volatility is cooling "
        f"({rv_short:.0%} vs {rv_long:.0%}) - collecting premium on both sides of the range."
    )
