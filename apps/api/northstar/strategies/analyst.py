"""AI Analyst: a bull/bear Gemini debate with Disagree-or-Commit resolution.

Protocol (after FinCom, arXiv 2606.00939 - explicit dissent beats consensus
committees on downside-sensitive tasks):
1. Advocate call proposes at most one equity trade with the strongest case FOR.
2. Critic call red-teams that exact trade and must either OBJECT (with the
   strongest risk) or CONCEDE - no vague hedging.
3. Deterministic judge (code, not a third LLM):
   - critic unavailable/unparseable -> drop the trade (no unreviewed AI trades)
   - strong objection (confidence >= 0.6) -> drop
   - weak objection -> commit with conviction haircut, objection noted in thesis
   - concede -> commit
Every debate is journaled (kind="debate") so the cockpit can show the argument.

Honesty rules (unchanged):
- no GOOGLE_API_KEY (or any API failure) -> zero proposals, never faked
- the LLM only picks direction + thesis; symbol whitelist, sizing, price and
  every risk check stay in deterministic code (gate treats the result like any
  other proposal)
- conviction is capped at 0.7 - an LLM opinion never outranks the rules

Cost throttle: at most one debate (2 Gemini calls) per ANALYST_COOLDOWN_HOURS
per process (the loop runs every 15 minutes; an analyst opinion doesn't change
that fast).
"""

from __future__ import annotations

import json
import os
import time
from typing import Any

from northstar.domain import StrategyInstance, TradeProposal
from northstar.llm import PRO_MODEL, generate_json, llm_available
from northstar.strategies.base import EngineContext

COOLDOWN_HOURS = float(os.getenv("ANALYST_COOLDOWN_HOURS", "4"))
MAX_CONVICTION = 0.7
MAX_NOTIONAL_PCT = 0.05  # per analyst trade, on top of every gate cap
STRONG_OBJECTION = 0.6
WEAK_OBJECTION_HAIRCUT = 0.7

_last_call: dict[str, float] = {"ts": 0.0}

BULL_PROMPT = """You are the advocate analyst on a small systematic trading desk.
Below are today's facts. Propose AT MOST ONE equity trade with the strongest
honest case for it, or none.

Rules:
- symbol MUST be one of the allowed ones
- direction: "bullish" (buy) or "bearish" (only meaningful if we hold it - it becomes a sell)
- no leverage, no options, no shorting
- thesis: 1-2 plain-language sentences a beginner understands; name the facts you used
- invalidation: the observable condition that would prove the idea wrong
- if nothing is clearly attractive, return {"trade": null}

Facts:
%s

Return ONLY JSON:
{"trade": {"symbol": "...", "direction": "bullish|bearish", "thesis": "...",
           "invalidation": "...", "confidence": 0.0-1.0} | null}
"""

BEAR_PROMPT = """You are the risk critic on a small systematic trading desk.
An advocate proposed the trade below. Your job is to attack it using ONLY the
facts provided. You must either OBJECT with the strongest concrete risk, or
CONCEDE that the trade survives your best attack. No hedging.

Facts:
%s

Proposed trade:
%s

Return ONLY JSON:
{"verdict": "object|concede", "confidence": 0.0-1.0,
 "objection": "1-2 plain-language sentences (empty if conceding)"}
"""


def _analyst_universe(instance: StrategyInstance, ctx: EngineContext) -> list[str]:
    """Static watchlist + the scout's three loudest names of the night."""
    return list(dict.fromkeys(list(instance.params.get("universe", [])) + ctx.scout_symbols[:3]))


def _facts(instance: StrategyInstance, ctx: EngineContext) -> dict[str, Any]:
    universe: list[str] = _analyst_universe(instance, ctx)
    momentum = {}
    for sym in universe:
        df = ctx.bars.get(sym)
        if df is None or len(df) < 6:
            continue
        closes = df["close"]
        momentum[sym] = {
            "last_close": round(float(closes.iloc[-1]), 2),
            "return_5d_pct": round((float(closes.iloc[-1]) / float(closes.iloc[-6]) - 1) * 100, 2),
        }
    held = {
        p["symbol"]: float(p["qty"]) for p in ctx.positions
        if p["asset_class"] == "us_equity" and p["symbol"] in universe
    }
    facts: dict[str, Any] = {
        "allowed_symbols": universe,
        "momentum_5d": momentum,
        "current_holdings": held,
        "buying_power_usd": round(float(ctx.account.get("buying_power", 0.0))),
    }
    try:
        from northstar.journal import get_store
        from northstar.weather import get_weather

        wx = get_weather(get_store())
        if wx:
            news = (wx.get("components") or {}).get("news") or {}
            facts["market_weather"] = {
                "score_0to100": wx.get("score"), "bucket": wx.get("bucket"),
                "stress_headlines": news.get("drivers", [])[:3],
            }
    except Exception:
        pass
    try:
        from northstar.forecast import forecast_facts

        tfm = forecast_facts()
        if tfm:
            facts["timesfm_5d_forecast"] = tfm
    except Exception:
        pass
    if ctx.scout_symbols:
        try:
            from northstar.journal import get_store

            doc = get_store().get("state", "scout") or {}
            facts["scout_radar"] = {
                c["symbol"]: f"{c['flavor']}: {c['reason']}"
                for c in doc.get("candidates", []) if c["symbol"] in universe
            }
        except Exception:
            pass
    return facts


