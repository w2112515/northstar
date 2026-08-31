"""Evolution loop: propose -> real walk-forward backtest -> score -> HITL gate.

Rules of honesty:
- Proposals come from Gemini Pro when a key exists, otherwise from a labeled
  deterministic grid ("grid_fallback"). The journal always says which.
- Fitness = OOS (walk-forward) metrics only. IS numbers are shown but never
  decide. Multiple-testing discount: OOS Sharpe is reduced by the expected
  maximum Sharpe of N null trials (Bailey & Lopez de Prado's deflated-Sharpe
  logic), so a family that has tried many candidates faces a higher bar.
- Nothing self-promotes: a winning candidate produces an approval card; a
  human decides. Lineage (parent, hypothesis, experiment) is stored forever.
"""

from __future__ import annotations

import math
import random
from datetime import datetime, timezone
from statistics import NormalDist
from typing import Any

from northstar.backtest import monte_carlo_goal, walk_forward_eval
from northstar.broker import daily_bars
from northstar.domain import (
    BacktestReport,
    EvolutionExperiment,
    Goal,
    JournalEvent,
    Lineage,
    Plan,
    StrategyInstance,
)
from northstar.engine import active_plan, ensure_default_instances
from northstar.journal import get_store
from northstar.llm import PRO_MODEL, generate_json, llm_available

# Evolvable families: bounded integer param spaces, backtested by real
# walk-forward rules in northstar.backtest (same code the live programs mirror).
PARAM_SPACES: dict[str, dict[str, tuple[int, int]]] = {
    "momentum_rotation": {
        "lookback_days": (30, 180),
        "top_n": (2, 5),
        "rebalance_days": (3, 15),
    },
    "rsi_mean_reversion": {
        "rsi_period": (2, 6),
        "entry_rsi": (5, 30),
        "exit_rsi": (50, 85),
        "trend_sma": (100, 250),
    },
    "ma_cross_trend": {
        "fast": (10, 50),
        "slow": (60, 250),
    },
}


def _champion(store, family: str) -> StrategyInstance | None:
    for doc in store.list("instances"):
        inst = StrategyInstance.model_validate(doc)
        if inst.family == family and inst.status == "champion":
            return inst
    return None


def _trials_in_family(store, family: str) -> int:
    return 1 + sum(1 for d in store.list("experiments") if d.get("family") == family)


def _clamp_params(p: dict[str, Any], family: str) -> dict[str, Any]:
    space = PARAM_SPACES[family]
    out = {}
    for k, (lo, hi) in space.items():
        v = int(p.get(k, lo))
        out[k] = max(lo, min(hi, v))
    if family == "ma_cross_trend" and out["slow"] <= out["fast"]:
        out["slow"] = min(out["fast"] + 20, space["slow"][1])
    return out


FAMILY_BLURBS = {
    "momentum_rotation": "a Top-N momentum rotation strategy (rank by lookback return, hold top_n, rebalance)",
    "rsi_mean_reversion": "an RSI mean-reversion strategy (buy RSI dips above a long trend SMA, sell the bounce)",
    "ma_cross_trend": "an MA-cross trend strategy (hold names whose fast SMA is above the slow SMA)",
}


