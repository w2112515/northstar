"""Gate rules are the safety boundary - every rule gets a direct test."""

from northstar.domain import Guardrails, OrderLeg, OrderPlan, TradeProposal
from northstar.gate import GateSnapshot, run_gate

G = Guardrails(max_loss_per_trade_pct=0.01)  # 1% of equity per defined-risk trade


def snap(**kw) -> GateSnapshot:
    base = dict(
        equity=100_000.0, last_equity=100_000.0, peak_equity=100_000.0,
        market_open=True, kill_switch=False, consecutive_losses=0,
        open_positions_count=2, exposure_by_underlying={}, open_order_symbols=[],
        stock_qty_by_symbol={},
    )
    base.update(kw)
    return GateSnapshot(**base)


def csp_proposal() -> TradeProposal:
    return TradeProposal(
        source="strategy:test", underlying="AMD", direction="neutral_bullish",
        strategy_type="cash_secured_put",
    )


def csp_order(collateral=17_000.0, spread_pct=0.10, bid=2.5) -> OrderPlan:
    return OrderPlan(
        proposal_id="tp_x", strategy_type="cash_secured_put",
        legs=[OrderLeg(symbol="AMD260918P00170000", side="sell", qty=1,
                       asset_class="us_option", limit_price=2.55)],
        est_max_loss=collateral - 255, est_credit_or_debit=255.0,
        meta={"collateral": collateral, "spread_pct": spread_pct, "bid": bid},
    )


def test_csp_within_caps_approved():
    v = run_gate(csp_order(), csp_proposal(), snap(), G)
    assert v.verdict == "approved"
    assert all(c.passed for c in v.checks)


def test_csp_collateral_exceeded_rejected():
    v = run_gate(csp_order(collateral=30_000.0), csp_proposal(), snap(), G)
    assert v.verdict == "rejected"
    assert "CSP_COLLATERAL_EXCEEDED" in v.reason_codes


def test_kill_switch_blocks_everything():
    v = run_gate(csp_order(), csp_proposal(), snap(kill_switch=True), G)
    assert v.verdict == "rejected"
    assert "KILL_SWITCH" in v.reason_codes


def test_hard_breaker_rejects():
    v = run_gate(csp_order(), csp_proposal(), snap(equity=87_000.0), G)  # -13% from peak
    assert v.verdict == "rejected"
    assert "BREAKER_HARD" in v.reason_codes


def test_soft_breaker_needs_human():
    # -9% from peak but only -0.5% today: soft breaker alone -> human decision
    v = run_gate(csp_order(), csp_proposal(), snap(equity=91_000.0, last_equity=91_450.0), G)
    assert v.verdict == "needs_human"
    assert "BREAKER_SOFT" in v.reason_codes


def test_daily_loss_stop():
    v = run_gate(csp_order(), csp_proposal(), snap(equity=94_000.0, peak_equity=94_000.0, last_equity=100_000.0), G)
    assert v.verdict == "rejected"
    assert "DAILY_LOSS_STOP" in v.reason_codes


def test_cooldown_needs_human():
    v = run_gate(csp_order(), csp_proposal(), snap(consecutive_losses=3), G)
    assert v.verdict == "needs_human"
    assert "COOLDOWN" in v.reason_codes


def test_naked_call_forbidden():
    order = OrderPlan(
        proposal_id="tp_x", strategy_type="covered_call",
        legs=[OrderLeg(symbol="AMD260918C00200000", side="sell", qty=1,
                       asset_class="us_option", limit_price=3.0)],
        est_max_loss=0.0, meta={"spread_pct": 0.1, "bid": 3.0},
    )
    prop = TradeProposal(source="s", underlying="AMD", direction="neutral_bullish",
                         strategy_type="covered_call")
    v = run_gate(order, prop, snap(stock_qty_by_symbol={"AMD": 40}), G)
    assert v.verdict == "rejected"
    assert "NAKED_CALL_FORBIDDEN" in v.reason_codes

    v_ok = run_gate(order, prop, snap(stock_qty_by_symbol={"AMD": 100}), G)
    assert v_ok.verdict == "approved"


def test_spread_max_loss_cap():
    order = OrderPlan(
        proposal_id="tp_x", strategy_type="bull_put_spread",
        legs=[
            OrderLeg(symbol="SPY260918P00760000", side="sell", qty=1, asset_class="us_option", limit_price=5.0),
            OrderLeg(symbol="SPY260918P00740000", side="buy", qty=1, asset_class="us_option", limit_price=3.0),
        ],
        est_max_loss=1_800.0,  # width 2000 - credit 200
        meta={"spread_pct": 0.05, "bid": 5.0},
    )
    prop = TradeProposal(source="s", underlying="SPY", direction="bullish",
                         strategy_type="bull_put_spread")
    v = run_gate(order, prop, snap(), G)  # cap = 1% * 100k = 1000 < 1800
    assert v.verdict == "rejected"
    assert "MAX_LOSS_EXCEEDED" in v.reason_codes

    v_ok = run_gate(order, prop, snap(equity=200_000.0, last_equity=200_000.0, peak_equity=200_000.0), G)
    assert v_ok.verdict == "approved"


def test_concentration_cap():
    order = OrderPlan(
        proposal_id="tp_x", strategy_type="momentum_rotation",
        legs=[OrderLeg(symbol="NVDA", side="buy", qty=100, asset_class="us_equity", limit_price=180.0)],
        est_max_loss=18_000.0, meta={"notional": 18_000.0},
    )
    prop = TradeProposal(source="s", underlying="NVDA", direction="bullish",
                         strategy_type="momentum_rotation")
    v = run_gate(order, prop, snap(exposure_by_underlying={"NVDA": 5_000.0}), G)  # 23k > 20k cap
    assert v.verdict == "rejected"
    assert "CONCENTRATION_EXCEEDED" in v.reason_codes


def test_duplicate_option_order_rejected():
    v = run_gate(csp_order(), csp_proposal(), snap(open_order_symbols=["AMD260911P00165000"]), G)
    assert v.verdict == "rejected"
    assert "DUPLICATE" in v.reason_codes


def test_illiquid_option_rejected():
    v = run_gate(csp_order(spread_pct=0.45), csp_proposal(), snap(), G)
    assert v.verdict == "rejected"
    assert "ILLIQUID" in v.reason_codes


def test_option_requires_whitelisted_type():
    order = OrderPlan(
        proposal_id="tp_x", strategy_type="momentum_rotation",  # not an options strategy
        legs=[OrderLeg(symbol="AMD260918P00170000", side="sell", qty=1,
                       asset_class="us_option", limit_price=2.0)],
        est_max_loss=100.0, meta={"spread_pct": 0.1, "bid": 2.0},
    )
    v = run_gate(order, csp_proposal(), snap(), G)
    assert v.verdict == "rejected"
    assert "NOT_WHITELISTED" in v.reason_codes


def test_max_open_positions():
    v = run_gate(csp_order(), csp_proposal(), snap(open_positions_count=12), G)
    assert v.verdict == "rejected"
    assert "TOO_MANY_POSITIONS" in v.reason_codes


def test_closed_market_still_approved_queues():
    v = run_gate(csp_order(), csp_proposal(), snap(market_open=False), G)
    assert v.verdict == "approved"
