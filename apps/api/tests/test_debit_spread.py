"""Bull call debit spread: compile, gate accounting, classification, exits.
Synthetic chains and positions - no network, no broker."""

from datetime import date

import pytest

from northstar.compiler.options import (
    CompileError,
    compile_debit_vertical,
    occ_strike,
    select_debit_call_vertical,
)
from northstar.domain import Guardrails, TradeProposal
from northstar.exits import _classify, plan_exits
from northstar.gate import GateSnapshot, run_gate


def _c(kind: str, strike: float, delta: float, mid: float) -> dict:
    return {
        "symbol": f"SPY261016{kind}{int(strike * 1000):08d}",
        "delta": delta if kind == "C" else -delta,
        "bid": round(mid - 0.05, 2),
        "ask": round(mid + 0.05, 2),
        "iv": 0.2,
    }


def chain() -> list[dict]:
    """SPY ~800 with ATM calls present (debit spreads buy near the money)."""
    return [
        _c("C", 790, 0.62, 26.0), _c("C", 800, 0.55, 20.0), _c("C", 810, 0.45, 14.0),
        _c("C", 820, 0.38, 9.0), _c("C", 830, 0.30, 6.8), _c("C", 840, 0.25, 5.0),
        _c("P", 760, 0.25, 5.0), _c("P", 740, 0.15, 1.5),
    ]


def debit_prop(**extra) -> TradeProposal:
    params = {"long_delta": 0.55, "width": 20, "dte_min": 21, "dte_max": 45,
              "max_debit_ratio": 0.60, **extra}
    return TradeProposal(source="s", underlying="SPY", direction="bullish",
                         strategy_type="bull_call_spread", params=params)


# ------------------------------------------------------------------- compile

def test_select_picks_long_by_delta_and_wing_above():
    pair = select_debit_call_vertical(chain(), long_delta=0.55, width=20)
    assert pair is not None
    long, short = pair
    assert occ_strike(long["symbol"]) == 800.0     # closest to delta 0.55
    assert occ_strike(short["symbol"]) == 820.0    # wing ~20 above


def test_compile_debit_economics():
    plan = compile_debit_vertical(debit_prop(), chain=chain())
    # debit = 20.00 - 9.00 = 11.00 on width 20 (55% of width, within 60%)
    assert plan.est_max_loss == pytest.approx(1100.0)
    assert plan.est_credit_or_debit == pytest.approx(-1100.0)   # we pay
    assert plan.meta["net_limit"] == pytest.approx(11.0)        # positive = debit
    assert plan.meta["order_class"] == "mleg"
    assert plan.meta["max_profit"] == pytest.approx(900.0)      # (20 - 11) * 100
    sides = [(l.side, occ_strike(l.symbol)) for l in plan.legs]
    assert ("buy", 800.0) in sides and ("sell", 820.0) in sides


def test_overpriced_debit_refused():
    with pytest.raises(CompileError, match="costs too much"):
        compile_debit_vertical(debit_prop(max_debit_ratio=0.40), chain=chain())


def test_no_wing_refused():
    thin = [c for c in chain() if occ_strike(c["symbol"]) <= 800 or c["symbol"][9] == "P"]
    with pytest.raises(CompileError, match="No liquid"):
        compile_debit_vertical(debit_prop(), chain=thin)


def test_budget_sizes_contracts():
    plan = compile_debit_vertical(debit_prop(risk_budget=3500.0), chain=chain())
    assert plan.meta["contracts"] == 3            # 3500 // 1100
    assert plan.est_max_loss == pytest.approx(3300.0)


# ---------------------------------------------------------------------- gate

def _snap(**over) -> GateSnapshot:
    base = dict(equity=100_000.0, last_equity=100_000.0, peak_equity=100_000.0,
                market_open=True, options_level=3, today_iso="2026-08-31")
    base.update(over)
    return GateSnapshot(**base)


def test_gate_approves_debit_within_cap():
    plan = compile_debit_vertical(debit_prop(), chain=chain())
    g = Guardrails(max_loss_per_trade_pct=0.02)   # $2,000 cap vs $1,100 debit
    verdict = run_gate(plan, debit_prop(), _snap(), g)
    assert verdict.verdict == "approved"


def test_gate_rejects_debit_over_cap():
    plan = compile_debit_vertical(debit_prop(), chain=chain())
    g = Guardrails(max_loss_per_trade_pct=0.005)  # $500 cap vs $1,100 debit
    verdict = run_gate(plan, debit_prop(), _snap(), g)
    assert verdict.verdict == "rejected"
    assert "MAX_LOSS_EXCEEDED" in verdict.reason_codes


# ------------------------------------------------------------ classify + exit

def _leg(kind: str, strike: float, qty: float, entry: float, current: float) -> dict:
    return {
        "symbol": f"SPY261016{kind}{int(strike * 1000):08d}",
        "asset_class": "us_option", "qty": qty,
        "avg_entry_price": entry, "current_price": current,
        "market_value": current * 100 * qty,
    }


def test_classify_debit_call_vertical():
    legs = [_leg("C", 800, 1, 20.0, 22.0), _leg("C", 820, -1, 9.0, 8.0)]
    assert _classify(legs) == ("vertical", "bull_call_spread")


def test_classify_credit_call_vertical_unchanged():
    legs = [_leg("C", 840, -1, 5.0, 4.0), _leg("C", 860, 1, 1.5, 1.2)]
    assert _classify(legs) == ("vertical", "bear_call_spread")


def test_debit_profit_exit_collects_credit():
    # paid 11.00; spread now worth 20.00 -> captured (20-11)/(20-11 max) = 100%
    positions = [_leg("C", 800, 1, 20.0, 26.0), _leg("C", 820, -1, 9.0, 6.0)]
    g = Guardrails(max_loss_per_trade_pct=0.02)   # exit_profit_take 50%, exit_dte 7
    pairs = plan_exits(positions, [], g, today=date(2026, 8, 31))
    assert len(pairs) == 1
    proposal, order = pairs[0]
    assert proposal.strategy_type == "bull_call_spread"
    assert "max gain" in order.human
    # closing a debit spread collects a credit: negative net limit, 5% under mark
    assert order.meta["net_limit"] == pytest.approx(-19.0)     # -20.00 * 0.95
    assert order.meta["order_class"] == "mleg"


def test_debit_time_exit_applies():
    positions = [_leg("C", 800, 1, 20.0, 18.0), _leg("C", 820, -1, 9.0, 8.5)]
    g = Guardrails(max_loss_per_trade_pct=0.02)
    pairs = plan_exits(positions, [], g, today=date(2026, 10, 12))  # 4 DTE
    assert len(pairs) == 1
    assert "days to expiry" in pairs[0][1].human


def test_debit_underwater_holds_until_dte():
    # value fell to 6.00 (loss) - no profit exit, expiry far -> hold
    positions = [_leg("C", 800, 1, 20.0, 14.0), _leg("C", 820, -1, 9.0, 8.0)]
    g = Guardrails(max_loss_per_trade_pct=0.02)
    assert plan_exits(positions, [], g, today=date(2026, 8, 31)) == []
