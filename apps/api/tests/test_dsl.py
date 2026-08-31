"""Strategy DSL: spec validation/clamping, the generic rotation backtest,
walk-forward integration, spec proposals, the shipyard round, and the live
adapter's proposal mechanics."""

import numpy as np
import pandas as pd

import northstar.broker as broker
import northstar.llm as llm
from northstar.backtest import walk_forward_eval
from northstar.domain import StrategyInstance
from northstar.dsl import (
    dsl_rotation_backtest,
    propose_specs,
    run_shipyard_round,
    spec_summary,
    validate_spec,
)
from northstar.strategies.base import EngineContext
from northstar.strategies.dsl_rotation import propose as dsl_propose
from northstar.strategies.dsl_rotation import risk_on, rotation_targets
from tests.test_pnl import FakeStore


def frame(days=1050, price=100.0, drift=0.0005, seed=0, noise=0.001):
    rng = np.random.default_rng(seed)
    idx = pd.date_range("2022-09-01", periods=days, freq="B", tz="UTC")
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


def sym(k: int) -> str:
    """Alphabetic synthetic tickers (universe validation only accepts letters)."""
    return "S" + chr(65 + k) * 2


def bars_ranked(n=6, days=1050):
    """Symbol k drifts at 0.0004*k/day -> momentum factors rank by k."""
    out = {sym(k): frame(days=days, drift=0.0004 * k, seed=k) for k in range(n)}
    out["SPY"] = frame(days=days, drift=0.0004, seed=99)
    return out


GOOD_SPEC = {
    "name": "test momentum blend",
    "archetype": "rotation",
    "signal": {"factors": {"mom_60d": 0.6, "mom_20d": 0.6}},  # normalizes to 0.5/0.5
    "filter": {"spy_trend_sma": None},
    "top_n": 1,
    "rebalance_days": 5,
    "universe": ["SAA", "SDD", "SFF"],
}


# --------------------------------------------------------------------------- validation

def test_validate_spec_normalizes_and_clamps():
    spec, errors = validate_spec({**GOOD_SPEC, "top_n": 99, "rebalance_days": 0,
                                  "filter": {"spy_trend_sma": 999}})
    assert errors == []
    assert spec["top_n"] == 4 and spec["rebalance_days"] == 2
    assert spec["filter"]["spy_trend_sma"] == 250
    assert abs(sum(abs(w) for w in spec["signal"]["factors"].values()) - 1.0) < 1e-6


def test_validate_spec_rejects_unknown_factor_and_thin_universe():
    _, errors = validate_spec({**GOOD_SPEC, "signal": {"factors": {"made_up_alpha": 1.0}}})
    assert any("unknown factor" in e for e in errors)
    _, errors2 = validate_spec({**GOOD_SPEC, "universe": ["ONLY"]})
    assert any("universe needs" in e for e in errors2)
    _, errors3 = validate_spec("not a dict")
    assert errors3


def test_spec_summary_is_human_readable():
    spec, _ = validate_spec(GOOD_SPEC)
    s = spec_summary(spec)
    assert "top 1" in s and "mom_60d" in s


# --------------------------------------------------------------------------- backtest

def test_dsl_backtest_rides_the_ranked_drift():
    bars = bars_ranked()
    spec, _ = validate_spec({**GOOD_SPEC, "universe": ["SAA", "SCC", "SFF"]})
    r = dsl_rotation_backtest(bars, spec)
    assert len(r) > 300
    assert (1 + r).prod() > 1.05  # top_n=1 momentum should ride SFF's drift

    contrarian, _ = validate_spec({
        **GOOD_SPEC, "universe": ["SAA", "SCC", "SFF"],
        "signal": {"factors": {"mom_60d": -1.0}},
    })
    r_anti = dsl_rotation_backtest(bars, contrarian)
    assert (1 + r).prod() > (1 + r_anti).prod()  # backwards spec must do worse


def test_dsl_backtest_trend_filter_goes_to_cash():
    bars = bars_ranked()
    # SPY collapses -> always below its 50SMA after warmup
    bars["SPY"] = frame(drift=-0.004, seed=7)
    spec, _ = validate_spec({**GOOD_SPEC, "universe": ["SAA", "SCC", "SFF"],
                             "filter": {"spy_trend_sma": 50}})
    r = dsl_rotation_backtest(bars, spec)
    assert abs(float((1 + r).prod() - 1)) < 0.02  # essentially flat = sat in cash


def test_walk_forward_eval_supports_dsl_family():
    bars = bars_ranked()
    spec, _ = validate_spec({**GOOD_SPEC, "universe": ["SAA", "SCC", "SFF"]})
    ev = walk_forward_eval(bars, {"spec": spec}, family="dsl_rotation")
    assert ev["oos"]["n_days"] > 100
    assert ev["oos"]["sharpe"] is not None


# --------------------------------------------------------------------------- proposals

def test_propose_specs_template_fallback(monkeypatch):
    monkeypatch.setattr(llm, "llm_available", lambda: False)
    specs, proposer = propose_specs(FakeStore(), n=3)
    assert proposer == "template_fallback"
    assert len(specs) == 3
    for s in specs:
        clean, errors = validate_spec(s)
        assert errors == [] and clean is not None
        assert len(s["universe"]) >= 2  # default universe injected


