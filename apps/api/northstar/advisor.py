"""Helm Advisor: regime-conditioned sleeve-tilt suggestions, human-decided.

When the compass shows a stable regime and one crew has real (non-refused)
edge in that weather, the advisor proposes a BOUNDED reallocation of plan
weights toward it - at most TILT absolute, never below FLOOR per family, and
never more often than the cooldown. Adopt/dismiss is a separate endpoint from
the trade-approval money path: adopting rewrites plan allocations (which only
shapes future sizing); it never places, cancels, or bypasses anything.

Counterfactual honesty: every proposal - adopted or not - is scored ~5 trading
days later against realized strategy returns, and the ledger keeps both kinds.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any

from northstar.domain import JournalEvent, Plan, new_id

TILT = 0.10            # max absolute weight moved per proposal
FLOOR = 0.05           # no donor family goes below this
MIN_STREAK_DAYS = 3    # hysteresis: regime must hold this many days
COOLDOWN_DAYS = 5      # min days between proposals
SCORE_AFTER_DAYS = 7   # calendar days (~5 trading) before scoring an entry

EQUITY_FAMILIES = ("momentum_rotation", "rsi_mean_reversion", "ma_cross_trend")


# --------------------------------------------------------------------------- pure pieces

def build_tilts(weights: dict[str, float], best: str) -> dict[str, float] | None:
    """Bounded transfer toward `best` from the other equity families,
    proportional to how much room each donor has above the floor."""
    donors = {f: max(w - FLOOR, 0.0) for f, w in weights.items() if f != best}
    room = sum(donors.values())
    take = min(TILT, room)
    if best not in weights or take < 0.02:
        return None
    tilts = {f: round(-take * r / room, 4) for f, r in donors.items() if r > 0}
    tilts[best] = round(take, 4)
    return tilts


def pick_best_family(compass: dict[str, Any], allowed: list[str]) -> tuple[str, dict[str, Any]] | None:
    """Highest in-bucket Sharpe among non-refused families for today's regime."""
    label = (compass.get("regime") or {}).get("label")
    best: tuple[str, dict[str, Any]] | None = None
    for fam in allowed:
        stats = (compass.get("families") or {}).get(fam, {}).get(label) or {}
        if stats.get("refused") or stats.get("sharpe") is None:
            continue
        if best is None or stats["sharpe"] > best[1]["sharpe"]:
            best = (fam, stats)
    return best


# --------------------------------------------------------------------------- propose

def maybe_propose(store) -> dict[str, Any] | None:
    """Nightly check: stable regime + cooldown passed + real edge -> proposal."""
    from northstar.engine import active_plan

    plan, _goal = active_plan(store)
    compass = store.get("state", "compass") or {}
    regime = compass.get("regime") or {}
    if plan is None or not regime or regime.get("label") in (None, "unknown"):
        return None
    if int(regime.get("streak_days", 0)) < MIN_STREAK_DAYS:
        return None

    adv = store.get("state", "advisor") or {}
    if (adv.get("proposal") or {}).get("status") == "pending":
        return None
    last = adv.get("last_proposed_at")
    now = datetime.now(timezone.utc)
    if last and (now - datetime.fromisoformat(last)) < timedelta(days=COOLDOWN_DAYS):
        return None

    weights = {a.strategy_id: a.weight for a in plan.allocations if a.strategy_id in EQUITY_FAMILIES}
    if len(weights) < 2:
        return None
    best = pick_best_family(compass, list(weights))
    if best is None:
        return None
    fam, stats = best
    tilts = build_tilts(weights, fam)
    if tilts is None or tilts.get(fam, 0.0) <= 0:
        return None

    evidence = [
        f"regime {regime['label'].replace('_', ' ')} has held {regime['streak_days']} trading days",
        f"{fam} earned Sharpe {stats['sharpe']:.1f} across {stats['days']} historical days of this weather",
    ]
    try:
        from northstar.forecast import get_forecasts

        spy = ((get_forecasts(store) or {}).get("symbols") or {}).get("SPY")
        if spy:
            evidence.append(f"TimesFM leans {spy['exp_5d_pct']:+.1f}% on SPY over 5 days")
    except Exception:
        pass

    proposal = {
        "id": new_id("advice"),
        "ts": now.isoformat(),
        "regime_label": regime["label"],
        "plan_id": plan.id,
        "best_family": fam,
        "tilts": tilts,
        "evidence": evidence,
        "status": "pending",
    }
    store.save("state", "advisor", {**adv, "proposal": proposal, "last_proposed_at": now.isoformat()})
    store.append_event(
        JournalEvent(
            kind="approval",
            human=(
                f"Helm advisor: this weather has favored {fam.replace('_', ' ')} - proposing to "
                f"tilt {tilts[fam]:+.0%} toward it (bounded, reversible). Adopt or dismiss in the cockpit."
            ),
            payload=proposal,
            refs={"advice_id": proposal["id"]},
        )
    )
    return proposal


# --------------------------------------------------------------------------- decide

