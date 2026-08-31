from __future__ import annotations

import asyncio
import os
import socket
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from northstar.config import get_settings
from northstar.journal import get_store

LOOP_MINUTES = int(os.getenv("LOOP_MINUTES", "15"))

# ---------------------------------------------------------------- driver lease
# Exactly one process per store may drive (run the scheduler, mutate state).
# Everyone else is an observer: read endpoints serve normally, mutations get
# 409. The lease lives in the store itself, so contention is only possible
# between processes sharing a store - which is exactly the failure mode this
# guards (two Cloud Run instances on one Firestore, a second uvicorn on the
# VPS). TTL 300s + renew every scheduler tick (60s): a dead driver is replaced
# in at most ~5 minutes, with no human in the loop.
DRIVER_LEASE = "driver"
LEASE_TTL_SECONDS = int(os.getenv("DRIVER_LEASE_TTL", "300"))
INSTANCE_ID = f"{socket.gethostname()}:{os.getpid()}"
_driver_state = {"is_driver": False}


def is_driver() -> bool:
    return bool(_driver_state["is_driver"])


def _tend_lease(store) -> bool:
    """Acquire/renew the driver lease; journal only the transitions."""
    from northstar.domain import JournalEvent

    got = store.acquire_lease(DRIVER_LEASE, INSTANCE_ID, LEASE_TTL_SECONDS)
    if got != _driver_state["is_driver"]:
        _driver_state["is_driver"] = got
        try:
            if got:
                human = f"This instance ({INSTANCE_ID}) took the driver lease - scheduler active."
            else:
                human = (
                    f"Driver lease held elsewhere ({store.lease_holder(DRIVER_LEASE)}) - "
                    f"this instance ({INSTANCE_ID}) is a read-only observer."
                )
            store.append_event(JournalEvent(
                kind="system", human=human,
                payload={"lease": DRIVER_LEASE, "holder": INSTANCE_ID, "driver": got},
            ))
        except Exception:
            pass
    return got


async def _scheduler() -> None:
    """Autopilot ticker. Every 60s the driver: renews its lease, expires stale
    approvals, back-fills fills, ENQUEUES due work (nightly, trading pass) into
    the persistent job table, then consumes the queue one job at a time.

    Enqueue-then-consume instead of calling directly: a crash mid-job leaves a
    `running` row that startup re-queues (northstar.jobs.resume_incomplete), so
    the intent survives the process. Idempotency keys (one per UTC date / tick
    window) make double-enqueueing impossible.
    """
    from northstar import jobs
    from northstar.engine import expire_stale_approvals
    from northstar.fills import reconcile_order_fills

    store = get_store()
    while True:
        await asyncio.sleep(60)
        try:
            # lease first: observers poll (instant failover when the driver
            # dies) but run nothing that writes
            if not await asyncio.to_thread(_tend_lease, store):
                continue
            # timeout = automatic no, independent of autopilot/kill switch
            expire_stale_approvals(store)

            # back-fill fills for orders that completed outside a live pass
            # (weekend-queued orders filling at Monday's open); every 5 minutes
            now = datetime.now(timezone.utc)
            fr = store.get("state", "fills_reconcile") or {}
            last_fr = fr.get("last_run")
            if not last_fr or (now - datetime.fromisoformat(last_fr)).total_seconds() >= 300:
                store.save("state", "fills_reconcile", {"last_run": now.isoformat()})
                await asyncio.to_thread(reconcile_order_fills, store)

            # night watch: once per UTC date, after 01:00 UTC (US market long closed)
            now = datetime.now(timezone.utc)
            if now.hour >= 1:
                jobs.enqueue(store, "nightly", f"nightly:{now.date().isoformat()}")

            controls = store.get("state", "controls") or {}
            autopilot_on = controls.get("autopilot") and not controls.get("kill_switch")
            if autopilot_on:
                portfolio = store.get("state", "portfolio") or {}
                last = portfolio.get("last_tick")
                now = datetime.now(timezone.utc)
                if not last or (now - datetime.fromisoformat(last)).total_seconds() >= LOOP_MINUTES * 60:
                    store.save("state", "portfolio", {**portfolio, "last_tick": now.isoformat()})
                    jobs.enqueue(store, "trading_pass",
                                 f"pass:{now.strftime('%Y-%m-%dT%H:%M')}",
                                 {"reason": "scheduled"})

            # consume: one at a time, in a worker thread - sync LLM/broker
            # calls inside the jobs must not freeze the API while they run
            for _ in range(4):  # bounded per tick; leftovers wait 60s
                done = await asyncio.to_thread(jobs.run_one, store, INSTANCE_ID)
                if done is None:
                    break
            jobs.prune_finished(store)
        except Exception as e:  # keep the scheduler alive; failures are journaled
            from northstar.domain import JournalEvent

            store.append_event(
                JournalEvent(kind="system", human=f"Scheduled pass failed: {e}", payload={"error": str(e)})
            )


