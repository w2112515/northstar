"""Executor: OrderPlan -> real Alpaca paper orders, with confirmation.

Lifecycle per leg (v1 = sequential single-leg orders; true multi-leg MLEG
lands with the spread catalog in the A-milestone):
  submit limit @ mid -> poll status -> filled | queued (market closed) |
  cancel on timeout (market open).

The executor never decides anything: it only takes gate-approved plans.
"""

from __future__ import annotations

import time
from typing import Any

from alpaca.trading.enums import OrderSide, TimeInForce
from alpaca.trading.requests import LimitOrderRequest

from northstar.broker import trading_client
from northstar.domain import JournalEvent, OrderPlan
from northstar.journal import get_store

TERMINAL = {"filled", "canceled", "expired", "rejected", "done_for_day"}


def _submit_leg(leg) -> Any:
    req = LimitOrderRequest(
        symbol=leg.symbol,
        qty=int(leg.qty),
        side=OrderSide.BUY if leg.side == "buy" else OrderSide.SELL,
        time_in_force=TimeInForce.DAY,
        limit_price=round(float(leg.limit_price), 2),
    )
    return trading_client().submit_order(req)


def _order_state(order_id: str) -> dict[str, Any]:
    o = trading_client().get_order_by_id(order_id)
    return {
        "id": str(o.id),
        "symbol": o.symbol,
        "status": str(o.status.value if hasattr(o.status, "value") else o.status),
        "filled_qty": float(o.filled_qty or 0),
        "filled_avg_price": float(o.filled_avg_price) if o.filled_avg_price else None,
    }


def execute_order_plan(
    plan: OrderPlan, market_open: bool, wait_seconds: int = 90, poll_every: float = 3.0
) -> dict[str, Any]:
    store = get_store()
    results: list[dict[str, Any]] = []

    for leg in plan.legs:
        submitted = _submit_leg(leg)
        oid = str(submitted.id)
        store.append_event(
            JournalEvent(
                kind="order",
                human=f"Order sent: {leg.side} {int(leg.qty)} {leg.symbol} limit ${leg.limit_price:.2f} (paper).",
                payload={"order_id": oid, "leg": leg.model_dump(), "order_plan_id": plan.id},
                refs={"order_plan_id": plan.id, "proposal_id": plan.proposal_id},
            )
        )

        if not market_open:
            results.append({"order_id": oid, "status": "queued_until_open", "leg": leg.model_dump()})
            continue

        deadline = time.monotonic() + wait_seconds
        state = _order_state(oid)
        while state["status"] not in TERMINAL and time.monotonic() < deadline:
            time.sleep(poll_every)
            state = _order_state(oid)

        if state["status"] == "filled":
            store.append_event(
                JournalEvent(
                    kind="fill",
                    human=(
                        f"Filled: {leg.side} {state['filled_qty']:g} {leg.symbol} "
                        f"@ ${state['filled_avg_price']:.2f} (paper)."
                    ),
                    payload=state,
                    refs={"order_plan_id": plan.id, "proposal_id": plan.proposal_id},
                )
            )
        elif state["status"] not in TERMINAL:
            trading_client().cancel_order_by_id(oid)
            state["status"] = "canceled_timeout"
            store.append_event(
                JournalEvent(
                    kind="order",
                    human=f"Not filled in {wait_seconds}s - canceled {leg.symbol} order (no chasing).",
                    payload=state,
                    refs={"order_plan_id": plan.id, "proposal_id": plan.proposal_id},
                )
            )
        results.append({"order_id": oid, **state, "leg": leg.model_dump()})

    return {"order_plan_id": plan.id, "legs": results}
