"""New strategy backtests + walk-forward dispatch + catalog/program parity."""

import numpy as np
import pandas as pd

from northstar.backtest import (
    ma_cross_backtest,
    metrics,
    monte_carlo_goal,
    rsi_reversion_backtest,
    walk_forward_eval,
)


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


def test_catalog_evidence_is_honest():
    """Runnable cards must declare how they are scored; soon cards stay none."""
    from northstar.strategies import CATALOG, EVIDENCE_KINDS

    for entry in CATALOG:
        kind = entry.get("evidence")
        assert kind in EVIDENCE_KINDS, f"{entry['family']} missing evidence class"
        if entry["runnable"]:
            assert kind != "none", f"{entry['family']} is runnable but evidence=none"
        else:
            assert kind == "none", f"{entry['family']} is soon but evidence={kind}"


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


# --------------------------------------------------------------------------- Monte Carlo

def test_monte_carlo_goal_is_deterministic_and_bounded():
    monthly = [0.01, -0.02, 0.03, 0.005, -0.01, 0.02] * 8  # 48 months
    a = monte_carlo_goal(monthly, months=12, capital=100_000, target_amount=110_000)
    b = monte_carlo_goal(monthly, months=12, capital=100_000, target_amount=110_000)
    assert a["probability"] == b["probability"]  # seeded -> reproducible
    assert 0.0 <= a["probability"] <= 1.0
    assert len(a["band_p50"]) == 12
    assert a["p10_final"] <= a["median_final"] <= a["p90_final"]
    assert "stationary bootstrap" in a["method"]


def test_monte_carlo_thin_history_stays_honest():
    assert monte_carlo_goal([0.01] * 6, months=12, capital=1, target_amount=2)["probability"] is None
    assert monte_carlo_goal([0.01] * 24, months=0, capital=1, target_amount=2)["probability"] is None


def test_block_bootstrap_respects_streaks():
    """History with long win/loss runs: block resampling must show wider
    dispersion than iid draws (mean_block=1), or streak risk is being erased."""
    monthly = [0.04] * 12 + [-0.04] * 12 + [0.04] * 12 + [-0.04] * 12
    blocked = monte_carlo_goal(monthly, months=24, capital=100.0, target_amount=120.0,
                               mean_block=6)
    iid = monte_carlo_goal(monthly, months=24, capital=100.0, target_amount=120.0,
                           mean_block=1)
    spread_blocked = blocked["p90_final"] - blocked["p10_final"]
    spread_iid = iid["p90_final"] - iid["p10_final"]
    assert spread_blocked > spread_iid
