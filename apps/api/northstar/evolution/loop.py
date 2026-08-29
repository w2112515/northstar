"""Evolution loop: propose -> real walk-forward backtest -> score -> HITL gate.

Rules of honesty:
- Proposals come from Gemini Pro when a key exists, otherwise from a labeled
  deterministic grid ("grid_fallback"). The journal always says which.
- Fitness = OOS (walk-forward) metrics only. IS numbers are shown but never
  decide. A light multiple-testing penalty discounts OOS Sharpe by the number
  of trials in the family (poor man's deflated Sharpe, labeled as such).
- Nothing self-promotes: a winning candidate produces an approval card; a
  human decides. Lineage (parent, hypothesis, experiment) is stored forever.
"""

from __future__ import annotations

import math
import random
from datetime import datetime, timezone
from typing import Any

from northstar.backtest import walk_forward_eval
from northstar.broker import daily_bars
from northstar.domain import (
    BacktestReport,
    EvolutionExperiment,
    JournalEvent,
    Lineage,
    StrategyInstance,
)
from northstar.engine import ensure_default_instances
from northstar.journal import get_store
from northstar.llm import PRO_MODEL, generate_json, llm_available

PARAM_SPACE = {
    "lookback_days": (30, 180),
    "top_n": (2, 5),
    "rebalance_days": (3, 15),
}


def _champion(store, family: str) -> StrategyInstance | None:
    for doc in store.list("instances"):
        inst = StrategyInstance.model_validate(doc)
        if inst.family == family and inst.status == "champion":
            return inst
    return None


def _trials_in_family(store, family: str) -> int:
    return 1 + sum(1 for d in store.list("experiments") if d.get("family") == family)


def _clamp_params(p: dict[str, Any]) -> dict[str, Any]:
    out = {}
    for k, (lo, hi) in PARAM_SPACE.items():
        v = int(p.get(k, lo))
        out[k] = max(lo, min(hi, v))
    return out


