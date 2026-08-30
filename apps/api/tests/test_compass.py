"""Market compass: deterministic regime classification, conditional buckets,
and the <120-day honest refusal."""

import numpy as np
import pandas as pd

from northstar.regime import (
    MIN_BUCKET_DAYS,
    breadth_pct,
    classify_day,
    conditional_performance,
    current_regime,
    regime_history,
)


def spy_frame(segments: list[tuple[int, float, float]], start_price=400.0, seed=3) -> pd.DataFrame:
    """segments = [(days, daily_drift, daily_sigma), ...] -> OHLCV frame."""
    rng = np.random.default_rng(seed)
    rets = np.concatenate([rng.normal(mu, sd, n) for n, mu, sd in segments])
    closes = start_price * np.cumprod(1 + rets)
    idx = pd.date_range("2022-06-01", periods=len(closes), freq="B", tz="UTC")
    return pd.DataFrame(
        {"open": closes, "high": closes, "low": closes, "close": closes,
         "volume": np.full(len(closes), 1e6)},
        index=idx,
    )


def test_classify_day_matrix():
    assert classify_day(110, 100, +1, 0.2) == "up_calm"
    assert classify_day(110, 100, +1, 0.9) == "up_stressed"
    assert classify_day(90, 100, -1, 0.9) == "down_stressed"
    assert classify_day(90, 100, -1, 0.2) == "down_calm"
    assert classify_day(110, 100, -1, 0.2) == "flat_choppy"  # price up, slope down
    assert classify_day(110, float("nan"), 0, 0.5) == "unknown"


def test_history_sees_the_crash():
    calm_up = spy_frame([(700, 0.0006, 0.005)])
    hist_up = regime_history(calm_up)
    assert hist_up.iloc[-1] in ("up_calm", "up_stressed")

    crash = spy_frame([(700, 0.0006, 0.005), (80, -0.008, 0.03)])
    hist = regime_history(crash)
    assert hist.iloc[-1] == "down_stressed"
    reg = current_regime(crash, breadth=0.2)
    assert reg["label"] == "down_stressed"
    assert reg["streak_days"] >= 1
    assert reg["breadth_above_50sma"] == 0.2


def test_breadth_counts_above_50sma():
    up = spy_frame([(120, 0.003, 0.001)], seed=1)
    down = spy_frame([(120, -0.003, 0.001)], seed=2)
    bars = {f"U{i}": up for i in range(4)} | {"D0": down, "D1": down}
    assert breadth_pct(bars) == round(4 / 6, 3)
    assert breadth_pct({"U0": up}) is None  # fewer than 5 usable names


def test_conditional_buckets_refuse_thin_history():
    idx = pd.date_range("2024-01-01", periods=200, freq="B", tz="UTC")
    rng = np.random.default_rng(5)
    # regime A: 150 days of positive edge; regime B: only 50 days
    returns = pd.Series(
        np.concatenate([rng.normal(0.001, 0.01, 150), rng.normal(-0.002, 0.01, 50)]), index=idx
    )
    regimes = pd.Series(["up_calm"] * 150 + ["down_stressed"] * 50, index=idx)
    out = conditional_performance(returns, regimes, min_days=MIN_BUCKET_DAYS)
    assert out["up_calm"]["days"] == 150
    assert out["up_calm"]["sharpe"] is not None
    assert out["down_stressed"] == {"days": 50, "refused": True}
