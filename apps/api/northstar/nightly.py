"""Nightly housekeeping - the part of the autonomy story that runs while the
user sleeps. The API scheduler triggers it once per UTC date (after 01:00 UTC,
well after the US close); POST /api/engine/nightly runs it on demand.

1. scout scan - full-market opportunity radar retargets the book
2. evolution round for every enabled evolvable champion family
3. plan odds recompute - makes the cockpit's "recomputed nightly" hint true
4. weather day summary from the accumulated weather_history readings
5. one equity point into state/equity_curve (report fallback data)
6. day log - P&L attribution + an honest narrative of the day
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

from northstar.domain import JournalEvent


def _today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _finalize_trials(store) -> list[dict[str, Any]]:
    from northstar.evolution.loop import finalize_trials

    return finalize_trials(store)


def _scout(store) -> dict[str, Any] | None:
    from northstar.scout import run_scout

    doc = run_scout(store)
    if doc.get("skipped"):
        return doc
    return {
        "source": doc.get("source"),
        "passed_floor": doc.get("passed_floor"),
        "top": [c["symbol"] for c in doc.get("candidates", [])[:5]],
    }


def _options_scan(store) -> dict[str, Any] | None:
    from northstar.scout import scan_options

    doc = scan_options(store)
    if doc.get("skipped"):
        return doc
    return {
        "scanned": doc.get("scanned"),
        "top": [f"{r['symbol']} {r['ann_yield']:.0%}" for r in doc.get("ranked", [])[:3]],
    }


def _factor_screen(store) -> dict[str, Any] | None:
    from northstar.factors import run_factor_screen

    doc = run_factor_screen(store)
    if doc.get("skipped") or doc.get("refused"):
        return doc
    return {
        "universe_size": doc.get("universe_size"),
        "strongest": [
            f"{r['factor']} {r['ic_recent']:+.3f}" for r in doc.get("rows", [])[:3]
            if r.get("ic_recent") is not None
        ],
    }


def _shipyard(store) -> dict[str, Any] | None:
    from northstar.dsl import run_shipyard_round

    doc = run_shipyard_round(store, n=3)
    if doc.get("skipped") or not doc.get("ok"):
        return doc
    return {
        "proposer": doc.get("proposer"),
        "specs_tested": doc.get("specs_tested"),
        "candidate": bool(doc.get("promotion_candidate")),
    }


def _mining(store) -> dict[str, Any] | None:
    from northstar.mining import run_mining_round

    doc = run_mining_round(store)
    if doc.get("skipped") or not doc.get("ok"):
        return doc
    return {
        "tried": doc.get("tried"),
        "tried_total": doc.get("tried_total"),
        "surfaced": (doc.get("surfaced") or {}).get("name"),
        "decayed": doc.get("decayed"),
    }


def _compass(store) -> dict[str, Any] | None:
    from northstar.regime import run_compass

    doc = run_compass(store)
    if doc.get("skipped") or doc.get("error"):
        return doc
    return {"regime": (doc.get("regime") or {}).get("label"),
            "streak": (doc.get("regime") or {}).get("streak_days"),
            "hypothesis_source": doc.get("hypothesis_source")}


def _advisor(store) -> dict[str, Any] | None:
    from northstar.advisor import run_advisor

    return run_advisor(store)


def _forecast_scorecard(store) -> dict[str, Any] | None:
    from northstar.forecast import score_forecasts

    return score_forecasts(store)


def _evolution_rounds(store) -> list[dict[str, Any]]:
    from northstar.evolution.loop import PARAM_SPACES, run_evolution_round

    champions = {
        d["family"] for d in store.list("instances")
        if d.get("status") == "champion" and d.get("enabled", True)
    }
    out = []
    for family in sorted(champions & set(PARAM_SPACES)):
        try:
            r = run_evolution_round(family, n_candidates=3)
            out.append({
                "family": family, "ok": r.get("ok", False),
                "proposer": r.get("proposer"),
                "promotion_candidate": bool(r.get("promotion_candidate")),
            })
        except Exception as e:
            out.append({"family": family, "ok": False, "error": str(e)})
    return out


def _recompute_plan_odds(store) -> dict[str, Any] | None:
    from northstar.broker import get_account_summary
    from northstar.domain import Goal
    from northstar.engine import active_plan
    from northstar.goalplanner.planner import plan_goal

    plan, goal = active_plan(store)
    if plan is None or goal is None:
        return None
    equity = get_account_summary()["equity"]
    elapsed_months = max(
        0, int((datetime.now(timezone.utc) - datetime.fromisoformat(goal.created_at)).days / 30)
    )
    remaining = max(1, int(goal.horizon_months or 12) - elapsed_months)
    tonight_goal = Goal(
        mode=goal.mode, capital_base=equity, target_amount=goal.target_amount,
        horizon_months=remaining, monthly_target=goal.monthly_target,
        risk_level=goal.risk_level,
    )
    fresh, _ = plan_goal(tonight_goal)
    old_prob = plan.probability
    doc = store.get("plans", plan.id) or plan.model_dump()
    doc["probability"] = fresh.probability
    doc["feasibility"] = fresh.feasibility
    store.save("plans", plan.id, doc)
    return {"probability": fresh.probability, "was": old_prob, "feasibility": fresh.feasibility,
            "equity": equity, "months_left": remaining}


def _weather_day_summary(store) -> dict[str, Any] | None:
    today = _today()
    readings = [
        r for r in store.list("weather_history")
        if str(r.get("ts", "")).startswith(today) and r.get("score") is not None
    ]
    if not readings:
        return None
    readings.sort(key=lambda r: r["ts"])
    scores = [int(r["score"]) for r in readings]
    buckets = [r["bucket"] for r in readings]
    transitions = sum(1 for a, b in zip(buckets, buckets[1:]) if a != b)
    return {
        "readings": len(scores), "avg": round(sum(scores) / len(scores)),
        "min": min(scores), "max": max(scores), "transitions": transitions,
        "last_bucket": buckets[-1],
    }


def _append_equity_point(store) -> float | None:
    from northstar.broker import get_account_summary

    equity = get_account_summary()["equity"]
    doc = store.get("state", "equity_curve") or {"points": []}
    today = _today()
    points = [p for p in doc["points"] if p.get("date") != today]
    points.append({"date": today, "equity": equity})
    store.save("state", "equity_curve", {"points": points[-400:]})
    return equity


def _weather_drift(store) -> dict[str, Any] | None:
    from northstar.backtest.weather_gate import weather_drift_check

    return weather_drift_check(store)


def _timesfm_forecasts(store) -> dict[str, Any] | None:
    from northstar.forecast import refresh_forecasts, timesfm_available

    if not timesfm_available():
        return {"skipped": "timesfm/torch not installed"}
    doc = refresh_forecasts(store)
    if doc is None:
        return {"skipped": "model or data unavailable"}
    return {"symbols": len(doc.get("symbols", {}))}


def _captain_facts(store, results: dict[str, Any]) -> dict[str, Any]:
    """Deterministic day summary the narrative must stick to."""
    today = _today()
    fills = [e for e in store.events(kinds=["fill"], limit=300) if e.ts.startswith(today)]
    pnls = [e for e in store.events(kinds=["pnl"], limit=300) if e.ts.startswith(today)]
    verdicts = [e for e in store.events(kinds=["verdict"], limit=300) if e.ts.startswith(today)]
    rejected = [e for e in verdicts if (e.payload or {}).get("verdict") == "rejected"]

    by_family: dict[str, float] = {}
    for e in pnls:
        fam = str((e.payload or {}).get("family") or "unattributed")
        by_family[fam] = by_family.get(fam, 0.0) + float((e.payload or {}).get("realized") or 0.0)

    scout_doc = store.get("state", "scout") or {}
    watch = [c["symbol"] for c in scout_doc.get("candidates", [])[:3]]
    odds = results.get("plan_odds")
    return {
        "date": today,
        "fills": len(fills),
        "realized_total": round(sum(by_family.values()), 2),
        "realized_by_family": {k: round(v, 2) for k, v in sorted(by_family.items())},
        "gate_rejections": len(rejected),
        "weather": results.get("weather"),
        "goal_odds": odds.get("probability") if isinstance(odds, dict) else None,
        "watch_tomorrow": watch,
    }


def _captain_template(facts: dict[str, Any]) -> str:
    bits: list[str] = []
    if facts["fills"]:
        bits.append(f"{facts['fills']} fill(s) hit the tape")
    if facts["realized_by_family"]:
        fam_str = ", ".join(f"{k} ${v:+,.2f}" for k, v in facts["realized_by_family"].items())
        bits.append(f"realized ${facts['realized_total']:+,.2f} ({fam_str})")
    if facts["gate_rejections"]:
        bits.append(f"the gate said no {facts['gate_rejections']} time(s)")
    day = "; ".join(bits) if bits else "a quiet day - no fills, nothing booked"
    watch = (
        f" Tomorrow the scout has us watching {', '.join(facts['watch_tomorrow'])}."
        if facts["watch_tomorrow"] else ""
    )
    return f"Day log, {facts['date']}: {day}.{watch}"


def _lessons(store) -> dict[str, Any]:
    from northstar.lessons import distill_lessons

    return distill_lessons(store)


def _captain_log(store, results: dict[str, Any]) -> dict[str, Any]:
    from northstar.llm import generate_text, llm_available

    facts = _captain_facts(store, results)
    narrative, narrator = None, "template"
    if llm_available() and not os.getenv("NORTHSTAR_CAPTAIN_LLM_DISABLED"):
        import json

        narrative = generate_text(
            "You are the narrator of NorthStar, an autonomous paper-trading desk with a "
            "hard risk gate. Never call the system a fleet, ship, or voyage and never "
            "call yourself a captain. Write tonight's log entry: 4-6 short plain-English sentences, "
            "first person plural, honest and dry. Stick strictly to these facts (never invent "
            f"numbers, never promise returns):\n{json.dumps(facts)}\n"
            "If the gate rejected trades, credit the discipline. If realized P&L is negative, "
            "say so plainly and what the system did about it. End with what we watch tomorrow.",
            temperature=0.5,
        )
        if narrative:
            narrator = "gemini"
    if not narrative:
        narrative = _captain_template(facts)
    return {**facts, "narrative": narrative.strip(), "narrator": narrator}


def run_nightly(store) -> dict[str, Any]:
    results: dict[str, Any] = {"ts": datetime.now(timezone.utc).isoformat()}

    for name, step in (
        ("scout", _scout),                   # retarget first: tonight's lab + tomorrow's pass use it
        ("options_scan", _options_scan),     # premium lens on the fresh radar
        ("factors", _factor_screen),         # grade known factors; tomorrow's scout may tilt
        ("trials", _finalize_trials),        # settle next: a promoted trial can evolve tonight
        ("evolution", _evolution_rounds),
        ("shipyard", _shipyard),             # structural evolution: design whole new specs
        ("mining", _mining),                 # expression search + library decay tracking
        ("plan_odds", _recompute_plan_odds),
        ("weather", _weather_day_summary),
        ("weather_drift", _weather_drift),
        ("compass", _compass),               # regime + conditional stats (needs scout pool)
        ("advisor", _advisor),               # settle the advice ledger, maybe propose a tilt
        ("forecast_score", _forecast_scorecard),  # grade yesterday BEFORE drawing today
        ("forecast", _timesfm_forecasts),
        ("equity", _append_equity_point),
        ("lessons", _lessons),               # cross-pass memory for tomorrow's triage
        ("captain", _captain_log),           # last: narrates everything above
    ):
        try:
            results[name] = step(store, results) if name == "captain" else step(store)
        except Exception as e:
            results[name] = {"error": f"{type(e).__name__}: {e}"}

    promo = sum(1 for r in (results.get("evolution") or []) if r.get("promotion_candidate"))
    odds = results.get("plan_odds")
    parts = []
    sc = results.get("scout")
    if isinstance(sc, dict) and sc.get("top"):
        parts.append(f"scout retargeted the book ({sc['passed_floor']} liquid names, top: {', '.join(sc['top'][:3])})")
    trials = results.get("trials") or []
    if isinstance(trials, list) and trials:
        promoted = sum(1 for t in trials if t.get("outcome") == "promoted")
        parts.append(f"{len(trials)} paper trial(s) settled ({promoted} promoted to champion)")
    evo = results.get("evolution") or []
    if evo:
        parts.append(f"lab ran {len(evo)} evolution round(s)"
                     + (f", {promo} promotion candidate(s) await you" if promo else ", no challenger beat a champion"))
    if isinstance(odds, dict) and "probability" in odds:
        parts.append(f"goal odds recomputed: {odds['probability']:.0%} (was {odds['was']:.0%})")
    wx = results.get("weather")
    if isinstance(wx, dict) and "avg" in wx:
        parts.append(f"weather averaged {wx['avg']} ({wx['readings']} readings, {wx['transitions']} shifts)")
    fc = results.get("forecast")
    if isinstance(fc, dict) and "symbols" in fc:
        parts.append(f"TimesFM drew fresh 5-day forecasts for {fc['symbols']} symbols")
    if isinstance(results.get("captain"), dict) and results["captain"].get("narrative"):
        parts.append("day log filed")
    human = "Night watch: " + ("; ".join(parts) if parts else "quiet night, nothing to report") + "."

    store.append_event(JournalEvent(kind="digest", human=human, payload=results))
    store.save("state", "nightly", {"last_run": _today(), "results_ts": results["ts"]})

    # one-pager artifact (equity / trades / regime / scout / day log) - built
    # after the digest so it can quote everything the night watch just did
    try:
        from northstar.report import build_daily_report

        build_daily_report(store, results)
        results["daily_report"] = {"ok": True}
    except Exception as e:
        results["daily_report"] = {"error": f"{type(e).__name__}: {e}"}
    return results
