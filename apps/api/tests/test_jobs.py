"""Persistent job table: idempotent enqueue, crash resume, bounded retries."""

from northstar import jobs
from tests.test_pnl import FakeStore


def _register(monkeypatch, log: list, fail_times: int = 0):
    """A fake handler that fails its first `fail_times` executions."""
    state = {"left": fail_times}

    def handler(store, payload):
        log.append(payload)
        if state["left"] > 0:
            state["left"] -= 1
            raise RuntimeError("transient boom")

    monkeypatch.setitem(jobs.HANDLERS, "test_kind", handler)


def test_enqueue_dedupes_on_idempotency_key():
    s = FakeStore()
    assert jobs.enqueue(s, "test_kind", "k1") is not None
    assert jobs.enqueue(s, "test_kind", "k1") is None          # same intent
    assert jobs.enqueue(s, "test_kind", "k2") is not None
    assert len(s.list("jobs")) == 2


def test_run_one_success_path(monkeypatch):
    log: list = []
    _register(monkeypatch, log)
    s = FakeStore()
    jobs.enqueue(s, "test_kind", "k1", {"x": 1})
    done = jobs.run_one(s, "worker:1")
    assert done["status"] == "done"
    assert done["attempts"] == 1 and done["worker"] == "worker:1"
    assert log == [{"x": 1}]
    assert jobs.run_one(s, "worker:1") is None                 # queue drained


def test_failure_retries_then_fails_with_journal(monkeypatch):
    log: list = []
    _register(monkeypatch, log, fail_times=99)
    s = FakeStore()
    jobs.enqueue(s, "test_kind", "k1")
    first = jobs.run_one(s, "w")
    assert first["status"] == "pending"                        # attempt 1 of 2: retry
    second = jobs.run_one(s, "w")
    assert second["status"] == "failed"                        # attempts exhausted
    assert "transient boom" in second["error"]
    assert any("failed after 2 attempt" in e.human for e in s.event_log)
    # a failed key is not silently re-enqueued
    assert jobs.enqueue(s, "test_kind", "k1") is None


def test_second_attempt_can_succeed(monkeypatch):
    log: list = []
    _register(monkeypatch, log, fail_times=1)
    s = FakeStore()
    jobs.enqueue(s, "test_kind", "k1")
    assert jobs.run_one(s, "w")["status"] == "pending"
    assert jobs.run_one(s, "w")["status"] == "done"
    assert len(log) == 2


def test_oldest_pending_claimed_first(monkeypatch):
    log: list = []
    _register(monkeypatch, log)
    s = FakeStore()
    a = jobs.enqueue(s, "test_kind", "first", {"n": 1})
    b = jobs.enqueue(s, "test_kind", "second", {"n": 2})
    # force deterministic ordering (FakeStore keeps insertion order anyway)
    s.save("jobs", a["id"], {**a, "created_at": "2026-08-31T00:00:00"})
    s.save("jobs", b["id"], {**b, "created_at": "2026-08-31T00:00:01"})
    jobs.run_one(s, "w")
    assert log == [{"n": 1}]


def test_unknown_kind_fails_cleanly():
    s = FakeStore()
    jobs.enqueue(s, "no_such_kind", "k1")
    out = jobs.run_one(s, "w")
    # one failed claim burns an attempt; second exhausts and fails for good
    if out["status"] == "pending":
        out = jobs.run_one(s, "w")
    assert out["status"] == "failed"
    assert "no handler" in out["error"]


def test_resume_requeues_running_jobs(monkeypatch):
    log: list = []
    _register(monkeypatch, log)
    s = FakeStore()
    job = jobs.enqueue(s, "test_kind", "k1", {"x": 9})
    s.save("jobs", job["id"], {**job, "status": "running", "attempts": 1})   # crash snapshot
    assert jobs.resume_incomplete(s) == 1
    assert any("Recovered 1 unfinished job" in e.human for e in s.event_log)
    done = jobs.run_one(s, "w")
    assert done["status"] == "done" and log == [{"x": 9}]


def test_resume_fails_exhausted_jobs():
    s = FakeStore()
    job = jobs.enqueue(s, "test_kind", "k1")
    s.save("jobs", job["id"], {**job, "status": "running", "attempts": jobs.MAX_ATTEMPTS})
    assert jobs.resume_incomplete(s) == 0
    assert s.get("jobs", job["id"])["status"] == "failed"


def test_prune_keeps_newest_settled():
    s = FakeStore()
    for i in range(10):
        s.save("jobs", f"j{i}", {"id": f"j{i}", "status": "done",
                                 "updated_at": f"2026-08-31T00:00:{i:02d}"})
    s.save("jobs", "active", {"id": "active", "status": "pending", "updated_at": "x"})
    jobs.prune_finished(s, keep=3)
    left = {d["id"] for d in s.list("jobs")}
    assert left == {"active", "j9", "j8", "j7"}
