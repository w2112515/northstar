"""Live-fire fixes from the first aggressive session, part two.

1. Open-order matching: an option order must not block its underlying's stock
   trades, and GOOG must not shadow GOOGL - but option strategies still dedupe
   against their own working OCC orders.
2. Reprice ladder: a risk-reducing equity leg that timed out at mid gets ONE
   crossed-spread retry; opens and options keep the no-chasing discipline.
3. Backtest-only families (dsl_rotation) stay out of the live pipeline.
4. Trial evidence gates: no live trial for a family that cannot trade, and a
   trial with zero fills cannot promote on an "empty clean window".
"""

from datetime import datetime, timedelta, timezone

import northstar.evolution.loop as evo
from northstar.domain import (
    EvolutionExperiment,
    JournalEvent,
    OrderLeg,
    OrderPlan,
    StrategyInstance,
    TradeProposal,
)
from northstar.engine import collect_proposals, family_live
from northstar.executor import alpaca_exec
from northstar.strategies import wheel
from northstar.strategies.base import EngineContext
from tests.test_pnl import FakeStore


def ctx_with_orders(orders: list[str], **kw) -> EngineContext:
    return EngineContext(
        account=kw.get("account", {"equity": 100_000.0}),
        positions=kw.get("positions", []),
        open_orders=[{"symbol": s, "side": "sell", "qty": 1} for s in orders],
        bars=kw.get("bars", {}),
    )


# ------------------------------------------------------- 1. order matching

def test_option_order_does_not_block_the_stock():
    ctx = ctx_with_orders(["PURR260925P00010000"])
    assert not ctx.has_open_order_for("PURR")
    assert ctx.has_open_option_order_for("PURR")


def test_ticker_prefix_does_not_shadow_longer_ticker():
    ctx = ctx_with_orders(["GOOG"])
    assert ctx.has_open_order_for("GOOG")
    assert not ctx.has_open_order_for("GOOGL")
    assert not ctx.has_open_option_order_for("GOOGL")


def test_exact_equity_order_still_dedupes():
    ctx = ctx_with_orders(["MSFT"])
    assert ctx.has_open_order_for("MSFT")


def test_wheel_still_skips_a_name_with_its_own_working_put():
    import pandas as pd

    inst = StrategyInstance(family="wheel", strategy_type="wheel",
                            params={"underlyings": ["INTC"], "use_scout": False})
    bars = {"INTC": pd.DataFrame({"close": [80.0] * 30})}

    busy = ctx_with_orders(["INTC261002P00081000"], bars=bars)
    assert wheel.propose(inst, 0.4, busy) == []

    free = ctx_with_orders([], bars=bars)
    assert len(wheel.propose(inst, 0.4, free)) == 1


# ------------------------------------------------------- 2. reprice ladder

def closing_plan(side: str = "sell", asset_class: str = "us_equity") -> OrderPlan:
    return OrderPlan(
        proposal_id="tp_test", strategy_type="momentum_rotation",
        legs=[OrderLeg(symbol="MSFT", side=side, qty=19, asset_class=asset_class, limit_price=511.0)],
        est_max_loss=0.0, est_credit_or_debit=9709.0, human="sell 19 MSFT",
        meta={"closing": True, "entry_price": 500.0, "signed_qty": 19, "pnl_multiplier": 1},
    )


class SubmitRecorder:
    def __init__(self):
        self.submitted: list = []

    def __call__(self, leg, client_order_id: str):
        self.submitted.append((leg, client_order_id))

        class O:
            id = f"oid-{len(self.submitted)}"

        return O()


def run_plan(monkeypatch, plan: OrderPlan, track_states: list[str],
             quote: dict | Exception | None = None) -> tuple[dict, SubmitRecorder]:
    store = FakeStore()
    recorder = SubmitRecorder()
    states = iter(track_states)

    def fake_track(p, oid, label, market_open, wait_seconds, poll_every):
        return {"order_id": oid, "status": next(states)}

    def fake_quote(symbol):
        if isinstance(quote, Exception):
            raise quote
        return quote or {"bid": 510.4, "ask": 510.9}

    monkeypatch.setattr(alpaca_exec, "get_store", lambda: store)
    monkeypatch.setattr(alpaca_exec, "_submit_leg", recorder)
    monkeypatch.setattr(alpaca_exec, "_track_order", fake_track)
    monkeypatch.setattr(alpaca_exec, "latest_quote", fake_quote)
    result = alpaca_exec.execute_order_plan(plan, market_open=True, wait_seconds=90)
    return result, recorder