def _build_a2a_subapp():
    """Weather station as an A2A agent; optional so a missing a2a extra never kills the API."""
    try:
        from northstar.adkflows.a2a_weather import build_a2a_app

        return build_a2a_app()
    except Exception as e:
        print(f"[a2a] weather agent disabled: {type(e).__name__}: {e}")
        return None


_a2a_app = _build_a2a_subapp()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # compete for the driver seat immediately (don't wait for the first tick),
    # so healthz tells the truth from second one
    try:
        if await asyncio.to_thread(_tend_lease, get_store()):
            # crash recovery: whatever was running when the last process died
            # goes back to pending; the first tick consumes it
            from northstar.jobs import resume_incomplete

            await asyncio.to_thread(resume_incomplete, get_store())
    except Exception as e:
        print(f"[lease] startup election failed: {type(e).__name__}: {e}")
    task = asyncio.create_task(_scheduler())
    try:
        if _a2a_app is not None:
            # Mounted sub-apps don't get their lifespan run by Starlette; the A2A app
            # builds its agent card + routes in lifespan, so enter it explicitly.
            async with _a2a_app.router.lifespan_context(_a2a_app):
                yield
        else:
            yield
    finally:
        task.cancel()
        # clean handover: a restart should not wait out the TTL
        if is_driver():
            try:
                get_store().release_lease(DRIVER_LEASE, INSTANCE_ID)
            except Exception:
                pass


app = FastAPI(title="NorthStar API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Optional write guard for public deployments: when NORTHSTAR_ADMIN_TOKEN is
# set, every mutating request must carry it (the web app's server-side proxy
# injects the header; browsers never see the token). GETs stay public so the
# cockpit is viewable, and the A2A agent endpoint stays open by design - it
# answers weather questions and mutates nothing. Unset (local dev) = no-op.
# Resolved via config.secret_env: systemd credential > .env > process env.
from northstar.config import secret_env  # noqa: E402

ADMIN_TOKEN = secret_env("NORTHSTAR_ADMIN_TOKEN", "")


@app.middleware("http")
async def _guard_mutations(request, call_next):
    if request.method not in ("GET", "HEAD", "OPTIONS") and not request.url.path.startswith("/a2a"):
        from fastapi.responses import JSONResponse

        if ADMIN_TOKEN and request.headers.get("x-northstar-key") != ADMIN_TOKEN:
            return JSONResponse(
                {"error": "unauthorized - mutating endpoints require X-NorthStar-Key"},
                status_code=401,
            )
        # observer instances serve reads only; the driver holds the lease
        if not is_driver():
            return JSONResponse(
                {"error": "this instance is a read-only observer - the driver lease is held by "
                          f"{get_store().lease_holder(DRIVER_LEASE) or 'nobody yet'}"},
                status_code=409,
            )
    return await call_next(request)


@app.get("/healthz")
@app.get("/api/healthz")  # alias: reachable through the web proxy (it only forwards /api/*)
def healthz() -> dict:
    s = get_settings()
    # Liveness of the driver, not just the process: age of the newest journal
    # event. A healthy autopilot writes trace/digest events every pass (<=15
    # min apart), so monitors can alert on "process up but scheduler frozen".
    last_event_age: int | None = None
    try:
        events = get_store().events(limit=1)
        if events:
            ts = events[0].ts
            if isinstance(ts, str):
                ts = datetime.fromisoformat(ts)
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            last_event_age = int((datetime.now(timezone.utc) - ts).total_seconds())
    except Exception:
        pass
    return {
        "ok": True,
        "paper": s.alpaca_paper,
        "account_role": s.account_role,
        "llm_enabled": s.llm_enabled,
        "llm_key_len": len(s.google_api_key),
        "journal_store": s.journal_store,
        "last_pass_age_seconds": last_event_age,
        "driver": is_driver(),
        "instance": INSTANCE_ID,
        "rev": 4,
    }


@app.get("/api/smoke")
def smoke() -> dict:
    from northstar.smoke import run

    return run()


@app.get("/api/account")
def account() -> dict:
    from northstar.broker import get_account_summary, get_clock

    return {"account": get_account_summary(), "clock": get_clock()}


@app.get("/api/journal")
def journal(kinds: str | None = None, limit: int = 200) -> dict:
    kindlist = [k.strip() for k in kinds.split(",")] if kinds else None
    events = get_store().events(kinds=kindlist, limit=limit)
    return {"events": [e.model_dump() for e in events]}


def _include_optional_routers() -> None:
    """Routers land per vertical slice; missing modules are not an error during G1."""
    import importlib

    for mod in (
        "northstar.api.routes_goal",
        "northstar.api.routes_engine",
        "northstar.api.routes_loop",
        "northstar.api.routes_lab",
    ):
        try:
            m = importlib.import_module(mod)
        except ModuleNotFoundError:
            continue
        app.include_router(m.router)


_include_optional_routers()

if _a2a_app is not None:
    # Catch-all mount: FastAPI's own routes win; /a2a/weather/* (JSON-RPC) and the
    # /a2a/weather/.well-known agent card fall through to the A2A sub-app.
    app.mount("/", _a2a_app)
