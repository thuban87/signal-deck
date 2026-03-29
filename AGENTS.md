# Signal Deck — Trading Signal Dashboard

## Project Overview

A full-stack trading signal dashboard that:
1. Fetches real-time market data via **Alpaca** (with yfinance fallback)
2. Computes technical indicators (RSI, MACD, Bollinger Bands, ADX, OBV, ATR, Stochastic)
3. Detects bullish AND bearish trading signals using tiered multi-signal confirmation
4. Displays everything on a premium web dashboard with interactive TradingView charts
5. Supports paper trading to test strategies without real money
6. Optionally queries a local LLM (Ollama) for on-demand analysis

**Not a live trading system.** All suggestions are for research and paper trading only.

---

## Project Structure

```
Trading/
├── backend/                    # Python server + analysis engine
│   ├── server.py              # FastAPI app — REST API + static serving
│   ├── config.py              # Env-var-driven configuration
│   ├── database.py            # SQLite: watchlist, signals, paper trades
│   ├── alpaca_client.py       # Alpaca SDK wrapper + paper trading API
│   ├── indicators.py          # Technical indicator computation
│   ├── backtest_signals.py    # Signal finders + trade simulator (long+short)
│   ├── data_fetcher.py        # yfinance data fetching
│   ├── llm_analyst.py         # Ollama LLM integration (optional)
│   └── main.py                # Original CLI entry point
├── frontend/                   # Web UI (vanilla HTML/CSS/JS)
│   ├── index.html             # App shell + sidebar nav
│   ├── css/styles.css         # Premium dark-mode design system
│   └── js/
│       ├── app.js             # Router, API client, auth, state
│       ├── dashboard.js       # Watchlist cards + sparklines
│       ├── signals.js         # Signal feed table + filters
│       ├── stock.js           # Candlestick chart + indicators + LLM
│       ├── backtest.js        # Backtester + equity curve
│       └── paper.js           # Paper trading (Alpaca-synced + local fallback)
├── docs/dev/
│   ├── Deployment.md          # Nginx + systemd deployment guide
│   ├── Findings.md            # Backtest results analysis
│   ├── Paper Trading — Full Alpaca Integration.md
│   └── Trading Crash Course.md
├── start-server.bat           # Launch backend server (port 8005)
├── stop-server.bat            # Kill running server processes
├── .env.example               # Template for secrets
├── .gitignore
├── requirements.txt
└── Session Log.md
```

---

## Running the System

```bash
# Install dependencies
pip install -r requirements.txt

# Create .env from template
cp .env.example .env
# Edit .env with your credentials

# Start the web dashboard (dev server, port 8005)
cd backend
python server.py

# Open http://localhost:8005
# Login: admin / changeme (change in .env for production)
```

### Windows bat scripts:
```
start-server.bat   # Opens terminal, starts the server
stop-server.bat    # Kills server processes on port 8005
```

### CLI tools (still available):
```bash
cd backend

# Signal-only backtest (fast, no Ollama needed)
python backtest_signals.py AAPL MSFT NVDA

# LLM backtest (slow — ~40 Ollama calls per symbol)
python backtest_llm.py AAPL
```

---

## Key Design Decisions

### Signal Tiers (in `backtest_signals.py` and `indicators.py`)

Signals are split into **strong** (reversals/events) and **supporting** (persistent conditions):

**Bullish:**
- **Strong:** RSI recovery, MACD bullish crossover, BB bounce, Volume spike, Stochastic oversold
- **Supporting:** ADX bullish, OBV divergence, Above short EMAs, Above-avg volume

**Bearish:**
- **Strong:** RSI overbought reversal, MACD bearish crossover, Death cross, OBV bearish divergence
- **Supporting:** ADX bearish, Below short EMAs, Above-avg volume

Multi-signal threshold is **trend-aware:**
- In uptrend (SMA20 > SMA50): 1 strong + 1 supporting is enough
- In downtrend/neutral: 2 strong required, or 1 strong + 2 supporting

### Stop-Loss Sizing (ATR-based)

```
stop_loss_pct = max(ATR × 1.5 / entry_price × 100, 1.0)
take_profit_pct = max(ATR × 2.5 / entry_price × 100, 1.5)
```

---

### Paper Trading Architecture

Two modes, auto-detected at page load via `/api/config`:

**Alpaca Mode** (when `ALPACA_API_KEY` is configured):
- Real paper account synced with Alpaca — account balance, positions, order history
- All 5 order types: Market, Limit, Stop, Stop-Limit, Bracket (with take-profit/stop-loss legs)
- Supports both share quantity and dollar amount (notional) ordering
- Fractional shares enabled
- Auto-refreshes every 30 seconds
- Portfolio equity chart via `get_portfolio_history()`
- Endpoints: `/api/alpaca/account`, `/api/alpaca/positions`, `/api/paper/orders`, `/api/alpaca/orders`, `/api/alpaca/portfolio-history`, `DELETE /api/alpaca/positions/{symbol}`

**Local Fallback** (no Alpaca keys):
- SQLite-backed paper trading via `database.py`
- Market orders only, manual P&L tracking
- Endpoints: `/api/paper/trades`, `/api/paper/equity`

---

## Data Sources

- **Primary:** Alpaca (free tier — real-time quotes, paper trading, order execution)
- **Fallback:** yfinance (15-min delayed, no paper trading API)
- **Local DB:** SQLite for watchlist, signal history, and local paper trades (fallback mode)
- **Config:** Set `ALPACA_API_KEY` and `ALPACA_SECRET_KEY` in `.env`

---

## Known Issues / Limitations

- **Daily candles only** — intraday data not yet supported
- **No transaction costs modeled** — real trading has commissions and slippage
- **GPU crashes** — sustained LLM inference overloads GPU; run one symbol at a time
- **SPY underperforms** — signal parameters tuned for individual stocks, not indices

---

## Planned Improvements

- [ ] News Investigator tab — sentiment-classified financial news
- [ ] Settings page — provider config, model selection, signal tuning
- [ ] GPU cooldown (sleep between LLM calls)
- [ ] Intraday timeframe support (4h, 1h candles)
- [ ] Alert notifications (email/push when signals fire)
