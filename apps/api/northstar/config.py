from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import dotenv_values, load_dotenv

# apps/api/northstar/config.py -> repo root is parents[3]. The deploy container
# has no repo checkout (package sits at /app/northstar): fall back to the
# package's parent - env comes from the platform there, and data/ only matters
# for the local store.
_here = Path(__file__).resolve()
REPO_ROOT = _here.parents[3] if len(_here.parents) > 3 else _here.parents[1]
_ENV_FILE = REPO_ROOT / ".env"
# .env is the local source of truth; override any empty inherited env vars.
load_dotenv(_ENV_FILE, override=True)
_FILE_ENV = dotenv_values(_ENV_FILE)


def _cred(name: str) -> str | None:
    """systemd LoadCredential support: secrets arrive as files in
    $CREDENTIALS_DIRECTORY, named like the lowercased env var. Highest
    priority - a box using credentials has deliberately removed the value
    from .env, so nothing else should shadow it."""
    cred_dir = os.getenv("CREDENTIALS_DIRECTORY", "")
    if not cred_dir:
        return None
    try:
        val = (Path(cred_dir) / name.lower()).read_text(encoding="utf-8").strip()
        return val or None
    except OSError:
        return None


def _env(name: str, default: str = "") -> str:
    """Secret resolution order: systemd credential file > .env file > process
    env (empty GOOGLE_API_KEY often leaks in via inherited env)."""
    cred = _cred(name)
    if cred is not None:
        return cred
    file_val = _FILE_ENV.get(name)
    if file_val is not None and str(file_val).strip() != "":
        return str(file_val).strip()
    return os.getenv(name, default).strip()


def secret_env(name: str, default: str = "") -> str:
    """Public helper for modules that read secrets outside Settings
    (e.g. the API's admin token)."""
    return _env(name, default)


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
    paper = _env("ALPACA_PAPER", "true").lower() != "false"
    role = _env("ACCOUNT_ROLE", "dev")
    # Both accounts can live in .env at once: ALPACA_API_KEY_<ROLE> wins over the
    # default pair, so switching tracks = flip ACCOUNT_ROLE, restart. One line.
    key = _env(f"ALPACA_API_KEY_{role.upper()}") or _env("ALPACA_API_KEY")
    secret = _env(f"ALPACA_SECRET_KEY_{role.upper()}") or _env("ALPACA_SECRET_KEY")
    if not paper:
        # Hard safety boundary for the hackathon build: live trading is not implemented.
        raise RuntimeError("Live trading is disabled in this build (ALPACA_PAPER must be true).")
    if key and not key.startswith("PK"):
        raise RuntimeError("Refusing to start: ALPACA_API_KEY does not look like a paper key (PK...).")
    # Journal/state are account-specific (peak equity, cooldowns, approvals):
    # each role gets its own directory so switching Alpaca keys never mixes books.
    data_dir = REPO_ROOT / "data" / role
    data_dir.mkdir(parents=True, exist_ok=True)
    return Settings(
        alpaca_api_key=key,
        alpaca_secret_key=secret,
        alpaca_paper=True,
        account_role=role,
        google_api_key=_env("GOOGLE_API_KEY"),
        journal_store=_env("JOURNAL_STORE", "local"),
        data_dir=data_dir,
    )