def test_closing_equity_timeout_reprices_once_at_bid(monkeypatch):
    result, rec = run_plan(monkeypatch, closing_plan(), ["canceled_timeout", "filled"])
    assert len(rec.submitted) == 2
    crossed_leg, cid = rec.submitted[1]
    assert crossed_leg.limit_price == 510.4  # sell crosses to the bid
    assert cid.endswith("-x")
    assert result["legs"][0]["status"] == "filled"


def test_buy_to_close_reprices_at_ask(monkeypatch):
    result, rec = run_plan(monkeypatch, closing_plan(side="buy"), ["canceled_timeout", "filled"])
    assert rec.submitted[1][0].limit_price == 510.9


def test_opening_order_never_chases(monkeypatch):
    plan = closing_plan()
    plan.meta = {}  # not a closing order
    result, rec = run_plan(monkeypatch, plan, ["canceled_timeout"])
    assert len(rec.submitted) == 1
    assert result["legs"][0]["status"] == "canceled_timeout"


def test_option_close_never_chases(monkeypatch):
    plan = closing_plan(side="buy", asset_class="us_option")
    result, rec = run_plan(monkeypatch, plan, ["canceled_timeout"])
    assert len(rec.submitted) == 1


def test_quote_failure_degrades_to_plain_timeout(monkeypatch):
    result, rec = run_plan(monkeypatch, closing_plan(), ["canceled_timeout"],
                           quote=RuntimeError("quote feed down"))
    assert len(rec.submitted) == 1
    assert result["legs"][0]["status"] == "canceled_timeout"


# ------------------------------------------------- 3. backtest-only families

def test_family_liveness_map():
    assert family_live("momentum_rotation")
    assert family_live("wheel")           # proposes csp / covered_call
    assert family_live("iron_condor")
    assert not family_live("dsl_rotation")


def test_dsl_instance_is_skipped_by_the_live_pipeline():
    store = FakeStore()
    inst = StrategyInstance(family="dsl_rotation", strategy_type="dsl_rotation",
                            params={"spec": {"rebalance_days": 5}})
    ctx = ctx_with_orders([])
    assert collect_proposals(store, ctx, [inst]) == []
    assert store.event_log == []  # no proposal noise either


# ------------------------------------------------------- 4. trial evidence

def trial_instance(store, started_days_ago: int = 4) -> StrategyInstance:
    parent = StrategyInstance(family="momentum_rotation", strategy_type="momentum_rotation",
                              version="v1", status="archived")
    store.save("instances", parent.id, parent.model_dump())
    start = (datetime.now(timezone.utc) - timedelta(days=started_days_ago)).isoformat()
    inst = StrategyInstance(
        family="momentum_rotation", strategy_type="momentum_rotation", version="v2",
        status="trial", paper_trial={"start": start, "days": 3, "parent_instance_id": parent.id},
    )
    store.save("instances", inst.id, inst.model_dump())
    return inst


def test_decide_evolution_refuses_backtest_only_family(monkeypatch):
    store = FakeStore()
    exp = EvolutionExperiment(family="dsl_rotation", parent_version="v1",
                              hypothesis="wider top-n", proposed_by="grid_fallback",
                              status="awaiting_approval")
    store.save("experiments", exp.id, exp.model_dump())
    monkeypatch.setattr(evo, "get_store", lambda: store)

    out = evo.decide_evolution(exp.id, approve=True)
    assert out["ok"] is False
    assert "backtest-only" in out["error"]
    # nothing was benched or created
    assert store.list("instances") == []


def test_trial_with_no_fills_is_archived_and_parent_restored():
    store = FakeStore()
    inst = trial_instance(store)

    settled = evo.finalize_trials(store)

    assert settled[0]["outcome"] == "archived"
    docs = {d["version"]: d for d in store.list("instances")}
    assert docs["v2"]["status"] == "archived"
    assert docs["v1"]["status"] == "champion"
    event = [e for e in store.event_log if e.kind == "experiment"][0]
    assert "no evidence" in event.human


def test_trial_with_fills_and_clean_window_promotes():
    store = FakeStore()
    inst = trial_instance(store)
    proposal = TradeProposal(source=f"strategy:{inst.id}", underlying="AAPL",
                             direction="bullish", strategy_type="momentum_rotation")
    store.append_event(JournalEvent(kind="proposal", human="buy AAPL",
                                    payload=proposal.model_dump(),
                                    refs={"proposal_id": proposal.id}))
    store.append_event(JournalEvent(kind="fill", human="filled",
                                    payload={"status": "filled"},
                                    refs={"proposal_id": proposal.id, "order_plan_id": "op_1"}))

    settled = evo.finalize_trials(store)

    assert settled[0]["outcome"] == "promoted"
    docs = {d["version"]: d for d in store.list("instances")}
    assert docs["v2"]["status"] == "champion"
