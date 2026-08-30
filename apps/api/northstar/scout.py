"""Scout: the full-market opportunity radar.

The fleet used to look at a fixed 10-name chart. The scout widens that to the
whole tradable market: every night (and on demand) it pulls Alpaca's screener
boards (most active + biggest movers), applies a liquidity floor, scores the
survivors with deterministic factor math, and publishes a Top-K report with a
one-line reason per pick. Strategies merge the report into their universes;
the analyst debates its loudest names.

Honesty contract: the scout never places orders and never talks to an LLM.
It only decides where the fleet LOOKS. Every pick carries its score parts, so
"why did we buy XYZ?" always traces back to a dated scout report.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

import pandas as pd

from northstar.domain import JournalEvent
from northstar.indicators import rsi

# The classic chart everyone watches anyway - always scored alongside the
# screener boards so the report compares new names against the usual suspects.
CORE_UNIVERSE = ["SPY", "QQQ", "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "AMD", "TSLA"]

MIN_PRICE = 5.0                    # no penny stocks
MIN_DOLLAR_VOLUME = 25_000_000.0   # 20d avg $ volume floor - must be exitable
MIN_HISTORY_ROWS = 70              # need 60d momentum + a little slack
TOP_K = 12
RECENT_REPORTS_KEPT = 5            # recent_pool = union of the last N reports

# Score weights. The W2 factor screener may tilt these (bounded); the report
# always records the weights actually used.
DEFAULT_WEIGHTS: dict[str, float] = {
    "momentum": 0.40,
    "rsi_extreme": 0.25,
    "volume_surge": 0.20,
    "gap": 0.15,
}


# --------------------------------------------------------------------------- fetch

def fetch_screener_symbols(actives_top: int = 60, movers_top: int = 20) -> list[str]:
    """Symbols from Alpaca's market-wide boards. Raises on API failure -
    run_scout catches and degrades honestly."""
    from alpaca.data.historical.screener import ScreenerClient
    from alpaca.data.requests import MarketMoversRequest, MostActivesRequest

    from northstar.config import get_settings

    s = get_settings()
    client = ScreenerClient(s.alpaca_api_key, s.alpaca_secret_key)
    symbols: list[str] = []
    actives = client.get_most_actives(MostActivesRequest(by="volume", top=actives_top))
    symbols += [a.symbol for a in actives.most_actives]
    movers = client.get_market_movers(MarketMoversRequest(top=movers_top))
    symbols += [m.symbol for m in movers.gainers] + [m.symbol for m in movers.losers]
    # equities only: screener boards can surface weird share classes; keep
    # plain tickers (letters + optional dot class) and dedupe preserving order
    out: list[str] = []
    seen: set[str] = set()
    for sym in symbols:
        sym = sym.upper().strip()
        if sym and sym.replace(".", "").isalpha() and len(sym) <= 5 and sym not in seen:
            seen.add(sym)
            out.append(sym)
    return out


# --------------------------------------------------------------------------- pure scoring

def passes_floor(df: pd.DataFrame) -> bool:
    if len(df) < MIN_HISTORY_ROWS:
        return False
    price = float(df["close"].iloc[-1])
    if price < MIN_PRICE:
        return False
    # a ">300% in 20 days" print is a split/consolidation artifact in raw bars
    # (seen live: +6255%), not a tradable signal - drop it as bad data
    if len(df) > 21 and abs(float(df["close"].iloc[-1] / df["close"].iloc[-21] - 1)) > 3.0:
        return False
    tail = df.tail(20)
    dollar_vol = float((tail["close"] * tail["volume"]).mean())
    return dollar_vol >= MIN_DOLLAR_VOLUME


def _clip01(x: float) -> float:
    return max(0.0, min(1.0, x))


def score_parts(df: pd.DataFrame) -> dict[str, float]:
    """Each part in [0, 1]. Deterministic, no look-ahead (uses closed bars only)."""
    closes = df["close"]
    mom20 = float(closes.iloc[-1] / closes.iloc[-21] - 1) if len(closes) > 21 else 0.0
    mom60 = float(closes.iloc[-1] / closes.iloc[-61] - 1) if len(closes) > 61 else 0.0
    blend = 0.6 * mom20 + 0.4 * mom60
    # |8%| blended move ~= 0.55, |20%| ~= 0.9 - big moves matter, huge ones saturate
    momentum = _clip01(abs(blend) / 0.25)

    r = rsi(closes, period=14)
    last_rsi = float(r.iloc[-1]) if len(r.dropna()) else 50.0
    rsi_extreme = _clip01(abs(last_rsi - 50.0) / 50.0)

    vol5 = float(df["volume"].tail(5).mean())
    vol60 = float(df["volume"].tail(60).mean())
    surge = (vol5 / vol60 - 1.0) if vol60 > 0 else 0.0
    volume_surge = _clip01(surge / 2.0)  # 3x the usual tape saturates

    gap = 0.0
    if len(df) >= 2:
        gap = abs(float(df["open"].iloc[-1] / df["close"].iloc[-2] - 1))
    gap_part = _clip01(gap / 0.10)

    return {
        "momentum": round(momentum, 4),
        "rsi_extreme": round(rsi_extreme, 4),
        "volume_surge": round(volume_surge, 4),
        "gap": round(gap_part, 4),
        # raw context for the reason line / flavor label
        "_mom20": round(mom20, 4),
        "_blend": round(blend, 4),
        "_rsi": round(last_rsi, 1),
        "_vol_ratio": round(vol5 / vol60, 2) if vol60 > 0 else 1.0,
    }


def total_score(parts: dict[str, float], weights: dict[str, float]) -> float:
    return round(sum(weights.get(k, 0.0) * parts.get(k, 0.0) for k in weights), 4)


def flavor_of(parts: dict[str, float]) -> str:
    blend = parts.get("_blend", 0.0)
    if blend > 0.05:
        return "uptrend"
    if blend < -0.05:
        return "selloff"
    return "range"


def reason_line(parts: dict[str, float]) -> str:
    mom = parts.get("_mom20", 0.0)
    bits = [f"{'up' if mom >= 0 else 'down'} {abs(mom):.1%} in 20d", f"RSI {parts.get('_rsi', 50):.0f}"]
    vr = parts.get("_vol_ratio", 1.0)
    if vr >= 1.5:
        bits.append(f"volume {vr:.1f}x its 60d average")
    return ", ".join(bits)


def rank_candidates(
    bars: dict[str, pd.DataFrame],
    origins: dict[str, str],
    weights: dict[str, float],
    top_k: int = TOP_K,
) -> tuple[list[dict[str, Any]], int]:
    """Floor -> score -> rank. Returns (top_k candidates, n_passed_floor)."""
    scored: list[dict[str, Any]] = []
    for sym, df in bars.items():
        if not passes_floor(df):
            continue
        parts = score_parts(df)
        scored.append(
            {
                "symbol": sym,
                "score": total_score(parts, weights),
                "flavor": flavor_of(parts),
                "reason": reason_line(parts),
                "origin": origins.get(sym, "screener"),
                "parts": {k: v for k, v in parts.items() if not k.startswith("_")},
                "price": round(float(df["close"].iloc[-1]), 2),
            }
        )
    scored.sort(key=lambda c: c["score"], reverse=True)
    return scored[:top_k], len(scored)


# --------------------------------------------------------------------------- weight tilt

# score-weight key -> registry factor whose recent rank-IC drives the tilt
FACTOR_TILT_MAP = {
    "momentum": "mom_20d",
    "rsi_extreme": "rsi14_oversold",
    "volume_surge": "volume_surge",
    "gap": "gap_1d",
}
TILT_CAP = 0.20   # each weight moves at most +/-20% off its default
TILT_GAIN = 4.0   # |recent IC| of 0.05 reaches the cap


def tilted_weights(store) -> tuple[dict[str, float], str]:
    """DEFAULT_WEIGHTS nudged by the factor screener's recent IC, bounded and
    renormalized. Returns (weights, human note); note is '' when untouched."""
    doc = store.get("state", "factor_ic") or {}
    rows = {r.get("factor"): r for r in doc.get("rows", [])}
    weights = dict(DEFAULT_WEIGHTS)
    notes: list[str] = []
    for key, fname in FACTOR_TILT_MAP.items():
        r = rows.get(fname)
        if not r or r.get("ic_recent") is None or r.get("n_days", 0) < 120:
            continue  # not enough IC history -> no opinion, keep default
        tilt = max(-TILT_CAP, min(TILT_CAP, float(r["ic_recent"]) * TILT_GAIN))
        if abs(tilt) < 0.02:
            continue
        weights[key] = DEFAULT_WEIGHTS[key] * (1.0 + tilt)
        notes.append(f"{key} {tilt:+.0%} (IC {r['ic_recent']:+.3f})")
    total = sum(weights.values())
    weights = {k: round(v / total, 4) for k, v in weights.items()}
    return weights, "; ".join(notes)


# --------------------------------------------------------------------------- run + read

def run_scout(store, top_k: int = TOP_K, weights: dict[str, float] | None = None) -> dict[str, Any]:
    """One scan: boards -> floor -> score -> journal + state. Degrades to the
    core universe (with an honest note) if the screener is unavailable."""
    if os.getenv("NORTHSTAR_SCOUT_DISABLED"):
        return {"skipped": "scout disabled by env"}

    from northstar.broker import daily_bars

    tilt_note = ""
    if weights is None:
        weights, tilt_note = tilted_weights(store)
    source = "screener"
    note = ""
    try:
        board = fetch_screener_symbols()
    except Exception as e:
        board = []
        source = "core_fallback"
        note = f"screener unavailable ({type(e).__name__}), scored the core chart only"

    origins = {s: "screener" for s in board}
    for s in CORE_UNIVERSE:
        origins.setdefault(s, "core")
    pool = list(origins)

    bars = daily_bars(pool, years=0.6)
    candidates, passed = rank_candidates(bars, origins, weights, top_k=top_k)

    prev = store.get("state", "scout") or {}
    history: list[list[str]] = list(prev.get("history", []))
    history.append([c["symbol"] for c in candidates])
    history = history[-RECENT_REPORTS_KEPT:]
    recent_pool = sorted({s for report in history for s in report})

    doc = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "source": source,
        "note": note,
        "scanned": len(pool),
        "passed_floor": passed,
        "weights": weights,
        "weight_tilt": tilt_note,
        "candidates": candidates,
        "history": history,
        "recent_pool": recent_pool,
    }
    store.save("state", "scout", doc)

    top3 = ", ".join(f"{c['symbol']} ({c['score']:.2f}, {c['flavor']})" for c in candidates[:3])
    human = (
        f"Scout scanned {len(pool)} names ({source}): {passed} passed the liquidity floor, "
        f"top picks {top3}." if candidates
        else f"Scout scanned {len(pool)} names ({source}): nothing passed the liquidity floor."
    )
    if note:
        human += f" Note: {note}."
    if tilt_note:
        human += f" Score weights tilted by factor IC: {tilt_note}."
    store.append_event(JournalEvent(kind="scout", human=human, payload=doc))
    return doc


def scout_symbols(store, max_n: int = 8) -> list[str]:
    """Top candidate symbols from the latest report (for universe merging)."""
    doc = store.get("state", "scout") or {}
    return [c["symbol"] for c in doc.get("candidates", [])][:max_n]


def scout_recent_pool(store) -> list[str]:
    """Union of the last few reports - names bought via scout stay manageable
    (sellable by rotation) even after they drop off today's Top-K."""
    doc = store.get("state", "scout") or {}
    return list(doc.get("recent_pool", []))


