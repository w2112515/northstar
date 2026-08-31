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


# --------------------------------------------------------------------------- rsi mean reversion

def rsi_reversion_backtest(
    bars: dict[str, pd.DataFrame],
    rsi_period: int = 2,
    entry_rsi: float = 10,
    exit_rsi: float = 70,
    trend_sma: int = 200,
    max_names: int = 3,
    cost_bps: float = 5.0,
) -> pd.Series:
    """Fixed 1/max_names slot per active position; idle capital earns 0.

    Signals mirror strategies/meanrev.py exactly: enter RSI<entry above trend,
    exit RSI>exit or trend break. Signal on close, position from next day.
    """
    from northstar.indicators import rsi as rsi_fn

    closes = close_frame(bars)
    rets = closes.pct_change()
    in_pos = pd.DataFrame(0.0, index=closes.index, columns=closes.columns)
    for sym in closes.columns:
        c = closes[sym].dropna()
        if len(c) < trend_sma + 5:
            continue
        r = rsi_fn(c, rsi_period)
        trend = c.rolling(trend_sma).mean()
        entry = (r < entry_rsi) & (c > trend)
        exit_ = (r > exit_rsi) | (c < trend)
        state = pd.Series(np.nan, index=c.index)
        state[entry] = 1.0
        state[exit_] = 0.0
        in_pos.loc[c.index, sym] = state.ffill().fillna(0.0)

    weights = (in_pos * (1.0 / max(max_names, 1))).clip(upper=1.0)
    # cap total gross exposure at 100% if more names fire than slots
    gross = weights.sum(axis=1)
    scale = (1.0 / gross).clip(upper=1.0).replace([np.inf, -np.inf], 1.0)
    weights = weights.mul(scale, axis=0)
    weights = weights.shift(1).fillna(0.0)      # trade next day, no lookahead

    port = (weights * rets).sum(axis=1)
    costs = weights.diff().abs().sum(axis=1).fillna(0.0) * (cost_bps / 10_000)
    return (port - costs).iloc[trend_sma + 1:]


# --------------------------------------------------------------------------- ma cross trend

def ma_cross_backtest(
    bars: dict[str, pd.DataFrame],
    fast: int = 20,
    slow: int = 100,
    cost_bps: float = 5.0,
) -> pd.Series:
    """Equal weight across names whose fast SMA > slow SMA. Next-day execution."""
    closes = close_frame(bars)
    rets = closes.pct_change()
    fast_ma = closes.rolling(fast).mean()
    slow_ma = closes.rolling(slow).mean()
    in_pos = (fast_ma > slow_ma).astype(float)

    active = in_pos.sum(axis=1)
    weights = in_pos.div(active.where(active > 0, 1.0), axis=0)
    weights = weights.shift(1).fillna(0.0)

    port = (weights * rets).sum(axis=1)
    costs = weights.diff().abs().sum(axis=1).fillna(0.0) * (cost_bps / 10_000)
    return (port - costs).iloc[slow + 1:]


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

def _run_family_backtest(family: str, bars: dict, params: dict, cost_bps: float) -> pd.Series:
    if family == "dsl_rotation":
        from northstar.dsl import dsl_rotation_backtest

        return dsl_rotation_backtest(bars, params["spec"], cost_bps=cost_bps)
    if family == "rsi_mean_reversion":
        return rsi_reversion_backtest(
            bars,
            rsi_period=int(params.get("rsi_period", 2)),
            entry_rsi=float(params.get("entry_rsi", 10)),
            exit_rsi=float(params.get("exit_rsi", 70)),
            trend_sma=int(params.get("trend_sma", 200)),
            max_names=int(params.get("max_names", 3)),
            cost_bps=cost_bps,
        )
    if family == "ma_cross_trend":
        return ma_cross_backtest(
            bars,
            fast=int(params.get("fast", 20)),
            slow=int(params.get("slow", 100)),
            cost_bps=cost_bps,
        )
    return momentum_backtest(
        bars,
        lookback_days=int(params.get("lookback_days", 90)),
        top_n=int(params.get("top_n", 3)),
        rebalance_days=int(params.get("rebalance_days", 5)),
        cost_bps=cost_bps,
    )


def _warmup_days(family: str, params: dict) -> int:
    """Bars the OOS window needs BEFORE its first tradable day (indicator burn-in)."""
    if family == "dsl_rotation":
        from northstar.dsl import WARMUP_DAYS

        return WARMUP_DAYS
    if family == "rsi_mean_reversion":
        return int(params.get("trend_sma", 200))
    if family == "ma_cross_trend":
        return int(params.get("slow", 100))
    return int(params.get("lookback_days", 90))


