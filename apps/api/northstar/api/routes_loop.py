from __future__ import annotations

import asyncio

from fastapi import APIRouter
from pydantic import BaseModel

from northstar.journal import get_store

router = APIRouter(prefix="/api/loop", tags=["loop"])


class TickBody(BaseModel):
    dry_run: bool = False
    reason: str = "manual"


@router.post("/tick")
async def tick(body: TickBody) -> dict:
    from northstar.adkflows.trading_loop import run_trading_pass

    # The pass runs on its own event loop in a worker thread: node bodies make
    # sync LLM/broker calls, and running them here would freeze every other
    # endpoint (cockpit refresh, live graph beacons) for the whole pass.
    return await asyncio.to_thread(
        asyncio.run, run_trading_pass(reason=body.reason, dry_run=body.dry_run)
    )


class AutopilotBody(BaseModel):
    on: bool


@router.post("/autopilot")
def autopilot(body: AutopilotBody) -> dict:
    from northstar.domain import JournalEvent

    store = get_store()
    doc = store.get("state", "controls") or {}
    doc["autopilot"] = body.on
    store.save("state", "controls", doc)
    store.append_event(
        JournalEvent(
            kind="system",
            human="Autopilot ON - the loop will run on schedule during market hours."
            if body.on else "Autopilot OFF - the loop only runs when you trigger it.",
            payload={"autopilot": body.on},
        )
    )
    return {"ok": True, "autopilot": body.on}


@router.get("/status")
def status() -> dict:
    store = get_store()
    controls = store.get("state", "controls") or {}
    portfolio = store.get("state", "portfolio") or {}
    return {
        "autopilot": bool(controls.get("autopilot")),
        "kill_switch": bool(controls.get("kill_switch")),
        "last_tick": portfolio.get("last_tick"),
    }
