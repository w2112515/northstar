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
from northstar.compiler import LIVE_COMPILABLE, compile_proposal
from northstar.compiler.options import CompileError, occ_strike
from northstar.earnings import prune_past
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
from northstar.executor import execute_order_plan, sweep_stale_orders
from northstar.exits import plan_exits
from northstar.gate import GateSnapshot, run_gate
from northstar.journal import get_store
from northstar.locks import APPROVAL_LOCK, PASS_LOCK
from northstar.notify import notify_approval
from northstar.strategies import analyst as analyst_prog
from northstar.strategies import catalog_entry
from northstar.strategies import dsl_rotation as dsl_prog
from northstar.strategies import macross as macross_prog
from northstar.strategies import meanrev as meanrev_prog
from northstar.strategies import momentum as momentum_prog
from northstar.strategies import spreads as spreads_prog
from northstar.strategies import wheel as wheel_prog
from northstar.pnl import reconcile_vanished
from northstar.strategies.base import EngineContext
from northstar.weather import get_weather

PROGRAMS = {
    # wheel program serves all three single-leg income families (mode = strategy_type)
    "wheel": wheel_prog.propose,
    "cash_secured_put": wheel_prog.propose,
    "covered_call": wheel_prog.propose,
    # defined-risk spreads share one program (shape = strategy_type)
    "bull_put_spread": spreads_prog.propose,
    "bear_call_spread": spreads_prog.propose,
    "iron_condor": spreads_prog.propose,
    "bull_call_spread": spreads_prog.propose,
    # equities
    "momentum_rotation": momentum_prog.propose,
    "rsi_mean_reversion": meanrev_prog.propose,
    "ma_cross_trend": macross_prog.propose,
    # shipyard-built rotation specs (structural evolution output)
    "dsl_rotation": dsl_prog.propose,
    # AI (proposes like any strategy; silent without a key)
    "ai_analyst": analyst_prog.propose,
}

DEFAULT_WEIGHTS = {"wheel": 0.5, "momentum_rotation": 0.3}
TRIAL_WEIGHT = 0.1  # allocation cap for instances on paper trial
DEFAULT_GUARDRAILS = Guardrails(max_loss_per_trade_pct=0.01)

# Families whose proposals carry a different strategy_type than the family name.
_FAMILY_STRATEGY_TYPES = {"wheel": ("cash_secured_put", "covered_call")}


def family_live(family: str) -> bool:
    """Can this family's proposals compile into real orders today?"""
    types = _FAMILY_STRATEGY_TYPES.get(family, (family,))
    return any(t in LIVE_COMPILABLE for t in types)

# Equity rotation sleeves get a hard budget at the gate: existing sleeve value
# + new buy must stay under weight * equity * slack. The slack absorbs honest
# appreciation drift; without it, winners would block their own rebalance.
EQUITY_SLEEVE_FAMILIES = ("momentum_rotation", "rsi_mean_reversion", "ma_cross_trend", "dsl_rotation")
SLEEVE_SLACK = 1.10


def family_weight(family: str, plan: Plan | None) -> float:
    """One source of truth for a family's allocation weight (plan first)."""
    if plan:
        for a in plan.allocations:
            if a.strategy_id == family:
                return a.weight
    return DEFAULT_WEIGHTS.get(family, 0.2)


def sleeve_accounting(
    store, plan: Plan | None, equity: float, positions: list[dict[str, Any]]
) -> tuple[dict[str, float], dict[str, float]]:
    """Per-family $ budget and current $ exposure for equity rotation sleeves.

    Exposure attribution: an equity position belongs to a family when its
    symbol is in that family's trading universe - including the scout pool for
    scout-enabled families, so radar buys count against the budget too.
    Overlapping universes count the position in both sleeves - conservative
    on purpose.
    """
    from northstar.scout import scout_recent_pool, scout_symbols

    scout_pool = set(scout_symbols(store)) | set(scout_recent_pool(store))
    budgets: dict[str, float] = {}
    exposure: dict[str, float] = {}
    for doc in store.list("instances"):
        fam = str(doc.get("family", ""))
        if fam not in EQUITY_SLEEVE_FAMILIES:
            continue
        if not doc.get("enabled", True) or doc.get("status") not in ("champion", "trial"):
            continue
        weight = family_weight(fam, plan)
        if doc.get("status") == "trial":
            weight = min(weight, TRIAL_WEIGHT)
        params = doc.get("params") or {}
        universe = set(params.get("universe", []))
        if params.get("use_scout", True):
            universe |= scout_pool
        held = sum(
            abs(float(p["market_value"]))
            for p in positions
            if p["asset_class"] == "us_equity" and p["symbol"] in universe
        )
        budgets[fam] = max(budgets.get(fam, 0.0), equity * weight * SLEEVE_SLACK)
        exposure[fam] = max(exposure.get(fam, 0.0), held)
    return budgets, exposure


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

