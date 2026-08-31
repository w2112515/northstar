"""Market Compass: deterministic regime classification + conditional stats.

The compass answers two questions the desk keeps asking:
  1. What kind of market is this?   (trend x volatility x breadth - pure math)
  2. Which crews historically earn their keep in THIS kind of market?
     (champion walk-forward OOS returns bucketed by historical regime)

Honesty contract: the classifier is deterministic and reproducible from bars;
conditional stats REFUSE to answer for any bucket with fewer than MIN_BUCKET_DAYS
trading days; Gemini may narrate a hypothesis but never emits a number that
isn't already computed here. Nothing in this module places orders.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd

from northstar.domain import JournalEvent

TREND_SMA = 200
TREND_SLOPE_DAYS = 20
VOL_WINDOW = 20
VOL_LOOKBACK = 504          # ~2y window for the vol percentile
BREADTH_SMA = 50
MIN_BUCKET_DAYS = 120       # below this, "not enough history in this weather"

REGIME_LABELS = ("up_calm", "up_stressed", "flat_choppy", "down_calm", "down_stressed")


# --------------------------------------------------------------------------- pure classifier

def classify_day(close: float, sma200: float, slope: float, vol_pctile: float) -> str:
    """One day's regime from precomputed inputs. Vol percentile in [0,1]."""
    if np.isnan(sma200) or np.isnan(vol_pctile):
        return "unknown"
    trend = "up" if close > sma200 and slope >= 0 else ("down" if close < sma200 and slope <= 0 else "flat")
    stressed = vol_pctile >= 0.70
    if trend == "up":
        return "up_stressed" if stressed else "up_calm"
    if trend == "down":
        return "down_stressed" if stressed else "down_calm"
    return "flat_choppy"


def regime_history(spy: pd.DataFrame) -> pd.Series:
    """Daily regime labels for the whole SPY history given (pure, vectorized
    inputs -> per-day classification). Early days without a 200SMA are 'unknown'."""
    closes = spy["close"]
    sma200 = closes.rolling(TREND_SMA).mean()
    slope = sma200.diff(TREND_SLOPE_DAYS)
    vol = closes.pct_change().rolling(VOL_WINDOW).std() * np.sqrt(252)
    vol_pctile = vol.rolling(VOL_LOOKBACK, min_periods=VOL_WINDOW * 3).rank(pct=True)
    out = pd.Series(
        [
            classify_day(c, m, s if not np.isnan(s) else 0.0, p)
            for c, m, s, p in zip(closes, sma200, slope, vol_pctile)
        ],
        index=closes.index,
    )
    return out


def breadth_pct(bars: dict[str, pd.DataFrame]) -> float | None:
    """Share of names trading above their 50SMA (today). None if <5 usable."""
    above, total = 0, 0
    for df in bars.values():
        closes = df["close"]
        if len(closes) < BREADTH_SMA + 2:
            continue
        total += 1
        if float(closes.iloc[-1]) > float(closes.rolling(BREADTH_SMA).mean().iloc[-1]):
            above += 1
    return round(above / total, 3) if total >= 5 else None


def current_regime(spy: pd.DataFrame, breadth: float | None) -> dict[str, Any]:
    hist = regime_history(spy)
    label = str(hist.iloc[-1]) if len(hist) else "unknown"
    closes = spy["close"]
    vol = float(closes.pct_change().tail(VOL_WINDOW).std() * np.sqrt(252)) if len(closes) > VOL_WINDOW else None
    streak = 0
    for v in reversed(hist.tolist()):
        if v != label:
            break
        streak += 1
    return {
        "label": label,
        "streak_days": streak,
        "realized_vol_20d": round(vol, 4) if vol is not None else None,
        "breadth_above_50sma": breadth,
    }


# --------------------------------------------------------------------------- conditional stats

def conditional_performance(
    oos_returns: pd.Series, regimes: pd.Series, min_days: int = MIN_BUCKET_DAYS
) -> dict[str, dict[str, Any]]:
    """Bucket a strategy's OOS daily returns by same-day regime label.

    Returns {label: {sharpe, ann_return, win_rate, days}} for buckets with
    enough history, and {label: {days, refused: true}} for thin ones - the
    honest refusal is part of the product surface, not an error.
    """
    joined = pd.DataFrame({"r": oos_returns}).join(regimes.rename("regime"), how="inner")
    out: dict[str, dict[str, Any]] = {}
    for label, grp in joined.groupby("regime"):
        if label in ("unknown",):
            continue
        r = grp["r"].dropna()
        if len(r) < min_days:
            out[str(label)] = {"days": int(len(r)), "refused": True}
            continue
        vol = float(r.std() * np.sqrt(252))
        ann = float((1 + r).prod() ** (252 / len(r)) - 1)
        out[str(label)] = {
            "days": int(len(r)),
            "sharpe": round(ann / vol, 2) if vol > 0 else 0.0,
            "ann_return": round(ann, 4),
            "win_rate": round(float((r > 0).mean()), 3),
        }
    return out


