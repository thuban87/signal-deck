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
    WATCHLIST, CACHE_TTL_SECONDS, DEFAULT_PERIOD,
)
from database import (
    init_db, get_watchlist, add_to_watchlist, remove_from_watchlist,
    seed_default_watchlist, log_signal, get_signal_history,
    create_paper_trade, close_paper_trade, get_paper_trades,
    get_paper_equity_curve,
)
from alpaca_client import (
    get_cached_snapshots, validate_symbol, is_alpaca_available,
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
    seed_default_watchlist(WATCHLIST)
    print(f"[Server] Database initialized")
    print(f"[Server] Alpaca: {'connected' if is_alpaca_available() else 'not configured (using yfinance)'}")
    yield
    # Shutdown — nothing to clean up


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
        df = fetch_stock_data(symbol, period=period)
        df = add_all_indicators(df)
        df = df.dropna(subset=["sma_long", "rsi", "macd", "bb_lower"])
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

    # Equity curve
    equity = []
    cumulative = 0
    for t in sorted(serialized, key=lambda x: x["exit_date"]):
        cumulative += t["pnl_pct"]
        equity.append({
            "date": t["exit_date"],
            "pnl": t["pnl_pct"],
            "cumulative": round(cumulative, 2),
        })

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
    }


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


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host=SERVER_HOST, port=SERVER_PORT, reload=True)
