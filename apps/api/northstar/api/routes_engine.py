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
    ensure_default_instances(store)
    instances = store.list("instances")
    return {"catalog": CATALOG, "instances": instances}


class ToggleBody(BaseModel):
    enabled: bool


@router.post("/strategies/{family}/toggle")
def toggle_strategy(family: str, body: ToggleBody) -> dict:
    """Enable/disable a catalog family. First enable seeds an instance from defaults."""
    from northstar.domain import JournalEvent, StrategyInstance
    from northstar.strategies import catalog_entry

    entry = catalog_entry(family)
    if entry is None or not entry.get("runnable"):
        return {"ok": False, "error": f"{family} is not a runnable strategy"}

    store = get_store()
    docs = [d for d in store.list("instances")
            if d.get("family") == family and d.get("status") != "archived"]
    if not docs and body.enabled and family == "dsl_rotation":
        # shipyard strategies have no meaningful defaults - they are born from
        # an approved spec (Lab -> Shipyard), never seeded blank
        return {"ok": False, "error": "shipyard strategies are created by approving a spec in the Lab"}
    if not docs and body.enabled:
        inst = StrategyInstance(
            family=family,
            strategy_type=entry["type"],
            params=dict(entry.get("default_params", {})),
            status="champion",
            version="v1",
        )
        store.save("instances", inst.id, inst.model_dump())
        docs = [inst.model_dump()]
    else:
        for d in docs:
            d["enabled"] = body.enabled
            store.save("instances", d["id"], d)

    store.append_event(
        JournalEvent(
            kind="system",
            human=(
                f"Strategy {entry['name']} switched {'ON - it can propose trades from the next pass' if body.enabled else 'OFF - no new trades from it'}."
            ),
            payload={"family": family, "enabled": body.enabled},
        )
    )
    return {"ok": True, "family": family, "enabled": body.enabled, "instances": docs}


class FreezeBody(BaseModel):
    symbol: str
    frozen: bool


@router.post("/engine/freeze")
def freeze_symbol(body: FreezeBody) -> dict:
    """Per-name kill switch: gate blocks any new trade on a frozen underlying."""
    from northstar.domain import JournalEvent

    store = get_store()
    doc = store.get("state", "controls") or {}
    frozen = {s.upper() for s in doc.get("frozen_symbols", [])}
    sym = body.symbol.upper().strip()
    if body.frozen:
        frozen.add(sym)
    else:
        frozen.discard(sym)
    doc["frozen_symbols"] = sorted(frozen)
    store.save("state", "controls", doc)
    store.append_event(
        JournalEvent(
            kind="system",
            human=(f"{sym} frozen - no new trades on it until you unfreeze." if body.frozen
                   else f"{sym} unfrozen - strategies may trade it again."),
            payload={"symbol": sym, "frozen": body.frozen, "frozen_symbols": doc["frozen_symbols"]},
        )
    )
    return {"ok": True, "frozen_symbols": doc["frozen_symbols"]}


@router.get("/weather")
def weather() -> dict:
    """Market weather reading (cached; refreshes at most every 15 minutes)."""
    from northstar.weather import get_weather

    return {"weather": get_weather(get_store())}


@router.get("/scout")
def scout_report() -> dict:
    """Latest full-market scout report + options watch (refreshed nightly or via POST /scout/run)."""
    store = get_store()
    return {"scout": store.get("state", "scout"), "options_watch": store.get("state", "options_watch")}


@router.get("/compass")
def compass_state() -> dict:
    """Market compass (regime + conditional stats) and helm-advisor state."""
    store = get_store()
    return {"compass": store.get("state", "compass"), "advisor": store.get("state", "advisor")}


@router.get("/factors")
def factor_ic() -> dict:
    """Known-factor screener output: rank-IC table (refreshed nightly)."""
    return {"factors": get_store().get("state", "factor_ic")}


@router.get("/report/daily")
def daily_report(refresh: bool = False) -> dict:
    """Markdown daily report (equity / trades / regime / scout / captain).
    Built by the night watch; refresh=true rebuilds from current state."""
    from northstar.report import build_daily_report

    store = get_store()
    doc = store.get("state", "daily_report")
    if refresh or not doc:
        doc = build_daily_report(store)
    return {"report": doc}


@router.post("/compass/run")
def compass_run() -> dict:
    """Manual compass refresh: classify regime, bucket champion performance."""
    from northstar.regime import run_compass

    doc = run_compass(get_store())
    if doc.get("skipped") or doc.get("error"):
        return {"ok": False, **doc}
    return {"ok": True, "compass": doc}


class AdviceBody(BaseModel):
    adopt: bool


@router.post("/advisor/decide")
def advisor_decide(body: AdviceBody) -> dict:
    """Adopt/dismiss the pending helm advice. Reweights the plan only - this
    endpoint cannot place or approve orders (separate from the money path)."""
    from northstar.advisor import decide_advice

    return decide_advice(get_store(), body.adopt)


