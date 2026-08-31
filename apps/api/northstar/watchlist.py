"""Manual watch pool - names the user pins from the cockpit chart.

Pinned names ride the same merge as scout picks: every scout-enabled equity
strategy adds them to its tradable universe, and they get their own group on
the market watchlist. Pinning never places an order by itself - a strategy
still needs a signal, and the gate still rules every order.

Unpinning keeps the honesty rule the scout pool already follows: a name you
still HOLD stays in the universe (via pin history) until the position is
exited, so rotation can actually sell it instead of orphaning it.
"""

from __future__ import annotations

from typing import Any

from northstar.domain import JournalEvent

MAX_PINNED = 15
HISTORY_KEPT = 50


def _doc(store) -> dict[str, Any]:
    return store.get("state", "manual_watch") or {"symbols": [], "history": []}


def manual_symbols(store) -> list[str]:
    """Active pins, newest last."""
    return list(_doc(store).get("symbols", []))


def manual_history(store) -> list[str]:
    """Every name ever pinned (capped) - the held-stays-tradable safety net."""
    return list(_doc(store).get("history", []))


def add_manual(store, symbol: str) -> dict[str, Any]:
    """Pin one symbol. Validates format and that we can actually get bars for
    it - a typo'd ticker must fail loudly, not sit dead in the pool."""
    from northstar.market_view import bars_rows, valid_symbol

    sym = symbol.upper().strip()
    if not valid_symbol(sym):
        return {"ok": False, "error": f"'{symbol}' is not a valid ticker"}

    doc = _doc(store)
    symbols: list[str] = list(doc.get("symbols", []))
    if sym in symbols:
        return {"ok": True, "symbols": symbols, "note": f"{sym} is already pinned"}
    if len(symbols) >= MAX_PINNED:
        return {"ok": False, "error": f"pool is full ({MAX_PINNED} names) - unpin something first"}

    if not bars_rows(sym, days=10):
        return {"ok": False, "error": f"no market data for '{sym}' - check the ticker"}

    symbols.append(sym)
    history = [s for s in doc.get("history", []) if s != sym] + [sym]
    store.save("state", "manual_watch", {"symbols": symbols, "history": history[-HISTORY_KEPT:]})
    store.append_event(
        JournalEvent(
            kind="system",
            human=f"You pinned {sym} to the pool - equity strategies now include it in their universe.",
            payload={"action": "pin", "symbol": sym, "pinned": symbols},
        )
    )
    return {"ok": True, "symbols": symbols}


def remove_manual(store, symbol: str) -> dict[str, Any]:
    """Unpin one symbol. If it is still held, pin history keeps it tradable
    until the strategies rotate out of it."""
    sym = symbol.upper().strip()
    doc = _doc(store)
    symbols: list[str] = list(doc.get("symbols", []))
    if sym not in symbols:
        return {"ok": True, "symbols": symbols, "note": f"{sym} was not pinned"}

    symbols = [s for s in symbols if s != sym]
    store.save("state", "manual_watch", {"symbols": symbols, "history": doc.get("history", [])})
    store.append_event(
        JournalEvent(
            kind="system",
            human=f"You unpinned {sym} - if it is still held, strategies keep managing the exit.",
            payload={"action": "unpin", "symbol": sym, "pinned": symbols},
        )
    )
    return {"ok": True, "symbols": symbols}
