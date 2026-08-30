# NorthStar - Performance Tearsheet (paper account)

Generated 2026-08-29T20:06:47.485611+00:00 - equity source: `alpaca_portfolio_history`.

All results are from an Alpaca **paper** account. Past results never promise
future returns; realized-P&L rows marked *estimated* were inferred from option
expiry/assignment (no fill existed to price them exactly).

## Equity curve

`▁▁█`

2026-08-27 ($100,000) to 2026-08-29 ($100,045)

| Metric | Value |
| --- | --- |
| Total return | +0.05% |
| Annualized return | - |
| Sharpe (daily, annualized) | - |
| Max drawdown | 0.00% |
| Daily win rate | 50% |
| Best / worst day | +0.05% / +0.00% |
| Trading days | 2 |

> annualized stats appear after 20 trading days (have 2)

## Realized P&L by strategy

> No closed round-trips yet - realized P&L appears once positions close.

## Method notes

- Equity: broker-reported daily equity when available, otherwise the nightly snapshot.
- Realized P&L: booked on our own closing fills at exact fill prices; positions that
  vanished without a fill (expiry/assignment/manual) are booked as labeled estimates.
- Unrealized P&L is not in the attribution table - open positions are marked by the broker.