# --------------------------------------------------------------------------- shipyard round

def test_run_shipyard_round_files_experiments(monkeypatch):
    monkeypatch.delenv("NORTHSTAR_SHIPYARD_DISABLED", raising=False)
    monkeypatch.setattr(llm, "llm_available", lambda: False)
    bars = bars_ranked(n=10)

    def fake_bars(symbols, years=4.0):
        return {s: frame(days=1050, drift=0.001, seed=abs(hash(s)) % 97) for s in symbols}

    monkeypatch.setattr(broker, "daily_bars", fake_bars)
    s = FakeStore()
    out = run_shipyard_round(s, n=2)
    assert out["ok"] and out["specs_tested"] == 2
    exps = s.list("experiments")
    assert len(exps) == 2
    assert all(e["family"] == "dsl_rotation" for e in exps)
    assert all(e["candidate_params"]["spec"]["signal"]["factors"] for e in exps)
    # every tested spec left a journal trace
    assert sum(1 for e in s.event_log if e.kind == "experiment") == 2
    _ = bars


def test_run_shipyard_round_disable_flag(monkeypatch):
    monkeypatch.setenv("NORTHSTAR_SHIPYARD_DISABLED", "1")
    assert run_shipyard_round(FakeStore()).get("skipped")


def test_decide_evolution_refuses_dsl_trial_until_live_compilable(monkeypatch):
    """dsl_rotation is backtest-only (A-milestone): approving a shipyard
    experiment must NOT bench a champion for a trial that can never trade.
    Rejecting the experiment still works."""
    import northstar.evolution.loop as loop
    from northstar.domain import BacktestReport, EvolutionExperiment
    from northstar.evolution import decide_evolution

    s = FakeStore()
    monkeypatch.setattr(loop, "get_store", lambda: s)
    spec, _ = validate_spec(GOOD_SPEC)
    exp = EvolutionExperiment(
        family="dsl_rotation", parent_version="none",
        hypothesis="test spec", proposed_by="template_fallback",
        params_delta={}, candidate_params={"spec": spec, "universe": spec["universe"], "use_scout": False},
        backtest=BacktestReport(trials_in_family=1, data_note="test"),
        status="awaiting_approval",
    )
    s.save("experiments", exp.id, exp.model_dump())

    out = decide_evolution(exp.id, approve=True)
    assert out["ok"] is False and "backtest-only" in out["error"]
    assert s.list("instances") == []  # no trial born, nothing benched
    assert s.get("experiments", exp.id)["status"] == "awaiting_approval"

    # a human can still archive it
    out = decide_evolution(exp.id, approve=False)
    assert out["ok"] and out["decision"] == "archived"


# --------------------------------------------------------------------------- live adapter

def _ctx(bars, positions=None):
    return EngineContext(
        account={"equity": 100_000.0, "cash": 100_000.0},
        positions=positions or [], open_orders=[], bars=bars,
    )


def _instance(spec):
    return StrategyInstance(family="dsl_rotation", strategy_type="dsl_rotation",
                            params={"spec": spec, "use_scout": False}, status="champion")


def test_live_adapter_buys_top_ranked_name():
    bars = bars_ranked()
    spec, _ = validate_spec({**GOOD_SPEC, "universe": ["SAA", "SCC", "SFF"]})
    props = dsl_propose(_instance(spec), 0.3, _ctx(bars))
    buys = [p for p in props if p.params["action"] == "buy"]
    assert len(buys) == 1 and buys[0].underlying == "SFF"  # strongest drift wins
    assert buys[0].strategy_type == "dsl_rotation"


def test_live_adapter_sells_on_trend_brake():
    bars = bars_ranked()
    bars["SPY"] = frame(drift=-0.004, seed=7)  # broken trend
    spec, _ = validate_spec({**GOOD_SPEC, "universe": ["SAA", "SCC", "SFF"],
                             "filter": {"spy_trend_sma": 50}})
    held = [{"symbol": "SFF", "qty": 10, "asset_class": "us_equity", "market_value": 1000.0}]
    props = dsl_propose(_instance(spec), 0.3, _ctx(bars, positions=held))
    assert [p.params["action"] for p in props] == ["sell"]
    assert "goes to cash" in props[0].thesis_human
    assert not risk_on(bars, spec)


def test_live_adapter_silent_on_malformed_spec():
    bars = bars_ranked()
    inst = StrategyInstance(family="dsl_rotation", strategy_type="dsl_rotation",
                            params={"spec": {"signal": {"factors": {"nope": 1.0}}}}, status="champion")
    assert dsl_propose(inst, 0.3, _ctx(bars)) == []


def test_rotation_targets_rank_by_composite():
    bars = bars_ranked()
    spec, _ = validate_spec({**GOOD_SPEC, "universe": ["SAA", "SCC", "SFF"], "top_n": 2})
    assert rotation_targets(bars, spec) == ["SFF", "SCC"]
