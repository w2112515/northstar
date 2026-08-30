"""Goal-conditioned evolution: the fitness function IS the personalization.

Same candidates, different user goals -> different champions. The deflated
Sharpe stays as a statistical floor; without a plan the old rule applies.
"""

import numpy as np
import pandas as pd

import northstar.evolution.loop as loop
from northstar.domain import BacktestReport, Goal, Guardrails, Plan, StrategyInstance
from northstar.evolution.loop import evaluate_candidates, goal_fit
from tests.test_pnl import FakeStore


def daily(mean: float, sigma: float, n: int = 420, seed: int = 11) -> pd.Series:
    rng = np.random.default_rng(seed)
    idx = pd.date_range("2024-06-03", periods=n, freq="B", tz="UTC")
    return pd.Series(rng.normal(mean, sigma, n), index=idx)


def make_plan(required: float = 0.20) -> Plan:
    return Plan(
        goal_id="g1", required_annual_return=required, feasibility="yellow",
        probability=0.5, max_drawdown_est=-0.2, allocations=[],
        guardrails=Guardrails(max_loss_per_trade_pct=0.01), status="active",
    )


def make_goal(risk: str) -> Goal:
    return Goal(
        mode="target_amount", capital_base=100_000.0, target_amount=120_000.0,
        horizon_months=12, risk_level=risk,
    )


HOT = daily(0.0012, 0.02)     # ~30%/yr with real vol - can hit an ambitious goal
COLD = daily(0.0003, 0.003)   # ~8%/yr, low vol - cannot hit a 20% target


def test_goal_fit_none_without_plan():
    fit, note = goal_fit(HOT, BacktestReport(max_dd=-0.1), None, None)
    assert fit is None and note == ""


def test_goal_fit_probability_component():
    plan, goal = make_plan(0.20), make_goal("balanced")
    fit_hot, note = goal_fit(HOT, BacktestReport(max_dd=-0.15), plan, goal)
    fit_cold, _ = goal_fit(COLD, BacktestReport(max_dd=-0.05), plan, goal)
    assert fit_hot is not None and fit_cold is not None
    assert fit_hot > fit_cold + 0.2  # the hot stream actually reaches the goal
    assert "P(>=" in note


def test_risk_tier_flips_the_ranking():
    """Deep-drawdown rocket vs steady cruiser: conservative and aggressive
    goals must disagree about which one fits."""
    plan = make_plan(0.20)
    rocket_report = BacktestReport(max_dd=-0.45)
    cruiser_report = BacktestReport(max_dd=-0.05)

    fit_rocket_cons, _ = goal_fit(HOT, rocket_report, plan, make_goal("conservative"))
    fit_cruiser_cons, _ = goal_fit(COLD, cruiser_report, plan, make_goal("conservative"))
    fit_rocket_aggr, _ = goal_fit(HOT, rocket_report, plan, make_goal("aggressive"))
    fit_cruiser_aggr, _ = goal_fit(COLD, cruiser_report, plan, make_goal("aggressive"))

    # conservative: 3x penalty beyond a 12% drawdown budget sinks the rocket
    assert fit_rocket_cons < fit_cruiser_cons
    assert fit_rocket_cons < 0  # penalty actually bites, not a rounding win
    # aggressive: 30% budget barely dents it - probability dominates
    assert fit_rocket_aggr > fit_cruiser_aggr


# --------------------------------------------------------------------------- selection integration

def _fake_eval(sharpe: float, returns: pd.Series, max_dd: float = -0.12) -> dict:
    return {
        "is": {"sharpe": sharpe, "ann_return": 0.1, "max_dd": max_dd, "win_rate": 0.5},
        "oos": {"sharpe": sharpe, "ann_return": 0.1, "max_dd": max_dd, "win_rate": 0.5},
        "oos_returns": returns,
        "data_note": "synthetic",
    }


def _setup(store, plan=None, goal=None, trials=1):
    champ = StrategyInstance(
        family="momentum_rotation", strategy_type="momentum_rotation",
        params={"universe": ["SPY"], "lookback_days": 90}, status="champion", version="v1",
    )
    champ_eval = _fake_eval(1.0, COLD)
    return {
        "champ": champ, "bars": {}, "trials": trials, "recent": [],
        "champ_report": loop._report_from_eval(champ_eval, trials),
        "champ_eval": champ_eval, "plan": plan, "goal": goal,
    }


def test_dual_gate_selection_promotes_goal_fit_with_sharpe_floor(monkeypatch):
    store = FakeStore()
    # trials=40: in a mature family the marginal DSR haircut per extra trial is
    # small, so the floor semantics (not the haircut math) are what's under test
    setup = _setup(store, plan=make_plan(0.20), goal=make_goal("balanced"), trials=40)

    # candidate 1: goal-fit would be great, but Sharpe collapses -> floor rejects
    # candidate 2: goal-fit great AND Sharpe holds -> promoted
    evals = iter([_fake_eval(0.3, HOT), _fake_eval(1.0, HOT)])
    monkeypatch.setattr(loop, "walk_forward_eval", lambda bars, params, family: next(evals))

    judged = evaluate_candidates(
        store, setup,
        [{"params": {"lookback_days": 40}, "hypothesis": "fast lookback"},
         {"params": {"lookback_days": 60}, "hypothesis": "medium lookback"}],
        proposer="test",
    )
    assert judged["goal_mode"] is True
    assert judged["best"] is not None
    assert judged["best"].hypothesis == "medium lookback"
    assert judged["best"].backtest.goal_fit is not None
    assert judged["best"].backtest.goal_fit > judged["champ_fit"]
    assert "goal-fit" in judged["best"].verdict_reason
    # both experiments journaled with the goal framing
    assert any("scored against YOUR plan" in e.human for e in store.event_log)


def test_no_plan_falls_back_to_pure_dsr(monkeypatch):
    store = FakeStore()
    setup = _setup(store, plan=None, goal=None)
    monkeypatch.setattr(loop, "walk_forward_eval",
                        lambda bars, params, family: _fake_eval(1.6, COLD))
    judged = evaluate_candidates(
        store, setup, [{"params": {"lookback_days": 40}, "hypothesis": "sharper"}],
        proposer="test",
    )
    assert judged["goal_mode"] is False
    assert judged["best"] is not None  # 1.6 beats champion 1.0 on the old rule
    assert "adjusted OOS Sharpe" in judged["best"].verdict_reason
