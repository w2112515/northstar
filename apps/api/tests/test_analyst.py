"""AI Analyst debate: honest LLM-off path, Disagree-or-Commit, sizing, caps."""

import pandas as pd
import pytest

import northstar.strategies.analyst as analyst
from northstar.domain import StrategyInstance
from northstar.strategies.base import EngineContext


def bars(price=200.0, n=30):
    return pd.DataFrame({"close": [price] * n})


def make_ctx(positions=None, equity=100_000.0):
    return EngineContext(
        account={"equity": equity, "buying_power": equity},
        positions=positions or [],
        open_orders=[],
        bars={"NVDA": bars(200.0), "SPY": bars(700.0)},
    )


def make_instance():
    return StrategyInstance(family="ai_analyst", strategy_type="ai_analyst",
                            params={"universe": ["NVDA", "SPY"]}, version="v1")


BULL = {"trade": {"symbol": "NVDA", "direction": "bullish", "confidence": 0.95,
                  "thesis": "Strong momentum.", "invalidation": "breaks 5-day low"}}
CONCEDE = {"verdict": "concede", "confidence": 0.4, "objection": ""}
STRONG_OBJECT = {"verdict": "object", "confidence": 0.9,
                 "objection": "Momentum is stale and weather is stormy."}
WEAK_OBJECT = {"verdict": "object", "confidence": 0.3, "objection": "Slightly extended."}


@pytest.fixture(autouse=True)
def reset_cooldown(monkeypatch):
    analyst._last_call["ts"] = 0.0
    # debates must never touch the real journal in tests
    monkeypatch.setattr(analyst, "_journal_debate", lambda payload, human: DEBATES.append(payload))
    DEBATES.clear()
    yield


DEBATES: list[dict] = []


def mock_llm(monkeypatch, responses):
    """generate_json returns queued responses in call order."""
    queue = list(responses)
    calls = {"n": 0}

    def fake_json(*a, **k):
        calls["n"] += 1
        return queue.pop(0) if queue else None

    monkeypatch.setattr(analyst, "llm_available", lambda: True)
    monkeypatch.setattr(analyst, "generate_json", fake_json)
    return calls


def test_no_llm_key_means_no_proposals(monkeypatch):
    monkeypatch.setattr(analyst, "llm_available", lambda: False)
    assert analyst.propose(make_instance(), 0.2, make_ctx()) == []


def test_conceded_trade_sized_by_our_code(monkeypatch):
    mock_llm(monkeypatch, [BULL, CONCEDE])
    out = analyst.propose(make_instance(), 0.2, make_ctx())
    assert len(out) == 1
    p = out[0]
    assert p.strategy_type == "ai_analyst"
    assert p.conviction == 0.7            # capped, LLM said 0.95
    # budget = min(20k allocation, 5k notional cap) -> 5000/200 = 25 shares
    assert p.params == {"action": "buy", "qty": 25}
    assert p.thesis_human.startswith("AI Analyst (Gemini):")
    assert DEBATES[-1]["outcome"] == "committed"


def test_strong_objection_drops_trade(monkeypatch):
    calls = mock_llm(monkeypatch, [BULL, STRONG_OBJECT])
    assert analyst.propose(make_instance(), 0.2, make_ctx()) == []
    assert calls["n"] == 2
    assert DEBATES[-1]["outcome"] == "dropped_objection"


def test_weak_objection_commits_with_haircut(monkeypatch):
    mock_llm(monkeypatch, [BULL, WEAK_OBJECT])
    out = analyst.propose(make_instance(), 0.2, make_ctx())
    assert len(out) == 1
    assert out[0].conviction == pytest.approx(0.7 * 0.7)
    assert "Critic's caveat" in out[0].thesis_human
    assert DEBATES[-1]["outcome"] == "committed_with_caveat"


def test_critic_unavailable_drops_trade(monkeypatch):
    mock_llm(monkeypatch, [BULL, None])
    assert analyst.propose(make_instance(), 0.2, make_ctx()) == []
    assert DEBATES[-1]["outcome"] == "dropped_unreviewed"


def test_symbol_outside_universe_rejected_before_critic(monkeypatch):
    calls = mock_llm(monkeypatch, [
        {"trade": {"symbol": "GME", "direction": "bullish", "confidence": 0.9}}])
    assert analyst.propose(make_instance(), 0.2, make_ctx()) == []
    assert calls["n"] == 1  # invalid trades never reach the critic


def test_bearish_without_position_is_noop(monkeypatch):
    mock_llm(monkeypatch, [
        {"trade": {"symbol": "NVDA", "direction": "bearish", "confidence": 0.8}}, CONCEDE])
    assert analyst.propose(make_instance(), 0.2, make_ctx()) == []


def test_bearish_with_position_becomes_exit(monkeypatch):
    mock_llm(monkeypatch, [
        {"trade": {"symbol": "NVDA", "direction": "bearish", "confidence": 0.8,
                   "thesis": "Momentum rolling over."}}, CONCEDE])
    ctx = make_ctx(positions=[{"symbol": "NVDA", "qty": 25, "asset_class": "us_equity"}])
    out = analyst.propose(make_instance(), 0.2, ctx)
    assert len(out) == 1
    assert out[0].params == {"action": "sell", "qty": 25.0}


def test_null_trade_means_no_proposal_and_no_critic_call(monkeypatch):
    calls = mock_llm(monkeypatch, [{"trade": None}])
    assert analyst.propose(make_instance(), 0.2, make_ctx()) == []
    assert calls["n"] == 1


def test_cooldown_blocks_second_debate(monkeypatch):
    calls = mock_llm(monkeypatch, [{"trade": None}, {"trade": None}])
    analyst.propose(make_instance(), 0.2, make_ctx())
    analyst.propose(make_instance(), 0.2, make_ctx())
    assert calls["n"] == 1  # second pass inside the cooldown window never hit the API
