import os

# Tests must never download the TimesFM checkpoint (~800MB); the forecast tests
# that need a model monkeypatch _load_model directly.
os.environ.setdefault("TIMESFM_DISABLED", "1")

# No live news calls from the analyst's critic during tests.
os.environ.setdefault("ANALYST_NEWS_DISABLED", "1")

# No live screener/bars calls from the scout during tests; scout tests
# monkeypatch the fetchers and delete this flag explicitly.
os.environ.setdefault("NORTHSTAR_SCOUT_DISABLED", "1")
os.environ.setdefault("NORTHSTAR_OPTIONS_SCAN_DISABLED", "1")
os.environ.setdefault("NORTHSTAR_FACTORS_DISABLED", "1")
os.environ.setdefault("NORTHSTAR_SHIPYARD_DISABLED", "1")
os.environ.setdefault("NORTHSTAR_MINING_DISABLED", "1")

# Day-log narrative falls back to the deterministic template in tests.
os.environ.setdefault("NORTHSTAR_CAPTAIN_LLM_DISABLED", "1")

# Nightly lessons distillation stays off unless a test enables it explicitly.
os.environ.setdefault("NORTHSTAR_LESSONS_DISABLED", "1")

# Compass/advisor steps hit live bars + LLM; unit tests call the pure pieces.
os.environ.setdefault("NORTHSTAR_COMPASS_DISABLED", "1")
os.environ.setdefault("NORTHSTAR_COMPASS_LLM_DISABLED", "1")
os.environ.setdefault("NORTHSTAR_ADVISOR_DISABLED", "1")

import pytest  # noqa: E402


def pytest_addoption(parser):
    parser.addoption(
        "--live-llm",
        action="store_true",
        default=False,
        help="run the tests/evals cases tagged live_accept against the real Gemini chain",
    )


@pytest.fixture
def live_llm(request) -> bool:
    return bool(request.config.getoption("--live-llm"))
