"""Read-only market view for the cockpit chart panel.

Bars, our own fills as chart markers, and the account equity curve -
formatting helpers are pure (testable), broker calls sit behind a small
TTL cache so chart clicks don't hammer the data API. Nothing in this
module can place, modify, or cancel an order.
"""

from __future__ import annotations

import re
import time
from typing import Any

from northstar.domain import JournalEvent

_BARS_TTL_S = 600
_bars_cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}

_SYMBOL_RE = re.compile(r"^[A-Z][A-Z0-9.]{0,9}$")


def valid_symbol(symbol: str) -> bool:
    return bool(_SYMBOL_RE.match(symbol))


def bars_rows(symbol: str, days: int = 130) -> list[dict[str, Any]]:
    """Last `days` daily OHLCV rows for one symbol, cached for 10 minutes."""
    key = f"{symbol}:{days}"
    hit = _bars_cache.get(key)
    if hit and time.monotonic() - hit[0] < _BARS_TTL_S:
        return hit[1]

    from northstar.broker import daily_bars

    df = daily_bars([symbol], years=max(days / 250.0, 0.7)).get(symbol)
    rows: list[dict[str, Any]] = []
    if df is not None and len(df):
        tail = df.tail(days)
        for ts, r in tail.iterrows():
            rows.append({
                "t": str(getattr(ts, "date", lambda: ts)()),
                "o": round(float(r["open"]), 4),
                "h": round(float(r["high"]), 4),
                "l": round(float(r["low"]), 4),
                "c": round(float(r["close"]), 4),
                "v": float(r.get("volume") or 0),
            })
    _bars_cache[key] = (time.monotonic(), rows)
    return rows


def _fill_side(human: str) -> str:
    h = human.lower()
    if "buy" in h:
        return "buy"
    if "sell" in h:
        return "sell"
    return "fill"


def fills_markers(events: list[JournalEvent], underlying: str) -> list[dict[str, Any]]:
    """Chart markers from our own journaled fills for one underlying.

    Matches the equity symbol itself and any OCC option symbol on it
    (e.g. underlying NVDA also matches NVDA260918C00190000).
    """
    out: list[dict[str, Any]] = []
    for e in events:
        if e.kind != "fill":
            continue
        sym = str((e.payload or {}).get("symbol") or "")
        if not (sym == underlying or (sym.startswith(underlying) and len(sym) > 15)):
            continue
        price = (e.payload or {}).get("filled_avg_price")
        out.append({
            "ts": e.ts,
            "date": str(e.ts)[:10],
            "symbol": sym,
            "side": _fill_side(e.human or ""),
            "price": float(price) if price else None,
            "qty": float((e.payload or {}).get("filled_qty") or 0),
            "label": (e.human or "")[:120],
        })
    out.reverse()  # oldest first, the order chart markers want
    return out


def equity_points() -> dict[str, Any]:
    """Daily account equity for the cockpit sparkline (broker first, nightly fallback)."""
    from northstar.report import fetch_daily_equity

    series, source = fetch_daily_equity()
    if series is None:
        return {"points": [], "source": source}
    return {
        "points": [
            {"t": str(ts.date()), "equity": round(float(v), 2)}
            for ts, v in series.sort_index().items()
        ],
        "source": source,
    }
