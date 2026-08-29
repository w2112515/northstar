"""Strategy catalog + runtime registry.

Catalog = what users can see & pick (14 classics + AI analyst).
Runtime = deterministic programs that emit TradeProposals. In G2 two families
are runnable (wheel, momentum_rotation); the rest are honestly labeled
"coming soon" in the UI (enabled=False), never faked.
"""

from __future__ import annotations

from typing import Any

CATALOG: list[dict[str, Any]] = [
    # --- options (Alpaca hackathon requires options at the core)
    {"family": "wheel", "type": "wheel", "asset": "options", "risk": "medium-low",
     "name": "Wheel (income cycle)", "runnable": True,
     "plain": "Sell insurance for rent: cash-secured puts, take assignment, then covered calls - repeat.",
     "default_params": {"underlyings": ["NVDA", "INTC"], "target_delta": 0.25, "dte_min": 21, "dte_max": 45}},
    {"family": "cash_secured_put", "type": "cash_secured_put", "asset": "options", "risk": "medium-low",
     "name": "Cash-Secured Put", "runnable": True,
     "plain": "Get paid today for agreeing to buy a stock cheaper than it trades now.",
     "default_params": {"underlyings": ["INTC"], "target_delta": 0.25, "dte_min": 21, "dte_max": 45}},
    {"family": "covered_call", "type": "covered_call", "asset": "options", "risk": "low",
     "name": "Covered Call", "runnable": True,
     "plain": "Rent out shares you already own for extra income.",
     "default_params": {"target_delta": 0.25, "dte_min": 21, "dte_max": 45}},
    {"family": "bull_put_spread", "type": "bull_put_spread", "asset": "options", "risk": "medium",
     "name": "Bull Put Credit Spread", "runnable": False,
     "plain": "Collect a premium betting a stock won't fall much - losses strictly capped."},
    {"family": "bear_call_spread", "type": "bear_call_spread", "asset": "options", "risk": "medium",
     "name": "Bear Call Credit Spread", "runnable": False,
     "plain": "Collect a premium betting a stock won't rise much - losses strictly capped."},
    {"family": "bull_call_spread", "type": "bull_call_spread", "asset": "options", "risk": "medium",
     "name": "Bull Call Debit Spread", "runnable": False,
     "plain": "Pay a little to profit from a moderate rise - both gain and loss capped."},
    {"family": "iron_condor", "type": "iron_condor", "asset": "options", "risk": "medium",
     "name": "Iron Condor", "runnable": False,
     "plain": "Bet on a quiet market: collect premium on both sides, losses capped."},
    {"family": "protective_put", "type": "protective_put", "asset": "options", "risk": "low",
     "name": "Protective Put", "runnable": False,
     "plain": "Buy insurance on shares you hold."},
    # --- equities
    {"family": "momentum_rotation", "type": "momentum_rotation", "asset": "stocks", "risk": "medium",
     "name": "Momentum Rotation (Top-N)", "runnable": True,
     "plain": "Own the strongest few names; rotate as leadership changes.",
     "default_params": {"universe": ["SPY", "QQQ", "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "AMD", "TSLA"],
                         "lookback_days": 90, "top_n": 3, "rebalance_days": 5}},
    {"family": "ma_cross_trend", "type": "ma_cross_trend", "asset": "stocks", "risk": "medium",
     "name": "MA Cross Trend", "runnable": False,
     "plain": "Ride trends: in when the fast average crosses above the slow one."},
    {"family": "rsi_mean_reversion", "type": "rsi_mean_reversion", "asset": "stocks", "risk": "medium",
     "name": "RSI Mean Reversion", "runnable": False,
     "plain": "Buy short-term overreactions, sell the bounce."},
    {"family": "bollinger_reversion", "type": "bollinger_reversion", "asset": "stocks", "risk": "medium",
     "name": "Bollinger Reversion", "runnable": False,
     "plain": "Fade moves that stretch far from the recent average."},
    {"family": "sector_rotation", "type": "sector_rotation", "asset": "stocks", "risk": "medium",
     "name": "Sector Rotation", "runnable": False,
     "plain": "Hold the strongest sectors, rotate monthly."},
    {"family": "defensive_6040", "type": "defensive_6040", "asset": "stocks", "risk": "low",
     "name": "Defensive 60/40", "runnable": False,
     "plain": "The boring classic: mostly broad market plus bonds. Our internal baseline."},
    # --- AI
    {"family": "ai_analyst", "type": "ai_analyst", "asset": "stocks", "risk": "medium",
     "name": "AI Analyst (Gemini)", "runnable": False,
     "plain": "A Gemini research crew proposes occasional high-conviction trades. Needs GOOGLE_API_KEY."},
]


def catalog_entry(family: str) -> dict[str, Any] | None:
    return next((c for c in CATALOG if c["family"] == family), None)
