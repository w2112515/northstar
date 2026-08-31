"""Gate rules are the safety boundary - every rule gets a direct test."""

from northstar.domain import Guardrails, OrderLeg, OrderPlan, TradeProposal
from northstar.gate import GateSnapshot, run_gate

G = Guardrails(max_loss_per_trade_pct=0.01)  # 1% of equity per defined-risk trade


def snap(**kw) -> GateSnapshot:
    base = dict(
        equity=100_000.0, last_equity=100_000.0, peak_equity=100_000.0,
        market_open=True, kill_switch=False, consecutive_losses=0,
        open_positions_count=2, exposure_by_underlying={}, open_order_symbols=[],
        stock_qty_by_symbol={}, orders_today=0, frozen_symbols=[], options_level=3,
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


def test_earnings_blackout_blocks_short_premium():
    # AMD reports 2026-09-05; the short put lives until 2026-09-18 -> step aside
    v = run_gate(csp_order(), csp_proposal(),
                 snap(earnings_by_underlying={"AMD": "2026-09-05"}, today_iso="2026-08-31"), G)
    assert v.verdict == "rejected"
    assert "EARNINGS_BLACKOUT" in v.reason_codes


def test_earnings_after_expiry_is_fine():
    v = run_gate(csp_order(), csp_proposal(),
                 snap(earnings_by_underlying={"AMD": "2026-10-05"}, today_iso="2026-08-31"), G)
    assert v.verdict == "approved"


def test_earnings_no_data_passes_and_says_so():
    v = run_gate(csp_order(), csp_proposal(), snap(today_iso="2026-08-31"), G)
    assert v.verdict == "approved"
    row = next(c for c in v.checks if c.rule == "earnings_blackout")
    assert row.actual == "no data" and row.passed


def test_earnings_never_blocks_closing():
    order = csp_order()
    order.meta["closing"] = True
    v = run_gate(order, csp_proposal(),
                 snap(earnings_by_underlying={"AMD": "2026-09-05"}, today_iso="2026-08-31"), G)
    assert "EARNINGS_BLACKOUT" not in v.reason_codes


def test_portfolio_deployed_cap_blocks_stacking():
    # book already risks $80k; +$17k CSP collateral tops the 90% whole-book cap
    v = run_gate(csp_order(), csp_proposal(), snap(deployed_risk=80_000.0), G)
    assert v.verdict == "rejected"
    assert "PORTFOLIO_BUDGET_EXCEEDED" in v.reason_codes


def test_portfolio_cap_allows_a_normal_book():
    v = run_gate(csp_order(), csp_proposal(), snap(deployed_risk=40_000.0), G)
    assert v.verdict == "approved"


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


def spread_order(est_max_loss=1_800.0) -> OrderPlan:
    return OrderPlan(
        proposal_id="tp_x", strategy_type="bull_put_spread",
        legs=[
            OrderLeg(symbol="SPY260918P00760000", side="sell", qty=1, asset_class="us_option", limit_price=5.0),
            OrderLeg(symbol="SPY260918P00740000", side="buy", qty=1, asset_class="us_option", limit_price=3.0),
        ],
        est_max_loss=est_max_loss,  # width 2000 - credit 200
        meta={"spread_pct": 0.05, "bid": 5.0, "order_class": "mleg", "net_limit": -2.0},
    )


def spread_proposal() -> TradeProposal:
    return TradeProposal(source="s", underlying="SPY", direction="bullish",
                         strategy_type="bull_put_spread")


def test_spread_max_loss_cap():
    v = run_gate(spread_order(), spread_proposal(), snap(), G)  # cap = 1% * 100k = 1000 < 1800
    assert v.verdict == "rejected"
    assert "MAX_LOSS_EXCEEDED" in v.reason_codes

    v_ok = run_gate(spread_order(), spread_proposal(),
                    snap(equity=200_000.0, last_equity=200_000.0, peak_equity=200_000.0), G)
    assert v_ok.verdict == "approved"


def test_spread_needs_options_level_3():
    v = run_gate(spread_order(est_max_loss=900.0), spread_proposal(), snap(options_level=2), G)
    assert v.verdict == "rejected"
    assert "OPTIONS_LEVEL_TOO_LOW" in v.reason_codes

    # single-leg CSP is fine at level 2
    v_csp = run_gate(csp_order(), csp_proposal(), snap(options_level=2), G)
    assert v_csp.verdict == "approved"


def test_spread_max_loss_counts_toward_concentration():
    # existing SPY exposure 19.5k + spread max loss 900 > 20% cap of 100k
    v = run_gate(spread_order(est_max_loss=900.0), spread_proposal(),
                 snap(exposure_by_underlying={"SPY": 19_500.0}), G)
    assert v.verdict == "rejected"
    assert "CONCENTRATION_EXCEEDED" in v.reason_codes


def test_frozen_symbol_rejected():
    v = run_gate(csp_order(), csp_proposal(), snap(frozen_symbols=["amd"]), G)
    assert v.verdict == "rejected"
    assert "SYMBOL_FROZEN" in v.reason_codes


def test_order_rate_limit():
    v = run_gate(csp_order(), csp_proposal(), snap(orders_today=12), G)
    assert v.verdict == "rejected"
    assert "ORDER_RATE_LIMIT" in v.reason_codes

    v_ok = run_gate(csp_order(), csp_proposal(), snap(orders_today=11), G)
    assert v_ok.verdict == "approved"


def test_equity_order_notional_cap():
    order = OrderPlan(
        proposal_id="tp_x", strategy_type="rsi_mean_reversion",
        legs=[OrderLeg(symbol="NVDA", side="buy", qty=80, asset_class="us_equity", limit_price=180.0)],
        est_max_loss=14_400.0, meta={"notional": 14_400.0},
    )
    prop = TradeProposal(source="s", underlying="NVDA", direction="bullish",
                         strategy_type="rsi_mean_reversion")
    v = run_gate(order, prop, snap(), G)  # 14.4k > 10% * 100k
    assert v.verdict == "rejected"
    assert "ORDER_NOTIONAL_EXCEEDED" in v.reason_codes


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


def test_weather_storm_pauses_new_risk():
    v = run_gate(csp_order(), csp_proposal(), snap(weather_score=15), G)  # floor 20
    assert v.verdict == "needs_human"
    assert "WEATHER_STORM" in v.reason_codes


def test_weather_never_blocks_exits():
    order = OrderPlan(
        proposal_id="tp_x", strategy_type="momentum_rotation",
        legs=[OrderLeg(symbol="NVDA", side="sell", qty=10, asset_class="us_equity", limit_price=180.0)],
        est_max_loss=0.0, meta={},
    )
    prop = TradeProposal(source="s", underlying="NVDA", direction="bearish",
                         strategy_type="momentum_rotation")
    v = run_gate(order, prop, snap(weather_score=5), G)
    assert v.verdict == "approved"


def test_weather_offline_never_blocks():
    v = run_gate(csp_order(), csp_proposal(), snap(weather_score=None), G)
    assert v.verdict == "approved"


def test_weather_above_floor_passes():
    v = run_gate(csp_order(), csp_proposal(), snap(weather_score=21), G)
    assert v.verdict == "approved"
    weather_checks = [c for c in v.checks if c.rule == "weather_floor"]
    assert len(weather_checks) == 1 and weather_checks[0].passed


# ------------------------------------------------------------------ closing orders

def close_order(symbol="AMD260918P00170000") -> OrderPlan:
    return OrderPlan(
        proposal_id="tp_x", strategy_type="cash_secured_put",
        legs=[OrderLeg(symbol=symbol, side="buy", qty=1,
                       asset_class="us_option", limit_price=0.55)],
        est_max_loss=0.0,
        meta={"closing": True, "entry_price": 2.5, "signed_qty": -1, "pnl_multiplier": 100},
    )


def test_closing_order_ignores_new_risk_rules():
    # storm weather + rate limit + frozen + breaker + cooldown + max positions:
    # every new-risk stop is active, the close still goes through
    s = snap(
        weather_score=5, orders_today=12, frozen_symbols=["AMD"],
        equity=91_000.0, last_equity=91_450.0,  # soft breaker zone
        consecutive_losses=5, open_positions_count=12, options_level=2,
        exposure_by_underlying={"AMD": 50_000.0},
    )
    v = run_gate(close_order(), csp_proposal(), s, G)
    assert v.verdict == "approved"
    assert any(c.rule == "closing_order" for c in v.checks)


def test_closing_order_still_respects_kill_switch():
    v = run_gate(close_order(), csp_proposal(), snap(kill_switch=True), G)
    assert v.verdict == "rejected"
    assert "KILL_SWITCH" in v.reason_codes


def test_closing_duplicate_exact_symbol_only():
    # same OCC symbol pending -> duplicate; other option on same underlying -> fine
    v_dup = run_gate(close_order(), csp_proposal(),
                     snap(open_order_symbols=["AMD260918P00170000"]), G)
    assert v_dup.verdict == "rejected"
    assert "DUPLICATE" in v_dup.reason_codes

    v_ok = run_gate(close_order(), csp_proposal(),
                    snap(open_order_symbols=["AMD260911P00165000"]), G)
    assert v_ok.verdict == "approved"


def test_closing_mleg_still_needs_options_level():
    order = OrderPlan(
        proposal_id="tp_x", strategy_type="bull_put_spread",
        legs=[
            OrderLeg(symbol="SPY260918P00760000", side="buy", qty=1, asset_class="us_option"),
            OrderLeg(symbol="SPY260918P00740000", side="sell", qty=1, asset_class="us_option"),
        ],
        est_max_loss=0.0,
        meta={"closing": True, "order_class": "mleg", "net_limit": 0.85, "contracts": 1},
    )
    v = run_gate(order, spread_proposal(), snap(options_level=2), G)
    assert v.verdict == "rejected"
    assert "OPTIONS_LEVEL_TOO_LOW" in v.reason_codes


# ------------------------------------------------------------------ sleeve budget

def momentum_buy(qty=10, price=100.0) -> tuple[OrderPlan, TradeProposal]:
    order = OrderPlan(
        proposal_id="tp_x", strategy_type="momentum_rotation",
        legs=[OrderLeg(symbol="NVDA", side="buy", qty=qty, asset_class="us_equity", limit_price=price)],
        est_max_loss=qty * price, meta={},
    )
    prop = TradeProposal(source="s", underlying="NVDA", direction="bullish",
                         strategy_type="momentum_rotation")
    return order, prop


def test_sleeve_budget_blocks_overweight_family():
    # sleeve already at $32.5k of a $33k budget; a $1k buy would breach it
    order, prop = momentum_buy(qty=10, price=100.0)
    v = run_gate(order, prop, snap(
        sleeve_budget_by_family={"momentum_rotation": 33_000.0},
        sleeve_exposure_by_family={"momentum_rotation": 32_500.0},
    ), G)
    assert v.verdict == "rejected"
    assert "SLEEVE_BUDGET_EXCEEDED" in v.reason_codes


def test_sleeve_budget_within_cap_approved():
    order, prop = momentum_buy(qty=10, price=100.0)
    v = run_gate(order, prop, snap(
        sleeve_budget_by_family={"momentum_rotation": 33_000.0},
        sleeve_exposure_by_family={"momentum_rotation": 30_000.0},
    ), G)
    assert v.verdict == "approved"
    sleeve_checks = [c for c in v.checks if c.rule == "sleeve_budget"]
    assert len(sleeve_checks) == 1 and sleeve_checks[0].passed


def test_sleeve_budget_ignores_families_without_budget():
    # no budget entry for this family (e.g. options sleeves) -> rule stays silent
    order, prop = momentum_buy(qty=10, price=100.0)
    v = run_gate(order, prop, snap(), G)
    assert v.verdict == "approved"
    assert not any(c.rule == "sleeve_budget" for c in v.checks)


def test_sleeve_budget_never_blocks_sells():
    order = OrderPlan(
        proposal_id="tp_x", strategy_type="momentum_rotation",
        legs=[OrderLeg(symbol="NVDA", side="sell", qty=10, asset_class="us_equity", limit_price=100.0)],
        est_max_loss=0.0, meta={},
    )
    prop = TradeProposal(source="s", underlying="NVDA", direction="bearish",
                         strategy_type="momentum_rotation")
    v = run_gate(order, prop, snap(
        sleeve_budget_by_family={"momentum_rotation": 33_000.0},
        sleeve_exposure_by_family={"momentum_rotation": 49_000.0},  # already overweight
    ), G)
    assert v.verdict == "approved"
