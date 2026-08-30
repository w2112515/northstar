"""Momentum sleeve budget: buys never propose past the family's allocation."""

import pandas as pd

from northstar.domain import StrategyInstance
from northstar.strategies.base import EngineContext
from northstar.strategies.momentum import propose


def bars(px: float, n: int = 120) -> pd.DataFrame:
    return pd.DataFrame({"close": [px] * n})


def ctx_with(positions: list[dict], universe_px: dict[str, float]) -> EngineContext:
    return EngineContext(
        account={"equity": 100_000.0},
        positions=positions,
        open_orders=[],
        bars={sym: bars(px) for sym, px in universe_px.items()},
    )


def inst() -> StrategyInstance:
    return StrategyInstance(
        family="momentum_rotation", strategy_type="momentum_rotation",
        params={"universe": ["AAA", "BBB"], "lookback_days": 90, "top_n": 2, "rebalance_days": 5},
        status="champion", version="v1",
    )


def held(symbol: str, qty: float, px: float) -> dict:
    return {"symbol": symbol, "qty": qty, "asset_class": "us_equity",
            "market_value": qty * px, "avg_entry_price": px}


def test_buys_trimmed_to_remaining_budget():
    # alloc = 30% * 100k = 30k; AAA already holds 28k -> only 2k left for BBB
    c = ctx_with([held("AAA", 280, 100.0)], {"AAA": 100.0, "BBB": 100.0})
    proposals = propose(inst(), 0.3, c)
    buys = [p for p in proposals if p.params.get("action") == "buy"]
    assert len(buys) == 1 and buys[0].underlying == "BBB"
    assert buys[0].params["qty"] == 20  # 2000 // 100, not the 150 unconstrained target


def test_full_sleeve_proposes_no_buys():
    c = ctx_with([held("AAA", 300, 100.0)], {"AAA": 100.0, "BBB": 100.0})
    proposals = propose(inst(), 0.3, c)
    assert [p for p in proposals if p.params.get("action") == "buy"] == []


def test_empty_sleeve_buys_both_names():
    c = ctx_with([], {"AAA": 100.0, "BBB": 100.0})
    proposals = propose(inst(), 0.3, c)
    buys = [p for p in proposals if p.params.get("action") == "buy"]
    # 15k per name at $100 -> 150 shares each, both within the 30k budget
    assert sorted(p.underlying for p in buys) == ["AAA", "BBB"]
    assert all(p.params["qty"] == 150 for p in buys)
