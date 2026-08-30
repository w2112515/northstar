"""TimesFM daily forecasts: Google's time-series foundation model, zero-shot.

Role in NorthStar (honest by construction):
- decision support ONLY: forecasts feed the AI Analyst's fact sheet and a
  cockpit card with quantile bands; nothing in here places or sizes orders
- zero-shot quantile forecasts (q10/q50/q90) so uncertainty is always shown
  next to the point path - a single line would overstate what the model knows
- lazy weights: the ~800MB checkpoint downloads on first refresh (nightly or
  manual trigger), never at API startup; consumers only read the cached doc
- degradation: torch/timesfm missing or any failure -> cache untouched,
  callers see None, the nightly digest says the step was skipped

Model: TimesFM 2.5 200M (google/timesfm-2.5-200m-pytorch) via the timesfm
3.0 package - the checkpoint documented for this wheel's API.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

HORIZON_DAYS = 5
CONTEXT_DAYS = 512          # ~2 trading years
MIN_CONTEXT_DAYS = 200
CHECKPOINT = "google/timesfm-2.5-200m-pytorch"

_model_cache: dict[str, Any] = {}


def timesfm_available() -> bool:
    import os

    if os.getenv("TIMESFM_DISABLED", "").lower() in ("1", "true"):
        return False
    try:
        import timesfm  # noqa: F401
        import torch  # noqa: F401

        return True
    except Exception:
        return False


def _load_model():
    """Lazy singleton; any failure (no torch, no network for weights) -> None."""
    if "model" in _model_cache:
        return _model_cache["model"]
    try:
        import timesfm
        from timesfm.timesfm_2p5.timesfm_2p5_torch import TimesFM_2p5_200M_torch

        model = TimesFM_2p5_200M_torch.from_pretrained(CHECKPOINT)
        model.compile(
            timesfm.ForecastConfig(
                max_context=CONTEXT_DAYS,
                max_horizon=64,
                normalize_inputs=True,
                use_continuous_quantile_head=True,
                fix_quantile_crossing=True,
            )
        )
        _model_cache["model"] = model
    except Exception as e:
        print(f"[forecast] TimesFM unavailable: {type(e).__name__}: {e}")
        _model_cache["model"] = None
    return _model_cache["model"]


def _pct(new: float, base: float) -> float:
    return round((new / base - 1.0) * 100.0, 2)


def _symbol_doc(closes, point_path, band_lo, band_mid, band_hi) -> dict[str, Any]:
    """Per-symbol forecast doc; bands are re-ordered defensively so lo<=hi always."""
    last = float(closes[-1])
    lo = [round(float(min(a, b)), 2) for a, b in zip(band_lo, band_hi)]
    hi = [round(float(max(a, b)), 2) for a, b in zip(band_lo, band_hi)]
    return {
        "last_close": round(last, 2),
        "point": [round(float(x), 2) for x in point_path],
        "q10": lo,
        "q50": [round(float(x), 2) for x in band_mid],
        "q90": hi,
        "exp_5d_pct": _pct(float(point_path[-1]), last),
        "q10_5d_pct": _pct(lo[-1], last),
        "q90_5d_pct": _pct(hi[-1], last),
    }


def forecast_universe(store) -> list[str]:
    """SPY + every symbol the active strategies actually trade."""
    from northstar.engine import ensure_default_instances

    symbols = {"SPY"}
    for inst in ensure_default_instances(store):
        if not inst.enabled or inst.status not in ("champion", "trial"):
            continue
        symbols.update(inst.params.get("universe", []))
        symbols.update(inst.params.get("underlyings", []))
    return sorted(symbols)


def refresh_forecasts(store, symbols: list[str] | None = None) -> dict[str, Any] | None:
    """Run TimesFM over the universe and cache the result. Returns the doc or None."""
    import numpy as np

    from northstar.broker import daily_bars
    from northstar.domain import JournalEvent

    model = _load_model()
    if model is None:
        return None

    symbols = symbols or forecast_universe(store)
    bars = daily_bars(symbols, years=2.5)
    inputs: list[Any] = []
    kept: list[tuple[str, Any]] = []
    for sym in symbols:
        df = bars.get(sym)
        if df is None or len(df) < MIN_CONTEXT_DAYS:
            continue
        closes = df["close"].to_numpy(dtype=np.float32)[-CONTEXT_DAYS:]
        inputs.append(closes)
        kept.append((sym, closes))
    if not inputs:
        return None

    try:
        point, quantiles = model.forecast(horizon=HORIZON_DAYS, inputs=inputs)
    except Exception as e:
        print(f"[forecast] inference failed: {type(e).__name__}: {e}")
        return None

    # quantile tensor layout: index 0 = mean, 1..9 = q10..q90
    per_symbol: dict[str, Any] = {}
    for i, (sym, closes) in enumerate(kept):
        per_symbol[sym] = _symbol_doc(
            closes,
            point_path=point[i][:HORIZON_DAYS],
            band_lo=quantiles[i][:HORIZON_DAYS, 1],
            band_mid=quantiles[i][:HORIZON_DAYS, 5],
            band_hi=quantiles[i][:HORIZON_DAYS, 9],
        )

    doc = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "horizon_days": HORIZON_DAYS,
        "model": "TimesFM 2.5 200M (zero-shot, quantile bands)",
        "symbols": per_symbol,
        "note": "Decision support only - forecasts feed the AI analyst's facts and this card, never orders.",
    }
    store.save("state", "forecast", doc)
    _append_snapshot(store, doc)
    store.append_event(
        JournalEvent(
            kind="forecast",
            human=f"TimesFM refreshed 5-day forecasts for {len(per_symbol)} symbols.",
            payload={"symbols": {s: {"exp_5d_pct": d["exp_5d_pct"]} for s, d in per_symbol.items()}},
        )
    )
    return doc


def get_forecasts(store) -> dict[str, Any] | None:
    """Cached doc only; never triggers a model load."""
    return store.get("state", "forecast")


def forecast_facts() -> dict[str, Any] | None:
    """Compact per-symbol summary for the AI Analyst's fact sheet (cache only)."""
    from northstar.journal import get_store

    doc = get_forecasts(get_store())
    if not doc:
        return None
    return {
        sym: {
            "exp_5d_pct": d["exp_5d_pct"],
            "q10_5d_pct": d["q10_5d_pct"],
            "q90_5d_pct": d["q90_5d_pct"],
        }
        for sym, d in (doc.get("symbols") or {}).items()
    }


