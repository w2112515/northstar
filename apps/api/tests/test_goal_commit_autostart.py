"""Commit is the last instruction: autopilot engages and the first pass queues.

Without this, a fresh user activates a plan and the agent sits parked until
they discover the autopilot toggle - the exact opposite of the product story.
"""

from fastapi import BackgroundTasks

from northstar.api import routes_goal
from northstar.api.routes_goal import GoalBody
from northstar.domain import Guardrails, Plan
from tests.test_pnl import FakeStore


def fake_plan_goal(goal):
    plan = Plan(
        goal_id=goal.id, required_annual_return=0.10, feasibility="green",
        probability=0.62, max_drawdown_est=-0.08, allocations=[],
        guardrails=Guardrails(max_loss_per_trade_pct=0.01),
    )
    return plan, {"target_amount": 110_000.0, "months": 12}


def body() -> GoalBody:
    return GoalBody(capital_base=100_000, target_amount=110_000, horizon_months=12)


def commit(store, monkeypatch) -> BackgroundTasks:
    monkeypatch.setattr(routes_goal, "get_store", lambda: store)
    monkeypatch.setattr("northstar.goalplanner.plan_goal", fake_plan_goal)
    tasks = BackgroundTasks()
    routes_goal.commit(body(), tasks)
    return tasks


def test_commit_engages_autopilot_and_queues_first_pass(monkeypatch):
    s = FakeStore()
    tasks = commit(s, monkeypatch)
    assert (s.get("state", "controls") or {}).get("autopilot") is True
    assert [t.func for t in tasks.tasks] == [routes_goal._first_pass]
    # cadence restarts from activation, not from a stale (or empty) last_tick
    assert (s.get("state", "portfolio") or {}).get("last_tick")
    assert any("Autopilot engaged" in e.human for e in s.event_log)


def test_recommit_with_autopilot_on_stays_quiet_but_still_kicks_a_pass(monkeypatch):
    s = FakeStore()
    commit(s, monkeypatch)
    tasks2 = commit(s, monkeypatch)
    # no duplicate "engaged" note, but the new plan still gets its first pass
    assert sum(1 for e in s.event_log if "Autopilot engaged" in e.human) == 1
    assert len(tasks2.tasks) == 1


def test_commit_does_not_touch_kill_switch(monkeypatch):
    s = FakeStore()
    s.save("state", "controls", {"kill_switch": True})
    commit(s, monkeypatch)
    controls = s.get("state", "controls")
    assert controls["autopilot"] is True
    assert controls["kill_switch"] is True  # safety switch stays honest
