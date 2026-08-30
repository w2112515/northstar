"""Scout radar: liquidity floor, deterministic scoring, report lifecycle,
universe merging, and sleeve accounting for scout-entered positions."""

import numpy as np
import pandas as pd

import northstar.broker as broker
import northstar.scout as scout
from northstar.engine import sleeve_accounting
from northstar.scout import (
    DEFAULT_WEIGHTS,
    flavor_of,
    passes_floor,
    rank_candidates,
    run_scout,
    score_parts,
    scout_recent_pool,
    scout_symbols,
    total_score,
)
from northstar.scout import best_put_yield, options_watch_symbols, scan_options
from northstar.strategies.base import EngineContext, effective_underlyings, effective_universe
from tests.test_pnl import FakeStore


def frame(days=120, price=50.0, drift=0.0, vol_mult=1.0, gap=0.0, volume=2_000_000):
    idx = pd.date_range("2026-01-05", periods=days, freq="B", tz="UTC")
    closes = price * np.cumprod(np.full(days, 1.0 + drift))
    opens = closes.copy()
    if gap:
        opens[-1] = closes[-2] * (1 + gap)
    vols = np.full(days, float(volume))
    vols[-5:] *= vol_mult
    return pd.DataFrame(
        {"open": opens, "high": closes * 1.01, "low": closes * 0.99,
         "close": closes, "volume": vols},
        index=idx,
    )


# --------------------------------------------------------------------------- floor

def test_floor_rejects_penny_illiquid_and_short_history():
    assert passes_floor(frame()) is True
    assert passes_floor(frame(price=3.0)) is False                 # under $5
    assert passes_floor(frame(volume=100_000)) is False            # $5M/day << $25M floor
    assert passes_floor(frame(days=40)) is False                   # not enough history
    assert passes_floor(frame(drift=0.25)) is False                # +8800%/20d = split artifact


# --------------------------------------------------------------------------- scoring

def test_momentum_part_monotonic_and_flavor():
    hot = score_parts(frame(drift=0.006))
    mild = score_parts(frame(drift=0.001))
    assert hot["momentum"] > mild["momentum"]
    assert flavor_of(hot) == "uptrend"
    assert flavor_of(score_parts(frame(drift=-0.006))) == "selloff"
    assert flavor_of(score_parts(frame(drift=0.0))) == "range"


def test_volume_surge_and_gap_register():
    quiet = score_parts(frame())
    loud = score_parts(frame(vol_mult=3.0, gap=0.06))
    assert loud["volume_surge"] > quiet["volume_surge"]
    assert loud["gap"] > quiet["gap"]
    total_quiet = total_score(quiet, DEFAULT_WEIGHTS)
    total_loud = total_score(loud, DEFAULT_WEIGHTS)
    assert 0.0 <= total_quiet <= total_loud <= 1.0


def test_rank_candidates_orders_and_floors():
    bars = {
        "HOT": frame(drift=0.007, vol_mult=2.5),
        "FLAT": frame(drift=0.0),
        "PENNY": frame(price=2.0, drift=0.01),  # would score high, fails floor
    }
    top, passed = rank_candidates(bars, {s: "screener" for s in bars}, DEFAULT_WEIGHTS, top_k=5)
    assert passed == 2
    assert [c["symbol"] for c in top][0] == "HOT"
    assert all("reason" in c and c["parts"] for c in top)
    assert not any(c["symbol"] == "PENNY" for c in top)


# --------------------------------------------------------------------------- run + state

def _patch_market(monkeypatch, board, bars):
    monkeypatch.delenv("NORTHSTAR_SCOUT_DISABLED", raising=False)
    monkeypatch.setattr(scout, "fetch_screener_symbols", lambda **kw: board)
    monkeypatch.setattr(broker, "daily_bars", lambda symbols, years=0.6: {
        s: bars[s] for s in symbols if s in bars
    })


def test_run_scout_journals_report_and_accumulates_pool(monkeypatch):
    s = FakeStore()
    _patch_market(monkeypatch, ["AAA", "BBB"],
                  {"AAA": frame(drift=0.006), "BBB": frame(drift=0.001), "SPY": frame()})
    doc = run_scout(s, top_k=3)
    assert doc["source"] == "screener"
    assert [c["symbol"] for c in doc["candidates"]][0] == "AAA"
    assert doc["candidates"][0]["origin"] == "screener"
    assert s.event_log[-1].kind == "scout"
    assert "AAA" in s.event_log[-1].human
    assert scout_symbols(s)[0] == "AAA"

    # next night the board rotates; pool keeps yesterday's names for exits
    _patch_market(monkeypatch, ["CCC"], {"CCC": frame(drift=0.005), "SPY": frame()})
    run_scout(s, top_k=3)
    pool = scout_recent_pool(s)
    assert "AAA" in pool and "CCC" in pool


def test_run_scout_degrades_honestly_when_screener_dies(monkeypatch):
    s = FakeStore()
    monkeypatch.delenv("NORTHSTAR_SCOUT_DISABLED", raising=False)

    def boom(**kw):
        raise ConnectionError("no entitlement")

    monkeypatch.setattr(scout, "fetch_screener_symbols", boom)
    monkeypatch.setattr(broker, "daily_bars",
                        lambda symbols, years=0.6: {"SPY": frame(drift=0.002)})
    doc = run_scout(s)
    assert doc["source"] == "core_fallback"
    assert "screener unavailable" in doc["note"]
    assert [c["symbol"] for c in doc["candidates"]] == ["SPY"]
    assert "Note:" in s.event_log[-1].human


