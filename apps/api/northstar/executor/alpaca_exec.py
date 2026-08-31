"""Executor: OrderPlan -> real Alpaca paper orders, with confirmation.

Two paths, both taking only gate-approved plans:
- single-leg: submit limit @ mid -> poll -> filled | queued (closed) | cancel on timeout
- multi-leg (meta.order_class == "mleg"): ONE atomic order, all legs fill together
  at a net limit (negative = credit, per Alpaca semantics). No legging risk.

The executor never decides anything.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any

from alpaca.trading.enums import OrderClass, OrderSide, TimeInForce
from alpaca.trading.requests import LimitOrderRequest, OptionLegRequest

from northstar.broker import cancel_order, get_open_orders, latest_quote, trading_client
from northstar.domain import JournalEvent, OrderPlan
from northstar.journal import get_store

TERMINAL = {"filled", "canceled", "expired", "rejected", "done_for_day"}

STALE_ORDER_HOURS = 20


def sweep_stale_orders() -> list[str]:
    """Cancel exchange orders that survived a prior session.

    A limit order left working overnight pins yesterday's price to today's
    market, and - because strategies skip any symbol that already has an open
    order - it silently blocks the very name it was meant to trade. 20h spares
    same-session retries and pre-open queue orders but clears anything that
    crossed an overnight gap.
    """
    store = get_store()
    now = datetime.now(timezone.utc)
    swept: list[str] = []
    for o in get_open_orders():
        created = o.get("created_at")
        if not created:
            continue
        age_hours = (now - datetime.fromisoformat(created)).total_seconds() / 3600.0
        if age_hours < STALE_ORDER_HOURS:
            continue
        try:
            cancel_order(o["id"])
        except Exception:
            continue  # already terminal or racing a fill; next pass re-checks
        swept.append(o["id"])
        store.append_event(
            JournalEvent(
                kind="order",
                human=(
                    f"Swept stale order from a prior session: {o.get('side')} "
                    f"{int(o['qty']) if o.get('qty') else '?'} {o.get('symbol')} "
                    f"limit ${o['limit_price']:.2f} sat {age_hours:.0f}h unfilled - "
                    "canceled so the symbol is tradable again at today's prices."
                ),
                payload=o,
            )
        )
    return swept


def _submit_idempotent(req: LimitOrderRequest, client_order_id: str) -> Any:
    """Submit with Alpaca-side dedup: the plan id is the client_order_id, so a
    replay (retry, crash-recovery, double entry) returns the existing order
    instead of creating a second one."""
    try:
        return trading_client().submit_order(req)
    except Exception as e:
        msg = str(e).lower()
        if "client_order_id" in msg or "duplicate" in msg:
            try:
                return trading_client().get_order_by_client_id(client_order_id)
            except Exception:
                pass
        raise


def _submit_leg(leg, client_order_id: str) -> Any:
    req = LimitOrderRequest(
        symbol=leg.symbol,
        qty=int(leg.qty),
        side=OrderSide.BUY if leg.side == "buy" else OrderSide.SELL,
        time_in_force=TimeInForce.DAY,
        limit_price=round(float(leg.limit_price), 2),
        client_order_id=client_order_id,
    )
    return _submit_idempotent(req, client_order_id)


def _submit_mleg(plan: OrderPlan) -> Any:
    cid = f"{plan.id}-mleg"
    req = LimitOrderRequest(
        qty=int(plan.meta.get("contracts", 1)),
        order_class=OrderClass.MLEG,
        time_in_force=TimeInForce.DAY,
        limit_price=round(float(plan.meta["net_limit"]), 2),
        client_order_id=cid,
        legs=[
            OptionLegRequest(
                symbol=l.symbol,
                ratio_qty=int(l.qty),
                side=OrderSide.BUY if l.side == "buy" else OrderSide.SELL,
            )
            for l in plan.legs
        ],
    )
    return _submit_idempotent(req, cid)


def _order_state(order_id: str) -> dict[str, Any]:
    o = trading_client().get_order_by_id(order_id)
    return {
        "id": str(o.id),
        "symbol": o.symbol,
        "status": str(o.status.value if hasattr(o.status, "value") else o.status),
        "filled_qty": float(o.filled_qty or 0),
        "filled_avg_price": float(o.filled_avg_price) if o.filled_avg_price else None,
    }


def _track_order(
    plan: OrderPlan, oid: str, label: str, market_open: bool,
    wait_seconds: int, poll_every: float,
) -> dict[str, Any]:
    """Poll one submitted order to terminal state; journal fill/timeout."""
    store = get_store()
    if not market_open:
        return {"order_id": oid, "status": "queued_until_open"}

    deadline = time.monotonic() + wait_seconds
    state = _order_state(oid)
    while state["status"] not in TERMINAL and time.monotonic() < deadline:
        time.sleep(poll_every)
        state = _order_state(oid)

    if state["status"] == "filled":
        px = state.get("filled_avg_price")
        store.append_event(
            JournalEvent(
                kind="fill",
                human=f"Filled: {label}" + (f" @ ${px:.2f} (paper)." if px else " (paper)."),
                payload=state,
                refs={"order_plan_id": plan.id, "proposal_id": plan.proposal_id},
            )
        )
        _maybe_book_close(store, plan, state)
    elif state["status"] not in TERMINAL:
        trading_client().cancel_order_by_id(oid)
        state["status"] = "canceled_timeout"
        store.append_event(
            JournalEvent(
                kind="order",
                human=f"Not filled in {wait_seconds}s - canceled: {label} (no chasing).",
                payload=state,
                refs={"order_plan_id": plan.id, "proposal_id": plan.proposal_id},
            )
        )
    return {"order_id": oid, **state}


def _maybe_book_close(store, plan: OrderPlan, state: dict[str, Any]) -> None:
    """Closing plans carry their entry basis in meta; book exact realized P&L
    on fill and drop the symbols from the vanish-reconciler's snapshot."""
    if not plan.meta.get("closing"):
        return
    entry = plan.meta.get("entry_price")
    px = state.get("filled_avg_price")
    if entry is None or px is None:
        return
    from northstar.pnl import drop_from_snapshot, record_realized

    record_realized(
        store,
        symbol=str(plan.meta.get("close_symbol") or plan.legs[0].symbol),
        qty=float(plan.meta.get("signed_qty", 0.0)),
        entry_price=float(entry),
        exit_price=float(px),
        family=str(plan.meta.get("family", plan.strategy_type)),
        multiplier=plan.meta.get("pnl_multiplier"),
        note=str(plan.meta.get("close_note", "")),
        refs={"order_plan_id": plan.id, "proposal_id": plan.proposal_id},
    )
    drop_from_snapshot(store, [l.symbol for l in plan.legs])