# --------------------------------------------------------------------------- compass run

def _hypothesis(regime: dict[str, Any], families: dict[str, Any], weather: dict | None) -> tuple[str, str]:
    """(text, source). Gemini narrates the computed vector; template fallback."""
    from northstar.llm import generate_text, llm_available

    label = regime["label"].replace("_", " ")
    best = None
    for fam, stats in families.items():
        s = stats.get(regime["label"]) or {}
        if not s.get("refused") and s.get("sharpe") is not None:
            if best is None or s["sharpe"] > best[1]:
                best = (fam, s["sharpe"])
    template = (
        f"Market reads {label} ({regime['streak_days']}d streak, breadth "
        f"{regime['breadth_above_50sma'] if regime['breadth_above_50sma'] is not None else 'n/a'})."
        + (f" Historically {best[0]} carried this weather (Sharpe {best[1]:.1f} in-bucket)."
           if best else " No family has enough history in this bucket to brag.")
    )
    if not llm_available() or os.getenv("NORTHSTAR_COMPASS_LLM_DISABLED"):
        return template, "template"
    import json

    text = generate_text(
        "You are the market analyst of NorthStar, a paper-trading autopilot. Never call the "
        "system a fleet or ship and never call yourself a navigator or captain. In 2-3 plain sentences, state a "
        "market hypothesis STRICTLY from these computed facts (cite the regime and one "
        "conditional stat; include a confidence word like 'tentative' or 'firm' based on "
        f"streak length; never invent numbers):\n{json.dumps({'regime': regime, 'families': families, 'weather': (weather or {}).get('bucket')})}",
        temperature=0.4,
    )
    return (text.strip(), "gemini") if text else (template, "template")


def run_compass(store) -> dict[str, Any]:
    """Nightly (or manual): classify today's regime, bucket every equity
    champion's OOS returns by historical regime, store state/compass."""
    if os.getenv("NORTHSTAR_COMPASS_DISABLED"):
        return {"skipped": "compass disabled by env"}

    from northstar.backtest import walk_forward_eval
    from northstar.broker import daily_bars
    from northstar.scout import CORE_UNIVERSE, scout_symbols
    from northstar.weather import get_weather

    breadth_pool = sorted(set(CORE_UNIVERSE) | set(scout_symbols(store)))
    bars4y = daily_bars(["SPY"], years=4.2)
    spy = bars4y.get("SPY")
    if spy is None or len(spy) < TREND_SMA + TREND_SLOPE_DAYS:
        return {"error": "not enough SPY history for the compass"}
    breadth_bars = daily_bars(breadth_pool, years=0.5)
    regime = current_regime(spy, breadth_pct(breadth_bars))
    regimes = regime_history(spy)

    families: dict[str, Any] = {}
    for doc in store.list("instances"):
        fam = str(doc.get("family", ""))
        if doc.get("status") != "champion" or not doc.get("enabled", True):
            continue
        if fam not in ("momentum_rotation", "rsi_mean_reversion", "ma_cross_trend"):
            continue
        try:
            universe = (doc.get("params") or {}).get("universe") or CORE_UNIVERSE
            fam_bars = daily_bars(sorted(set(universe)), years=4.0)
            ev = walk_forward_eval(fam_bars, doc.get("params") or {}, family=fam)
            oos = ev.get("oos_returns")
            if oos is not None and len(oos):
                families[fam] = conditional_performance(oos, regimes)
        except Exception as e:
            families[fam] = {"error": f"{type(e).__name__}: {e}"}

    weather = None
    try:
        weather = get_weather(store)
    except Exception:
        pass
    hypothesis, source = _hypothesis(regime, families, weather)

    doc = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "regime": regime,
        "families": families,
        "hypothesis": hypothesis,
        "hypothesis_source": source,
        "min_bucket_days": MIN_BUCKET_DAYS,
    }
    store.save("state", "compass", doc)
    store.append_event(
        JournalEvent(
            kind="system",
            human=f"Compass: market reads {regime['label'].replace('_', ' ')} "
                  f"({regime['streak_days']}d streak). {hypothesis[:140]}",
            payload=doc,
        )
    )
    return doc
