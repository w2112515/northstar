"""Factor mining lite (C2): search RESTRICTED factor expressions, honestly.

An expression is a weighted blend of 2-3 REGISTERED factors (rank-combined -
the same restricted grammar the DSL uses, never arbitrary code). Every mining
round samples random blends plus optional Gemini-guided ones, scores each by
cross-sectional rank-IC against forward 5-day returns, and then DEFLATES the
best score by the expected maximum of that many null tries (Bailey & Lopez de
Prado's expected-max math) - the more we search, the higher the bar, and the
trial counter never resets.

Nothing enters the library by itself: a surviving candidate waits for a human.
Admitted factors get their IC re-measured every round (decay tracking) and are
handed to the shipyard as design context. Mining output NEVER touches orders.
"""

from __future__ import annotations

import os
import random
from datetime import datetime, timezone
from typing import Any

import pandas as pd

from northstar.domain import JournalEvent, new_id
from northstar.dsl import composite_scores
from northstar.factors import (
    FACTORS,
    MIN_SYMBOLS,
    daily_rank_ic,
    forward_returns,
    ic_summary,
)

EXPR_TERMS = (2, 3)              # blend size range
WEIGHT_GRID = (-1.0, -0.5, 0.5, 1.0)
DEFLATED_IC_FLOOR = 0.015        # deflated recent-window mean IC must clear this
MIN_IC_DAYS = 120                # fewer IC observations -> refuse to judge
DECAY_FRACTION = 0.25            # recent IC below this share of admission IC = decayed
WINDOW_DAYS = 250


# --------------------------------------------------------------------------- expressions

def normalize_terms(terms: dict[str, float]) -> dict[str, float] | None:
    """Validate + normalize an expression's terms against the registry."""
    clean: dict[str, float] = {}
    for fname, w in list(terms.items())[: EXPR_TERMS[1]]:
        if fname not in FACTORS:
            return None
        try:
            wf = float(w)
        except (TypeError, ValueError):
            return None
        if wf != 0.0:
            clean[fname] = max(-1.0, min(1.0, wf))
    if not (EXPR_TERMS[0] <= len(clean) <= EXPR_TERMS[1]):
        return None
    total = sum(abs(w) for w in clean.values())
    return {k: round(w / total, 4) for k, w in clean.items()}


def expression_name(terms: dict[str, float]) -> str:
    return " ".join(f"{w:+.0%}·{f}" for f, w in sorted(terms.items()))


def random_expressions(n: int, rng: random.Random) -> list[dict[str, float]]:
    """Sample n distinct random blends from the registry grammar."""
    names = sorted(FACTORS)
    seen: set[tuple] = set()
    out: list[dict[str, float]] = []
    attempts = 0
    while len(out) < n and attempts < n * 20:
        attempts += 1
        k = rng.choice(EXPR_TERMS)
        facs = rng.sample(names, k)
        terms = normalize_terms({f: rng.choice(WEIGHT_GRID) for f in facs})
        if terms is None:
            continue
        key = tuple(sorted(terms.items()))
        if key in seen:
            continue
        seen.add(key)
        out.append(terms)
    return out


def llm_expressions(store, n: int) -> list[dict[str, float]]:
    """Gemini-guided blends (schema-bound). Empty list when no key / bad reply."""
    from northstar.llm import generate_json, llm_available

    if not llm_available():
        return []
    ic_doc = store.get("state", "factor_ic") or {}
    ic_rows = [
        {"factor": r["factor"], "ic_recent": r["ic_recent"]}
        for r in ic_doc.get("rows", [])[:10]
    ]
    resp = generate_json(
        f"You are mining cross-sectional equity factors. Registry: {sorted(FACTORS)}. "
        f"Recent single-factor rank-IC vs forward 5d returns: {ic_rows}. "
        f"Propose {n} DIVERSE blends of 2-3 registry factors likely to predict forward "
        "5d returns better than any single factor. Weights in [-1, 1], negative = contrarian. "
        "Reply JSON only: {\"expressions\": [{\"factor_name\": weight, ...}]}",
        temperature=0.8,
    )
    out: list[dict[str, float]] = []
    if resp and isinstance(resp.get("expressions"), list):
        for raw in resp["expressions"][:n]:
            terms = normalize_terms(raw if isinstance(raw, dict) else {})
            if terms:
                out.append(terms)
    return out


