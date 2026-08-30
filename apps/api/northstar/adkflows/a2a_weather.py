"""Market Weather Station as an A2A-discoverable agent.

Any A2A client (another hackathon team's agent, `adk web`, a plain JSON-RPC
call) can discover this agent via its auto-generated agent card and ask for
the current market weather. The reply is deterministic - it serves the same
cached reading the cockpit and the risk gate consume, so there is no LLM cost
per query and no way for the answer to drift from what the gate actually used.

Wire format: one text part containing a JSON document (score, bucket,
components, report line, degraded sources, timestamp).
"""

from __future__ import annotations

import asyncio
import json
import os
from typing import AsyncGenerator

from google.adk.agents import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event
from google.genai import types


class WeatherStationAgent(BaseAgent):
    """Deterministic responder: current market weather from the shared store."""

    async def _run_async_impl(self, ctx: InvocationContext) -> AsyncGenerator[Event, None]:
        payload = await asyncio.to_thread(self._reading)
        yield Event(
            invocation_id=ctx.invocation_id,
            author=self.name,
            content=types.Content(
                role="model",
                parts=[types.Part(text=json.dumps(payload, ensure_ascii=False))],
            ),
        )

    @staticmethod
    def _reading() -> dict:
        from northstar.journal import get_store
        from northstar.weather import get_weather

        doc = get_weather(get_store())
        if not doc:
            return {
                "status": "offline",
                "note": "All weather sources are unreachable; risk gate treats weather as offline (no new-risk pause).",
            }
        return {
            "status": "ok",
            "score": doc.get("score"),
            "bucket": doc.get("bucket"),
            "components": doc.get("components"),
            "report": doc.get("report"),
            "degraded_sources": doc.get("degraded", []),
            "updated_at": doc.get("ts"),
            "note": "Same cached reading the NorthStar risk gate consumes (weather_floor rule).",
        }


def build_weather_agent() -> WeatherStationAgent:
    return WeatherStationAgent(
        name="market_weather_station",
        description=(
            "Market Weather Station for US equities: composite 0-100 calm/storm score "
            "built from SPY realized volatility percentile, Alpaca news headline tone, "
            "and GDELT global tone. Returns the current reading as JSON, including "
            "per-component scores, a plain-language report line, degraded sources and "
            "the timestamp. Deterministic; no LLM call per query."
        ),
    )


A2A_RPC_PATH = "a2a/weather"


def build_a2a_app(host: str | None = None, port: int | None = None):
    """Starlette sub-app exposing the weather agent over A2A (JSON-RPC + agent card)."""
    from google.adk.a2a.utils.agent_to_a2a import to_a2a

    return to_a2a(
        build_weather_agent(),
        host=host or os.getenv("A2A_HOST", "localhost"),
        port=port or int(os.getenv("PORT", os.getenv("A2A_PORT", "8800"))),
        protocol=os.getenv("A2A_PROTOCOL", "http"),
        rpc_path=A2A_RPC_PATH,
    )
