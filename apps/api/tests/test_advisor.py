"""Plan advisor: bounded tilts, hysteresis/cooldown, decide paths, and the
counterfactual ledger that scores dismissed advice too."""

from datetime import datetime, timedelta, timezone

import northstar.advisor as advisor
from northstar.advisor import (
    build_tilts,
    decide_advice,
    maybe_propose,
    pick_best_family,
    score_advice,
)
from northstar.domain import Goal, Guardrails, Plan, PlanAllocation
from tests.test_pnl import FakeStore


def seed_plan(store) -> Plan:
    goal = Goal(mode="target_amount", capital_base=100_000, target_amount=115_000,
                horizon_months=12, risk_level="balanced")
    store.save("goals", goal.id, goal.model_dump())
    plan = Plan(
        goal_id=goal.id, required_annual_return=0.15, feasibility="yellow",
        probability=0.5, max_drawdown_est=-0.15, status="active",
        guardrails=Guardrails(max_loss_per_trade_pct=0.01),
        allocations=[
            PlanAllocation(strategy_id="wheel", weight=0.4),
            PlanAllocation(strategy_id="momentum_rotation", weight=0.3),
            PlanAllocation(strategy_id="rsi_mean_reversion", weight=0.2),
            PlanAllocation(strategy_id="ma_cross_trend", weight=0.1),
        ],
    )
    store.save("plans", plan.id, plan.model_dump())
    return plan


def seed_compass(store, streak=4, best="rsi_mean_reversion"):
    store.save("state", "compass", {
        "regime": {"label": "down_stressed", "streak_days": streak},
        "families": {
            best: {"down_stressed": {"sharpe": 1.4, "days": 260}},
            "momentum_rotation": {"down_stressed": {"sharpe": -0.3, "days": 260}},
            "ma_cross_trend": {"down_stressed": {"days": 60, "refused": True}},
        },
    })


def test_build_tilts_bounded_and_zero_sum():
    tilts = build_tilts({"momentum_rotation": 0.3, "rsi_mean_reversion": 0.2, "ma_cross_trend": 0.15},
                        best="momentum_rotation")
    assert tilts["momentum_rotation"] == 0.1
    assert round(sum(tilts.values()), 6) == 0.0
    assert tilts["rsi_mean_reversion"] == -0.06 and tilts["ma_cross_trend"] == -0.04

    # everyone already at the floor -> nothing to move -> no advice
    assert build_tilts({"momentum_rotation": 0.05, "rsi_mean_reversion": 0.05}, "momentum_rotation") is None


def test_pick_best_family_skips_refusals():
    seed_c = {
        "regime": {"label": "down_stressed"},
        "families": {
            "a": {"down_stressed": {"sharpe": 0.5, "days": 200}},
            "b": {"down_stressed": {"days": 40, "refused": True}},
            "c": {"down_stressed": {"sharpe": 1.2, "days": 300}},
        },
    }
    fam, stats = pick_best_family(seed_c, ["a", "b", "c"])
    assert fam == "c" and stats["sharpe"] == 1.2


def test_maybe_propose_flow_hysteresis_and_cooldown():
    s = FakeStore()
    seed_plan(s)

    # unstable regime -> no advice
    seed_compass(s, streak=2)
    assert maybe_propose(s) is None

    # stable regime -> proposal with evidence, journaled
    seed_compass(s, streak=4)
    p = maybe_propose(s)
    assert p is not None
    assert p["best_family"] == "rsi_mean_reversion"
    assert p["tilts"]["rsi_mean_reversion"] == 0.1
    assert len(p["evidence"]) >= 2
    assert s.event_log[-1].kind == "approval"

    # pending proposal + cooldown -> silent
    assert maybe_propose(s) is None


def test_decide_adopt_rewrites_plan_weights():
    s = FakeStore()
    plan = seed_plan(s)
    seed_compass(s, streak=5)
    maybe_propose(s)

    out = decide_advice(s, adopt=True)
    assert out["ok"] and out["decision"] == "adopted"
    saved = s.get("plans", plan.id)
    weights = {a["strategy_id"]: a["weight"] for a in saved["allocations"]}
    assert weights["rsi_mean_reversion"] == 0.3   # 0.2 + 0.1
    assert weights["wheel"] == 0.4                # non-equity sleeve untouched
    assert round(sum(weights.values()), 4) == 1.0
    hist = (s.get("state", "advisor") or {})["history"]
    assert hist[-1]["status"] == "adopted"


def test_decide_dismiss_keeps_weights_but_records():
    s = FakeStore()
    plan = seed_plan(s)
    seed_compass(s, streak=5)
    maybe_propose(s)

    out = decide_advice(s, adopt=False)
    assert out["ok"] and out["decision"] == "dismissed"
    weights = {a["strategy_id"]: a["weight"] for a in s.get("plans", plan.id)["allocations"]}
    assert weights["rsi_mean_reversion"] == 0.2  # unchanged
    assert (s.get("state", "advisor") or {})["history"][-1]["status"] == "dismissed"


def test_score_advice_settles_both_adopted_and_dismissed(monkeypatch):
    s = FakeStore()
    old = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()
    s.save("state", "advisor", {"history": [
        {"id": "adv1", "status": "adopted", "decided_at": old, "regime_label": "up_calm",
         "tilts": {"momentum_rotation": 0.1, "rsi_mean_reversion": -0.1}},
        {"id": "adv2", "status": "dismissed", "decided_at": old, "regime_label": "up_calm",
         "tilts": {"momentum_rotation": 0.1, "rsi_mean_reversion": -0.1}},
    ]})
    fake_returns = {"momentum_rotation": 0.02, "rsi_mean_reversion": -0.01}
    monkeypatch.setattr(advisor, "_family_recent_return",
                        lambda store, fam, days=5: fake_returns[fam])

    scored = score_advice(s)
    assert len(scored) == 2  # dismissed advice is scored too
    for e in scored:
        assert e["scored"]["tilt_5d_edge"] == round(0.1 * 0.02 + (-0.1) * (-0.01), 5)
    assert "Both outcomes stay on the record" in s.event_log[-1].human
