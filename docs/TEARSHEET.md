# NorthStar - Performance Tearsheet (paper account)

Generated 2026-08-31T17:52:44.678198+00:00 - equity source: `none`.

All results are from an Alpaca **paper** account. Past results never promise
future returns; realized-P&L rows marked *estimated* were inferred from option
expiry/assignment (no fill existed to price them exactly).

## Equity curve

> No daily equity history yet - the nightly job
> records one point per day, and Alpaca needs a few sessions of activity.

## Realized P&L by strategy

| Strategy family | Trades | Wins | Losses | Realized $ | Estimated entries |
| --- | ---: | ---: | ---: | ---: | ---: |
| momentum_rotation | 4 | 2 | 2 | -26.22 | 0 |

**Total realized: -26.22 USD** (paper).

## Slippage sensitivity (walk-forward, out-of-sample)

Same backtest under three fill assumptions - an edge that only survives
mid-price fills is a liquidity subsidy, not a strategy.

**momentum_rotation** (champion params)

| Fill assumption | Cost (bps) | OOS ann. return | OOS Sharpe | OOS max DD |
| --- | ---: | ---: | ---: | ---: |
| mid | 1 | +51.2% | 1.57 | -26.6% |
| quarter spread | 5 | +49.9% | 1.54 | -26.7% |
| half spread | 9 | +48.7% | 1.50 | -26.8% |


## Method notes

- Equity: broker-reported daily equity when available, otherwise the nightly snapshot.
- Realized P&L: booked on our own closing fills at exact fill prices; positions that
  vanished without a fill (expiry/assignment/manual) are booked as labeled estimates.
- Unrealized P&L is not in the attribution table - open positions are marked by the broker.
