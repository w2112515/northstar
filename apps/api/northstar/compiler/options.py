"""Options/equity compiler: TradeProposal -> concrete OrderPlan.

Deterministic contract selection:
- delta band around target (abs delta within +/- 0.10)
- DTE band (chain pre-filtered by broker.option_chain)
- liquidity: bid >= 0.05, two-sided quote, spread/mid <= 30%
- CSP: collateral (strike*100) must fit the strategy's capital cap
Pick = closest abs(delta) to target; limit price = mid rounded to cent.
"""

from __future__ import annotations

from typing import Any

from northstar.broker import latest_quote, latest_trade_price, option_chain
from northstar.domain import OrderLeg, OrderPlan, TradeProposal


class CompileError(Exception):
    """No contract satisfies the constraints - a first-class, journaled outcome."""


def occ_strike(symbol: str) -> float:
    return int(symbol[-8:]) / 1000.0


def occ_is_put(symbol: str) -> bool:
    return symbol[-9] == "P"


def occ_expiry_yymmdd(symbol: str) -> str:
    return symbol[-15:-9]


def _mid(bid: float, ask: float) -> float:
    return round((bid + ask) / 2, 2)


def _liquid(c: dict[str, Any]) -> bool:
    bid, ask = c.get("bid"), c.get("ask")
    if not bid or not ask or bid < 0.05 or ask <= bid:
        return False
    m = (bid + ask) / 2
    return (ask - bid) / m <= 0.30


def _pick_by_delta(
    chain: list[dict[str, Any]], want_put: bool, target_delta: float,
    band: float = 0.10, strike_cap: float | None = None,
) -> dict[str, Any] | None:
    cands = []
    for c in chain:
        if occ_is_put(c["symbol"]) != want_put or c.get("delta") is None or not _liquid(c):
            continue
        d = abs(c["delta"])
        if abs(d - target_delta) > band:
            continue
        if strike_cap is not None and occ_strike(c["symbol"]) * 100 > strike_cap:
            continue
        cands.append((abs(d - target_delta), c))
    if not cands:
        return None
    return min(cands, key=lambda t: t[0])[1]


def compile_csp(proposal: TradeProposal) -> OrderPlan:
    p = proposal.params
    chain = option_chain(proposal.underlying, int(p["dte_min"]), int(p["dte_max"]))
    pick = _pick_by_delta(
        chain, want_put=True, target_delta=float(p["target_delta"]),
        strike_cap=float(p["capital_cap"]),
    )
    if pick is None:
        raise CompileError(
            f"No liquid {proposal.underlying} put in delta band "
            f"{p['target_delta']:.2f}+/-0.10, DTE {p['dte_min']}-{p['dte_max']}, "
            f"collateral <= ${p['capital_cap']:,.0f}"
        )
    strike = occ_strike(pick["symbol"])
    mid = _mid(pick["bid"], pick["ask"])
    credit = mid * 100
    return OrderPlan(
        proposal_id=proposal.id,
        strategy_type="cash_secured_put",
        legs=[OrderLeg(symbol=pick["symbol"], side="sell", qty=1, asset_class="us_option", limit_price=mid)],
        est_max_loss=strike * 100 - credit,     # honest: stock to zero
        est_credit_or_debit=credit,
        human=(
            f"Sell 1 {proposal.underlying} put, strike ${strike:g} "
            f"(exp {occ_expiry_yymmdd(pick['symbol'])}), collect ~${credit:,.0f}. "
            f"Collateral ${strike * 100:,.0f}."
        ),
        meta={"delta": pick["delta"], "bid": pick["bid"], "ask": pick["ask"],
              "spread_pct": round((pick["ask"] - pick["bid"]) / mid, 3),
              "collateral": strike * 100},
    )


def compile_cc(proposal: TradeProposal) -> OrderPlan:
    p = proposal.params
    contracts = int(p.get("contracts", 1))
    chain = option_chain(proposal.underlying, int(p["dte_min"]), int(p["dte_max"]))
    pick = _pick_by_delta(chain, want_put=False, target_delta=float(p["target_delta"]))
    if pick is None:
        raise CompileError(
            f"No liquid {proposal.underlying} call in delta band "
            f"{p['target_delta']:.2f}+/-0.10, DTE {p['dte_min']}-{p['dte_max']}"
        )
    strike = occ_strike(pick["symbol"])
    mid = _mid(pick["bid"], pick["ask"])
    credit = mid * 100 * contracts
    return OrderPlan(
        proposal_id=proposal.id,
        strategy_type="covered_call",
        legs=[OrderLeg(symbol=pick["symbol"], side="sell", qty=contracts, asset_class="us_option", limit_price=mid)],
        est_max_loss=0.0,                        # covered: the call itself adds no downside
        est_credit_or_debit=credit,
        human=(
            f"Sell {contracts} covered call(s) on {proposal.underlying}, strike ${strike:g} "
            f"(exp {occ_expiry_yymmdd(pick['symbol'])}), collect ~${credit:,.0f}."
        ),
        meta={"delta": pick["delta"], "bid": pick["bid"], "ask": pick["ask"],
              "spread_pct": round((pick["ask"] - pick["bid"]) / mid, 3),
              "contracts": contracts},
    )


def compile_equity(proposal: TradeProposal) -> OrderPlan:
    p = proposal.params
    q = latest_quote(proposal.underlying)
    mid = _mid(q["bid"], q["ask"]) if q["bid"] and q["ask"] else None
    if not mid or mid <= 0:
        # off-hours quotes are often one-sided; fall back to last trade
        mid = latest_trade_price(proposal.underlying)
    if not mid or mid <= 0:
        raise CompileError(f"No usable price for {proposal.underlying}")
    qty = int(p["qty"])
    side = p["action"]  # buy | sell
    return OrderPlan(
        proposal_id=proposal.id,
        strategy_type=proposal.strategy_type,
        legs=[OrderLeg(symbol=proposal.underlying, side=side, qty=qty, asset_class="us_equity", limit_price=mid)],
        est_max_loss=qty * mid if side == "buy" else 0.0,   # honest full-loss bound for stock
        est_credit_or_debit=-qty * mid if side == "buy" else qty * mid,
        human=f"{side.capitalize()} {qty} {proposal.underlying} @ ~${mid:,.2f} (limit at mid).",
        meta={"bid": q["bid"], "ask": q["ask"], "notional": qty * mid},
    )


def compile_proposal(proposal: TradeProposal) -> OrderPlan:
    if proposal.strategy_type == "cash_secured_put":
        return compile_csp(proposal)
    if proposal.strategy_type == "covered_call":
        return compile_cc(proposal)
    if proposal.strategy_type in ("momentum_rotation", "ma_cross_trend", "rsi_mean_reversion",
                                   "bollinger_reversion", "sector_rotation", "defensive_6040"):
        return compile_equity(proposal)
    raise CompileError(f"Strategy type {proposal.strategy_type} not compilable yet (A-milestone).")
