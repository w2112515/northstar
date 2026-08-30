"""TradingLoop as a Google ADK 2.x Workflow graph.

    START -> perceive -> prefilter -> triage -> signals -> compile_gate_execute
          -> explain -> record

- perceive / prefilter / signals / compile_gate_execute: deterministic nodes
  (the same engine code as the manual path - LLMs never touch the money path).
- triage / explain: Gemini Flash nodes with honest fallbacks when no key is set
  (journal marks llm=false; nothing is faked).
- HITL: the gate emits needs_human approvals to the store; the UI approval card
  decides later via decide_approval(). The workflow pass itself never blocks,
  so a 12h human timeout cannot hang the scheduler.

Data flow: nodes read/write ctx.state (JSON facts only). Non-serializable
runtime objects (DataFrames, pydantic models) live in a per-run blackboard
keyed by run_id.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any

from google.adk import Context
from google.adk.workflow import START, Workflow, node

from northstar.domain import Guardrails, JournalEvent, OrderPlan, StrategyInstance, TradeProposal
from northstar.engine import (
    DEFAULT_GUARDRAILS,
    build_context_and_snapshot,
    collect_exits,
    collect_proposals,
    gate_and_execute,
    journal_pass_summary,
    load_instances_and_bars,
    new_summary,
    process_proposal,
)
from northstar.gate import GateSnapshot
from northstar.journal import get_store
from northstar.llm import generate_json, generate_text, llm_available
from northstar.strategies.base import EngineContext


@dataclass
class PassBoard:
    """Blackboard for one workflow run (non-serializable objects)."""

    ctx: EngineContext | None = None
    snap: GateSnapshot | None = None
    guardrails: Guardrails = field(default_factory=lambda: DEFAULT_GUARDRAILS)
    instances: list[StrategyInstance] = field(default_factory=list)
    proposals: list[tuple[StrategyInstance, TradeProposal]] = field(default_factory=list)
    exits: list[tuple[TradeProposal, OrderPlan]] = field(default_factory=list)
    summary: dict[str, Any] = field(default_factory=dict)


_BOARDS: dict[str, PassBoard] = {}


def _board(ctx: Context) -> PassBoard:
    return _BOARDS[ctx.state["run_id"]]


def _progress(ctx: Context, node: str, status: str = "running") -> None:
    """Live beacon for the cockpit graph; best-effort, never affects the pass."""
    from datetime import datetime, timezone

    try:
        get_store().save("state", "pass_progress", {
            "node": node,
            "status": status,
            "run_id": str(ctx.state.get("run_id", "")),
            "reason": str(ctx.state.get("reason", "")),
            "ts": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        print(f"[adk] progress beacon failed: {type(e).__name__}: {e}")


# --------------------------------------------------------------------------- nodes

@node(name="perceive")
def perceive(ctx: Context) -> dict[str, Any]:
    _progress(ctx, "perceive")
    store = get_store()
    board = _board(ctx)
    ectx, snap, clock = build_context_and_snapshot(store)
    board.ctx, board.snap = ectx, snap
    if ectx.plan:
        board.guardrails = ectx.plan.guardrails
    facts = {
        "market_open": clock["is_open"],
        "equity": snap.equity,
        "day_pnl_pct": round(snap.equity / snap.last_equity - 1, 4) if snap.last_equity else 0.0,
        "drawdown_pct": round(snap.equity / snap.peak_equity - 1, 4) if snap.peak_equity else 0.0,
        "kill_switch": snap.kill_switch,
        "open_positions": snap.open_positions_count,
        "pending_orders": len(snap.open_order_symbols),
        "weather_score": snap.weather_score,
        "mode": "plan" if ectx.plan else "dev-default",
    }
    ctx.state.update(facts)
    return facts


@node(name="prefilter")
def prefilter(ctx: Context) -> dict[str, Any]:
    """Deterministic hard stops - anything here ends the pass before strategies run."""
    _progress(ctx, "prefilter")
    board = _board(ctx)
    kill = bool(ctx.state.get("kill_switch"))
    dd = float(ctx.state.get("drawdown_pct", 0.0))
    if kill:
        out = {"proceed": False, "prefilter_reason": "kill switch is ON"}
    elif dd <= board.guardrails.breaker_hard_dd:
        out = {"proceed": False,
               "prefilter_reason": f"hard circuit breaker ({dd:.1%} from peak)"}
    else:
        out = {"proceed": True, "prefilter_reason": ""}
    ctx.state.update(out)
    return out


@node(name="triage")
def triage(ctx: Context) -> dict[str, Any]:
    """Gemini Flash situational triage: act now or observe. Advisory only -
    it can only *reduce* activity, never bypass the gate."""
    _progress(ctx, "triage")
    s = ctx.state
    if not s.get("proceed"):
        out = {"triage_mode": "halt", "triage_reason": str(s.get("prefilter_reason", "")), "triage_llm": False}
    elif not llm_available():
        out = {
            "triage_mode": "act",
            "triage_reason": "LLM triage disabled (no GOOGLE_API_KEY) - deterministic default: proceed, gates protect.",
            "triage_llm": False,
        }
    else:
        resp = generate_json(
            "You are the triage brain of a paper-trading loop. Decide if this tick should "
            "ACT (run strategies now) or OBSERVE (skip this tick; nothing useful to do). "
            "Skipping is right when the market is closed AND there are already queued orders, "
            "or when nothing changed. Reply JSON {\"mode\": \"act\"|\"observe\", \"reason\": \"<one line>\"}.\n"
            f"Facts: market_open={s.get('market_open')}, day_pnl={s.get('day_pnl_pct')}, "
            f"drawdown_from_peak={s.get('drawdown_pct')}, open_positions={s.get('open_positions')}, "
            f"pending_orders={s.get('pending_orders')}, "
            f"market_weather_0to100={s.get('weather_score')}, trigger={s.get('reason')}."
        )
        if not resp or resp.get("mode") not in ("act", "observe"):
            out = {"triage_mode": "act",
                   "triage_reason": "triage LLM unavailable - deterministic default: proceed.",
                   "triage_llm": False}
        else:
            out = {"triage_mode": resp["mode"], "triage_reason": str(resp.get("reason", "")), "triage_llm": True}
    ctx.state.update(out)
    return out


@node(name="signals")
def signals(ctx: Context) -> dict[str, Any]:
    _progress(ctx, "signals")
    store = get_store()
    board = _board(ctx)
    board.summary = new_summary(
        bool(ctx.state.get("dry_run")), bool(ctx.state.get("market_open")),
        str(ctx.state.get("mode", "dev-default")),
    )
    if ctx.state.get("weather_score") is not None:
        board.summary["weather"] = {"score": ctx.state.get("weather_score")}
    if ctx.state.get("triage_mode") != "act":
        ctx.state["n_proposals"] = 0
        return {"n_proposals": 0}
    # exits are collected even before strategies run: risk-reduction never
    # waits on new-trade logic
    board.exits = collect_exits(store, board.ctx, board.guardrails)
    board.instances = load_instances_and_bars(store, board.ctx)
    board.proposals = collect_proposals(store, board.ctx, board.instances)
    board.summary["proposals"] = [p.id for _, p in board.proposals]
    ctx.state["n_proposals"] = len(board.proposals)
    return {"n_proposals": len(board.proposals)}


@node(name="compile_gate_execute")
def compile_gate_execute(ctx: Context) -> dict[str, Any]:
    from northstar.engine import equity_entry_prices

    _progress(ctx, "compile_gate_execute")
    store = get_store()
    board = _board(ctx)
    market_open = bool(ctx.state.get("market_open"))
    dry_run = bool(ctx.state.get("dry_run"))
    for proposal, order in board.exits:
        gate_and_execute(
            store, None, proposal, order, board.snap, board.guardrails,
            market_open, dry_run, execute_wait=90, summary=board.summary, bucket="exits",
        )
    entry_prices = equity_entry_prices(board.ctx.positions) if board.ctx else {}
    for inst, proposal in board.proposals:
        process_proposal(
            store, inst, proposal, board.snap, board.guardrails,
            market_open, dry_run,
            execute_wait=90, summary=board.summary,
            entry_prices=entry_prices,
        )
    s = board.summary
    out = {
        "n_executed": len(s.get("executed", [])),
        "n_exits": len(s.get("exits", [])),
        "n_rejected": len(s.get("rejected", [])),
        "n_needs_human": len(s.get("needs_human", [])),
        "n_compile_failed": len(s.get("compile_failed", [])),
    }
    ctx.state.update(out)
    return out


@node(name="explain")
def explain(ctx: Context) -> dict[str, Any]:
    """Plain-speak recap of the pass. Gemini when available, honest template otherwise."""
    _progress(ctx, "explain")
    board = _board(ctx)
    s = ctx.state
    summary = board.summary
    text = None
    used_llm = False
    if llm_available():
        facts = (
            f"market_open={s.get('market_open')}, triage={s.get('triage_mode')} "
            f"({s.get('triage_reason') or s.get('prefilter_reason')}), "
            f"proposals={len(summary.get('proposals', []))}, executed={s.get('n_executed')}, "
            f"position_exits={s.get('n_exits')}, "
            f"blocked={s.get('n_rejected')}, awaiting_human={s.get('n_needs_human')}, "
            f"executed_detail={summary.get('executed', [])[:4]}, "
            f"rejected_detail={summary.get('rejected', [])[:4]}"
        )
        text = generate_text(
            "Write 2-3 plain-English sentences for a beginner investor's activity feed, "
            "explaining what their autopilot just did and why. No hype, no jargon, no promises; "
            "money amounts stay factual. This is a paper (practice) account.\nFacts: " + facts
        )
        used_llm = text is not None
    if not text:
        mode = s.get("triage_mode")
        if mode == "halt":
            text = f"Autopilot paused this round: {s.get('prefilter_reason')}. No trades were made."
        elif mode == "observe":
            text = f"Autopilot looked around and chose to wait: {s.get('triage_reason')}"
        else:
            text = (
                f"Autopilot reviewed the account and made {s.get('n_executed', 0)} trade(s), "
                f"closed {s.get('n_exits', 0)} position(s), "
                f"blocked {s.get('n_rejected', 0)} idea(s) at the risk gate, and left "
                f"{s.get('n_needs_human', 0)} decision(s) for you."
            )
    ctx.state.update({"digest": text, "digest_llm": used_llm})
    return {"digest": text, "digest_llm": used_llm}


@node(name="record")
def record(ctx: Context) -> dict[str, Any]:
    _progress(ctx, "record")
    store = get_store()
    board = _board(ctx)
    journal_pass_summary(store, board.summary)
    store.append_event(
        JournalEvent(
            kind="digest",
            human=str(ctx.state.get("digest", "")),
            payload={
                "llm": bool(ctx.state.get("digest_llm")),
                "triage_llm": bool(ctx.state.get("triage_llm")),
                "triage_reason": str(ctx.state.get("triage_reason", "")),
                "summary_counts": {
                    "executed": len(board.summary.get("executed", [])),
                    "rejected": len(board.summary.get("rejected", [])),
                    "needs_human": len(board.summary.get("needs_human", [])),
                },
            },
        )
    )
    return {"done": True}


# --------------------------------------------------------------------------- workflow

def build_trading_workflow() -> Workflow:
    return Workflow(
        name="northstar_trading_loop",
        description="perceive -> prefilter -> triage -> signals -> compile/gate/execute -> explain -> record",
        edges=[
            (START, perceive),
            (perceive, prefilter),
            (prefilter, triage),
            (triage, signals),
            (signals, compile_gate_execute),
            (compile_gate_execute, explain),
            (explain, record),
        ],
    )


def _node_name(path: str) -> str:
    """'northstar_trading_loop/perceive@1' -> 'perceive'."""
    leaf = path.rsplit("/", 1)[-1]
    return leaf.split("@", 1)[0]


NODE_ORDER = ["perceive", "prefilter", "triage", "signals", "compile_gate_execute", "explain", "record"]


async def run_trading_pass(reason: str = "manual", dry_run: bool = False) -> dict[str, Any]:
    """Run one full ADK workflow pass and return the final state + summary.

    Global mutex: manual tick, scheduler, and the run-once fallback all share
    PASS_LOCK, so two passes can never interleave orders. Second caller gets
    an honest "skipped", never a queued pass.
    """
    from northstar.locks import PASS_LOCK

    if not PASS_LOCK.acquire(blocking=False):
        return {
            "workflow": "northstar_trading_loop",
            "reason": reason,
            "skipped": "another pass is already running",
        }
    try:
        return await _run_pass_locked(reason, dry_run)
    finally:
        PASS_LOCK.release()


async def _run_pass_locked(reason: str, dry_run: bool) -> dict[str, Any]:
    import time
    from datetime import datetime, timezone

    from google.adk import Runner
    from google.adk.sessions import InMemorySessionService
    from google.genai import types as gtypes

    run_id = uuid.uuid4().hex[:10]
    _BOARDS[run_id] = PassBoard()
    workflow = build_trading_workflow()

    session_service = InMemorySessionService()
    runner = Runner(agent=workflow, app_name="northstar", session_service=session_service)
    session = await session_service.create_session(
        app_name="northstar", user_id="loop",
        state={"run_id": run_id, "dry_run": dry_run, "reason": reason},
    )

    final_state: dict[str, Any] = {}
    # Node trace from the real ADK event stream (not instrumentation inside the
    # nodes): wall-clock ms between node completion events, in execution order.
    node_ms: dict[str, float] = {}
    t_last = time.monotonic()
    async for event in runner.run_async(
        user_id="loop", session_id=session.id,
        new_message=gtypes.Content(role="user", parts=[gtypes.Part(text=f"tick:{reason}")]),
    ):
        if event.actions and event.actions.state_delta:
            final_state.update(event.actions.state_delta)
        name = _node_name(event.node_info.path) if event.node_info and event.node_info.path else ""
        now = time.monotonic()
        if name in NODE_ORDER:
            node_ms[name] = node_ms.get(name, 0.0) + (now - t_last) * 1000.0
        t_last = now

    board = _BOARDS.pop(run_id, None)
    summary = board.summary if board else {}
    trace = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "reason": reason,
        "dry_run": dry_run,
        "nodes": [
            {"name": n, "ms": round(node_ms[n], 1), "llm": n in ("triage", "explain")}
            for n in NODE_ORDER if n in node_ms
        ],
        "facts": {
            "triage_mode": final_state.get("triage_mode"),
            "triage_llm": bool(final_state.get("triage_llm")),
            "n_proposals": final_state.get("n_proposals", 0),
            "n_executed": final_state.get("n_executed", 0),
            "n_exits": final_state.get("n_exits", 0),
            "n_rejected": final_state.get("n_rejected", 0),
            "n_needs_human": final_state.get("n_needs_human", 0),
            "digest_llm": bool(final_state.get("digest_llm")),
        },
    }
    try:
        get_store().append_event(
            JournalEvent(kind="trace", human=f"ADK pass trace ({reason}): "
                         + " -> ".join(n["name"] for n in trace["nodes"]), payload=trace)
        )
        get_store().save("state", "pass_progress", {
            "node": "record", "status": "done", "run_id": run_id, "reason": reason,
            "ts": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        print(f"[adk] trace journal failed: {type(e).__name__}: {e}")

    return {
        "workflow": "northstar_trading_loop",
        "reason": reason,
        "state": {k: v for k, v in final_state.items() if not k.startswith("_")},
        "summary": summary,
        "trace": trace,
    }
