"""Weather v2: walk-forward validation of the weather_floor threshold.

What this proves (and what it does not - both stated in every report):

- PROXY: history only has prices, so the historical "weather score" here is
  the vol component alone (the 0.4-weight anchor of the live 3-source index).
  Live news/GDELT tone cannot be reconstructed retroactively; the live index
  keeps accumulating in weather_history for future full-index studies.
- OVERLAY: the simulation goes FLAT on storm days. The live gate is softer -
  it only pauses NEW risk and never touches exits - so the simulated effect
  is an upper bound of the overlay's bite, not a promise.
- Walk-forward: the floor is chosen on the in-sample window only; the OOS
  window reports how that choice would have done afterwards. No OOS tuning.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pandas as pd

from northstar.backtest.engine import metrics, momentum_backtest

FLOORS = (10, 20, 30, 40)
PROXY_NOTE = (
    "Historical score = volatility component only (the 0.4-weight anchor of the live "
    "3-source index); news/GDELT tone has no deep history. Overlay simulates going flat "
    "on storm days - stricter than the live rule, which only pauses new positions."
)


# --------------------------------------------------------------------------- pure pieces

def vol_proxy_score(closes: pd.Series, vol_window: int = 21, rank_window: int = 252) -> pd.Series:
    """Daily 0-100 proxy weather score from prices, mirroring weather.vol_percentile_score:
    21-day realized vol, percentile-ranked in its trailing year, inverted."""
    rets = closes.pct_change()
    roll = (rets.rolling(vol_window).std() * (252 ** 0.5))
    pct = roll.rolling(rank_window, min_periods=60).apply(
        lambda w: float((w <= w[-1]).mean() * 100), raw=True
    )
    return (100.0 - pct).clip(0.0, 100.0).rename("weather_proxy")


def apply_weather_overlay(returns: pd.Series, score: pd.Series, floor: float) -> pd.Series:
    """Strategy daily returns with exposure zeroed the day AFTER the score is
    below the floor (signal on close, action next day - no lookahead)."""
    exposed = (score >= floor).astype(float).shift(1)
    aligned = exposed.reindex(returns.index).fillna(1.0)
    return returns * aligned


def choose_floor(returns: pd.Series, score: pd.Series, floors=FLOORS) -> dict[str, Any]:
    """Pick the floor with the best in-sample Sharpe (baseline floor=0 included)."""
    rows = []
    for floor in (0, *floors):
        m = metrics(apply_weather_overlay(returns, score, floor))
        rows.append({"floor": floor, **{k: m[k] for k in ("sharpe", "max_dd", "ann_return")},
                     "days_flat": int((score < floor).sum())})
    valid = [r for r in rows if r["sharpe"] is not None]
    best = max(valid, key=lambda r: r["sharpe"]) if valid else rows[0]
    return {"chosen_floor": best["floor"], "table": rows}


# --------------------------------------------------------------------------- full study

def validate_weather_floor(
    bars: dict[str, pd.DataFrame] | None = None,
    floors=FLOORS,
    oos_frac: float = 0.3,
) -> dict[str, Any]:
    """IS floor selection -> OOS verdict, on momentum returns with the vol proxy."""
    if bars is None:
        from northstar.broker import daily_bars

        universe = ["SPY", "QQQ", "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "AMD", "TSLA"]
        bars = daily_bars(sorted(set(universe + ["SPY"])), years=4.0)

    spy = bars.get("SPY")
    if spy is None or len(spy) < 400:
        return {"ok": False, "error": "not enough SPY history for the vol proxy"}

    score = vol_proxy_score(spy["close"])
    returns = momentum_backtest(bars)
    returns, score = returns.align(score, join="inner")

    split = int(len(returns) * (1 - oos_frac))
    r_is, r_oos = returns.iloc[:split], returns.iloc[split:]
    s_is, s_oos = score.iloc[:split], score.iloc[split:]

    selection = choose_floor(r_is, s_is, floors)
    floor = selection["chosen_floor"]

    oos_base = metrics(r_oos)
    oos_gated = metrics(apply_weather_overlay(r_oos, s_oos, floor))
    verdict = (
        "helps" if (oos_gated["sharpe"] or 0) > (oos_base["sharpe"] or 0)
        and (oos_gated["max_dd"] or -1) >= (oos_base["max_dd"] or -1)
        else "mixed" if (oos_gated["max_dd"] or -1) > (oos_base["max_dd"] or -1)
        else "does not help"
    )
    return {
        "ok": True,
        "ts": datetime.now(timezone.utc).isoformat(),
        "proxy_note": PROXY_NOTE,
        "window": {"start": str(returns.index[0].date()), "end": str(returns.index[-1].date()),
                   "is_days": len(r_is), "oos_days": len(r_oos)},
        "in_sample": selection,
        "oos": {
            "floor": floor,
            "baseline": {k: oos_base[k] for k in ("sharpe", "max_dd", "ann_return")},
            "gated": {k: oos_gated[k] for k in ("sharpe", "max_dd", "ann_return")},
            "storm_days": int((s_oos < floor).sum()),
            "verdict": verdict,
        },
    }


def weather_drift_check(store, min_readings: int = 50) -> dict[str, Any] | None:
    """Once the live 3-source history is deep enough, compare it against the
    vol-only proxy for the same dates and journal the drift."""
    from northstar.broker import daily_bars
    from northstar.domain import JournalEvent

    history = [
        r for r in store.list("weather_history")
        if r.get("score") is not None and r.get("ts")
    ]
    if len(history) < min_readings:
        return None

    by_day: dict[str, list[int]] = {}
    for r in history:
        by_day.setdefault(str(r["ts"])[:10], []).append(int(r["score"]))
    live = pd.Series({d: sum(v) / len(v) for d, v in by_day.items()}).sort_index()
    live.index = pd.to_datetime(live.index)

    spy = daily_bars(["SPY"], years=2.0).get("SPY")
    if spy is None:
        return None
    proxy = vol_proxy_score(spy["close"])
    proxy.index = proxy.index.tz_localize(None) if proxy.index.tz is not None else proxy.index
    live_aligned, proxy_aligned = live.align(proxy, join="inner")
    if len(live_aligned) < 10:
        return None

    mad = float((live_aligned - proxy_aligned).abs().mean())
    out = {"days_compared": len(live_aligned), "mean_abs_diff": round(mad, 1)}
    store.append_event(
        JournalEvent(
            kind="digest",
            human=(
                f"Weather drift check: live 3-source index vs vol-only proxy differ by "
                f"{mad:.0f} points on average over {len(live_aligned)} shared days. "
                + ("They tell a similar story." if mad <= 15 else
                   "The extra news/global sources are adding real signal beyond volatility.")
            ),
            payload=out,
        )
    )
    return out
