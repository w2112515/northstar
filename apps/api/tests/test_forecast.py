"""TimesFM forecast module: band assembly, cache behavior, honest degradation."""

from typing import Any

import numpy as np
import pandas as pd

import northstar.forecast as forecast


class FakeStore:
    def __init__(self):
        self.docs: dict[tuple[str, str], dict[str, Any]] = {}
        self.event_log: list[Any] = []

    def append_event(self, event) -> None:
        self.event_log.append(event)

    def save(self, collection, doc_id, doc) -> None:
        self.docs[(collection, doc_id)] = doc

    def get(self, collection, doc_id):
        return self.docs.get((collection, doc_id))

    def list(self, collection):
        return [doc for (coll, _), doc in self.docs.items() if coll == collection]


class FakeModel:
    """Deterministic stand-in with the real (point, quantiles) contract."""

    def forecast(self, horizon, inputs):
        n = len(inputs)
        point = np.zeros((n, horizon))
        quantiles = np.zeros((n, horizon, 10))
        for i, series in enumerate(inputs):
            last = float(series[-1])
            for h in range(horizon):
                point[i, h] = last * (1 + 0.01 * (h + 1))       # +1%/day drift
                quantiles[i, h, 1] = last * (1 - 0.02 * (h + 1))  # q10
                quantiles[i, h, 5] = last * (1 + 0.005 * (h + 1))  # q50
                quantiles[i, h, 9] = last * (1 + 0.03 * (h + 1))  # q90
        return point, quantiles


def bars_df(price=100.0, n=300):
    return pd.DataFrame({"close": np.linspace(price * 0.9, price, n)})


def test_symbol_doc_orders_bands_and_computes_pct():
    closes = np.array([100.0] * 10)
    # deliberately swapped lo/hi to prove defensive re-ordering
    doc = forecast._symbol_doc(
        closes,
        point_path=[101, 102, 103, 104, 105],
        band_lo=[110, 110, 110, 110, 110],
        band_hi=[95, 95, 95, 95, 95],
        band_mid=[100, 101, 102, 103, 104],
    )
    assert doc["q10"] == [95.0] * 5
    assert doc["q90"] == [110.0] * 5
    assert doc["exp_5d_pct"] == 5.0
    assert doc["q10_5d_pct"] == -5.0
    assert doc["q90_5d_pct"] == 10.0


def test_refresh_writes_cache_and_journal(monkeypatch):
    store = FakeStore()
    monkeypatch.setattr(forecast, "_load_model", lambda: FakeModel())
    monkeypatch.setattr("northstar.broker.daily_bars",
                        lambda symbols, years=2.5: {s: bars_df() for s in symbols})
    doc = forecast.refresh_forecasts(store, symbols=["SPY", "NVDA"])
    assert doc is not None
    assert set(doc["symbols"]) == {"SPY", "NVDA"}
    spy = doc["symbols"]["SPY"]
    assert len(spy["point"]) == forecast.HORIZON_DAYS
    assert spy["q10"][-1] < spy["q50"][-1] < spy["q90"][-1]
    assert spy["exp_5d_pct"] == 5.0  # +1%/day drift for 5 days
    # cached + journaled
    assert store.get("state", "forecast") == doc
    assert store.event_log[-1].kind == "forecast"
    assert forecast.get_forecasts(store) == doc


def test_refresh_without_model_returns_none(monkeypatch):
    store = FakeStore()
    monkeypatch.setattr(forecast, "_load_model", lambda: None)
    assert forecast.refresh_forecasts(store, symbols=["SPY"]) is None
    assert store.get("state", "forecast") is None


def test_short_history_symbols_are_skipped(monkeypatch):
    store = FakeStore()
    monkeypatch.setattr(forecast, "_load_model", lambda: FakeModel())
    monkeypatch.setattr("northstar.broker.daily_bars",
                        lambda symbols, years=2.5: {"SPY": bars_df(n=300), "IPO": bars_df(n=50)})
    doc = forecast.refresh_forecasts(store, symbols=["SPY", "IPO"])
    assert set(doc["symbols"]) == {"SPY"}


def test_get_forecasts_never_computes():
    store = FakeStore()
    assert forecast.get_forecasts(store) is None  # empty cache -> None, no model load


# --------------------------------------------------------------------------- scorecard

def snap(last=100.0):
    return {
        "ts": "2026-08-24T02:00:00+00:00",
        "symbols": {
            "SPY": {
                "last_close": last,
                "q10": [98.0, 97.0, 96.0, 95.0, 94.0],
                "q50": [100.0, 100.5, 101.0, 101.5, 102.0],
                "q90": [102.0, 103.0, 104.0, 105.0, 106.0],
            }
        },
    }


def test_score_rows_grades_only_elapsed_horizons():
    rows = forecast.score_rows(snap(), {"SPY": [101.0, 108.0]})  # 2 of 5 days elapsed
    assert len(rows) == 2
    assert rows[0]["in_band"] is True          # 101 within [98, 102]
    assert rows[1]["in_band"] is False         # 108 above q90=103
    # pinball: q50 miss on day1 = 0.5*(101-100)/100
    assert abs(rows[0]["pinball_q50"] - 0.005) < 1e-9
    # day2 above q90: tau*(y-q) = 0.9*(108-103)/100
    assert abs(rows[1]["pinball_q90"] - 0.045) < 1e-9


def test_aggregate_skill_coverage():
    rows = forecast.score_rows(snap(), {"SPY": [101.0, 108.0]})
    skill = forecast.aggregate_skill(rows)
    assert skill["n_checks"] == 2
    assert skill["coverage_q10_q90"] == 0.5
    assert forecast.aggregate_skill([]) is None


def test_refresh_appends_snapshot_and_score_reads_it(monkeypatch):
    store = FakeStore()
    monkeypatch.setattr(forecast, "_load_model", lambda: FakeModel())
    monkeypatch.setattr("northstar.broker.daily_bars",
                        lambda symbols, years=2.5: {s: bars_df() for s in symbols})
    forecast.refresh_forecasts(store, symbols=["SPY"])
    snaps = (store.get("state", "forecast_history") or {})["snapshots"]
    assert len(snaps) == 1 and "SPY" in snaps[0]["symbols"]

    # realized bars strictly after the snapshot date -> the scorer grades them
    idx = pd.date_range("2026-09-01", periods=3, freq="B", tz="UTC")
    realized = pd.DataFrame({"close": [100.0, 101.0, 102.0]}, index=idx)
    monkeypatch.setattr("northstar.broker.daily_bars",
                        lambda symbols, years=0.2: {"SPY": realized})
    skill = forecast.score_forecasts(store)
    assert skill["n_checks"] == 3
    assert store.get("state", "forecast_skill") is not None
    assert "scorecard" in store.event_log[-1].human.lower()
