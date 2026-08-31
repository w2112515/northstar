"""Exit manager: structure recognition, profit/time rules, close order shapes."""

from datetime import date

from northstar.domain import Guardrails
from northstar.exits import dte, plan_exits

G = Guardrails(max_loss_per_trade_pct=0.01)  # exit_profit_take_pct=0.5, exit_dte=7
TODAY = date(2026, 8, 28)


def opt(symbol, qty, entry, current):
    return {"symbol": symbol, "qty": qty, "asset_class": "us_option",
            "avg_entry_price": entry, "current_price": current, "market_value": current * qty * 100}


def test_dte_parse():
    assert dte("AMD260918P00170000", today=TODAY) == 21
    assert dte("AMD260904P00170000", today=TODAY) == 7


def test_short_put_profit_take():
    # sold at 2.50, now 1.00 -> captured 60% >= 50% target
    pairs = plan_exits([opt("AMD261016P00170000", -1, 2.50, 1.00)], [], G, today=TODAY)
    assert len(pairs) == 1
    proposal, order = pairs[0]
    assert proposal.source == "exit_manager"
    assert order.meta["closing"] is True
    assert order.legs[0].side == "buy" and order.legs[0].qty == 1
    assert order.legs[0].limit_price == 1.05  # current * 1.05
    assert order.meta["entry_price"] == 2.50
    assert order.meta["signed_qty"] == -1
    assert "captured 60%" in order.meta["close_note"]


def test_short_put_held_when_no_rule_fires():
    # captured only 20%, 49 DTE -> hold
    pairs = plan_exits([opt("AMD261016P00170000", -1, 2.50, 2.00)], [], G, today=TODAY)
    assert pairs == []


def test_time_exit_overrides_pnl():
    # 7 DTE, position underwater -> still exits (time rule)
    pairs = plan_exits([opt("AMD260904P00170000", -1, 2.50, 4.00)], [], G, today=TODAY)
    assert len(pairs) == 1
    _, order = pairs[0]
    assert "days to expiry" in order.meta["close_note"]


def test_vertical_close_is_one_mleg():
    legs = [
        opt("SPY261016P00760000", -1, 5.00, 1.50),   # short
        opt("SPY261016P00740000", 1, 3.00, 0.70),    # long
    ]
    # net entry credit 2.00, net current 0.80 -> captured 60%
    pairs = plan_exits(legs, [], G, today=TODAY)
    assert len(pairs) == 1
    proposal, order = pairs[0]
    assert proposal.strategy_type == "bull_put_spread"
    assert order.meta["order_class"] == "mleg"
    assert order.meta["contracts"] == 1
    sides = {l.symbol: l.side for l in order.legs}
    assert sides["SPY261016P00760000"] == "buy"    # short bought back
    assert sides["SPY261016P00740000"] == "sell"   # long sold
    assert order.meta["entry_price"] == 2.00
    assert order.meta["net_limit"] == round(0.80 * 1.05 + 0.01, 2)


def test_condor_close_is_one_4leg_mleg():
    legs = [
        opt("SPY261016P00740000", -1, 2.00, 0.40),
        opt("SPY261016P00720000", 1, 1.20, 0.20),
        opt("SPY261016C00860000", -1, 2.10, 0.50),
        opt("SPY261016C00880000", 1, 1.30, 0.25),
    ]
    # net entry 2.00-1.20+2.10-1.30 = 1.60; current 0.40-0.20+0.50-0.25 = 0.45 -> 72%
    pairs = plan_exits(legs, [], G, today=TODAY)
    assert len(pairs) == 1
    proposal, order = pairs[0]
    assert proposal.strategy_type == "iron_condor"
    assert len(order.legs) == 4
    assert order.meta["order_class"] == "mleg"


def test_pending_order_on_underlying_defers_exit():
    pos = [opt("AMD260904P00170000", -1, 2.50, 0.50)]
    pairs = plan_exits(pos, ["AMD260904P00170000"], G, today=TODAY)
    assert pairs == []
    # pending equity order on same underlying also defers
    assert plan_exits(pos, ["AMD"], G, today=TODAY) == []
    # unrelated pending order does not
    assert len(plan_exits(pos, ["NVDA"], G, today=TODAY)) == 1


def test_different_expiries_are_separate_structures():
    legs = [
        opt("AMD261016P00170000", -1, 2.50, 1.00),   # 60% captured -> close
        opt("AMD261120P00160000", -1, 3.00, 2.80),   # barely moved -> hold
    ]
    pairs = plan_exits(legs, [], G, today=TODAY)
    assert len(pairs) == 1
    assert pairs[0][1].legs[0].symbol == "AMD261016P00170000"


def test_missing_marks_skip_structure():
    p = opt("AMD261016P00170000", -1, 2.50, 1.00)
    p["current_price"] = None
    assert plan_exits([p], [], G, today=TODAY) == []


def test_long_only_position_not_touched():
    assert plan_exits([opt("SPY261016P00740000", 1, 3.00, 0.50)], [], G, today=TODAY) == []


def test_stacked_same_type_verticals_close_each_short_leg():
    # two bull put spreads on one underlying+expiry: 2 shorts + 2 longs, all
    # puts - not a condor. The fallback must close each short leg (the risk),
    # leaving the paid-for long wings alone, never silently skip the group.
    legs = [
        opt("SPY261016P00760000", -1, 5.00, 1.50),
        opt("SPY261016P00740000", 1, 3.00, 0.70),
        opt("SPY261016P00750000", -1, 4.00, 1.20),
        opt("SPY261016P00730000", 1, 2.00, 0.50),
    ]
    # net entry 5-3+4-2 = 4.00, current 1.5-0.7+1.2-0.5 = 1.50 -> captured 62.5%
    pairs = plan_exits(legs, [], G, today=TODAY)
    closed = sorted(o.legs[0].symbol for _, o in pairs)
    assert closed == ["SPY261016P00750000", "SPY261016P00760000"]
    assert all(o.legs[0].side == "buy" and len(o.legs) == 1 for _, o in pairs)
