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

from northstar.domain import Guardrails, JournalEvent, StrategyInstance, TradeProposal
from northstar.engine import (
    DEFAULT_GUARDRAILS,
    build_context_and_snapshot,
    collect_proposals,
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
    summary: dict[str, Any] = field(default_factory=dict)


_BOARDS: dict[str, PassBoard] = {}


def _board(ctx: Context) -> PassBoard:
    return _BOARDS[ctx.state["run_id"]]


# --------------------------------------------------------------------------- nodes

@node(name="perceive")
def perceive(ctx: Context) -> dict[str, Any]:
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
        "mode": "plan" if ectx.plan else "dev-default",
    }
    ctx.state.update(facts)
    return facts


@node(name="prefilter")
def prefilter(ctx: Context) -> dict[str, Any]:
    """Deterministic hard stops - anything here ends the pass before strategies run."""
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
            f"pending_orders={s.get('pending_orders')}, trigger={s.get('reason')}."
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
    store = get_store()
    board = _board(ctx)
    board.summary = new_summary(
        bool(ctx.state.get("dry_run")), bool(ctx.state.get("market_open")),
        str(ctx.state.get("mode", "dev-default")),
    )
    if ctx.state.get("triage_mode") != "act":
        ctx.state["n_proposals"] = 0
        return {"n_proposals": 0}
    board.instances = load_instances_and_bars(store, board.ctx)
    board.proposals = collect_proposals(store, board.ctx, board.instances)
    board.summary["proposals"] = [p.id for _, p in board.proposals]
    ctx.state["n_proposals"] = len(board.proposals)
    return {"n_proposals": len(board.proposals)}


@node(name="compile_gate_execute")
def compile_gate_execute(ctx: Context) -> dict[str, Any]:
    store = get_store()
    board = _board(ctx)
    for inst, proposal in board.proposals:
        process_proposal(
            store, inst, proposal, board.snap, board.guardrails,
            bool(ctx.state.get("market_open")), bool(ctx.state.get("dry_run")),
            execute_wait=90, summary=board.summary,
        )
    s = board.summary
    out = {
        "n_executed": len(s.get("executed", [])),
        "n_rejected": len(s.get("rejected", [])),
        "n_needs_human": len(s.get("needs_human", [])),
        "n_compile_failed": len(s.get("compile_failed", [])),
    }
    ctx.state.update(out)
    return out


@node(name="explain")
def explain(ctx: Context) -> dict[str, Any]:
    """Plain-speak recap of the pass. Gemini when available, honest template otherwise."""
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
                f"blocked {s.get('n_rejected', 0)} idea(s) at the risk gate, and left "
                f"{s.get('n_needs_human', 0)} decision(s) for you."
            )
    ctx.state.update({"digest": text, "digest_llm": used_llm})
    return {"digest": text, "digest_llm": used_llm}


@node(name="record")
def record(ctx: Context) -> dict[str, Any]:
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


async def run_trading_pass(reason: str = "manual", dry_run: bool = False) -> dict[str, Any]:
    """Run one full ADK workflow pass and return the final state + summary."""
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
    async for event in runner.run_async(
        user_id="loop", session_id=session.id,
        new_message=gtypes.Content(role="user", parts=[gtypes.Part(text=f"tick:{reason}")]),
    ):
        if event.actions and event.actions.state_delta:
            final_state.update(event.actions.state_delta)

    board = _BOARDS.pop(run_id, None)
    return {
        "workflow": "northstar_trading_loop",
        "reason": reason,
        "state": {k: v for k, v in final_state.items() if not k.startswith("_")},
        "summary": board.summary if board else {},
    }
