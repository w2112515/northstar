"""Market view helpers: symbol validation, fill->marker extraction, quotes."""

import pandas as pd

from northstar.domain import JournalEvent
from northstar.market_view import _quotes_cache, fills_markers, quotes_rows, valid_symbol


def fill_event(symbol: str, human: str, price: float | None = 100.0, qty: float = 4.0):
    return JournalEvent(
        kind="fill",
        human=human,
        payload={"symbol": symbol, "filled_avg_price": price, "filled_qty": qty, "status": "filled"},
    )


def test_valid_symbol():
    assert valid_symbol("NVDA")
    assert valid_symbol("BRK.B")
    assert not valid_symbol("nvda")
    assert not valid_symbol("NVDA; DROP")
    assert not valid_symbol("")


def test_markers_match_equity_and_occ_options():
    # store.events() returns newest first; the option sell is the most recent
    events = [
        fill_event("NVDA260918P00170000", "Filled: sell 1x NVDA260918P00170000 (paper).", price=2.5, qty=1),
        fill_event("NVDA", "Filled: Buy 4 NVDA @ ~$180.00 (paper)."),
        fill_event("MSFT", "Filled: Buy 1 MSFT (paper)."),
        JournalEvent(kind="order", human="not a fill", payload={"symbol": "NVDA"}),
    ]
    markers = fills_markers(events, "NVDA")
    assert len(markers) == 2
    # chart wants oldest first: the equity buy precedes the option sell
    assert markers[0]["symbol"] == "NVDA" and markers[0]["side"] == "buy"
    assert markers[1]["symbol"].startswith("NVDA26") and markers[1]["side"] == "sell"
    assert markers[0]["price"] == 100.0


def test_markers_do_not_cross_prefix_tickers():
    # underlying "MS" must not match "MSFT" (only exact equity or OCC >15 chars)
    events = [fill_event("MSFT", "Filled: Buy 1 MSFT (paper).")]
    assert fills_markers(events, "MS") == []


# --------------------------------------------------------------------------- quotes

def _df(closes):
    idx = pd.date_range("2026-08-20", periods=len(closes), freq="B", tz="UTC")
    return pd.DataFrame({"close": closes}, index=idx)


def test_quotes_rows_last_and_day_change(monkeypatch):
    _quotes_cache.clear()
    monkeypatch.setattr(
        "northstar.broker.daily_bars",
        lambda symbols, years=0.1: {"SPY": _df([100.0, 102.0]), "QQQ": _df([50.0])},
    )
    out = quotes_rows(["spy", "QQQ", "bad symbol!!", "SPY"])
    assert out["SPY"]["last"] == 102.0 and out["SPY"]["prev_close"] == 100.0
    assert abs(out["SPY"]["chg"] - 0.02) < 1e-9
    # a single bar has no previous close - chg must be honest None, not 0
    assert out["QQQ"]["last"] == 50.0 and out["QQQ"]["chg"] is None
    assert all(valid_symbol(k) for k in out)


def test_quotes_rows_batches_and_caches(monkeypatch):
    _quotes_cache.clear()
    calls = {"n": 0}

    def fake(symbols, years=0.1):
        calls["n"] += 1
        assert isinstance(symbols, list) and len(symbols) == 2  # one batched call
        return {s: _df([10.0, 11.0]) for s in symbols}

    monkeypatch.setattr("northstar.broker.daily_bars", fake)
    quotes_rows(["SPY", "QQQ"])
    quotes_rows(["QQQ", "SPY"])  # same basket, different order -> cache hit
    assert calls["n"] == 1
