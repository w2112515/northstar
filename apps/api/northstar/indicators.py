"""Shared indicator helpers (pandas). Used by both live strategies and backtests
so a signal means the same thing in the lab and on the water.
"""

from __future__ import annotations

import numpy as np
import pandas as pd


def sma(closes: pd.Series, window: int) -> pd.Series:
    return closes.rolling(window).mean()


def rsi(closes: pd.Series, period: int = 2) -> pd.Series:
    """Wilder's RSI. All-gain windows divide by zero -> inf -> RSI 100 (correct)."""
    delta = closes.diff()
    gain = delta.clip(lower=0.0)
    loss = -delta.clip(upper=0.0)
    avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    rs = avg_gain / avg_loss
    return 100 - 100 / (1 + rs)


def realized_vol(closes: pd.Series, window: int) -> float | None:
    r = closes.pct_change().tail(window)
    if len(r.dropna()) < window // 2:
        return None
    return float(r.std() * np.sqrt(252))
