"""Driver lease: single-writer election, renewal, TTL takeover, observer 409s."""

import json
import time

from fastapi.testclient import TestClient

from northstar.api import app as app_mod
from northstar.journal.store import LocalJsonStore
from tests.test_pnl import FakeStore

TTL = 60


# ------------------------------------------------------------ local lock file

def test_first_acquire_wins_second_loses(tmp_path):
    store = LocalJsonStore(tmp_path)
    assert store.acquire_lease("driver", "a:1", TTL) is True
    assert store.acquire_lease("driver", "b:2", TTL) is False
    assert store.lease_holder("driver") == "a:1"


def test_holder_renews_freely(tmp_path):
    store = LocalJsonStore(tmp_path)
    assert store.acquire_lease("driver", "a:1", TTL)
    assert store.acquire_lease("driver", "a:1", TTL) is True  # renew = same call


def test_expired_lease_is_taken_over(tmp_path):
    store = LocalJsonStore(tmp_path)
    assert store.acquire_lease("driver", "dead:9", TTL)
    # age the lock beyond TTL
    lock = tmp_path / "driver.lock"
    doc = json.loads(lock.read_text())
    doc["ts"] = time.time() - TTL - 5
    lock.write_text(json.dumps(doc))
    assert store.acquire_lease("driver", "b:2", TTL) is True
    assert store.lease_holder("driver") == "b:2"


def test_release_only_by_holder(tmp_path):
    store = LocalJsonStore(tmp_path)
    store.acquire_lease("driver", "a:1", TTL)
    store.release_lease("driver", "not-the-holder")
    assert store.lease_holder("driver") == "a:1"   # untouched
    store.release_lease("driver", "a:1")
    assert store.lease_holder("driver") is None
    assert store.acquire_lease("driver", "b:2", TTL) is True


def test_corrupt_lock_file_is_reclaimed(tmp_path):
    store = LocalJsonStore(tmp_path)
    (tmp_path / "driver.lock").write_text("{not json")
    # unparseable = treated as expired, next acquire takes it
    assert store.acquire_lease("driver", "a:1", TTL) is True


# ---------------------------------------------------------- election + journal

class LeaseFakeStore(FakeStore):
    def __init__(self, grant: bool):
        super().__init__()
        self.grant = grant

    def acquire_lease(self, name, holder, ttl_seconds):
        return self.grant

    def release_lease(self, name, holder):
        pass

    def lease_holder(self, name):
        return "somebody:else" if not self.grant else None


def test_tend_lease_journals_transitions_once(monkeypatch):
    monkeypatch.setitem(app_mod._driver_state, "is_driver", False)
    s = LeaseFakeStore(grant=True)
    assert app_mod._tend_lease(s) is True
    assert app_mod._tend_lease(s) is True          # steady state: no new event
    events = [e for e in s.event_log if e.kind == "system"]
    assert len(events) == 1
    assert "took the driver lease" in events[0].human

    s2 = LeaseFakeStore(grant=False)
    assert app_mod._tend_lease(s2) is False
    lost = [e for e in s2.event_log if e.kind == "system"]
    assert len(lost) == 1 and "read-only observer" in lost[0].human


# ------------------------------------------------------------- observer mode

def test_observer_rejects_mutations_serves_reads(monkeypatch):
    client = TestClient(app_mod.app)               # no lifespan: nobody elected
    monkeypatch.setitem(app_mod._driver_state, "is_driver", False)
    monkeypatch.setattr(app_mod, "get_store", lambda: LeaseFakeStore(grant=False))
    monkeypatch.setattr(app_mod, "ADMIN_TOKEN", "")

    r = client.post("/api/engine/controls", json={"autopilot": False})
    assert r.status_code == 409
    assert "observer" in r.json()["error"]
    assert "somebody:else" in r.json()["error"]

    h = client.get("/healthz")                     # reads stay public
    assert h.status_code == 200
    assert h.json()["driver"] is False


def test_driver_lets_mutations_reach_routes(monkeypatch):
    client = TestClient(app_mod.app)
    monkeypatch.setitem(app_mod._driver_state, "is_driver", True)
    monkeypatch.setattr(app_mod, "ADMIN_TOKEN", "")
    # unknown path: middleware passes it through to the router -> 404, not 409
    r = client.post("/api/definitely-not-a-route")
    assert r.status_code == 404
