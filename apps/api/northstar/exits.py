"""Exit manager for option positions (thetagang-style mechanical rules).

Two rules, both from Guardrails:
- profit take: a short-premium structure that has captured
  >= exit_profit_take_pct of its entry credit gets closed (locking the win).
- time exit: any structure at DTE <= exit_dte gets closed regardless of P&L
  (gamma/assignment risk isn't worth the last pennies).

Structures are recognized from live positions, grouped by (underlying, expiry):
- one short option alone            -> single-leg buy-to-close
- 1 short + 1 long, same type       -> vertical, closed as one mleg order
- 2 shorts + 2 longs (put+call side)-> iron condor, closed as one 4-leg mleg
- anything else                     -> close each short leg individually

plan_exits() is pure (positions in, orders out). Prices come from the
position marks Alpaca already returns - no extra market-data calls.
Exits never block: gate rules for new risk step aside for meta.closing plans.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from northstar.domain import Guardrails, OrderLeg, OrderPlan, StrategyType, TradeProposal

PRICE_BUFFER = 1.05          # pay up to 5% over the current mark to get out
MIN_TICK = 0.01


# --------------------------------------------------------------------------- OCC helpers

def occ_underlying(symbol: str) -> str:
    return symbol[:-15]


def occ_expiry(symbol: str) -> date:
    return datetime.strptime(symbol[-15:-9], "%y%m%d").date()


def occ_type(symbol: str) -> str:
    return symbol[-9]  # "P" | "C"


def dte(symbol: str, today: date | None = None) -> int:
    return (occ_expiry(symbol) - (today or datetime.now(timezone.utc).date())).days


# --------------------------------------------------------------------------- structures

def _group_structures(positions: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    groups: dict[tuple[str, date], list[dict[str, Any]]] = {}
    for p in positions:
        if p.get("asset_class") != "us_option" or not float(p.get("qty") or 0):
            continue
        key = (occ_underlying(p["symbol"]), occ_expiry(p["symbol"]))
        groups.setdefault(key, []).append(p)
    return list(groups.values())


def _classify(legs: list[dict[str, Any]]) -> tuple[str, StrategyType] | None:
    """(shape, strategy_type) or None for structures we don't manage."""
    shorts = [l for l in legs if float(l["qty"]) < 0]
    longs = [l for l in legs if float(l["qty"]) > 0]
    if len(shorts) == 1 and not longs:
        kind = occ_type(shorts[0]["symbol"])
        return ("single", "cash_secured_put" if kind == "P" else "covered_call")
    if len(shorts) == 1 and len(longs) == 1 and occ_type(shorts[0]["symbol"]) == occ_type(longs[0]["symbol"]):
        kind = occ_type(shorts[0]["symbol"])
        return ("vertical", "bull_put_spread" if kind == "P" else "bear_call_spread")
    if len(shorts) == 2 and len(longs) == 2:
        stypes = sorted(occ_type(l["symbol"]) for l in shorts)
        ltypes = sorted(occ_type(l["symbol"]) for l in longs)
        if stypes == ["C", "P"] and ltypes == ["C", "P"]:
            return ("condor", "iron_condor")
    if shorts and not longs:
        return ("shorts_only", "cash_secured_put")
    return None


def _net_prices(legs: list[dict[str, Any]]) -> tuple[float, float] | None:
    """(net entry credit, net current cost) per 1x structure; None on data gaps."""
    entry = current = 0.0
    for l in legs:
        e, c = l.get("avg_entry_price"), l.get("current_price")
        if not e or c is None:
            return None
        sign = 1.0 if float(l["qty"]) < 0 else -1.0  # shorts contribute credit
        entry += sign * float(e)
        current += sign * float(c)
    return entry, current


def _exit_reason(
    legs: list[dict[str, Any]], g: Guardrails, today: date | None
) -> tuple[str, str] | None:
    """(reason_code, plain note) or None to keep holding."""
    min_dte = min(dte(l["symbol"], today) for l in legs)
    if min_dte <= g.exit_dte:
        return ("time", f"{min_dte} days to expiry (exit at {g.exit_dte})")
    net = _net_prices(legs)
    if net is None:
        return None
    entry, current = net
    if entry <= 0:
        return None  # not a credit structure; only time-exit applies
    captured = (entry - current) / entry
    if captured >= g.exit_profit_take_pct:
        return ("profit", f"captured {captured:.0%} of the entry credit (target {g.exit_profit_take_pct:.0%})")
    return None


