"""Deflated Sharpe discount (Bailey/Lopez de Prado expected-max haircut)."""

import math

from northstar.domain import BacktestReport
from northstar.evolution.loop import (
    adjusted_oos_sharpe,
    expected_max_sharpe,
    sharpe_std_error,
)


def report(oos_sharpe, trials):
    return BacktestReport(oos_sharpe=oos_sharpe, trials_in_family=trials)


def test_single_trial_no_haircut():
    assert expected_max_sharpe(1, 0.9) == 0.0
    assert adjusted_oos_sharpe(report(1.2, 1)) == 1.2


def test_haircut_grows_with_trials():
    sr_std = 0.9
    h2 = expected_max_sharpe(2, sr_std)
    h10 = expected_max_sharpe(10, sr_std)
    h50 = expected_max_sharpe(50, sr_std)
    assert 0 < h2 < h10 < h50
    # grows like sqrt(log n): marginal penalty shrinks
    assert (h10 - h2) > (h50 - h10) * 0.5


def test_haircut_scales_with_estimator_noise():
    assert expected_max_sharpe(10, 1.0) > expected_max_sharpe(10, 0.5)
    assert expected_max_sharpe(10, 0.0) == 0.0


def test_two_trials_known_value():
    # z(1-1/2)=0, so E[max] = gamma * z(1 - 1/(2e)) * std
    from statistics import NormalDist
    std = 1.0
    expected = 0.5772156649015329 * NormalDist().inv_cdf(1 - 1 / (2 * math.e))
    assert abs(expected_max_sharpe(2, std) - expected) < 1e-9


def test_sharpe_std_error_shrinks_with_history():
    assert sharpe_std_error(1.0, oos_days=300) > sharpe_std_error(1.0, oos_days=1200)
    # a 300-day annualized Sharpe is genuinely noisy: SE near 1
    assert 0.7 < sharpe_std_error(1.0, oos_days=300) < 1.2


def test_adjusted_sharpe_none_passthrough():
    assert adjusted_oos_sharpe(report(None, 5)) is None


def test_many_trials_demand_meaningfully_more():
    # same observed Sharpe, more prior experiments -> lower adjusted score
    few = adjusted_oos_sharpe(report(1.0, 2))
    many = adjusted_oos_sharpe(report(1.0, 30))
    assert few is not None and many is not None
    assert few - many > 0.3
