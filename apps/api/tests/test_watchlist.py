"""Manual watch pool: pin/unpin lifecycle, validation, and universe merging."""

import northstar.market_view as market_view
from northstar.strategies.base import EngineContext, effective_universe
from northstar.watchlist import MAX_PINNED, add_manual, manual_history, manual_symbols, remove_manual
from tests.test_pnl import FakeStore


def ctx_with(positions=None, **kw) -> EngineContext:
    return EngineContext(account={"equity": 100_000.0}, positions=positions or [], open_orders=[], **kw)


def fake_bars(monkeypatch, has_data=True):
    monkeypatch.setattr(market_view, "bars_rows", lambda sym, days=10: [{"c": 1.0}] if has_data else [])


# --------------------------------------------------------------------------- lifecycle

def test_pin_normalizes_dedupes_and_unpins(monkeypatch):
    fake_bars(monkeypatch)
    s = FakeStore()

    out = add_manual(s, " nvda ")
    assert out["ok"] and out["symbols"] == ["NVDA"]
    assert s.event_log[-1].kind == "system" and "NVDA" in s.event_log[-1].human

    again = add_manual(s, "NVDA")
    assert again["ok"] and again["symbols"] == ["NVDA"] and "already" in again["note"]

    out = remove_manual(s, "NVDA")
    assert out["ok"] and out["symbols"] == []
    assert manual_symbols(s) == []
    assert manual_history(s) == ["NVDA"]  # history survives the unpin

    noop = remove_manual(s, "NVDA")
    assert noop["ok"] and "not pinned" in noop["note"]


def test_pin_rejects_garbage_and_missing_data(monkeypatch):
    s = FakeStore()
    fake_bars(monkeypatch)
    assert add_manual(s, "not a ticker!")["ok"] is False
    fake_bars(monkeypatch, has_data=False)
    out = add_manual(s, "ZZZQ")
    assert out["ok"] is False and "no market data" in out["error"]
    assert manual_symbols(s) == []


def test_pool_cap(monkeypatch):
    fake_bars(monkeypatch)
    s = FakeStore()
    for i in range(MAX_PINNED):
        assert add_manual(s, f"SY{i}")["ok"]
    out = add_manual(s, "ONEMORE")
    assert out["ok"] is False and "full" in out["error"]


# --------------------------------------------------------------------------- universe merge

def test_pins_join_scout_enabled_universes():
    ctx = ctx_with(manual_symbols=["PLTR"], scout_symbols=["VISN"])
    uni = effective_universe({"universe": ["SPY", "QQQ"]}, ctx)
    assert uni == ["SPY", "QQQ", "VISN", "PLTR"]

    # an instance that opted out of the radar keeps its static list only
    static = effective_universe({"universe": ["SPY"], "use_scout": False}, ctx)
    assert static == ["SPY"]


def test_unpinned_but_held_name_stays_tradable():
    held = [{"symbol": "PLTR", "qty": 10, "asset_class": "us_equity"}]
    ctx = ctx_with(positions=held, manual_symbols=[], manual_history=["PLTR"])
    uni = effective_universe({"universe": ["SPY"]}, ctx)
    assert "PLTR" in uni  # rotation can still sell it

    # once flat, the history name drops out
    flat = ctx_with(positions=[], manual_symbols=[], manual_history=["PLTR"])
    assert "PLTR" not in effective_universe({"universe": ["SPY"]}, flat)