def walk_forward_eval(
    bars: dict[str, pd.DataFrame],
    params: dict,
    family: str = "momentum_rotation",
    oos_frac: float = 0.3,
    cost_bps: float = 5.0,
) -> dict:
    """IS/OOS split evaluation for one strategy param set. OOS is the headline."""
    closes = close_frame(bars)
    split = int(len(closes) * (1 - oos_frac))
    warmup = _warmup_days(family, params) + 5
    is_bars = {s: df[df.index.isin(closes.index[:split])] for s, df in bars.items()}
    oos_bars = {s: df[df.index.isin(closes.index[max(split - warmup, 0):])] for s, df in bars.items()}

    r_is = _run_family_backtest(family, is_bars, params, cost_bps)
    r_oos = _run_family_backtest(family, oos_bars, params, cost_bps)
    m_is, m_oos = metrics(r_is), metrics(r_oos)
    return {
        "is": m_is,
        "oos": m_oos,
        "oos_returns": r_oos,
        "is_returns": r_is,
        "data_note": (
            f"Alpaca IEX daily bars, {closes.index[0].date()} to {closes.index[-1].date()}; "
            f"{family} rules; costs {cost_bps}bps on turnover; "
            f"OOS = last {oos_frac:.0%} (never used for tuning)."
        ),
    }


# --------------------------------------------------------------------------- slippage sensitivity

# Effective cost per unit turnover, in bps of traded notional: a fees/adverse-
# selection floor plus the share of a ~16bps quoted spread the order crosses.
# "quarter_spread" (5bps) is the base case used everywhere else in the system.
FILL_TIERS: dict[str, float] = {
    "mid": 1.0,             # marketable limit fills at mid - optimistic
    "quarter_spread": 5.0,  # crosses 25% of the spread - base case
    "half_spread": 9.0,     # crosses half the spread (market orders) - pessimistic
}


def slippage_sensitivity(
    bars: dict[str, pd.DataFrame],
    params: dict,
    family: str = "momentum_rotation",
    oos_frac: float = 0.3,
) -> dict:
    """Same walk-forward, three fill assumptions.

    The point is fragility detection: an edge that only exists when every fill
    lands at mid is a liquidity subsidy, not a strategy. `fragile` flips True
    when the base-case OOS Sharpe is positive but the pessimistic tier's is not.
    """
    rows = []
    for tier, bps in FILL_TIERS.items():
        ev = walk_forward_eval(bars, params, family=family, oos_frac=oos_frac, cost_bps=bps)
        rows.append({
            "assumption": tier,
            "cost_bps": bps,
            "oos": {k: ev["oos"].get(k) for k in ("ann_return", "sharpe", "max_dd", "n_days")},
            "is": {k: ev["is"].get(k) for k in ("ann_return", "sharpe")},
        })
    base = next(r for r in rows if r["assumption"] == "quarter_spread")
    worst = next(r for r in rows if r["assumption"] == "half_spread")
    fragile = None
    if base["oos"]["sharpe"] is not None and worst["oos"]["sharpe"] is not None:
        fragile = bool(base["oos"]["sharpe"] > 0 and worst["oos"]["sharpe"] <= 0)
    return {
        "family": family,
        "rows": rows,
        "fragile": fragile,
        "note": (
            "Identical walk-forward run under three fill assumptions "
            "(cost bps applied to turnover). OOS is the number that matters."
        ),
    }


# --------------------------------------------------------------------------- Monte Carlo for goals

def _stationary_bootstrap_idx(
    n_obs: int, n_paths: int, months: int, mean_block: int, rng: np.random.Generator
) -> np.ndarray:
    """Politis-Romano stationary bootstrap index matrix (n_paths x months).

    Each step either continues the current historical run (wrapping) or jumps
    to a fresh random start with probability 1/mean_block. mean_block=1 makes
    every step a fresh start - exactly the plain iid bootstrap."""
    idx = np.empty((n_paths, months), dtype=np.int64)
    idx[:, 0] = rng.integers(0, n_obs, size=n_paths)
    p = 1.0 / max(mean_block, 1)
    for t in range(1, months):
        fresh = rng.random(n_paths) < p
        idx[:, t] = np.where(fresh, rng.integers(0, n_obs, size=n_paths), (idx[:, t - 1] + 1) % n_obs)
    return idx


def monte_carlo_goal(
    monthly_returns: pd.Series | list[float],
    months: int,
    capital: float,
    target_amount: float,
    n_paths: int = 4000,
    seed: int = 7,
    mean_block: int = 3,
) -> dict:
    """Bootstrap monthly returns -> P(final >= target) + percentile bands.

    Stationary block bootstrap (mean block 3 months) instead of iid draws:
    return runs and regime persistence survive the resample, so the bands do
    not understate streak risk the way independent draws do."""
    r = np.asarray(pd.Series(monthly_returns).dropna(), dtype=float)
    if len(r) < 12 or months <= 0:
        return {"probability": None, "note": "insufficient history"}
    rng = np.random.default_rng(seed)
    draws = r[_stationary_bootstrap_idx(len(r), n_paths, months, mean_block, rng)]
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
        "method": f"stationary bootstrap, mean block {mean_block}mo, {n_paths} paths",
    }
