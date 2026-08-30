"""Manual close planner: equity both directions, whole-structure option closes."""

from northstar.manual import plan_manual_close


def eq(symbol="NVDA", qty=4.0, price=100.0, entry=90.0):
    return {"symbol": symbol, "qty": qty, "asset_class": "us_equity",
            "current_price": price, "avg_entry_price": entry}


def opt(symbol, qty, price=1.50, entry=2.00):
    return {"symbol": symbol, "qty": qty, "asset_class": "us_option",
            "current_price": price, "avg_entry_price": entry}


def test_equity_long_close_sells_with_basis():
    pair = plan_manual_close([eq()], "NVDA")
    assert pair is not None
    proposal, order = pair
    assert proposal.strategy_type == "manual_close"
    leg = order.legs[0]
    assert leg.side == "sell" and leg.qty == 4.0 and leg.asset_class == "us_equity"
    assert leg.limit_price is not None and leg.limit_price < 100.0
    assert order.meta["closing"] is True
    assert order.meta["signed_qty"] == 4.0
    assert order.meta["entry_price"] == 90.0
    assert order.meta["pnl_multiplier"] == 1


def test_equity_short_close_buys_above_mark():
    pair = plan_manual_close([eq(qty=-3.0)], "NVDA")
    assert pair is not None
    _, order = pair
    assert order.legs[0].side == "buy"
    assert order.legs[0].limit_price > 100.0
    assert order.meta["signed_qty"] == -3.0


def test_short_put_closes_as_buy_to_close():
    pos = opt("AAPL260918P00230000", -1.0)
    pair = plan_manual_close([pos], "AAPL260918P00230000")
    assert pair is not None
    proposal, order = pair
    leg = order.legs[0]
    assert leg.side == "buy" and leg.asset_class == "us_option"
    assert order.meta["closing"] is True and order.meta["signed_qty"] == -1.0
    assert "manual" in proposal.thesis_human.lower()


def test_vertical_leg_click_closes_whole_spread():
    short = opt("AAPL260918P00230000", -1.0, price=2.0, entry=3.0)
    long = opt("AAPL260918P00220000", 1.0, price=1.0, entry=1.5)
    pair = plan_manual_close([short, long], "AAPL260918P00220000")
    assert pair is not None
    _, order = pair
    assert len(order.legs) == 2                       # never leaves a naked leg
    assert order.meta.get("order_class") == "mleg"
    sides = {l.symbol: l.side for l in order.legs}
    assert sides["AAPL260918P00230000"] == "buy"      # short leg bought back
    assert sides["AAPL260918P00220000"] == "sell"     # long leg sold


def test_lone_long_option_sells_to_close():
    pos = opt("MSFT261120C00500000", 2.0, price=4.0, entry=3.0)
    pair = plan_manual_close([pos], "MSFT261120C00500000")
    assert pair is not None
    _, order = pair
    leg = order.legs[0]
    assert leg.side == "sell" and leg.qty == 2.0
    assert order.meta["signed_qty"] == 2.0 and order.meta["pnl_multiplier"] == 100


def test_unknown_or_flat_symbol_returns_none():
    assert plan_manual_close([eq()], "TSLA") is None
    assert plan_manual_close([eq(qty=0.0)], "NVDA") is None