# --------------------------------------------------------------------------- scorecard
#
# A forecast card without a track record is decoration. We snapshot every
# refresh, then grade elapsed horizons against realized closes: band coverage
# (q10-q90 should catch ~80% of outcomes) and pinball loss per quantile.
# The grade goes on the card - especially when it's unflattering.

SNAPSHOTS_KEPT = 12


def _append_snapshot(store, doc: dict[str, Any]) -> None:
    hist = store.get("state", "forecast_history") or {}
    snaps = list(hist.get("snapshots", []))
    snaps.append({
        "ts": doc["ts"],
        "symbols": {
            s: {"last_close": d["last_close"], "q10": d["q10"], "q50": d["q50"], "q90": d["q90"]}
            for s, d in doc["symbols"].items()
        },
    })
    store.save("state", "forecast_history", {"snapshots": snaps[-SNAPSHOTS_KEPT:]})


def pinball_loss(y: float, q: float, tau: float) -> float:
    return max(tau * (y - q), (tau - 1.0) * (y - q))


def score_rows(snapshot: dict[str, Any], realized: dict[str, list[float]]) -> list[dict[str, Any]]:
    """Grade one snapshot against closes realized AFTER it (pure function).

    realized[sym] = consecutive daily closes following the snapshot date; only
    elapsed horizons are graded, so a fresh snapshot contributes nothing yet.
    """
    rows: list[dict[str, Any]] = []
    for sym, f in (snapshot.get("symbols") or {}).items():
        closes = realized.get(sym) or []
        base = float(f["last_close"]) or 1.0
        for h, y in enumerate(closes[: len(f.get("q50", []))]):
            rows.append({
                "symbol": sym,
                "horizon": h + 1,
                "in_band": bool(f["q10"][h] <= y <= f["q90"][h]),
                "pinball_q10": pinball_loss(y, f["q10"][h], 0.10) / base,
                "pinball_q50": pinball_loss(y, f["q50"][h], 0.50) / base,
                "pinball_q90": pinball_loss(y, f["q90"][h], 0.90) / base,
            })
    return rows


def aggregate_skill(rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not rows:
        return None
    n = len(rows)
    return {
        "n_checks": n,
        "coverage_q10_q90": round(sum(r["in_band"] for r in rows) / n, 3),
        "coverage_target": 0.80,
        "pinball_q10_pct": round(100 * sum(r["pinball_q10"] for r in rows) / n, 3),
        "pinball_q50_pct": round(100 * sum(r["pinball_q50"] for r in rows) / n, 3),
        "pinball_q90_pct": round(100 * sum(r["pinball_q90"] for r in rows) / n, 3),
    }


def score_forecasts(store) -> dict[str, Any] | None:
    """Nightly: grade every retained snapshot on whatever horizons have elapsed."""
    hist = store.get("state", "forecast_history") or {}
    snaps = list(hist.get("snapshots", []))
    if not snaps:
        return None

    from northstar.broker import daily_bars
    from northstar.domain import JournalEvent

    symbols = sorted({s for snap in snaps for s in (snap.get("symbols") or {})})
    bars = daily_bars(symbols, years=0.2)

    rows: list[dict[str, Any]] = []
    for snap in snaps:
        snap_date = datetime.fromisoformat(snap["ts"]).date()
        realized: dict[str, list[float]] = {}
        for sym in snap.get("symbols") or {}:
            df = bars.get(sym)
            if df is None or df.empty:
                continue
            after = df[[d.date() > snap_date for d in df.index]]
            realized[sym] = [float(x) for x in after["close"].tolist()]
        rows += score_rows(snap, realized)

    skill = aggregate_skill(rows)
    if skill is None:
        return {"n_checks": 0, "note": "no elapsed horizons yet"}
    skill["ts"] = datetime.now(timezone.utc).isoformat()
    skill["window_snapshots"] = len(snaps)
    store.save("state", "forecast_skill", skill)
    store.append_event(
        JournalEvent(
            kind="forecast",
            human=(
                f"Forecast scorecard: {skill['coverage_q10_q90']:.0%} of realized closes landed in "
                f"the q10-q90 band (target 80%) across {skill['n_checks']} checks; median-line "
                f"pinball {skill['pinball_q50_pct']:.2f}% of price."
            ),
            payload=skill,
        )
    )
    return skill
