"""Alpaca client factory + thin read helpers.

Paper-only by construction (config refuses non-PK keys / ALPACA_PAPER=false).
Execution lives in northstar.executor; this module owns clients and reads.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Any

from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.historical.option import OptionHistoricalDataClient
from alpaca.data.requests import (
    OptionChainRequest,
    StockBarsRequest,
    StockLatestQuoteRequest,
)
from alpaca.data.timeframe import TimeFrame
from alpaca.trading.client import TradingClient

from northstar.config import get_settings


@lru_cache(maxsize=1)
def trading_client() -> TradingClient:
    s = get_settings()
    return TradingClient(s.alpaca_api_key, s.alpaca_secret_key, paper=True)


@lru_cache(maxsize=1)
def stock_data() -> StockHistoricalDataClient:
    s = get_settings()
    return StockHistoricalDataClient(s.alpaca_api_key, s.alpaca_secret_key)


@lru_cache(maxsize=1)
def option_data() -> OptionHistoricalDataClient:
    s = get_settings()
    return OptionHistoricalDataClient(s.alpaca_api_key, s.alpaca_secret_key)


def get_clock() -> dict[str, Any]:
    c = trading_client().get_clock()
    return {
        "is_open": c.is_open,
        "next_open": c.next_open.isoformat(),
        "next_close": c.next_close.isoformat(),
    }


def get_account_summary() -> dict[str, Any]:
    a = trading_client().get_account()
    lvl = getattr(a, "options_trading_level", None)
    try:
        options_level = int(getattr(lvl, "value", lvl) or 0)
    except (TypeError, ValueError):
        options_level = 0
    return {
        "account_role": get_settings().account_role,
        "paper": True,
        "equity": float(a.equity),
        "last_equity": float(a.last_equity),
        "cash": float(a.cash),
        "buying_power": float(a.buying_power),
        "options_level": options_level,
        "status": str(a.status),
    }


def get_positions() -> list[dict[str, Any]]:
    out = []
    for p in trading_client().get_all_positions():
        out.append(
            {
                "symbol": p.symbol,
                "qty": float(p.qty),
                "asset_class": str(p.asset_class.value if hasattr(p.asset_class, "value") else p.asset_class),
                "market_value": float(p.market_value) if p.market_value else 0.0,
                "avg_entry_price": float(p.avg_entry_price) if p.avg_entry_price else 0.0,
                "unrealized_pl": float(p.unrealized_pl) if p.unrealized_pl else 0.0,
                "current_price": float(p.current_price) if p.current_price else None,
            }
        )
    return out


def get_open_orders() -> list[dict[str, Any]]:
    from alpaca.trading.enums import QueryOrderStatus
    from alpaca.trading.requests import GetOrdersRequest

    orders = trading_client().get_orders(GetOrdersRequest(status=QueryOrderStatus.OPEN, limit=100))
    return [
        {
            "id": str(o.id),
            "symbol": o.symbol,
            "side": str(o.side.value if hasattr(o.side, "value") else o.side),
            "qty": float(o.qty) if o.qty else None,
            "limit_price": float(o.limit_price) if o.limit_price else None,
            "status": str(o.status.value if hasattr(o.status, "value") else o.status),
            "created_at": o.created_at.isoformat() if o.created_at else None,
        }
        for o in orders
    ]


def cancel_order(order_id: str) -> None:
    trading_client().cancel_order_by_id(order_id)


def latest_quote(symbol: str) -> dict[str, Any]:
    q = stock_data().get_stock_latest_quote(StockLatestQuoteRequest(symbol_or_symbols=symbol))
    quote = q[symbol]
    return {
        "symbol": symbol,
        "bid": float(quote.bid_price),
        "ask": float(quote.ask_price),
        "ts": quote.timestamp.isoformat(),
    }


def latest_trade_price(symbol: str) -> float | None:
    from alpaca.data.requests import StockLatestTradeRequest

    t = stock_data().get_stock_latest_trade(StockLatestTradeRequest(symbol_or_symbols=symbol))
    return float(t[symbol].price) if symbol in t else None


def daily_bars(symbols: list[str], years: float = 4.0):
    """Daily bars as a dict[symbol] -> pandas.DataFrame(open, high, low, close, volume)."""
    import pandas as pd

    # free data plan: SIP history is fine except the most recent 15 minutes
    end = datetime.now(timezone.utc) - timedelta(minutes=20)
    start = end - timedelta(days=int(365 * years))
    req = StockBarsRequest(
        symbol_or_symbols=symbols, timeframe=TimeFrame.Day, start=start, end=end
    )
    bars = stock_data().get_stock_bars(req)
    out: dict[str, pd.DataFrame] = {}
    df = bars.df  # multi-index (symbol, timestamp)
    if df.empty:
        return out
    for sym in symbols:
        try:
            sdf = df.xs(sym, level="symbol").copy()
        except KeyError:
            continue
        sdf.index = sdf.index.tz_convert("UTC").normalize()
        out[sym] = sdf[["open", "high", "low", "close", "volume"]]
    return out


def option_chain(underlying: str, dte_min: int, dte_max: int) -> list[dict[str, Any]]:
    """Option chain snapshots (latest quote + greeks) filtered by DTE window."""
    today = datetime.now(timezone.utc).date()
    req = OptionChainRequest(
        underlying_symbol=underlying,
        expiration_date_gte=today + timedelta(days=dte_min),
        expiration_date_lte=today + timedelta(days=dte_max),
    )
    chain = option_data().get_option_chain(req)
    out = []
    for occ_symbol, snap in chain.items():
        greeks = getattr(snap, "greeks", None)
        quote = getattr(snap, "latest_quote", None)
        out.append(
            {
                "symbol": occ_symbol,
                "delta": float(greeks.delta) if greeks and greeks.delta is not None else None,
                "iv": float(snap.implied_volatility) if snap.implied_volatility else None,
                "bid": float(quote.bid_price) if quote else None,
                "ask": float(quote.ask_price) if quote else None,
                "bid_size": float(quote.bid_size) if quote else None,
                "ask_size": float(quote.ask_size) if quote else None,
            }
        )
    return out
