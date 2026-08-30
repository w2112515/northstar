"""Weather v2 walk-forward: proxy score, overlay, IS floor selection."""

import numpy as np
import pandas as pd

from northstar.backtest.weather_gate import (
    apply_weather_overlay,
    choose_floor,
    validate_weather_floor,
    vol_proxy_score,
)


def synthetic_spy(n=800, seed=3):
    """Calm first half, violent second half."""
    rng = np.random.default_rng(seed)
    calm = rng.normal(0.0004, 0.006, n // 2)
    wild = rng.normal(-0.0002, 0.025, n - n // 2)
    rets = np.concatenate([calm, wild])
    idx = pd.bdate_range("2023-01-02", periods=n)
    return pd.DataFrame({"close": 100 * (1 + pd.Series(rets, index=idx)).cumprod()})


def test_vol_proxy_scores_calm_high_storm_low():
    spy = synthetic_spy()
    score = vol_proxy_score(spy["close"])
    calm_scores = score.loc[spy.index[100]:spy.index[250]].dropna()
    # early storm: vol just spiked while the trailing year is still mostly calm
    early_storm = score.loc[spy.index[410]:spy.index[460]].dropna()
    assert calm_scores.mean() > 55
    assert early_storm.mean() < 30


def test_overlay_zeroes_day_after_storm_signal():
    idx = pd.bdate_range("2026-01-05", periods=5)
    returns = pd.Series([0.01, 0.01, 0.01, 0.01, 0.01], index=idx)
    score = pd.Series([80, 10, 80, 80, 80], index=idx)  # storm on day 2
    out = apply_weather_overlay(returns, score, floor=20)
    assert out.iloc[2] == 0.0            # flat the day AFTER the storm reading
    assert out.iloc[1] == 0.01           # the storm day itself still has old exposure
    assert out.iloc[3] == 0.01


def test_overlay_floor_zero_changes_nothing():
    idx = pd.bdate_range("2026-01-05", periods=4)
    returns = pd.Series([0.01, -0.02, 0.03, 0.0], index=idx)
    score = pd.Series([5, 5, 5, 5], index=idx)
    assert apply_weather_overlay(returns, score, floor=0).equals(returns)


def test_choose_floor_prefers_skipping_storm_losses():
    rng = np.random.default_rng(11)
    idx = pd.bdate_range("2023-01-02", periods=400)
    returns = pd.Series(rng.normal(0.0008, 0.004, 400), index=idx)
    score = pd.Series(75.0, index=idx)
    # storm block with heavy losses: a floor that sidesteps it should win IS
    returns.iloc[200:260] = rng.normal(-0.01, 0.02, 60)
    score.iloc[199:259] = 12.0
    sel = choose_floor(returns, score)
    assert sel["chosen_floor"] >= 20
    table = {r["floor"]: r for r in sel["table"]}
    assert table[sel["chosen_floor"]]["sharpe"] > table[0]["sharpe"]


def test_validate_weather_floor_end_to_end_on_synthetic_bars():
    spy = synthetic_spy()
    # a few more "names" with correlated noise so momentum has something to rank
    rng = np.random.default_rng(9)
    bars = {"SPY": spy}
    for i, sym in enumerate(["AAA", "BBB", "CCC"]):
        noise = pd.Series(rng.normal(0, 0.004, len(spy)), index=spy.index)
        bars[sym] = pd.DataFrame({"close": spy["close"] * (1 + noise).cumprod() * (1 + i * 0.1)})
    report = validate_weather_floor(bars=bars)
    assert report["ok"] is True
    assert report["oos"]["floor"] in (0, 10, 20, 30, 40)
    assert "vol" in report["proxy_note"].lower() or "volatility" in report["proxy_note"].lower()
    assert report["window"]["oos_days"] > 100
    assert report["oos"]["verdict"] in ("helps", "mixed", "does not help")
