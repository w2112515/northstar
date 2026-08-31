"""Market Weather: a deterministic market-conditions index from free sources.

Three components, each scored 0-100 (higher = calmer seas):

- vol:    SPY 21-day realized volatility, ranked against ~1 year of its own
          history (percentile inverted: high vol -> low score).
- news:   keyword tone of the last 24h of market headlines (Alpaca News API).
          Word lists are fixed and versioned here - no model, no black box.
- global: GDELT DOC 2.0 average tone of world economy/market coverage,
          z-scored against its own trailing 7-day series.

score = weighted mean of whichever components are available; missing sources
are listed in `degraded` and the weights renormalize. The index only ever
*pauses new risk* (a soft gate rule sends orders to human approval) - it never
sizes positions up and never blocks exits.

The LLM writes the one-line report from the computed numbers. If it is
unavailable the line is a deterministic template and report_source says so.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Any

WEIGHTS = {"vol": 0.4, "news": 0.3, "global": 0.3}
CACHE_TTL_MINUTES = 15

# Deterministic headline word lists (lowercase substring match).
STORM_WORDS = (
    "crash", "plunge", "plummet", "selloff", "sell-off", "recession",
    "war", "invasion", "strike on", "tariff", "sanction", "default",
    "crisis", "bankrupt", "layoff", "downgrade", "collapse", "panic",
    "fear", "slump", "tumble", "rout", "contagion", "shutdown",
)
CALM_WORDS = (
    "rally", "record high", "all-time high", "surge", "beats", "beat estimates",
    "optimism", "recovery", "rebound", "soar", "upgrade", "rate cut",
    "cools", "eases", "strong earnings", "expansion",
)

COMPONENT_NAMES = {"vol": "volatility", "news": "headline tone", "global": "global news tone"}


# --------------------------------------------------------------------------- pure math

def _clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, x))


def score_from_z(z: float, scale: float = 20.0) -> float:
    """Map a z-score to 0-100 around a neutral 50. z=+2 -> 90, z=-2 -> 10."""
    return _clamp(50.0 + scale * z)


def vol_percentile_score(closes) -> dict[str, Any] | None:
    """SPY realized-vol percentile within its own trailing history, inverted."""
    rets = closes.pct_change()
    roll = (rets.rolling(21).std() * (252 ** 0.5)).dropna()
    if len(roll) < 60:
        return None
    cur = float(roll.iloc[-1])
    pct = float((roll <= cur).mean() * 100)
    return {"score": round(_clamp(100.0 - pct), 1), "realized_vol": round(cur, 4),
            "percentile": round(pct, 1)}


def headline_tone(texts: list[str]) -> dict[str, Any] | None:
    """Fixed-wordlist tone of headlines. Each article votes calm/storm/neutral."""
    if not texts:
        return None
    storm_n = calm_n = 0
    drivers: list[str] = []
    for t in texts:
        low = t.lower()
        is_storm = any(w in low for w in STORM_WORDS)
        is_calm = any(w in low for w in CALM_WORDS)
        if is_storm:
            storm_n += 1
            if len(drivers) < 3:
                drivers.append(t[:90])
        elif is_calm:
            calm_n += 1
    net = (calm_n - storm_n) / len(texts)
    return {"score": round(_clamp(50.0 + 120.0 * net), 1), "n_headlines": len(texts),
            "storm_hits": storm_n, "calm_hits": calm_n, "drivers": drivers}


def gdelt_tone_score(values: list[float]) -> dict[str, Any] | None:
    """Last tone reading vs its own 7-day series (z-score -> 0-100)."""
    if len(values) < 8:
        return None
    mean = sum(values) / len(values)
    var = sum((v - mean) ** 2 for v in values) / len(values)
    std = var ** 0.5
    z = 0.0 if std == 0 else max(-3.0, min(3.0, (values[-1] - mean) / std))
    return {"score": round(score_from_z(z), 1), "tone": round(values[-1], 2),
            "tone_7d_avg": round(mean, 2), "z": round(z, 2)}


def compose(component_scores: dict[str, float | None]) -> tuple[int | None, list[str]]:
    """Weighted mean of available components; weights renormalize over what's live."""
    live = {k: v for k, v in component_scores.items() if v is not None}
    degraded = sorted(k for k in WEIGHTS if component_scores.get(k) is None)
    if not live:
        return None, degraded
    total_w = sum(WEIGHTS[k] for k in live)
    score = sum(WEIGHTS[k] * v for k, v in live.items()) / total_w
    return int(round(score)), degraded


def bucket(score: int | None) -> str:
    if score is None:
        return "offline"
    if score >= 65:
        return "clear"
    if score >= 35:
        return "choppy"
    return "storm"


def worst_component(component_scores: dict[str, float | None]) -> str | None:
    live = {k: v for k, v in component_scores.items() if v is not None}
    if not live:
        return None
    return min(live, key=lambda k: live[k])


# --------------------------------------------------------------------------- fetchers (I/O)

@lru_cache(maxsize=1)
def _news_client():
    from alpaca.data.historical.news import NewsClient

    from northstar.config import get_settings

    s = get_settings()
    return NewsClient(s.alpaca_api_key, s.alpaca_secret_key)


