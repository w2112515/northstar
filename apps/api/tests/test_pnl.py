"""Realized P&L accounting: signs, loss streak, vanish reconciliation."""

from typing import Any

from northstar.pnl import drop_from_snapshot, reconcile_vanished, record_realized


class FakeStore:
    def __init__(self):
        self.docs: dict[tuple[str, str], dict[str, Any]] = {}
        self.event_log: list[Any] = []

    def append_event(self, event) -> None:
        self.event_log.append(event)

    def events(self, kinds=None, limit=200):
        kindset = set(kinds) if kinds else None
        out = [e for e in self.event_log if kindset is None or e.kind in kindset]
        return out[-limit:][::-1]  # newest first, like the real store

    def save(self, collection, doc_id, doc) -> None:
        self.docs[(collection, doc_id)] = doc

    def get(self, collection, doc_id):
        return self.docs.get((collection, doc_id))

    def list(self, collection):
        return [doc for (coll, _), doc in self.docs.items() if coll == collection]

    def delete(self, collection, doc_id) -> None:
        self.docs.pop((collection, doc_id), None)


def pos(symbol, qty, asset_class="us_option", entry=2.5):
    return {"symbol": symbol, "qty": qty, "asset_class": asset_class, "avg_entry_price": entry}


def test_short_option_buyback_profit():
    s = FakeStore()
    out = record_realized(s, symbol="AMD260918P00170000", qty=-1,
                          entry_price=2.50, exit_price=1.00)
    assert out["realized"] == 150.0  # (1.00-2.50)*(-1)*100
    assert out["streak"] == 0
    assert s.event_log[-1].kind == "pnl"
    assert s.event_log[-1].payload["realized"] == 150.0


def test_long_equity_sell_loss_and_streak():
    s = FakeStore()
    r1 = record_realized(s, symbol="NVDA", qty=10, entry_price=180.0, exit_price=170.0)
    assert r1["realized"] == -100.0
    assert r1["streak"] == 1
    r2 = record_realized(s, symbol="AMD", qty=5, entry_price=150.0, exit_price=140.0)
    assert r2["streak"] == 2
    # a win resets the streak
    r3 = record_realized(s, symbol="MSFT", qty=1, entry_price=400.0, exit_price=410.0)
    assert r3["streak"] == 0
    assert (s.get("state", "portfolio") or {})["consecutive_losses"] == 0


def test_explicit_multiplier_for_mleg_package():
    s = FakeStore()
    # short spread package: entered at net credit 1.20, closed at net debit 0.40
    out = record_realized(s, symbol="SPY bull_put_spread", qty=-1,
                          entry_price=1.20, exit_price=0.40, multiplier=100)
    assert out["realized"] == 80.0


def test_reconcile_books_vanished_short_option_as_estimate():
    s = FakeStore()
    s.save("state", "last_positions", {"positions": [pos("AMD260918P00170000", -1)]})
    booked = reconcile_vanished(s, positions=[])
    assert len(booked) == 1
    assert booked[0]["realized"] == 250.0  # full premium kept
    ev = s.event_log[-1]
    assert ev.payload["estimated"] is True
    # snapshot refreshed: nothing left to double-book
    assert reconcile_vanished(s, positions=[]) == []


def test_reconcile_flags_assignment_when_shares_appear():
    s = FakeStore()
    s.save("state", "last_positions", {"positions": [pos("AMD260918P00170000", -1)]})
    booked = reconcile_vanished(s, positions=[pos("AMD", 100, asset_class="us_equity", entry=170.0)])
    assert len(booked) == 1
    assert "assignment" in s.event_log[-1].payload["note"]


def test_reconcile_guards_against_empty_position_glitch():
    s = FakeStore()
    s.save("state", "last_positions", {"positions": [
        pos("A260918P00170000", -1), pos("B260918P00170000", -1), pos("C260918P00170000", -1),
    ]})
    assert reconcile_vanished(s, positions=[]) == []
    # snapshot untouched so a real next pass can still book
    assert len((s.get("state", "last_positions") or {})["positions"]) == 3


def test_drop_from_snapshot_prevents_double_booking():
    s = FakeStore()
    s.save("state", "last_positions", {"positions": [pos("AMD260918P00170000", -1), pos("NVDA", 10, "us_equity")]})
    drop_from_snapshot(s, ["AMD260918P00170000"])
    left = (s.get("state", "last_positions") or {})["positions"]
    assert [p["symbol"] for p in left] == ["NVDA"]
    assert reconcile_vanished(s, positions=[pos("NVDA", 10, "us_equity")]) == []


def test_long_options_are_not_booked_by_reconciler():
    s = FakeStore()
    s.save("state", "last_positions", {"positions": [pos("SPY260918P00740000", 1)]})
    assert reconcile_vanished(s, positions=[]) == []
