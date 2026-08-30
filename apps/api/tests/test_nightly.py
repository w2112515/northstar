"""Night watch: weather day summary, equity curve point, step isolation,
captain's log attribution + template fallback."""

import northstar.broker as broker
from northstar.domain import JournalEvent
from northstar.nightly import (
    _append_equity_point,
    _captain_facts,
    _captain_log,
    _today,
    _weather_day_summary,
    run_nightly,
)
from tests.test_pnl import FakeStore


def wx(ts_suffix: str, score: int, bucket: str):
    return {"ts": f"{_today()}T{ts_suffix}", "score": score, "bucket": bucket}


def test_weather_day_summary_counts_transitions():
    s = FakeStore()
    for i, r in enumerate([wx("09:00:00", 70, "clear"), wx("12:00:00", 45, "choppy"),
                           wx("15:00:00", 72, "clear"), wx("18:00:00", 75, "clear")]):
        s.save("weather_history", f"w{i}", r)
    out = _weather_day_summary(s)
    assert out["readings"] == 4
    assert out["transitions"] == 2  # clear->choppy->clear
    assert out["min"] == 45 and out["max"] == 75
    assert out["last_bucket"] == "clear"


def test_weather_day_summary_none_without_data():
    assert _weather_day_summary(FakeStore()) is None


def test_equity_point_dedupes_per_day(monkeypatch):
    monkeypatch.setattr(broker, "get_account_summary", lambda: {"equity": 100_500.0})
    s = FakeStore()
    _append_equity_point(s)
    monkeypatch.setattr(broker, "get_account_summary", lambda: {"equity": 100_900.0})
    _append_equity_point(s)
    points = (s.get("state", "equity_curve") or {})["points"]
    assert len(points) == 1  # same date replaced, not duplicated
    assert points[0]["equity"] == 100_900.0


def test_run_nightly_isolates_step_failures(monkeypatch):
    def boom():
        raise RuntimeError("broker offline")

    monkeypatch.setattr(broker, "get_account_summary", boom)
    s = FakeStore()
    results = run_nightly(s)
    # equity step failed but was captured; digest + state still written
    assert "error" in results["equity"]
    assert results["evolution"] == []  # no champions in an empty store
    assert results["plan_odds"] is None
    assert s.event_log[-1].kind == "digest"
    assert (s.get("state", "nightly") or {})["last_run"] == _today()
    # scout is env-disabled in tests; captain still files a template log
    assert results["scout"].get("skipped")
    assert results["captain"]["narrator"] == "template"
    assert s.event_log[-1].payload["captain"]["narrative"]


def _day_event(kind, human, payload):
    # default ts is utcnow -> already "today" for the captain's day filter
    return JournalEvent(kind=kind, human=human, payload=payload)


def test_captain_facts_attribute_pnl_by_family():
    s = FakeStore()
    s.append_event(_day_event("fill", "Filled: buy 10 NVDA", {"symbol": "NVDA"}))
    s.append_event(_day_event("pnl", "Booked win", {"realized": 120.0, "family": "momentum_rotation"}))
    s.append_event(_day_event("pnl", "Booked loss", {"realized": -80.0, "family": "wheel"}))
    s.append_event(_day_event("verdict", "Blocked", {"verdict": "rejected"}))
    s.save("state", "scout", {"candidates": [{"symbol": "PLTR"}, {"symbol": "SMCI"}]})

    facts = _captain_facts(s, {"weather": {"avg": 62}})
    assert facts["fills"] == 1
    assert facts["realized_total"] == 40.0
    assert facts["realized_by_family"] == {"momentum_rotation": 120.0, "wheel": -80.0}
    assert facts["gate_rejections"] == 1
    assert facts["watch_tomorrow"] == ["PLTR", "SMCI"]


def test_captain_log_template_mentions_the_day(monkeypatch):
    s = FakeStore()
    s.append_event(_day_event("pnl", "Booked win", {"realized": 250.0, "family": "wheel"}))
    s.save("state", "scout", {"candidates": [{"symbol": "PLTR"}]})
    log = _captain_log(s, {})
    assert log["narrator"] == "template"
    assert "wheel" in log["narrative"] and "$+250.00" in log["narrative"]
    assert "PLTR" in log["narrative"]
