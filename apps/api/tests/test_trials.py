"""Paper trial lifecycle: approve -> trial -> nightly settle (promote/restore)."""

from datetime import datetime, timedelta, timezone

import northstar.evolution.loop as loop
from northstar.domain import JournalEvent, StrategyInstance
from tests.test_pnl import FakeStore


def seed_awaiting(store, family="momentum_rotation"):
    champ = StrategyInstance(family=family, strategy_type="momentum_rotation",
                             version="v3", params={"lookback_days": 90}, status="champion")
    store.save("instances", champ.id, champ.model_dump())
    exp = {
        "id": "exp_1", "created_at": datetime.now(timezone.utc).isoformat(),
        "family": family, "parent_version": "v3",
        "hypothesis": "longer lookback rides trends better",
        "proposed_by": "gemini", "params_delta": {"lookback_days": 120},
        "candidate_params": {"lookback_days": 120}, "backtest": None,
        "paper_trial": None, "status": "awaiting_approval", "verdict_reason": "adj 0.9 vs 0.7",
    }
    store.save("experiments", "exp_1", exp)
    return champ


def age_trial(store, inst_id, days=4):
    doc = store.get("instances", inst_id)
    start = datetime.now(timezone.utc) - timedelta(days=days)
    doc["paper_trial"]["start"] = start.isoformat()
    store.save("instances", inst_id, doc)


def approved_instance(store):
    return next(d for d in store.list("instances") if d.get("status") == "trial")


def test_approve_starts_trial_not_promotion(monkeypatch):
    s = FakeStore()
    champ = seed_awaiting(s)
    monkeypatch.setattr(loop, "get_store", lambda: s)
    out = loop.decide_evolution("exp_1", approve=True)
    assert out["decision"] == "trial"
    inst = approved_instance(s)
    assert inst["version"] == "v4"
    assert inst["paper_trial"]["days"] == loop.TRIAL_DAYS
    assert inst["paper_trial"]["parent_instance_id"] == champ.id
    # parent benched, experiment marked trial
    assert s.get("instances", champ.id)["status"] == "archived"
    assert s.get("experiments", "exp_1")["status"] == "trial"


def test_clean_window_promotes(monkeypatch):
    s = FakeStore()
    seed_awaiting(s)
    monkeypatch.setattr(loop, "get_store", lambda: s)
    loop.decide_evolution("exp_1", approve=True)
    inst = approved_instance(s)
    age_trial(s, inst["id"])

    settled = loop.finalize_trials(s)
    assert settled == [{"instance_id": inst["id"], "family": "momentum_rotation",
                        "version": "v4", "outcome": "promoted"}]
    fresh = s.get("instances", inst["id"])
    assert fresh["status"] == "champion"
    assert fresh["paper_trial"] is None
    assert s.get("experiments", "exp_1")["status"] == "promoted"


def test_kill_switch_during_window_restores_parent(monkeypatch):
    s = FakeStore()
    champ = seed_awaiting(s)
    monkeypatch.setattr(loop, "get_store", lambda: s)
    loop.decide_evolution("exp_1", approve=True)
    inst = approved_instance(s)
    age_trial(s, inst["id"])
    # a kill-switch event inside the window disqualifies the trial
    s.append_event(JournalEvent(kind="system", human="Kill switch ON.",
                                payload={"kill_switch": True}))

    settled = loop.finalize_trials(s)
    assert settled[0]["outcome"] == "archived"
    assert s.get("instances", inst["id"])["status"] == "archived"
    assert s.get("instances", champ.id)["status"] == "champion"  # parent restored
    exp = s.get("experiments", "exp_1")
    assert exp["status"] == "archived"
    assert "trial failed" in exp["verdict_reason"]


def test_running_trial_left_alone(monkeypatch):
    s = FakeStore()
    seed_awaiting(s)
    monkeypatch.setattr(loop, "get_store", lambda: s)
    loop.decide_evolution("exp_1", approve=True)
    # window not over yet -> nothing settles
    assert loop.finalize_trials(s) == []
    assert approved_instance(s)["status"] == "trial"


def test_old_events_before_window_ignored(monkeypatch):
    s = FakeStore()
    seed_awaiting(s)
    # kill switch fired BEFORE the trial started - must not disqualify
    old = JournalEvent(kind="system", human="Kill switch ON.", payload={"kill_switch": True})
    old.ts = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    s.append_event(old)
    monkeypatch.setattr(loop, "get_store", lambda: s)
    loop.decide_evolution("exp_1", approve=True)
    inst = approved_instance(s)
    age_trial(s, inst["id"])
    assert loop.finalize_trials(s)[0]["outcome"] == "promoted"
