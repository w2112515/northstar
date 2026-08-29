"""Risk gate: pure functions, no I/O, no LLM. The only door to the executor.

Every order plan passes through run_gate(). Output is a GateVerdict with the
full check list; rejections carry machine-readable reason codes and are
journaled by the engine as first-class events.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from northstar.domain import (
    OPTION_STRATEGY_WHITELIST,
    GateCheck,
    GateVerdict,
    Guardrails,
    OrderPlan,
    TradeProposal,
)

DEFINED_RISK_TYPES = {
    "bull_put_spread", "bear_call_spread", "bull_call_spread",
    "iron_condor", "protective_put",
}


@dataclass
class GateSnapshot:
    """Everything the gate is allowed to know. Assembled by the engine."""

    equity: float
    last_equity: float
    peak_equity: float
    market_open: bool
    kill_switch: bool = False
    consecutive_losses: int = 0
    open_positions_count: int = 0
    # symbol -> abs market value of existing exposure (stock + option collateral)
    exposure_by_underlying: dict[str, float] = field(default_factory=dict)
    # symbols (incl. option underlying prefixes) with open orders
    open_order_symbols: list[str] = field(default_factory=list)
    stock_qty_by_symbol: dict[str, float] = field(default_factory=dict)


def _check(checks: list[GateCheck], rule: str, limit: Any, actual: Any, passed: bool) -> bool:
    checks.append(GateCheck(rule=rule, limit=limit, actual=actual, passed=passed))
    return passed


def run_gate(
    order: OrderPlan,
    proposal: TradeProposal,
    snap: GateSnapshot,
    g: Guardrails,
) -> GateVerdict:
    checks: list[GateCheck] = []
    reasons: list[str] = []
    needs_human = False

    # 1. kill switch - absolute
    if not _check(checks, "kill_switch_off", "off", "on" if snap.kill_switch else "off", not snap.kill_switch):
        reasons.append("KILL_SWITCH")

    # 2. circuit breakers (drawdown from peak)
    dd = snap.equity / snap.peak_equity - 1 if snap.peak_equity > 0 else 0.0
    if not _check(checks, "breaker_hard", f"{g.breaker_hard_dd:.0%}", f"{dd:.2%}", dd > g.breaker_hard_dd):
        reasons.append("BREAKER_HARD")
    elif not _check(checks, "breaker_soft", f"{g.breaker_soft_dd:.0%}", f"{dd:.2%}", dd > g.breaker_soft_dd):
        reasons.append("BREAKER_SOFT")
        needs_human = True

    # 3. daily loss stop
    day_pnl = snap.equity / snap.last_equity - 1 if snap.last_equity > 0 else 0.0
    if not _check(checks, "daily_loss_stop", f"{g.daily_loss_stop:.0%}", f"{day_pnl:.2%}", day_pnl > g.daily_loss_stop):
        reasons.append("DAILY_LOSS_STOP")

    # 4. cooldown after consecutive losses
    if not _check(checks, "loss_cooldown", f"<{g.cooldown_after_losses}", snap.consecutive_losses,
                  snap.consecutive_losses < g.cooldown_after_losses):
        reasons.append("COOLDOWN")
        needs_human = True

    has_option_leg = any(l.asset_class == "us_option" for l in order.legs)

    # 5. options strategy whitelist
    if has_option_leg:
        ok = order.strategy_type in OPTION_STRATEGY_WHITELIST
        if not _check(checks, "options_whitelist", "whitelisted", order.strategy_type, ok):
            reasons.append("NOT_WHITELISTED")

    # 6. no naked calls - covered call must be covered
    if order.strategy_type == "covered_call":
        contracts = sum(l.qty for l in order.legs if l.side == "sell")
        shares = snap.stock_qty_by_symbol.get(proposal.underlying, 0.0)
        ok = shares >= contracts * 100
        if not _check(checks, "call_coverage", f">={contracts * 100:.0f} shares", f"{shares:.0f}", ok):
            reasons.append("NAKED_CALL_FORBIDDEN")

    # 7. defined-risk max loss per trade
    if order.strategy_type in DEFINED_RISK_TYPES:
        cap = snap.equity * g.max_loss_per_trade_pct
        ok = order.est_max_loss <= cap
        if not _check(checks, "max_loss_per_trade", f"${cap:,.0f}", f"${order.est_max_loss:,.0f}", ok):
            reasons.append("MAX_LOSS_EXCEEDED")

    # 8. CSP collateral cap
    if order.strategy_type == "cash_secured_put":
        collateral = float(order.meta.get("collateral", 0.0))
        cap = snap.equity * g.csp_collateral_cap
        ok = 0 < collateral <= cap
        if not _check(checks, "csp_collateral_cap", f"${cap:,.0f}", f"${collateral:,.0f}", ok):
            reasons.append("CSP_COLLATERAL_EXCEEDED")

    # 9. single-name concentration (new exposure + existing)
    new_exposure = _new_exposure(order)
    existing = snap.exposure_by_underlying.get(proposal.underlying, 0.0)
    cap = snap.equity * g.single_name_concentration
    if new_exposure > 0:
        ok = existing + new_exposure <= cap
        if not _check(checks, "single_name_concentration", f"${cap:,.0f}",
                      f"${existing + new_exposure:,.0f}", ok):
            reasons.append("CONCENTRATION_EXCEEDED")

    # 10. max open positions
    ok = snap.open_positions_count < g.max_open_positions
    if not _check(checks, "max_open_positions", g.max_open_positions, snap.open_positions_count, ok):
        reasons.append("TOO_MANY_POSITIONS")

    # 11. idempotency / duplicates
    dup = _is_duplicate(order, proposal.underlying, snap.open_order_symbols)
    if not _check(checks, "no_duplicate_order", "none", "duplicate" if dup else "none", not dup):
        reasons.append("DUPLICATE")

    # 12. option liquidity facts from compiler
    if has_option_leg:
        spread_pct = float(order.meta.get("spread_pct", 1.0))
        bid = float(order.meta.get("bid") or 0.0)
        ok = spread_pct <= 0.30 and bid >= 0.05
        if not _check(checks, "option_liquidity", "spread<=30%, bid>=0.05",
                      f"spread {spread_pct:.0%}, bid {bid}", ok):
            reasons.append("ILLIQUID")

    # 13. market hours: informational - closed market means the order queues
    _check(checks, "market_session", "open or queue-to-open",
           "open" if snap.market_open else "closed (queues to next open)", True)

    hard_reject = [r for r in reasons if r not in ("BREAKER_SOFT", "COOLDOWN")]
    if hard_reject:
        verdict = "rejected"
    elif needs_human:
        verdict = "needs_human"
    else:
        verdict = "approved"

    return GateVerdict(
        proposal_id=proposal.id,
        order_plan_id=order.id,
        verdict=verdict,
        checks=checks,
        reason_codes=reasons,
        decided_by="code",
    )


def _is_duplicate(order: OrderPlan, underlying: str, open_order_symbols: list[str]) -> bool:
    """Same exact symbol pending, or any pending option order on the same underlying."""
    for leg in order.legs:
        for pending in open_order_symbols:
            if leg.symbol == pending:
                return True
            if (
                leg.asset_class == "us_option"
                and leg.symbol.startswith(underlying)
                and pending.startswith(underlying)
            ):
                return True
    return False


def _new_exposure(order: OrderPlan) -> float:
    """Capital the trade puts at risk against the underlying, in $."""
    if order.strategy_type == "cash_secured_put":
        return float(order.meta.get("collateral", 0.0))
    total = 0.0
    for l in order.legs:
        if l.asset_class == "us_equity" and l.side == "buy" and l.limit_price:
            total += l.qty * l.limit_price
    return total
