"""Factor mining lite: restricted expression grammar, IC deflation by total
tries, the human admission gate, and library decay tracking."""

import numpy as np
import pandas as pd

import northstar.llm as llm
from northstar.mining import (
    DEFLATED_IC_FLOOR,
    decide_mining,
    deflate_ic,
    evaluate_expression,
    expression_name,
    normalize_terms,
    random_expressions,
    run_mining_round,
    track_library_decay,
)
from tests.test_pnl import FakeStore

import random


def frame(days=320, price=100.0, drift=0.001, seed=0, noise=0.001):
    rng = np.random.default_rng(seed)
    idx = pd.date_range("2025-06-01", periods=days, freq="B", tz="UTC")
    closes = price * np.cumprod(1 + drift + rng.normal(0, noise, days))
    return pd.DataFrame(
        {
            "open": closes,
            "high": closes * 1.01,
            "low": closes * 0.99,
            "close": closes,
            "volume": np.full(days, 2_000_000.0),
        },
        index=idx,
    )


def ranked_bars(n=10, days=320):
    return {"S" + chr(65 + k) * 2: frame(days=days, drift=0.0004 * k, seed=k) for k in range(n)}


# --------------------------------------------------------------------------- grammar

def test_normalize_terms_validates_and_normalizes():
    t = normalize_terms({"mom_20d": 2.0, "low_vol": -0.5})
    assert t is not None
    assert abs(sum(abs(w) for w in t.values()) - 1.0) < 1e-6
    assert normalize_terms({"made_up": 1.0, "mom_20d": 1.0}) is None      # unknown factor
    assert normalize_terms({"mom_20d": 1.0}) is None                       # too few terms
    assert normalize_terms({"mom_20d": 0.0, "low_vol": 0.0}) is None      # all zero


def test_random_expressions_are_distinct_and_valid():
    rng = random.Random(7)
    exprs = random_expressions(8, rng)
    assert len(exprs) == 8
    keys = {tuple(sorted(e.items())) for e in exprs}
    assert len(keys) == 8
    for e in exprs:
        assert normalize_terms(e) is not None
        assert expression_name(e)


# --------------------------------------------------------------------------- deflation

def test_deflate_ic_rises_the_bar_with_tries():
    d1 = deflate_ic(0.05, 0.15, n_days=200, n_trials=1)
    d100 = deflate_ic(0.05, 0.15, n_days=200, n_trials=100)
    assert d1 is not None and d100 is not None
    assert d100 < d1  # more searching -> bigger haircut
    assert deflate_ic(0.05, 0.15, n_days=50, n_trials=5) is None  # too little history


def test_evaluate_expression_finds_momentum_blend():
    bars = ranked_bars()
    s = evaluate_expression(bars, {"mom_20d": 0.6, "mom_60d": 0.4})
    assert s["ic_mean"] is not None and s["ic_mean"] > 0.3
    assert s["n_days"] > 120


# --------------------------------------------------------------------------- round + gate

def test_run_mining_round_surfaces_candidate_and_counts_tries(monkeypatch):
    monkeypatch.delenv("NORTHSTAR_MINING_DISABLED", raising=False)
    monkeypatch.setattr(llm, "llm_available", lambda: False)
    s = FakeStore()
    out = run_mining_round(s, n_random=6, bars=ranked_bars())
    assert out["ok"] and out["tried"] == 6 and out["tried_total"] == 6
    state = s.get("state", "factor_mining")
    assert state["tried_total"] == 6

    # second round: the try counter keeps rising (never resets)
    out2 = run_mining_round(s, n_random=6, bars=ranked_bars())
    assert out2["tried_total"] == 12

    # on this constructed momentum panel some blend should clear the floor
    if out["surfaced"]:
        assert out["surfaced"]["deflated_ic"] > DEFLATED_IC_FLOOR
        assert any("mining surfaced" in e.human for e in s.event_log)


def test_decide_mining_admits_to_library(monkeypatch):
    monkeypatch.delenv("NORTHSTAR_MINING_DISABLED", raising=False)
    s = FakeStore()
    cand = {
        "id": "mine_1", "ts": "2026-08-30T00:00:00+00:00",
        "name": "+60%·mom_20d +40%·mom_60d",
        "terms": {"mom_20d": 0.6, "mom_60d": 0.4},
        "ic_mean": 0.4, "ic_recent": 0.42, "deflated_ic": 0.35, "n_days": 200,
        "status": "awaiting_approval",
    }
    s.save("state", "factor_mining", {"pending": [cand], "tried_total": 6})

    out = decide_mining(s, "mine_1", approve=True)
    assert out["ok"] and out["decision"] == "admitted"
    lib = s.get("state", "factor_library")
    assert lib["factors"][0]["name"] == cand["name"]
    assert lib["factors"][0]["admission_ic"] == 0.4
    assert any("admitted" in e.human for e in s.event_log)

    # deciding twice fails honestly
    assert decide_mining(s, "mine_1", approve=True)["ok"] is False


def test_decide_mining_archive_leaves_library_empty():
    s = FakeStore()
    cand = {"id": "mine_2", "name": "x", "terms": {"mom_20d": 0.5, "low_vol": 0.5},
            "ic_mean": 0.1, "status": "awaiting_approval"}
    s.save("state", "factor_mining", {"pending": [cand]})
    out = decide_mining(s, "mine_2", approve=False)
    assert out["decision"] == "archived"
    assert s.get("state", "factor_library") is None


def test_run_mining_round_disable_flag(monkeypatch):
    monkeypatch.setenv("NORTHSTAR_MINING_DISABLED", "1")
    assert run_mining_round(FakeStore()).get("skipped")


# --------------------------------------------------------------------------- decay

def test_track_library_decay_flags_faded_factor():
    s = FakeStore()
    # admitted long ago with a strong IC; the panel below won't reproduce it
    s.save("state", "factor_library", {"factors": [{
        "id": "mine_3", "name": "stale blend",
        "terms": {"reversal_5d": 0.5, "rsi14_oversold": 0.5},  # anti-momentum on a momentum panel
        "admitted_at": "2026-01-01T00:00:00+00:00",
        "admission_ic": 0.50,  # absurdly high admission bar -> guaranteed decay
        "ic_history": [], "decayed": False,
    }]})
    decayed = track_library_decay(s, ranked_bars())
    assert decayed == ["stale blend"]
    lib = s.get("state", "factor_library")
    assert lib["factors"][0]["decayed"] is True
    assert len(lib["factors"][0]["ic_history"]) == 1
    assert any("has decayed" in e.human for e in s.event_log)
