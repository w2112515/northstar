"""Rebalance clock + stale-order sweep semantics.

The 5-day rebalance clock exists to damp rank-flap churn. It must start only
when a BUY fills: sell-only rotations, canceled submissions and queued orders
have to keep retrying next pass, or the sleeve strands in cash for
rebalance_days (observed live: a sell-only rotation cash-locked the momentum
sleeve past the whole competition window).
"""

from datetime import datetime, timedelta, timezone

import northstar.engine as engine
from northstar.domain import GateVerdict, Guardrails, OrderLeg, OrderPlan, StrategyInstance, TradeProposal
from northstar.executor import alpaca_exec
from northstar.gate import GateSnapshot
from tests.test_pnl import FakeStore

G = Guardrails(max_loss_per_trade_pct=0.01)


def snap() -> GateSnapshot:
    return GateSnapshot(
        equity=100_000.0, last_equity=100_000.0, peak_equity=100_000.0,
        market_open=True, kill_switch=False, consecutive_losses=0,
        open_positions_count=0, exposure_by_underlying={}, open_order_symbols=[],
        stock_qty_by_symbol={}, orders_today=0, frozen_symbols=[], options_level=3,
    )


def momentum_instance() -> StrategyInstance:
    return StrategyInstance(
        family="momentum_rotation", strategy_type="momentum_rotation",
        version="v1", params={"universe": ["AAPL"]}, status="champion",
    )


def equity_order(side: str) -> tuple[TradeProposal, OrderPlan]:
    proposal = TradeProposal(
        source="strategy:test", underlying="AAPL", direction="bullish",
        strategy_type="momentum_rotation", params={"action": side, "qty": 10},
    )
    order = OrderPlan(
        proposal_id=proposal.id, strategy_type="momentum_rotation",
        legs=[OrderLeg(symbol="AAPL", side=side, qty=10, asset_class="us_equity", limit_price=200.0)],
        est_max_loss=2000.0, est_credit_or_debit=-2000.0, human=f"{side} 10 AAPL",
    )
    return proposal, order


def run_exec(monkeypatch, store, side: str, leg_status: str) -> None:
    proposal, order = equity_order(side)
    monkeypatch.setattr(engine, "run_gate", lambda *a, **k: GateVerdict(
        proposal_id=proposal.id, order_plan_id=order.id, verdict="approved", checks=[],
    ))
    monkeypatch.setattr(engine, "execute_order_plan", lambda *a, **k: {
        "order_plan_id": order.id,
        "legs": [{"status": leg_status, "leg": order.legs[0].model_dump()}],
    })
    summary: dict = {"executed": [], "exits": [], "needs_human": [], "rejected": []}
    engine.gate_and_execute(store, momentum_instance(), proposal, order, snap(), G,
                            market_open=True, dry_run=False, execute_wait=0, summary=summary)


def stamped(store) -> bool:
    return any(coll == "instance_state" for (coll, _) in store.docs)


def test_filled_buy_starts_the_clock(monkeypatch):
    s = FakeStore()
    run_exec(monkeypatch, s, "buy", "filled")
    assert stamped(s)


def test_canceled_buy_does_not_start_the_clock(monkeypatch):
    s = FakeStore()
    run_exec(monkeypatch, s, "buy", "canceled_timeout")
    assert not stamped(s)


def test_filled_sell_does_not_start_the_clock(monkeypatch):
    """Sell-only rotations must retry / finish buying next pass."""
    s = FakeStore()
    run_exec(monkeypatch, s, "sell", "filled")
    assert not stamped(s)


def test_queued_buy_does_not_start_the_clock(monkeypatch):
    s = FakeStore()
    run_exec(monkeypatch, s, "buy", "queued_until_open")
    assert not stamped(s)


# --------------------------------------------------------------------- sweep

def order_row(order_id: str, age_hours: float) -> dict:
    created = datetime.now(timezone.utc) - timedelta(hours=age_hours)
    return {
        "id": order_id, "symbol": "AMD", "side": "buy", "qty": 21.0,
        "limit_price": 465.61, "status": "new", "created_at": created.isoformat(),
    }


def test_sweep_cancels_only_prior_session_orders(monkeypatch):
    s = FakeStore()
    canceled: list[str] = []
    monkeypatch.setattr(alpaca_exec, "get_store", lambda: s)
    monkeypatch.setattr(alpaca_exec, "get_open_orders",
                        lambda: [order_row("old", 40.0), order_row("fresh", 3.0)])
    monkeypatch.setattr(alpaca_exec, "cancel_order", canceled.append)

    swept = alpaca_exec.sweep_stale_orders()

    assert swept == ["old"]
    assert canceled == ["old"]
    events = [e for e in s.event_log if e.kind == "order"]
    assert len(events) == 1 and "Swept stale order" in events[0].human


def test_sweep_tolerates_cancel_race(monkeypatch):
    """An order that fills or expires mid-sweep must not journal a cancel."""
    s = FakeStore()

    def explode(order_id: str) -> None:
        raise RuntimeError("order already in terminal state")

    monkeypatch.setattr(alpaca_exec, "get_store", lambda: s)
    monkeypatch.setattr(alpaca_exec, "get_open_orders", lambda: [order_row("gone", 40.0)])
    monkeypatch.setattr(alpaca_exec, "cancel_order", explode)

    assert alpaca_exec.sweep_stale_orders() == []
    assert not s.event_log


def test_aggressive_tier_order_cap_fits_its_sleeve_clips():
    """50% momentum sleeve rebalances in ~16.7% clips (top-3): the per-order
    fat-finger cap must clear them or the sleeve can never deploy."""
    from northstar.goalplanner.planner import RISK_POLICIES

    pol = RISK_POLICIES["aggressive"]
    clip = pol["weights"]["momentum_rotation"] / 3
    assert pol["guardrails"].max_order_notional_pct >= clip