def decide_advice(store, adopt: bool) -> dict[str, Any]:
    adv = store.get("state", "advisor") or {}
    proposal = adv.get("proposal") or {}
    if proposal.get("status") != "pending":
        return {"ok": False, "error": "no pending advice"}

    proposal["status"] = "adopted" if adopt else "dismissed"
    proposal["decided_at"] = datetime.now(timezone.utc).isoformat()

    if adopt:
        plan_doc = store.get("plans", proposal["plan_id"])
        if not plan_doc:
            return {"ok": False, "error": "plan vanished"}
        plan = Plan.model_validate(plan_doc)
        for alloc in plan.allocations:
            delta = proposal["tilts"].get(alloc.strategy_id)
            if delta:
                alloc.weight = round(max(FLOOR, alloc.weight + delta), 4)
                alloc.why = (alloc.why + " " if alloc.why else "") + f"[advisor tilt {delta:+.0%} on {proposal['regime_label']}]"
        store.save("plans", plan.id, plan.model_dump())

    history = list(adv.get("history", []))
    history.append(proposal)
    store.save("state", "advisor", {**adv, "proposal": proposal, "history": history[-50:]})
    store.append_event(
        JournalEvent(
            kind="approval",
            human=(f"You adopted the helm advice - plan weights tilted toward {proposal['best_family'].replace('_', ' ')}."
                   if adopt else
                   "You dismissed the helm advice - weights unchanged. We'll still score what would have happened."),
            payload=proposal,
            refs={"advice_id": proposal["id"]},
        )
    )
    return {"ok": True, "decision": proposal["status"], "proposal": proposal}


# --------------------------------------------------------------------------- counterfactual ledger

def _family_recent_return(store, family: str, days: int = 5) -> float | None:
    """Realized last-N-day return of a family's champion (backtest replay on
    real bars - same math the lab uses, so the ledger can't flatter anyone)."""
    from northstar.backtest import ma_cross_backtest, momentum_backtest, rsi_reversion_backtest
    from northstar.broker import daily_bars

    runners = {
        "momentum_rotation": lambda bars, p: momentum_backtest(
            bars, int(p.get("lookback_days", 90)), int(p.get("top_n", 3)), int(p.get("rebalance_days", 5))),
        "rsi_mean_reversion": lambda bars, p: rsi_reversion_backtest(
            bars, int(p.get("rsi_period", 2)), float(p.get("entry_rsi", 10)),
            float(p.get("exit_rsi", 70)), int(p.get("trend_sma", 200)), int(p.get("max_names", 3))),
        "ma_cross_trend": lambda bars, p: ma_cross_backtest(
            bars, int(p.get("fast", 20)), int(p.get("slow", 100))),
    }
    runner = runners.get(family)
    champ = next((d for d in store.list("instances")
                  if d.get("family") == family and d.get("status") == "champion"), None)
    if runner is None or champ is None:
        return None
    params = champ.get("params") or {}
    universe = params.get("universe") or []
    if not universe:
        return None
    bars = daily_bars(sorted(set(universe)), years=1.5)
    if not bars:
        return None
    r = runner(bars, params).tail(days)
    return float(r.sum()) if len(r) else None


def score_advice(store) -> list[dict[str, Any]]:
    """Score every unscored ledger entry that is old enough: what the tilt
    would have added (or cost) per day, whether adopted or not."""
    adv = store.get("state", "advisor") or {}
    history = list(adv.get("history", []))
    now = datetime.now(timezone.utc)
    scored: list[dict[str, Any]] = []
    for entry in history:
        if entry.get("scored") or entry.get("status") == "pending":
            continue
        decided = entry.get("decided_at") or entry.get("ts")
        if (now - datetime.fromisoformat(decided)) < timedelta(days=SCORE_AFTER_DAYS):
            continue
        edge = 0.0
        parts: dict[str, float] = {}
        ok = True
        for fam, delta in (entry.get("tilts") or {}).items():
            r = _family_recent_return(store, fam, days=5)
            if r is None:
                ok = False
                break
            parts[fam] = round(r, 5)
            edge += delta * r
        if not ok:
            continue
        entry["scored"] = {
            "ts": now.isoformat(),
            "family_5d_returns": parts,
            "tilt_5d_edge": round(edge, 5),
        }
        scored.append(entry)
        verdict = "would have helped" if edge > 0 else "would have cost"
        store.append_event(
            JournalEvent(
                kind="system",
                human=(f"Advisor ledger: the {entry['regime_label']} tilt you "
                       f"{'adopted' if entry['status'] == 'adopted' else 'dismissed'} {verdict} "
                       f"{abs(edge):.2%} over 5 days. Both outcomes stay on the record."),
                payload=entry,
                refs={"advice_id": entry.get("id", "")},
            )
        )
    if scored:
        store.save("state", "advisor", {**adv, "history": history})
    return scored


def run_advisor(store) -> dict[str, Any]:
    """Nightly step: settle old ledger entries, then maybe propose."""
    if os.getenv("NORTHSTAR_ADVISOR_DISABLED"):
        return {"skipped": "advisor disabled by env"}
    settled = score_advice(store)
    proposal = maybe_propose(store)
    return {
        "scored": len(settled),
        "proposed": proposal["id"] if proposal else None,
    }
