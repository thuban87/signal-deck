"""Fetches market data from Yahoo Finance."""

import yfinance as yf
import pandas as pd
from config import DEFAULT_PERIOD, DEFAULT_INTERVAL


def fetch_stock_data(
    symbol: str,
    period: str = DEFAULT_PERIOD,
    interval: str = DEFAULT_INTERVAL,
) -> pd.DataFrame:
    """Fetch OHLCV data for a single stock."""
    ticker = yf.Ticker(symbol)
    df = ticker.history(period=period, interval=interval)
    if df.empty:
        raise ValueError(f"No data returned for {symbol}")
    df.index = df.index.tz_localize(None)
    return df


def fetch_multiple(
    symbols: list[str],
    period: str = DEFAULT_PERIOD,
    interval: str = DEFAULT_INTERVAL,
) -> dict[str, pd.DataFrame]:
    """Fetch data for multiple symbols. Returns {symbol: DataFrame}."""
    results = {}
    for symbol in symbols:
        try:
            results[symbol] = fetch_stock_data(symbol, period, interval)
            print(f"  Fetched {symbol}: {len(results[symbol])} candles")
        except Exception as e:
            print(f"  Failed to fetch {symbol}: {e}")
    return results


def get_latest_price(symbol: str) -> dict:
    """Get the most recent price info for a symbol."""
    df = fetch_stock_data(symbol, period="5d", interval="1d")
    latest = df.iloc[-1]
    prev = df.iloc[-2]
    change = latest["Close"] - prev["Close"]
    change_pct = (change / prev["Close"]) * 100
    return {
        "symbol": symbol,
        "price": round(latest["Close"], 2),
        "change": round(change, 2),
        "change_pct": round(change_pct, 2),
        "volume": int(latest["Volume"]),
        "high": round(latest["High"], 2),
        "low": round(latest["Low"], 2),
        "date": str(df.index[-1].date()),
    }
