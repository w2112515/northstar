"""Gemini access with honest degradation.

No GOOGLE_API_KEY -> every helper returns None and callers must fall back to
deterministic behavior *and say so* in the journal. We never fake AI output.

Model routing (verified against this project's free-tier key, Aug 2026):
- gemini-3.7-flash (GA 2026-08-13): "Pro-level agentic capabilities" per Google;
  free tier works, but the model is new and occasionally returns 503 under load.
- gemini-3.5-flash: stable fallback on the same key.
- gemini-3.1-pro-preview: paid-tier only (free quota is 0) -> never route there.
"""

from __future__ import annotations

import json
import os
from functools import lru_cache
from typing import Any

from northstar.config import get_settings

FLASH_MODEL = os.getenv("GEMINI_FLASH_MODEL", "gemini-3.7-flash")
PRO_MODEL = os.getenv("GEMINI_PRO_MODEL", "gemini-3.7-flash")
FALLBACK_MODEL = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-3.5-flash")
# Third rung: free-tier quotas are per model (~20/day each, verified 8/31), so
# every extra model in the chain adds a day's worth of headroom.
FALLBACK2_MODEL = os.getenv("GEMINI_FALLBACK2_MODEL", "gemini-3.5-flash-lite")


@lru_cache(maxsize=1)
def _client():
    s = get_settings()
    if not s.google_api_key:
        return None
    from google import genai
    from google.genai import types as gtypes

    # Hard per-request timeout (ms). Without it a throttled model can hold the
    # connection open for minutes and hang whatever asked for the LLM call.
    return genai.Client(api_key=s.google_api_key, http_options=gtypes.HttpOptions(timeout=25_000))


def llm_available() -> bool:
    return _client() is not None


def _model_chain(model: str | None) -> list[str]:
    primary = model or FLASH_MODEL
    chain = [primary]
    for fb in (FALLBACK_MODEL, FALLBACK2_MODEL):
        if fb and fb not in chain:
            chain.append(fb)
    return chain


RETRIES_PER_MODEL = 2
RETRY_PAUSE_S = 2.5


def _generate(prompt: str, model: str | None, config: dict[str, Any]) -> str | None:
    """Try each model in the chain up to RETRIES_PER_MODEL times.

    503s on the brand-new 3.7-flash are load spikes that usually clear in
    seconds; one short retry per model beats failing a whole pass over them.
    """
    import time

    client = _client()
    if client is None:
        return None
    for m in _model_chain(model):
        for attempt in range(RETRIES_PER_MODEL):
            try:
                resp = client.models.generate_content(model=m, contents=prompt, config=config)
                return resp.text
            except Exception as e:
                msg = str(e)
                quota = "RESOURCE_EXHAUSTED" in msg or "429" in msg[:40]
                print(f"[llm] {m} attempt {attempt + 1} failed: {type(e).__name__}: {msg[:200]}")
                if quota:
                    # Quota is spent for the day/window - retrying the same
                    # model only burns time. Jump straight to the next rung.
                    break
                if attempt + 1 < RETRIES_PER_MODEL:
                    time.sleep(RETRY_PAUSE_S)
    return None


def generate_text(prompt: str, model: str | None = None, temperature: float = 0.4) -> str | None:
    return _generate(prompt, model, {"temperature": temperature})


def generate_json(prompt: str, model: str | None = None, temperature: float = 0.2) -> dict[str, Any] | None:
    text = _generate(prompt, model, {"temperature": temperature, "response_mime_type": "application/json"})
    if text is None:
        return None
    try:
        return json.loads(text)
    except Exception as e:
        print(f"[llm] json parse failed: {type(e).__name__}: {e}")
        return None
