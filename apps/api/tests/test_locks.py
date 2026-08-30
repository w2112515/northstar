"""Money-path mutexes: one pass at a time, one decision per approval."""

import asyncio
import threading

from northstar.domain import OrderLeg, OrderPlan, TradeProposal
from northstar.engine import decide_approval, run_once
from northstar.locks import PASS_LOCK
from tests.test_pnl import FakeStore


def pending_approval(approval_id="gv_race") -> dict:
    order = OrderPlan(
        proposal_id="tp_1", strategy_type="momentum_rotation",
        legs=[OrderLeg(symbol="NVDA", side="sell", qty=5, asset_class="us_equity", limit_price=100.0)],
        est_max_loss=0.0, human="sell 5 NVDA limit $100.00",
    )
    prop = TradeProposal(source="s", underlying="NVDA", direction="bearish",
                         strategy_type="momentum_rotation")
    return {
        "id": approval_id,
        "created_at": "2026-08-30T00:00:00+00:00",
        "status": "pending",
        "order_plan": order.model_dump(),
        "proposal": prop.model_dump(),
    }


def test_second_decision_is_refused(monkeypatch):
    s = FakeStore()
    s.save("approvals", "gv_1", pending_approval("gv_1"))
    monkeypatch.setattr("northstar.engine.get_store", lambda: s)

    first = decide_approval("gv_1", approve=False)
    assert first == {"ok": True, "decision": "rejected"}
    assert s.get("approvals", "gv_1")["status"] == "rejected_by_human"

    second = decide_approval("gv_1", approve=False)
    assert second["ok"] is False and "already decided" in second["error"]


def test_concurrent_decisions_only_one_wins(monkeypatch):
    s = FakeStore()
    s.save("approvals", "gv_2", pending_approval("gv_2"))
    monkeypatch.setattr("northstar.engine.get_store", lambda: s)

    barrier = threading.Barrier(2)
    results: list[dict] = []

    def worker():
        barrier.wait()
        results.append(decide_approval("gv_2", approve=False))

    threads = [threading.Thread(target=worker) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert sum(1 for r in results if r.get("ok")) == 1
    # exactly one rejection journaled, not two
    assert sum(1 for e in s.event_log if e.kind == "approval") == 1


def test_run_once_skips_while_pass_running():
    assert PASS_LOCK.acquire(blocking=False)
    try:
        out = run_once(dry_run=True)
        assert out["skipped"] == "another pass is already running"
    finally:
        PASS_LOCK.release()


def test_adk_pass_skips_while_pass_running():
    from northstar.adkflows.trading_loop import run_trading_pass

    assert PASS_LOCK.acquire(blocking=False)
    try:
        out = asyncio.run(run_trading_pass(reason="test"))
        assert out["skipped"] == "another pass is already running"
        assert out["workflow"] == "northstar_trading_loop"
    finally:
        PASS_LOCK.release()
