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
        from alpaca.trading.requests import (
            GetAssetsRequest,
            MarketOrderRequest,
            LimitOrderRequest,
            StopOrderRequest,
            StopLimitOrderRequest,
            TakeProfitRequest,
            StopLossRequest,
            GetOrdersRequest,
            ClosePositionRequest,
            GetPortfolioHistoryRequest,
        )
        from alpaca.trading.enums import (
            AssetClass,
            OrderSide,
            TimeInForce,
            OrderClass,
            QueryOrderStatus,
        )

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


# ---------------------------------------------------------------------------
# Alpaca Paper Trading Functions
# ---------------------------------------------------------------------------

def get_account() -> dict | None:
    """Get Alpaca paper account info (balance, buying power, equity)."""
    if not (_alpaca_available and _trading_client):
        return None
    try:
        acct = _trading_client.get_account()
        return {
            "account_number": acct.account_number,
            "status": str(acct.status),
            "cash": float(acct.cash),
            "buying_power": float(acct.buying_power),
            "portfolio_value": float(acct.portfolio_value),
            "equity": float(acct.equity),
            "last_equity": float(acct.last_equity),
            "long_market_value": float(acct.long_market_value),
            "short_market_value": float(acct.short_market_value),
            "initial_margin": float(acct.initial_margin),
            "daytrade_count": acct.daytrade_count,
            "pattern_day_trader": acct.pattern_day_trader,
        }
    except Exception as e:
        print(f"[Alpaca] get_account failed: {e}")
        return None


def get_positions() -> list[dict]:
    """Get all open positions from Alpaca."""
    if not (_alpaca_available and _trading_client):
        return []
    try:
        positions = _trading_client.get_all_positions()
        return [
            {
                "symbol": p.symbol,
                "qty": float(p.qty),
                "side": str(p.side),
                "avg_entry_price": float(p.avg_entry_price),
                "current_price": float(p.current_price),
                "market_value": float(p.market_value),
                "cost_basis": float(p.cost_basis),
                "unrealized_pl": float(p.unrealized_pl),
                "unrealized_plpc": float(p.unrealized_plpc),
                "change_today": float(p.change_today),
            }
            for p in positions
        ]
    except Exception as e:
        print(f"[Alpaca] get_positions failed: {e}")
        return []


def submit_order(
    symbol: str,
    qty: float | None = None,
    notional: float | None = None,
    side: str = "buy",
    order_type: str = "market",
    time_in_force: str = "day",
    limit_price: float | None = None,
    stop_price: float | None = None,
    take_profit_price: float | None = None,
    stop_loss_price: float | None = None,
) -> dict | None:
    """Submit an order to Alpaca paper trading.

    Args:
        symbol: Ticker symbol
        qty: Number of shares (use this OR notional, not both)
        notional: Dollar amount to buy (use this OR qty, not both)
        side: "buy" or "sell"
        order_type: "market", "limit", "stop", "stop_limit", "bracket"
        time_in_force: "day", "gtc", "fok", "ioc"
        limit_price: Required for limit/stop_limit orders
        stop_price: Required for stop/stop_limit orders
        take_profit_price: Take profit limit price (bracket orders)
        stop_loss_price: Stop loss price (bracket orders)
    """
    if not (_alpaca_available and _trading_client):
        return None

    order_side = OrderSide.BUY if side.lower() == "buy" else OrderSide.SELL
    tif_map = {
        "day": TimeInForce.DAY,
        "gtc": TimeInForce.GTC,
        "fok": TimeInForce.FOK,
        "ioc": TimeInForce.IOC,
    }
    tif = tif_map.get(time_in_force.lower(), TimeInForce.DAY)

    # Build common kwargs
    common = {"symbol": symbol.upper(), "side": order_side, "time_in_force": tif}
    if qty is not None:
        common["qty"] = qty
    elif notional is not None:
        common["notional"] = notional
    else:
        return None

    try:
        if order_type == "bracket":
            if take_profit_price is None or stop_loss_price is None:
                return None
            order_data = MarketOrderRequest(
                **common,
                order_class=OrderClass.BRACKET,
                take_profit=TakeProfitRequest(limit_price=take_profit_price),
                stop_loss=StopLossRequest(stop_price=stop_loss_price),
            )
        elif order_type == "limit":
            if limit_price is None:
                return None
            order_data = LimitOrderRequest(**common, limit_price=limit_price)
        elif order_type == "stop":
            if stop_price is None:
                return None
            order_data = StopOrderRequest(**common, stop_price=stop_price)
        elif order_type == "stop_limit":
            if limit_price is None or stop_price is None:
                return None
            order_data = StopLimitOrderRequest(
                **common, limit_price=limit_price, stop_price=stop_price
            )
        else:
            order_data = MarketOrderRequest(**common)

        order = _trading_client.submit_order(order_data=order_data)
        return {
            "id": str(order.id),
            "client_order_id": order.client_order_id,
            "symbol": order.symbol,
            "qty": str(order.qty) if order.qty else None,
            "notional": str(order.notional) if order.notional else None,
            "side": str(order.side),
            "type": str(order.type),
            "time_in_force": str(order.time_in_force),
            "status": str(order.status),
            "submitted_at": str(order.submitted_at),
            "filled_at": str(order.filled_at) if order.filled_at else None,
            "filled_avg_price": str(order.filled_avg_price) if order.filled_avg_price else None,
            "order_class": str(order.order_class) if order.order_class else None,
        }
    except Exception as e:
        print(f"[Alpaca] submit_order failed: {e}")
        raise


