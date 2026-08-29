from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from northstar.domain import Goal, JournalEvent, Plan
from northstar.journal import get_store

router = APIRouter(prefix="/api/goal", tags=["goal"])


class GoalBody(BaseModel):
    mode: str = "target_amount"            # target_amount | monthly_income
    capital_base: float
    target_amount: float | None = None
    horizon_months: int | None = 12
    monthly_target: float | None = None
    risk_level: str = "balanced"


def _to_goal(body: GoalBody) -> Goal:
    return Goal(
        mode=body.mode,  # type: ignore[arg-type]
        capital_base=body.capital_base,
        target_amount=body.target_amount,
        horizon_months=body.horizon_months,
        monthly_target=body.monthly_target,
        risk_level=body.risk_level,  # type: ignore[arg-type]
    )


@router.post("/preview")
def preview(body: GoalBody) -> dict:
    from northstar.goalplanner import plan_goal

    goal = _to_goal(body)
    plan, extras = plan_goal(goal)
    return {"goal": goal.model_dump(), "plan": plan.model_dump(), **extras}


@router.post("/commit")
def commit(body: GoalBody) -> dict:
    from northstar.goalplanner import plan_goal

    store = get_store()
    goal = _to_goal(body)
    plan, extras = plan_goal(goal)
    plan.status = "active"

    # single active plan: retire previous ones
    for doc in store.list("plans"):
        if doc.get("status") == "active":
            doc["status"] = "halted"
            store.save("plans", doc["id"], doc)

    store.save("goals", goal.id, goal.model_dump())
    store.save("plans", plan.id, plan.model_dump())
    store.append_event(
        JournalEvent(
            kind="system",
            human=(
                f"Voyage plan activated: ${goal.capital_base:,.0f} toward "
                f"${extras['target_amount']:,.0f} in {extras['months']} months "
                f"({plan.probability:.0%} estimated odds, {goal.risk_level})."
            ),
            payload={"goal": goal.model_dump(), "plan": plan.model_dump()},
            refs={"plan_id": plan.id, "goal_id": goal.id},
        )
    )
    return {"goal": goal.model_dump(), "plan": plan.model_dump(), **extras}


@router.get("/current")
def current() -> dict:
    store = get_store()
    plans = [p for p in store.list("plans") if p.get("status") == "active"]
    if not plans:
        return {"plan": None, "goal": None}
    plan = sorted(plans, key=lambda p: p["created_at"])[-1]
    goal = store.get("goals", plan["goal_id"])
    return {"plan": plan, "goal": goal}
