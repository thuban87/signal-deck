"""Alpaca API wrapper for real-time market data.

Falls back to yfinance when Alpaca credentials are not configured.
This provides a unified interface regardless of data source.
"""

import time
from datetime import datetime, timedelta
from config import ALPACA_API_KEY, ALPACA_SECRET_KEY, ALPACA_BASE_URL

# Try to import alpaca — falls back gracefully if not installed or not configured
_alpaca_available = False
_stock_client = None
_trading_client = None

if ALPACA_API_KEY and ALPACA_SECRET_KEY:
    try:
        from alpaca.data.live import StockDataStream
        from alpaca.data.historical import StockHistoricalDataClient
        from alpaca.data.requests import (
            StockLatestQuoteRequest,
            StockBarsRequest,
            StockSnapshotRequest,
        )
        from alpaca.data.timeframe import TimeFrame
        from alpaca.trading.client import TradingClient
        from alpaca.trading.requests import GetAssetsRequest
        from alpaca.trading.enums import AssetClass

        _stock_client = StockHistoricalDataClient(ALPACA_API_KEY, ALPACA_SECRET_KEY)
        _trading_client = TradingClient(ALPACA_API_KEY, ALPACA_SECRET_KEY, paper=True)
        _alpaca_available = True
        print("[Alpaca] Connected successfully (real-time data enabled)")
    except ImportError:
        print("[Alpaca] alpaca-py not installed — falling back to yfinance")
    except Exception as e:
        print(f"[Alpaca] Connection failed: {e} — falling back to yfinance")
else:
    print("[Alpaca] No API keys configured — using yfinance for market data")


def is_alpaca_available() -> bool:
    """Check if Alpaca is configured and connected."""
    return _alpaca_available


def get_latest_quotes(symbols: list[str]) -> dict:
    """Get latest quotes for multiple symbols.

    Returns: {symbol: {price, bid, ask, timestamp}}
    Falls back to yfinance if Alpaca is not available.
    """
    if _alpaca_available and _stock_client:
        try:
            request = StockLatestQuoteRequest(symbol_or_symbols=symbols)
            quotes = _stock_client.get_stock_latest_quote(request)
            result = {}
            for symbol, quote in quotes.items():
                mid_price = (quote.ask_price + quote.bid_price) / 2 if quote.bid_price else quote.ask_price
                result[symbol] = {
                    "price": round(mid_price, 2),
                    "bid": round(quote.bid_price, 2) if quote.bid_price else None,
                    "ask": round(quote.ask_price, 2) if quote.ask_price else None,
                    "timestamp": str(quote.timestamp),
                    "source": "alpaca",
                }
            return result
        except Exception as e:
            print(f"[Alpaca] Quote fetch failed: {e}, falling back to yfinance")

    # Fallback to yfinance
    from data_fetcher import get_latest_price
    result = {}
    for symbol in symbols:
        try:
            info = get_latest_price(symbol)
            result[symbol] = {
                "price": info["price"],
                "bid": None,
                "ask": None,
                "timestamp": info["date"],
                "source": "yfinance",
            }
        except Exception:
            pass
    return result


def get_snapshots(symbols: list[str]) -> dict:
    """Get market snapshots (price + daily stats) for symbols.

    Returns dict with daily bar, latest quote, prev close, etc.
    """
    if _alpaca_available and _stock_client:
        try:
            request = StockSnapshotRequest(symbol_or_symbols=symbols)
            snapshots = _stock_client.get_stock_snapshot(request)
            result = {}
            for symbol, snap in snapshots.items():
                daily_bar = snap.daily_bar
                prev_daily_bar = snap.previous_daily_bar
                latest_quote = snap.latest_quote

                price = (latest_quote.ask_price + latest_quote.bid_price) / 2 if latest_quote.bid_price else latest_quote.ask_price
                prev_close = prev_daily_bar.close if prev_daily_bar else daily_bar.open
                change = price - prev_close
                change_pct = (change / prev_close * 100) if prev_close else 0

                result[symbol] = {
                    "price": round(price, 2),
                    "change": round(change, 2),
                    "change_pct": round(change_pct, 2),
                    "open": round(daily_bar.open, 2),
                    "high": round(daily_bar.high, 2),
                    "low": round(daily_bar.low, 2),
                    "volume": int(daily_bar.volume),
                    "prev_close": round(prev_close, 2),
                    "timestamp": str(latest_quote.timestamp),
                    "source": "alpaca",
                }
            return result
        except Exception as e:
            print(f"[Alpaca] Snapshot fetch failed: {e}, falling back to yfinance")

    # Fallback to yfinance
    from data_fetcher import get_latest_price
    result = {}
    for symbol in symbols:
        try:
            info = get_latest_price(symbol)
            result[symbol] = {
                "price": info["price"],
                "change": info["change"],
                "change_pct": info["change_pct"],
                "open": None,
                "high": info["high"],
                "low": info["low"],
                "volume": info["volume"],
                "prev_close": round(info["price"] - info["change"], 2),
                "timestamp": info["date"],
                "source": "yfinance",
            }
        except Exception:
            pass
    return result


def validate_symbol(symbol: str) -> dict | None:
    """Check if a symbol is valid and tradeable.

    Returns asset info dict or None if invalid.
    """
    if _alpaca_available and _trading_client:
        try:
            asset = _trading_client.get_asset(symbol.upper())
            if asset.tradable:
                return {
                    "symbol": asset.symbol,
                    "name": asset.name,
                    "exchange": asset.exchange.value if asset.exchange else "unknown",
                    "tradable": asset.tradable,
                }
        except Exception:
            pass

    # Fallback: try fetching from yfinance
    try:
        import yfinance as yf
        ticker = yf.Ticker(symbol)
        info = ticker.info
        if info and info.get("regularMarketPrice"):
            return {
                "symbol": symbol.upper(),
                "name": info.get("shortName", info.get("longName", symbol)),
                "exchange": info.get("exchange", "unknown"),
                "tradable": True,
            }
    except Exception:
        pass

    return None


# ---------------------------------------------------------------------------
# In-memory price cache
# ---------------------------------------------------------------------------

_price_cache: dict[str, dict] = {}
_cache_timestamps: dict[str, float] = {}


def get_cached_snapshots(symbols: list[str], ttl: int = 60) -> dict:
    """Get snapshots with caching to avoid API rate limits.

    Args:
        symbols: List of symbols to fetch
        ttl: Cache time-to-live in seconds (default 60s for real-time feel)
    """
    now = time.time()
    stale = []
    result = {}

    for s in symbols:
        if s in _price_cache and (now - _cache_timestamps.get(s, 0)) < ttl:
            result[s] = _price_cache[s]
        else:
            stale.append(s)

    if stale:
        fresh = get_snapshots(stale)
        for s, data in fresh.items():
            _price_cache[s] = data
            _cache_timestamps[s] = now
            result[s] = data

    return result


def clear_cache():
    """Clear the price cache."""
    _price_cache.clear()
    _cache_timestamps.clear()
