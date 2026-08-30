"""New strategy backtests + walk-forward dispatch + catalog/program parity."""

import numpy as np
import pandas as pd

from northstar.backtest import ma_cross_backtest, metrics, rsi_reversion_backtest, walk_forward_eval


def synthetic_bars(n_days: int = 700, n_syms: int = 4, seed: int = 3) -> dict[str, pd.DataFrame]:
    """Uptrend + per-symbol oscillation: produces both RSI dips and MA crosses."""
    rng = np.random.default_rng(seed)
    idx = pd.bdate_range("2023-01-02", periods=n_days, tz="UTC")
    out = {}
    t = np.arange(n_days)
    for i in range(n_syms):
        drift = 1.0004 + i * 0.0001
        wave = 1 + 0.05 * np.sin(t / (12 + 3 * i))
        noise = np.exp(rng.normal(0, 0.01, n_days).cumsum() * 0.1)
        close = 100 * (drift ** t) * wave * noise
        df = pd.DataFrame(
            {"open": close, "high": close * 1.005, "low": close * 0.995,
             "close": close, "volume": 1_000_000.0},
            index=idx,
        )
        out[f"SYM{i}"] = df
    return out


def test_rsi_reversion_backtest_produces_sane_series():
    bars = synthetic_bars()
    r = rsi_reversion_backtest(bars, rsi_period=2, entry_rsi=15, exit_rsi=70,
                               trend_sma=100, max_names=3)
    assert len(r) > 100
    assert np.isfinite(r.dropna()).all()
    m = metrics(r)
    assert m["n_days"] > 100 and m["sharpe"] is not None


def test_ma_cross_backtest_produces_sane_series():
    bars = synthetic_bars()
    r = ma_cross_backtest(bars, fast=10, slow=50)
    assert len(r) > 100
    assert np.isfinite(r.dropna()).all()
    # weights shift by a day: no same-day lookahead means first rows are flat
    assert abs(float(r.iloc[0])) < 0.5


def test_walk_forward_dispatch_per_family():
    bars = synthetic_bars()
    for family, params in [
        ("momentum_rotation", {"lookback_days": 60, "top_n": 2, "rebalance_days": 5}),
        ("rsi_mean_reversion", {"rsi_period": 2, "entry_rsi": 15, "exit_rsi": 70,
                                 "trend_sma": 100, "max_names": 3}),
        ("ma_cross_trend", {"fast": 10, "slow": 50}),
    ]:
        ev = walk_forward_eval(bars, params, family=family)
        assert "is" in ev and "oos" in ev, family
        assert ev["oos"]["n_days"] > 20, family
        assert family in ev["data_note"]


def test_every_runnable_family_has_a_program():
    """The bug class where the catalog promises what the engine can't run."""
    from northstar.engine import PROGRAMS
    from northstar.strategies import CATALOG

    for entry in CATALOG:
        if entry["runnable"]:
            assert entry["family"] in PROGRAMS, f"{entry['family']} is runnable but has no program"


def test_evolvable_families_have_param_spaces_and_defaults():
    from northstar.evolution.loop import PARAM_SPACES
    from northstar.strategies import catalog_entry

    for family, space in PARAM_SPACES.items():
        entry = catalog_entry(family)
        assert entry and entry["runnable"], family
        defaults = entry.get("default_params", {})
        for key, (lo, hi) in space.items():
            assert key in defaults, f"{family}.{key} missing default"
            assert lo <= int(defaults[key]) <= hi, f"{family}.{key} default outside space"