def close_position(symbol: str, qty: float | None = None, percentage: str | None = None) -> dict | None:
    """Close a position on Alpaca (full or partial)."""
    if not (_alpaca_available and _trading_client):
        return None
    try:
        close_opts = None
        if qty is not None:
            close_opts = ClosePositionRequest(qty=str(qty))
        elif percentage is not None:
            close_opts = ClosePositionRequest(percentage=percentage)

        order = _trading_client.close_position(
            symbol.upper(),
            close_options=close_opts,
        )
        return {
            "id": str(order.id),
            "symbol": order.symbol,
            "qty": str(order.qty) if order.qty else None,
            "side": str(order.side),
            "status": str(order.status),
            "submitted_at": str(order.submitted_at),
        }
    except Exception as e:
        print(f"[Alpaca] close_position failed: {e}")
        raise


def get_orders(status: str = "all", limit: int = 50, symbols: list[str] | None = None) -> list[dict]:
    """Get order history from Alpaca."""
    if not (_alpaca_available and _trading_client):
        return []
    try:
        status_map = {
            "open": QueryOrderStatus.OPEN,
            "closed": QueryOrderStatus.CLOSED,
            "all": QueryOrderStatus.ALL,
        }
        req = GetOrdersRequest(
            status=status_map.get(status, QueryOrderStatus.ALL),
            limit=limit,
        )
        if symbols:
            req.symbols = symbols

        orders = _trading_client.get_orders(filter=req)
        return [
            {
                "id": str(o.id),
                "symbol": o.symbol,
                "qty": str(o.qty) if o.qty else None,
                "notional": str(o.notional) if o.notional else None,
                "side": str(o.side),
                "type": str(o.type),
                "time_in_force": str(o.time_in_force),
                "status": str(o.status),
                "limit_price": str(o.limit_price) if o.limit_price else None,
                "stop_price": str(o.stop_price) if o.stop_price else None,
                "filled_avg_price": str(o.filled_avg_price) if o.filled_avg_price else None,
                "filled_qty": str(o.filled_qty) if o.filled_qty else None,
                "submitted_at": str(o.submitted_at),
                "filled_at": str(o.filled_at) if o.filled_at else None,
                "created_at": str(o.created_at),
                "order_class": str(o.order_class) if o.order_class else None,
            }
            for o in orders
        ]
    except Exception as e:
        print(f"[Alpaca] get_orders failed: {e}")
        return []


def get_portfolio_history(period: str = "1M", timeframe: str = "1D") -> dict | None:
    """Get portfolio equity history from Alpaca."""
    if not (_alpaca_available and _trading_client):
        return None
    try:
        history = _trading_client.get_portfolio_history(
            history_filter=GetPortfolioHistoryRequest(
                period=period,
                timeframe=timeframe,
            )
        )
        # Build time series from parallel arrays
        points = []
        if history.timestamp and history.equity:
            for i, ts in enumerate(history.timestamp):
                points.append({
                    "timestamp": ts,
                    "equity": history.equity[i] if i < len(history.equity) else None,
                    "profit_loss": history.profit_loss[i] if history.profit_loss and i < len(history.profit_loss) else None,
                    "profit_loss_pct": history.profit_loss_pct[i] if history.profit_loss_pct and i < len(history.profit_loss_pct) else None,
                })
        return {
            "base_value": history.base_value,
            "timeframe": timeframe,
            "points": points,
        }
    except Exception as e:
        print(f"[Alpaca] get_portfolio_history failed: {e}")
        return None


# ---------------------------------------------------------------------------
# Symbol Search / Autocomplete
# ---------------------------------------------------------------------------

_asset_cache: list[dict] | None = None
_asset_cache_time: float = 0

