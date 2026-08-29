"""Gemini access with honest degradation.

No GOOGLE_API_KEY -> every helper returns None and callers must fall back to
deterministic behavior *and say so* in the journal. We never fake AI output.
"""

from __future__ import annotations

import json
import os
from functools import lru_cache
from typing import Any

from northstar.config import get_settings

FLASH_MODEL = os.getenv("GEMINI_FLASH_MODEL", "gemini-2.5-flash")
PRO_MODEL = os.getenv("GEMINI_PRO_MODEL", "gemini-2.5-pro")


@lru_cache(maxsize=1)
def _client():
    s = get_settings()
    if not s.google_api_key:
        return None
    from google import genai

    return genai.Client(api_key=s.google_api_key)


def llm_available() -> bool:
    return _client() is not None


def generate_text(prompt: str, model: str | None = None, temperature: float = 0.4) -> str | None:
    client = _client()
    if client is None:
        return None
    try:
        resp = client.models.generate_content(
            model=model or FLASH_MODEL,
            contents=prompt,
            config={"temperature": temperature},
        )
        return resp.text
    except Exception:
        return None


def generate_json(prompt: str, model: str | None = None, temperature: float = 0.2) -> dict[str, Any] | None:
    client = _client()
    if client is None:
        return None
    try:
        resp = client.models.generate_content(
            model=model or FLASH_MODEL,
            contents=prompt,
            config={"temperature": temperature, "response_mime_type": "application/json"},
        )
        return json.loads(resp.text)
    except Exception:
        return None