def test_run_scout_respects_disable_flag(monkeypatch):
    monkeypatch.setenv("NORTHSTAR_SCOUT_DISABLED", "1")
    assert run_scout(FakeStore()).get("skipped")


# --------------------------------------------------------------------------- universe merge

def _ctx(positions=None, scout_syms=None, pool=None):
    return EngineContext(
        account={"equity": 100_000.0}, positions=positions or [], open_orders=[],
        scout_symbols=scout_syms or [], scout_recent_pool=pool or [],
    )


def test_effective_universe_merges_scout_and_held_pool_names():
    held = [{"symbol": "BBB", "qty": 10, "asset_class": "us_equity", "market_value": 5000.0}]
    ctx = _ctx(positions=held, scout_syms=["AAA"], pool=["BBB", "CCC"])
    # CCC is in the pool but not held -> stays out; BBB is held -> stays sellable
    assert effective_universe({"universe": ["SPY"]}, ctx) == ["SPY", "AAA", "BBB"]


def test_effective_universe_opt_out():
    ctx = _ctx(scout_syms=["AAA"], pool=["AAA"])
    assert effective_universe({"universe": ["SPY"], "use_scout": False}, ctx) == ["SPY"]


def test_sleeve_accounting_counts_scout_positions(monkeypatch):
    s = FakeStore()
    s.save("instances", "i1", {
        "id": "i1", "family": "momentum_rotation", "enabled": True,
        "status": "champion", "params": {"universe": ["SPY"]},
    })
    s.save("state", "scout", {"candidates": [{"symbol": "XYZ"}], "recent_pool": ["XYZ"]})
    positions = [{"symbol": "XYZ", "qty": 100, "asset_class": "us_equity", "market_value": 30_000.0}]
    budgets, exposure = sleeve_accounting(s, None, 100_000.0, positions)
    assert exposure["momentum_rotation"] == 30_000.0  # radar buys count against the sleeve

    # opting out of scout -> XYZ no longer attributed to this family
    s.save("instances", "i1", {
        "id": "i1", "family": "momentum_rotation", "enabled": True,
        "status": "champion", "params": {"universe": ["SPY"], "use_scout": False},
    })
    _, exposure2 = sleeve_accounting(s, None, 100_000.0, positions)
    assert exposure2["momentum_rotation"] == 0.0


# --------------------------------------------------------------------------- options watch

from datetime import date  # noqa: E402


def _put(und: str, yymmdd: str, strike: float, bid: float, delta: float) -> dict:
    return {
        "symbol": f"{und}{yymmdd}P{int(strike * 1000):08d}",
        "bid": bid, "ask": bid + 0.05, "delta": delta,
    }


def test_best_put_yield_ranks_annualized_premium():
    today = date(2026, 8, 1)
    chain = [
        _put("XYZ", "260901", 95.0, 1.90, -0.25),   # 31 dte -> ~23.5%/yr
        _put("XYZ", "260901", 90.0, 0.60, -0.12),   # out of delta band
        _put("XYZ", "261016", 95.0, 3.20, -0.24),   # 76 dte -> ~16%/yr, loses
        {"symbol": "XYZ260901C00100000", "bid": 2.0, "ask": 2.1, "delta": 0.30},  # call ignored
    ]
    pick = best_put_yield(chain, today=today)
    assert pick is not None and pick["strike"] == 95.0 and pick["dte"] == 31
    assert pick["ann_yield"] > 0.20


def test_best_put_yield_none_when_no_band_puts():
    assert best_put_yield([_put("XYZ", "260901", 90.0, 0.60, -0.05)], today=date(2026, 8, 1)) is None


def test_scan_options_ranks_and_persists(monkeypatch):
    monkeypatch.delenv("NORTHSTAR_OPTIONS_SCAN_DISABLED", raising=False)
    s = FakeStore()
    s.save("state", "scout", {"candidates": [{"symbol": "AAA"}, {"symbol": "BBB"}]})

    chains = {
        # AAA pays better than BBB; broker call for CCC-like names raises
        "AAA": [_put("AAA", "271001", 100.0, 4.00, -0.25)],
        "BBB": [_put("BBB", "271001", 100.0, 1.00, -0.25)],
    }

    def fake_chain(und, dte_min, dte_max):
        if und not in chains:
            raise ConnectionError("no chain")
        return chains[und]

    monkeypatch.setattr(broker, "option_chain", fake_chain)
    doc = scan_options(s, max_underlyings=4)
    assert [r["symbol"] for r in doc["ranked"]] == ["AAA", "BBB"]
    assert doc["scanned"] == 4  # AAA, BBB + first two core names
    assert len(doc["no_usable_chain"]) == 2
    assert s.get("state", "options_watch")["ranked"][0]["symbol"] == "AAA"
    assert any(e.kind == "scout" and "Options watch" in e.human for e in s.event_log)
    assert options_watch_symbols(s, max_n=1) == ["AAA"]


def test_scan_options_respects_disable_flag(monkeypatch):
    monkeypatch.setenv("NORTHSTAR_OPTIONS_SCAN_DISABLED", "1")
    assert scan_options(FakeStore()).get("skipped")


def test_effective_underlyings_merges_watch_and_opt_out():
    ctx = EngineContext(
        account={"equity": 100_000.0}, positions=[], open_orders=[],
        options_watch=["NVDA", "AMD"],
    )
    assert effective_underlyings({"underlyings": ["AAPL", "NVDA"]}, ctx) == ["AAPL", "NVDA", "AMD"]
    assert effective_underlyings({"underlyings": ["AAPL"], "use_scout": False}, ctx) == ["AAPL"]
