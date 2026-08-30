"""Core domain objects. Single owner of shapes consumed across the system.

Contracts follow docs/TECH.md section 3. Journal is append-only; rejections are
first-class records.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


# --------------------------------------------------------------------------- journal

EventKind = Literal[
    "system", "event", "signal", "proposal", "verdict",
    "order", "fill", "pnl", "experiment", "digest", "approval",
    "debate", "trace", "forecast", "scout",
]


class JournalEvent(BaseModel):
    id: str = Field(default_factory=lambda: new_id("ev"))
    ts: str = Field(default_factory=utcnow)
    kind: EventKind
    human: str = ""                      # one-line plain-speak, always present in UI
    payload: dict[str, Any] = Field(default_factory=dict)
    refs: dict[str, str] = Field(default_factory=dict)  # e.g. {"proposal_id": "..."}


# --------------------------------------------------------------------------- goal / plan

RiskLevel = Literal["conservative", "balanced", "aggressive"]
Feasibility = Literal["green", "yellow", "red"]


class Goal(BaseModel):
    id: str = Field(default_factory=lambda: new_id("goal"))
    created_at: str = Field(default_factory=utcnow)
    mode: Literal["target_amount", "monthly_income"]
    capital_base: float
    target_amount: float | None = None    # mode=target_amount: portfolio value to reach
    horizon_months: int | None = None
    monthly_target: float | None = None   # mode=monthly_income: $/month
    risk_level: RiskLevel = "balanced"


class Guardrails(BaseModel):
    max_loss_per_trade_pct: float          # of equity, defined loss cap per trade
    single_name_concentration: float = 0.20
    csp_collateral_cap: float = 0.25       # CSP collateral <= this share of equity
    daily_loss_stop: float = -0.05         # no new trades below this daily P&L
    breaker_soft_dd: float = -0.08         # portfolio drawdown warning
    breaker_hard_dd: float = -0.12         # full stop, manual reset
    max_open_positions: int = 12
    cooldown_after_losses: int = 3         # consecutive losses -> 24h cooldown
    approval_timeout_hours: int = 12       # HITL timeout => reject
    max_orders_per_day: int = 12           # rate limit: new orders per UTC day
    max_order_notional_pct: float = 0.10   # single equity order <= this share of equity
    weather_floor: int = 20                # market weather below this -> new risk needs approval
    exit_profit_take_pct: float = 0.50     # close short premium once this share of credit is captured
    exit_dte: int = 7                      # close option structures at/below this DTE (gamma/assignment)


class PlanAllocation(BaseModel):
    strategy_id: str
    weight: float
    why: str = ""


class Plan(BaseModel):
    id: str = Field(default_factory=lambda: new_id("plan"))
    goal_id: str
    created_at: str = Field(default_factory=utcnow)
    required_annual_return: float
    feasibility: Feasibility
    probability: float                     # historical/MC estimate, NOT a promise
    max_drawdown_est: float
    allocations: list[PlanAllocation]
    guardrails: Guardrails
    baseline_note: str = ""                # honest comparison vs SPY DCA
    honest_alternatives: list[str] = Field(default_factory=list)  # filled when red
    status: Literal["proposed", "active", "halted"] = "proposed"


# --------------------------------------------------------------------------- trading

StrategyType = Literal[
    "cash_secured_put", "covered_call", "wheel",
    "bull_put_spread", "bear_call_spread", "bull_call_spread",
    "iron_condor", "protective_put",
    "momentum_rotation", "ma_cross_trend", "rsi_mean_reversion",
    "bollinger_reversion", "sector_rotation", "defensive_6040",
    "dsl_rotation",
    "ai_analyst", "manual_close",
]

OPTION_STRATEGY_WHITELIST: set[str] = {
    "cash_secured_put", "covered_call", "wheel",
    "bull_put_spread", "bear_call_spread", "bull_call_spread",
    "iron_condor", "protective_put",
}


class TradeProposal(BaseModel):
    id: str = Field(default_factory=lambda: new_id("tp"))
    created_at: str = Field(default_factory=utcnow)
    source: str                            # "strategy:<instance_id>" | "ai_analyst" | "human"
    underlying: str
    direction: Literal["bullish", "bearish", "neutral", "neutral_bullish", "neutral_bearish"]
    strategy_type: StrategyType
    conviction: float = 0.5
    horizon_days: int = 30
    thesis_human: str = ""
    invalidation: str = ""
    params: dict[str, Any] = Field(default_factory=dict)
    expires_at: str | None = None


class OrderLeg(BaseModel):
    symbol: str                            # equity symbol or OCC option symbol
    side: Literal["buy", "sell"]
    qty: float
    asset_class: Literal["us_equity", "us_option", "crypto"]
    limit_price: float | None = None


class OrderPlan(BaseModel):
    id: str = Field(default_factory=lambda: new_id("op"))
    proposal_id: str
    created_at: str = Field(default_factory=utcnow)
    strategy_type: StrategyType
    legs: list[OrderLeg]
    est_max_loss: float                    # defined loss in $; required by gate
    est_credit_or_debit: float = 0.0       # +credit received / -debit paid (per unit)
    time_in_force: str = "day"
    human: str = ""
    meta: dict[str, Any] = Field(default_factory=dict)  # liquidity/greeks facts for the gate


class GateCheck(BaseModel):
    rule: str
    limit: float | str
    actual: float | str
    passed: bool


class GateVerdict(BaseModel):
    id: str = Field(default_factory=lambda: new_id("gv"))
    proposal_id: str
    order_plan_id: str | None = None
    created_at: str = Field(default_factory=utcnow)
    verdict: Literal["approved", "rejected", "needs_human"]
    checks: list[GateCheck]
    reason_codes: list[str] = Field(default_factory=list)
    decided_by: str = "code"               # code | human:approved | human:timeout_reject


# --------------------------------------------------------------------------- strategy instances / evolution

class Lineage(BaseModel):
    parent_version: str | None = None
    hypothesis: str = ""
    experiment_id: str | None = None


class StrategyInstance(BaseModel):
    id: str = Field(default_factory=lambda: new_id("si"))
    family: str                            # e.g. "momentum_rotation", "wheel"
    version: str = "v1"
    strategy_type: StrategyType
    params: dict[str, Any] = Field(default_factory=dict)
    status: Literal["candidate", "trial", "champion", "archived"] = "champion"
    enabled: bool = True
    lineage: Lineage = Field(default_factory=Lineage)
    paper_trial: dict[str, Any] | None = None  # {"start", "days", "parent_instance_id"} while on trial
    created_at: str = Field(default_factory=utcnow)


class BacktestReport(BaseModel):
    is_sharpe: float | None = None         # in-sample
    oos_sharpe: float | None = None        # out-of-sample (walk-forward)
    ann_return: float | None = None
    max_dd: float | None = None
    win_rate: float | None = None
    n_trades: int | None = None
    trials_in_family: int = 1
    cost_model: str = "slippage_5bps"
    data_note: str = ""                    # honest data-boundary note
    goal_fit: float | None = None          # P(hit user's goal) - risk-tier DD penalty
    goal_fit_note: str = ""                # which goal/tier this was scored against


class EvolutionExperiment(BaseModel):
    id: str = Field(default_factory=lambda: new_id("exp"))
    created_at: str = Field(default_factory=utcnow)
    family: str
    parent_version: str
    hypothesis: str
    proposed_by: str                       # "gemini" | "grid_fallback"
    params_delta: dict[str, Any] = Field(default_factory=dict)
    candidate_params: dict[str, Any] = Field(default_factory=dict)
    backtest: BacktestReport | None = None
    paper_trial: dict[str, Any] | None = None
    status: Literal[
        "proposed", "backtested", "trial", "awaiting_approval", "promoted", "archived"
    ] = "proposed"
    verdict_reason: str = ""