def execute_order_plan(
    plan: OrderPlan, market_open: bool, wait_seconds: int = 90, poll_every: float = 3.0
) -> dict[str, Any]:
    store = get_store()

    if plan.meta.get("order_class") == "mleg":
        submitted = _submit_mleg(plan)
        oid = str(submitted.id)
        net = float(plan.meta["net_limit"])
        label = f"{plan.strategy_type.replace('_', ' ')} on {plan.legs[0].symbol[:-15]} ({len(plan.legs)} legs)"
        store.append_event(
            JournalEvent(
                kind="order",
                human=(
                    f"Order sent: {label}, one atomic multi-leg order, net "
                    f"{'credit' if net < 0 else 'debit'} limit ${abs(net):.2f} (paper)."
                ),
                payload={"order_id": oid, "legs": [l.model_dump() for l in plan.legs],
                         "net_limit": net, "order_plan_id": plan.id},
                refs={"order_plan_id": plan.id, "proposal_id": plan.proposal_id},
            )
        )
        state = _track_order(plan, oid, label, market_open, wait_seconds, poll_every)
        return {"order_plan_id": plan.id, "legs": [{**state, "mleg": True}]}

    results: list[dict[str, Any]] = []
    for i, leg in enumerate(plan.legs):
        submitted = _submit_leg(leg, client_order_id=f"{plan.id}-{i}")
        oid = str(submitted.id)
        label = f"{leg.side} {int(leg.qty)} {leg.symbol}"
        store.append_event(
            JournalEvent(
                kind="order",
                human=f"Order sent: {label} limit ${leg.limit_price:.2f} (paper).",
                payload={"order_id": oid, "leg": leg.model_dump(), "order_plan_id": plan.id},
                refs={"order_plan_id": plan.id, "proposal_id": plan.proposal_id},
            )
        )
        state = _track_order(plan, oid, label, market_open, wait_seconds, poll_every)
        if (
            state["status"] == "canceled_timeout"
            and plan.meta.get("closing")
            and leg.asset_class == "us_equity"
        ):
            state = _reprice_closing_leg(plan, leg, i, wait_seconds, poll_every) or state
        results.append({**state, "leg": leg.model_dump()})

    return {"order_plan_id": plan.id, "legs": results}


def _reprice_closing_leg(
    plan: OrderPlan, leg, i: int, wait_seconds: int, poll_every: float
) -> dict[str, Any] | None:
    """One escalation for a risk-reducing equity leg that timed out at mid.

    'No chasing' is discipline for OPENING trades; a closing/rotation order
    repriced at a stale mid every pass just never fills in a trending market
    (observed live: a rotation sell timed out 4+ passes in a row). Cross the
    spread once - sell at bid, buy back at ask - with half the wait; if even
    that misses, give up and let the next pass retry. Options keep the
    original discipline: their spreads are too wide to cross blindly.
    """
    store = get_store()
    try:
        q = latest_quote(leg.symbol)
        px = float(q["bid"] if leg.side == "sell" else q["ask"])
    except Exception:
        return None
    if px <= 0:
        return None

    crossed = leg.model_copy(update={"limit_price": round(px, 2)})
    label = f"{leg.side} {int(leg.qty)} {leg.symbol}"
    submitted = _submit_leg(crossed, client_order_id=f"{plan.id}-{i}-x")
    oid = str(submitted.id)
    store.append_event(
        JournalEvent(
            kind="order",
            human=(
                f"Repriced to cross the spread: {label} limit ${crossed.limit_price:.2f} "
                "(risk-reducing order missed at mid - completing beats price here)."
            ),
            payload={"order_id": oid, "leg": crossed.model_dump(), "order_plan_id": plan.id,
                     "escalation": "cross_spread"},
            refs={"order_plan_id": plan.id, "proposal_id": plan.proposal_id},
        )
    )
    return _track_order(plan, oid, label, True, max(30, wait_seconds // 2), poll_every)