# --------------------------------------------------------------------------- scoring

def evaluate_expression(
    bars: dict[str, pd.DataFrame], terms: dict[str, float], fwd: pd.DataFrame | None = None
) -> dict[str, Any]:
    """rank-IC summary of one blend over the evaluation window."""
    if fwd is None:
        fwd = forward_returns(bars).tail(WINDOW_DAYS)
    panel = composite_scores(bars, terms).tail(WINDOW_DAYS)
    return ic_summary(daily_rank_ic(panel, fwd))


def deflate_ic(ic_mean: float | None, ic_std_daily: float | None, n_days: int, n_trials: int) -> float | None:
    """Deflated mean IC: observed minus the expected max of n_trials null
    expressions (mean-IC estimator std = daily IC std / sqrt(n_days))."""
    from northstar.evolution.loop import expected_max_sharpe

    if ic_mean is None or n_days < MIN_IC_DAYS:
        return None
    est_std = (ic_std_daily or 0.15) / max(n_days, 1) ** 0.5
    return round(ic_mean - expected_max_sharpe(max(n_trials, 1), est_std), 4)


# --------------------------------------------------------------------------- round

def _mining_bars(store) -> dict[str, pd.DataFrame]:
    from northstar.broker import daily_bars
    from northstar.scout import CORE_UNIVERSE, scout_recent_pool, scout_symbols

    symbols = sorted(set(CORE_UNIVERSE) | set(scout_symbols(store)) | set(scout_recent_pool(store)))
    bars = daily_bars(symbols, years=1.6)
    return {s: df for s, df in bars.items() if df is not None and len(df) >= 140}


def run_mining_round(store, n_random: int = 8, n_llm: int = 3, bars: dict[str, pd.DataFrame] | None = None) -> dict[str, Any]:
    """One search round + decay tracking for the existing library."""
    if os.getenv("NORTHSTAR_MINING_DISABLED"):
        return {"skipped": "factor mining disabled by env"}

    bars = bars if bars is not None else _mining_bars(store)
    if len(bars) < MIN_SYMBOLS:
        return {"ok": False, "error": f"cross-section too thin ({len(bars)} names)"}

    state = store.get("state", "factor_mining") or {}
    tried_total = int(state.get("tried_total", 0))

    rng = random.Random(int(datetime.now(timezone.utc).strftime("%Y%m%d")) ^ tried_total)
    llm_terms = llm_expressions(store, n_llm)
    candidates = llm_terms + random_expressions(n_random, rng)
    guided = len(llm_terms)

    fwd = forward_returns(bars).tail(WINDOW_DAYS)
    scored: list[dict[str, Any]] = []
    for terms in candidates:
        tried_total += 1
        s = evaluate_expression(bars, terms, fwd)
        s["deflated_ic"] = deflate_ic(
            s["ic_mean"],
            None if s["ic_mean"] is None else abs(s["ic_mean"]) * 3 + 0.1,  # conservative daily-IC std proxy
            s["n_days"], tried_total,
        )
        scored.append({"terms": terms, "name": expression_name(terms), **s})

    scored.sort(key=lambda r: (r["deflated_ic"] if r["deflated_ic"] is not None else -9), reverse=True)
    best = scored[0] if scored else None
    pending = state.get("pending") or []
    surfaced = None
    if best and best["deflated_ic"] is not None and best["deflated_ic"] > DEFLATED_IC_FLOOR:
        surfaced = {
            "id": new_id("mine"),
            "ts": datetime.now(timezone.utc).isoformat(),
            "name": best["name"],
            "terms": best["terms"],
            "ic_mean": best["ic_mean"],
            "ic_recent": best["ic_recent"],
            "deflated_ic": best["deflated_ic"],
            "n_days": best["n_days"],
            "tried_total_at_find": tried_total,
            "status": "awaiting_approval",
        }
        pending = [p for p in pending if p.get("status") == "awaiting_approval"][-4:] + [surfaced]

    decayed = track_library_decay(store, bars, fwd)

    new_state = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "tried_total": tried_total,
        "last_round": [{k: v for k, v in r.items() if k != "terms"} | {"terms": r["terms"]} for r in scored[:6]],
        "pending": pending,
        "guided": guided,
    }
    store.save("state", "factor_mining", new_state)

    if surfaced:
        store.append_event(
            JournalEvent(
                kind="experiment",
                human=(
                    f"Factor mining surfaced a candidate: [{surfaced['name']}] deflated IC "
                    f"{surfaced['deflated_ic']:+.3f} after {tried_total} total tries (the bar rises with "
                    "every try). Awaiting YOUR approval before it enters the library."
                ),
                payload=surfaced,
            )
        )
    return {"ok": True, "tried": len(scored), "tried_total": tried_total,
            "guided": guided, "surfaced": surfaced, "decayed": decayed,
            "best": None if best is None else {"name": best["name"], "deflated_ic": best["deflated_ic"]}}


