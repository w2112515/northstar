"""Strategy DSL v0 (the shipyard): STRUCTURAL evolution, not just parameter tuning.

A StrategySpec is a tiny, fully-validated description of a rotation strategy:

    {"name": "...", "archetype": "rotation",
     "signal": {"factors": {"mom_60d": 0.6, "dist_52w_high": 0.4}},
     "filter": {"spy_trend_sma": 200},          # 0/None = no market filter
     "top_n": 2, "rebalance_days": 5,
     "universe": ["AAPL", "MSFT", ...]}         # 2..12 names

The signal is a weighted blend of REGISTERED factors (northstar.factors) -
restricted grammar, never arbitrary code. One generic backtest executes any
valid spec, plugged into the same walk-forward + deflated-Sharpe + goal-fit +
human-approval + paper-trial pipeline every other candidate faces. Gemini may
PROPOSE specs (schema-bound); a deterministic template set is the fallback.
The DSL never invents factors and never touches the money path directly.
"""

from __future__ import annotations

import os
import random
from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd

from northstar.factors import FACTORS

ARCHETYPES = ("rotation",)
MAX_FACTORS = 4
TOP_N_RANGE = (1, 4)
REBALANCE_RANGE = (2, 21)
UNIVERSE_RANGE = (2, 12)
TREND_SMA_RANGE = (50, 250)
WARMUP_DAYS = 260  # dist_52w_high needs the deepest history (min_periods=120) + slack


# --------------------------------------------------------------------------- validation

def validate_spec(raw: dict[str, Any]) -> tuple[dict[str, Any] | None, list[str]]:
    """Clamp + validate a raw spec. Returns (clean_spec, errors).

    errors non-empty -> spec is unusable and clean_spec is None. Values that
    are merely out of range are clamped (that's a repair, not an error).
    """
    errors: list[str] = []
    if not isinstance(raw, dict):
        return None, ["spec must be an object"]

    name = str(raw.get("name", "")).strip()[:48] or "unnamed spec"
    archetype = str(raw.get("archetype", "rotation"))
    if archetype not in ARCHETYPES:
        errors.append(f"archetype must be one of {ARCHETYPES}")

    factors_raw = ((raw.get("signal") or {}).get("factors")) or {}
    if not isinstance(factors_raw, dict) or not factors_raw:
        errors.append("signal.factors must be a non-empty mapping")
        factors: dict[str, float] = {}
    else:
        factors = {}
        for fname, w in list(factors_raw.items())[:MAX_FACTORS]:
            if fname not in FACTORS:
                errors.append(f"unknown factor '{fname}' (registry only)")
                continue
            try:
                wf = float(w)
            except (TypeError, ValueError):
                errors.append(f"factor weight for '{fname}' is not a number")
                continue
            if wf != 0.0:
                factors[fname] = max(-1.0, min(1.0, wf))
        if not factors and not errors:
            errors.append("signal.factors has no usable non-zero weights")
        total = sum(abs(w) for w in factors.values())
        if total > 0:
            factors = {k: round(w / total, 4) for k, w in factors.items()}

    trend = (raw.get("filter") or {}).get("spy_trend_sma")
    if trend in (None, 0, "0", ""):
        trend = None
    else:
        try:
            trend = int(trend)
            trend = max(TREND_SMA_RANGE[0], min(TREND_SMA_RANGE[1], trend))
        except (TypeError, ValueError):
            errors.append("filter.spy_trend_sma must be an integer or null")
            trend = None

    def _clamp_int(key: str, lo: int, hi: int, default: int) -> int:
        try:
            return max(lo, min(hi, int(raw.get(key, default))))
        except (TypeError, ValueError):
            errors.append(f"{key} must be an integer")
            return default

    top_n = _clamp_int("top_n", *TOP_N_RANGE, default=2)
    rebalance_days = _clamp_int("rebalance_days", *REBALANCE_RANGE, default=5)

    uni_raw = raw.get("universe") or []
    universe: list[str] = []
    for sym in uni_raw:
        s = str(sym).upper().strip()
        if s and s.replace(".", "").isalpha() and len(s) <= 5 and s not in universe:
            universe.append(s)
    universe = universe[: UNIVERSE_RANGE[1]]
    if len(universe) < UNIVERSE_RANGE[0]:
        errors.append(f"universe needs at least {UNIVERSE_RANGE[0]} plain tickers")

    if errors:
        return None, errors
    return {
        "name": name,
        "archetype": "rotation",
        "signal": {"factors": factors},
        "filter": {"spy_trend_sma": trend},
        "top_n": top_n,
        "rebalance_days": rebalance_days,
        "universe": universe,
    }, []


