"""FastAPI server — REST API for the trading signal dashboard."""

import os
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, Query, Body
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

from config import (
    SERVER_HOST, SERVER_PORT,
    AUTH_USERNAME, AUTH_PASSWORD, JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_HOURS,
    WATCHLIST, CACHE_TTL_SECONDS, DEFAULT_PERIOD, FINNHUB_API_KEY,
    REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET,
)
from database import (
    init_db, get_watchlist, add_to_watchlist, remove_from_watchlist,
    seed_default_watchlist, log_signal, get_signal_history,
    create_paper_trade, close_paper_trade, get_paper_trades,
    get_paper_equity_curve,
    get_stock_notes, save_stock_notes,
    get_all_tags, create_tag, delete_tag,
    get_symbol_tags, add_tag_to_symbol, remove_tag_from_symbol,
    get_watchlist_with_tags, seed_default_tags,
    init_quick_log_table, add_quick_log, get_quick_logs,
    update_quick_log_status, delete_quick_log,
    init_baskets_tables, seed_default_baskets, get_all_baskets,
    create_basket, update_basket, delete_basket,
    init_discover_tables, seed_default_settings,
    get_all_settings, get_setting, update_setting, update_settings,
    save_congress_trades, get_congress_trades, get_congress_last_fetch,
    save_social_mentions, get_social_mentions, get_social_last_scan,
    save_options_flow, get_options_flow, get_options_last_scan,
    record_matchmaker_swipe, get_matchmaker_dismissed, get_matchmaker_history,
)
from alpaca_client import (
    get_cached_snapshots, validate_symbol, is_alpaca_available,
    search_assets,
    get_account as alpaca_get_account,
    get_positions as alpaca_get_positions,
    submit_order as alpaca_submit_order,
    close_position as alpaca_close_position,
    get_orders as alpaca_get_orders,
    get_portfolio_history as alpaca_get_portfolio_history,
)
from data_fetcher import fetch_stock_data
from indicators import add_all_indicators, get_signal_summary
from backtest_signals import (
    backtest_symbol, ALL_SIGNAL_FINDERS, ALL_COMBINED_SIGNAL_FINDERS,
    simulate_trades,
)


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    init_db()
    init_quick_log_table()
    init_baskets_tables()
    init_discover_tables()
    seed_default_watchlist(WATCHLIST)
    seed_default_tags()
    seed_default_baskets()
    seed_default_settings()
    print(f"[Server] Database initialized")
    print(f"[Server] Alpaca: {'connected' if is_alpaca_available() else 'not configured (using yfinance)'}")

    # Start background scheduler for social/options scans
    scheduler = _start_scheduler()

    yield

    # Shutdown
    if scheduler:
        scheduler.shutdown(wait=False)


app = FastAPI(
    title="Trading Signal Dashboard",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url=None,
)

# Serve frontend files
frontend_dir = Path(__file__).parent.parent / "frontend"
if frontend_dir.exists():
    app.mount("/static", StaticFiles(directory=str(frontend_dir)), name="static")


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    from starlette.responses import RedirectResponse
    return RedirectResponse(url="/static/favicon.svg", status_code=301)


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------

security = HTTPBearer(auto_error=False)


