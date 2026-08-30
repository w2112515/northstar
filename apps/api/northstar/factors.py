"""Factor screener (C1): grade KNOWN factors, honestly labeled as such.

A small registry of textbook cross-sectional factors (momentum, reversal,
volatility, volume, 52-week-high distance...) is evaluated every night against
the scout pool + core chart: for each factor we compute the daily
cross-sectional rank-IC (Spearman correlation between today's factor value and
the NEXT 5 trading days' return), then summarize mean IC, recent IC and a
t-stat over a ~250-day window.

This is *screening*, not mining - no expressions are invented here (that is
Wave 3's separate, human-gated module). The only actuator: the scout's score
weights may tilt toward factor families with recent positive IC, bounded to
±20% and journaled. No order ever flows from this file.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Callable

import numpy as np
import pandas as pd

from northstar.domain import JournalEvent
from northstar.indicators import rsi

WINDOW_DAYS = 250          # IC history window
FWD_DAYS = 5               # forward-return horizon the IC is measured against
RECENT_DAYS = 60           # "recent IC" = mean over this tail
MIN_SYMBOLS = 8            # fewer cross-sectional names than this -> refuse
MIN_IC_DAYS = 120          # fewer IC observations than this -> refuse to tilt


# --------------------------------------------------------------------------- registry
# Each factor: daily bars df -> full time Series (one value per day).
# Sign convention: HIGHER factor value should predict HIGHER forward return.

def _returns(df: pd.DataFrame, days: int) -> pd.Series:
    return df["close"].pct_change(days)


def f_mom_20d(df: pd.DataFrame) -> pd.Series:
    return _returns(df, 20)


def f_mom_60d(df: pd.DataFrame) -> pd.Series:
    return _returns(df, 60)


def f_mom_120d(df: pd.DataFrame) -> pd.Series:
    return _returns(df, 120)


def f_reversal_5d(df: pd.DataFrame) -> pd.Series:
    """Short-term reversal: recent losers tend to bounce."""
    return -_returns(df, 5)


def f_rsi14_oversold(df: pd.DataFrame) -> pd.Series:
    """Mean-reversion flavor of RSI: oversold (low RSI) -> positive value."""
    return 50.0 - rsi(df["close"], period=14)


def f_low_vol(df: pd.DataFrame) -> pd.Series:
    """Low-volatility anomaly: quieter names first."""
    return -df["close"].pct_change().rolling(20).std()


def f_vol_contraction(df: pd.DataFrame) -> pd.Series:
    """Volatility drying up vs its own 60d history (coiled spring)."""
    r = df["close"].pct_change()
    return r.rolling(60).std() - r.rolling(20).std()


def f_volume_surge(df: pd.DataFrame) -> pd.Series:
    v = df["volume"].astype(float)
    return v.rolling(5).mean() / v.rolling(20).mean() - 1.0


def f_dollar_volume(df: pd.DataFrame) -> pd.Series:
    """Liquidity tilt: log 20d average dollar volume."""
    return np.log((df["close"] * df["volume"]).rolling(20).mean())


def f_dist_52w_high(df: pd.DataFrame) -> pd.Series:
    """Closeness to the 52-week high (0 = at the high). Classic momentum cousin."""
    return df["close"] / df["close"].rolling(252, min_periods=120).max() - 1.0


def f_gap_1d(df: pd.DataFrame) -> pd.Series:
    return df["open"] / df["close"].shift(1) - 1.0


def f_sma50_dist(df: pd.DataFrame) -> pd.Series:
    return df["close"] / df["close"].rolling(50).mean() - 1.0


def f_range_pos_20d(df: pd.DataFrame) -> pd.Series:
    """Position inside the 20d high-low range, centered on 0."""
    hi = df["high"].rolling(20).max()
    lo = df["low"].rolling(20).min()
    return (df["close"] - lo) / (hi - lo).replace(0.0, np.nan) - 0.5


FACTORS: dict[str, Callable[[pd.DataFrame], pd.Series]] = {
    "mom_20d": f_mom_20d,
    "mom_60d": f_mom_60d,
    "mom_120d": f_mom_120d,
    "reversal_5d": f_reversal_5d,
    "rsi14_oversold": f_rsi14_oversold,
    "low_vol": f_low_vol,
    "vol_contraction": f_vol_contraction,
    "volume_surge": f_volume_surge,
    "dollar_volume": f_dollar_volume,
    "dist_52w_high": f_dist_52w_high,
    "gap_1d": f_gap_1d,
    "sma50_dist": f_sma50_dist,
    "range_pos_20d": f_range_pos_20d,
}


# --------------------------------------------------------------------------- rank-IC math

def build_panel(bars: dict[str, pd.DataFrame], fn: Callable[[pd.DataFrame], pd.Series]) -> pd.DataFrame:
    """dates x symbols matrix of factor values."""
    return pd.DataFrame({sym: fn(df) for sym, df in bars.items()})


def forward_returns(bars: dict[str, pd.DataFrame], days: int = FWD_DAYS) -> pd.DataFrame:
    """dates x symbols matrix of NEXT-`days` returns (aligned to signal date)."""
    return pd.DataFrame(
        {sym: df["close"].pct_change(days).shift(-days) for sym, df in bars.items()}
    )


def daily_rank_ic(factor: pd.DataFrame, fwd: pd.DataFrame, min_names: int = MIN_SYMBOLS) -> pd.Series:
    """Spearman correlation across symbols, one number per day.

    Rank both panels row-wise then Pearson-correlate the ranks - identical to
    Spearman but vectorizable. Days with too few valid pairs are dropped.
    """
    factor, fwd = factor.align(fwd, join="inner")
    valid = factor.notna() & fwd.notna()
    fr = factor.where(valid).rank(axis=1)
    rr = fwd.where(valid).rank(axis=1)
    n = valid.sum(axis=1)
    fr_c = fr.sub(fr.mean(axis=1), axis=0)
    rr_c = rr.sub(rr.mean(axis=1), axis=0)
    cov = (fr_c * rr_c).sum(axis=1)
    denom = np.sqrt((fr_c**2).sum(axis=1) * (rr_c**2).sum(axis=1))
    ic = cov / denom.replace(0.0, np.nan)
    return ic[n >= min_names].dropna()


def ic_summary(ic: pd.Series) -> dict[str, Any]:
    n = int(len(ic))
    if n == 0:
        return {"ic_mean": None, "ic_recent": None, "t_stat": None, "n_days": 0}
    mean = float(ic.mean())
    std = float(ic.std())
    return {
        "ic_mean": round(mean, 4),
        "ic_recent": round(float(ic.tail(RECENT_DAYS).mean()), 4),
        "t_stat": round(mean / std * np.sqrt(n), 2) if std > 0 else None,
        "n_days": n,
    }


# --------------------------------------------------------------------------- nightly run

def run_factor_screen(store, bars: dict[str, pd.DataFrame] | None = None) -> dict[str, Any]:
    """Score every registered factor on the scout pool + core chart."""
    if os.getenv("NORTHSTAR_FACTORS_DISABLED"):
        return {"skipped": "factor screen disabled by env"}

    if bars is None:
        from northstar.broker import daily_bars
        from northstar.scout import CORE_UNIVERSE, scout_recent_pool, scout_symbols

        symbols = sorted(set(CORE_UNIVERSE) | set(scout_symbols(store)) | set(scout_recent_pool(store)))
        bars = daily_bars(symbols, years=1.6)

    bars = {s: df for s, df in bars.items() if df is not None and len(df) >= 140}
    if len(bars) < MIN_SYMBOLS:
        doc = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "refused": f"only {len(bars)} names with enough history (<{MIN_SYMBOLS}) - cross-section too thin",
            "rows": [],
        }
        store.save("state", "factor_ic", doc)
        return doc

    fwd = forward_returns(bars).tail(WINDOW_DAYS)
    rows: list[dict[str, Any]] = []
    for name, fn in FACTORS.items():
        panel = build_panel(bars, fn).tail(WINDOW_DAYS)
        rows.append({"factor": name, **ic_summary(daily_rank_ic(panel, fwd))})
    rows.sort(key=lambda r: abs(r["ic_recent"] or 0.0), reverse=True)

    doc = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "universe_size": len(bars),
        "window_days": WINDOW_DAYS,
        "fwd_days": FWD_DAYS,
        "note": "screening KNOWN factors against forward 5d returns - not factor mining",
        "rows": rows,
    }
    store.save("state", "factor_ic", doc)

    strongest = [r for r in rows if r["ic_recent"] is not None][:2]
    if strongest:
        bits = ", ".join(f"{r['factor']} IC {r['ic_recent']:+.3f} (t={r['t_stat']})" for r in strongest)
        store.append_event(
            JournalEvent(
                kind="scout",
                human=f"Factor screen over {len(bars)} names: strongest recent signals - {bits}. "
                      "Known factors only; scout weights may tilt within +/-20%.",
                payload={"rows": rows[:6], "universe_size": len(bars)},
            )
        )
    return doc