def exposure_and_stock_qty(
    positions: list[dict[str, Any]],
) -> tuple[dict[str, float], dict[str, float]]:
    """Per-underlying deployed capital (stock value + short-put collateral +
    option market value) and per-symbol stock quantity. One definition,
    shared by the gate snapshot and the cockpit's risk readout."""
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
    return exposure, stock_qty


def deployed_risk(positions: list[dict[str, Any]]) -> float:
    """Whole-book capital at risk, structure-aware.

    Stocks count at market value, defined-risk option structures at their real
    max loss (width - entry credit), lone short puts at cash-secured collateral.
    This is the number the gate's portfolio_deployed_cap checks - unlike the
    concentration map, hedged wings must NOT be booked as naked collateral, or
    one SPY spread would "fill" the whole account.
    """
    from northstar.exits import _classify, _group_structures, occ_type

    total = sum(abs(p["market_value"]) for p in positions if p["asset_class"] == "us_equity")
    for legs in _group_structures(positions):
        classified = _classify(legs)
        shape = classified[0] if classified else None
        if shape in ("vertical", "condor"):
            contracts = min(abs(float(l["qty"])) for l in legs)
            entry = 0.0
            have_entries = True
            for l in legs:
                e = l.get("avg_entry_price")
                if not e:
                    have_entries = False
                    break
                entry += (1.0 if float(l["qty"]) < 0 else -1.0) * float(e)
            put_strikes = sorted(occ_strike(l["symbol"]) for l in legs if occ_type(l["symbol"]) == "P")
            call_strikes = sorted(occ_strike(l["symbol"]) for l in legs if occ_type(l["symbol"]) == "C")
            width = max(
                put_strikes[-1] - put_strikes[0] if len(put_strikes) >= 2 else 0.0,
                call_strikes[-1] - call_strikes[0] if len(call_strikes) >= 2 else 0.0,
            )
            # credit structure: risk = width - credit; debit structure (net
            # entry < 0): risk = the debit paid; missing entries: full width
            if not have_entries:
                risk_per_share = width
            elif entry >= 0:
                risk_per_share = max(width - entry, 0.0)
            else:
                risk_per_share = -entry
            total += min(risk_per_share, width) * 100 * contracts
        else:
            # lone shorts, odd shapes, long-only: short puts at collateral,
            # everything else at |market value| - conservative on purpose
            for l in legs:
                if float(l["qty"]) < 0 and occ_type(l["symbol"]) == "P":
                    total += occ_strike(l["symbol"]) * 100 * abs(float(l["qty"]))
                else:
                    total += abs(float(l.get("market_value") or 0.0))
    return total


def _orders_sent_today(store) -> int:
    today = datetime.now(timezone.utc).date().isoformat()
    return sum(1 for ev in store.events(kinds=["order"], limit=500)
               if ev.ts.startswith(today) and "Order sent" in ev.human)