def spec_summary(spec: dict[str, Any]) -> str:
    """One human line: what this spec actually does."""
    facs = ", ".join(f"{w:+.0%} {f}" for f, w in spec["signal"]["factors"].items())
    trend = spec["filter"].get("spy_trend_sma")
    return (
        f"hold top {spec['top_n']} of {len(spec['universe'])} names by [{facs}], "
        f"rebalance every {spec['rebalance_days']}d"
        + (f", cash when SPY < {trend}SMA" if trend else "")
    )


# --------------------------------------------------------------------------- generic backtest

def composite_scores(bars: dict[str, pd.DataFrame], factors: dict[str, float]) -> pd.DataFrame:
    """dates x symbols panel: weighted sum of cross-sectional factor RANKS
    (rank in [0,1] per day). Rank blending is scale-free, so weights mean the
    same thing whatever the factor's units are."""
    total = pd.DataFrame()
    for fname, w in factors.items():
        panel = pd.DataFrame({sym: FACTORS[fname](df) for sym, df in bars.items()})
        ranked = panel.rank(axis=1, pct=True)
        total = ranked.mul(w) if total.empty else total.add(ranked.mul(w), fill_value=0.0)
    return total


def dsl_rotation_backtest(
    bars: dict[str, pd.DataFrame],
    spec: dict[str, Any],
    cost_bps: float = 5.0,
) -> pd.Series:
    """Execute a validated rotation spec on daily bars. Same conventions as
    the other backtests: signal on close, next-day positions, bps costs."""
    from northstar.backtest.engine import close_frame

    uni_bars = {s: df for s, df in bars.items() if s in spec["universe"]}
    if len(uni_bars) < 2:
        return pd.Series(dtype=float)
    closes = close_frame(uni_bars)
    rets = closes.pct_change()
    scores = composite_scores(uni_bars, spec["signal"]["factors"]).reindex(closes.index)

    top_n = int(spec["top_n"])
    reb = int(spec["rebalance_days"])
    weights = pd.DataFrame(0.0, index=closes.index, columns=closes.columns)
    current: list[str] = []
    start = min(WARMUP_DAYS, max(len(closes) - 2, 1))
    for i in range(start, len(closes)):
        if (i - start) % reb == 0:
            row = scores.iloc[i - 1].dropna()
            current = list(row.sort_values(ascending=False).index[:top_n])
        if current:
            weights.iloc[i, [closes.columns.get_loc(s) for s in current]] = 1.0 / len(current)

    trend = spec["filter"].get("spy_trend_sma")
    if trend and "SPY" in bars:
        spy = bars["SPY"]["close"].reindex(closes.index).ffill()
        risk_on = (spy > spy.rolling(int(trend)).mean()).shift(1).fillna(False)
        weights = weights.mul(risk_on.astype(float), axis=0)

    port = (weights * rets).sum(axis=1)
    costs = weights.diff().abs().sum(axis=1).fillna(0.0) * (cost_bps / 10_000)
    return (port - costs).iloc[start:]


# --------------------------------------------------------------------------- spec proposals

