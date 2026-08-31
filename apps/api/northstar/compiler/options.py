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


MAX_CONTRACTS = 10  # absolute per-order sanity cap, independent of any budget


def _contracts_for_budget(budget: float, per_contract_risk: float) -> int:
    """How many contracts a $ risk budget affords - never 0, never past the cap.

    budget<=0 (no budget passed - old proposals, tests) keeps legacy size 1.
    A budget below one contract's risk also returns 1: the gate still owns
    the final yes/no, the compiler never silently drops a proposal.
    """
    if budget <= 0 or per_contract_risk <= 0:
        return 1
    return max(1, min(MAX_CONTRACTS, int(budget // per_contract_risk)))


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
    # deploy the name's collateral budget, not one token contract: the gate's
    # csp_collateral_cap and the sleeve budget still bound the total
    n = _contracts_for_budget(float(p["capital_cap"]), strike * 100)
    credit = mid * 100 * n
    collateral = strike * 100 * n
    return OrderPlan(
        proposal_id=proposal.id,
        strategy_type="cash_secured_put",
        legs=[OrderLeg(symbol=pick["symbol"], side="sell", qty=n, asset_class="us_option", limit_price=mid)],
        est_max_loss=collateral - credit,       # honest: stock to zero
        est_credit_or_debit=credit,
        human=(
            f"Sell {n} {proposal.underlying} put{'s' if n > 1 else ''}, strike ${strike:g} "
            f"(exp {occ_expiry_yymmdd(pick['symbol'])}), collect ~${credit:,.0f}. "
            f"Collateral ${collateral:,.0f}."
        ),
        meta={"delta": pick["delta"], "bid": pick["bid"], "ask": pick["ask"],
              "spread_pct": round((pick["ask"] - pick["bid"]) / mid, 3),
              "collateral": collateral, "contracts": n},
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
    per_contract_loss = (width - credit) * 100
    n = _contracts_for_budget(float(p.get("risk_budget", 0.0)), per_contract_loss)
    max_loss = per_contract_loss * n
    kind = "put" if want_put else "call"
    s_strike, l_strike = occ_strike(pair[0]["symbol"]), occ_strike(pair[1]["symbol"])
    return OrderPlan(
        proposal_id=proposal.id,
        strategy_type=proposal.strategy_type,
        legs=legs,
        est_max_loss=max_loss,
        est_credit_or_debit=credit * 100 * n,
        human=(
            f"Sell {n} {proposal.underlying} {kind} spread{'s' if n > 1 else ''} "
            f"{s_strike:g}/{l_strike:g} (exp {occ_expiry_yymmdd(pair[0]['symbol'])}), "
            f"collect ~${credit * 100 * n:,.0f}, max loss ${max_loss:,.0f} - capped by design."
        ),
        meta={**_spread_meta([pair], credit), "width": width, "credit": credit, "contracts": n},
    )


def select_debit_call_vertical(
    chain: list[dict[str, Any]], long_delta: float, width: float, band: float = 0.10,
) -> tuple[dict[str, Any], dict[str, Any]] | None:
    """(long, short) for a bull call debit spread: long call by delta (the
    directional leg, ~ATM), short wing = liquid same-expiry call nearest
    `width` above it. Pure function - tests inject synthetic chains."""
    long = _pick_by_delta(chain, want_put=False, target_delta=long_delta, band=band)
    if long is None:
        return None
    expiry = occ_expiry_yymmdd(long["symbol"])
    l_strike = occ_strike(long["symbol"])
    target = l_strike + width
    wings = [
        c for c in chain
        if not occ_is_put(c["symbol"])
        and occ_expiry_yymmdd(c["symbol"]) == expiry
        and c["symbol"] != long["symbol"]
        and _liquid(c)
        and occ_strike(c["symbol"]) > l_strike
    ]
    if not wings:
        return None
    short = min(wings, key=lambda c: abs(occ_strike(c["symbol"]) - target))
    return long, short


def compile_debit_vertical(proposal: TradeProposal, chain: list[dict[str, Any]] | None = None) -> OrderPlan:
    """Long vertical debit spread (bull call): pay a net debit that IS the max
    loss; gain capped at width minus debit. One atomic mleg order."""
    p = proposal.params
    if chain is None:
        chain = option_chain(proposal.underlying, int(p["dte_min"]), int(p["dte_max"]))
    pair = select_debit_call_vertical(chain, float(p.get("long_delta", 0.55)), float(p["width"]))
    if pair is None:
        raise CompileError(
            f"No liquid {proposal.underlying} call debit spread near delta "
            f"{float(p.get('long_delta', 0.55)):.2f}, width ~${p['width']:g}, "
            f"DTE {p['dte_min']}-{p['dte_max']}"
        )
    long, short = pair
    long_mid, short_mid = _mid(long["bid"], long["ask"]), _mid(short["bid"], short["ask"])
    debit = round(long_mid - short_mid, 2)
    width = abs(occ_strike(short["symbol"]) - occ_strike(long["symbol"]))
    max_ratio = float(p.get("max_debit_ratio", 0.60))
    if debit <= 0 or width <= 0 or debit / width > max_ratio:
        raise CompileError(
            f"{proposal.underlying} call spread costs too much: ${debit:.2f} on ${width:g} width "
            f"(> {max_ratio:.0%} of width) - the reward doesn't cover the cost"
        )
    per_contract_loss = debit * 100
    n = _contracts_for_budget(float(p.get("risk_budget", 0.0)), per_contract_loss)
    max_loss = per_contract_loss * n
    max_profit = (width - debit) * 100 * n
    worst_spread = max(
        (c["ask"] - c["bid"]) / _mid(c["bid"], c["ask"]) for c in (long, short)
    )
    return OrderPlan(
        proposal_id=proposal.id,
        strategy_type="bull_call_spread",
        legs=[
            OrderLeg(symbol=long["symbol"], side="buy", qty=1, asset_class="us_option",
                     limit_price=long_mid),
            OrderLeg(symbol=short["symbol"], side="sell", qty=1, asset_class="us_option",
                     limit_price=short_mid),
        ],
        est_max_loss=max_loss,                    # honest: the debit is all we can lose
        est_credit_or_debit=-debit * 100 * n,
        human=(
            f"Buy {n} {proposal.underlying} call spread{'s' if n > 1 else ''} "
            f"{occ_strike(long['symbol']):g}/{occ_strike(short['symbol']):g} "
            f"(exp {occ_expiry_yymmdd(long['symbol'])}), pay ~${debit * 100 * n:,.0f} - "
            f"that cost is the max loss; top gain ${max_profit:,.0f}."
        ),
        meta={
            "order_class": "mleg",
            "net_limit": debit,                   # alpaca mleg: positive = debit
            "spread_pct": round(worst_spread, 3),
            "bid": min(long["bid"], short["bid"]),
            "deltas": {c["symbol"]: c.get("delta") for c in (long, short)},
            "width": width, "debit": debit, "contracts": n, "max_profit": max_profit,
        },
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
    per_contract_loss = (worst_width - credit) * 100   # only one side can lose at expiry
    n = _contracts_for_budget(float(p.get("risk_budget", 0.0)), per_contract_loss)
    max_loss = per_contract_loss * n
    return OrderPlan(
        proposal_id=proposal.id,
        strategy_type="iron_condor",
        legs=put_legs + call_legs,
        est_max_loss=max_loss,
        est_credit_or_debit=credit * 100 * n,
        human=(
            f"{n}x iron condor on {proposal.underlying} "
            f"(puts {occ_strike(put_pair[0]['symbol']):g}/{occ_strike(put_pair[1]['symbol']):g}, "
            f"calls {occ_strike(call_pair[0]['symbol']):g}/{occ_strike(call_pair[1]['symbol']):g}, "
            f"exp {occ_expiry_yymmdd(put_pair[0]['symbol'])}): collect ~${credit * 100 * n:,.0f}, "
            f"max loss ${max_loss:,.0f} - capped by design."
        ),
        meta={**_spread_meta([put_pair, call_pair], credit),
              "width": worst_width, "credit": credit, "contracts": n},
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


# Single source of truth for what can become a real order today. Families
# outside this set (e.g. dsl_rotation, still backtest-only) must not reach the
# live pipeline: the engine skips their instances instead of proposing into a
# guaranteed CompileError every pass.
_ROUTES = {
    "cash_secured_put": compile_csp,
    "covered_call": compile_cc,
    "bull_put_spread": compile_vertical,
    "bear_call_spread": compile_vertical,
    "bull_call_spread": compile_debit_vertical,
    "iron_condor": compile_iron_condor,
    "momentum_rotation": compile_equity,
    "ma_cross_trend": compile_equity,
    "rsi_mean_reversion": compile_equity,
    "bollinger_reversion": compile_equity,
    "sector_rotation": compile_equity,
    "defensive_6040": compile_equity,
    "ai_analyst": compile_equity,
}

LIVE_COMPILABLE = frozenset(_ROUTES)


def compile_proposal(proposal: TradeProposal) -> OrderPlan:
    route = _ROUTES.get(proposal.strategy_type)
    if route is None:
        raise CompileError(f"Strategy type {proposal.strategy_type} not compilable yet (A-milestone).")
    return route(proposal)
