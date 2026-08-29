from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from northstar.config import get_settings
from northstar.journal import get_store

app = FastAPI(title="NorthStar API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
def healthz() -> dict:
    s = get_settings()
    return {
        "ok": True,
        "paper": s.alpaca_paper,
        "account_role": s.account_role,
        "llm_enabled": s.llm_enabled,
        "journal_store": s.journal_store,
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
        "northstar.api.routes_lab",
    ):
        try:
            m = importlib.import_module(mod)
        except ModuleNotFoundError:
            continue
        app.include_router(m.router)


_include_optional_routers()
