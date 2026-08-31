"""One-sentence goal parsing: suggest-only, validated, honest when offline."""

import pytest
from fastapi import HTTPException

from northstar.api import routes_goal
from northstar.api.routes_goal import ParseBody


def _parse(monkeypatch, llm_out, text="Grow 100k to 110k in a year"):
    monkeypatch.setattr("northstar.llm.generate_json", lambda *a, **k: llm_out)
    return routes_goal.parse(ParseBody(text=text))


def test_full_sentence_maps_to_fields(monkeypatch):
    out = _parse(monkeypatch, {
        "mode": "target_amount", "capital_base": 100000, "target_amount": 110000,
        "horizon_months": 12, "monthly_target": None,
    })
    assert out["fields"] == {
        "mode": "target_amount", "capital_base": 100000.0,
        "target_amount": 110000.0, "horizon_months": 12,
    }


def test_mode_inferred_from_monthly_target(monkeypatch):
    out = _parse(monkeypatch, {"monthly_target": 800, "capital_base": 50000})
    assert out["fields"]["mode"] == "monthly_income"


def test_mode_inferred_from_target_amount(monkeypatch):
    out = _parse(monkeypatch, {"target_amount": 120000})
    assert out["fields"]["mode"] == "target_amount"


def test_llm_offline_is_503_not_fake(monkeypatch):
    with pytest.raises(HTTPException) as e:
        _parse(monkeypatch, None)
    assert e.value.status_code == 503


def test_garbage_types_rejected(monkeypatch):
    with pytest.raises(HTTPException) as e:
        _parse(monkeypatch, {"capital_base": "a lot", "horizon_months": 12})
    assert e.value.status_code == 422


def test_hallucinated_bounds_rejected(monkeypatch):
    # a trillion-dollar "parse" never reaches the form
    with pytest.raises(HTTPException) as e:
        _parse(monkeypatch, {"target_amount": 5e12})
    assert e.value.status_code == 422


def test_no_numbers_rejected(monkeypatch):
    with pytest.raises(HTTPException) as e:
        _parse(monkeypatch, {"mode": "target_amount"})
    assert e.value.status_code == 422


def test_empty_text_rejected(monkeypatch):
    with pytest.raises(HTTPException) as e:
        _parse(monkeypatch, {"target_amount": 1}, text="   ")
    assert e.value.status_code == 422


def test_overlong_text_rejected(monkeypatch):
    with pytest.raises(HTTPException) as e:
        _parse(monkeypatch, {"target_amount": 1}, text="x" * 401)
    assert e.value.status_code == 422
