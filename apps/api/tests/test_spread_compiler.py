"""Spread selection & compilation on a synthetic chain - no network, no broker."""

import pytest

from northstar.compiler.options import (
    CompileError,
    compile_iron_condor,
    compile_vertical,
    occ_strike,
    select_vertical,
)
from northstar.domain import TradeProposal


def _c(kind: str, strike: float, delta: float, mid: float) -> dict:
    # fixed 10-cent spread keeps every mid exact at 2 decimals
    return {
        "symbol": f"SPY260918{kind}{int(strike * 1000):08d}",
        "delta": delta if kind == "C" else -delta,
        "bid": round(mid - 0.05, 2),
        "ask": round(mid + 0.05, 2),
        "iv": 0.2,
    }


def chain() -> list[dict]:
    """SPY ~800: liquid puts below, calls above, deltas stepping toward ATM."""
    puts = [
        _c("P", 780, 0.38, 9.0), _c("P", 770, 0.30, 6.8), _c("P", 760, 0.25, 5.0),
        _c("P", 750, 0.20, 3.4), _c("P", 740, 0.15, 1.5), _c("P", 730, 0.10, 0.9),
    ]
    calls = [
        _c("C", 820, 0.38, 9.0), _c("C", 830, 0.30, 6.8), _c("C", 840, 0.25, 5.0),
        _c("C", 850, 0.20, 3.4), _c("C", 860, 0.15, 1.5), _c("C", 870, 0.10, 0.9),
    ]
    return puts + calls


def spread_prop(stype: str, **extra) -> TradeProposal:
    params = {"target_delta": 0.25, "width": 20, "dte_min": 21, "dte_max": 45,
              "min_credit_ratio": 0.15, **extra}
    return TradeProposal(source="s", underlying="SPY", direction="neutral",
                         strategy_type=stype, params=params)


def test_select_vertical_picks_delta_and_width():
    pair = select_vertical(chain(), want_put=True, short_delta=0.25, width=20)
    assert pair is not None
    short, long = pair
    assert occ_strike(short["symbol"]) == 760.0   # closest to delta 0.25
    assert occ_strike(long["symbol"]) == 740.0    # wing ~20 below


def test_compile_bull_put_spread_economics():
    plan = compile_vertical(spread_prop("bull_put_spread"), chain=chain())
    # credit = 5.00 - 1.50 = 3.50; max loss = (20 - 3.5) * 100
    assert plan.est_credit_or_debit == pytest.approx(350.0)
    assert plan.est_max_loss == pytest.approx(1650.0)
    assert plan.meta["order_class"] == "mleg"
    assert plan.meta["net_limit"] == pytest.approx(-3.5)   # negative = credit
    sides = [(l.side, occ_strike(l.symbol)) for l in plan.legs]
    assert ("sell", 760.0) in sides and ("buy", 740.0) in sides


def test_compile_bear_call_spread_uses_calls():
    plan = compile_vertical(spread_prop("bear_call_spread"), chain=chain())
    strikes = sorted(occ_strike(l.symbol) for l in plan.legs)
    assert strikes == [840.0, 860.0]
    assert plan.est_max_loss > 0


def test_thin_credit_refused():
    with pytest.raises(CompileError, match="too thin"):
        compile_vertical(spread_prop("bull_put_spread", min_credit_ratio=0.30), chain=chain())


def test_no_liquid_wing_refused():
    puts_only_short = [c for c in chain() if occ_strike(c["symbol"]) not in (740.0, 750.0, 730.0)]
    with pytest.raises(CompileError, match="No liquid"):
        compile_vertical(spread_prop("bull_put_spread"), chain=puts_only_short)


def test_iron_condor_combines_both_sides():
    plan = compile_iron_condor(spread_prop("iron_condor", target_delta=0.20), chain=chain())
    assert len(plan.legs) == 4
    # both credits: 3.4 - 0.9 = 2.5 per side -> total 5.0; max loss = (20 - 5.0) * 100
    assert plan.est_credit_or_debit == pytest.approx(500.0)
    assert plan.est_max_loss == pytest.approx(1500.0)
    assert plan.meta["net_limit"] == pytest.approx(-5.0)
    put_legs = [l for l in plan.legs if l.symbol[-9] == "P"]
    call_legs = [l for l in plan.legs if l.symbol[-9] == "C"]
    assert len(put_legs) == 2 and len(call_legs) == 2
