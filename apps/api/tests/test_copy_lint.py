"""Copy honesty lint: banned promise-words must never appear in user-facing text.

Scans backend plain-speak strings and the web app source. "Guaranteed returns"
language is both unethical and against both hackathons' spirit.
"""

from pathlib import Path

REPO = Path(__file__).resolve().parents[3]

BANNED = [
    "guaranteed return", "guaranteed profit", "risk-free", "risk free",
    "can't lose", "cannot lose", "sure win", "surefire", "no risk",
    "get rich", "always profitable", "never lose",
]

SCAN_DIRS = [
    REPO / "apps" / "api" / "northstar",
    REPO / "apps" / "web" / "src",
]


def test_no_banned_promises():
    hits = []
    for d in SCAN_DIRS:
        for f in d.rglob("*"):
            if f.suffix not in (".py", ".tsx", ".ts") or "node_modules" in f.parts:
                continue
            text = f.read_text(encoding="utf-8", errors="ignore").lower()
            for phrase in BANNED:
                if phrase in text and f.name != "test_copy_lint.py":
                    hits.append(f"{f.relative_to(REPO)}: '{phrase}'")
    assert not hits, "Banned promise-language found:\n" + "\n".join(hits)
