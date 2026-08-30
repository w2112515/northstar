"""Approval timeout sweeper: pending + stale -> expired_timeout, journaled."""

from datetime import datetime, timedelta, timezone

from northstar.engine import expire_stale_approvals
from tests.test_pnl import FakeStore


def approval(approval_id: str, hours_old: float, status: str = "pending", expires: float = 12):
    created = datetime.now(timezone.utc) - timedelta(hours=hours_old)
    return {
        "id": approval_id,
        "created_at": created.isoformat(),
        "status": status,
        "expires_hours": expires,
        "order_plan": {"human": "sell 1 put on AMD."},
    }


def test_stale_pending_approval_expires():
    s = FakeStore()
    s.save("approvals", "gv_old", approval("gv_old", hours_old=13))
    s.save("approvals", "gv_fresh", approval("gv_fresh", hours_old=1))
    expired = expire_stale_approvals(s)
    assert expired == ["gv_old"]
    assert s.get("approvals", "gv_old")["status"] == "expired_timeout"
    assert s.get("approvals", "gv_fresh")["status"] == "pending"
    assert s.event_log[-1].kind == "approval"
    assert "auto-rejected" in s.event_log[-1].human


def test_decided_approvals_untouched():
    s = FakeStore()
    s.save("approvals", "gv_done", approval("gv_done", hours_old=48, status="approved_by_human"))
    assert expire_stale_approvals(s) == []


def test_custom_timeout_respected():
    s = FakeStore()
    s.save("approvals", "gv_x", approval("gv_x", hours_old=5, expires=4))
    assert expire_stale_approvals(s) == ["gv_x"]