_FALLBACK_SYMBOLS = [
    {"symbol": s, "name": n, "exchange": ""}
    for s, n in [
        ("AAPL", "Apple Inc"), ("MSFT", "Microsoft Corp"), ("GOOGL", "Alphabet Inc"),
        ("GOOG", "Alphabet Inc Class C"), ("AMZN", "Amazon.com Inc"), ("NVDA", "NVIDIA Corp"),
        ("META", "Meta Platforms Inc"), ("TSLA", "Tesla Inc"), ("JPM", "JPMorgan Chase & Co"),
        ("V", "Visa Inc"), ("JNJ", "Johnson & Johnson"), ("WMT", "Walmart Inc"),
        ("PG", "Procter & Gamble Co"), ("MA", "Mastercard Inc"), ("HD", "Home Depot Inc"),
        ("DIS", "Walt Disney Co"), ("BAC", "Bank of America Corp"), ("XOM", "Exxon Mobil Corp"),
        ("COST", "Costco Wholesale Corp"), ("KO", "Coca-Cola Co"), ("PEP", "PepsiCo Inc"),
        ("NFLX", "Netflix Inc"), ("AMD", "Advanced Micro Devices"), ("INTC", "Intel Corp"),
        ("CRM", "Salesforce Inc"), ("ORCL", "Oracle Corp"), ("CSCO", "Cisco Systems Inc"),
        ("ADBE", "Adobe Inc"), ("ACN", "Accenture PLC"), ("TXN", "Texas Instruments"),
        ("QCOM", "Qualcomm Inc"), ("AVGO", "Broadcom Inc"), ("INTU", "Intuit Inc"),
        ("AMAT", "Applied Materials"), ("MU", "Micron Technology"), ("LRCX", "Lam Research"),
        ("PANW", "Palo Alto Networks"), ("SNPS", "Synopsys Inc"), ("CDNS", "Cadence Design"),
        ("MRVL", "Marvell Technology"), ("KLAC", "KLA Corp"), ("PYPL", "PayPal Holdings"),
        ("SQ", "Block Inc"), ("SHOP", "Shopify Inc"), ("UBER", "Uber Technologies"),
        ("ABNB", "Airbnb Inc"), ("COIN", "Coinbase Global"), ("PLTR", "Palantir Technologies"),
        ("NET", "Cloudflare Inc"), ("DDOG", "Datadog Inc"), ("SNOW", "Snowflake Inc"),
        ("SPY", "SPDR S&P 500 ETF"), ("QQQ", "Invesco QQQ Trust"),
        ("IWM", "iShares Russell 2000 ETF"), ("DIA", "SPDR Dow Jones ETF"),
        ("GLD", "SPDR Gold Shares"), ("SLV", "iShares Silver Trust"),
        ("T", "AT&T Inc"), ("VZ", "Verizon Communications"), ("TMUS", "T-Mobile US"),
        ("UNH", "UnitedHealth Group"), ("PFE", "Pfizer Inc"), ("MRK", "Merck & Co"),
        ("ABBV", "AbbVie Inc"), ("LLY", "Eli Lilly & Co"), ("TMO", "Thermo Fisher Scientific"),
        ("ABT", "Abbott Laboratories"), ("DHR", "Danaher Corp"), ("BMY", "Bristol-Myers Squibb"),
        ("AMGN", "Amgen Inc"), ("GILD", "Gilead Sciences"), ("ISRG", "Intuitive Surgical"),
        ("BA", "Boeing Co"), ("CAT", "Caterpillar Inc"), ("DE", "Deere & Co"),
        ("GE", "GE Aerospace"), ("HON", "Honeywell International"), ("LMT", "Lockheed Martin"),
        ("RTX", "RTX Corp"), ("UPS", "United Parcel Service"), ("FDX", "FedEx Corp"),
        ("WM", "Waste Management"), ("GS", "Goldman Sachs"), ("MS", "Morgan Stanley"),
        ("C", "Citigroup Inc"), ("BLK", "BlackRock Inc"), ("SCHW", "Charles Schwab"),
        ("AXP", "American Express"), ("USB", "US Bancorp"), ("PNC", "PNC Financial"),
        ("F", "Ford Motor Co"), ("GM", "General Motors"), ("RIVN", "Rivian Automotive"),
        ("NKE", "Nike Inc"), ("SBUX", "Starbucks Corp"), ("MCD", "McDonald's Corp"),
        ("CMG", "Chipotle Mexican Grill"), ("LOW", "Lowe's Companies"),
        ("TGT", "Target Corp"), ("AMZN", "Amazon.com Inc"),
    ]
]


def _load_asset_list() -> list[dict]:
    """Load all tradeable US equity assets from Alpaca, or fallback to static list."""
    if _alpaca_available and _trading_client:
        try:
            from alpaca.trading.enums import AssetStatus
            req = GetAssetsRequest(
                asset_class=AssetClass.US_EQUITY,
                status=AssetStatus.ACTIVE,
            )
            assets = _trading_client.get_all_assets(req)
            result = [
                {"symbol": a.symbol, "name": a.name or a.symbol, "exchange": str(a.exchange) if a.exchange else ""}
                for a in assets
                if a.tradable and a.symbol.isalpha()
            ]
            if result:
                print(f"[Alpaca] Loaded {len(result)} tradeable assets for search")
                return result
        except Exception as e:
            print(f"[Alpaca] Asset list fetch failed: {e}, using fallback")

    return _FALLBACK_SYMBOLS


def search_assets(query: str, limit: int = 10) -> list[dict]:
    """Search for tradeable assets matching a partial symbol or name."""
    global _asset_cache, _asset_cache_time

    now = time.time()
    if _asset_cache is None or (now - _asset_cache_time) > 86400:
        _asset_cache = _load_asset_list()
        _asset_cache_time = now

    query = query.upper().strip()
    if not query:
        return []

    prefix_matches = []
    contains_matches = []
    for asset in _asset_cache:
        if asset["symbol"].startswith(query):
            prefix_matches.append(asset)
        elif query in asset["name"].upper():
            contains_matches.append(asset)

    results = prefix_matches + contains_matches
    return results[:limit]
