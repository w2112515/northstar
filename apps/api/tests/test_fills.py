"""Fill reconciliation: orders that filled outside a live pass (queued over a
weekend, filled after the poll window) get back-filled fill events, exactly once."""

from types import SimpleNamespace

from northstar.domain import JournalEvent
from northstar.fills import known_fill_ids, reconcile_from_rows, rows_from_orders
from tests.test_pnl import FakeStore


def order(oid, symbol, side="buy", status="filled", qty=5.0, px=100.0, legs=None):
    return SimpleNamespace(
        id=oid, symbol=symbol, side=side, status=status,
        filled_qty=qty, filled_avg_price=px, legs=legs,
    )


def test_rows_from_plain_orders():
    rows = rows_from_orders([
        order("a1", "NVDA", side="buy"),
        order("a2", "AMD", side="sell", status="canceled"),   # not filled -> skipped
        order("a3", "MSFT", side="buy", qty=0.0),              # nothing filled -> skipped
    ])
    assert [r["id"] for r in rows] == ["a1"]
    assert rows[0] == {
        "id": "a1", "symbol": "NVDA", "side": "buy",
        "filled_qty": 5.0, "filled_avg_price": 100.0,
    }


def test_mleg_parent_expands_to_legs():
    legs = [
        order("l1", "SPY260918P00760000", side="sell", qty=1.0, px=5.1),
        order("l2", "SPY260918P00740000", side="buy", qty=1.0, px=3.0),
    ]
    rows = rows_from_orders([order("parent", "SPY", legs=legs)])
    assert [r["id"] for r in rows] == ["l1", "l2"]  # legs, never the parent
    assert rows[0]["symbol"] == "SPY260918P00760000"


def test_reconcile_skips_known_and_recovers_refs():
    s = FakeStore()
    # the executor already journaled a1's fill live
    s.append_event(JournalEvent(kind="fill", human="Filled: buy 5 NVDA", payload={"id": "a1"}))
    # order event for b2 carries the plan refs we want back on the fill
    s.append_event(JournalEvent(
        kind="order", human="Order sent: buy 3 AMD",
        payload={"order_id": "b2"}, refs={"order_plan_id": "op_9", "proposal_id": "tp_9"},
    ))

    rows = [
        {"id": "a1", "symbol": "NVDA", "side": "buy", "filled_qty": 5.0, "filled_avg_price": 100.0},
        {"id": "b2", "symbol": "AMD", "side": "buy", "filled_qty": 3.0, "filled_avg_price": 150.0},
    ]
    booked = reconcile_from_rows(s, rows, known_fill_ids(s))

    assert [r["id"] for r in booked] == ["b2"]
    ev = s.event_log[-1]
    assert ev.kind == "fill"
    assert "Filled (reconciled): buy 3 AMD @ $150.00" in ev.human
    assert ev.payload["reconciled"] is True
    assert ev.refs == {"order_plan_id": "op_9", "proposal_id": "tp_9"}

    # idempotent: a second sweep books nothing
    assert reconcile_from_rows(s, rows, known_fill_ids(s)) == []