def build_context_and_snapshot(store) -> tuple[EngineContext, GateSnapshot, dict[str, Any]]:
    account = get_account_summary()
    positions = get_positions()
    open_orders = get_open_orders()
    clock = get_clock()
    controls = load_controls(store)
    peak = update_peak_equity(store, account["equity"])
    # book expiries/assignments/manual closes that happened since the last pass
    reconcile_vanished(store, positions)

    exposure, stock_qty = exposure_and_stock_qty(positions)

    plan, goal = active_plan(store)
    weather = get_weather(store)
    sleeve_budget, sleeve_exposure = sleeve_accounting(store, plan, account["equity"], positions)
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
        orders_today=_orders_sent_today(store),
        frozen_symbols=list(controls.get("frozen_symbols", [])),
        options_level=int(account.get("options_level") or 0),
        weather_score=weather.get("score") if weather else None,
        sleeve_budget_by_family=sleeve_budget,
        sleeve_exposure_by_family=sleeve_exposure,
        earnings_by_underlying=prune_past(store),
        today_iso=datetime.now(timezone.utc).date().isoformat(),
        deployed_risk=deployed_risk(positions),
    )
    return ctx, snap, clock


# --------------------------------------------------------------------------- main pass

def load_instances_and_bars(store, ctx: EngineContext) -> list[StrategyInstance]:
    """Active strategy instances + the daily bars their programs need."""
    from northstar.scout import options_watch_symbols, scout_recent_pool, scout_symbols
    from northstar.watchlist import manual_history, manual_symbols

    instances = [i for i in ensure_default_instances(store) if i.enabled and i.status in ("champion", "trial")]
    ctx.scout_symbols = scout_symbols(store)
    ctx.scout_recent_pool = scout_recent_pool(store)
    ctx.manual_symbols = manual_symbols(store)
    ctx.manual_history = manual_history(store)
    ctx.options_watch = options_watch_symbols(store)
    bar_symbols: list[str] = (
        list(ctx.scout_symbols) + list(ctx.scout_recent_pool)
        + list(ctx.manual_symbols) + list(ctx.options_watch)
    )
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
        if not family_live(inst.family):
            continue  # backtest-only family (A-milestone): keep it out of the live pipeline
        weight = (
            weights.get(inst.family) if weights and inst.family in weights
            else DEFAULT_WEIGHTS.get(inst.family, 0.2)
        )
        if inst.status == "trial":
            weight = min(weight, TRIAL_WEIGHT)  # paper trials run small until they earn champion
        if inst.family == "momentum_rotation":
            state = store.get("instance_state", inst.id) or {}
            if not momentum_prog.should_rebalance(state, int(inst.params.get("rebalance_days", 5))):
                continue
        if inst.family == "dsl_rotation":
            state = store.get("instance_state", inst.id) or {}
            spec_reb = int(((inst.params.get("spec") or {}).get("rebalance_days")) or 5)
            if not momentum_prog.should_rebalance(state, spec_reb):
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
    entry_prices: dict[str, float] | None = None,
) -> None:
    """compile -> gate -> execute/approval, all journaled. The only money path."""
    try:
        order = compile_proposal(proposal)
        _annotate_equity_close(order, proposal, inst, entry_prices)
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

    gate_and_execute(store, inst, proposal, order, snap, guardrails,
                     market_open, dry_run, execute_wait, summary)


def _pending_duplicate(store, proposal: TradeProposal, order: OrderPlan) -> str | None:
    """Id of a pending approval already asking the same question
    (same underlying, same structure), else None."""
    for doc in store.list("approvals"):
        if doc.get("status") != "pending":
            continue
        if (doc.get("proposal") or {}).get("underlying") != proposal.underlying:
            continue
        if (doc.get("order_plan") or {}).get("strategy_type") == order.strategy_type:
            return str(doc.get("id"))
    return None


