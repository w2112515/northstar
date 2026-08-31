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
    orders_today: int = 0                  # orders already sent this UTC day
    frozen_symbols: list[str] = field(default_factory=list)  # per-name kill switch
    options_level: int = 0                 # account options approval (3 = multi-leg)
    weather_score: int | None = None       # market weather index 0-100; None = offline
    # earnings calendar (manual, honest: empty = no data, checks pass and say so)
    earnings_by_underlying: dict[str, str] = field(default_factory=dict)  # SYM -> ISO date
    today_iso: str = ""                    # engine-injected UTC date for pure-function date math
    # whole-book capital at risk (structure-aware: spreads at max loss, lone
    # short puts at collateral, stock at value) - engine.deployed_risk()
    deployed_risk: float = 0.0
    # equity rotation sleeves: family -> $ budget (weight*equity*slack) and
    # family -> current $ exposure across that family's trading universe
    sleeve_budget_by_family: dict[str, float] = field(default_factory=dict)
    sleeve_exposure_by_family: dict[str, float] = field(default_factory=dict)


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
    # Closing orders reduce risk: rules that exist to stop NEW risk step aside
    # (visibly - the check list says so). Kill switch stays absolute.
    closing = bool(order.meta.get("closing"))
    if closing:
        _check(checks, "closing_order", "risk-reducing", "closing", True)

    # 1. kill switch - absolute
    if not _check(checks, "kill_switch_off", "off", "on" if snap.kill_switch else "off", not snap.kill_switch):
        reasons.append("KILL_SWITCH")

    if not closing:
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

        # 4b. per-name freeze list (granular kill switch; frozen names may still close)
        frozen = proposal.underlying.upper() in {s.upper() for s in snap.frozen_symbols}
        if not _check(checks, "symbol_not_frozen", "not frozen", "frozen" if frozen else "not frozen", not frozen):
            reasons.append("SYMBOL_FROZEN")

        # 4c. order rate limit per UTC day
        if not _check(checks, "order_rate_limit", f"<{g.max_orders_per_day}/day", snap.orders_today,
                      snap.orders_today < g.max_orders_per_day):
            reasons.append("ORDER_RATE_LIMIT")

        # 4d. market weather floor (soft): storms pause NEW risk, never exits.
        # Offline instruments never block - the check passes and says so.
        opens_risk = any(
            l.asset_class == "us_option" or (l.asset_class == "us_equity" and l.side == "buy")
            for l in order.legs
        )
        if opens_risk:
            if snap.weather_score is None:
                _check(checks, "weather_floor", f">={g.weather_floor}", "offline", True)
            elif not _check(checks, "weather_floor", f">={g.weather_floor}", snap.weather_score,
                            snap.weather_score >= g.weather_floor):
                reasons.append("WEATHER_STORM")
                needs_human = True

    option_legs = [l for l in order.legs if l.asset_class == "us_option"]
    has_option_leg = bool(option_legs)

    # 5. options strategy whitelist
    if has_option_leg:
        ok = order.strategy_type in OPTION_STRATEGY_WHITELIST
        if not _check(checks, "options_whitelist", "whitelisted", order.strategy_type, ok):
            reasons.append("NOT_WHITELISTED")

    # 5b. multi-leg orders need options approval level 3
    if len(option_legs) >= 2:
        ok = snap.options_level >= 3
        if not _check(checks, "options_level", ">=3 (multi-leg)", snap.options_level, ok):
            reasons.append("OPTIONS_LEVEL_TOO_LOW")

    # 5c. earnings blackout: no NEW short premium through a known earnings date.
    # Earnings are scheduled volatility events; premium sellers step aside.
    # No calendar entry = the check passes and says so (honest, never guessed).
    short_option_legs = [l for l in option_legs if l.side == "sell"]
    if short_option_legs and not closing:
        edate = snap.earnings_by_underlying.get(proposal.underlying.upper(), "")
        if edate and snap.today_iso:
            latest_exp = max(_occ_expiry_iso(l.symbol) for l in short_option_legs)
            blocked = snap.today_iso <= edate <= latest_exp
            if not _check(checks, "earnings_blackout",
                          f"no earnings inside {snap.today_iso}..{latest_exp}", edate, not blocked):
                reasons.append("EARNINGS_BLACKOUT")
        else:
            _check(checks, "earnings_blackout", "known earnings date", "no data", True)

    if not closing:
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

        # 9b. fat-finger guard: single equity order notional cap
        buy_notional = sum(
            l.qty * l.limit_price for l in order.legs
            if l.asset_class == "us_equity" and l.side == "buy" and l.limit_price
        )
        if buy_notional > 0:
            cap = snap.equity * g.max_order_notional_pct
            ok = buy_notional <= cap
            if not _check(checks, "order_notional_cap", f"${cap:,.0f}", f"${buy_notional:,.0f}", ok):
                reasons.append("ORDER_NOTIONAL_EXCEEDED")

        # 9c. per-family sleeve budget: an equity rotation family can never
        # grow past its plan weight (plus drift slack), no matter how many
        # rebalances or partial fills happen between passes.
        sleeve_cap = snap.sleeve_budget_by_family.get(order.strategy_type)
        if sleeve_cap is not None and buy_notional > 0:
            held = snap.sleeve_exposure_by_family.get(order.strategy_type, 0.0)
            ok = held + buy_notional <= sleeve_cap
            if not _check(checks, "sleeve_budget", f"${sleeve_cap:,.0f}",
                          f"${held + buy_notional:,.0f}", ok):
                reasons.append("SLEEVE_BUDGET_EXCEEDED")

        # 9d. whole-book deployment cap: capital already at risk (structure-
        # aware, spreads at max loss) plus this trade. Per-name/per-family caps
        # bound each sleeve; this is the backstop against correlated stacking.
        if new_exposure > 0:
            cap = snap.equity * g.portfolio_deployed_cap
            ok = snap.deployed_risk + new_exposure <= cap
            if not _check(checks, "portfolio_deployed_cap", f"${cap:,.0f}",
                          f"${snap.deployed_risk + new_exposure:,.0f}", ok):
                reasons.append("PORTFOLIO_BUDGET_EXCEEDED")

        # 10. max open positions
        ok = snap.open_positions_count < g.max_open_positions
        if not _check(checks, "max_open_positions", g.max_open_positions, snap.open_positions_count, ok):
            reasons.append("TOO_MANY_POSITIONS")

    # 11. idempotency / duplicates (closing: only the exact same symbol counts)
    dup = (
        any(l.symbol in snap.open_order_symbols for l in order.legs) if closing
        else _is_duplicate(order, proposal.underlying, snap.open_order_symbols)
    )
    if not _check(checks, "no_duplicate_order", "none", "duplicate" if dup else "none", not dup):
        reasons.append("DUPLICATE")

    # 12. option liquidity facts from compiler (closing near-worthless shorts is
    # exactly the point of profit-taking, so closes skip this)
    if has_option_leg and not closing:
        spread_pct = float(order.meta.get("spread_pct", 1.0))
        bid = float(order.meta.get("bid") or 0.0)
        ok = spread_pct <= 0.30 and bid >= 0.05
        if not _check(checks, "option_liquidity", "spread<=30%, bid>=0.05",
                      f"spread {spread_pct:.0%}, bid {bid}", ok):
            reasons.append("ILLIQUID")

    # 13. market hours: informational - closed market means the order queues
    _check(checks, "market_session", "open or queue-to-open",
           "open" if snap.market_open else "closed (queues to next open)", True)

    hard_reject = [r for r in reasons if r not in ("BREAKER_SOFT", "COOLDOWN", "WEATHER_STORM")]
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


def _occ_expiry_iso(symbol: str) -> str:
    """OCC option symbol -> expiry as ISO date string (lexicographic-safe)."""
    yymmdd = symbol[-15:-9]
    return f"20{yymmdd[:2]}-{yymmdd[2:4]}-{yymmdd[4:6]}"


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
    if order.meta.get("closing"):
        return 0.0
    if order.strategy_type == "cash_secured_put":
        return float(order.meta.get("collateral", 0.0))
    if order.strategy_type in DEFINED_RISK_TYPES:
        return float(order.est_max_loss)
    total = 0.0
    for l in order.legs:
        if l.asset_class == "us_equity" and l.side == "buy" and l.limit_price:
            total += l.qty * l.limit_price
    return total
