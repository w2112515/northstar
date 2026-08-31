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
async def evolve(body: EvolveBody) -> dict:
    """Manual Lab trigger runs the ADK evolution graph (the nightly scheduler
    calls the same stage functions directly)."""
    from northstar.adkflows.evolution_flow import run_evolution_flow

    return await run_evolution_flow(family=body.family, n_candidates=body.n_candidates)


class DecisionBody(BaseModel):
    approve: bool


@router.post("/experiments/{experiment_id}/decision")
def decide(experiment_id: str, body: DecisionBody) -> dict:
    from northstar.evolution import decide_evolution

    return decide_evolution(experiment_id, body.approve)


class ShipyardBody(BaseModel):
    n: int = 3


@router.post("/shipyard")
def shipyard(body: ShipyardBody) -> dict:
    """Structural evolution round: design N whole strategy specs (DSL),
    walk-forward each, and surface at most one for human approval."""
    from northstar.dsl import run_shipyard_round

    return run_shipyard_round(get_store(), n=max(1, min(body.n, 5)))


@router.get("/mining")
def mining_state() -> dict:
    """Factor-mining search state (pending candidates) + the approved library."""
    store = get_store()
    return {
        "mining": store.get("state", "factor_mining"),
        "library": store.get("state", "factor_library"),
    }


@router.post("/mine")
def mine() -> dict:
    """One factor-mining round: restricted expression search, IC deflated by
    total tries, best survivor (if any) queued for human approval."""
    from northstar.mining import run_mining_round

    return run_mining_round(get_store())


class MiningDecision(BaseModel):
    candidate_id: str
    approve: bool


@router.post("/mining/decide")
def mining_decide(body: MiningDecision) -> dict:
    from northstar.mining import decide_mining

    return decide_mining(get_store(), body.candidate_id, body.approve)


@router.get("/slippage")
def slippage(family: str = "momentum_rotation", force: bool = False) -> dict:
    """Walk-forward slippage sensitivity (mid / 25% / 50% spread cross) for the
    family's champion params. Heavy (3 backtests on 4y bars) - cached per UTC day."""
    from datetime import datetime, timezone

    from northstar.backtest import slippage_sensitivity
    from northstar.broker import daily_bars
    from northstar.scout import CORE_UNIVERSE

    store = get_store()
    key = f"slippage_{family}"
    today = datetime.now(timezone.utc).date().isoformat()
    cached = store.get("lab_reports", key)
    if cached and not force and str(cached.get("ts", "")).startswith(today):
        return {**cached, "cached": True}

    champion = next(
        (d for d in store.list("instances")
         if d.get("family") == family and d.get("status") == "champion"),
        None,
    )
    params = (champion or {}).get("params") or {}
    universe = params.get("universe") or CORE_UNIVERSE
    bars = daily_bars(sorted(set(universe)), years=4.0)
    if not bars:
        return {"ok": False, "error": "no bars available for the universe"}
    report = {
        "ok": True,
        "ts": datetime.now(timezone.utc).isoformat(),
        "params_source": "champion" if champion else "defaults",
        **slippage_sensitivity(bars, params, family=family),
    }
    store.save("lab_reports", key, report)
    return {**report, "cached": False}


@router.get("/weather-validation")
def weather_validation(force: bool = False) -> dict:
    """Walk-forward study of the weather floor (vol proxy - honestly labeled).
    Heavy (4y bars + backtest), so the result is cached per UTC day."""
    from datetime import datetime, timezone

    from northstar.backtest.weather_gate import validate_weather_floor

    store = get_store()
    today = datetime.now(timezone.utc).date().isoformat()
    cached = store.get("lab_reports", "weather_validation")
    if cached and not force and str(cached.get("ts", "")).startswith(today):
        return {**cached, "cached": True}

    report = validate_weather_floor()
    if report.get("ok"):
        store.save("lab_reports", "weather_validation", report)
    return {**report, "cached": False}