def propose_candidates(
    champion: StrategyInstance, n: int, recent_reports: list[dict[str, Any]]
) -> tuple[list[dict[str, Any]], str]:
    """Returns (candidates, proposer). Candidate = {params, hypothesis}."""
    base = {k: champion.params.get(k) for k in PARAM_SPACE}
    if llm_available():
        resp = generate_json(
            "You are a careful quant researcher improving a Top-N momentum rotation strategy. "
            f"Current champion params: {base}. Recent experiment results (params -> OOS sharpe): "
            f"{recent_reports[-6:]}. Param space: lookback_days 30-180, top_n 2-5, rebalance_days 3-15. "
            f"Propose {n} DIVERSE candidates likely to improve out-of-sample risk-adjusted return. "
            "Avoid repeating past experiments. Reply JSON: {\"candidates\": [{\"params\": "
            "{\"lookback_days\": int, \"top_n\": int, \"rebalance_days\": int}, "
            "\"hypothesis\": \"<one line: why this might work>\"}]}",
            model=PRO_MODEL,
            temperature=0.7,
        )
        if resp and isinstance(resp.get("candidates"), list) and resp["candidates"]:
            cands = [
                {"params": _clamp_params(c.get("params", {})), "hypothesis": str(c.get("hypothesis", ""))[:300]}
                for c in resp["candidates"][:n]
            ]
            return cands, "gemini"

    # labeled deterministic fallback: neighbors + one random jump
    rng = random.Random(42 + _now_seed())
    cands = []
    neighbors = [
        {"lookback_days": int(base["lookback_days"] or 90) // 2, "top_n": base["top_n"], "rebalance_days": base["rebalance_days"]},
        {"lookback_days": min(180, int(base["lookback_days"] or 90) * 2), "top_n": base["top_n"], "rebalance_days": base["rebalance_days"]},
        {"lookback_days": base["lookback_days"], "top_n": (base["top_n"] or 3) + 1, "rebalance_days": base["rebalance_days"]},
    ]
    for nb in neighbors[: max(n - 1, 1)]:
        cands.append({"params": _clamp_params(nb), "hypothesis": "systematic neighbor of the champion (grid fallback)"})
    cands.append(
        {
            "params": _clamp_params(
                {
                    "lookback_days": rng.randrange(30, 181, 10),
                    "top_n": rng.randint(2, 5),
                    "rebalance_days": rng.randrange(3, 16, 2),
                }
            ),
            "hypothesis": "random exploration point (grid fallback)",
        }
    )
    return cands[:n], "grid_fallback"


def _now_seed() -> int:
    return int(datetime.now(timezone.utc).strftime("%Y%m%d"))


def _report_from_eval(ev: dict[str, Any], trials: int) -> BacktestReport:
    return BacktestReport(
        is_sharpe=_r(ev["is"]["sharpe"]),
        oos_sharpe=_r(ev["oos"]["sharpe"]),
        ann_return=_r(ev["oos"]["ann_return"]),
        max_dd=_r(ev["oos"]["max_dd"]),
        win_rate=_r(ev["oos"]["win_rate"]),
        trials_in_family=trials,
        data_note=ev["data_note"],
    )


def _r(x) -> float | None:
    return None if x is None else round(float(x), 4)


def adjusted_oos_sharpe(report: BacktestReport) -> float | None:
    """Multiple-testing haircut: more trials -> higher bar (labeled approximation)."""
    if report.oos_sharpe is None:
        return None
    penalty = 0.08 * math.sqrt(max(report.trials_in_family - 1, 0))
    return report.oos_sharpe - penalty


def run_evolution_round(family: str = "momentum_rotation", n_candidates: int = 3) -> dict[str, Any]:
    store = get_store()
    ensure_default_instances(store)
    champ = _champion(store, family)
    if champ is None:
        return {"ok": False, "error": f"no champion instance for {family}"}

    universe = champ.params.get("universe") or ["SPY", "QQQ", "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "AMD", "TSLA"]
    bars = daily_bars(sorted(set(universe)), years=4.0)

    champ_eval = walk_forward_eval(bars, champ.params)
    trials = _trials_in_family(store, family)
    champ_report = _report_from_eval(champ_eval, trials)

    recent = [
        {"params": d.get("candidate_params"), "oos_sharpe": (d.get("backtest") or {}).get("oos_sharpe")}
        for d in store.list("experiments")
        if d.get("family") == family
    ]
    candidates, proposer = propose_candidates(champ, n_candidates, recent)

    results = []
    best: EvolutionExperiment | None = None
    best_adj = adjusted_oos_sharpe(champ_report) or -99.0
    champ_adj = best_adj

    for cand in candidates:
        params = {**champ.params, **cand["params"]}
        ev = walk_forward_eval(bars, params)
        trials += 1
        report = _report_from_eval(ev, trials)
        exp = EvolutionExperiment(
            family=family,
            parent_version=champ.version,
            hypothesis=cand["hypothesis"],
            proposed_by=proposer,
            params_delta=cand["params"],
            candidate_params=params,
            backtest=report,
            status="backtested",
        )
        adj = adjusted_oos_sharpe(report)
        dd_ok = (report.max_dd or -1) >= (champ_report.max_dd or -1) * 1.25
        promote = adj is not None and adj > champ_adj + 0.05 and dd_ok
        if promote and (best is None or adj > best_adj):
            best, best_adj = exp, adj
        exp.verdict_reason = (
            f"adjusted OOS Sharpe {adj:.2f} vs champion {champ_adj:.2f}"
            + ("" if dd_ok else f"; drawdown {report.max_dd:.1%} too deep vs champion {champ_report.max_dd:.1%}")
        )
        store.save("experiments", exp.id, exp.model_dump())
        results.append(exp.model_dump())
        store.append_event(
            JournalEvent(
                kind="experiment",
                human=(
                    f"Lab test ({proposer}): {cand['hypothesis']} -> OOS Sharpe "
                    f"{report.oos_sharpe if report.oos_sharpe is not None else 'n/a'} "
                    f"(champion {champ_report.oos_sharpe}). {'Candidate for promotion.' if exp is best else 'Archived.'}"
                ),
                payload=exp.model_dump(),
                refs={"experiment_id": exp.id},
            )
        )

    if best is not None:
        best.status = "awaiting_approval"
        store.save("experiments", best.id, best.model_dump())
        store.append_event(
            JournalEvent(
                kind="approval",
                human=(
                    f"Evolution found a better crew member: {best.hypothesis} "
                    f"(adjusted OOS Sharpe {best_adj:.2f} vs champion {champ_adj:.2f}). "
                    "Promote it? Your call."
                ),
                payload=best.model_dump(),
                refs={"experiment_id": best.id},
            )
        )
    else:
        for r in results:
            if r["status"] == "backtested":
                r["status"] = "archived"
                store.save("experiments", r["id"], r)

    return {
        "ok": True,
        "proposer": proposer,
        "champion": {"version": champ.version, "params": champ.params, "report": champ_report.model_dump(),
                      "adjusted_oos_sharpe": round(champ_adj, 3)},
        "experiments": results,
        "promotion_candidate": best.model_dump() if best else None,
    }


def decide_evolution(experiment_id: str, approve: bool) -> dict[str, Any]:
    store = get_store()
    doc = store.get("experiments", experiment_id)
    if not doc or doc.get("status") != "awaiting_approval":
        return {"ok": False, "error": "experiment not awaiting approval"}
    exp = EvolutionExperiment.model_validate(doc)

    if not approve:
        exp.status = "archived"
        exp.verdict_reason += " | rejected by human"
        store.save("experiments", exp.id, exp.model_dump())
        store.append_event(
            JournalEvent(kind="experiment", human=f"You archived the candidate: {exp.hypothesis}",
                         payload=exp.model_dump(), refs={"experiment_id": exp.id}))
        return {"ok": True, "decision": "archived"}

    champ = _champion(store, exp.family)
    new_version = f"v{int((champ.version if champ else 'v1')[1:]) + 1}" if champ else "v2"
    new_inst = StrategyInstance(
        family=exp.family,
        strategy_type=champ.strategy_type if champ else "momentum_rotation",
        version=new_version,
        params=exp.candidate_params,
        status="champion",
        lineage=Lineage(parent_version=exp.parent_version, hypothesis=exp.hypothesis, experiment_id=exp.id),
    )
    if champ:
        champ.status = "archived"
        store.save("instances", champ.id, champ.model_dump())
    store.save("instances", new_inst.id, new_inst.model_dump())
    exp.status = "promoted"
    store.save("experiments", exp.id, exp.model_dump())
    store.append_event(
        JournalEvent(
            kind="experiment",
            human=(
                f"Promoted: {exp.family} {new_version} takes the helm "
                f"(parent {exp.parent_version}, hypothesis: {exp.hypothesis})."
            ),
            payload={"instance": new_inst.model_dump(), "experiment": exp.model_dump()},
            refs={"experiment_id": exp.id, "instance_id": new_inst.id},
        )
    )
    return {"ok": True, "decision": "promoted", "instance": new_inst.model_dump()}