def create_token(username: str) -> str:
    """Create a JWT token."""
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)
    return jwt.encode(
        {"sub": username, "exp": expire},
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Verify JWT token and return username."""
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(
            credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM]
        )
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")
        return username
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


@app.post("/api/login")
async def login(body: dict = Body(...)):
    """Login with username/password, returns JWT token."""
    username = body.get("username", "")
    password = body.get("password", "")
    if username == AUTH_USERNAME and password == AUTH_PASSWORD:
        token = create_token(username)
        return {"token": token, "username": username, "expires_hours": JWT_EXPIRE_HOURS}
    raise HTTPException(status_code=401, detail="Invalid credentials")


# ---------------------------------------------------------------------------
# Pages (serve index.html for all frontend routes)
# ---------------------------------------------------------------------------

@app.get("/")
async def root():
    return FileResponse(str(frontend_dir / "index.html"))


@app.get("/login")
async def login_page():
    return FileResponse(str(frontend_dir / "index.html"))


# ---------------------------------------------------------------------------
# Watchlist API
# ---------------------------------------------------------------------------

@app.get("/api/watchlist")
async def api_get_watchlist(user: str = Depends(verify_token)):
    """Get watchlist with live price data."""
    symbols = get_watchlist()
    if not symbols:
        return {"symbols": [], "data": {}}

    snapshots = get_cached_snapshots(symbols, ttl=CACHE_TTL_SECONDS)

    # Compute quick signal summary for each symbol
    enriched = {}
    for symbol in symbols:
        snap = snapshots.get(symbol, {})
        signal_data = _get_quick_signals(symbol)
        enriched[symbol] = {
            **snap,
            "symbol": symbol,
            **signal_data,
        }

    return {"symbols": symbols, "data": enriched}


@app.post("/api/watchlist")
async def api_add_to_watchlist(body: dict = Body(...),
                                user: str = Depends(verify_token)):
    """Add a symbol to the watchlist."""
    symbol = body.get("symbol", "").upper().strip()
    if not symbol:
        raise HTTPException(status_code=400, detail="Symbol is required")

    # Validate symbol
    asset = validate_symbol(symbol)
    if not asset:
        raise HTTPException(status_code=400, detail=f"Invalid symbol: {symbol}")

    added = add_to_watchlist(symbol)
    if not added:
        raise HTTPException(status_code=409, detail=f"{symbol} already in watchlist")

    return {"symbol": symbol, "name": asset.get("name", symbol), "added": True}


@app.delete("/api/watchlist/{symbol}")
async def api_remove_from_watchlist(symbol: str,
                                     user: str = Depends(verify_token)):
    """Remove a symbol from the watchlist."""
    removed = remove_from_watchlist(symbol.upper())
    if not removed:
        raise HTTPException(status_code=404, detail=f"{symbol} not in watchlist")
    return {"symbol": symbol.upper(), "removed": True}


@app.get("/api/symbols/search")
async def api_search_symbols(
    q: str = Query("", min_length=1, max_length=10),
    limit: int = Query(10, ge=1, le=50),
    user: str = Depends(verify_token),
):
    """Search for symbols by partial ticker or company name."""
    return search_assets(q, limit=limit)


# ---------------------------------------------------------------------------
# Stock data API
# ---------------------------------------------------------------------------

@app.get("/api/stock/{symbol}")
async def api_get_stock(symbol: str,
                         period: str = Query("6mo", regex="^(1mo|3mo|6mo|1y|2y)$"),
                         user: str = Depends(verify_token)):
    """Get full stock data: OHLCV + indicators + signals."""
    symbol = symbol.upper()
    try:
        # Always fetch extra data for indicator warmup (SMA50 needs ~50 bars)
        # then trim to the requested period after computing indicators
        WARMUP_PERIODS = {"1mo": "6mo", "3mo": "1y", "6mo": "1y", "1y": "2y", "2y": "5y"}
        fetch_period = WARMUP_PERIODS.get(period, period)
        df = fetch_stock_data(symbol, period=fetch_period)
        df = add_all_indicators(df)
        df = df.dropna(subset=["sma_long", "rsi", "macd", "bb_lower"])

        # Trim to the requested display period
        PERIOD_DAYS = {"1mo": 30, "3mo": 90, "6mo": 180, "1y": 365, "2y": 730}
        display_days = PERIOD_DAYS.get(period, 180)
        if len(df) > display_days:
            df = df.iloc[-display_days:]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch {symbol}: {e}")

    summary = get_signal_summary(df)

    # Convert OHLCV to JSON-serializable format for charting
    ohlcv = []
    for date, row in df.iterrows():
        ohlcv.append({
            "time": date.strftime("%Y-%m-%d"),
            "open": round(row["Open"], 2),
            "high": round(row["High"], 2),
            "low": round(row["Low"], 2),
            "close": round(row["Close"], 2),
            "volume": int(row["Volume"]),
        })

    # Indicator time series for overlays
    indicators = {
        "sma_short": [],
        "sma_long": [],
        "bb_upper": [],
        "bb_lower": [],
        "bb_middle": [],
        "ema_9": [],
        "rsi": [],
        "macd": [],
        "macd_signal": [],
        "macd_histogram": [],
        "volume_ratio": [],
        "adx": [],
        "obv": [],
    }

    for date, row in df.iterrows():
        t = date.strftime("%Y-%m-%d")
        for key in indicators:
            val = row.get(key)
            if val is not None and not (isinstance(val, float) and val != val):
                indicators[key].append({"time": t, "value": round(float(val), 4)})

    return {
        "symbol": symbol,
        "period": period,
        "ohlcv": ohlcv,
        "indicators": indicators,
        "summary": summary,
    }


@app.get("/api/stock/{symbol}/signals")
async def api_get_stock_signals(symbol: str,
                                 days: int = Query(30, ge=1, le=365),
                                 user: str = Depends(verify_token)):
    """Get signal history for a specific symbol."""
    return get_signal_history(symbol.upper(), days=days)


# ---------------------------------------------------------------------------
# Signals API
# ---------------------------------------------------------------------------

@app.get("/api/signals/today")
async def api_get_signals_today(user: str = Depends(verify_token)):
    """Scan all watchlist symbols for signals that fired recently."""
    symbols = get_watchlist()
    all_signals = []

    for symbol in symbols:
        try:
            signals = _scan_signals_for_symbol(symbol)
            all_signals.extend(signals)
        except Exception as e:
            print(f"[Signals] Error scanning {symbol}: {e}")

    # Sort by date descending
    all_signals.sort(key=lambda s: s.get("date", ""), reverse=True)
    return all_signals


@app.get("/api/signals/scan")
async def api_scan_signals(days: int = Query(5, ge=1, le=30),
                            user: str = Depends(verify_token)):
    """Scan all watchlist symbols for signals in the last N days."""
    symbols = get_watchlist()
    all_signals = []

    for symbol in symbols:
        try:
            signals = _scan_signals_for_symbol(symbol, lookback_days=days)
            all_signals.extend(signals)
        except Exception as e:
            print(f"[Signals] Error scanning {symbol}: {e}")

    all_signals.sort(key=lambda s: s.get("date", ""), reverse=True)
    return all_signals


# ---------------------------------------------------------------------------
# Trade Ideas (Actions) API
# ---------------------------------------------------------------------------

@app.get("/api/actions")
async def api_get_actions(
    days: int = Query(5, ge=1, le=14),
    user: str = Depends(verify_token),
):
    """Get buy/sell/hold recommendations for all watchlist symbols."""
    symbols = get_watchlist()
    results = []

    for symbol in symbols:
        try:
            action_data = _get_action_for_symbol(symbol, lookback_days=days)
            results.append(action_data)
        except Exception as e:
            print(f"[Actions] Error analyzing {symbol}: {e}")

    # Sort: BUY/SELL first (highest confidence), then HOLD
    action_order = {"BUY": 0, "SELL": 0, "HOLD": 2}
    confidence_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    results.sort(key=lambda x: (
        action_order.get(x["action"], 9),
        confidence_order.get(x["confidence"], 9),
    ))

    return results


# ---------------------------------------------------------------------------
# Backtest API
# ---------------------------------------------------------------------------

@app.get("/api/backtest/{symbol}")
async def api_backtest(symbol: str,
                        period: str = Query("1y", regex="^(3mo|6mo|1y|2y)$"),
                        include_bearish: bool = Query(True),
                        user: str = Depends(verify_token)):
    """Run the signal backtester for a symbol and return structured results."""
    symbol = symbol.upper()
    try:
        df = fetch_stock_data(symbol, period=period)
        df = add_all_indicators(df)
        df = df.dropna(subset=["sma_long", "rsi", "macd", "bb_lower"])
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Backtest failed for {symbol}: {e}")

    buy_hold_pct = ((df.iloc[-1]["Close"] - df.iloc[0]["Close"]) / df.iloc[0]["Close"]) * 100

    finders = ALL_COMBINED_SIGNAL_FINDERS if include_bearish else ALL_SIGNAL_FINDERS
    all_trades = []
    for finder in finders:
        signals = finder(df)
        if signals:
            trades = simulate_trades(df, signals)
            all_trades.extend(trades)

    # Serialize trades
    serialized = []
    for t in all_trades:
        serialized.append({
            "entry_date": str(t["entry_date"].date()) if hasattr(t["entry_date"], "date") else t["entry_date"],
            "exit_date": str(t["exit_date"].date()) if hasattr(t["exit_date"], "date") else t["exit_date"],
            "signal": t["signal"],
            "direction": t.get("direction", "long"),
            "entry_price": t["entry_price"],
            "exit_price": t["exit_price"],
            "pnl_pct": t["pnl_pct"],
            "exit_reason": t["exit_reason"],
            "sl_pct": t["sl_pct"],
            "tp_pct": t["tp_pct"],
        })

    # Compute summary stats
    if all_trades:
        total_pnl = sum(t["pnl_pct"] for t in all_trades)
        avg_pnl = total_pnl / len(all_trades)
        wins = len([t for t in all_trades if t["pnl_pct"] > 0])
        win_rate = wins / len(all_trades) * 100
        long_trades = [t for t in all_trades if t.get("direction", "long") == "long"]
        short_trades = [t for t in all_trades if t.get("direction") == "short"]
    else:
        total_pnl = avg_pnl = win_rate = 0
        long_trades = short_trades = []

    # Equity curve — deduplicate by date (LightweightCharts requires unique timestamps)
    equity = []
    cumulative = 0
    for t in sorted(serialized, key=lambda x: x["exit_date"]):
        cumulative += t["pnl_pct"]
        equity.append({
            "date": t["exit_date"],
            "pnl": t["pnl_pct"],
            "cumulative": round(cumulative, 2),
        })
    seen = {}
    for point in equity:
        seen[point["date"]] = point
    equity = list(seen.values())

    return {
        "symbol": symbol,
        "period": period,
        "buy_hold_pct": round(buy_hold_pct, 2),
        "total_trades": len(all_trades),
        "long_trades": len(long_trades),
        "short_trades": len(short_trades),
        "win_rate": round(win_rate, 1),
        "avg_pnl": round(avg_pnl, 2),
        "total_pnl": round(total_pnl, 2),
        "edge": round(total_pnl - buy_hold_pct, 2),
        "trades": serialized,
        "equity_curve": equity,
    }


# ---------------------------------------------------------------------------
# Trade Calculator API
# ---------------------------------------------------------------------------

@app.post("/api/calculator/trade")
async def api_calculator_trade(body: dict = Body(...),
                                user: str = Depends(verify_token)):
    """Calculate historical what-if trade results."""
    symbol = body.get("symbol", "").upper().strip()
    entry_date = body.get("entry_date", "")
    exit_date = body.get("exit_date", "")
    amount = body.get("amount")
    amount_type = body.get("amount_type", "dollars")

    # Validate inputs
    if not symbol:
        raise HTTPException(status_code=400, detail="Symbol is required")
    if not entry_date or not exit_date:
        raise HTTPException(status_code=400, detail="Both entry_date and exit_date are required")
    if amount is None or float(amount) <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")
    if amount_type not in ("dollars", "shares"):
        raise HTTPException(status_code=400, detail="amount_type must be 'dollars' or 'shares'")

    try:
        entry_dt = datetime.strptime(entry_date, "%Y-%m-%d")
        exit_dt = datetime.strptime(exit_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Dates must be in YYYY-MM-DD format")

    if entry_dt >= exit_dt:
        raise HTTPException(status_code=400, detail="Entry date must be before exit date")

    amount = float(amount)

    # Fetch historical data via yfinance
    try:
        import yfinance as yf
        # Add buffer days to account for weekends/holidays
        start_with_buffer = entry_dt - timedelta(days=5)
        end_with_buffer = exit_dt + timedelta(days=5)  # yfinance end is exclusive
        df = yf.download(symbol, start=start_with_buffer.strftime("%Y-%m-%d"),
                         end=end_with_buffer.strftime("%Y-%m-%d"), progress=False)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch data for {symbol}: {e}")

    if df is None or df.empty:
        raise HTTPException(status_code=400, detail=f"No data found for {symbol}")

    # Strip timezone if present
    if df.index.tz is not None:
        df.index = df.index.tz_localize(None)

    # Handle MultiIndex columns from yfinance (happens with single symbol too)
    import pandas as pd
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    # Find closest trading days to requested dates
    entry_mask = df.index >= entry_dt
    if not entry_mask.any():
        raise HTTPException(status_code=400, detail=f"No trading data on or after {entry_date}")
    actual_entry_idx = df.index[entry_mask][0]

    exit_mask = df.index <= exit_dt
    if not exit_mask.any():
        raise HTTPException(status_code=400, detail=f"No trading data on or before {exit_date}")
    actual_exit_idx = df.index[exit_mask][-1]

    if actual_entry_idx >= actual_exit_idx:
        raise HTTPException(status_code=400, detail="Entry and exit resolve to the same or inverted trading days")

    entry_price = round(float(df.loc[actual_entry_idx, "Close"]), 2)
    exit_price = round(float(df.loc[actual_exit_idx, "Close"]), 2)

    # Calculate trade results
    if amount_type == "dollars":
        shares = amount / entry_price
        entry_value = amount
    else:
        shares = amount
        entry_value = shares * entry_price

    exit_value = shares * exit_price
    pnl_dollars = exit_value - entry_value
    pnl_pct = ((exit_price - entry_price) / entry_price) * 100
    days_held = (actual_exit_idx - actual_entry_idx).days
    if days_held > 0:
        annualized_return = ((exit_price / entry_price) ** (365 / days_held) - 1) * 100
    else:
        annualized_return = 0

    # Build OHLCV for charting (only the trade period)
    trade_df = df.loc[actual_entry_idx:actual_exit_idx]
    ohlcv = []
    for date, row in trade_df.iterrows():
        ohlcv.append({
            "time": date.strftime("%Y-%m-%d"),
            "open": round(float(row["Open"]), 2),
            "high": round(float(row["High"]), 2),
            "low": round(float(row["Low"]), 2),
            "close": round(float(row["Close"]), 2),
            "volume": int(row["Volume"]),
        })

    return {
        "symbol": symbol,
        "entry_date": entry_date,
        "exit_date": exit_date,
        "actual_entry_date": actual_entry_idx.strftime("%Y-%m-%d"),
        "actual_exit_date": actual_exit_idx.strftime("%Y-%m-%d"),
        "entry_price": entry_price,
        "exit_price": exit_price,
        "shares": round(shares, 4),
        "entry_value": round(entry_value, 2),
        "exit_value": round(exit_value, 2),
        "pnl_dollars": round(pnl_dollars, 2),
        "pnl_pct": round(pnl_pct, 2),
        "days_held": days_held,
        "annualized_return": round(annualized_return, 2),
        "ohlcv": ohlcv,
    }


# ---------------------------------------------------------------------------
# LLM Analysis API (optional — requires Ollama)
# ---------------------------------------------------------------------------

@app.post("/api/llm/{symbol}")
async def api_llm_analysis(symbol: str, user: str = Depends(verify_token)):
    """Run on-demand LLM analysis for a symbol."""
    symbol = symbol.upper()
    try:
        from llm_analyst import query_ollama
        from main import format_recent_candles

        df = fetch_stock_data(symbol)
        df = add_all_indicators(df)
        summary = get_signal_summary(df)
        recent_candles = format_recent_candles(df)
        analysis = query_ollama(symbol, summary, recent_candles)
        return {"symbol": symbol, "analysis": analysis, "indicators": summary}
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"LLM analysis failed (is Ollama running?): {e}",
        )


# ---------------------------------------------------------------------------
# Paper Trading API
# ---------------------------------------------------------------------------

@app.get("/api/paper/trades")
async def api_get_paper_trades(
    status: str = Query(None, regex="^(open|closed)$"),
    symbol: str = Query(None),
    user: str = Depends(verify_token),
):
    """Get paper trades."""
    return get_paper_trades(status=status, symbol=symbol)


@app.post("/api/paper/trades")
async def api_create_paper_trade(body: dict = Body(...),
                                  user: str = Depends(verify_token)):
    """Create a new paper trade."""
    required = ["symbol", "direction", "entry_price", "entry_date"]
    for field in required:
        if field not in body:
            raise HTTPException(status_code=400, detail=f"Missing field: {field}")

    trade_id = create_paper_trade(
        symbol=body["symbol"],
        direction=body["direction"],
        entry_price=float(body["entry_price"]),
        entry_date=body["entry_date"],
        signal_name=body.get("signal_name", ""),
        notes=body.get("notes", ""),
    )
    return {"id": trade_id, "created": True}


@app.put("/api/paper/trades/{trade_id}/close")
async def api_close_paper_trade(trade_id: int, body: dict = Body(...),
                                 user: str = Depends(verify_token)):
    """Close an open paper trade."""
    exit_price = body.get("exit_price")
    exit_date = body.get("exit_date", datetime.now().strftime("%Y-%m-%d"))
    exit_reason = body.get("exit_reason", "manual")

    if exit_price is None:
        raise HTTPException(status_code=400, detail="exit_price is required")

    pnl = close_paper_trade(trade_id, float(exit_price), exit_date, exit_reason)
    if pnl is None:
        raise HTTPException(status_code=404, detail="Trade not found")

    return {"id": trade_id, "pnl_pct": pnl, "closed": True}


@app.get("/api/paper/equity")
async def api_paper_equity(user: str = Depends(verify_token)):
    """Get paper trading equity curve."""
    return get_paper_equity_curve()


# ---------------------------------------------------------------------------
# Alpaca Paper Trading API
# ---------------------------------------------------------------------------

@app.get("/api/paper/account")
async def api_paper_account(user: str = Depends(verify_token)):
    """Get Alpaca paper account info."""
    account = alpaca_get_account()
    if account is None:
        raise HTTPException(status_code=503, detail="Alpaca not configured")
    return account


@app.get("/api/paper/positions")
async def api_paper_positions(user: str = Depends(verify_token)):
    """Get all open positions from Alpaca."""
    if not is_alpaca_available():
        raise HTTPException(status_code=503, detail="Alpaca not configured")
    return alpaca_get_positions()


@app.post("/api/paper/orders")
async def api_paper_submit_order(body: dict = Body(...),
                                  user: str = Depends(verify_token)):
    """Submit an order to Alpaca paper trading."""
    if not is_alpaca_available():
        raise HTTPException(status_code=503, detail="Alpaca not configured")

    symbol = body.get("symbol", "").upper().strip()
    if not symbol:
        raise HTTPException(status_code=400, detail="Symbol is required")

    side = body.get("side", "buy")
    if side not in ("buy", "sell"):
        raise HTTPException(status_code=400, detail="Side must be 'buy' or 'sell'")

    order_type = body.get("order_type", "market")
    if order_type not in ("market", "limit", "stop", "stop_limit", "bracket"):
        raise HTTPException(status_code=400, detail="Invalid order type")

    qty = body.get("qty")
    notional = body.get("notional")
    if qty is not None:
        qty = float(qty)
    if notional is not None:
        notional = float(notional)

    if qty is None and notional is None:
        raise HTTPException(status_code=400, detail="Either qty or notional is required")

    try:
        result = alpaca_submit_order(
            symbol=symbol,
            qty=qty,
            notional=notional,
            side=side,
            order_type=order_type,
            time_in_force=body.get("time_in_force", "day"),
            limit_price=float(body["limit_price"]) if body.get("limit_price") else None,
            stop_price=float(body["stop_price"]) if body.get("stop_price") else None,
            take_profit_price=float(body["take_profit_price"]) if body.get("take_profit_price") else None,
            stop_loss_price=float(body["stop_loss_price"]) if body.get("stop_loss_price") else None,
        )
        if result is None:
            raise HTTPException(status_code=400, detail="Order submission failed — check parameters")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/paper/orders/history")
async def api_paper_order_history(
    status: str = Query("all", regex="^(open|closed|all)$"),
    limit: int = Query(50, ge=1, le=200),
    user: str = Depends(verify_token),
):
    """Get order history from Alpaca."""
    if not is_alpaca_available():
        raise HTTPException(status_code=503, detail="Alpaca not configured")
    return alpaca_get_orders(status=status, limit=limit)


@app.delete("/api/paper/positions/{symbol}")
async def api_paper_close_position(symbol: str,
                                    user: str = Depends(verify_token)):
    """Close a position on Alpaca."""
    if not is_alpaca_available():
        raise HTTPException(status_code=503, detail="Alpaca not configured")
    try:
        result = alpaca_close_position(symbol.upper())
        if result is None:
            raise HTTPException(status_code=400, detail="Failed to close position")
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/paper/portfolio-history")
async def api_paper_portfolio_history(
    period: str = Query("1M", regex="^(1D|1W|1M|3M|1A|all)$"),
    timeframe: str = Query("1D", regex="^(1Min|5Min|15Min|1H|1D)$"),
    user: str = Depends(verify_token),
):
    """Get portfolio equity history from Alpaca."""
    if not is_alpaca_available():
        raise HTTPException(status_code=503, detail="Alpaca not configured")
    result = alpaca_get_portfolio_history(period=period, timeframe=timeframe)
    if result is None:
        raise HTTPException(status_code=503, detail="Failed to fetch portfolio history")
    return result


# ---------------------------------------------------------------------------
# Config API
# ---------------------------------------------------------------------------

@app.get("/api/config")
async def api_get_config(user: str = Depends(verify_token)):
    """Get current system config (non-sensitive)."""
    return {
        "alpaca_connected": is_alpaca_available(),
        "data_source": "alpaca" if is_alpaca_available() else "yfinance",
        "cache_ttl_seconds": CACHE_TTL_SECONDS,
        "default_period": DEFAULT_PERIOD,
        "finnhub_available": bool(FINNHUB_API_KEY),
    }


# ---------------------------------------------------------------------------
# Tags API
# ---------------------------------------------------------------------------

@app.get("/api/tags")
async def api_get_tags(user: str = Depends(verify_token)):
    """Get all tags."""
    return get_all_tags()


@app.post("/api/tags")
async def api_create_tag(body: dict = Body(...), user: str = Depends(verify_token)):
    """Create a custom tag."""
    name = body.get("name", "").strip()
    color = body.get("color", "#4a9eff").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Tag name is required")
    tag = create_tag(name, color)
    if tag is None:
        raise HTTPException(status_code=409, detail=f"Tag '{name}' already exists")
    return tag


@app.delete("/api/tags/{tag_id}")
async def api_delete_tag(tag_id: int, user: str = Depends(verify_token)):
    """Delete a custom tag."""
    deleted = delete_tag(tag_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Tag not found or is a default tag")
    return {"deleted": True}


@app.get("/api/watchlist/{symbol}/tags")
async def api_get_symbol_tags(symbol: str, user: str = Depends(verify_token)):
    """Get tags for a symbol."""
    return get_symbol_tags(symbol.upper())


@app.post("/api/watchlist/{symbol}/tags")
async def api_add_symbol_tag(symbol: str, body: dict = Body(...),
                              user: str = Depends(verify_token)):
    """Add a tag to a symbol."""
    tag_id = body.get("tag_id")
    if tag_id is None:
        raise HTTPException(status_code=400, detail="tag_id is required")
    added = add_tag_to_symbol(symbol.upper(), int(tag_id))
    if not added:
        raise HTTPException(status_code=409, detail="Tag already assigned")
    return {"added": True}


@app.delete("/api/watchlist/{symbol}/tags/{tag_id}")
async def api_remove_symbol_tag(symbol: str, tag_id: int,
                                 user: str = Depends(verify_token)):
    """Remove a tag from a symbol."""
    removed = remove_tag_from_symbol(symbol.upper(), tag_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Tag assignment not found")
    return {"removed": True}


# ---------------------------------------------------------------------------
# Stock Notes API
# ---------------------------------------------------------------------------

@app.get("/api/stock/{symbol}/notes")
async def api_get_stock_notes(symbol: str, user: str = Depends(verify_token)):
    """Get notes for a stock."""
    notes = get_stock_notes(symbol.upper())
    if notes is None:
        return {"symbol": symbol.upper(), "content": "", "updated_at": None}
    return notes


@app.put("/api/stock/{symbol}/notes")
async def api_save_stock_notes(symbol: str, body: dict = Body(...),
                                user: str = Depends(verify_token)):
    """Save or update notes for a stock."""
    content = body.get("content", "")
    return save_stock_notes(symbol.upper(), content)


# ---------------------------------------------------------------------------
# Position Sizing Calculator API
# ---------------------------------------------------------------------------

@app.post("/api/position-size")
async def api_position_size(body: dict = Body(...),
                             user: str = Depends(verify_token)):
    """Calculate position size based on account size, risk %, and ATR."""
    account_size = float(body.get("account_size", 0))
    risk_pct = float(body.get("risk_pct", 2.0))
    symbol = body.get("symbol", "").upper().strip()

    if account_size <= 0:
        raise HTTPException(status_code=400, detail="Account size must be greater than 0")
    if not symbol:
        raise HTTPException(status_code=400, detail="Symbol is required")

    try:
        df = fetch_stock_data(symbol, period="3mo")
        df = add_all_indicators(df)
        df = df.dropna(subset=["atr"])
        latest = df.iloc[-1]

        entry_price = round(float(latest["Close"]), 2)
        atr = round(float(latest["atr"]), 2)
        stop_loss_distance = round(atr * 1.5, 2)
        take_profit_distance = round(atr * 2.5, 2)
        stop_loss_price = round(entry_price - stop_loss_distance, 2)
        take_profit_price = round(entry_price + take_profit_distance, 2)

        risk_dollars = round(account_size * (risk_pct / 100), 2)
        shares = int(risk_dollars / stop_loss_distance) if stop_loss_distance > 0 else 0
        position_value = round(shares * entry_price, 2)

        return {
            "symbol": symbol,
            "entry_price": entry_price,
            "atr": atr,
            "stop_loss_distance": stop_loss_distance,
            "stop_loss_price": stop_loss_price,
            "take_profit_distance": take_profit_distance,
            "take_profit_price": take_profit_price,
            "account_size": account_size,
            "risk_pct": risk_pct,
            "risk_dollars": risk_dollars,
            "shares": shares,
            "position_value": position_value,
            "position_pct": round((position_value / account_size) * 100, 1) if account_size > 0 else 0,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to calculate: {e}")


# ---------------------------------------------------------------------------
# Fundamentals API (via yfinance)
# ---------------------------------------------------------------------------

@app.get("/api/stock/{symbol}/fundamentals")
async def api_get_fundamentals(symbol: str, user: str = Depends(verify_token)):
    """Get fundamental data for a stock using yfinance."""
    symbol = symbol.upper()
    try:
        import yfinance as yf
        ticker = yf.Ticker(symbol)
        info = ticker.info or {}

        return {
            "symbol": symbol,
            "name": info.get("longName") or info.get("shortName", symbol),
            "sector": info.get("sector", "N/A"),
            "industry": info.get("industry", "N/A"),
            "market_cap": info.get("marketCap"),
            "pe_ratio": info.get("trailingPE"),
            "forward_pe": info.get("forwardPE"),
            "eps": info.get("trailingEps"),
            "peg_ratio": info.get("pegRatio"),
            "debt_to_equity": info.get("debtToEquity"),
            "free_cash_flow": info.get("freeCashflow"),
            "dividend_yield": info.get("dividendYield"),
            "revenue": info.get("totalRevenue"),
            "profit_margin": info.get("profitMargins"),
            "return_on_equity": info.get("returnOnEquity"),
            "beta": info.get("beta"),
            "fifty_two_week_high": info.get("fiftyTwoWeekHigh"),
            "fifty_two_week_low": info.get("fiftyTwoWeekLow"),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch fundamentals: {e}")


# ---------------------------------------------------------------------------
# Earnings Calendar API (via Finnhub)
# ---------------------------------------------------------------------------

@app.get("/api/stock/{symbol}/earnings")
async def api_get_earnings(symbol: str, user: str = Depends(verify_token)):
    """Check upcoming earnings for a symbol using Finnhub."""
    symbol = symbol.upper()
    if not FINNHUB_API_KEY:
        return {"symbol": symbol, "upcoming": None, "warning": False,
                "message": "Finnhub API key not configured"}

    try:
        import requests as req
        today = datetime.now().strftime("%Y-%m-%d")
        future = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

        resp = req.get(
            "https://finnhub.io/api/v1/calendar/earnings",
            params={"from": today, "to": future, "symbol": symbol,
                    "token": FINNHUB_API_KEY},
            timeout=10,
        )
        data = resp.json()
        earnings = data.get("earningsCalendar", [])

        if earnings:
            next_earning = earnings[0]
            earnings_date = next_earning.get("date", "")
            days_until = (datetime.strptime(earnings_date, "%Y-%m-%d") - datetime.now()).days
            return {
                "symbol": symbol,
                "upcoming": {
                    "date": earnings_date,
                    "days_until": days_until,
                    "estimate_eps": next_earning.get("epsEstimate"),
                    "hour": next_earning.get("hour", ""),
                },
                "warning": days_until <= 7,
                "message": f"Earnings in {days_until} days ({earnings_date})" if days_until <= 7 else None,
            }
        return {"symbol": symbol, "upcoming": None, "warning": False}
    except Exception as e:
        return {"symbol": symbol, "upcoming": None, "warning": False,
                "error": str(e)}


# ---------------------------------------------------------------------------
# News Feed API (via Finnhub + VADER sentiment)
# ---------------------------------------------------------------------------

@app.get("/api/stock/{symbol}/news")
async def api_get_stock_news(symbol: str,
                              days: int = Query(7, ge=1, le=30),
                              user: str = Depends(verify_token)):
    """Get news for a stock with sentiment analysis."""
    symbol = symbol.upper()
    if not FINNHUB_API_KEY:
        return {"symbol": symbol, "articles": [], "sentiment": None,
                "message": "Finnhub API key not configured"}

    try:
        import requests as req
        today = datetime.now().strftime("%Y-%m-%d")
        from_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

        resp = req.get(
            "https://finnhub.io/api/v1/company-news",
            params={"symbol": symbol, "from": from_date, "to": today,
                    "token": FINNHUB_API_KEY},
            timeout=10,
        )
        articles = resp.json() or []

        # Limit to 50 most recent
        articles = articles[:50]

        # Sentiment analysis using VADER
        sentiment_scores = []
        try:
            from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
            analyzer = SentimentIntensityAnalyzer()
            for article in articles:
                headline = article.get("headline", "")
                summary_text = article.get("summary", "")
                text = f"{headline}. {summary_text}" if summary_text else headline
                scores = analyzer.polarity_scores(text)
                article["sentiment"] = {
                    "compound": round(scores["compound"], 3),
                    "label": "bullish" if scores["compound"] > 0.1 else "bearish" if scores["compound"] < -0.1 else "neutral",
                }
                sentiment_scores.append(scores["compound"])
        except ImportError:
            for article in articles:
                article["sentiment"] = None

        # Aggregate sentiment
        avg_sentiment = round(sum(sentiment_scores) / len(sentiment_scores), 3) if sentiment_scores else 0
        sentiment_label = "bullish" if avg_sentiment > 0.1 else "bearish" if avg_sentiment < -0.1 else "neutral"

        formatted = []
        for a in articles:
            formatted.append({
                "headline": a.get("headline", ""),
                "summary": a.get("summary", ""),
                "source": a.get("source", ""),
                "url": a.get("url", ""),
                "image": a.get("image", ""),
                "datetime": a.get("datetime", 0),
                "sentiment": a.get("sentiment"),
            })

        return {
            "symbol": symbol,
            "articles": formatted,
            "sentiment": {
                "score": avg_sentiment,
                "label": sentiment_label,
                "count": len(sentiment_scores),
                "bullish": len([s for s in sentiment_scores if s > 0.1]),
                "bearish": len([s for s in sentiment_scores if s < -0.1]),
                "neutral": len([s for s in sentiment_scores if -0.1 <= s <= 0.1]),
            },
        }
    except Exception as e:
        return {"symbol": symbol, "articles": [], "sentiment": None, "error": str(e)}


# ---------------------------------------------------------------------------
# Insider Trading API (via OpenInsider scraping)
# ---------------------------------------------------------------------------

@app.get("/api/stock/{symbol}/insider")
async def api_get_insider_trades(symbol: str, user: str = Depends(verify_token)):
    """Get recent insider trading activity by scraping OpenInsider."""
    symbol = symbol.upper()
    try:
        import requests as req
        from bs4 import BeautifulSoup

        resp = req.get(
            f"http://openinsider.com/screener?s={symbol}&o=&pl=&ph=&st=0&tdlt=&tdr=&tdfd=&tdfm=&tdfy=&tdt=&tdtm=&tdty=&f=&cnt=20",
            timeout=10,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        soup = BeautifulSoup(resp.text, "lxml")
        table = soup.find("table", {"class": "tinytable"})

        if not table:
            return {"symbol": symbol, "trades": [], "summary": None}

        rows = table.find_all("tr")[1:]  # Skip header
        trades = []
        total_bought = 0
        total_sold = 0

        for row in rows[:20]:
            cols = row.find_all("td")
            if len(cols) < 12:
                continue
            try:
                filing_date = cols[1].text.strip()
                trade_date = cols[2].text.strip()
                ticker = cols[3].text.strip()
                insider_name = cols[4].text.strip()
                title = cols[5].text.strip()
                trade_type = cols[6].text.strip()
                price = cols[7].text.strip()
                qty = cols[8].text.strip()
                owned = cols[9].text.strip()
                delta_own = cols[10].text.strip()
                value = cols[11].text.strip()

                is_buy = "P" in trade_type.upper() or "Purchase" in trade_type
                trades.append({
                    "filing_date": filing_date,
                    "trade_date": trade_date,
                    "insider": insider_name,
                    "title": title,
                    "type": "Buy" if is_buy else "Sell",
                    "price": price,
                    "qty": qty,
                    "value": value,
                    "owned_after": owned,
                })

                # Parse value for summary
                val_clean = value.replace("$", "").replace(",", "").replace("+", "")
                try:
                    val_num = float(val_clean)
                    if is_buy:
                        total_bought += val_num
                    else:
                        total_sold += val_num
                except ValueError:
                    pass
            except (IndexError, ValueError):
                continue

        summary = {
            "total_bought": round(total_bought, 2),
            "total_sold": round(total_sold, 2),
            "net": round(total_bought - total_sold, 2),
            "signal": "bullish" if total_bought > total_sold else "bearish" if total_sold > total_bought else "neutral",
            "trade_count": len(trades),
        }

        return {"symbol": symbol, "trades": trades, "summary": summary}
    except Exception as e:
        return {"symbol": symbol, "trades": [], "summary": None, "error": str(e)}


# ---------------------------------------------------------------------------
# Quick-Logger API ("Overheard in the Uber")
# ---------------------------------------------------------------------------

@app.post("/api/quick-log")
async def api_add_quick_log(body: dict = Body(...),
                             user: str = Depends(verify_token)):
    """Log a quick ticker idea. Attempts to resolve raw input to a ticker."""
    raw = body.get("input", "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Input is required")

    resolved_ticker = None
    resolved_name = None

    # Try as a ticker symbol first (uppercase, 1-5 chars)
    candidate = raw.upper().replace("$", "").strip()
    if 1 <= len(candidate) <= 5 and candidate.isalpha():
        asset = validate_symbol(candidate)
        if asset:
            resolved_ticker = candidate
            resolved_name = asset.get("name", candidate)

    # If not resolved, try searching by company name
    if not resolved_ticker:
        try:
            results = search_assets(raw, limit=1)
            if results and len(results) > 0:
                resolved_ticker = results[0].get("symbol")
                resolved_name = results[0].get("name")
        except Exception:
            pass

    # If still not resolved, try yfinance as a last resort
    if not resolved_ticker:
        try:
            import yfinance as yf
            ticker = yf.Ticker(candidate if candidate.isalpha() and len(candidate) <= 5 else raw)
            info = ticker.info or {}
            if info.get("symbol"):
                resolved_ticker = info["symbol"]
                resolved_name = info.get("longName") or info.get("shortName")
        except Exception:
            pass

    log_id = add_quick_log(raw, resolved_ticker, resolved_name)
    return {
        "id": log_id,
        "raw_input": raw,
        "resolved_ticker": resolved_ticker,
        "resolved_name": resolved_name,
        "status": "new",
    }


@app.get("/api/quick-log")
async def api_get_quick_logs(
    status: str = Query(None, pattern="^(new|reviewed|added|dismissed)$"),
    user: str = Depends(verify_token),
):
    """Get all quick-log entries."""
    return get_quick_logs(status=status)


@app.delete("/api/quick-log/{log_id}")
async def api_delete_quick_log(log_id: int, user: str = Depends(verify_token)):
    """Delete a quick-log entry."""
    deleted = delete_quick_log(log_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"deleted": True}


@app.post("/api/quick-log/{log_id}/promote")
async def api_promote_quick_log(log_id: int, user: str = Depends(verify_token)):
    """Promote a quick-log entry to the watchlist."""
    logs = get_quick_logs()
    entry = next((l for l in logs if l["id"] == log_id), None)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    ticker = entry.get("resolved_ticker")
    if not ticker:
        raise HTTPException(status_code=400, detail="No resolved ticker to promote")

    added = add_to_watchlist(ticker)
    if not added:
        # Already in watchlist — still mark as added
        pass

    update_quick_log_status(log_id, "added")
    return {"promoted": True, "symbol": ticker}


# ---------------------------------------------------------------------------
# Sector Heatmap API
# ---------------------------------------------------------------------------

SECTOR_ETFS = [
    {"symbol": "XLK", "name": "Technology", "color": "#4a9eff"},
    {"symbol": "XLF", "name": "Financials", "color": "#00d4aa"},
    {"symbol": "XLE", "name": "Energy", "color": "#ffc107"},
    {"symbol": "XLV", "name": "Healthcare", "color": "#a78bfa"},
    {"symbol": "XLC", "name": "Communication", "color": "#ff6b81"},
    {"symbol": "XLY", "name": "Consumer Disc.", "color": "#fd7e14"},
    {"symbol": "XLP", "name": "Consumer Staples", "color": "#17a2b8"},
    {"symbol": "XLI", "name": "Industrials", "color": "#6c757d"},
    {"symbol": "XLB", "name": "Materials", "color": "#20c997"},
    {"symbol": "XLRE", "name": "Real Estate", "color": "#e83e8c"},
    {"symbol": "XLU", "name": "Utilities", "color": "#556478"},
]


@app.get("/api/sectors/performance")
async def api_sector_performance(user: str = Depends(verify_token)):
    """Get daily performance for all 11 GICS sector ETFs."""
    import yfinance as yf

    symbols = [s["symbol"] for s in SECTOR_ETFS]
    sector_map = {s["symbol"]: s for s in SECTOR_ETFS}

    results = []
    try:
        tickers = yf.Tickers(" ".join(symbols))
        for sym in symbols:
            try:
                ticker = tickers.tickers.get(sym)
                if not ticker:
                    continue
                info = ticker.info or {}
                hist = ticker.history(period="2d")
                if hist is None or len(hist) < 2:
                    continue

                prev_close = float(hist.iloc[-2]["Close"])
                curr_close = float(hist.iloc[-1]["Close"])
                change_pct = ((curr_close - prev_close) / prev_close) * 100
                market_cap = info.get("totalAssets") or info.get("marketCap") or 1e9

                meta = sector_map[sym]
                results.append({
                    "symbol": sym,
                    "name": meta["name"],
                    "price": round(curr_close, 2),
                    "change_pct": round(change_pct, 2),
                    "market_cap": market_cap,
                    "color": meta["color"],
                })
            except Exception as e:
                print(f"[Sectors] Error fetching {sym}: {e}")
    except Exception as e:
        print(f"[Sectors] Batch fetch error: {e}")

    return results


# ---------------------------------------------------------------------------
# Baskets API ("Write What You Know")
# ---------------------------------------------------------------------------

@app.get("/api/baskets")
async def api_get_baskets(user: str = Depends(verify_token)):
    """Get all baskets with their tickers."""
    return get_all_baskets()


@app.post("/api/baskets")
async def api_create_basket(body: dict = Body(...),
                             user: str = Depends(verify_token)):
    """Create a new basket."""
    name = body.get("name", "").strip()
    icon = body.get("icon", "📊")
    tickers = body.get("tickers", [])
    if not name:
        raise HTTPException(status_code=400, detail="Basket name is required")
    basket = create_basket(name, icon, tickers)
    if basket is None:
        raise HTTPException(status_code=409, detail=f"Basket '{name}' already exists")
    return basket


@app.put("/api/baskets/{basket_id}")
async def api_update_basket(basket_id: int, body: dict = Body(...),
                             user: str = Depends(verify_token)):
    """Update a basket (name, icon, tickers)."""
    updated = update_basket(
        basket_id,
        name=body.get("name"),
        icon=body.get("icon"),
        tickers=body.get("tickers"),
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Basket not found")
    return {"updated": True}


@app.delete("/api/baskets/{basket_id}")
async def api_delete_basket(basket_id: int, user: str = Depends(verify_token)):
    """Delete a basket."""
    deleted = delete_basket(basket_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Basket not found")
    return {"deleted": True}


@app.get("/api/baskets/{basket_id}/metrics")
async def api_basket_metrics(basket_id: int, user: str = Depends(verify_token)):
    """Get aggregate metrics for a basket's tickers."""
    baskets = get_all_baskets()
    basket = next((b for b in baskets if b["id"] == basket_id), None)
    if not basket:
        raise HTTPException(status_code=404, detail="Basket not found")

    tickers = basket["tickers"]
    if not tickers:
        return {"basket_id": basket_id, "name": basket["name"], "tickers": [], "metrics": {}}

    snapshots = get_cached_snapshots(tickers, ttl=CACHE_TTL_SECONDS)

    ticker_data = []
    rsi_values = []
    adx_values = []
    change_values = []
    trends = []

    for sym in tickers:
        snap = snapshots.get(sym, {})
        sig = _get_quick_signals(sym)
        entry = {
            "symbol": sym,
            "price": snap.get("price"),
            "change_pct": snap.get("change_pct"),
            "rsi": sig.get("rsi"),
            "adx": sig.get("adx"),
            "trend": sig.get("trend"),
            "signals": sig.get("signals", []),
        }
        ticker_data.append(entry)

        if sig.get("rsi") is not None:
            rsi_values.append(sig["rsi"])
        if sig.get("adx") is not None:
            adx_values.append(sig["adx"])
        if snap.get("change_pct") is not None:
            change_values.append(snap["change_pct"])
        if sig.get("trend"):
            trends.append(sig["trend"])

    # Aggregate metrics
    avg_rsi = round(sum(rsi_values) / len(rsi_values), 1) if rsi_values else None
    avg_adx = round(sum(adx_values) / len(adx_values), 1) if adx_values else None
    avg_change = round(sum(change_values) / len(change_values), 2) if change_values else None

    # Trend consensus
    bullish = trends.count("bullish")
    bearish = trends.count("bearish")
    if bullish > bearish:
        consensus = "bullish"
    elif bearish > bullish:
        consensus = "bearish"
    else:
        consensus = "neutral"

    return {
        "basket_id": basket_id,
        "name": basket["name"],
        "icon": basket["icon"],
        "tickers": ticker_data,
        "metrics": {
            "avg_rsi": avg_rsi,
            "avg_adx": avg_adx,
            "avg_change": avg_change,
            "trend_consensus": consensus,
            "bullish_count": bullish,
            "bearish_count": bearish,
            "total_signals": sum(len(t.get("signals", [])) for t in ticker_data),
        },
    }


# ---------------------------------------------------------------------------
# Screener API
# ---------------------------------------------------------------------------

@app.get("/api/screener")
async def api_screener(
    max_price: float = Query(None),
    min_price: float = Query(None),
    max_rsi: float = Query(None),
    min_rsi: float = Query(None),
    min_adx: float = Query(None),
    trend: str = Query(None, regex="^(bullish|bearish)$"),
    min_volume_ratio: float = Query(None),
    has_signals: bool = Query(None),
    user: str = Depends(verify_token),
):
    """Screen watchlist stocks by criteria."""
    symbols = get_watchlist()
    results = []

    snapshots = get_cached_snapshots(symbols, ttl=CACHE_TTL_SECONDS)

    for symbol in symbols:
        try:
            signal_data = _get_quick_signals(symbol)
            snap = snapshots.get(symbol, {})
            price = snap.get("price")

            if price is None:
                continue

            # Apply filters
            if max_price is not None and price > max_price:
                continue
            if min_price is not None and price < min_price:
                continue
            if max_rsi is not None and signal_data.get("rsi") is not None and signal_data["rsi"] > max_rsi:
                continue
            if min_rsi is not None and signal_data.get("rsi") is not None and signal_data["rsi"] < min_rsi:
                continue
            if min_adx is not None and signal_data.get("adx") is not None and signal_data["adx"] < min_adx:
                continue
            if trend is not None and signal_data.get("trend") != trend:
                continue
            if min_volume_ratio is not None and signal_data.get("volume_ratio") is not None and signal_data.get("volume_ratio", 0) < min_volume_ratio:
                continue
            if has_signals is True and not signal_data.get("signals"):
                continue

            results.append({
                "symbol": symbol,
                **snap,
                **signal_data,
            })
        except Exception as e:
            print(f"[Screener] Error scanning {symbol}: {e}")

    return results


# ---------------------------------------------------------------------------
# Discover — Congressional Trades API
# ---------------------------------------------------------------------------

@app.get("/api/discover/congress")
async def api_discover_congress(
    ticker: str = Query(None),
    refresh: bool = Query(False),
    user: str = Depends(verify_token),
):
    """Get congressional stock trades. Scrapes if cache is stale or refresh=True."""
    import asyncio
    from discovery import fetch_congress_trades, aggregate_congress_trades

    last_fetch = get_congress_last_fetch()
    cache_stale = True
    if last_fetch:
        try:
            fetched_dt = datetime.fromisoformat(last_fetch)
            cache_stale = (datetime.now(timezone.utc) - fetched_dt).total_seconds() > 3600
        except (ValueError, TypeError):
            cache_stale = True

    if refresh or cache_stale:
        try:
            trades = await asyncio.get_event_loop().run_in_executor(
                None, lambda: fetch_congress_trades(pages=3)
            )
            if trades:
                save_congress_trades(trades)
        except Exception as e:
            print(f"[Congress] Fetch error: {e}")

    trades = get_congress_trades(ticker=ticker)
    summary = aggregate_congress_trades(trades)

    return {
        "trades": trades,
        "summary": summary,
        "last_updated": get_congress_last_fetch(),
    }


# ---------------------------------------------------------------------------
# Discover — Market-wide Insider Scan API
# ---------------------------------------------------------------------------

@app.get("/api/discover/insider-scan")
async def api_discover_insider_scan(
    min_value: float = Query(100000),
    user: str = Depends(verify_token),
):
    """Scan OpenInsider for notable insider buys across the whole market."""
    import asyncio
    from discovery import scan_insider_market_wide, aggregate_insider_scan

    trades = await asyncio.get_event_loop().run_in_executor(
        None, lambda: scan_insider_market_wide(min_value=min_value)
    )
    summary = aggregate_insider_scan(trades)

    return {
        "trades": trades,
        "summary": summary,
    }


# ---------------------------------------------------------------------------
# Discover — Social Momentum API
# ---------------------------------------------------------------------------

@app.get("/api/discover/social")
async def api_discover_social(
    refresh: bool = Query(False),
    user: str = Depends(verify_token),
):
    """Get Reddit ticker mentions + sentiment. Uses cached data or scans fresh."""
    settings = get_all_settings()
    threshold = int(settings.get("social_mention_threshold", "5"))
    subreddits = settings.get("social_subreddits", "wallstreetbets,stocks,investing,options")
    subreddit_list = [s.strip() for s in subreddits.split(",") if s.strip()]

    last_scan = get_social_last_scan()
    cache_stale = True
    if last_scan:
        try:
            scan_dt = datetime.fromisoformat(last_scan)
            interval_hours = int(settings.get("social_scan_interval_hours", "4"))
            cache_stale = (datetime.now(timezone.utc) - scan_dt).total_seconds() > interval_hours * 3600
        except (ValueError, TypeError):
            cache_stale = True

    if refresh or cache_stale:
        client_id = REDDIT_CLIENT_ID
        client_secret = REDDIT_CLIENT_SECRET
        if client_id and client_secret:
            try:
                from discovery import scan_reddit_mentions
                today = datetime.now().strftime("%Y-%m-%d")
                mentions = scan_reddit_mentions(
                    subreddits=subreddit_list,
                    mention_threshold=threshold,
                    client_id=client_id,
                    client_secret=client_secret,
                )
                if mentions:
                    save_social_mentions(mentions, today)
            except Exception as e:
                print(f"[Social] Scan error: {e}")

    mentions = get_social_mentions()
    return {
        "mentions": mentions,
        "subreddits": subreddit_list,
        "last_updated": get_social_last_scan(),
        "configured": bool(REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET),
    }


# ---------------------------------------------------------------------------
# Discover — Unusual Options Flow API
# ---------------------------------------------------------------------------

@app.get("/api/discover/options-flow")
async def api_discover_options_flow(
    source: str = Query("watchlist", pattern="^(watchlist|sp500)$"),
    refresh: bool = Query(False),
    user: str = Depends(verify_token),
):
    """Scan options chains for unusual activity (Vol/OI spikes, whale trades)."""
    import asyncio
    from discovery import scan_options_flow, get_sp500_tickers

    settings = get_all_settings()
    vol_oi_threshold = float(settings.get("options_flow_vol_oi_threshold", "500"))
    premium_threshold = float(settings.get("options_flow_premium_threshold", "1000000"))

    today = datetime.now().strftime("%Y-%m-%d")

    if source == "sp500":
        # Check cache first
        cached = get_options_flow(scan_date=today)
        if cached and not refresh:
            return {
                "alerts": cached,
                "source": source,
                "last_updated": get_options_last_scan(),
            }
        symbols = get_sp500_tickers()
    else:
        symbols = get_watchlist()

    if refresh or not get_options_flow(scan_date=today):
        try:
            # Run blocking scan in thread pool to avoid blocking the event loop
            alerts = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: scan_options_flow(
                    symbols=symbols,
                    vol_oi_threshold=vol_oi_threshold,
                    premium_threshold=premium_threshold,
                ),
            )
            if alerts:
                save_options_flow(alerts, today)
        except Exception as e:
            print(f"[Options] Scan error: {e}")

    flow = get_options_flow(scan_date=today)
    return {
        "alerts": flow,
        "source": source,
        "last_updated": get_options_last_scan(),
    }