def _close_single(leg: dict[str, Any], strategy_type: StrategyType, reason: tuple[str, str],
                  proposal: TradeProposal) -> OrderPlan | None:
    current = leg.get("current_price")
    entry = leg.get("avg_entry_price")
    if current is None or not entry:
        return None
    qty = abs(float(leg["qty"]))
    limit = max(round(float(current) * PRICE_BUFFER, 2), MIN_TICK)
    return OrderPlan(
        proposal_id=proposal.id,
        strategy_type=strategy_type,
        legs=[OrderLeg(symbol=leg["symbol"], side="buy", qty=qty,
                       asset_class="us_option", limit_price=limit)],
        est_max_loss=0.0,
        est_credit_or_debit=-limit,
        human=f"buy to close {int(qty)}x {leg['symbol']} @ ${limit:.2f} ({reason[1]}).",
        meta={
            "closing": True, "entry_price": float(entry), "signed_qty": -qty,
            "pnl_multiplier": 100, "family": strategy_type,
            "close_symbol": leg["symbol"], "close_note": reason[1],
        },
    )


def _close_package(legs: list[dict[str, Any]], strategy_type: StrategyType, reason: tuple[str, str],
                   proposal: TradeProposal) -> OrderPlan | None:
    net = _net_prices(legs)
    if net is None:
        return None
    entry, current = net
    contracts = int(min(abs(float(l["qty"])) for l in legs))
    if contracts < 1:
        return None
    # closing a credit structure = paying a debit; executor: positive = debit
    net_limit = round(max(current, 0.0) * PRICE_BUFFER + MIN_TICK, 2)
    und = occ_underlying(legs[0]["symbol"])
    label = f"{strategy_type.replace('_', ' ')} on {und}"
    return OrderPlan(
        proposal_id=proposal.id,
        strategy_type=strategy_type,
        legs=[
            OrderLeg(
                symbol=l["symbol"],
                side="buy" if float(l["qty"]) < 0 else "sell",
                qty=1,
                asset_class="us_option",
            )
            for l in legs
        ],
        est_max_loss=0.0,
        est_credit_or_debit=-net_limit,
        human=f"close {contracts}x {label}, net debit limit ${net_limit:.2f} ({reason[1]}).",
        meta={
            "closing": True, "entry_price": entry, "signed_qty": -contracts,
            "pnl_multiplier": 100, "family": strategy_type,
            "order_class": "mleg", "net_limit": net_limit, "contracts": contracts,
            "close_symbol": f"{und} {strategy_type}", "close_note": reason[1],
        },
    )


def plan_exits(
    positions: list[dict[str, Any]],
    open_order_symbols: list[str],
    g: Guardrails,
    today: date | None = None,
) -> list[tuple[TradeProposal, OrderPlan]]:
    """Pure planner: option positions in, (proposal, close order) pairs out."""
    out: list[tuple[TradeProposal, OrderPlan]] = []
    for legs in _group_structures(positions):
        und = occ_underlying(legs[0]["symbol"])
        # a pending order on this underlying (our own unfilled close included)
        # means: wait for it, retry next pass
        if any(p == und or p.startswith(und) and len(p) > 15 for p in open_order_symbols):
            continue
        classified = _classify(legs)
        if classified is None:
            continue
        shape, strategy_type = classified
        reason = _exit_reason(legs, g, today)
        if reason is None:
            continue

        verb = "Locking in the win on" if reason[0] == "profit" else "Stepping out of"
        proposal = TradeProposal(
            source="exit_manager",
            underlying=und,
            direction="neutral",
            strategy_type=strategy_type,
            horizon_days=0,
            thesis_human=f"{verb} {und} {strategy_type.replace('_', ' ')}: {reason[1]}.",
            invalidation="n/a (exit)",
            params={"reason": reason[0]},
        )

        if shape == "single":
            order = _close_single(legs[0], strategy_type, reason, proposal)
            orders = [order] if order else []
        elif shape in ("vertical", "condor"):
            order = _close_package(legs, strategy_type, reason, proposal)
            orders = [order] if order else []
        else:  # shorts_only fallback: close each short leg individually
            orders = [
                o for l in legs if float(l["qty"]) < 0
                if (o := _close_single(l, strategy_type, reason, proposal))
            ]

        out.extend((proposal, o) for o in orders)
    return out
