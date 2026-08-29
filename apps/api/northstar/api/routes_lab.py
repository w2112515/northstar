from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from northstar.journal import get_store

router = APIRouter(prefix="/api/lab", tags=["lab"])


@router.get("/experiments")
def experiments() -> dict:
    docs = get_store().list("experiments")
    docs.sort(key=lambda d: d.get("created_at", ""), reverse=True)
    return {"experiments": docs}


class EvolveBody(BaseModel):
    family: str = "momentum_rotation"
    n_candidates: int = 3


@router.post("/evolve")
def evolve(body: EvolveBody) -> dict:
    from northstar.evolution import run_evolution_round

    return run_evolution_round(family=body.family, n_candidates=body.n_candidates)


class DecisionBody(BaseModel):
    approve: bool


@router.post("/experiments/{experiment_id}/decision")
def decide(experiment_id: str, body: DecisionBody) -> dict:
    from northstar.evolution import decide_evolution

    return decide_evolution(experiment_id, body.approve)