def gate_and_execute(
    store,
    inst: StrategyInstance | None,
    proposal: TradeProposal,
    order: OrderPlan,
    snap: GateSnapshot,
    guardrails: Guardrails,
    market_open: bool,
    dry_run: bool,
    execute_wait: int,
    summary: dict[str, Any],
    bucket: str = "executed",
) -> None:
    """gate -> execute/approval for a ready OrderPlan. Shared by strategy
    proposals (bucket=executed) and the exit manager (bucket=exits)."""
    verdict = run_gate(order, proposal, snap, guardrails)
    store.append_event(_verdict_event(verdict, order))

    if verdict.verdict == "approved":
        if dry_run:
            summary[bucket].append({"order_plan": order.model_dump(), "dry_run": True})
        else:
            result = execute_order_plan(order, market_open=market_open, wait_seconds=execute_wait)
            summary[bucket].append(result)
            if inst is not None and inst.family in ("momentum_rotation", "dsl_rotation"):
                # Start the rebalance clock only once a BUY fills. Sells,
                # canceled submissions and queued orders must not consume it:
                # a sell-only or partially-filled rotation has to keep retrying
                # next pass, or the sleeve strands in cash for rebalance_days.
                # The clock's one job is damping rank-flap churn, and churn
                # only becomes possible after a buy fills.
                filled_buy = any(
                    e.get("status") == "filled" and (e.get("leg") or {}).get("side") == "buy"
                    for e in (result.get("legs") or [])
                )
                if filled_buy:
                    store.save("instance_state", inst.id,
                               {"last_rebalance": datetime.now(timezone.utc).isoformat()})
    elif verdict.verdict == "needs_human":
        # One live card per question. While a needs_human condition persists
        # (weather storm, soft breaker, cooldown), strategies re-propose the
        # same trade every pass - without this check the human would get a
        # fresh duplicate card every 15 minutes until the 12h expiry sweeper.
        dup = _pending_duplicate(store, proposal, order)
        if dup is not None:
            summary["needs_human"].append(dup)
            return
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
        # Push to the operator's phone (fire-and-forget; timeout is the safety
        # net, so a lost push costs convenience, never correctness).
        notify_approval(order.human, verdict.reason_codes, guardrails.approval_timeout_hours)
    else:
        summary["rejected"].append({"proposal_id": proposal.id, "codes": verdict.reason_codes})


def collect_exits(store, ctx: EngineContext, guardrails: Guardrails) -> list[tuple[TradeProposal, OrderPlan]]:
    """Exit manager pass: journal every exit proposal, return (proposal, order) pairs."""
    pairs = plan_exits(ctx.positions, [o["symbol"] for o in ctx.open_orders], guardrails)
    for proposal, _ in pairs:
        store.append_event(
            JournalEvent(
                kind="proposal", human=proposal.thesis_human,
                payload=proposal.model_dump(), refs={"proposal_id": proposal.id},
            )
        )
    return pairs


def _annotate_equity_close(
    order: OrderPlan,
    proposal: TradeProposal,
    inst: StrategyInstance,
    entry_prices: dict[str, float] | None,
) -> None:
    """Equity strategy exits (action=sell) carry their entry basis so the
    executor books exact realized P&L on fill."""
    if proposal.params.get("action") != "sell" or not entry_prices:
        return
    entry = entry_prices.get(proposal.underlying)
    if not entry:
        return
    order.meta.update(
        {
            "closing": True,
            "entry_price": float(entry),
            "signed_qty": float(proposal.params.get("qty", 0)),
            "pnl_multiplier": 1,
            "family": inst.family,
        }
    )


def equity_entry_prices(positions: list[dict[str, Any]]) -> dict[str, float]:
    return {
        p["symbol"]: float(p["avg_entry_price"])
        for p in positions
        if p["asset_class"] == "us_equity" and p.get("avg_entry_price")
    }


def new_summary(dry_run: bool, market_open: bool, mode: str) -> dict[str, Any]:
    return {
        "ts": datetime.now(timezone.utc).isoformat(),
        "dry_run": dry_run,
        "market_open": market_open,
        "mode": mode,
        "proposals": [], "rejected": [], "executed": [], "needs_human": [],
        "compile_failed": [], "exits": [],
    }


def journal_pass_summary(store, summary: dict[str, Any]) -> None:
    store.append_event(
        JournalEvent(
            kind="system",
            human=(
                f"Loop pass done ({summary['mode']}, {'dry-run' if summary['dry_run'] else 'live paper'}): "
                f"{len(summary['proposals'])} proposals, {len(summary['executed'])} executed, "
                f"{len(summary.get('exits', []))} exits, "
                f"{len(summary['needs_human'])} awaiting you, {len(summary['rejected'])} blocked."
            ),
            payload={k: v for k, v in summary.items() if k != "proposals"},
        )
    )


