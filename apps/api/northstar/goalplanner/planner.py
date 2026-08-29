"""Goal -> Plan translation. The product's core honesty engine.

Input: "I want to reach $X in N months" (or "$Y/month income") + risk level.
Output: allocations + derived guardrails + an achievement probability computed
from REAL backtest distributions (momentum) and a labeled approximation
(wheel), via bootstrap Monte Carlo. Unrealistic goals get a red verdict and
honest alternatives - never a nerfed promise.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd

from northstar.backtest import momentum_backtest, monte_carlo_goal, wheel_income_approx
from northstar.broker import daily_bars
from northstar.domain import Feasibility, Goal, Guardrails, Plan, PlanAllocation

RISK_POLICIES: dict[str, dict[str, Any]] = {
    "conservative": {
        "weights": {"wheel": 0.60, "momentum_rotation": 0.15, "cash": 0.25},
        "guardrails": Guardrails(
            max_loss_per_trade_pct=0.005, breaker_soft_dd=-0.05, breaker_hard_dd=-0.08,
            single_name_concentration=0.15, csp_collateral_cap=0.20,
        ),
    },
    "balanced": {
        "weights": {"wheel": 0.50, "momentum_rotation": 0.30, "cash": 0.20},
        "guardrails": Guardrails(
            max_loss_per_trade_pct=0.01, breaker_soft_dd=-0.08, breaker_hard_dd=-0.12,
            single_name_concentration=0.20, csp_collateral_cap=0.25,
        ),
    },
    "aggressive": {
        "weights": {"wheel": 0.40, "momentum_rotation": 0.50, "cash": 0.10},
        "guardrails": Guardrails(
            max_loss_per_trade_pct=0.02, breaker_soft_dd=-0.10, breaker_hard_dd=-0.15,
            single_name_concentration=0.25, csp_collateral_cap=0.30,
        ),
    },
}

MOMENTUM_UNIVERSE = ["SPY", "QQQ", "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "AMD", "TSLA"]
WHEEL_PROXY = "INTC"          # runnable wheel underlying within default budgets
BASELINE = "SPY"

_cache: dict[str, Any] = {}


def _distributions() -> dict[str, pd.Series]:
    """Monthly return series per strategy family (cached per day)."""
    key = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if _cache.get("key") == key:
        return _cache["dists"]

    bars = daily_bars(sorted(set(MOMENTUM_UNIVERSE + [WHEEL_PROXY])), years=4.0)
    mom_daily = momentum_backtest({s: bars[s] for s in MOMENTUM_UNIVERSE if s in bars})
    mom_monthly = (1 + mom_daily).cumprod().resample("ME").last().pct_change().dropna()
    wheel_monthly = wheel_income_approx(bars[WHEEL_PROXY]) if WHEEL_PROXY in bars else pd.Series(dtype=float)
    spy_monthly = (
        bars[BASELINE]["close"].resample("ME").last().pct_change().dropna()
        if BASELINE in bars else pd.Series(dtype=float)
    )
    dists = {"momentum_rotation": mom_monthly, "wheel": wheel_monthly, "spy": spy_monthly}
    _cache.update({"key": key, "dists": dists})
    return dists


def _portfolio_monthly(weights: dict[str, float]) -> pd.Series:
    d = _distributions()
    frames = {}
    if weights.get("wheel"):
        frames["wheel"] = d["wheel"]
    if weights.get("momentum_rotation"):
        frames["momentum_rotation"] = d["momentum_rotation"]
    if not frames:
        return pd.Series(dtype=float)
    df = pd.DataFrame(frames).dropna()
    port = sum(df[k] * w for k, w in weights.items() if k in df.columns)
    return port.dropna()  # cash contributes 0


def _horizon_months(goal: Goal) -> int:
    return int(goal.horizon_months or 12)


def _target_amount(goal: Goal) -> float:
    if goal.mode == "target_amount":
        return float(goal.target_amount or goal.capital_base)
    months = _horizon_months(goal)
    return float(goal.capital_base + (goal.monthly_target or 0.0) * months)


def plan_goal(goal: Goal) -> tuple[Plan, dict[str, Any]]:
    """Returns (Plan, extras) - extras carry MC bands etc. for the UI."""
    policy = RISK_POLICIES[goal.risk_level]
    weights: dict[str, float] = policy["weights"]
    months = _horizon_months(goal)
    target = _target_amount(goal)
    capital = goal.capital_base

    required_annual = (target / capital) ** (12 / months) - 1 if capital > 0 and months > 0 else 0.0

    port = _portfolio_monthly(weights)
    mc = monte_carlo_goal(port, months=months, capital=capital, target_amount=target)
    prob = mc.get("probability")

    if prob is None:
        feasibility: Feasibility = "yellow"
        prob = 0.0
    elif required_annual > 0.40 or prob < 0.35:
        feasibility = "red"
    elif prob < 0.60:
        feasibility = "yellow"
    else:
        feasibility = "green"

    # honest alternatives for red/yellow goals
    alternatives: list[str] = []
    if feasibility != "green" and mc.get("probability") is not None:
        # target achievable at ~60% confidence = 40th percentile of simulated finals
        achievable = mc.get("p40_final")
        if achievable and achievable > capital:
            alternatives.append(
                f"Keep everything else, aim for ${achievable:,.0f} instead - that has about a 60% shot."
            )
        longer = _achievable_horizon(port, capital, target, months)
        if longer:
            alternatives.append(
                f"Keep the ${target:,.0f} target but give it {longer} months - probability rises above 55%."
            )
        alternatives.append("Add capital or lower the monthly income ask - smaller required return, higher odds.")

    # baseline: same capital, SPY buy-and-hold, same horizon
    d = _distributions()
    spy = d["spy"]
    baseline_note = ""
    if len(spy) >= 12:
        spy_mc = monte_carlo_goal(spy, months=months, capital=capital, target_amount=target)
        baseline_note = (
            f"For reference: just buying SPY and waiting has ~{spy_mc['probability']:.0%} odds of the same goal "
            f"(median outcome ${spy_mc['median_final']:,.0f}). If we can't beat boring, we'll say so."
        )

    plan = Plan(
        goal_id=goal.id,
        required_annual_return=round(required_annual, 4),
        feasibility=feasibility,
        probability=round(float(prob), 3),
        max_drawdown_est=round(float(mc.get("median_max_dd") or 0.0), 3),
        allocations=[
            PlanAllocation(strategy_id=k, weight=w, why=_why(k))
            for k, w in weights.items()
        ],
        guardrails=policy["guardrails"],
        baseline_note=baseline_note,
        honest_alternatives=alternatives,
    )
    extras = {
        "mc": {k: v for k, v in mc.items() if k not in ("band_p10", "band_p50", "band_p90")},
        "bands": {"p10": mc.get("band_p10"), "p50": mc.get("band_p50"), "p90": mc.get("band_p90")},
        "months": months,
        "target_amount": target,
        "data_note": (
            "Probabilities come from bootstrapped monthly returns: momentum = real 4y backtest "
            "(Alpaca daily bars, 5bps costs); wheel = labeled approximation from realized volatility "
            "(full options history only exists since Feb 2024). Past patterns, not promises."
        ),
    }
    return plan, extras


def _why(family: str) -> str:
    return {
        "wheel": "steady premium income; buys dips at a discount",
        "momentum_rotation": "growth engine; owns whatever is working",
        "cash": "dry powder and shock absorber",
    }.get(family, "")


def _achievable_horizon(port: pd.Series, capital: float, target: float, months: int) -> int | None:
    for extra in (6, 12, 24):
        mc = monte_carlo_goal(port, months=months + extra, capital=capital, target_amount=target)
        if mc.get("probability") and mc["probability"] >= 0.55:
            return months + extra
    return None