# ---------------------------------------------------------------------------
# Discover — Matchmaker API
# ---------------------------------------------------------------------------

@app.get("/api/discover/matchmaker/candidates")
async def api_discover_matchmaker_candidates(
    sources: str = Query("sp500", pattern="^[a-z0-9,_]+$"),
    limit: int = Query(50, ge=1, le=200),
    user: str = Depends(verify_token),
):
    """Get matchmaker stock candidates from selected sources, excluding recently seen."""
    import asyncio
    from discovery import get_sp500_tickers

    settings = get_all_settings()
    reset_days = int(settings.get("matchmaker_reset_days", "7"))

    dismissed = set(get_matchmaker_dismissed(days=reset_days))
    watchlist = set(get_watchlist())

    # Gather candidate tickers from selected sources
    source_list = [s.strip() for s in sources.split(",") if s.strip()]
    candidates = set()

    for src in source_list:
        if src == "sp500":
            candidates.update(get_sp500_tickers())
        elif src == "congress":
            congress = get_congress_trades(limit=100)
            candidates.update(t["ticker"] for t in congress if t.get("ticker"))
        elif src == "social":
            social = get_social_mentions()
            candidates.update(m["ticker"] for m in social if m.get("ticker"))
        elif src == "insider":
            from discovery import scan_insider_market_wide
            insider = await asyncio.get_event_loop().run_in_executor(
                None, lambda: scan_insider_market_wide(min_value=100_000)
            )
            candidates.update(t["ticker"] for t in insider if t.get("ticker"))
        elif src == "options":
            options = get_options_flow()
            candidates.update(a["ticker"] for a in options if a.get("ticker"))
        elif src == "screener":
            # Use watchlist as screener base
            candidates.update(get_watchlist())

    # Remove already-seen and already-watchlisted
    candidates = candidates - dismissed - watchlist

    # Limit and shuffle
    import random
    candidate_list = list(candidates)
    random.shuffle(candidate_list)
    candidate_list = candidate_list[:limit]

    return {"candidates": candidate_list, "total_available": len(candidates)}