# --------------------------------------------------------------------------- library + decay

def decide_mining(store, candidate_id: str, approve: bool) -> dict[str, Any]:
    """Human gate: admit a mined expression to the library, or archive it."""
    state = store.get("state", "factor_mining") or {}
    pending = state.get("pending") or []
    cand = next((p for p in pending if p.get("id") == candidate_id), None)
    if cand is None or cand.get("status") != "awaiting_approval":
        return {"ok": False, "error": "no such pending candidate"}

    cand["status"] = "admitted" if approve else "archived"
    cand["decided_at"] = datetime.now(timezone.utc).isoformat()
    store.save("state", "factor_mining", {**state, "pending": pending})

    if approve:
        lib = store.get("state", "factor_library") or {"factors": []}
        lib["factors"].append({
            "id": cand["id"],
            "name": cand["name"],
            "terms": cand["terms"],
            "admitted_at": cand["decided_at"],
            "admission_ic": cand["ic_mean"],
            "ic_history": [],
            "decayed": False,
        })
        lib["ts"] = cand["decided_at"]
        store.save("state", "factor_library", lib)
    store.append_event(
        JournalEvent(
            kind="experiment",
            human=(f"You admitted [{cand['name']}] to the factor library - the shipyard can design with it now."
                   if approve else
                   f"You archived the mined candidate [{cand['name']}] - the try still counts against the search."),
            payload=cand,
        )
    )
    return {"ok": True, "decision": cand["status"], "candidate": cand}


def track_library_decay(store, bars: dict[str, pd.DataFrame], fwd: pd.DataFrame | None = None) -> list[str]:
    """Re-measure every library factor; flag the ones whose edge faded."""
    lib = store.get("state", "factor_library") or {}
    factors = lib.get("factors") or []
    if not factors:
        return []
    decayed_now: list[str] = []
    for f in factors:
        s = evaluate_expression(bars, f["terms"], fwd)
        f["ic_history"] = (f.get("ic_history") or [])[-19:] + [
            {"ts": datetime.now(timezone.utc).isoformat(), "ic_recent": s["ic_recent"], "n_days": s["n_days"]}
        ]
        admission = f.get("admission_ic") or 0.0
        recent = s["ic_recent"]
        was_decayed = bool(f.get("decayed"))
        f["decayed"] = (
            recent is not None and admission > 0 and recent < DECAY_FRACTION * admission
        )
        if f["decayed"] and not was_decayed:
            decayed_now.append(f["name"])
            store.append_event(
                JournalEvent(
                    kind="experiment",
                    human=(f"Library factor [{f['name']}] has decayed: recent IC {recent:+.3f} vs "
                           f"admission {admission:+.3f}. Flagged - consider retiring it."),
                    payload={"factor": f["name"], "ic_recent": recent, "admission_ic": admission},
                )
            )
    lib["ts"] = datetime.now(timezone.utc).isoformat()
    store.save("state", "factor_library", lib)
    return decayed_now


def library_context(store) -> list[dict[str, Any]]:
    """Approved library blends, for the shipyard's design context."""
    lib = store.get("state", "factor_library") or {}
    return [
        {"name": f["name"], "terms": f["terms"], "decayed": f.get("decayed", False)}
        for f in lib.get("factors") or []
    ]