TEMPLATE_SPECS: list[dict[str, Any]] = [
    {
        "name": "Momentum blend + trend brake",
        "signal": {"factors": {"mom_60d": 0.5, "dist_52w_high": 0.3, "mom_20d": 0.2}},
        "filter": {"spy_trend_sma": 200},
        "top_n": 2, "rebalance_days": 5,
    },
    {
        "name": "Quiet compounders",
        "signal": {"factors": {"low_vol": 0.5, "sma50_dist": 0.5}},
        "filter": {"spy_trend_sma": 150},
        "top_n": 3, "rebalance_days": 10,
    },
    {
        "name": "Washout bounce hunter",
        "signal": {"factors": {"reversal_5d": 0.4, "rsi14_oversold": 0.4, "volume_surge": 0.2}},
        "filter": {"spy_trend_sma": 200},
        "top_n": 2, "rebalance_days": 3,
    },
]


def default_universe(store) -> list[str]:
    """Core chart + today's top scout names, capped to the spec limit."""
    from northstar.scout import CORE_UNIVERSE, scout_symbols

    merged = list(dict.fromkeys(CORE_UNIVERSE + scout_symbols(store, max_n=4)))
    return merged[: UNIVERSE_RANGE[1]]


def propose_specs(store, n: int = 3, context: dict[str, Any] | None = None) -> tuple[list[dict[str, Any]], str]:
    """N candidate specs (validated). Gemini designs within the schema when a
    key exists; otherwise labeled deterministic templates. Returns (specs, proposer)."""
    from northstar.llm import PRO_MODEL, generate_json, llm_available

    universe = default_universe(store)
    registry = sorted(FACTORS)
    proposer = "template_fallback"
    raw_specs: list[dict[str, Any]] = []

    if llm_available():
        ic_doc = store.get("state", "factor_ic") or {}
        ic_rows = [
            {"factor": r["factor"], "ic_recent": r["ic_recent"], "t_stat": r["t_stat"]}
            for r in ic_doc.get("rows", [])[:8]
        ]
        resp = generate_json(
            "You are a quant designing ROTATION strategies from a fixed factor registry - "
            f"you may ONLY use these factors: {registry}. Recent cross-sectional rank-IC "
            f"evidence (factor vs forward 5d returns): {ic_rows}. "
            f"Extra context: {context or {}}. "
            f"Design {n} DIVERSE strategy specs as JSON: {{\"specs\": [{{"
            "\"name\": str, \"signal\": {\"factors\": {factor_name: weight}}, "
            "\"filter\": {\"spy_trend_sma\": int_or_null}, \"top_n\": int, "
            "\"rebalance_days\": int}]}}. Weights may be negative (contrarian). "
            "2-3 factors each. No prose outside JSON.",
            model=PRO_MODEL,
            temperature=0.8,
        )
        if resp and isinstance(resp.get("specs"), list) and resp["specs"]:
            raw_specs = resp["specs"][:n]
            proposer = "gemini"

    if not raw_specs:
        rng = random.Random(int(datetime.now(timezone.utc).strftime("%Y%m%d")))
        raw_specs = [dict(t) for t in rng.sample(TEMPLATE_SPECS, k=min(n, len(TEMPLATE_SPECS)))]

    specs: list[dict[str, Any]] = []
    for raw in raw_specs:
        raw = {**raw, "universe": raw.get("universe") or universe}
        clean, errors = validate_spec(raw)
        if clean:
            specs.append(clean)
    return specs, proposer


# --------------------------------------------------------------------------- shipyard round

DSL_FAMILY = "dsl_rotation"
ABS_SHARPE_FLOOR = 0.35  # first-ever spec must clear this deflated OOS Sharpe


