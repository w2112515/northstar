"""LLM calls are a scarce resource (~20/day/model free tier): spend them only
where they carry information. Closed-market scheduled ticks and quiet passes
must not consume quota."""

from northstar.adkflows import trading_loop as tl
from northstar import llm as llm_mod


def _base_state(**over):
    s = {"proceed": True, "market_open": True, "reason": "scheduled"}
    s.update(over)
    return s


def test_closed_market_scheduled_tick_skips_llm(monkeypatch):
    monkeypatch.setattr(tl, "llm_available", lambda: True)
    out = tl.deterministic_triage(_base_state(market_open=False))
    assert out is not None
    assert out["triage_mode"] == "observe"
    assert out["triage_llm"] is False


def test_closed_market_manual_pass_still_asks_llm(monkeypatch):
    # someone is watching a manual/plan-activated pass - keep the judge
    monkeypatch.setattr(tl, "llm_available", lambda: True)
    assert tl.deterministic_triage(_base_state(market_open=False, reason="manual")) is None
    assert tl.deterministic_triage(_base_state(market_open=False, reason="plan_activated")) is None


def test_open_market_scheduled_tick_asks_llm(monkeypatch):
    monkeypatch.setattr(tl, "llm_available", lambda: True)
    assert tl.deterministic_triage(_base_state()) is None


def test_prefilter_halt_never_asks_llm(monkeypatch):
    monkeypatch.setattr(tl, "llm_available", lambda: True)
    out = tl.deterministic_triage(_base_state(proceed=False, prefilter_reason="kill switch is ON"))
    assert out["triage_mode"] == "halt"
    assert out["triage_llm"] is False


def test_no_key_defaults_to_act(monkeypatch):
    monkeypatch.setattr(tl, "llm_available", lambda: False)
    out = tl.deterministic_triage(_base_state())
    assert out["triage_mode"] == "act"
    assert out["triage_llm"] is False


def test_quiet_pass_digest_uses_template():
    assert tl.digest_worth_llm({"n_executed": 0, "n_exits": 0, "n_rejected": 0, "n_needs_human": 0}) is False
    assert tl.digest_worth_llm({}) is False


def test_eventful_pass_digest_earns_llm():
    assert tl.digest_worth_llm({"n_executed": 1}) is True
    assert tl.digest_worth_llm({"n_rejected": 2}) is True
    assert tl.digest_worth_llm({"n_needs_human": 1}) is True
    assert tl.digest_worth_llm({"n_exits": 1}) is True


def test_model_chain_has_three_rungs():
    chain = llm_mod._model_chain(None)
    assert chain == [llm_mod.FLASH_MODEL, llm_mod.FALLBACK_MODEL, llm_mod.FALLBACK2_MODEL]
    assert len(chain) == len(set(chain))


def test_quota_error_fast_fails_to_next_model(monkeypatch):
    """A 429 must not burn RETRY_PAUSE_S per attempt - jump models instead."""
    calls: list[str] = []
    slept: list[float] = []

    class FakeModels:
        def generate_content(self, model, contents, config):
            calls.append(model)
            raise RuntimeError("429 RESOURCE_EXHAUSTED. quota exceeded")

    class FakeClient:
        models = FakeModels()

    monkeypatch.setattr(llm_mod, "_client", lambda: FakeClient())
    monkeypatch.setattr("time.sleep", lambda s: slept.append(s))

    out = llm_mod._generate("hi", None, {})
    assert out is None
    # one attempt per model (no in-model retry), all three rungs tried
    assert calls == llm_mod._model_chain(None)
    assert slept == []
