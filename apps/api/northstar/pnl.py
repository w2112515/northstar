"""Realized P&L accounting + loss-streak tracking.

Entry points:
- record_realized(): exact numbers, called when one of OUR closing orders
  fills (entry price from the position, exit price from the fill).
- reconcile_vanished(): each engine pass compares positions against the last
  snapshot; short options that vanished without one of our fills (expiry,
  assignment, manual close in the Alpaca UI) get an ESTIMATED pnl event,
  clearly labeled as such.

state/portfolio.consecutive_losses: +1 on a realized loss, reset on a win.
The gate's cooldown rule has always read this; this module is what writes it.

Sign convention matches Alpaca positions: qty > 0 long, qty < 0 short.
realized = (exit - entry) * qty * multiplier works for both directions
(short put sold at 2.50, bought back at 1.00, qty=-1, x100 -> +$150).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from northstar.domain import JournalEvent


def _is_occ_option(symbol: str) -> bool:
    return len(symbol) > 15


def update_loss_streak(store, realized: float) -> int:
    doc = store.get("state", "portfolio") or {}
    streak = int(doc.get("consecutive_losses", 0))
    streak = streak + 1 if realized < 0 else 0
    store.save("state", "portfolio", {**doc, "consecutive_losses": streak})
    return streak


def record_realized(
    store,
    *,
    symbol: str,
    qty: float,
    entry_price: float,
    exit_price: float,
    family: str = "",
    multiplier: float | None = None,
    note: str = "",
    estimated: bool = False,
    refs: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Journal one realized round-trip and update the loss streak."""
    mult = multiplier if multiplier is not None else (100.0 if _is_occ_option(symbol) else 1.0)
    realized = (exit_price - entry_price) * qty * mult
    streak = update_loss_streak(store, realized)
    outcome = "win" if realized > 0 else ("loss" if realized < 0 else "flat")
    est = " (estimated)" if estimated else ""
    human = (
        f"Booked {outcome}{est}: {symbol} realized ${realized:,.2f} "
        f"(in ${entry_price:.2f} -> out ${exit_price:.2f}"
        + (f"; {note}" if note else "") + ")."
        + (f" Loss streak: {streak}." if streak else "")
    )
    store.append_event(
        JournalEvent(
            kind="pnl",
            human=human,
            payload={
                "symbol": symbol, "qty": qty,
                "entry_price": round(entry_price, 4), "exit_price": round(exit_price, 4),
                "realized": round(realized, 2), "family": family,
                "estimated": estimated, "note": note, "consecutive_losses": streak,
            },
            refs=refs or {},
        )
    )
    return {"realized": round(realized, 2), "streak": streak}


def drop_from_snapshot(store, symbols: list[str]) -> None:
    """Remove symbols we just booked from the last-positions snapshot so the
    vanish-reconciler never double-books them."""
    doc = store.get("state", "last_positions") or {}
    kept = [p for p in doc.get("positions", []) if p.get("symbol") not in set(symbols)]
    store.save("state", "last_positions", {**doc, "positions": kept})


def reconcile_vanished(store, positions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Book labeled estimates for short options that disappeared outside our
    own closing fills, then refresh the snapshot."""
    prev_doc = store.get("state", "last_positions") or {}
    prev = prev_doc.get("positions", [])
    if not positions and len(prev) > 2:
        # likely an API glitch: don't book a mass "everything expired"
        return []

    current_syms = {p["symbol"] for p in positions}
    prev_equity_syms = {p["symbol"] for p in prev if p.get("asset_class") == "us_equity"}
    booked: list[dict[str, Any]] = []

    for old in prev:
        if old["symbol"] in current_syms or old.get("asset_class") != "us_option":
            continue
        qty = float(old.get("qty") or 0)
        entry = float(old.get("avg_entry_price") or 0)
        if qty >= 0 or entry <= 0:
            continue  # long option legs are booked with their mleg package close
        und = old["symbol"][:-15]
        assigned = any(
            p["asset_class"] == "us_equity" and p["symbol"] == und and und not in prev_equity_syms
            for p in positions
        )
        note = (
            "assignment - shares arrived; premium booked here, stock P&L tracked on the shares"
            if assigned else
            "position vanished outside the loop (expiry or manual close) - booked as worthless expiry"
        )
        booked.append(
            record_realized(
                store, symbol=old["symbol"], qty=qty, entry_price=entry, exit_price=0.0,
                family=str(old.get("family", "")), estimated=True, note=note,
            )
        )

    store.save(
        "state", "last_positions",
        {
            "positions": [
                {
                    "symbol": p["symbol"], "qty": p["qty"], "asset_class": p["asset_class"],
                    "avg_entry_price": p.get("avg_entry_price"),
                }
                for p in positions
            ],
            "ts": datetime.now(timezone.utc).isoformat(),
        },
    )
    return booked