# --------------------------------------------------------------------------- options watch
#
# Same radar, premium lens: which liquid names pay the best annualized yield
# for a delta-band cash-secured put right now? The wheel/spread crews merge
# the top of this board into their underlyings; every order still needs the
# gate's CSP collateral math to say yes.

OPTIONS_SCAN_MAX = 12          # chain calls per scan, hard cap
PUT_DELTA_BAND = (-0.35, -0.15)
SCAN_DTE = (21, 45)

# liquid, options-friendly subset of the core chart
OPTIONS_CORE = ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "AMD", "TSLA"]


def best_put_yield(chain: list[dict[str, Any]], today: Any = None) -> dict[str, Any] | None:
    """Best annualized CSP yield among delta-band puts (pure ranking math)."""
    from datetime import date, datetime

    from northstar.compiler.options import occ_expiry_yymmdd, occ_is_put, occ_strike

    today = today or date.today()
    best: dict[str, Any] | None = None
    for c in chain:
        sym = c.get("symbol", "")
        delta, bid = c.get("delta"), c.get("bid")
        if len(sym) < 16 or not occ_is_put(sym) or delta is None or not bid or bid < 0.05:
            continue
        if not (PUT_DELTA_BAND[0] <= float(delta) <= PUT_DELTA_BAND[1]):
            continue
        strike = occ_strike(sym)
        expiry = datetime.strptime(occ_expiry_yymmdd(sym), "%y%m%d").date()
        dte = (expiry - today).days
        if dte <= 0 or strike <= 0:
            continue
        ann_yield = float(bid) / strike * (365.0 / dte)
        if best is None or ann_yield > best["ann_yield"]:
            best = {
                "occ": sym, "strike": strike, "dte": dte, "bid": round(float(bid), 2),
                "delta": round(float(delta), 3), "ann_yield": round(ann_yield, 4),
            }
    return best


