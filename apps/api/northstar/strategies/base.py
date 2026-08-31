from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol

import pandas as pd

from northstar.domain import Goal, Plan, StrategyInstance, TradeProposal


def _is_occ_option_of(symbol: str, underlying: str) -> bool:
    """OCC symbols are exactly root + YYMMDD + C/P + 8-digit strike (root+15)."""
    return symbol.startswith(underlying) and len(symbol) == len(underlying) + 15


@dataclass
class EngineContext:
    account: dict[str, Any]
    positions: list[dict[str, Any]]
    open_orders: list[dict[str, Any]]
    bars: dict[str, pd.DataFrame] = field(default_factory=dict)
    plan: Plan | None = None
    goal: Goal | None = None
    # scout radar: today's top candidates + union of recent reports (so names
    # bought via scout stay sellable after they drop off the current Top-K)
    scout_symbols: list[str] = field(default_factory=list)
    scout_recent_pool: list[str] = field(default_factory=list)
    # manual pool: names the user pinned + pin history (held names stay tradable)
    manual_symbols: list[str] = field(default_factory=list)
    manual_history: list[str] = field(default_factory=list)
    # options watch: best premium-yield underlyings from the radar's option lens
    options_watch: list[str] = field(default_factory=list)

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
            if p["asset_class"] == "us_option" and _is_occ_option_of(p["symbol"], underlying)
        ]

    def has_open_order_for(self, symbol: str) -> bool:
        """An open order for exactly this symbol (dedup: don't resubmit).

        Exact match on purpose: an option order must not block its underlying's
        stock trades (a working PURR put once froze PURR equity buys for a day),
        and GOOG must not shadow GOOGL.
        """
        return any(o["symbol"] == symbol for o in self.open_orders)

    def has_open_option_order_for(self, underlying: str) -> bool:
        """Any open OCC option order on this underlying (one structure per name)."""
        return any(_is_occ_option_of(o["symbol"], underlying) for o in self.open_orders)

    def allocation_equity(self, weight: float) -> float:
        return self.equity() * weight


class StrategyProgram(Protocol):
    def propose(self, instance: StrategyInstance, weight: float, ctx: EngineContext) -> list[TradeProposal]: ...


def effective_universe(params: dict[str, Any], ctx: EngineContext) -> list[str]:
    """A program's tradable universe for this pass.

    Static params universe, plus (unless the instance opts out with
    use_scout=false) today's scout candidates and the user's pinned names,
    plus any currently-held name from the recent scout pool or pin history -
    a position entered via the radar or a pin must remain in the universe
    until it is exited, or rotation could never sell it.
    """
    universe = list(dict.fromkeys(params.get("universe", [])))
    if not params.get("use_scout", True):
        return universe
    merged = dict.fromkeys(universe)
    for sym in ctx.scout_symbols:
        merged.setdefault(sym)
    for sym in ctx.manual_symbols:
        merged.setdefault(sym)
    held = {
        p["symbol"] for p in ctx.positions
        if p["asset_class"] == "us_equity" and float(p["qty"]) > 0
    }
    for sym in (*ctx.scout_recent_pool, *ctx.manual_history):
        if sym in held:
            merged.setdefault(sym)
    return list(merged)


def effective_underlyings(params: dict[str, Any], ctx: EngineContext) -> list[str]:
    """Options crews' underlyings: static list + the options-watch board
    (opt-out via use_scout=false). Names already carrying one of our option
    structures stay in regardless - the state machine must keep managing them.
    """
    base = list(dict.fromkeys(params.get("underlyings", [])))
    if not params.get("use_scout", True):
        return base
    merged = dict.fromkeys(base)
    for sym in ctx.options_watch:
        merged.setdefault(sym)
    return list(merged)
