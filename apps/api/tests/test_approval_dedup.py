"""needs_human dedup: a persistent condition must not mint a duplicate
approval card every pass - one live card per (underlying, structure)."""

from northstar.domain import Guardrails, OrderLeg, OrderPlan, TradeProposal
from northstar.engine import gate_and_execute
from northstar.gate import GateSnapshot
from tests.test_pnl import FakeStore

G = Guardrails(max_loss_per_trade_pct=0.01)


def soft_breaker_snap() -> GateSnapshot:
    # -9% from peak, only -0.5% today -> soft breaker -> needs_human on opens
    return GateSnapshot(
        equity=91_000.0, last_equity=91_450.0, peak_equity=100_000.0,
        market_open=True, kill_switch=False, consecutive_losses=0,
        open_positions_count=2, exposure_by_underlying={}, open_order_symbols=[],
        stock_qty_by_symbol={}, orders_today=0, frozen_symbols=[], options_level=3,
    )


def csp(underlying: str = "AMD") -> tuple[TradeProposal, OrderPlan]:
    proposal = TradeProposal(
        source="strategy:test", underlying=underlying, direction="neutral_bullish",
        strategy_type="cash_secured_put",
    )
    order = OrderPlan(
        proposal_id=proposal.id, strategy_type="cash_secured_put",
        legs=[OrderLeg(symbol=f"{underlying}260918P00170000", side="sell", qty=1,
                       asset_class="us_option", limit_price=2.55)],
        est_max_loss=17_000.0 - 255, est_credit_or_debit=255.0,
        meta={"collateral": 17_000.0, "spread_pct": 0.10, "bid": 2.5},
    )
    return proposal, order


def run_pass(store, underlying: str = "AMD") -> dict:
    summary: dict = {"executed": [], "exits": [], "needs_human": [], "rejected": []}
    proposal, order = csp(underlying)
    gate_and_execute(store, None, proposal, order, soft_breaker_snap(), G,
                     market_open=True, dry_run=False, execute_wait=0, summary=summary)
    return summary


def pending(store) -> list[dict]:
    return [a for a in store.list("approvals") if a["status"] == "pending"]


def test_second_pass_reuses_the_live_card():
    s = FakeStore()
    first = run_pass(s)
    second = run_pass(s)
    assert len(pending(s)) == 1
    # both pass summaries surface the same card id
    assert second["needs_human"] == first["needs_human"]
    # only the first pass journals the card - no duplicate noise
    assert sum(1 for e in s.event_log if e.kind == "approval") == 1


def test_other_underlying_still_gets_its_own_card():
    s = FakeStore()
    run_pass(s, "AMD")
    run_pass(s, "NVDA")
    assert len(pending(s)) == 2


def test_decided_card_does_not_suppress_a_new_ask():
    s = FakeStore()
    run_pass(s)
    card = pending(s)[0]
    card["status"] = "rejected_by_human"
    s.save("approvals", card["id"], card)
    run_pass(s)
    assert len(pending(s)) == 1
    assert pending(s)[0]["id"] != card["id"]
