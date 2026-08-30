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


def select_vertical(
    chain: list[dict[str, Any]], want_put: bool, short_delta: float, width: float,
    band: float = 0.10,
) -> tuple[dict[str, Any], dict[str, Any]] | None:
    """Short leg by delta; long wing = liquid same-expiry strike nearest `width` away.

    Pure function - callers inject the chain, tests use synthetic ones.
    """
    short = _pick_by_delta(chain, want_put=want_put, target_delta=short_delta, band=band)
    if short is None:
        return None
    expiry = occ_expiry_yymmdd(short["symbol"])
    s_strike = occ_strike(short["symbol"])
    target = s_strike - width if want_put else s_strike + width
    wings = [
        c for c in chain
        if occ_is_put(c["symbol"]) == want_put
        and occ_expiry_yymmdd(c["symbol"]) == expiry
        and c["symbol"] != short["symbol"]
        and _liquid(c)
        and (occ_strike(c["symbol"]) < s_strike if want_put else occ_strike(c["symbol"]) > s_strike)
    ]
    if not wings:
        return None
    long = min(wings, key=lambda c: abs(occ_strike(c["symbol"]) - target))
    return short, long


def _vertical_legs_and_econ(
    short: dict[str, Any], long: dict[str, Any]
) -> tuple[list[OrderLeg], float, float]:
    """Legs + (net credit per share, strike width) for one short vertical."""
    credit = round(_mid(short["bid"], short["ask"]) - _mid(long["bid"], long["ask"]), 2)
    width = abs(occ_strike(short["symbol"]) - occ_strike(long["symbol"]))
    legs = [
        OrderLeg(symbol=short["symbol"], side="sell", qty=1, asset_class="us_option",
                 limit_price=_mid(short["bid"], short["ask"])),
        OrderLeg(symbol=long["symbol"], side="buy", qty=1, asset_class="us_option",
                 limit_price=_mid(long["bid"], long["ask"])),
    ]
    return legs, credit, width


def _spread_meta(pairs: list[tuple[dict[str, Any], dict[str, Any]]], credit: float) -> dict[str, Any]:
    """Liquidity facts for the gate: worst leg spread, short-leg bid, net mleg limit."""
    all_legs = [c for pair in pairs for c in pair]
    worst_spread = max(
        (c["ask"] - c["bid"]) / _mid(c["bid"], c["ask"]) for c in all_legs if _mid(c["bid"], c["ask"]) > 0
    )
    return {
        "order_class": "mleg",
        "net_limit": -credit,               # alpaca mleg: negative = credit
        "spread_pct": round(worst_spread, 3),
        "bid": min(pair[0]["bid"] for pair in pairs),
        "deltas": {c["symbol"]: c.get("delta") for c in all_legs},
    }


def compile_vertical(proposal: TradeProposal, chain: list[dict[str, Any]] | None = None) -> OrderPlan:
    """Short vertical credit spread: bull put (want_put) or bear call."""
    p = proposal.params
    want_put = proposal.strategy_type == "bull_put_spread"
    if chain is None:
        chain = option_chain(proposal.underlying, int(p["dte_min"]), int(p["dte_max"]))
    pair = select_vertical(chain, want_put, float(p["target_delta"]), float(p["width"]))
    if pair is None:
        raise CompileError(
            f"No liquid {proposal.underlying} {'put' if want_put else 'call'} spread in delta band "
            f"{p['target_delta']:.2f}+/-0.10, width ~${p['width']:g}, DTE {p['dte_min']}-{p['dte_max']}"
        )
    legs, credit, width = _vertical_legs_and_econ(*pair)
    min_ratio = float(p.get("min_credit_ratio", 0.15))
    if credit <= 0 or width <= 0 or credit / width < min_ratio:
        raise CompileError(
            f"{proposal.underlying} spread premium too thin: credit ${credit:.2f} on ${width:g} width "
            f"(< {min_ratio:.0%} of width) - not worth the risk"
        )
    max_loss = (width - credit) * 100
    kind = "put" if want_put else "call"
    s_strike, l_strike = occ_strike(pair[0]["symbol"]), occ_strike(pair[1]["symbol"])
    return OrderPlan(
        proposal_id=proposal.id,
        strategy_type=proposal.strategy_type,
        legs=legs,
        est_max_loss=max_loss,
        est_credit_or_debit=credit * 100,
        human=(
            f"Sell {proposal.underlying} {kind} spread {s_strike:g}/{l_strike:g} "
            f"(exp {occ_expiry_yymmdd(pair[0]['symbol'])}), collect ~${credit * 100:,.0f}, "
            f"max loss ${max_loss:,.0f} - capped by design."
        ),
        meta={**_spread_meta([pair], credit), "width": width, "credit": credit},
    )


