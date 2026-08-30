"""Manual position close - the cockpit's per-position "Close now" button.

frequi-style ForceExit with NorthStar rules:
- the order still goes through the risk gate (closing semantics: new-risk
  rules step aside, kill switch still outranks everything)
- realized P&L is booked exactly like any other exit (entry basis in meta)
- clicking one leg of an option structure closes the WHOLE structure
  (vertical/condor as one mleg order) - we never leave a naked leg behind
"""

from __future__ import annotations

from typing import Any

from northstar.domain import OrderLeg, OrderPlan, TradeProposal
from northstar.exits import (
    _classify,
    _close_package,
    _close_single,
    _group_structures,
    occ_underlying,
)

EQUITY_PRICE_BUFFER = 0.005  # cross the spread a touch so the close actually fills
MANUAL_REASON = ("manual", "closed by you from the cockpit")


def _manual_proposal(underlying: str, label: str) -> TradeProposal:
    return TradeProposal(
        source="cockpit",
        underlying=underlying,
        direction="neutral",
        strategy_type="manual_close",
        horizon_days=0,
        thesis_human=f"Manual close: you asked to step out of {label} from the cockpit.",
        invalidation="n/a (manual exit)",
        params={"reason": "manual"},
    )


def _close_equity(pos: dict[str, Any]) -> tuple[TradeProposal, OrderPlan] | None:
    qty = float(pos.get("qty") or 0)
    price = pos.get("current_price")
    entry = pos.get("avg_entry_price")
    if not qty or not price:
        return None
    selling = qty > 0
    limit = round(float(price) * (1 - EQUITY_PRICE_BUFFER if selling else 1 + EQUITY_PRICE_BUFFER), 2)
    side = "sell" if selling else "buy"
    proposal = _manual_proposal(pos["symbol"], f"{abs(qty):g} {pos['symbol']}")
    order = OrderPlan(
        proposal_id=proposal.id,
        strategy_type="manual_close",
        legs=[OrderLeg(symbol=pos["symbol"], side=side, qty=abs(qty),
                       asset_class="us_equity", limit_price=limit)],
        est_max_loss=0.0,
        est_credit_or_debit=(abs(qty) * limit) if selling else -(abs(qty) * limit),
        human=f"{side.capitalize()} to close {abs(qty):g} {pos['symbol']} @ ${limit:,.2f} (manual).",
        meta={
            "closing": True,
            "entry_price": float(entry) if entry else 0.0,
            "signed_qty": qty,
            "pnl_multiplier": 1,
            "family": "manual",
            "close_symbol": pos["symbol"],
            "close_note": MANUAL_REASON[1],
        },
    )
    return proposal, order


def _close_long_option(leg: dict[str, Any], proposal: TradeProposal) -> OrderPlan | None:
    """Sell-to-close a long option leg (exits._close_single only handles shorts)."""
    price = leg.get("current_price")
    entry = leg.get("avg_entry_price")
    if price is None or not entry:
        return None
    qty = abs(float(leg["qty"]))
    limit = max(round(float(price) * (1 - EQUITY_PRICE_BUFFER), 2), 0.01)
    return OrderPlan(
        proposal_id=proposal.id,
        strategy_type="manual_close",
        legs=[OrderLeg(symbol=leg["symbol"], side="sell", qty=qty,
                       asset_class="us_option", limit_price=limit)],
        est_max_loss=0.0,
        est_credit_or_debit=limit,
        human=f"sell to close {int(qty)}x {leg['symbol']} @ ${limit:.2f} (manual).",
        meta={
            "closing": True, "entry_price": float(entry), "signed_qty": qty,
            "pnl_multiplier": 100, "family": "manual",
            "close_symbol": leg["symbol"], "close_note": MANUAL_REASON[1],
        },
    )


def plan_manual_close(
    positions: list[dict[str, Any]], symbol: str
) -> tuple[TradeProposal, OrderPlan] | None:
    """Build the closing (proposal, order) for one position; None if not closable."""
    target = next((p for p in positions if p.get("symbol") == symbol), None)
    if target is None or not float(target.get("qty") or 0):
        return None

    if target.get("asset_class") == "us_equity":
        return _close_equity(target)

    # option: close the whole structure the leg belongs to
    for legs in _group_structures(positions):
        if not any(l["symbol"] == symbol for l in legs):
            continue
        und = occ_underlying(symbol)
        classified = _classify(legs)
        if classified is not None:
            shape, strategy_type = classified
            label = f"{und} {strategy_type.replace('_', ' ')}"
            proposal = _manual_proposal(und, label)
            if shape == "single":
                order = _close_single(legs[0], strategy_type, MANUAL_REASON, proposal)
            elif shape in ("vertical", "condor"):
                order = _close_package(legs, strategy_type, MANUAL_REASON, proposal)
            else:
                order = _close_single(
                    next(l for l in legs if float(l["qty"]) < 0), strategy_type, MANUAL_REASON, proposal
                )
            return (proposal, order) if order else None
        # unrecognized mix: close just the clicked leg, in the right direction
        leg = next(l for l in legs if l["symbol"] == symbol)
        proposal = _manual_proposal(und, symbol)
        if float(leg["qty"]) < 0:
            order = _close_single(leg, "manual_close", MANUAL_REASON, proposal)
        else:
            order = _close_long_option(leg, proposal)
        return (proposal, order) if order else None
    return None