@router.post("/scout/run")
def scout_run() -> dict:
    """Manual scan: screener boards -> liquidity floor -> scored Top-K."""
    from northstar.scout import run_scout, scan_options

    store = get_store()
    doc = run_scout(store)
    if doc.get("skipped"):
        return {"ok": False, "error": doc["skipped"]}
    try:
        watch = scan_options(store)
    except Exception:
        watch = None
    return {"ok": True, "scout": doc, "options_watch": watch}


@router.get("/forecast")
def forecast() -> dict:
    """Cached TimesFM forecast doc + its public scorecard (graded nightly)."""
    from northstar.forecast import get_forecasts, timesfm_available

    store = get_store()
    return {
        "forecast": get_forecasts(store),
        "available": timesfm_available(),
        "skill": store.get("state", "forecast_skill"),
    }


@router.post("/engine/forecast")
def forecast_now() -> dict:
    """Manual TimesFM refresh (first call downloads the ~800MB checkpoint)."""
    from northstar.forecast import refresh_forecasts, timesfm_available

    if not timesfm_available():
        return {"ok": False, "error": "timesfm/torch not installed"}
    doc = refresh_forecasts(get_store())
    if doc is None:
        return {"ok": False, "error": "model or market data unavailable"}
    return {"ok": True, "symbols": len(doc.get("symbols", {})), "ts": doc.get("ts")}


@router.get("/positions")
def positions() -> dict:
    from northstar.broker import get_account_summary, get_open_orders, get_positions

    return {
        "account": get_account_summary(),
        "positions": get_positions(),
        "open_orders": get_open_orders(),
    }


class CloseBody(BaseModel):
    symbol: str


@router.post("/positions/close")
def close_position(body: CloseBody) -> dict:
    """frequi-style force exit: close one position (whole structure for options).
    Still runs the gate - closing semantics, kill switch outranks."""
    from northstar.engine import (
        DEFAULT_GUARDRAILS,
        build_context_and_snapshot,
        gate_and_execute,
        new_summary,
    )
    from northstar.manual import plan_manual_close

    store = get_store()
    ctx, snap, clock = build_context_and_snapshot(store)
    pair = plan_manual_close(ctx.positions, body.symbol.upper().strip())
    if pair is None:
        return {"ok": False, "error": f"no closable position for {body.symbol}"}
    proposal, order = pair
    guardrails = ctx.plan.guardrails if ctx.plan else DEFAULT_GUARDRAILS
    summary = new_summary(False, clock["is_open"], "manual-close")
    gate_and_execute(store, None, proposal, order, snap, guardrails, clock["is_open"],
                     dry_run=False, execute_wait=45, summary=summary, bucket="exits")
    outcome = ("executed" if summary["exits"] else
               "needs_human" if summary["needs_human"] else
               "rejected" if summary["rejected"] else "unknown")
    detail = summary["rejected"][0] if outcome == "rejected" and summary["rejected"] else None
    return {"ok": outcome != "rejected", "outcome": outcome, "human": order.human, "detail": detail}


@router.get("/engine/pass-progress")
def pass_progress() -> dict:
    """Which workflow node the current/last pass is in (cockpit live graph)."""
    return {"progress": get_store().get("state", "pass_progress")}


@router.get("/market/bars")
def market_bars(symbol: str, days: int = 130) -> dict:
    """Daily OHLCV for the cockpit chart (read-only, 10-min cache)."""
    from northstar.market_view import bars_rows, valid_symbol

    sym = symbol.upper().strip()
    if not valid_symbol(sym):
        return {"symbol": sym, "bars": [], "error": "bad symbol"}
    try:
        return {"symbol": sym, "bars": bars_rows(sym, days=min(max(days, 20), 500))}
    except Exception as e:
        return {"symbol": sym, "bars": [], "error": f"{type(e).__name__}: {e}"}


@router.get("/market/fills")
def market_fills(symbol: str) -> dict:
    """Our own journaled fills for one underlying - honest chart markers."""
    from northstar.market_view import fills_markers, valid_symbol

    sym = symbol.upper().strip()
    if not valid_symbol(sym):
        return {"symbol": sym, "markers": []}
    events = get_store().events(kinds=["fill"], limit=500)
    return {"symbol": sym, "markers": fills_markers(events, sym)}


@router.get("/equity-history")
def equity_history() -> dict:
    """Account equity curve (Alpaca portfolio history, nightly points fallback)."""
    from northstar.market_view import equity_points

    return equity_points()


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
        "frozen_symbols": controls.get("frozen_symbols", []),
        "plan": plan.model_dump() if plan else None,
        "goal": goal.model_dump() if goal else None,
    }


class RunOnceBody(BaseModel):
    dry_run: bool = False


@router.post("/engine/run-once")
def run_once(body: RunOnceBody) -> dict:
    from northstar.engine import run_once as _run

    return _run(dry_run=body.dry_run)


@router.post("/engine/nightly")
def nightly_now() -> dict:
    """Manual trigger for the night watch (the scheduler runs it once per UTC day)."""
    from northstar.nightly import run_nightly

    return run_nightly(get_store())


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
