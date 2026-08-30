"""Market weather math is deterministic and testable without any network.

Fetchers are I/O adapters; everything that decides a number lives in pure
functions covered here.
"""

import numpy as np
import pandas as pd

from northstar.weather import (
    bucket,
    compose,
    gdelt_tone_score,
    headline_tone,
    score_from_z,
    vol_percentile_score,
    worst_component,
)


def test_compose_weighted_mean():
    score, degraded = compose({"vol": 60.0, "news": 50.0, "global": 40.0})
    assert score == 51  # 0.4*60 + 0.3*50 + 0.3*40
    assert degraded == []


def test_compose_renormalizes_when_source_missing():
    score, degraded = compose({"vol": 60.0, "news": None, "global": 40.0})
    assert score == 51  # (0.4*60 + 0.3*40) / 0.7
    assert degraded == ["news"]


def test_compose_all_sources_down():
    score, degraded = compose({"vol": None, "news": None, "global": None})
    assert score is None
    assert degraded == ["global", "news", "vol"]


def test_bucket_thresholds():
    assert bucket(65) == "clear"
    assert bucket(64) == "choppy"
    assert bucket(35) == "choppy"
    assert bucket(34) == "storm"
    assert bucket(0) == "storm"
    assert bucket(None) == "offline"


def test_score_from_z_clamps():
    assert score_from_z(0.0) == 50.0
    assert score_from_z(3.0) == 100.0   # 110 clamped
    assert score_from_z(-3.0) == 0.0    # -10 clamped
    assert score_from_z(1.0) == 70.0


def test_headline_tone_storm_heavy():
    texts = [
        "Markets crash as tariff war escalates",
        "Tech selloff deepens on recession fear",
        "Bank stocks plunge after downgrade",
        "Quiet session for utilities",
    ]
    res = headline_tone(texts)
    assert res is not None
    assert res["score"] < 50
    assert res["storm_hits"] == 3
    assert len(res["drivers"]) == 3


def test_headline_tone_calm_heavy():
    texts = [
        "Stocks rally to record high",
        "Chipmaker beats estimates, shares soar",
        "Inflation cools, rate cut hopes build",
    ]
    res = headline_tone(texts)
    assert res is not None
    assert res["score"] > 50
    assert res["calm_hits"] == 3


def test_headline_tone_neutral_and_empty():
    assert headline_tone([]) is None
    res = headline_tone(["Company announces annual meeting date"])
    assert res is not None
    assert res["score"] == 50.0


def test_gdelt_tone_score():
    flat = gdelt_tone_score([1.0] * 10)
    assert flat is not None and flat["score"] == 50.0

    falling = gdelt_tone_score([0.0] * 9 + [-3.0])
    assert falling is not None and falling["score"] < 50

    assert gdelt_tone_score([1.0, 2.0]) is None  # too short


def test_vol_percentile_score_flags_vol_spike():
    rng = np.random.default_rng(7)
    calm = 100 + np.cumsum(rng.normal(0, 0.1, 250))
    wild = calm[-1] + np.cumsum(rng.normal(0, 2.0, 60))
    closes = pd.Series(np.concatenate([calm, wild]))
    res = vol_percentile_score(closes)
    assert res is not None
    assert res["score"] < 25  # current vol near the top of its own history
    assert res["percentile"] > 75

    short = vol_percentile_score(pd.Series(np.linspace(100, 101, 30)))
    assert short is None


def test_worst_component():
    assert worst_component({"vol": 60.0, "news": 30.0, "global": None}) == "news"
    assert worst_component({"vol": None, "news": None, "global": None}) is None
