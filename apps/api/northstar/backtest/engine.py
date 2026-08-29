"""Vectorized backtests (pandas/numpy), walk-forward evaluation, Monte Carlo.

Design choices (documented for honesty):
- Daily bars from Alpaca (IEX feed). Costs modeled as bps on turnover.
- Momentum: rank on lookback return, hold top-N equal weight, rebalance every
  `rebalance_days` trading days.
- Wheel: an *approximation* on daily stock bars. Premium is estimated from
  realized vol (no full options history pre-2024) and assignment is settled on
  month-end price vs strike. Every report carries data_note saying exactly this.
- Walk-forward: parameters must be chosen on the IS window; OOS is the honest
  number we show. No optimizing on OOS.
"""

from __future__ import annotations

import numpy as np
import pandas as pd


# --------------------------------------------------------------------------- helpers

def close_frame(bars: dict[str, pd.DataFrame]) -> pd.DataFrame:
    cols = {}
    for sym, df in bars.items():
        cols[sym] = df["close"]
    out = pd.DataFrame(cols).sort_index()
    return out.dropna(how="all")


def metrics(daily_returns: pd.Series) -> dict:
    r = daily_returns.dropna()
    if len(r) < 20:
        return {"ann_return": None, "sharpe": None, "max_dd": None, "win_rate": None, "n_days": len(r)}
    ann = float((1 + r).prod() ** (252 / len(r)) - 1)
    vol = float(r.std() * np.sqrt(252))
    sharpe = float(ann / vol) if vol > 0 else 0.0
    curve = (1 + r).cumprod()
    dd = float((curve / curve.cummax() - 1).min())
    monthly = curve.resample("ME").last().pct_change().dropna()
    win = float((monthly > 0).mean()) if len(monthly) else None
    return {"ann_return": ann, "sharpe": sharpe, "max_dd": dd, "win_rate": win, "n_days": len(r)}


# --------------------------------------------------------------------------- momentum

def momentum_backtest(
    bars: dict[str, pd.DataFrame],
    lookback_days: int = 90,
    top_n: int = 3,
    rebalance_days: int = 5,
    cost_bps: float = 5.0,
) -> pd.Series:
    closes = close_frame(bars)
    rets = closes.pct_change()
    mom = closes.pct_change(lookback_days)

    weights = pd.DataFrame(0.0, index=closes.index, columns=closes.columns)
    current: list[str] = []
    for i in range(lookback_days + 1, len(closes)):
        if (i - lookback_days - 1) % rebalance_days == 0:
            row = mom.iloc[i - 1].dropna()
            current = list(row.sort_values(ascending=False).index[:top_n])
        if current:
            weights.iloc[i, [closes.columns.get_loc(s) for s in current]] = 1.0 / len(current)

    port = (weights * rets).sum(axis=1)
    turnover = weights.diff().abs().sum(axis=1).fillna(0.0)
    costs = turnover * (cost_bps / 10_000)
    return (port - costs).iloc[lookback_days + 1:]


# --------------------------------------------------------------------------- wheel approximation

def wheel_income_approx(
    underlying_bars: pd.DataFrame,
    target_delta: float = 0.25,
    otm_pct: float | None = None,
) -> pd.Series:
    """Monthly return series of a CSP-then-CC cycle on one underlying.

    Premium estimate: ATM 1-month premium ~= 0.4 * sigma_ann * sqrt(1/12) * S.
    An OTM (delta ~0.25) contract collects roughly half of ATM. Assignment when
    the month's close breaches the strike; stock P&L then realized vs strike.
    """
    closes = underlying_bars["close"]
    monthly = closes.resample("ME").last().dropna()
    daily_ret = closes.pct_change()
    out = []
    idx = []
    otm = otm_pct if otm_pct is not None else 0.05  # ~delta 0.25 proxy
    for i in range(12, len(monthly) - 1):
        s0 = float(monthly.iloc[i])
        s1 = float(monthly.iloc[i + 1])
        window = daily_ret.loc[: monthly.index[i]].tail(63)
        sigma = float(window.std() * np.sqrt(252))
        atm_prem = 0.4 * sigma * np.sqrt(1 / 12) * s0
        prem = 0.5 * atm_prem                     # OTM haircut
        strike = s0 * (1 - otm)                   # put strike below spot
        capital = strike                           # cash securing the put (per share)
        month_ret = s1 / s0 - 1
        if s1 >= strike:
            pnl = prem                             # expires worthless, keep premium
        else:
            pnl = prem + (s1 - strike)             # assigned: stock loss below strike
        out.append(pnl / capital)
        idx.append(monthly.index[i + 1])
        _ = month_ret
    return pd.Series(out, index=pd.DatetimeIndex(idx), name="wheel_monthly")


