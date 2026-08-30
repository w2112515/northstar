"""Evolution round as a second Google ADK Workflow graph.

    START -> load_champion -> propose -> backtest -> judge_and_record

- load_champion / backtest / judge_and_record: deterministic nodes calling the
  exact same stage functions as run_evolution_round (northstar.evolution.loop) -
  one implementation, two entry points.
- propose: the LLM seat (Gemini Pro via propose_candidates, which itself
  degrades to a labeled grid fallback without a key).
- Nothing self-promotes here either: the winner becomes an approval card.

The Lab's manual trigger runs this graph; the nightly scheduler calls
run_evolution_round directly (same logic, no workflow overhead).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any

from google.adk import Context
from google.adk.workflow import START, Workflow, node

from northstar.evolution.loop import (
    evaluate_candidates,
    finalize_round,
    load_round,
    propose_candidates,
)
from northstar.journal import get_store


@dataclass
class RoundBoard:
    setup: dict[str, Any] = field(default_factory=dict)
    candidates: list[dict[str, Any]] = field(default_factory=list)
    proposer: str = ""
    judged: dict[str, Any] = field(default_factory=dict)
    result: dict[str, Any] = field(default_factory=dict)


_BOARDS: dict[str, RoundBoard] = {}


def _board(ctx: Context) -> RoundBoard:
    return _BOARDS[ctx.state["run_id"]]


@node(name="load_champion")
def load_champion(ctx: Context) -> dict[str, Any]:
    board = _board(ctx)
    board.setup = load_round(get_store(), str(ctx.state.get("family")))
    if "error" in board.setup:
        out = {"proceed": False, "error": board.setup["error"]}
    else:
        champ = board.setup["champ"]
        out = {
            "proceed": True,
            "champion_version": champ.version,
            "champion_oos_sharpe": board.setup["champ_report"].oos_sharpe,
            "trials_so_far": board.setup["trials"],
        }
    ctx.state.update(out)
    return out


@node(name="propose")
def propose(ctx: Context) -> dict[str, Any]:
    board = _board(ctx)
    if not ctx.state.get("proceed"):
        return {"n_candidates": 0}
    board.candidates, board.proposer = propose_candidates(
        board.setup["champ"], int(ctx.state.get("n_candidates", 3)), board.setup["recent"],
    )
    out = {"n_candidates": len(board.candidates), "proposer": board.proposer}
    ctx.state.update(out)
    return out


@node(name="backtest")
def backtest(ctx: Context) -> dict[str, Any]:
    board = _board(ctx)
    if not ctx.state.get("proceed") or not board.candidates:
        return {"n_tested": 0}
    board.judged = evaluate_candidates(get_store(), board.setup, board.candidates, board.proposer)
    out = {
        "n_tested": len(board.judged["results"]),
        "champion_adjusted_sharpe": round(board.judged["champ_adj"], 3),
        "best_adjusted_sharpe": round(board.judged["best_adj"], 3),
    }
    ctx.state.update(out)
    return out


@node(name="judge_and_record")
def judge_and_record(ctx: Context) -> dict[str, Any]:
    board = _board(ctx)
    if not ctx.state.get("proceed"):
        board.result = {"ok": False, "error": str(ctx.state.get("error", ""))}
        return {"promotion_candidate": False}
    if board.judged:
        finalize_round(get_store(), board.judged)
    best = (board.judged or {}).get("best")
    champ, champ_report = board.setup["champ"], board.setup["champ_report"]
    board.result = {
        "ok": True,
        "proposer": board.proposer,
        "champion": {"version": champ.version, "params": champ.params,
                     "report": champ_report.model_dump(),
                     "adjusted_oos_sharpe": round(board.judged.get("champ_adj", 0.0), 3)},
        "experiments": (board.judged or {}).get("results", []),
        "promotion_candidate": best.model_dump() if best else None,
    }
    out = {"promotion_candidate": best is not None}
    ctx.state.update(out)
    return out


def build_evolution_workflow() -> Workflow:
    return Workflow(
        name="northstar_evolution_round",
        description="load_champion -> propose (LLM) -> backtest (walk-forward) -> judge & record",
        edges=[
            (START, load_champion),
            (load_champion, propose),
            (propose, backtest),
            (backtest, judge_and_record),
        ],
    )


async def run_evolution_flow(family: str, n_candidates: int = 3) -> dict[str, Any]:
    """Run one evolution round through the ADK graph; result mirrors run_evolution_round."""
    from google.adk import Runner
    from google.adk.sessions import InMemorySessionService
    from google.genai import types as gtypes

    run_id = uuid.uuid4().hex[:10]
    _BOARDS[run_id] = RoundBoard()
    workflow = build_evolution_workflow()

    session_service = InMemorySessionService()
    runner = Runner(agent=workflow, app_name="northstar", session_service=session_service)
    session = await session_service.create_session(
        app_name="northstar", user_id="lab",
        state={"run_id": run_id, "family": family, "n_candidates": n_candidates},
    )

    async for _ in runner.run_async(
        user_id="lab", session_id=session.id,
        new_message=gtypes.Content(role="user", parts=[gtypes.Part(text=f"evolve:{family}")]),
    ):
        pass

    board = _BOARDS.pop(run_id, None)
    result = board.result if board else {"ok": False, "error": "board lost"}
    result["workflow"] = "northstar_evolution_round"
    return result
