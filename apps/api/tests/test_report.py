"""Tearsheet: stats conventions, attribution grouping, markdown rendering."""

import numpy as np
import pandas as pd

from northstar.domain import JournalEvent
from northstar.report import (
    build_report,
    equity_stats,
    pnl_attribution,
    render_markdown,
    sparkline,
)
from tests.test_pnl import FakeStore


def equity_series(n=60, seed=5, start=100_000.0):
    rng = np.random.default_rng(seed)
    rets = rng.normal(0.0006, 0.008, n)
    idx = pd.bdate_range("2026-06-01", periods=n)
    return pd.Series(start * (1 + pd.Series(rets, index=idx)).cumprod(), index=idx)


def pnl_event(family, realized, estimated=False):
    return JournalEvent(kind="pnl", human="x", payload={
        "family": family, "realized": realized, "estimated": estimated})


def test_equity_stats_mature_series():
    stats = equity_stats(equity_series())
    assert stats["n_days"] == 59
    assert stats["sharpe"] is not None
    assert stats["ann_return"] is not None
    assert -1 <= stats["max_dd"] <= 0
    assert stats["total_return"] == round(stats["end_equity"] / stats["start_equity"] - 1, 4)


def test_equity_stats_young_series_omits_annualized():
    stats = equity_stats(equity_series(n=6))
    assert stats["sharpe"] is None and stats["ann_return"] is None
    assert "annualized stats appear" in stats["note"]


def test_pnl_attribution_groups_and_labels_estimates():
    s = FakeStore()
    s.append_event(pnl_event("wheel", 250.0, estimated=True))
    s.append_event(pnl_event("wheel", -80.0))
    s.append_event(pnl_event("momentum_rotation", 120.0))
    rows = pnl_attribution(s)
    by_family = {r["family"]: r for r in rows}
    wheel = by_family["wheel"]
    assert wheel["trades"] == 2 and wheel["wins"] == 1 and wheel["losses"] == 1
    assert wheel["realized"] == 170.0
    assert wheel["estimated"] == 1
    assert rows[0]["realized"] >= rows[-1]["realized"]  # sorted, best first


def test_sparkline_length_and_monotone_extremes():
    eq = pd.Series([1.0, 2.0, 3.0, 4.0], index=pd.bdate_range("2026-01-05", periods=4))
    line = sparkline(eq)
    assert len(line) == 4
    assert line[0] == "\u2581" and line[-1] == "\u2588"


def test_render_markdown_smoke(monkeypatch):
    import northstar.report as report_mod

    s = FakeStore()
    s.append_event(pnl_event("wheel", 250.0, estimated=True))
    monkeypatch.setattr(report_mod, "fetch_daily_equity",
                        lambda: (equity_series(), "nightly_equity_curve"))
    md = render_markdown(build_report(s))
    assert "# NorthStar - Performance Tearsheet" in md
    assert "paper" in md
    assert "| wheel | 1 | 1 | 0 |" in md
    assert "Estimated entries" in md
    assert "nightly_equity_curve" in md


# --------------------------------------------------------------------------- daily report

from northstar.report import build_daily_report  # noqa: E402


def test_daily_report_empty_store_is_honest():
    s = FakeStore()
    doc = build_daily_report(s)
    md = doc["markdown"]
    assert "# NorthStar daily report" in md
    assert "no curve points yet" in md
    assert "No fills today" in md
    assert s.get("state", "daily_report") == doc


def test_daily_report_quotes_every_section():
    s = FakeStore()
    s.save("state", "equity_curve", {"points": [
        {"date": "2026-08-28", "equity": 100_000.0},
        {"date": "2026-08-29", "equity": 101_000.0},
    ]})
    s.save("state", "scout", {
        "weight_tilt": "momentum +12% (IC +0.031)",
        "candidates": [{"symbol": "NVDA", "flavor": "uptrend", "score": 0.81,
                        "reason": "up 9.0% in 20d, RSI 66"}],
    })
    s.save("state", "options_watch", {"ranked": [
        {"symbol": "NVDA", "ann_yield": 0.24, "strike": 100.0, "dte": 30, "bid": 2.0, "delta": -0.25},
    ]})
    s.save("state", "compass", {
        "regime": {"label": "risk_on_trend", "streak_days": 7,
                   "realized_vol_20d": 0.14, "breadth_above_50sma": 0.66},
        "hypothesis": "Trend intact; breadth healthy.", "hypothesis_source": "template",
    })
    s.save("state", "forecast_skill", {"n_checks": 40, "coverage_q10_q90": 0.78})
    s.append_event(JournalEvent(kind="fill", human="BUY 10 NVDA @ 100", payload={}))
    s.append_event(pnl_event("wheel", 320.0))

    md = build_daily_report(s, {"captain": {"narrative": "We held the line and banked premium."}})["markdown"]
    assert "+1.00% vs prior point" in md
    assert "1 fill(s) landed today" in md
    assert "realized +320.00 USD" in md
    assert "risk_on_trend" in md and "Trend intact" in md
    assert "**NVDA**" in md and "momentum +12%" in md and "24%/yr" in md
    assert "We held the line" in md
    assert "coverage 78%" in md


def test_daily_report_captain_falls_back_to_latest_digest():
    s = FakeStore()
    s.append_event(JournalEvent(kind="digest", human="night", payload={
        "captain": {"narrative": "Quiet night, discipline held."}}))
    md = build_daily_report(s)["markdown"]
    assert "Quiet night, discipline held." in md
