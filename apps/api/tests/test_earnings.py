"""Earnings calendar: set/clear lifecycle, validation, pruning."""

from datetime import date, timedelta

from northstar.earnings import earnings_calendar, prune_past, remove_earnings, set_earnings
from tests.test_pnl import FakeStore

TOMORROW = (date.today() + timedelta(days=1)).isoformat()
NEXT_WEEK = (date.today() + timedelta(days=7)).isoformat()
YESTERDAY = (date.today() - timedelta(days=1)).isoformat()


def test_set_normalizes_and_journals():
    s = FakeStore()
    out = set_earnings(s, " nvda ", NEXT_WEEK)
    assert out["ok"] and out["symbols"] == {"NVDA": NEXT_WEEK}
    assert s.event_log[-1].kind == "system" and "NVDA" in s.event_log[-1].human

    # moving the date overwrites, no duplicates
    out = set_earnings(s, "NVDA", TOMORROW)
    assert out["symbols"] == {"NVDA": TOMORROW}


def test_garbage_symbol_and_bad_dates_refused():
    s = FakeStore()
    assert set_earnings(s, "not a ticker!", NEXT_WEEK)["ok"] is False
    assert set_earnings(s, "NVDA", "next tuesday")["ok"] is False
    out = set_earnings(s, "NVDA", YESTERDAY)
    assert out["ok"] is False and "past" in out["error"]
    assert earnings_calendar(s) == {}


def test_remove_and_noop_remove():
    s = FakeStore()
    set_earnings(s, "INTC", NEXT_WEEK)
    out = remove_earnings(s, "intc")
    assert out["ok"] and out["symbols"] == {}
    noop = remove_earnings(s, "INTC")
    assert noop["ok"] and "no earnings date" in noop["note"]


def test_prune_drops_only_past_dates():
    s = FakeStore()
    set_earnings(s, "NVDA", NEXT_WEEK)
    # sneak a stale entry in behind the validator (simulates time passing)
    doc = s.get("state", "earnings_calendar")
    doc["symbols"]["OLD"] = YESTERDAY
    s.save("state", "earnings_calendar", doc)

    live = prune_past(s)
    assert live == {"NVDA": NEXT_WEEK}
    assert earnings_calendar(s) == {"NVDA": NEXT_WEEK}
