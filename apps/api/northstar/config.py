from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

# apps/api/northstar/config.py -> repo root is parents[3]
REPO_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(REPO_ROOT / ".env")


@dataclass(frozen=True)
class Settings:
    alpaca_api_key: str
    alpaca_secret_key: str
    alpaca_paper: bool
    account_role: str  # dev | competition
    google_api_key: str
    journal_store: str  # local | firestore
    data_dir: Path

    @property
    def llm_enabled(self) -> bool:
        return bool(self.google_api_key)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    paper = os.getenv("ALPACA_PAPER", "true").strip().lower() != "false"
    key = os.getenv("ALPACA_API_KEY", "")
    if not paper:
        # Hard safety boundary for the hackathon build: live trading is not implemented.
        raise RuntimeError("Live trading is disabled in this build (ALPACA_PAPER must be true).")
    if key and not key.startswith("PK"):
        raise RuntimeError("Refusing to start: ALPACA_API_KEY does not look like a paper key (PK...).")
    data_dir = REPO_ROOT / "data"
    data_dir.mkdir(exist_ok=True)
    return Settings(
        alpaca_api_key=key,
        alpaca_secret_key=os.getenv("ALPACA_SECRET_KEY", ""),
        alpaca_paper=True,
        account_role=os.getenv("ACCOUNT_ROLE", "dev"),
        google_api_key=os.getenv("GOOGLE_API_KEY", "").strip(),
        journal_store=os.getenv("JOURNAL_STORE", "local"),
        data_dir=data_dir,
    )