def _symbol_headlines(symbol: str, limit: int = 4) -> list[str]:
    """Fresh Alpaca headlines for one symbol - ammunition for the critic.

    Best-effort and honest: no news (or no network) just means the critic
    argues from price/forecast facts alone.
    """
    if os.getenv("ANALYST_NEWS_DISABLED"):
        return []
    try:
        from datetime import datetime, timedelta, timezone

        from alpaca.data.requests import NewsRequest

        from northstar.weather import _news_client

        req = NewsRequest(
            symbols=symbol,
            start=datetime.now(timezone.utc) - timedelta(hours=48),
            limit=limit,
            include_content=False,
        )
        articles = _news_client().get_news(req).data.get("news", [])
        return [str(a.headline)[:160] for a in articles if getattr(a, "headline", None)]
    except Exception:
        return []


def _journal_debate(payload: dict[str, Any], human: str) -> None:
    """Best-effort: a journaling failure must never affect trading logic."""
    try:
        from northstar.domain import JournalEvent
        from northstar.journal import get_store

        get_store().append_event(JournalEvent(kind="debate", human=human, payload=payload))
    except Exception as e:
        print(f"[analyst] debate journal failed: {type(e).__name__}: {e}")


def propose(instance: StrategyInstance, weight: float, ctx: EngineContext) -> list[TradeProposal]:
    if not llm_available():
        return []
    now = time.monotonic()
    if _last_call["ts"] and now - _last_call["ts"] < COOLDOWN_HOURS * 3600:
        return []
    _last_call["ts"] = now

    universe: list[str] = _analyst_universe(instance, ctx)
    facts = _facts(instance, ctx)
    facts_json = json.dumps(facts, indent=1)
    raw = generate_json(BULL_PROMPT % facts_json, model=PRO_MODEL, temperature=0.3)
    trade = (raw or {}).get("trade")
    if not isinstance(trade, dict):
        return []

    sym = str(trade.get("symbol", "")).upper()
    direction = str(trade.get("direction", ""))
    if sym not in universe or direction not in ("bullish", "bearish"):
        return []
    df = ctx.bars.get(sym)
    if df is None or df.empty or ctx.has_open_order_for(sym):
        return []
    price = float(df["close"].iloc[-1])
    held_qty = ctx.stock_qty(sym)
    conviction = min(MAX_CONVICTION, float(trade.get("confidence", 0.5) or 0.5))
    thesis = str(trade.get("thesis", ""))[:400] or "Gemini flagged this setup."
    invalidation = str(trade.get("invalidation", ""))[:200] or "thesis no longer supported"

    # --- Disagree-or-Commit: red-team the exact trade before it may exist ---
    # the critic gets extra ammunition the advocate never saw: fresh headlines
    headlines = _symbol_headlines(sym)
    critic_facts = dict(facts)
    if headlines:
        critic_facts[f"fresh_headlines_{sym}"] = headlines
    critic = generate_json(
        BEAR_PROMPT % (json.dumps(critic_facts, indent=1),
                       json.dumps({"symbol": sym, "direction": direction, "thesis": thesis})),
        model=PRO_MODEL,
        temperature=0.3,
    )
    verdict = str((critic or {}).get("verdict", "")).lower()
    objection = str((critic or {}).get("objection", ""))[:300]
    try:
        critic_conf = max(0.0, min(1.0, float((critic or {}).get("confidence", 0.0))))
    except (TypeError, ValueError):
        critic_conf = 0.0

    debate_payload = {
        "symbol": sym, "direction": direction,
        "bull": {"thesis": thesis, "confidence": conviction},
        "bear": {"verdict": verdict or "unavailable", "confidence": critic_conf, "objection": objection},
        "headlines": headlines[:3],
    }

    if verdict not in ("object", "concede"):
        debate_payload["outcome"] = "dropped_unreviewed"
        _journal_debate(debate_payload, f"AI debate on {sym}: critic unavailable -> trade dropped (no unreviewed AI trades).")
        return []
    if verdict == "object" and critic_conf >= STRONG_OBJECTION:
        debate_payload["outcome"] = "dropped_objection"
        _journal_debate(debate_payload, f"AI debate on {sym}: critic objected ({critic_conf:.0%}) -> trade dropped. {objection}")
        return []
    if verdict == "object":
        conviction = round(conviction * WEAK_OBJECTION_HAIRCUT, 3)
        thesis = f"{thesis} (Critic's caveat: {objection})" if objection else thesis
        debate_payload["outcome"] = "committed_with_caveat"
        _journal_debate(debate_payload, f"AI debate on {sym}: weak objection -> committed with conviction haircut.")
    else:
        debate_payload["outcome"] = "committed"
        _journal_debate(debate_payload, f"AI debate on {sym}: critic conceded -> committed.")

    if direction == "bearish":
        if held_qty <= 0:
            return []  # long-only desk: a bearish call on something we don't own is a no-op
        action, qty = "sell", held_qty
        thesis = f"{thesis} (AI suggests stepping out of the position we hold.)"
    else:
        budget = min(ctx.allocation_equity(weight), ctx.equity() * MAX_NOTIONAL_PCT)
        qty = int(budget // price)
        if qty < 1:
            return []
        action = "buy"

    return [
        TradeProposal(
            source=f"strategy:{instance.id}",
            underlying=sym,
            direction=direction,
            strategy_type="ai_analyst",
            conviction=conviction,
            horizon_days=10,
            thesis_human=f"AI Analyst (Gemini): {thesis}",
            invalidation=invalidation,
            params={"action": action, "qty": qty},
        )
    ]
