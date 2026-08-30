"""Performance report (tearsheet) for the write-up.

Data sources, preferred first:
1. Alpaca portfolio history - the broker's own daily equity for this paper account
2. state/equity_curve - points the nightly job accumulates (fallback)

Stats use the same conventions as the backtest engine. Realized P&L
attribution comes from journal pnl events; entries booked from expiry
inference are counted and labeled as estimates, never silently mixed in.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd

SPARK_CHARS = "\u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588"


def fetch_daily_equity() -> tuple[pd.Series | None, str]:
    """(daily equity series, source label). Broker first, nightly curve second."""
    try:
        from alpaca.trading.requests import GetPortfolioHistoryRequest

        from northstar.broker import trading_client

        hist = trading_client().get_portfolio_history(
            GetPortfolioHistoryRequest(period="3M", timeframe="1D")
        )
        stamps = list(getattr(hist, "timestamp", []) or [])
        equity = [e for e in (getattr(hist, "equity", []) or [])]
        pairs = [(t, e) for t, e in zip(stamps, equity) if e]
        if len(pairs) >= 2:
            idx = pd.to_datetime([t for t, _ in pairs], unit="s")
            return pd.Series([float(e) for _, e in pairs], index=idx), "alpaca_portfolio_history"
    except Exception:
        pass

    try:
        from northstar.journal import get_store

        points = (get_store().get("state", "equity_curve") or {}).get("points", [])
        if len(points) >= 2:
            idx = pd.to_datetime([p["date"] for p in points])
            return pd.Series([float(p["equity"]) for p in points], index=idx), "nightly_equity_curve"
    except Exception:
        pass
    return None, "none"


def equity_stats(equity: pd.Series) -> dict[str, Any]:
    equity = equity.sort_index()
    r = equity.pct_change().dropna()
    total = float(equity.iloc[-1] / equity.iloc[0] - 1)
    out: dict[str, Any] = {
        "start": str(equity.index[0].date()),
        "end": str(equity.index[-1].date()),
        "start_equity": round(float(equity.iloc[0]), 2),
        "end_equity": round(float(equity.iloc[-1]), 2),
        "total_return": round(total, 4),
        "n_days": len(r),
        "max_dd": round(float((equity / equity.cummax() - 1).min()), 4),
        "best_day": round(float(r.max()), 4) if len(r) else None,
        "worst_day": round(float(r.min()), 4) if len(r) else None,
        "daily_win_rate": round(float((r > 0).mean()), 3) if len(r) else None,
    }
    if len(r) >= 20:  # annualized numbers need some history to mean anything
        vol = float(r.std() * np.sqrt(252))
        ann = float((1 + r).prod() ** (252 / len(r)) - 1)
        out["ann_return"] = round(ann, 4)
        out["sharpe"] = round(ann / vol, 2) if vol > 0 else None
    else:
        out["ann_return"] = None
        out["sharpe"] = None
        out["note"] = f"annualized stats appear after 20 trading days (have {len(r)})"
    return out


def pnl_attribution(store) -> list[dict[str, Any]]:
    """Realized P&L by strategy family, from journal pnl events."""
    groups: dict[str, dict[str, Any]] = {}
    for ev in store.events(kinds=["pnl"], limit=2000):
        p = ev.payload
        fam = str(p.get("family") or "unattributed")
        g = groups.setdefault(fam, {"family": fam, "trades": 0, "wins": 0, "losses": 0,
                                    "realized": 0.0, "estimated": 0})
        realized = float(p.get("realized", 0.0))
        g["trades"] += 1
        g["realized"] += realized
        g["wins"] += 1 if realized > 0 else 0
        g["losses"] += 1 if realized < 0 else 0
        g["estimated"] += 1 if p.get("estimated") else 0
    rows = sorted(groups.values(), key=lambda g: -g["realized"])
    for g in rows:
        g["realized"] = round(g["realized"], 2)
    return rows


def sparkline(equity: pd.Series, width: int = 60) -> str:
    vals = equity.to_numpy(dtype=float)
    if len(vals) > width:
        idx = np.linspace(0, len(vals) - 1, width).astype(int)
        vals = vals[idx]
    lo, hi = float(vals.min()), float(vals.max())
    if hi <= lo:
        return SPARK_CHARS[0] * len(vals)
    steps = ((vals - lo) / (hi - lo) * (len(SPARK_CHARS) - 1)).astype(int)
    return "".join(SPARK_CHARS[s] for s in steps)


def build_report(store) -> dict[str, Any]:
    equity, source = fetch_daily_equity()
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": source,
        "stats": equity_stats(equity) if equity is not None else None,
        "spark": sparkline(equity) if equity is not None else None,
        "attribution": pnl_attribution(store),
    }


def render_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# NorthStar - Performance Tearsheet (paper account)",
        "",
        f"Generated {report['generated_at']} - equity source: `{report['source']}`.",
        "",
        "All results are from an Alpaca **paper** account. Past results never promise",
        "future returns; realized-P&L rows marked *estimated* were inferred from option",
        "expiry/assignment (no fill existed to price them exactly).",
        "",
    ]
    stats = report.get("stats")
    if stats:
        lines += [
            "## Equity curve",
            "",
            f"`{report['spark']}`",
            "",
            f"{stats['start']} ({fmt_usd(stats['start_equity'])}) to "
            f"{stats['end']} ({fmt_usd(stats['end_equity'])})",
            "",
            "| Metric | Value |",
            "| --- | --- |",
            f"| Total return | {stats['total_return']:+.2%} |",
            f"| Annualized return | {fmt_or_dash(stats['ann_return'], '{:+.2%}')} |",
            f"| Sharpe (daily, annualized) | {fmt_or_dash(stats['sharpe'], '{:.2f}')} |",
            f"| Max drawdown | {stats['max_dd']:.2%} |",
            f"| Daily win rate | {fmt_or_dash(stats['daily_win_rate'], '{:.0%}')} |",
            f"| Best / worst day | {fmt_or_dash(stats['best_day'], '{:+.2%}')} / "
            f"{fmt_or_dash(stats['worst_day'], '{:+.2%}')} |",
            f"| Trading days | {stats['n_days']} |",
        ]
        if stats.get("note"):
            lines.append(f"\n> {stats['note']}")
    else:
        lines += ["## Equity curve", "", "> No daily equity history yet - the nightly job",
                  "> records one point per day, and Alpaca needs a few sessions of activity."]

    lines += ["", "## Realized P&L by strategy", ""]
    attribution = report.get("attribution") or []
    if attribution:
        lines += [
            "| Strategy family | Trades | Wins | Losses | Realized $ | Estimated entries |",
            "| --- | ---: | ---: | ---: | ---: | ---: |",
        ]
        for g in attribution:
            lines.append(
                f"| {g['family']} | {g['trades']} | {g['wins']} | {g['losses']} | "
                f"{g['realized']:+,.2f} | {g['estimated']} |"
            )
        total = sum(g["realized"] for g in attribution)
        lines.append(f"\n**Total realized: {total:+,.2f} USD** (paper).")
    else:
        lines.append("> No closed round-trips yet - realized P&L appears once positions close.")

    lines += [
        "",
        "## Method notes",
        "",
        "- Equity: broker-reported daily equity when available, otherwise the nightly snapshot.",
        "- Realized P&L: booked on our own closing fills at exact fill prices; positions that",
        "  vanished without a fill (expiry/assignment/manual) are booked as labeled estimates.",
        "- Unrealized P&L is not in the attribution table - open positions are marked by the broker.",
        "",
    ]
    return "\n".join(lines)


def fmt_usd(x: float) -> str:
    return f"${x:,.0f}"


def fmt_or_dash(v, fmt: str) -> str:
    return fmt.format(v) if v is not None else "-"


# --------------------------------------------------------------------------- daily report
#
# The tearsheet above is the long-form story; this is the one-pager the night
# watch files every run: equity, today's P&L and fills, the compass regime,
# scout highlights and the captain's narrative, as ready-to-share markdown.

def _today_events(store, kinds: list[str], limit: int = 500) -> list[Any]:
    today = datetime.now(timezone.utc).date().isoformat()
    return [e for e in store.events(kinds=kinds, limit=limit) if str(e.ts).startswith(today)]


def build_daily_report(store, nightly_results: dict[str, Any] | None = None) -> dict[str, Any]:
    """Compose + persist the markdown daily report -> state/daily_report."""
    now = datetime.now(timezone.utc)
    lines = [
        f"# NorthStar daily report - {now.date().isoformat()}",
        "",
        "Autonomous paper-trading fleet on Alpaca. Nothing here is investment advice;",
        "every order passed the hard risk gate, every number traces to a journal event.",
        "",
    ]

    # equity ----------------------------------------------------------------
    points = (store.get("state", "equity_curve") or {}).get("points", [])
    if points:
        last = points[-1]
        line = f"**Equity:** {fmt_usd(float(last['equity']))} ({last['date']})"
        if len(points) >= 2:
            prev = float(points[-2]["equity"])
            if prev > 0:
                line += f", {float(last['equity']) / prev - 1:+.2%} vs prior point"
        lines += [line, ""]
    else:
        lines += ["**Equity:** no curve points yet (first nightly run pending).", ""]

    # today's trading -------------------------------------------------------
    fills = _today_events(store, ["fill"])
    pnls = _today_events(store, ["pnl"])
    lines.append("## Today on the water")
    lines.append("")
    if fills or pnls:
        lines.append(f"- {len(fills)} fill(s) landed today.")
        if pnls:
            realized = sum(float(e.payload.get("realized", 0.0)) for e in pnls)
            lines.append(f"- {len(pnls)} round-trip(s) closed, realized {realized:+,.2f} USD (paper).")
        for e in fills[:5]:
            lines.append(f"  - {e.human}")
    else:
        lines.append("- No fills today - the gate and the strategies agreed to sit tight.")
    lines.append("")

    # compass ---------------------------------------------------------------
    compass = store.get("state", "compass") or {}
    reg = compass.get("regime") or {}
    if reg:
        lines.append("## Market compass")
        lines.append("")
        lines.append(
            f"- Regime: **{reg.get('label', '?')}** "
            f"(streak {reg.get('streak_days', '?')}d, 20d vol {fmt_or_dash(reg.get('realized_vol_20d'), '{:.1%}')}, "
            f"breadth {fmt_or_dash(reg.get('breadth_above_50sma'), '{:.0%}')})"
        )
        if compass.get("hypothesis"):
            lines.append(f"- Hypothesis ({compass.get('hypothesis_source', 'template')}): {compass['hypothesis']}")
        lines.append("")

    # scout -----------------------------------------------------------------
    scout = store.get("state", "scout") or {}
    cands = scout.get("candidates", [])
    if cands:
        lines.append("## Scout highlights")
        lines.append("")
        for c in cands[:3]:
            lines.append(f"- **{c['symbol']}** ({c['flavor']}, score {c['score']:.2f}): {c['reason']}")
        if scout.get("weight_tilt"):
            lines.append(f"- Score weights tilted by factor IC: {scout['weight_tilt']}")
        watch = (store.get("state", "options_watch") or {}).get("ranked", [])
        if watch:
            tops = ", ".join(f"{r['symbol']} {r['ann_yield']:.0%}/yr" for r in watch[:3])
            lines.append(f"- Options watch (delta-band CSP yield): {tops}")
        lines.append("")

    # captain ---------------------------------------------------------------
    captain = (nightly_results or {}).get("captain")
    if not isinstance(captain, dict) or not captain.get("narrative"):
        for ev in store.events(kinds=["digest"], limit=5):
            cap = ev.payload.get("captain")
            if isinstance(cap, dict) and cap.get("narrative"):
                captain = cap
                break
    if isinstance(captain, dict) and captain.get("narrative"):
        lines += ["## Captain's log", "", f"> {captain['narrative']}", ""]

    # forecast skill ---------------------------------------------------------
    skill = store.get("state", "forecast_skill") or {}
    if skill.get("n_checks"):
        lines.append(
            f"*Forecast scorecard: q10-q90 coverage {fmt_or_dash(skill.get('coverage_q10_q90'), '{:.0%}')} "
            f"over {skill['n_checks']} checks (target 80%).*"
        )
        lines.append("")

    doc = {
        "date": now.date().isoformat(),
        "generated_at": now.isoformat(),
        "markdown": "\n".join(lines),
    }
    store.save("state", "daily_report", doc)
    return doc