# --------------------------------------------------------------------------- walk-forward

def walk_forward_eval(
    bars: dict[str, pd.DataFrame],
    params: dict,
    oos_frac: float = 0.3,
    cost_bps: float = 5.0,
) -> dict:
    """IS/OOS split evaluation for a momentum param set. OOS is the headline."""
    closes = close_frame(bars)
    split = int(len(closes) * (1 - oos_frac))
    is_bars = {s: df[df.index.isin(closes.index[:split])] for s, df in bars.items()}
    oos_bars = {s: df[df.index.isin(closes.index[split - int(params.get("lookback_days", 90)) - 5:])]
                for s, df in bars.items()}

    r_is = momentum_backtest(
        is_bars,
        lookback_days=int(params.get("lookback_days", 90)),
        top_n=int(params.get("top_n", 3)),
        rebalance_days=int(params.get("rebalance_days", 5)),
        cost_bps=cost_bps,
    )
    r_oos = momentum_backtest(
        oos_bars,
        lookback_days=int(params.get("lookback_days", 90)),
        top_n=int(params.get("top_n", 3)),
        rebalance_days=int(params.get("rebalance_days", 5)),
        cost_bps=cost_bps,
    )
    m_is, m_oos = metrics(r_is), metrics(r_oos)
    return {
        "is": m_is,
        "oos": m_oos,
        "oos_returns": r_oos,
        "is_returns": r_is,
        "data_note": (
            f"Alpaca IEX daily bars, {closes.index[0].date()} to {closes.index[-1].date()}; "
            f"costs {cost_bps}bps on turnover; OOS = last {oos_frac:.0%} (never used for tuning)."
        ),
    }


# --------------------------------------------------------------------------- Monte Carlo for goals

def monte_carlo_goal(
    monthly_returns: pd.Series | list[float],
    months: int,
    capital: float,
    target_amount: float,
    n_paths: int = 4000,
    seed: int = 7,
) -> dict:
    """Bootstrap monthly returns -> P(final >= target) + percentile bands."""
    r = np.asarray(pd.Series(monthly_returns).dropna(), dtype=float)
    if len(r) < 12 or months <= 0:
        return {"probability": None, "note": "insufficient history"}
    rng = np.random.default_rng(seed)
    draws = rng.choice(r, size=(n_paths, months), replace=True)
    finals = capital * (1 + draws).prod(axis=1)
    paths_curve = capital * (1 + draws).cumprod(axis=1)
    pct = lambda q: np.percentile(paths_curve, q, axis=0).tolist()  # noqa: E731
    max_dd_paths = ((paths_curve / np.maximum.accumulate(paths_curve, axis=1)) - 1).min(axis=1)
    return {
        "probability": float((finals >= target_amount).mean()),
        "median_final": float(np.median(finals)),
        "p10_final": float(np.percentile(finals, 10)),
        "p40_final": float(np.percentile(finals, 40)),
        "p90_final": float(np.percentile(finals, 90)),
        "median_max_dd": float(np.median(max_dd_paths)),
        "band_p10": pct(10),
        "band_p50": pct(50),
        "band_p90": pct(90),
    }