def scan_options(store, max_underlyings: int = OPTIONS_SCAN_MAX) -> dict[str, Any]:
    """Rank optionable radar + core names by CSP premium yield -> state/options_watch."""
    if os.getenv("NORTHSTAR_OPTIONS_SCAN_DISABLED"):
        return {"skipped": "options scan disabled by env"}

    from northstar.broker import option_chain

    # radar names first (that's the point), core income names fill the rest
    pool = list(dict.fromkeys(scout_symbols(store, max_n=8) + OPTIONS_CORE))[:max_underlyings]
    ranked: list[dict[str, Any]] = []
    skipped: list[str] = []
    for und in pool:
        try:
            chain = option_chain(und, SCAN_DTE[0], SCAN_DTE[1])
            pick = best_put_yield(chain)
        except Exception:
            pick = None
        if pick is None:
            skipped.append(und)
            continue
        ranked.append({"symbol": und, **pick})
    ranked.sort(key=lambda r: r["ann_yield"], reverse=True)

    doc = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "scanned": len(pool),
        "no_usable_chain": skipped,
        "ranked": ranked,
    }
    store.save("state", "options_watch", doc)
    if ranked:
        top = ", ".join(f"{r['symbol']} {r['ann_yield']:.0%}/yr" for r in ranked[:3])
        store.append_event(
            JournalEvent(
                kind="scout",
                human=f"Options watch: best delta-band put yields right now - {top}.",
                payload=doc,
            )
        )
    return doc


def options_watch_symbols(store, max_n: int = 3) -> list[str]:
    """Top premium-yield underlyings for the income crews to consider."""
    doc = store.get("state", "options_watch") or {}
    return [r["symbol"] for r in doc.get("ranked", [])][:max_n]
