"""Strategy catalog + runtime registry.

Catalog = what users can see & pick (14 classics + AI analyst).
Runtime = deterministic programs that emit TradeProposals. Ten families are
runnable (wheel/CSP/CC, four defined-risk spreads incl. the bull call debit,
momentum, RSI reversion, MA cross); the rest are honestly labeled "coming
soon" in the UI, never faked.
"""

from __future__ import annotations

from typing import Any

# Honest evidence class for the Strategies switchboard. walk_forward is the
# only path that produces OOS Sharpe; vol_approx is labeled; rules_only and
# llm must never be dressed as a backtest number.
EVIDENCE_KINDS = ("walk_forward", "vol_approx", "rules_only", "llm", "none")

CATALOG: list[dict[str, Any]] = [
    # --- options (Alpaca hackathon requires options at the core)
    {"family": "wheel", "type": "wheel", "asset": "options", "risk": "medium-low",
     "name": "Wheel (income cycle)", "runnable": True, "evidence": "vol_approx",
     "plain": "Sell insurance for rent: cash-secured puts, take assignment, then covered calls - repeat.",
     "default_params": {"underlyings": ["NVDA", "INTC"], "target_delta": 0.25, "dte_min": 21, "dte_max": 45}},
    {"family": "cash_secured_put", "type": "cash_secured_put", "asset": "options", "risk": "medium-low",
     "name": "Cash-Secured Put", "runnable": True, "evidence": "rules_only",
     "plain": "Get paid today for agreeing to buy a stock cheaper than it trades now.",
     "default_params": {"underlyings": ["INTC"], "target_delta": 0.25, "dte_min": 21, "dte_max": 45}},
    {"family": "covered_call", "type": "covered_call", "asset": "options", "risk": "low",
     "name": "Covered Call", "runnable": True, "evidence": "rules_only",
     "plain": "Rent out shares you already own for extra income.",
     "default_params": {"underlyings": ["NVDA", "INTC"], "target_delta": 0.25, "dte_min": 21, "dte_max": 45}},
    {"family": "bull_put_spread", "type": "bull_put_spread", "asset": "options", "risk": "medium",
     "name": "Bull Put Credit Spread", "runnable": True, "evidence": "rules_only",
     "plain": "Collect a premium betting a stock won't fall much - losses strictly capped.",
     "default_params": {"underlyings": ["SPY", "QQQ"], "target_delta": 0.25, "width_pct": 0.03,
                         "trend_sma": 50, "dte_min": 21, "dte_max": 45, "min_credit_ratio": 0.15}},
    {"family": "bear_call_spread", "type": "bear_call_spread", "asset": "options", "risk": "medium",
     "name": "Bear Call Credit Spread", "runnable": True, "evidence": "rules_only",
     "plain": "Collect a premium betting a stock won't rise much - losses strictly capped.",
     "default_params": {"underlyings": ["SPY", "QQQ"], "target_delta": 0.25, "width_pct": 0.03,
                         "trend_sma": 50, "dte_min": 21, "dte_max": 45, "min_credit_ratio": 0.15}},
    {"family": "bull_call_spread", "type": "bull_call_spread", "asset": "options", "risk": "medium",
     "name": "Bull Call Debit Spread", "runnable": True, "evidence": "rules_only",
     "plain": "Pay a little to profit from a moderate rise - both gain and loss capped.",
     "default_params": {"underlyings": ["SPY", "QQQ"], "long_delta": 0.55, "width_pct": 0.03,
                         "trend_sma": 50, "min_trend": 0.02, "dte_min": 21, "dte_max": 45,
                         "max_debit_ratio": 0.60}},
    {"family": "iron_condor", "type": "iron_condor", "asset": "options", "risk": "medium",
     "name": "Iron Condor", "runnable": True, "evidence": "rules_only",
     "plain": "Bet on a quiet market: collect premium on both sides, losses capped.",
     "default_params": {"underlyings": ["SPY"], "target_delta": 0.20, "width_pct": 0.03,
                         "trend_sma": 50, "range_band": 0.03, "vol_short": 21, "vol_long": 63,
                         "dte_min": 21, "dte_max": 45, "min_credit_ratio": 0.15}},
    {"family": "protective_put", "type": "protective_put", "asset": "options", "risk": "low",
     "name": "Protective Put", "runnable": False, "evidence": "none",
     "plain": "Buy insurance on shares you hold."},
    # --- equities
    {"family": "momentum_rotation", "type": "momentum_rotation", "asset": "stocks", "risk": "medium",
     "name": "Momentum Rotation (Top-N)", "runnable": True, "evidence": "walk_forward",
     "plain": "Own the strongest few names; rotate as leadership changes.",
     "default_params": {"universe": ["SPY", "QQQ", "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "AMD", "TSLA"],
                         "lookback_days": 90, "top_n": 3, "rebalance_days": 5}},
    {"family": "ma_cross_trend", "type": "ma_cross_trend", "asset": "stocks", "risk": "medium",
     "name": "MA Cross Trend", "runnable": True, "evidence": "walk_forward",
     "plain": "Ride trends: in when the fast average crosses above the slow one.",
     "default_params": {"universe": ["SPY", "QQQ", "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META"],
                         "fast": 20, "slow": 100, "hold_days": 20}},
    {"family": "rsi_mean_reversion", "type": "rsi_mean_reversion", "asset": "stocks", "risk": "medium",
     "name": "RSI Mean Reversion", "runnable": True, "evidence": "walk_forward",
     "plain": "Buy short-term overreactions, sell the bounce.",
     "default_params": {"universe": ["SPY", "QQQ", "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META"],
                         "rsi_period": 2, "entry_rsi": 10, "exit_rsi": 70, "trend_sma": 200,
                         "max_names": 3}},
    {"family": "bollinger_reversion", "type": "bollinger_reversion", "asset": "stocks", "risk": "medium",
     "name": "Bollinger Reversion", "runnable": False, "evidence": "none",
     "plain": "Fade moves that stretch far from the recent average."},
    {"family": "sector_rotation", "type": "sector_rotation", "asset": "stocks", "risk": "medium",
     "name": "Sector Rotation", "runnable": False, "evidence": "none",
     "plain": "Hold the strongest sectors, rotate monthly."},
    {"family": "defensive_6040", "type": "defensive_6040", "asset": "stocks", "risk": "low",
     "name": "Defensive 60/40", "runnable": False, "evidence": "none",
     "plain": "The boring classic: mostly broad market plus bonds. Our internal baseline."},
    # --- shipyard (structural evolution output; instances are born from
    #     approved DSL specs, never seeded by default)
    {"family": "dsl_rotation", "type": "dsl_rotation", "asset": "stocks", "risk": "medium",
     "name": "Shipyard Rotation (DSL)", "runnable": True, "evidence": "walk_forward",
     "plain": "Strategies the system DESIGNED itself: a validated factor-blend spec, walk-forward "
              "tested, deflated-Sharpe scored, and only trading after your approval and a paper trial.",
     "default_params": {}},
    # --- AI
    {"family": "ai_analyst", "type": "ai_analyst", "asset": "stocks", "risk": "medium",
     "name": "AI Analyst (Gemini)", "runnable": True, "evidence": "llm",
     "plain": "Gemini reads momentum, holdings and market weather, then proposes at most one "
              "high-conviction stock trade - sized by our code, checked by the same gate. "
              "Without GOOGLE_API_KEY it stays silent, never faked.",
     "default_params": {"universe": ["SPY", "QQQ", "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "AMD", "TSLA"]}},
]


def catalog_entry(family: str) -> dict[str, Any] | None:
    return next((c for c in CATALOG if c["family"] == family), None)
