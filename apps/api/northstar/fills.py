"""Order-fill reconciliation.

The executor only journals fills it watches live. Orders that fill outside a
live pass - queued over a weekend and filled at Monday's open, or filled after
the 90s poll window - would otherwise never produce a fill event, leaving
holes in the chart markers and the narrative. This module scans recent closed
orders at the broker and back-fills the missing events, idempotently.

Pure helpers are separated from the broker fetch so tests run on plain dicts.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from northstar.domain import JournalEvent


def _norm(value: Any) -> str:
    return str(getattr(value, "value", value) or "")


def rows_from_orders(orders: list[Any]) -> list[dict[str, Any]]:
    """Alpaca order objects -> flat filled rows. MLEG parents expand to their
    legs (the legs carry the OCC symbols the chart wants); plain orders map 1:1."""
    rows: list[dict[str, Any]] = []
    for o in orders:
        legs = list(getattr(o, "legs", None) or [])
        for item in legs if legs else [o]:
            if _norm(getattr(item, "status", "")) != "filled":
                continue
            qty = float(getattr(item, "filled_qty", 0) or 0)
            if qty <= 0:
                continue
            px = getattr(item, "filled_avg_price", None)
            rows.append({
                "id": str(item.id),
                "symbol": str(item.symbol),
                "side": _norm(getattr(item, "side", "")),
                "filled_qty": qty,
                "filled_avg_price": float(px) if px else None,
            })
    return rows


def known_fill_ids(store, limit: int = 1000) -> set[str]:
    ids: set[str] = set()
    for e in store.events(kinds=["fill"], limit=limit):
        oid = str((e.payload or {}).get("id") or "")
        if oid:
            ids.add(oid)
    return ids


def reconcile_from_rows(store, rows: list[dict[str, Any]], known: set[str]) -> list[dict[str, Any]]:
    """Append a fill event for every filled row we have not journaled yet."""
    # order events carry order_id -> plan/proposal refs; recover them when we can
    refs_by_oid: dict[str, dict[str, str]] = {}
    for e in store.events(kinds=["order"], limit=1000):
        oid = str((e.payload or {}).get("order_id") or "")
        if oid and oid not in refs_by_oid:
            refs_by_oid[oid] = dict(e.refs or {})

    booked: list[dict[str, Any]] = []
    for r in rows:
        if r["id"] in known:
            continue
        px = r.get("filled_avg_price")
        side = r.get("side") or "fill"
        human = (
            f"Filled (reconciled): {side} {int(r['filled_qty'])} {r['symbol']}"
            + (f" @ ${px:.2f} (paper)." if px else " (paper).")
        )
        store.append_event(
            JournalEvent(
                kind="fill",
                human=human,
                payload={**r, "status": "filled", "reconciled": True},
                refs=refs_by_oid.get(r["id"], {}),
            )
        )
        booked.append(r)
    return booked


def reconcile_order_fills(store, days: int = 5) -> list[dict[str, Any]]:
    """Scan recent closed orders at Alpaca and back-fill missing fill events."""
    from alpaca.trading.enums import QueryOrderStatus
    from alpaca.trading.requests import GetOrdersRequest

    from northstar.broker import trading_client

    req = GetOrdersRequest(
        status=QueryOrderStatus.CLOSED,
        after=datetime.now(timezone.utc) - timedelta(days=days),
        limit=200,
        nested=True,
    )
    orders = trading_client().get_orders(req)
    return reconcile_from_rows(store, rows_from_orders(list(orders)), known_fill_ids(store))
