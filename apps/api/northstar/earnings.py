"""Manual earnings calendar - scheduled volatility events the gate must know.

Alpaca's free tier has no earnings feed, so the calendar is honest and manual:
you (or a future data hook) record "SYMBOL reports on DATE", and the gate's
earnings_blackout check refuses to open new short premium on that name when
the date falls inside the structure's lifetime. No entry = no block, and the
check says "no data" out loud instead of pretending to know.
"""

from __future__ import annotations

import re
from datetime import date
from typing import Any

from northstar.domain import JournalEvent

_SYM_RE = re.compile(r"^[A-Z][A-Z0-9.]{0,9}$")
MAX_ENTRIES = 100


def _doc(store) -> dict[str, Any]:
    return store.get("state", "earnings_calendar") or {"symbols": {}}


def earnings_calendar(store) -> dict[str, str]:
    """SYMBOL -> ISO date of the next known earnings report."""
    return dict(_doc(store).get("symbols", {}))


def set_earnings(store, symbol: str, date_iso: str) -> dict[str, Any]:
    """Record (or move) one symbol's earnings date. Past dates are refused -
    a stale date can never silently block or unblock trades."""
    sym = symbol.upper().strip()
    if not _SYM_RE.match(sym):
        return {"ok": False, "error": f"'{symbol}' is not a valid ticker"}
    try:
        d = date.fromisoformat(date_iso.strip())
    except ValueError:
        return {"ok": False, "error": f"'{date_iso}' is not a valid ISO date (YYYY-MM-DD)"}
    if d < date.today():
        return {"ok": False, "error": f"{d.isoformat()} is in the past - earnings dates must be upcoming"}

    symbols = earnings_calendar(store)
    if sym not in symbols and len(symbols) >= MAX_ENTRIES:
        return {"ok": False, "error": f"calendar is full ({MAX_ENTRIES} entries)"}
    symbols[sym] = d.isoformat()
    store.save("state", "earnings_calendar", {"symbols": symbols})
    store.append_event(
        JournalEvent(
            kind="system",
            human=f"Earnings date recorded: {sym} reports on {d.isoformat()} - "
                  f"new short premium on it is blocked through that date.",
            payload={"action": "earnings_set", "symbol": sym, "date": d.isoformat()},
        )
    )
    return {"ok": True, "symbols": symbols}


def remove_earnings(store, symbol: str) -> dict[str, Any]:
    sym = symbol.upper().strip()
    symbols = earnings_calendar(store)
    if sym not in symbols:
        return {"ok": True, "symbols": symbols, "note": f"{sym} had no earnings date"}
    removed = symbols.pop(sym)
    store.save("state", "earnings_calendar", {"symbols": symbols})
    store.append_event(
        JournalEvent(
            kind="system",
            human=f"Earnings date cleared for {sym} (was {removed}).",
            payload={"action": "earnings_clear", "symbol": sym, "date": removed},
        )
    )
    return {"ok": True, "symbols": symbols}


def prune_past(store) -> dict[str, str]:
    """Drop dates that are behind us; returns the live calendar. Called by the
    engine when building the gate snapshot, so stale entries never linger."""
    symbols = earnings_calendar(store)
    today = date.today().isoformat()
    live = {s: d for s, d in symbols.items() if d >= today}
    if live != symbols:
        store.save("state", "earnings_calendar", {"symbols": live})
    return live