def run_shipyard_round(store=None, n: int = 3) -> dict[str, Any]:
    """Structural evolution round: propose specs -> walk-forward each ->
    deflated Sharpe + goal-fit -> best becomes an approval card. Rides the
    exact same experiment/trial machinery as parameter evolution."""
    if os.getenv("NORTHSTAR_SHIPYARD_DISABLED"):
        return {"skipped": "shipyard disabled by env"}

    from northstar.broker import daily_bars
    from northstar.domain import EvolutionExperiment, JournalEvent
    from northstar.engine import active_plan
    from northstar.evolution.loop import (
        _champion,
        _report_from_eval,
        _trials_in_family,
        adjusted_oos_sharpe,
        goal_fit,
    )
    from northstar.backtest import walk_forward_eval
    from northstar.journal import get_store

    store = store or get_store()
    # human-admitted mined blends are design context: the spec grammar can
    # express any of them directly as a signal
    try:
        from northstar.mining import library_context

        context = {"library_factors": library_context(store)} or None
    except Exception:
        context = None
    specs, proposer = propose_specs(store, n=n, context=context)
    if not specs:
        return {"ok": False, "error": "no valid specs proposed"}

    symbols = sorted({s for spec in specs for s in spec["universe"]} | {"SPY"})
    bars = daily_bars(symbols, years=4.0)
    plan, goal = active_plan(store)
    trials = _trials_in_family(store, DSL_FAMILY)

    champ = _champion(store, DSL_FAMILY)
    champ_adj = None
    champ_fit = None
    if champ is not None and champ.params.get("spec"):
        champ_eval = walk_forward_eval(bars, champ.params, family=DSL_FAMILY)
        champ_report = _report_from_eval(champ_eval, trials)
        champ_adj = adjusted_oos_sharpe(champ_report)
        champ_fit, _ = goal_fit(champ_eval.get("oos_returns"), champ_report, plan, goal)

    results: list[dict[str, Any]] = []
    best: EvolutionExperiment | None = None
    best_key = -99.0

    for spec in specs:
        # use_scout=False: the live program trades ONLY the spec's universe,
        # so the sleeve ledger should not attribute radar names to this family
        params = {"spec": spec, "universe": spec["universe"], "use_scout": False}
        ev = walk_forward_eval(bars, params, family=DSL_FAMILY)
        trials += 1
        report = _report_from_eval(ev, trials)
        adj = adjusted_oos_sharpe(report)
        fit, fit_note = goal_fit(ev.get("oos_returns"), report, plan, goal)
        if fit is not None:
            report.goal_fit, report.goal_fit_note = fit, fit_note

        # floor: beat the DSL champion if one is live, else clear the absolute bar
        bar = champ_adj if champ_adj is not None else ABS_SHARPE_FLOOR
        promote = adj is not None and adj > bar + 0.05
        if promote and champ_fit is not None and fit is not None:
            promote = fit > champ_fit + 0.02
        key = (fit if fit is not None else adj) if adj is not None else -99.0

        exp = EvolutionExperiment(
            family=DSL_FAMILY,
            parent_version=champ.version if champ else "none",
            hypothesis=f"{spec['name']}: {spec_summary(spec)}",
            proposed_by=proposer,
            params_delta={},
            candidate_params=params,
            backtest=report,
            status="backtested",
            verdict_reason=(
                f"deflated OOS Sharpe {adj if adj is None else round(adj, 2)} vs bar {round(bar, 2)}"
                + (f"; goal-fit {fit:.2f}" if fit is not None else "")
            ),
        )
        if promote and key > best_key:
            best, best_key = exp, key
        store.save("experiments", exp.id, exp.model_dump())
        results.append(exp.model_dump())
        store.append_event(
            JournalEvent(
                kind="experiment",
                human=(
                    f"Shipyard test ({proposer}): {spec['name']} -> OOS Sharpe "
                    f"{report.oos_sharpe if report.oos_sharpe is not None else 'n/a'}. "
                    + ("Candidate for your approval." if exp is best else "Archived to the record.")
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
                    f"The shipyard designed a NEW strategy worth trying: {best.hypothesis} "
                    f"(deflated OOS Sharpe cleared the bar). Approve to send it on a paper trial - your call."
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
        "specs_tested": len(specs),
        "experiments": results,
        "promotion_candidate": best.model_dump() if best else None,
    }