def propose_candidates(
    champion: StrategyInstance, n: int, recent_reports: list[dict[str, Any]]
) -> tuple[list[dict[str, Any]], str]:
    """Returns (candidates, proposer). Candidate = {params, hypothesis}."""
    family = champion.family
    space = PARAM_SPACES[family]
    base = {k: champion.params.get(k, lo) for k, (lo, _) in space.items()}
    space_str = ", ".join(f"{k} {lo}-{hi}" for k, (lo, hi) in space.items())
    params_schema = ", ".join(f'"{k}": int' for k in space)

    if llm_available():
        resp = generate_json(
            f"You are a careful quant researcher improving {FAMILY_BLURBS.get(family, family)}. "
            f"Current champion params: {base}. Recent experiment results (params -> OOS sharpe): "
            f"{recent_reports[-6:]}. Param space: {space_str}. "
            f"Propose {n} DIVERSE candidates likely to improve out-of-sample risk-adjusted return. "
            "Avoid repeating past experiments. Reply JSON: {\"candidates\": [{\"params\": "
            "{" + params_schema + "}, "
            "\"hypothesis\": \"<one line: why this might work>\"}]}",
            model=PRO_MODEL,
            temperature=0.7,
        )
        if resp and isinstance(resp.get("candidates"), list) and resp["candidates"]:
            cands = [
                {"params": _clamp_params(c.get("params", {}), family),
                 "hypothesis": str(c.get("hypothesis", ""))[:300]}
                for c in resp["candidates"][:n]
            ]
            return cands, "gemini"

    # labeled deterministic fallback: one perturbed neighbor per param + one random jump
    rng = random.Random(42 + _now_seed())
    cands = []
    for key, (lo, hi) in list(space.items())[: max(n - 1, 1)]:
        cur = int(base.get(key) or lo)
        nudged = dict(base)
        # push this param halfway toward whichever bound is farther from it
        nudged[key] = (cur + hi) // 2 if (hi - cur) >= (cur - lo) else (cur + lo) // 2
        cands.append({"params": _clamp_params(nudged, family),
                      "hypothesis": f"systematic neighbor: move {key} toward the unexplored side (grid fallback)"})
    cands.append(
        {
            "params": _clamp_params({k: rng.randint(lo, hi) for k, (lo, hi) in space.items()}, family),
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


OOS_DAYS_ASSUMED = 300  # ~30% OOS of 4 years of trading days; documented constant
EULER_GAMMA = 0.5772156649015329


def sharpe_std_error(sr_ann: float, oos_days: int = OOS_DAYS_ASSUMED) -> float:
    """Lo (2002) standard error of an annualized Sharpe estimated on oos_days
    of daily returns: short windows make Sharpe a noisy number, and the
    deflation must know how noisy."""
    sr_daily = sr_ann / math.sqrt(252)
    return math.sqrt((1 + 0.5 * sr_daily * sr_daily) / max(oos_days, 2)) * math.sqrt(252)


def expected_max_sharpe(n_trials: int, sr_std: float) -> float:
    """Bailey & Lopez de Prado: expected MAX Sharpe among n_trials null
    strategies (true SR = 0), given the estimator's std. This is the honest
    'you tried n times, luck alone gets you this much' benchmark."""
    if n_trials <= 1 or sr_std <= 0:
        return 0.0
    inv = NormalDist().inv_cdf
    z1 = inv(1 - 1 / n_trials)
    z2 = inv(1 - 1 / (n_trials * math.e))
    return sr_std * ((1 - EULER_GAMMA) * z1 + EULER_GAMMA * z2)


def adjusted_oos_sharpe(report: BacktestReport) -> float | None:
    """Deflated OOS Sharpe: observed minus the expected max of that many null
    trials. More experiments in the family -> higher bar, by real math instead
    of the old 0.08*sqrt(n) placeholder."""
    if report.oos_sharpe is None:
        return None
    haircut = expected_max_sharpe(
        report.trials_in_family, sharpe_std_error(report.oos_sharpe)
    )
    return report.oos_sharpe - haircut


# --------------------------------------------------------------------------- goal-conditioned fitness

# Drawdown a risk tier is willing to live with, and how hard we punish beyond it.
RISK_DD_BUDGET = {"conservative": 0.12, "balanced": 0.20, "aggressive": 0.30}
RISK_DD_LAMBDA = {"conservative": 3.0, "balanced": 2.0, "aggressive": 1.0}


def goal_fit(oos_returns, report: BacktestReport, plan: Plan | None, goal: Goal | None) -> tuple[float | None, str]:
    """Personalization lives in the fitness function, not in a fake per-user model.

    Score = P(this candidate's OOS return stream compounds to the USER's
    required annual return over the USER's horizon; bootstrap Monte Carlo on
    monthly OOS returns) minus a risk-tier drawdown penalty. Same candidates,
    different goals -> different champions. Returns (None, "") without an
    active plan, and the caller falls back to the pure deflated-Sharpe rule.
    """
    if plan is None or goal is None or oos_returns is None or not len(oos_returns):
        return None, ""
    monthly = (1 + oos_returns).resample("ME").prod() - 1
    months = int(goal.horizon_months or 12)
    target = float((1 + plan.required_annual_return) ** (months / 12))
    mc = monte_carlo_goal(monthly, months=months, capital=1.0, target_amount=target)
    prob = mc.get("probability")
    if prob is None:
        return None, ""
    tier = str(goal.risk_level)
    dd = abs(report.max_dd or 0.0)
    penalty = RISK_DD_LAMBDA.get(tier, 2.0) * max(0.0, dd - RISK_DD_BUDGET.get(tier, 0.20))
    note = (
        f"P(>= {plan.required_annual_return:.0%}/yr over {months}mo) = {prob:.0%}"
        + (f", {tier} drawdown penalty -{penalty:.2f}" if penalty > 0
           else f", within the {tier} drawdown budget")
    )
    return round(float(prob) - penalty, 4), note


# --------------------------------------------------------------------------- round stages
# Split so the ADK evolution graph and run_evolution_round share ONE implementation.

def load_round(store, family: str) -> dict[str, Any]:
    """Stage 1: champion + bars + baseline eval. Returns {'error': ...} when not runnable."""
    ensure_default_instances(store)
    if family not in PARAM_SPACES:
        return {"error": f"family {family} is not evolvable yet (supported: {sorted(PARAM_SPACES)})"}
    champ = _champion(store, family)
    if champ is None:
        return {"error": f"no champion instance for {family} - enable it on the Strategies page first"}

    universe = champ.params.get("universe") or ["SPY", "QQQ", "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "AMD", "TSLA"]
    bars = daily_bars(sorted(set(universe)), years=4.0)
    champ_eval = walk_forward_eval(bars, champ.params, family=family)
    trials = _trials_in_family(store, family)
    champ_report = _report_from_eval(champ_eval, trials)
    plan, goal = active_plan(store)
    recent = [
        {"params": d.get("candidate_params"), "oos_sharpe": (d.get("backtest") or {}).get("oos_sharpe")}
        for d in store.list("experiments")
        if d.get("family") == family
    ]
    return {"champ": champ, "bars": bars, "champ_report": champ_report,
            "champ_eval": champ_eval, "plan": plan, "goal": goal,
            "trials": trials, "recent": recent}


def evaluate_candidates(
    store,
    setup: dict[str, Any],
    candidates: list[dict[str, Any]],
    proposer: str,
) -> dict[str, Any]:
    """Stage 2 (deterministic): walk-forward each candidate, journal, pick the best.

    Selection is goal-conditioned when a plan is active: the deflated Sharpe
    stays as a statistical floor (a candidate may not be materially worse than
    the champion), but the WINNER is whoever raises the odds of the user's own
    goal. Without a plan, the pure deflated-Sharpe rule applies unchanged.
    """
    champ: StrategyInstance = setup["champ"]
    champ_report: BacktestReport = setup["champ_report"]
    bars, trials = setup["bars"], setup["trials"]
    plan, goal = setup.get("plan"), setup.get("goal")

    champ_adj = adjusted_oos_sharpe(champ_report) or -99.0
    champ_fit, champ_fit_note = goal_fit(
        (setup.get("champ_eval") or {}).get("oos_returns"), champ_report, plan, goal
    )
    goal_mode = champ_fit is not None
    if goal_mode:
        champ_report.goal_fit, champ_report.goal_fit_note = champ_fit, champ_fit_note

    results: list[dict[str, Any]] = []
    best: EvolutionExperiment | None = None
    best_key = champ_fit if goal_mode else champ_adj

    for cand in candidates:
        params = {**champ.params, **cand["params"]}
        ev = walk_forward_eval(bars, params, family=champ.family)
        trials += 1
        report = _report_from_eval(ev, trials)
        adj = adjusted_oos_sharpe(report)
        fit, fit_note = goal_fit(ev.get("oos_returns"), report, plan, goal)
        if fit is not None:
            report.goal_fit, report.goal_fit_note = fit, fit_note
        exp = EvolutionExperiment(
            family=champ.family,
            parent_version=champ.version,
            hypothesis=cand["hypothesis"],
            proposed_by=proposer,
            params_delta=cand["params"],
            candidate_params=params,
            backtest=report,
            status="backtested",
        )
        dd_ok = (report.max_dd or -1) >= (champ_report.max_dd or -1) * 1.25
        if goal_mode:
            # DSR floor + goal-fit selector
            promote = (
                adj is not None and adj >= champ_adj - 0.05
                and fit is not None and fit > champ_fit + 0.02
                and dd_ok
            )
            key = fit if fit is not None else -99.0
        else:
            promote = adj is not None and adj > champ_adj + 0.05 and dd_ok
            key = adj if adj is not None else -99.0
        if promote and (best is None or key > best_key):
            best, best_key = exp, key
        reason = (
            f"goal-fit {fit:.2f} vs champion {champ_fit:.2f} ({fit_note}); "
            f"deflated Sharpe {adj if adj is None else round(adj, 2)} vs {round(champ_adj, 2)}"
            if goal_mode and fit is not None
            else f"adjusted OOS Sharpe {adj:.2f} vs champion {champ_adj:.2f}"
            if adj is not None
            else "no OOS Sharpe (insufficient data)"
        )
        exp.verdict_reason = reason + (
            "" if dd_ok else f"; drawdown {report.max_dd:.1%} too deep vs champion {champ_report.max_dd:.1%}"
        )
        store.save("experiments", exp.id, exp.model_dump())
        results.append(exp.model_dump())
        store.append_event(
            JournalEvent(
                kind="experiment",
                human=(
                    f"Lab test ({proposer}): {cand['hypothesis']} -> OOS Sharpe "
                    f"{report.oos_sharpe if report.oos_sharpe is not None else 'n/a'} "
                    f"(champion {champ_report.oos_sharpe})."
                    + (f" Goal-fit {fit:.2f} vs {champ_fit:.2f} - scored against YOUR plan."
                       if goal_mode and fit is not None else "")
                    + (" Candidate for promotion." if exp is best else " Archived.")
                ),
                payload=exp.model_dump(),
                refs={"experiment_id": exp.id},
            )
        )
    return {
        "results": results, "best": best, "best_adj": best_key, "champ_adj": champ_adj,
        "goal_mode": goal_mode, "champ_fit": champ_fit,
    }


def finalize_round(store, judged: dict[str, Any]) -> None:
    """Stage 3: winner -> approval card (a human decides); losers -> archive."""
    best: EvolutionExperiment | None = judged["best"]
    if best is not None:
        best.status = "awaiting_approval"
        store.save("experiments", best.id, best.model_dump())
        if judged.get("goal_mode") and best.backtest.goal_fit is not None:
            headline = (
                f"Evolution found a better crew member for YOUR goal: {best.hypothesis} "
                f"(goal-fit {best.backtest.goal_fit:.2f} vs champion {judged['champ_fit']:.2f}; "
                f"deflated-Sharpe floor held). Promote it? Your call."
            )
        else:
            headline = (
                f"Evolution found a better crew member: {best.hypothesis} "
                f"(adjusted OOS Sharpe {judged['best_adj']:.2f} vs champion {judged['champ_adj']:.2f}). "
                "Promote it? Your call."
            )
        store.append_event(
            JournalEvent(
                kind="approval",
                human=headline,
                payload=best.model_dump(),
                refs={"experiment_id": best.id},
            )
        )
    else:
        for r in judged["results"]:
            if r["status"] == "backtested":
                r["status"] = "archived"
                store.save("experiments", r["id"], r)


def run_evolution_round(family: str = "momentum_rotation", n_candidates: int = 3) -> dict[str, Any]:
    store = get_store()
    setup = load_round(store, family)
    if "error" in setup:
        return {"ok": False, "error": setup["error"]}

    candidates, proposer = propose_candidates(setup["champ"], n_candidates, setup["recent"])
    judged = evaluate_candidates(store, setup, candidates, proposer)
    finalize_round(store, judged)

    champ, champ_report = setup["champ"], setup["champ_report"]
    best = judged["best"]
    return {
        "ok": True,
        "proposer": proposer,
        "champion": {"version": champ.version, "params": champ.params, "report": champ_report.model_dump(),
                      "adjusted_oos_sharpe": round(judged["champ_adj"], 3)},
        "experiments": judged["results"],
        "promotion_candidate": best.model_dump() if best else None,
    }


TRIAL_DAYS = 3


def decide_evolution(experiment_id: str, approve: bool) -> dict[str, Any]:
    """Approval no longer promotes directly: the candidate first runs a
    paper trial (small allocation, TRIAL_DAYS). finalize_trials() settles it."""
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
    trial = {
        "start": datetime.now(timezone.utc).isoformat(),
        "days": TRIAL_DAYS,
        "parent_instance_id": champ.id if champ else None,
    }
    new_inst = StrategyInstance(
        family=exp.family,
        strategy_type=champ.strategy_type if champ else exp.family,
        version=new_version,
        params=exp.candidate_params,
        status="trial",
        paper_trial=trial,
        lineage=Lineage(parent_version=exp.parent_version, hypothesis=exp.hypothesis, experiment_id=exp.id),
    )
    if champ:
        champ.status = "archived"  # benched, restored automatically if the trial fails
        store.save("instances", champ.id, champ.model_dump())
    store.save("instances", new_inst.id, new_inst.model_dump())
    exp.status = "trial"
    exp.paper_trial = trial
    store.save("experiments", exp.id, exp.model_dump())
    store.append_event(
        JournalEvent(
            kind="experiment",
            human=(
                f"Approved to trial: {exp.family} {new_version} runs a {TRIAL_DAYS}-day paper trial "
                f"at reduced size (parent {exp.parent_version} benched, restored if the trial fails). "
                f"Hypothesis: {exp.hypothesis}"
            ),
            payload={"instance": new_inst.model_dump(), "experiment": exp.model_dump()},
            refs={"experiment_id": exp.id, "instance_id": new_inst.id},
        )
    )
    return {"ok": True, "decision": "trial", "instance": new_inst.model_dump()}


def _trial_window_violations(store, start_iso: str) -> list[str]:
    """Disqualifying events since the trial started: kill switch or hard breaker."""
    start = datetime.fromisoformat(start_iso)
    bad: list[str] = []
    for ev in store.events(kinds=["system", "verdict"], limit=2000):
        if datetime.fromisoformat(ev.ts) < start:
            continue
        if ev.kind == "system" and ev.payload.get("kill_switch") is True:
            bad.append("kill switch was pulled")
        if ev.kind == "verdict" and "BREAKER_HARD" in (ev.payload.get("reason_codes") or []):
            bad.append("hard circuit breaker tripped")
    return sorted(set(bad))


def finalize_trials(store) -> list[dict[str, Any]]:
    """Nightly: settle trials whose window has ended - promote on a clean
    window, otherwise archive the candidate and restore the benched parent."""
    now = datetime.now(timezone.utc)
    settled: list[dict[str, Any]] = []
    for doc in store.list("instances"):
        if doc.get("status") != "trial" or not doc.get("paper_trial"):
            continue
        inst = StrategyInstance.model_validate(doc)
        trial = inst.paper_trial or {}
        start = datetime.fromisoformat(str(trial.get("start")))
        days = int(trial.get("days", TRIAL_DAYS))
        if (now - start).days < days:
            continue

        violations = _trial_window_violations(store, str(trial.get("start")))
        exp_id = inst.lineage.experiment_id
        exp_doc = store.get("experiments", exp_id) if exp_id else None

        if violations:
            inst.status = "archived"
            store.save("instances", inst.id, inst.model_dump())
            parent_id = trial.get("parent_instance_id")
            parent = store.get("instances", parent_id) if parent_id else None
            if parent:
                parent["status"] = "champion"
                store.save("instances", parent_id, parent)
            if exp_doc:
                exp_doc["status"] = "archived"
                exp_doc["verdict_reason"] = (exp_doc.get("verdict_reason", "")
                                             + f" | trial failed: {', '.join(violations)}")
                store.save("experiments", exp_doc["id"], exp_doc)
            human = (
                f"Trial failed: {inst.family} {inst.version} is archived ({', '.join(violations)} "
                f"during its window). Parent version restored as champion."
            )
            outcome = "archived"
        else:
            inst.status = "champion"
            inst.paper_trial = None
            store.save("instances", inst.id, inst.model_dump())
            if exp_doc:
                exp_doc["status"] = "promoted"
                store.save("experiments", exp_doc["id"], exp_doc)
            human = (
                f"Trial passed: {inst.family} {inst.version} takes over as champion after a clean "
                f"{days}-day paper trial (no kill switch, no hard breaker)."
            )
            outcome = "promoted"

        store.append_event(
            JournalEvent(kind="experiment", human=human,
                         payload={"instance": inst.model_dump(), "outcome": outcome},
                         refs={"instance_id": inst.id, **({"experiment_id": exp_id} if exp_id else {})})
        )
        settled.append({"instance_id": inst.id, "family": inst.family,
                        "version": inst.version, "outcome": outcome})
    return settled