def run_once(dry_run: bool = False, execute_wait: int = 90) -> dict[str, Any]:
    """One deterministic pass (manual trigger / fallback path without ADK)."""
    if not PASS_LOCK.acquire(blocking=False):
        return {"skipped": "another pass is already running", "dry_run": dry_run}
    try:
        return _run_once_locked(dry_run, execute_wait)
    finally:
        PASS_LOCK.release()


def _run_once_locked(dry_run: bool, execute_wait: int) -> dict[str, Any]:
    store = get_store()
    ctx, snap, clock = build_context_and_snapshot(store)
    guardrails = ctx.plan.guardrails if ctx.plan else DEFAULT_GUARDRAILS

    instances = load_instances_and_bars(store, ctx)
    summary = new_summary(dry_run, clock["is_open"], "plan" if ctx.plan else "dev-default")
    weather = get_weather(store)  # cache hit - fetched during snapshot build
    if weather:
        summary["weather"] = {"score": weather.get("score"), "bucket": weather.get("bucket")}

    if not dry_run:
        sweep_stale_orders()

    # exits first: risk-reducing orders free capital before new entries
    for proposal, order in collect_exits(store, ctx, guardrails):
        gate_and_execute(store, None, proposal, order, snap, guardrails,
                         clock["is_open"], dry_run, execute_wait, summary, bucket="exits")

    entry_prices = equity_entry_prices(ctx.positions)
    for inst, proposal in collect_proposals(store, ctx, instances):
        summary["proposals"].append(proposal.id)
        process_proposal(store, inst, proposal, snap, guardrails,
                         clock["is_open"], dry_run, execute_wait, summary,
                         entry_prices=entry_prices)

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

def expire_stale_approvals(store) -> list[str]:
    """Timeout = automatic no. Makes the UI's promise real; runs every scheduler
    minute regardless of autopilot state."""
    now = datetime.now(timezone.utc)
    expired: list[str] = []
    for doc in store.list("approvals"):
        if doc.get("status") != "pending":
            continue
        try:
            created = datetime.fromisoformat(doc["created_at"])
            hours = float(doc.get("expires_hours", 12))
        except (KeyError, ValueError, TypeError):
            continue
        if (now - created).total_seconds() < hours * 3600:
            continue
        doc["status"] = "expired_timeout"
        store.save("approvals", doc["id"], doc)
        human = str((doc.get("order_plan") or {}).get("human", ""))
        store.append_event(
            JournalEvent(
                kind="approval",
                human=f"No answer in {hours:.0f}h - auto-rejected as promised: {human}",
                payload=doc,
                refs={"verdict_id": doc.get("id", "")},
            )
        )
        expired.append(doc["id"])
    return expired


def decide_approval(approval_id: str, approve: bool, execute_wait: int = 90) -> dict[str, Any]:
    store = get_store()

    # Atomic flip first: whoever wins this lock owns the decision. A double
    # click or two concurrent requests can never execute the same order twice.
    with APPROVAL_LOCK:
        doc = store.get("approvals", approval_id)
        if not doc or doc.get("status") != "pending":
            return {"ok": False, "error": "approval not found or already decided"}
        doc["status"] = "approved_by_human" if approve else "rejected_by_human"
        store.save("approvals", approval_id, doc)

    order = OrderPlan.model_validate(doc["order_plan"])
    proposal = TradeProposal.model_validate(doc["proposal"])

    if not approve:
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

    try:
        result = execute_order_plan(order, market_open=clock["is_open"], wait_seconds=execute_wait)
    except Exception as e:
        store.append_event(
            JournalEvent(kind="system",
                         human=f"You approved, but the order submit failed: {order.human} ({e})",
                         payload={"approval": doc, "error": str(e)},
                         refs={"proposal_id": proposal.id}))
        return {"ok": False, "decision": "approved", "error": str(e)}
    store.append_event(
        JournalEvent(kind="approval", human=f"You approved - sent: {order.human}",
                     payload={"approval": doc, "result": result}, refs={"proposal_id": proposal.id}))
    return {"ok": True, "decision": "approved", "result": result}
