"""Slippage sensitivity: three fill tiers, monotone cost drag, tearsheet table."""

from northstar.backtest import FILL_TIERS, slippage_sensitivity
from northstar.report import build_report, render_markdown, slippage_tables
from tests.test_backtest_strategies import synthetic_bars
from tests.test_pnl import FakeStore


def test_three_tiers_ordered():
    assert list(FILL_TIERS) == ["mid", "quarter_spread", "half_spread"]
    assert FILL_TIERS["mid"] < FILL_TIERS["quarter_spread"] < FILL_TIERS["half_spread"]


def test_sensitivity_rows_and_monotone_drag():
    bars = synthetic_bars()
    out = slippage_sensitivity(
        bars, {"lookback_days": 60, "top_n": 2, "rebalance_days": 5},
        family="momentum_rotation",
    )
    rows = out["rows"]
    assert [r["assumption"] for r in rows] == ["mid", "quarter_spread", "half_spread"]
    anns = [r["oos"]["ann_return"] for r in rows]
    assert all(a is not None for a in anns)
    # higher cost can never IMPROVE the same trade sequence
    assert anns[0] >= anns[1] >= anns[2]
    assert out["fragile"] in (True, False)


def test_fragile_flag_semantics():
    bars = synthetic_bars()
    out = slippage_sensitivity(
        bars, {"lookback_days": 60, "top_n": 2, "rebalance_days": 5},
        family="momentum_rotation",
    )
    base = next(r for r in out["rows"] if r["assumption"] == "quarter_spread")
    worst = next(r for r in out["rows"] if r["assumption"] == "half_spread")
    expected = base["oos"]["sharpe"] > 0 and worst["oos"]["sharpe"] <= 0
    assert out["fragile"] is expected


def test_tearsheet_renders_slippage_table(monkeypatch):
    import northstar.report as report_mod

    store = FakeStore()
    store.save("lab_reports", "slippage_momentum_rotation", {
        "ok": True, "ts": "2026-08-31T00:00:00+00:00", "family": "momentum_rotation",
        "params_source": "champion", "fragile": True,
        "rows": [
            {"assumption": "mid", "cost_bps": 1.0,
             "oos": {"ann_return": 0.21, "sharpe": 1.4, "max_dd": -0.11, "n_days": 200},
             "is": {"ann_return": 0.25, "sharpe": 1.6}},
            {"assumption": "quarter_spread", "cost_bps": 5.0,
             "oos": {"ann_return": 0.12, "sharpe": 0.8, "max_dd": -0.13, "n_days": 200},
             "is": {"ann_return": 0.16, "sharpe": 1.0}},
            {"assumption": "half_spread", "cost_bps": 9.0,
             "oos": {"ann_return": -0.02, "sharpe": -0.1, "max_dd": -0.18, "n_days": 200},
             "is": {"ann_return": 0.02, "sharpe": 0.2}},
        ],
    })
    # weather doc must not leak into the slippage section
    store.save("lab_reports", "weather_validation", {"ok": True, "floors": []})
    monkeypatch.setattr(report_mod, "fetch_daily_equity", lambda: (None, "none"))

    assert len(slippage_tables(store)) == 1
    md = render_markdown(build_report(store))
    assert "## Slippage sensitivity" in md
    assert "| mid | 1 | +21.0% | 1.40 | -11.0% |" in md
    assert "| half spread | 9 | -2.0% | -0.10 | -18.0% |" in md
    assert "**Fragile:**" in md
