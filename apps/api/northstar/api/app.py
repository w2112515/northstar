from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from northstar.config import get_settings
from northstar.journal import get_store

LOOP_MINUTES = int(os.getenv("LOOP_MINUTES", "15"))


async def _scheduler() -> None:
    """Autopilot ticker: one ADK pass every LOOP_MINUTES while autopilot is on.

    Runs regardless of market session (closed-market passes queue orders /
    no-op cheaply); triage + gates decide what actually happens.
    """
    from northstar.adkflows.trading_loop import run_trading_pass
    from northstar.engine import expire_stale_approvals
    from northstar.nightly import run_nightly

    from northstar.fills import reconcile_order_fills

    store = get_store()
    while True:
        await asyncio.sleep(60)
        try:
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
            nightly_state = store.get("state", "nightly") or {}
            if now.hour >= 1 and nightly_state.get("last_run") != now.date().isoformat():
                store.save("state", "nightly",
                           {**nightly_state, "last_run": now.date().isoformat()})
                await asyncio.to_thread(run_nightly, store)

            controls = store.get("state", "controls") or {}
            if not controls.get("autopilot") or controls.get("kill_switch"):
                continue
            portfolio = store.get("state", "portfolio") or {}
            last = portfolio.get("last_tick")
            now = datetime.now(timezone.utc)
            if last and (now - datetime.fromisoformat(last)).total_seconds() < LOOP_MINUTES * 60:
                continue
            store.save("state", "portfolio", {**portfolio, "last_tick": now.isoformat()})
            # own loop in a worker thread - sync LLM/broker calls inside the
            # nodes must not freeze the API while a pass runs
            await asyncio.to_thread(asyncio.run, run_trading_pass(reason="scheduled"))
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
    task = asyncio.create_task(_scheduler())
    if _a2a_app is not None:
        # Mounted sub-apps don't get their lifespan run by Starlette; the A2A app
        # builds its agent card + routes in lifespan, so enter it explicitly.
        async with _a2a_app.router.lifespan_context(_a2a_app):
            yield
    else:
        yield
    task.cancel()


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
ADMIN_TOKEN = os.getenv("NORTHSTAR_ADMIN_TOKEN", "")


@app.middleware("http")
async def _guard_mutations(request, call_next):
    if (
        ADMIN_TOKEN
        and request.method not in ("GET", "HEAD", "OPTIONS")
        and not request.url.path.startswith("/a2a")
        and request.headers.get("x-northstar-key") != ADMIN_TOKEN
    ):
        from fastapi.responses import JSONResponse

        return JSONResponse(
            {"error": "unauthorized - mutating endpoints require X-NorthStar-Key"},
            status_code=401,
        )
    return await call_next(request)


@app.get("/healthz")
def healthz() -> dict:
    s = get_settings()
    return {
        "ok": True,
        "paper": s.alpaca_paper,
        "account_role": s.account_role,
        "llm_enabled": s.llm_enabled,
        "llm_key_len": len(s.google_api_key),
        "journal_store": s.journal_store,
        "rev": 2,
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
