"""Market view helpers: symbol validation and fill->marker extraction."""

from northstar.domain import JournalEvent
from northstar.market_view import fills_markers, valid_symbol


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
