"""Engine: one full pass of the trading loop, deterministic end to end.

perceive -> strategy proposals -> compile -> gate -> execute -> journal.
G3 wraps this same pass into the ADK graph and adds LLM triage/explanation;
the money path stays in this code either way.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from northstar.broker import (
    daily_bars,
    get_account_summary,
    get_clock,
    get_open_orders,
    get_positions,
)
from northstar.compiler import compile_proposal
from northstar.compiler.options import CompileError, occ_strike
from northstar.config import get_settings
from northstar.domain import (
    Goal,
    GateVerdict,
    Guardrails,
    JournalEvent,
    OrderPlan,
    Plan,
    StrategyInstance,
    TradeProposal,
)
from northstar.executor import execute_order_plan
from northstar.gate import GateSnapshot, run_gate
from northstar.journal import get_store
from northstar.strategies import catalog_entry
from northstar.strategies import momentum as momentum_prog
from northstar.strategies import wheel as wheel_prog
from northstar.strategies.base import EngineContext

PROGRAMS = {
    "wheel": wheel_prog.propose,
    "cash_secured_put": wheel_prog.propose,   # CSP-only = wheel that never holds shares
    "momentum_rotation": momentum_prog.propose,
}

DEFAULT_WEIGHTS = {"wheel": 0.5, "momentum_rotation": 0.3}
DEFAULT_GUARDRAILS = Guardrails(max_loss_per_trade_pct=0.01)


# --------------------------------------------------------------------------- state helpers

def _underlying_of(symbol: str) -> str:
    """OCC option symbol -> underlying root; equities pass through."""
    return symbol[:-15] if len(symbol) > 15 else symbol


def load_controls(store) -> dict[str, Any]:
    doc = store.get("state", "controls") or {}
    kill_file = get_settings().data_dir / "KILL"
    doc["kill_switch"] = bool(doc.get("kill_switch")) or kill_file.exists()
    return doc


def update_peak_equity(store, equity: float) -> float:
    doc = store.get("state", "portfolio") or {}
    peak = max(float(doc.get("peak_equity", 0.0)), equity)
    store.save("state", "portfolio", {**doc, "peak_equity": peak, "updated_at": datetime.now(timezone.utc).isoformat()})
    return peak


def active_plan(store) -> tuple[Plan | None, Goal | None]:
    plans = [Plan.model_validate(p) for p in store.list("plans")]
    active = [p for p in plans if p.status == "active"]
    if not active:
        return None, None
    plan = sorted(active, key=lambda p: p.created_at)[-1]
    goal_doc = store.get("goals", plan.goal_id)
    return plan, Goal.model_validate(goal_doc) if goal_doc else None


def ensure_default_instances(store) -> list[StrategyInstance]:
    docs = store.list("instances")
    if docs:
        return [StrategyInstance.model_validate(d) for d in docs]
    seeded = []
    for family in ("wheel", "momentum_rotation"):
        entry = catalog_entry(family)
        inst = StrategyInstance(
            family=family,
            strategy_type=entry["type"],
            params=dict(entry.get("default_params", {})),
            status="champion",
            version="v1",
        )
        store.save("instances", inst.id, inst.model_dump())
        seeded.append(inst)
    return seeded


# --------------------------------------------------------------------------- snapshot

def build_context_and_snapshot(store) -> tuple[EngineContext, GateSnapshot, dict[str, Any]]:
    account = get_account_summary()
    positions = get_positions()
    open_orders = get_open_orders()
    clock = get_clock()
    controls = load_controls(store)
    peak = update_peak_equity(store, account["equity"])

    exposure: dict[str, float] = {}
    stock_qty: dict[str, float] = {}
    for p in positions:
        und = _underlying_of(p["symbol"])
        if p["asset_class"] == "us_equity":
            exposure[und] = exposure.get(und, 0.0) + abs(p["market_value"])
            stock_qty[und] = stock_qty.get(und, 0.0) + p["qty"]
        elif p["asset_class"] == "us_option":
            if p["qty"] < 0 and p["symbol"][-9] == "P":
                exposure[und] = exposure.get(und, 0.0) + occ_strike(p["symbol"]) * 100 * abs(p["qty"])
            else:
                exposure[und] = exposure.get(und, 0.0) + abs(p["market_value"])

    plan, goal = active_plan(store)
    ctx = EngineContext(
        account=account, positions=positions, open_orders=open_orders, plan=plan, goal=goal
    )
    snap = GateSnapshot(
        equity=account["equity"],
        last_equity=account["last_equity"],
        peak_equity=peak,
        market_open=clock["is_open"],
        kill_switch=controls["kill_switch"],
        consecutive_losses=int((store.get("state", "portfolio") or {}).get("consecutive_losses", 0)),
        open_positions_count=len(positions),
        exposure_by_underlying=exposure,
        open_order_symbols=[o["symbol"] for o in open_orders],
        stock_qty_by_symbol=stock_qty,
    )
    return ctx, snap, clock


# --------------------------------------------------------------------------- main pass

def load_instances_and_bars(store, ctx: EngineContext) -> list[StrategyInstance]:
    """Active strategy instances + the daily bars their programs need."""
    instances = [i for i in ensure_default_instances(store) if i.enabled and i.status in ("champion", "trial")]
    bar_symbols: list[str] = []
    for inst in instances:
        bar_symbols += inst.params.get("universe", [])
        bar_symbols += inst.params.get("underlyings", [])
    ctx.bars = daily_bars(sorted(set(bar_symbols)), years=1.2) if bar_symbols else {}
    return instances


def collect_proposals(
    store, ctx: EngineContext, instances: list[StrategyInstance]
) -> list[tuple[StrategyInstance, TradeProposal]]:
    """Run strategy programs, journal every proposal."""
    weights = {a.strategy_id: a.weight for a in ctx.plan.allocations} if ctx.plan else None
    out: list[tuple[StrategyInstance, TradeProposal]] = []
    for inst in instances:
        program = PROGRAMS.get(inst.family)
        if program is None:
            continue
        weight = (
            weights.get(inst.family) if weights and inst.family in weights
            else DEFAULT_WEIGHTS.get(inst.family, 0.2)
        )
        if inst.family == "momentum_rotation":
            state = store.get("instance_state", inst.id) or {}
            if not momentum_prog.should_rebalance(state, int(inst.params.get("rebalance_days", 5))):
                continue
        for proposal in program(inst, weight, ctx):
            store.append_event(
                JournalEvent(
                    kind="proposal", human=proposal.thesis_human,
                    payload=proposal.model_dump(), refs={"proposal_id": proposal.id},
                )
            )
            out.append((inst, proposal))
    return out


def process_proposal(
    store,
    inst: StrategyInstance,
    proposal: TradeProposal,
    snap: GateSnapshot,
    guardrails: Guardrails,
    market_open: bool,
    dry_run: bool,
    execute_wait: int,
    summary: dict[str, Any],
) -> None:
    """compile -> gate -> execute/approval, all journaled. The only money path."""
    try:
        order = compile_proposal(proposal)
    except CompileError as e:
        summary["compile_failed"].append({"proposal_id": proposal.id, "reason": str(e)})
        store.append_event(
            JournalEvent(
                kind="verdict", human=f"No trade: {e}",
                payload={"verdict": "rejected", "reason_codes": ["COMPILE_FAILED"], "detail": str(e)},
                refs={"proposal_id": proposal.id},
            )
        )
        return

    verdict = run_gate(order, proposal, snap, guardrails)
    store.append_event(_verdict_event(verdict, order))

    if verdict.verdict == "approved":
        if dry_run:
            summary["executed"].append({"order_plan": order.model_dump(), "dry_run": True})
        else:
            result = execute_order_plan(order, market_open=market_open, wait_seconds=execute_wait)
            summary["executed"].append(result)
            if inst.family == "momentum_rotation":
                store.save("instance_state", inst.id,
                           {"last_rebalance": datetime.now(timezone.utc).isoformat()})
    elif verdict.verdict == "needs_human":
        approval = {
            "id": verdict.id,
            "created_at": verdict.created_at,
            "proposal": proposal.model_dump(),
            "order_plan": order.model_dump(),
            "verdict": verdict.model_dump(),
            "status": "pending",
            "expires_hours": guardrails.approval_timeout_hours,
        }
        store.save("approvals", verdict.id, approval)
        summary["needs_human"].append(verdict.id)
        store.append_event(
            JournalEvent(
                kind="approval",
                human=f"Needs your call: {order.human} Reasons: {', '.join(verdict.reason_codes)}.",
                payload=approval, refs={"proposal_id": proposal.id, "verdict_id": verdict.id},
            )
        )
    else:
        summary["rejected"].append({"proposal_id": proposal.id, "codes": verdict.reason_codes})


def new_summary(dry_run: bool, market_open: bool, mode: str) -> dict[str, Any]:
    return {
        "ts": datetime.now(timezone.utc).isoformat(),
        "dry_run": dry_run,
        "market_open": market_open,
        "mode": mode,
        "proposals": [], "rejected": [], "executed": [], "needs_human": [], "compile_failed": [],
    }


def journal_pass_summary(store, summary: dict[str, Any]) -> None:
    store.append_event(
        JournalEvent(
            kind="system",
            human=(
                f"Loop pass done ({summary['mode']}, {'dry-run' if summary['dry_run'] else 'live paper'}): "
                f"{len(summary['proposals'])} proposals, {len(summary['executed'])} executed, "
                f"{len(summary['needs_human'])} awaiting you, {len(summary['rejected'])} blocked."
            ),
            payload={k: v for k, v in summary.items() if k != "proposals"},
        )
    )


def run_once(dry_run: bool = False, execute_wait: int = 90) -> dict[str, Any]:
    """One deterministic pass (manual trigger / fallback path without ADK)."""
    store = get_store()
    ctx, snap, clock = build_context_and_snapshot(store)
    guardrails = ctx.plan.guardrails if ctx.plan else DEFAULT_GUARDRAILS

    instances = load_instances_and_bars(store, ctx)
    summary = new_summary(dry_run, clock["is_open"], "plan" if ctx.plan else "dev-default")

    for inst, proposal in collect_proposals(store, ctx, instances):
        summary["proposals"].append(proposal.id)
        process_proposal(store, inst, proposal, snap, guardrails,
                         clock["is_open"], dry_run, execute_wait, summary)

    journal_pass_summary(store, summary)
    return summary


def _verdict_event(verdict: GateVerdict, order: OrderPlan) -> JournalEvent:
    if verdict.verdict == "approved":
        human = f"Green light ({len(verdict.checks)} checks passed): {order.human}"
    elif verdict.verdict == "needs_human":
        human = f"Held for your approval ({', '.join(verdict.reason_codes)}): {order.human}"
    else:
        failed = [c for c in verdict.checks if not c.passed]
        detail = f" [{failed[0].rule}: {failed[0].actual} vs limit {failed[0].limit}]" if failed else ""
        human = f"Blocked by {', '.join(verdict.reason_codes)}{detail}: {order.human}"
    return JournalEvent(
        kind="verdict", human=human, payload=verdict.model_dump(),
        refs={"proposal_id": verdict.proposal_id, "order_plan_id": verdict.order_plan_id or ""},
    )


# --------------------------------------------------------------------------- human approval path

def decide_approval(approval_id: str, approve: bool, execute_wait: int = 90) -> dict[str, Any]:
    store = get_store()
    doc = store.get("approvals", approval_id)
    if not doc or doc.get("status") != "pending":
        return {"ok": False, "error": "approval not found or already decided"}

    order = OrderPlan.model_validate(doc["order_plan"])
    proposal = TradeProposal.model_validate(doc["proposal"])

    if not approve:
        doc["status"] = "rejected_by_human"
        store.save("approvals", approval_id, doc)
        store.append_event(
            JournalEvent(kind="approval", human=f"You said no - dropped: {order.human}",
                         payload=doc, refs={"proposal_id": proposal.id}))
        return {"ok": True, "decision": "rejected"}

    # re-check hard rules against a fresh snapshot before executing
    ctx, snap, clock = build_context_and_snapshot(store)
    guardrails = ctx.plan.guardrails if ctx.plan else DEFAULT_GUARDRAILS
    verdict = run_gate(order, proposal, snap, guardrails)
    if verdict.verdict == "rejected":
        doc["status"] = "rejected_on_recheck"
        store.save("approvals", approval_id, doc)
        store.append_event(_verdict_event(verdict, order))
        return {"ok": True, "decision": "rejected_on_recheck", "codes": verdict.reason_codes}

    doc["status"] = "approved_by_human"
    store.save("approvals", approval_id, doc)
    result = execute_order_plan(order, market_open=clock["is_open"], wait_seconds=execute_wait)
    store.append_event(
        JournalEvent(kind="approval", human=f"You approved - sent: {order.human}",
                     payload={"approval": doc, "result": result}, refs={"proposal_id": proposal.id}))
    return {"ok": True, "decision": "approved", "result": result}
