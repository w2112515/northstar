from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from northstar.journal import get_store

router = APIRouter(prefix="/api", tags=["engine"])


@router.get("/strategies")
def strategies() -> dict:
    from northstar.engine import ensure_default_instances
    from northstar.strategies import CATALOG

    store = get_store()
    instances = [i.model_dump() for i in ensure_default_instances(store)]
    return {"catalog": CATALOG, "instances": instances}


@router.get("/positions")
def positions() -> dict:
    from northstar.broker import get_account_summary, get_open_orders, get_positions

    return {
        "account": get_account_summary(),
        "positions": get_positions(),
        "open_orders": get_open_orders(),
    }


@router.get("/engine/state")
def engine_state() -> dict:
    from northstar.broker import get_account_summary, get_clock
    from northstar.engine import active_plan, load_controls

    store = get_store()
    account = get_account_summary()
    portfolio = store.get("state", "portfolio") or {}
    peak = max(float(portfolio.get("peak_equity", 0.0)), account["equity"])
    controls = load_controls(store)
    plan, goal = active_plan(store)
    dd = account["equity"] / peak - 1 if peak > 0 else 0.0
    return {
        "clock": get_clock(),
        "account": account,
        "peak_equity": peak,
        "drawdown_from_peak": dd,
        "day_pnl_pct": account["equity"] / account["last_equity"] - 1 if account["last_equity"] else 0.0,
        "kill_switch": controls["kill_switch"],
        "plan": plan.model_dump() if plan else None,
        "goal": goal.model_dump() if goal else None,
    }


class RunOnceBody(BaseModel):
    dry_run: bool = False


@router.post("/engine/run-once")
def run_once(body: RunOnceBody) -> dict:
    from northstar.engine import run_once as _run

    return _run(dry_run=body.dry_run)


class KillBody(BaseModel):
    on: bool


@router.post("/engine/kill-switch")
def kill_switch(body: KillBody) -> dict:
    from northstar.domain import JournalEvent

    store = get_store()
    doc = store.get("state", "controls") or {}
    doc["kill_switch"] = body.on
    store.save("state", "controls", doc)
    store.append_event(
        JournalEvent(
            kind="system",
            human="Kill switch ON - no new trades until you turn it off." if body.on
            else "Kill switch OFF - normal operation resumed.",
            payload={"kill_switch": body.on},
        )
    )
    return {"ok": True, "kill_switch": body.on}


@router.get("/approvals")
def approvals() -> dict:
    docs = get_store().list("approvals")
    pending = [d for d in docs if d.get("status") == "pending"]
    decided = [d for d in docs if d.get("status") != "pending"]
    return {"pending": pending, "decided": decided[-20:]}


class ApprovalBody(BaseModel):
    approve: bool


@router.post("/approvals/{approval_id}")
def decide(approval_id: str, body: ApprovalBody) -> dict:
    from northstar.engine import decide_approval

    return decide_approval(approval_id, body.approve)