def _same_expiry(chain: list[dict[str, Any]], expiry: str) -> list[dict[str, Any]]:
    return [c for c in chain if occ_expiry_yymmdd(c["symbol"]) == expiry]


def compile_iron_condor(proposal: TradeProposal, chain: list[dict[str, Any]] | None = None) -> OrderPlan:
    """Short put spread + short call spread, forced onto ONE shared expiry."""
    p = proposal.params
    if chain is None:
        chain = option_chain(proposal.underlying, int(p["dte_min"]), int(p["dte_max"]))
    delta, width = float(p["target_delta"]), float(p["width"])

    # anchor on the put side's expiry; if calls can't match it, try the reverse
    put_pair = select_vertical(chain, True, delta, width)
    call_pair = None
    if put_pair is not None:
        call_pair = select_vertical(_same_expiry(chain, occ_expiry_yymmdd(put_pair[0]["symbol"])),
                                    False, delta, width)
    if call_pair is None:
        call_anchor = select_vertical(chain, False, delta, width)
        if call_anchor is not None:
            put_retry = select_vertical(_same_expiry(chain, occ_expiry_yymmdd(call_anchor[0]["symbol"])),
                                        True, delta, width)
            if put_retry is not None:
                put_pair, call_pair = put_retry, call_anchor
    if put_pair is None or call_pair is None:
        raise CompileError(
            f"No liquid {proposal.underlying} iron condor on a shared expiry in delta band "
            f"{delta:.2f}+/-0.10, width ~${width:g}, DTE {p['dte_min']}-{p['dte_max']}"
        )
    put_legs, put_credit, put_width = _vertical_legs_and_econ(*put_pair)
    call_legs, call_credit, call_width = _vertical_legs_and_econ(*call_pair)
    credit = round(put_credit + call_credit, 2)
    worst_width = max(put_width, call_width)
    min_ratio = float(p.get("min_credit_ratio", 0.15))
    if put_credit <= 0 or call_credit <= 0 or credit / worst_width < min_ratio:
        raise CompileError(
            f"{proposal.underlying} condor premium too thin: credit ${credit:.2f} on ${worst_width:g} width"
        )
    max_loss = (worst_width - credit) * 100   # only one side can lose at expiry
    return OrderPlan(
        proposal_id=proposal.id,
        strategy_type="iron_condor",
        legs=put_legs + call_legs,
        est_max_loss=max_loss,
        est_credit_or_debit=credit * 100,
        human=(
            f"Iron condor on {proposal.underlying} "
            f"(puts {occ_strike(put_pair[0]['symbol']):g}/{occ_strike(put_pair[1]['symbol']):g}, "
            f"calls {occ_strike(call_pair[0]['symbol']):g}/{occ_strike(call_pair[1]['symbol']):g}, "
            f"exp {occ_expiry_yymmdd(put_pair[0]['symbol'])}): collect ~${credit * 100:,.0f}, "
            f"max loss ${max_loss:,.0f} - capped by design."
        ),
        meta={**_spread_meta([put_pair, call_pair], credit),
              "width": worst_width, "credit": credit},
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
    if proposal.strategy_type in ("bull_put_spread", "bear_call_spread"):
        return compile_vertical(proposal)
    if proposal.strategy_type == "iron_condor":
        return compile_iron_condor(proposal)
    if proposal.strategy_type in ("momentum_rotation", "ma_cross_trend", "rsi_mean_reversion",
                                   "bollinger_reversion", "sector_rotation", "defensive_6040",
                                   "ai_analyst"):
        return compile_equity(proposal)
    raise CompileError(f"Strategy type {proposal.strategy_type} not compilable yet (A-milestone).")