@app.get("/api/discover/matchmaker/card/{symbol}")
async def api_discover_matchmaker_card(symbol: str, user: str = Depends(verify_token)):
    """Get full card data for a matchmaker candidate."""
    symbol = symbol.upper()
    try:
        import yfinance as yf
        ticker = yf.Ticker(symbol)
        info = ticker.info or {}

        # 7-day chart data
        hist = ticker.history(period="1mo")
        chart_data = []
        if hist is not None and not hist.empty:
            for date, row in hist.iterrows():
                chart_data.append({
                    "time": date.strftime("%Y-%m-%d"),
                    "open": round(float(row["Open"]), 2),
                    "high": round(float(row["High"]), 2),
                    "low": round(float(row["Low"]), 2),
                    "close": round(float(row["Close"]), 2),
                    "volume": int(row["Volume"]),
                })

        # Calculate 1-month return
        month_return = None
        if len(chart_data) >= 2:
            first_close = chart_data[0]["close"]
            last_close = chart_data[-1]["close"]
            if first_close > 0:
                month_return = round(((last_close - first_close) / first_close) * 100, 2)

        # Get price + change from snapshot if available
        snapshots = get_cached_snapshots([symbol], ttl=CACHE_TTL_SECONDS)
        snap = snapshots.get(symbol, {})

        # Get signals
        signal_data = _get_quick_signals(symbol)

        return {
            "symbol": symbol,
            "name": info.get("longName") or info.get("shortName", symbol),
            "sector": info.get("sector", "N/A"),
            "industry": info.get("industry", "N/A"),
            "founded": info.get("companyOfficers", [{}])[0].get("yearBorn") if info.get("companyOfficers") else None,
            "market_cap": info.get("marketCap"),
            "price": snap.get("price") or (chart_data[-1]["close"] if chart_data else None),
            "change_pct": snap.get("change_pct"),
            "month_return": month_return,
            "chart": chart_data[-7:] if len(chart_data) >= 7 else chart_data,
            "pe_ratio": info.get("trailingPE"),
            "forward_pe": info.get("forwardPE"),
            "eps": info.get("trailingEps"),
            "dividend_yield": info.get("dividendYield"),
            "beta": info.get("beta"),
            "fifty_two_week_high": info.get("fiftyTwoWeekHigh"),
            "fifty_two_week_low": info.get("fiftyTwoWeekLow"),
            "avg_volume": info.get("averageVolume"),
            "rsi": signal_data.get("rsi"),
            "trend": signal_data.get("trend"),
            "adx": signal_data.get("adx"),
            "macd": signal_data.get("macd"),
            "signals": signal_data.get("signals", []),
            "strong_bullish": signal_data.get("strong_bullish", 0),
            "strong_bearish": signal_data.get("strong_bearish", 0),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to load card data: {e}")


@app.post("/api/discover/matchmaker/swipe")
async def api_discover_matchmaker_swipe(
    body: dict = Body(...),
    user: str = Depends(verify_token),
):
    """Record a matchmaker swipe — 'watchlisted' or 'dismissed'."""
    ticker = body.get("ticker", "").upper().strip()
    action = body.get("action", "dismissed")

    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker is required")
    if action not in ("watchlisted", "dismissed"):
        raise HTTPException(status_code=400, detail="Action must be 'watchlisted' or 'dismissed'")

    record_matchmaker_swipe(ticker, action)

    if action == "watchlisted":
        add_to_watchlist(ticker)

    return {"ticker": ticker, "action": action}


@app.get("/api/discover/matchmaker/history")
async def api_discover_matchmaker_history(user: str = Depends(verify_token)):
    """Get matchmaker swipe history."""
    return get_matchmaker_history()


# ---------------------------------------------------------------------------
# Settings API
# ---------------------------------------------------------------------------

@app.get("/api/settings")
async def api_get_settings(user: str = Depends(verify_token)):
    """Get all app settings."""
    settings = get_all_settings()
    settings["reddit_configured"] = bool(REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET)
    return settings


@app.put("/api/settings")
async def api_update_settings(body: dict = Body(...), user: str = Depends(verify_token)):
    """Update app settings."""
    # Only allow known setting keys
    from database import DEFAULT_SETTINGS
    allowed_keys = set(DEFAULT_SETTINGS.keys())
    filtered = {k: v for k, v in body.items() if k in allowed_keys}
    if not filtered:
        raise HTTPException(status_code=400, detail="No valid settings provided")
    update_settings(filtered)
    return get_all_settings()


# ---------------------------------------------------------------------------
# Background Scheduler
# ---------------------------------------------------------------------------

def _start_scheduler():
    """Start APScheduler for periodic scans."""
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
    except ImportError:
        print("[Scheduler] apscheduler not installed — background scans disabled")
        return None

    scheduler = BackgroundScheduler()

    def _run_social_scan():
        """Background social momentum scan."""
        if not REDDIT_CLIENT_ID or not REDDIT_CLIENT_SECRET:
            return
        try:
            from discovery import scan_reddit_mentions
            settings = get_all_settings()
            threshold = int(settings.get("social_mention_threshold", "5"))
            subreddits = settings.get("social_subreddits", "wallstreetbets,stocks,investing,options")
            subreddit_list = [s.strip() for s in subreddits.split(",") if s.strip()]
            today = datetime.now().strftime("%Y-%m-%d")
            mentions = scan_reddit_mentions(
                subreddits=subreddit_list,
                mention_threshold=threshold,
                client_id=REDDIT_CLIENT_ID,
                client_secret=REDDIT_CLIENT_SECRET,
            )
            if mentions:
                save_social_mentions(mentions, today)
                print(f"[Scheduler] Social scan complete: {len(mentions)} tickers found")
        except Exception as e:
            print(f"[Scheduler] Social scan error: {e}")

    def _run_options_scan():
        """Background S&P 500 options flow scan."""
        settings = get_all_settings()
        if settings.get("options_sp500_scan_enabled") != "true":
            return
        try:
            from discovery import scan_options_flow, get_sp500_tickers
            vol_oi = float(settings.get("options_flow_vol_oi_threshold", "500"))
            premium = float(settings.get("options_flow_premium_threshold", "1000000"))
            today = datetime.now().strftime("%Y-%m-%d")
            symbols = get_sp500_tickers()
            alerts = scan_options_flow(symbols, vol_oi_threshold=vol_oi, premium_threshold=premium)
            if alerts:
                save_options_flow(alerts, today)
                print(f"[Scheduler] Options scan complete: {len(alerts)} alerts found")
        except Exception as e:
            print(f"[Scheduler] Options scan error: {e}")

    # Social scan — every N hours (configurable)
    settings = get_all_settings()
    social_interval = int(settings.get("social_scan_interval_hours", "4"))
    scheduler.add_job(_run_social_scan, 'interval', hours=social_interval,
                      id='social_scan', replace_existing=True)

    # S&P 500 options scan — daily at configured time
    scan_time = settings.get("options_sp500_scan_time", "09:45")
    try:
        hour, minute = scan_time.split(":")
        scheduler.add_job(_run_options_scan, 'cron', hour=int(hour), minute=int(minute),
                          id='options_scan', replace_existing=True)
    except ValueError:
        scheduler.add_job(_run_options_scan, 'cron', hour=9, minute=45,
                          id='options_scan', replace_existing=True)

    scheduler.start()
    print(f"[Scheduler] Background scans started (social: every {social_interval}h, options: {scan_time})")
    return scheduler


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_quick_signals(symbol: str) -> dict:
    """Get a quick signal summary for a symbol (for watchlist cards)."""
    try:
        df = fetch_stock_data(symbol, period="3mo")
        df = add_all_indicators(df)
        df = df.dropna(subset=["sma_long", "rsi", "macd", "bb_lower"])
        summary = get_signal_summary(df)
        return {
            "rsi": summary["rsi"],
            "trend": summary["trend"],
            "signals": summary["signals"],
            "bullish_count": summary["bullish_count"],
            "bearish_count": summary["bearish_count"],
            "strong_bullish": summary["strong_bullish"],
            "strong_bearish": summary["strong_bearish"],
            "support_bullish": summary["support_bullish"],
            "support_bearish": summary["support_bearish"],
            "macd": summary["macd"],
            "macd_signal": summary["macd_signal"],
            "atr": summary["atr"],
            "adx": summary["adx"],
        }
    except Exception as e:
        print(f"[Signals] Quick signal scan failed for {symbol}: {e}")
        return {
            "rsi": None, "trend": "unknown", "signals": [],
            "bullish_count": 0, "bearish_count": 0,
            "strong_bullish": 0, "strong_bearish": 0,
            "support_bullish": 0, "support_bearish": 0,
            "macd": None, "macd_signal": None, "atr": None, "adx": None,
        }


def _scan_signals_for_symbol(symbol: str, lookback_days: int = 5) -> list[dict]:
    """Scan a symbol for signals in the recent period."""
    try:
        df = fetch_stock_data(symbol, period="3mo")
        df = add_all_indicators(df)
        df = df.dropna(subset=["sma_long", "rsi", "macd", "bb_lower"])
    except Exception:
        return []

    all_signals = []
    for finder in ALL_COMBINED_SIGNAL_FINDERS:
        signals = finder(df)
        for sig in signals:
            sig_date = sig["date"]
            if hasattr(sig_date, "date"):
                sig_date_str = str(sig_date.date())
            else:
                sig_date_str = str(sig_date)

            # Only include signals from the last N days
            days_ago = (df.index[-1] - sig["date"]).days
            if days_ago <= lookback_days:
                all_signals.append({
                    "symbol": symbol,
                    "signal": sig["signal"],
                    "direction": sig.get("direction", "long"),
                    "price": sig["entry_price"],
                    "date": sig_date_str,
                    "days_ago": days_ago,
                })

    return all_signals


def _get_action_for_symbol(symbol: str, lookback_days: int = 5) -> dict:
    """Analyze a symbol and return an action recommendation with reasoning."""
    df = fetch_stock_data(symbol, period="3mo")
    df = add_all_indicators(df)
    df = df.dropna(subset=["sma_long", "rsi", "macd", "bb_lower"])

    # Get indicator summary
    summary = get_signal_summary(df)

    # Get recent signals
    recent_signals = []
    for finder in ALL_COMBINED_SIGNAL_FINDERS:
        signals = finder(df)
        for sig in signals:
            days_ago = (df.index[-1] - sig["date"]).days
            if days_ago <= lookback_days:
                sig_date = sig["date"]
                sig_date_str = str(sig_date.date()) if hasattr(sig_date, "date") else str(sig_date)
                recent_signals.append({
                    "signal": sig["signal"],
                    "direction": sig.get("direction", "long"),
                    "date": sig_date_str,
                    "days_ago": days_ago,
                })

    # Determine action using same logic as frontend StockDetail.renderActionCard()
    strong_bull = summary.get("strong_bullish", 0)
    strong_bear = summary.get("strong_bearish", 0)
    support_bull = summary.get("support_bullish", 0)
    support_bear = summary.get("support_bearish", 0)
    trend = summary.get("trend", "unknown")

    if strong_bull >= 2 or (strong_bull >= 1 and support_bull >= 1 and trend == "bullish"):
        action = "BUY"
        confidence = "HIGH" if strong_bull >= 2 else "MEDIUM"
        reasoning = f"{strong_bull} strong + {support_bull} supporting bullish signals in {trend} trend"
    elif strong_bear >= 2 or (strong_bear >= 1 and support_bear >= 1 and trend == "bearish"):
        action = "SELL"
        confidence = "HIGH" if strong_bear >= 2 else "MEDIUM"
        reasoning = f"{strong_bear} strong + {support_bear} supporting bearish signals in {trend} trend"
    else:
        action = "HOLD"
        confidence = "LOW"
        reasoning = "Insufficient signal confirmation for action"

    # Get live price data
    snapshots = get_cached_snapshots([symbol], ttl=CACHE_TTL_SECONDS)
    snap = snapshots.get(symbol, {})

    return {
        "symbol": symbol,
        "action": action,
        "confidence": confidence,
        "reasoning": reasoning,
        "price": snap.get("price"),
        "change_pct": snap.get("change_pct"),
        "trend": trend,
        "rsi": summary.get("rsi"),
        "adx": summary.get("adx"),
        "signals": recent_signals,
        "signal_summary": summary.get("signals", []),
        "strong_bullish": strong_bull,
        "strong_bearish": strong_bear,
        "support_bullish": support_bull,
        "support_bearish": support_bear,
        "indicator_summary": {
            "close": summary.get("close"),
            "rsi": summary.get("rsi"),
            "macd": summary.get("macd"),
            "macd_signal": summary.get("macd_signal"),
            "macd_histogram": summary.get("macd_histogram"),
            "atr": summary.get("atr"),
            "stoch_k": summary.get("stoch_k"),
            "stoch_d": summary.get("stoch_d"),
            "volume_ratio": summary.get("volume_ratio"),
            "sma_short": summary.get("sma_short"),
            "sma_long": summary.get("sma_long"),
            "adx": summary.get("adx"),
            "adx_pos": summary.get("adx_pos"),
            "adx_neg": summary.get("adx_neg"),
            "ema_9": summary.get("ema_9"),
            "obv_trend": summary.get("obv_trend"),
            "trend": trend,
            "bb_upper": summary.get("bb_upper"),
            "bb_lower": summary.get("bb_lower"),
        },
    }


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host=SERVER_HOST, port=SERVER_PORT)
