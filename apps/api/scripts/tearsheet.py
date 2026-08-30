"""Generate docs/TEARSHEET.md from live account data + the journal.

Usage (from apps/api):  uv run python scripts/tearsheet.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from northstar.journal import get_store  # noqa: E402
from northstar.report import build_report, render_markdown  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[3]
OUT = REPO_ROOT / "docs" / "TEARSHEET.md"


def main() -> None:
    report = build_report(get_store())
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(render_markdown(report), encoding="utf-8")
    stats = report.get("stats") or {}
    print(f"wrote {OUT}")
    print(f"source={report['source']} days={stats.get('n_days')} "
          f"total_return={stats.get('total_return')}")


if __name__ == "__main__":
    main()
