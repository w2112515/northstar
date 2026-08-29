from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol

import pandas as pd

from northstar.domain import Goal, Plan, StrategyInstance, TradeProposal


@dataclass
class EngineContext:
    account: dict[str, Any]
    positions: list[dict[str, Any]]
    open_orders: list[dict[str, Any]]
    bars: dict[str, pd.DataFrame] = field(default_factory=dict)
    plan: Plan | None = None
    goal: Goal | None = None

    def equity(self) -> float:
        return float(self.account.get("equity", 0.0))

    def stock_qty(self, symbol: str) -> float:
        for p in self.positions:
            if p["symbol"] == symbol and p["asset_class"] == "us_equity":
                return float(p["qty"])
        return 0.0

    def option_positions(self, underlying: str) -> list[dict[str, Any]]:
        return [
            p for p in self.positions
            if p["asset_class"] == "us_option" and p["symbol"].startswith(underlying)
        ]

    def has_open_order_for(self, symbol_prefix: str) -> bool:
        return any(o["symbol"].startswith(symbol_prefix) for o in self.open_orders)

    def allocation_equity(self, weight: float) -> float:
        return self.equity() * weight


class StrategyProgram(Protocol):
    def propose(self, instance: StrategyInstance, weight: float, ctx: EngineContext) -> list[TradeProposal]: ...
