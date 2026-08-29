"""G1 smoke: clock + account + one quote, appended to the journal.

Run: uv run python -m northstar.smoke
"""

from __future__ import annotations

import json

from northstar.broker import get_account_summary, get_clock, latest_quote
from northstar.domain import JournalEvent
from northstar.journal import get_store


def run() -> dict:
    clock = get_clock()
    account = get_account_summary()
    quote = latest_quote("SPY")
    result = {"clock": clock, "account": account, "quote": quote}
    get_store().append_event(
        JournalEvent(
            kind="system",
            human=(
                f"Smoke OK - paper account equity ${account['equity']:,.0f}, "
                f"market {'open' if clock['is_open'] else 'closed'}, "
                f"SPY {quote['bid']}/{quote['ask']}"
            ),
            payload=result,
        )
    )
    return result


if __name__ == "__main__":
    print(json.dumps(run(), indent=2))
