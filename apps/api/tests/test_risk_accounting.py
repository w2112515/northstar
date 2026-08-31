"""Whole-book deployed_risk: structure-aware, never books hedged wings as naked."""

import pytest

from northstar.engine import deployed_risk


def stock(symbol, mv):
    return {"symbol": symbol, "qty": 10, "asset_class": "us_equity", "market_value": mv}


def opt(symbol, qty, entry, mv):
    return {"symbol": symbol, "qty": qty, "asset_class": "us_option",
            "avg_entry_price": entry, "current_price": 1.0, "market_value": mv}


def test_stocks_count_at_market_value():
    assert deployed_risk([stock("NVDA", 30_000.0), stock("AMD", -5_000.0)]) == 35_000.0


def test_vertical_counts_max_loss_not_collateral():
    # bull put spread 750/740 x3, net credit 2.00 -> risk (10-2)*100*3 = $2,400
    # (the old collateral view would have said $225,000)
    legs = [
        opt("SPY261016P00750000", -3, 5.00, -1500.0),
        opt("SPY261016P00740000", 3, 3.00, 900.0),
    ]
    assert deployed_risk(legs) == pytest.approx(2_400.0)


def test_condor_counts_worst_side_minus_credit():
    # widths 20/20, total credit 1.60 -> (20 - 1.6) * 100 = $1,840
    legs = [
        opt("SPY261016P00740000", -1, 2.00, -40.0),
        opt("SPY261016P00720000", 1, 1.20, 20.0),
        opt("SPY261016C00860000", -1, 2.10, -50.0),
        opt("SPY261016C00880000", 1, 1.30, 25.0),
    ]
    assert deployed_risk(legs) == pytest.approx(1_840.0)


def test_lone_short_put_counts_cash_secured_collateral():
    legs = [opt("NVDA261016P00180000", -2, 3.00, -600.0)]
    assert deployed_risk(legs) == pytest.approx(36_000.0)


def test_mixed_book_adds_up():
    book = [
        stock("AMZN", 10_000.0),
        opt("SPY261016P00750000", -3, 5.00, -1500.0),
        opt("SPY261016P00740000", 3, 3.00, 900.0),
        opt("NVDA261016P00180000", -1, 3.00, -300.0),
    ]
    assert deployed_risk(book) == pytest.approx(10_000.0 + 2_400.0 + 18_000.0)


def test_long_only_options_count_market_value():
    assert deployed_risk([opt("SPY261016C00860000", 2, 1.50, 320.0)]) == pytest.approx(320.0)