def _fetch_vol() -> dict[str, Any] | None:
    from northstar.broker import daily_bars

    bars = daily_bars(["SPY"], years=1.2)
    if "SPY" not in bars:
        return None
    return vol_percentile_score(bars["SPY"]["close"])


def _fetch_news() -> dict[str, Any] | None:
    from alpaca.data.requests import NewsRequest

    req = NewsRequest(
        start=datetime.now(timezone.utc) - timedelta(hours=24),
        limit=50, include_content=False,
    )
    news_set = _news_client().get_news(req)
    articles = news_set.data.get("news", [])
    texts = [f"{a.headline}. {a.summary or ''}" for a in articles]
    return headline_tone(texts)


def _fetch_gdelt() -> dict[str, Any] | None:
    import httpx

    params = {
        "query": '(economy OR "stock market" OR "federal reserve") sourcelang:english',
        "mode": "timelinetone", "timespan": "7d", "format": "json",
    }
    r = httpx.get("https://api.gdeltproject.org/api/v2/doc/doc", params=params, timeout=8.0)
    r.raise_for_status()
    timeline = r.json().get("timeline", [])
    if not timeline:
        return None
    values = [float(p["value"]) for p in timeline[0].get("data", [])]
    return gdelt_tone_score(values)


_FETCHERS = {"vol": _fetch_vol, "news": _fetch_news, "global": _fetch_gdelt}


# --------------------------------------------------------------------------- report line

def _template_report(score: int | None, b: str, worst: str | None) -> str:
    if b == "offline":
        return "Weather instruments are offline - running on the risk gates alone."
    worst_name = COMPONENT_NAMES.get(worst or "", "conditions")
    if b == "clear":
        return f"Clear conditions (score {score}) - volatility and news flow look ordinary."
    if b == "choppy":
        return f"Choppy conditions (score {score}) - {worst_name} is the main stress signal."
    return f"Storm conditions (score {score}) - {worst_name} is the loudest warning right now."


def _llm_report(reading: dict[str, Any]) -> tuple[str, str]:
    from northstar.llm import generate_text, llm_available

    score, b = reading["score"], reading["bucket"]
    worst = worst_component({k: (c or {}).get("score") for k, c in reading["components"].items()})
    fallback = _template_report(score, b, worst)
    if not llm_available() or score is None:
        return fallback, "template"
    comps = {k: (c or {}).get("score") for k, c in reading["components"].items()}
    drivers = (reading["components"].get("news") or {}).get("drivers", [])
    text = generate_text(
        "You are the weather officer of a paper-trading cockpit. In ONE sentence "
        "(max 160 chars), describe current market conditions for a beginner. "
        "Plain language, factual, no advice, no predictions, no promises.\n"
        f"Weather score (0-100, higher=calmer): {score} ({b}). "
        f"Component scores: {comps}. Sample stress headlines: {drivers[:2]}.",
        temperature=0.4,
    )
    if text:
        return text.strip().split("\n")[0][:200], "gemini"
    return fallback, "template"


# --------------------------------------------------------------------------- refresh / cache

def refresh_weather(store) -> dict[str, Any]:
    """Fetch all sources (each isolated), compose the index, journal transitions,
    persist the reading + a history record for later threshold research."""
    from northstar.domain import JournalEvent

    components: dict[str, dict[str, Any] | None] = {}
    for name, fetch in _FETCHERS.items():
        try:
            components[name] = fetch()
        except Exception as e:
            components[name] = None
            print(f"[weather] {name} source failed: {type(e).__name__}: {e}")

    score, degraded = compose({k: (c or {}).get("score") for k, c in components.items()})
    b = bucket(score)
    reading: dict[str, Any] = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "score": score,
        "bucket": b,
        "components": components,
        "degraded": degraded,
    }
    reading["report"], reading["report_source"] = _llm_report(reading)

    prev = store.get("state", "weather") or {}
    prev_bucket = prev.get("bucket")
    if prev_bucket is None and b != "offline":
        store.append_event(JournalEvent(
            kind="event",
            human=f"Market weather watch is online: {b} (score {score}). {reading['report']}",
            payload={"weather": {"score": score, "bucket": b, "degraded": degraded}},
        ))
    elif prev_bucket not in (None, b):
        store.append_event(JournalEvent(
            kind="event",
            human=f"Market weather shifted {prev_bucket} -> {b} (score {score}). {reading['report']}",
            payload={"weather": {"score": score, "bucket": b, "from": prev_bucket,
                                 "degraded": degraded}},
        ))

    store.save("state", "weather", reading)
    hist_id = reading["ts"].replace(":", "").replace("-", "")[:15]
    store.save("weather_history", hist_id, {
        "ts": reading["ts"], "score": score, "bucket": b,
        "component_scores": {k: (c or {}).get("score") for k, c in components.items()},
    })
    return reading


def get_weather(store, max_age_minutes: int = CACHE_TTL_MINUTES) -> dict[str, Any] | None:
    """Cached reading; refreshes at most once per TTL regardless of callers."""
    doc = store.get("state", "weather")
    if doc:
        try:
            age = datetime.now(timezone.utc) - datetime.fromisoformat(doc["ts"])
            if age <= timedelta(minutes=max_age_minutes):
                return doc
        except (KeyError, ValueError):
            pass
    try:
        return refresh_weather(store)
    except Exception as e:
        print(f"[weather] refresh failed: {type(e).__name__}: {e}")
        return doc
