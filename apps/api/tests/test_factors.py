"""Factor screener: registry sanity, rank-IC math on constructed panels,
refusal rules, and the bounded tilt it applies to scout score weights."""

import numpy as np
import pandas as pd

from northstar.factors import (
    FACTORS,
    daily_rank_ic,
    forward_returns,
    build_panel,
    ic_summary,
    run_factor_screen,
)
from northstar.scout import DEFAULT_WEIGHTS, tilted_weights
from tests.test_pnl import FakeStore


def frame(days=320, price=100.0, drift=0.001, seed=0, noise=0.004):
    rng = np.random.default_rng(seed)
    idx = pd.date_range("2025-06-01", periods=days, freq="B", tz="UTC")
    rets = drift + rng.normal(0, noise, days)
    closes = price * np.cumprod(1 + rets)
    return pd.DataFrame(
        {
            "open": closes * (1 + rng.normal(0, 0.001, days)),
            "high": closes * 1.01,
            "low": closes * 0.99,
            "close": closes,
            "volume": rng.integers(1_000_000, 3_000_000, days).astype(float),
        },
        index=idx,
    )


def steady_bars(n=10, days=320, noise=0.001):
    """Symbol k drifts at 0.0004*k per day with tiny noise -> factor and
    forward return both rank by k, so momentum factors show strongly positive IC."""
    return {f"S{k:02d}": frame(days=days, drift=0.0004 * k, seed=k, noise=noise) for k in range(n)}


# --------------------------------------------------------------------------- registry

def test_every_factor_returns_aligned_series():
    df = frame()
    for name, fn in FACTORS.items():
        s = fn(df)
        assert isinstance(s, pd.Series) and len(s) == len(df), name
        assert np.isfinite(s.iloc[-1]), f"{name} latest value not finite"


def test_factor_signs_on_trending_frame():
    up = frame(drift=0.004, seed=1)
    assert FACTORS["mom_20d"](up).iloc[-1] > 0
    assert FACTORS["reversal_5d"](up).iloc[-1] < 0        # recent winner -> negative reversal value
    assert FACTORS["dist_52w_high"](up).iloc[-1] > -0.05  # trending name sits near its high


# --------------------------------------------------------------------------- rank-IC

def test_rank_ic_near_one_when_factor_predicts_returns():
    bars = steady_bars()
    fwd = forward_returns(bars)
    panel = build_panel(bars, FACTORS["mom_20d"])
    ic = daily_rank_ic(panel.tail(200), fwd.tail(200))
    assert len(ic) > 100
    assert ic.mean() > 0.6  # drift dominates the tiny noise -> strong positive IC


def test_rank_ic_flips_sign_for_anti_factor():
    bars = steady_bars()
    fwd = forward_returns(bars)
    anti = -build_panel(bars, FACTORS["mom_20d"])
    ic = daily_rank_ic(anti.tail(200), fwd.tail(200))
    assert ic.mean() < -0.6


def test_rank_ic_refuses_thin_cross_sections():
    bars = steady_bars(n=4)  # below MIN_SYMBOLS
    ic = daily_rank_ic(build_panel(bars, FACTORS["mom_20d"]), forward_returns(bars))
    assert len(ic) == 0


def test_ic_summary_shape():
    s = ic_summary(pd.Series([0.1, 0.2, 0.05, 0.15] * 30))
    assert s["n_days"] == 120 and s["ic_mean"] > 0 and s["t_stat"] > 0
    assert ic_summary(pd.Series(dtype=float))["ic_mean"] is None


# --------------------------------------------------------------------------- nightly run

def test_run_factor_screen_persists_and_journals(monkeypatch):
    monkeypatch.delenv("NORTHSTAR_FACTORS_DISABLED", raising=False)
    s = FakeStore()
    doc = run_factor_screen(s, bars=steady_bars())
    assert len(doc["rows"]) == len(FACTORS)
    assert s.get("state", "factor_ic")["universe_size"] == 10
    assert any(e.kind == "scout" and "Factor screen" in e.human for e in s.event_log)
    # momentum family must rank near the top on this constructed panel
    top5 = [r["factor"] for r in doc["rows"][:5]]
    assert any(f.startswith("mom_") for f in top5)


def test_run_factor_screen_refuses_thin_universe(monkeypatch):
    monkeypatch.delenv("NORTHSTAR_FACTORS_DISABLED", raising=False)
    s = FakeStore()
    doc = run_factor_screen(s, bars=steady_bars(n=3))
    assert "refused" in doc and doc["rows"] == []


def test_run_factor_screen_disable_flag(monkeypatch):
    monkeypatch.setenv("NORTHSTAR_FACTORS_DISABLED", "1")
    assert run_factor_screen(FakeStore()).get("skipped")


# --------------------------------------------------------------------------- scout tilt

def _ic_doc(ic_recent, n_days=200, factor="mom_20d"):
    return {"rows": [{"factor": factor, "ic_recent": ic_recent, "n_days": n_days, "t_stat": 2.0}]}


def test_tilt_is_bounded_and_renormalized():
    s = FakeStore()
    s.save("state", "factor_ic", _ic_doc(ic_recent=0.5))  # absurdly strong IC
    w, note = tilted_weights(s)
    assert abs(sum(w.values()) - 1.0) < 1e-6
    # pre-normalization bump is capped at +20% of the default momentum weight
    ratio = (w["momentum"] / w["rsi_extreme"]) / (DEFAULT_WEIGHTS["momentum"] / DEFAULT_WEIGHTS["rsi_extreme"])
    assert 1.19 < ratio < 1.21
    assert "momentum +20%" in note


def test_tilt_requires_ic_history():
    s = FakeStore()
    s.save("state", "factor_ic", _ic_doc(ic_recent=0.5, n_days=30))  # too short
    w, note = tilted_weights(s)
    assert w == {k: round(v / sum(DEFAULT_WEIGHTS.values()), 4) for k, v in DEFAULT_WEIGHTS.items()}
    assert note == ""


def test_tilt_defaults_without_state():
    w, note = tilted_weights(FakeStore())
    assert note == "" and abs(sum(w.values()) - 1.0) < 1e-6
