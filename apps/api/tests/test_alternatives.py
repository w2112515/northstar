"""Honest alternatives: structured one-tap changes + legacy-doc compatibility."""

from northstar.domain import Alternative, Guardrails, Plan


def _plan(alts) -> Plan:
    return Plan.model_validate({
        "goal_id": "goal_x",
        "required_annual_return": 0.5,
        "feasibility": "red",
        "probability": 0.2,
        "max_drawdown_est": -0.2,
        "allocations": [],
        "guardrails": Guardrails(max_loss_per_trade_pct=0.01).model_dump(),
        "honest_alternatives": alts,
    })


def test_legacy_string_alternatives_still_load():
    # both live instances hold pre-8/31 plan docs with plain strings
    plan = _plan(["Aim lower.", "Give it longer."])
    assert [a.text for a in plan.honest_alternatives] == ["Aim lower.", "Give it longer."]
    assert all(a.changes == {} for a in plan.honest_alternatives)


def test_structured_alternatives_round_trip():
    plan = _plan([
        {"text": "Aim for $101,334 instead.", "changes": {"target_amount": 101334}},
        {"text": "Give it 36 months.", "changes": {"horizon_months": 36}},
        {"text": "Add capital."},
    ])
    dumped = plan.model_dump()["honest_alternatives"]
    assert dumped[0]["changes"] == {"target_amount": 101334.0}
    assert dumped[1]["changes"] == {"horizon_months": 36.0}
    assert dumped[2]["changes"] == {}


def test_alternative_defaults():
    a = Alternative(text="hello")
    assert a.changes == {}
