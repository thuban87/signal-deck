# Trading System - Session Log

Development log for the LLM-assisted trading analysis and backtesting system.

> **Project:** LLM Trading Analysis
> **Started:** 2026-03-28
> **Related Docs:** [CLAUDE.md](CLAUDE.md) | [Findings](Findings.md) | [Trading Crash Course](Trading Crash Course.md)

---

## Session Format

Each session entry should include:
- **Date & Focus:** What was worked on
- **Completed:** Checklist of completed items
- **Files Changed:** Key files modified/created
- **Testing Notes:** What was tested and results
- **Blockers/Issues:** Any problems encountered
- **Next Steps:** What to continue with

---

## 2026-03-28 - Initial Build, Backtesting, and LLM Integration

**Focus:** Full system design and implementation — from empty directory to a working signal-based and LLM-based trading analysis + backtesting pipeline.

### Completed:

#### System Design & Planning

- Discussed the concept of using a local LLM for trading analysis
- Established realistic expectations: LLM as analyst/filter, not oracle
- Designed a two-layer architecture: mechanical signal engine feeds structured prompts to local LLM (Ollama)
- Chose stack: Python + yfinance + ta (technical analysis) + Ollama (qwen3:8b)
- Planned a progression: data pipeline → indicators → signal backtesting → LLM backtesting → comparison

#### Core Implementation

- ✅ `config.py` — Central config: watchlist, data settings, Ollama endpoint, indicator parameters
- ✅ `requirements.txt` — Dependencies: yfinance, pandas, ta, requests
- ✅ `data_fetcher.py` — yfinance wrapper: fetch OHLCV data, multi-symbol, latest price
- ✅ `indicators.py` — Full indicator suite: SMA, EMA, MACD, RSI, Bollinger Bands, ATR, Stochastic, ADX, OBV, VWAP. Tiered signal counting (strong vs. supporting)
- ✅ `llm_analyst.py` — Ollama API client: structured prompt builder, JSON response parser, retry logic
- ✅ `main.py` — Live analysis CLI: runs full pipeline for one or more symbols, prints summary table
- ✅ `backtest_signals.py` — Signal-only backtester: 7 signal finders, trade simulator, per-signal reporting, buy & hold comparison
- ✅ `backtest_llm.py` — LLM backtester: walk-forward LLM queries, ATR-based stop fallback, JSON trade logs

#### Indicator Suite Built

- SMA 20/50 (trend direction)
- EMA 9/12/26 (momentum)
- MACD 12/26/9 (crossover signals)
- RSI 14 (overbought/oversold)
- Bollinger Bands 20/2 (volatility + band bounces)
- ATR 14 (volatility for stop sizing)
- Stochastic 14 (overbought/oversold)
- ADX 14 (trend strength)
- OBV + OBV SMA20 (volume accumulation/distribution)
- VWAP approximation (price vs. volume-weighted average)

#### Signal Finders Built

- RSI oversold recovery (RSI < 30 then crosses back above)
- MACD bullish crossover
- Bollinger Band lower bounce
- Golden cross (SMA20 > SMA50)
- Volume spike on green candle (>2x average volume)
- ADX bullish trend confirmation (ADX crosses above 25 with +DI > -DI)
- OBV bullish divergence (price falling but OBV rising)
- Multi-signal confirmation — tiered, trend-aware (see refinements below)

### Testing & Iteration:

#### Round 1 — Initial Signal Backtest (fixed 2% SL / 3% TP)

| Symbol | Trades | Edge vs B&H |
|--------|--------|------------|
| AAPL   | 110    | -0.70%     |
| MSFT   | 91     | +97.00%    |
| NVDA   | 78     | +50.52%    |
| TSLA   | 64     | -25.78%    |
| SPY    | 77     | -28.06%    |

**Observation:** Too many trades, noisy signals (esp. "ADX + Above short EMAs"). TSLA and SPY particularly hurt by fixed stops not adapting to volatility.

#### Round 2 — Tightened Signals (tiered multi-signal, requires 1 strong + 2 supporting)

Edge dropped significantly on MSFT (+97% → +24.54%) and NVDA (+50.52% → +2.52%). Over-tightened.

#### Round 3 — ATR-Based Stops + Trend-Aware Multi-Signal Threshold

Changed:
- Fixed SL/TP → ATR-based (1.5x SL, 2.5x TP), floors at 1%/1.5%
- Multi-signal threshold: 1 strong + 1 supporting in bullish trend, 2 strong or 1+2 in bearish/neutral

| Symbol | Trades | Edge vs B&H |
|--------|--------|------------|
| AAPL   | 40     | +18.78%    |
| MSFT   | 40     | -5.96%     |
| NVDA   | 26     | +18.11%    |
| TSLA   | 30     | +33.30%    |
| SPY    | 35     | -19.11%    |
| **Avg/trade** | — | **+0.59%** |

**Best single signals:** MACD + Volume spike (100% win), RSI recovery + Stochastic oversold (100% win), OBV divergence on NVDA (83% win rate).

#### LLM Backtester Results (200-day lookback, skip=5, conf threshold >= 4)

| Symbol | Trades | Win Rate | Cumulative | Edge vs B&H |
|--------|--------|----------|-----------|------------|
| AAPL   | 19     | 57.9%    | +14.85%   | -14.27%    |
| MSFT   | 10     | 40.0%    | +0.05%    | ~0%        |
| NVDA   | 12     | 33.3%    | -7.82%    | -28.46%    |
| TSLA   | 14     | 21.4%    | -23.09%   | -37.48%    |
| SPY    | 14     | 42.9%    | -1.97%    | -11.26%    |

**Observation:** Signal backtester outperforms LLM backtester on every stock. LLM is profitable on AAPL but misses major moves. TSLA/NVDA: LLM stop-loss exits are too frequent during volatile periods.

### Bugs Fixed During Development:

- 🐛 **Qwen3 thinking tokens** — qwen3:8b returns JSON in a separate `thinking` field with empty `response`. Fixed by reading the `thinking` field as fallback, then resolved by adding `"think": False` to Ollama request options.
- 🐛 **LLM all-HOLD behavior** — Initial system prompt was too restrictive ("most days should be HOLD"). LLM returned HOLD on 40/40 calls across a full year including a 29% rally. Fixed by rewriting system prompt to calibrate confidence scale and set a ~30-40% trade frequency target.
- 🐛 **Ollama crash recovery** — PC crashed twice from sustained GPU usage during LLM backtest runs. Added retry logic (3 attempts, exponential backoff) to `query_ollama()`. Now runs one symbol at a time.
- 🐛 **`get_summary_at()` duplicate** — `backtest_llm.py` had a stripped-down copy of `get_signal_summary()` missing ADX/OBV/EMA data. Consolidated by adding `idx` parameter to `get_signal_summary()`.

### Files Changed This Session:

| File | Status | Notes |
|------|--------|-------|
| `config.py` | Created | Watchlist, indicator settings, Ollama config |
| `requirements.txt` | Created | yfinance, pandas, ta, requests |
| `data_fetcher.py` | Created | yfinance wrapper |
| `indicators.py` | Created + 3x revised | Full indicator suite + tiered signal summary |
| `llm_analyst.py` | Created + 4x revised | Prompt builder, Ollama client, retry logic |
| `main.py` | Created | Live analysis CLI |
| `backtest_signals.py` | Created + 2x revised | Signal backtester with ATR stops |
| `backtest_llm.py` | Created + 3x revised | LLM backtester |
| `backtest_llm_AAPL.json` | Generated | LLM backtest log |
| `backtest_llm_MSFT.json` | Generated | LLM backtest log |
| `backtest_llm_NVDA.json` | Generated | LLM backtest log |
| `backtest_llm_TSLA.json` | Generated | LLM backtest log |
| `backtest_llm_SPY.json` | Generated | LLM backtest log |

### Blockers / Issues:

- **PC crashes from sustained GPU load** — Running 40+ sequential Ollama inference calls causes GPU overload and system crash. Mitigation: run one symbol at a time, added retry logic. Long-term: need to add a cooldown/sleep between calls or reduce lookback.
- **LLM stop-loss tuning** — LLM-suggested stops on TSLA/NVDA are too tight for volatile stocks. Stop sizing needs to be ATR-adjusted even when using LLM suggestions.
- **MSFT remains negative** — In a downtrend all year (buy & hold -19%). System is long-only; no short/sell signals implemented yet.

### Next Steps:

- [x] Add short/sell signal detection for downtrending stocks (MACD bearish crossover, death cross, RSI overbought reversal)
- [ ] Add GPU cooldown sleep between LLM calls to prevent crashes
- [x] Build a simple web dashboard for live tracking (Flask or FastAPI + chart.js)
- [ ] Explore fine-tuning with labeled backtest data (BUY/HOLD results as training signal)
- [x] Add paper trading mode: record daily LLM suggestions without simulating, review weekly
- [ ] Test on different timeframes (4h, 1h candles instead of daily)
- [ ] Consider adding news/sentiment as an additional LLM input

---

## 2026-03-28 (Session 2) — Signal Deck Web Dashboard Build

**Focus:** Full-stack web dashboard: bearish signal engine, FastAPI backend with auth, premium dark-mode frontend with TradingView charts, paper trading system, deployment config.

### Completed:

#### Phase 1: Bearish Signal Engine
- [x] Added 5 bearish signal finders: MACD bearish crossover, RSI overbought reversal, death cross, OBV bearish divergence, multi-signal bearish confirmation
- [x] Updated `simulate_trades()` to support SHORT trades (profit from price decline)
- [x] Updated reporting to show LONG/SHORT splits and direction-tagged trades

#### Phase 2: FastAPI Backend
- [x] Rewrote `config.py` — env-var-driven with `.env` file support for dev/prod
- [x] Created `database.py` — SQLite with WAL mode for watchlist, signal history, paper trades
- [x] Created `alpaca_client.py` — Alpaca SDK wrapper with yfinance fallback + price caching
- [x] Created `server.py` — FastAPI with JWT auth, 15+ API endpoints
- [x] Updated `requirements.txt` with fastapi, uvicorn, alpaca-py, passlib, python-jose

#### Phase 3: Premium Frontend
- [x] Created `frontend/index.html` — app shell with sidebar nav, login screen, modals
- [x] Created `frontend/css/styles.css` — 700+ line premium dark-mode design system
- [x] Created `frontend/js/app.js` — hash router, API client, JWT auth, toast notifications
- [x] Created `frontend/js/dashboard.js` — watchlist cards with sparklines, signal alerts
- [x] Created `frontend/js/signals.js` — filterable signal feed table
- [x] Created `frontend/js/stock.js` — TradingView candlestick chart + indicator sidebar + LLM button
- [x] Created `frontend/js/backtest.js` — backtester UI with equity curve and trade log

#### Phase 4: Paper Trading
- [x] Created `frontend/js/paper.js` — trade creation, open/closed tables, equity curve, stats

#### Project Infrastructure
- [x] Reorganized project into `backend/` and `frontend/` directories
- [x] Created `.env.example`, `.gitignore`
- [x] Created `docs/dev/Deployment.md` — nginx + systemd guide for Linux server

### Files Changed/Created:

| File | Status | Purpose |
|------|--------|---------|
| `backend/config.py` | Modified | Env-var-driven config + auth/Alpaca/DB settings |
| `backend/backtest_signals.py` | Modified | Added bearish signals + SHORT simulation |
| `backend/database.py` | New | SQLite database layer |
| `backend/alpaca_client.py` | New | Alpaca API wrapper |
| `backend/server.py` | New | FastAPI server |
| `frontend/index.html` | New | App shell |
| `frontend/css/styles.css` | New | Design system |
| `frontend/js/app.js` | New | Core app (router, auth, API) |
| `frontend/js/dashboard.js` | New | Dashboard page |
| `frontend/js/signals.js` | New | Signal feed page |
| `frontend/js/stock.js` | New | Stock detail page |
| `frontend/js/backtest.js` | New | Backtester page |
| `frontend/js/paper.js` | New | Paper trading page |
| `requirements.txt` | Modified | Added web + auth + Alpaca deps |
| `.env.example` | New | Env template |
| `.gitignore` | New | Git ignore rules |
| `docs/dev/Deployment.md` | New | Deployment guide |

### Testing Notes:

- ✅ Server starts cleanly with yfinance fallback
- ✅ Login/logout with JWT works correctly
- ✅ Dashboard loads 5 watchlist symbols with live prices and indicators
- ✅ Signal feed shows 9 signals (7 BUY, 2 SELL) across TSLA, MSFT, SPY, AAPL
- ✅ Backtester runs AAPL: 81 trades (37L/44S), 53.1% win rate, +72.81% cumulative, +48.93% edge
- ✅ Stock detail renders TradingView chart with SMA/BB overlays, all indicator cards
- ✅ Frontend responsive design verified

### Blockers / Issues:

- **Alpaca keys not configured** — Using yfinance fallback (15-min delayed data). User needs to sign up at alpaca.markets.
- **TradingView watermark** — Free tier of lightweight-charts shows TV logo. Expected behavior.

### Next Steps:

- [ ] Sign up for Alpaca and add API keys to `.env`
- [ ] Deploy to Linux server (follow `docs/dev/Deployment.md`)
- [ ] Set up HTTPS via certbot for secure remote access
- [ ] Add GPU cooldown for LLM calls
- [ ] Test on different timeframes (4h, 1h candles)
- [ ] Consider adding news/sentiment analysis

### Next Session Prompt:

> Resume from the Signal Deck dashboard. All 4 phases are complete and verified. The server runs from `backend/server.py`. The user needs to: (1) set up Alpaca API keys, (2) deploy to their Linux nginx server via `docs/dev/Deployment.md`. Potential improvements: real-time WebSocket price streaming, intraday candle support, alert notifications.

---

## 2026-03-28 (Session 3) — Polish, Tooltips, and User Onboarding

**Focus:** Bug fixes from directory restructure, developer experience polish, stock detail page tooltips, gitignore hardening, user education on signals and backtesting.

### Completed:

#### Bug Fixes
- [x] Fixed `.env` loading — `config.py` now checks project root (parent of `backend/`) first, then its own directory
- [x] Changed dev server port to 8005 (user has another service on 8000)
- [x] Updated `.env` and `.env.example` to use port 8005
- [x] Alpaca API keys now loading correctly (confirmed "Connected successfully" in server logs)

#### Indicator Tooltips (stock detail page)
- [x] Added `title` tooltips to all 8 indicator cards (RSI, MACD, ADX, Stochastic, ATR, Trend, OBV, Volume)
- [x] Each tooltip explains what the indicator measures and how to interpret the numbers in plain English
- [x] Added contextual emoji hint text below values (e.g., "📈 Money is flowing INTO this stock")
- [x] Added `?` badge icon next to each indicator label that highlights on hover
- [x] Added CSS for `.tooltip-icon` and `.indicator-tooltip-text`

#### Project Housekeeping
- [x] Updated `.gitignore` — added `*.db-wal`, `*.db-shm`, `.gemini/`, `.agents/`, `venv/`, OS junk files
- [x] Updated `AGENTS.md` — fully rewritten to match current `backend/`+`frontend/` structure
- [x] Synced `CLAUDE.md` with `AGENTS.md`

### Files Changed:

| File | Status | Purpose |
|------|--------|---------|
| `backend/config.py` | Modified | Fixed .env path resolution + port default |
| `.env` | Modified | Changed port to 8005 |
| `.env.example` | Modified | Changed port to 8005 |
| `frontend/js/stock.js` | Modified | Added tooltips + contextual hints to indicator cards |
| `frontend/css/styles.css` | Modified | Added tooltip icon + hint text styles |
| `.gitignore` | Modified | Expanded with db WAL/SHM, agent dirs, venvs |
| `AGENTS.md` | Modified | Rewritten for new project structure |
| `CLAUDE.md` | Modified | Synced with AGENTS.md |

### Testing Notes:

- ✅ Server starts with Alpaca connected on port 8005
- ✅ `.env` keys loaded correctly from project root
- ✅ All pages still functional after restructure

### Discussions (no code changes):

1. **Signals explained** — Signals are mechanical pattern detections (not predictions). They fire when specific price/volume patterns appear (RSI oversold recovery, MACD crossover, etc.). Multiple signals must agree before recommending action. Signals being 2-8 days old is normal — markets don't produce patterns every day.

2. **Backtest tab explained** — Does NOT use the LLM. It replays historical data through the signal engine to validate strategies. The signal formulas are based on established technical analysis math that doesn't need regular updating. Useful for confidence-building before committing real money.

3. **Investigator tab discussed** — New feature idea: search financial news for a ticker, classify results into Bullish/Neutral/Bearish columns. Would complement mechanical signals with sentiment context. Planned for a future session.

### Next Steps:

- [ ] Build News Investigator tab (search + sentiment classification)
- [ ] Deploy to Linux server (follow `docs/dev/Deployment.md`)
- [ ] Create Settings page (future session — provider config, model selection, signal tuning)
- [ ] Consider rethinking Backtest tab UX (is it a "dead" feature for a non-technical user?)

### Next Session Prompt:

> Signal Deck is fully functional on port 8005 with Alpaca connected. This session added tooltips and fixed the .env loading after the backend/ restructure. Three planned features for next sessions: (1) **News Investigator tab** — search financial news + sentiment classification into bullish/neutral/bearish, (2) **Settings page** — provider config, model selection, signal parameter tuning, (3) **Deployment** to Linux nginx server.

---

## 2026-03-29 — Alpaca Paper Trading Integration

**Focus:** Full Alpaca paper trading integration — replacing the local-only paper trading page with real Alpaca API sync for order placement, position tracking, portfolio history, and equity charting.

### Completed:

#### Backend — Alpaca Trading Functions (`alpaca_client.py`)
- [x] Extended Alpaca SDK imports: `MarketOrderRequest`, `LimitOrderRequest`, `StopOrderRequest`, `StopLimitOrderRequest`, `TakeProfitRequest`, `StopLossRequest`, `GetOrdersRequest`, `ClosePositionRequest`, `GetPortfolioHistoryRequest`, `OrderSide`, `TimeInForce`, `OrderClass`, `QueryOrderStatus`
- [x] `get_account()` — returns portfolio value, cash, buying power, equity, long/short exposure, margin info
- [x] `get_positions()` — all open positions with real-time unrealized P&L
- [x] `submit_order()` — supports market, limit, stop, stop-limit, and bracket orders; both share qty and dollar notional; fractional shares enabled
- [x] `close_position()` — full or partial close with qty or percentage
- [x] `get_orders()` — order history with status filtering (open/closed/all)
- [x] `get_portfolio_history()` — equity curve data over configurable period/timeframe

#### Backend — New API Endpoints (`server.py`)
- [x] `GET /api/paper/account` — Alpaca account info
- [x] `GET /api/paper/positions` — open positions from Alpaca
- [x] `POST /api/paper/orders` — submit order (all types)
- [x] `GET /api/paper/orders/history` — order history with status/limit params
- [x] `DELETE /api/paper/positions/{symbol}` — close a position
- [x] `GET /api/paper/portfolio-history` — equity curve with period/timeframe params
- [x] Existing local paper trade endpoints preserved as fallback

#### Frontend — Complete Paper Trading Rewrite (`paper.js`)
- [x] **Account summary bar** — portfolio value, cash, buying power, today's P&L (dollar + %), long/short exposure
- [x] **Order form** — symbol input with live price lookup, Buy/Sell toggle, all 5 order types (market/limit/stop/stop-limit/bracket), Shares/Dollars quantity toggle, conditional price fields, live order preview
- [x] **Open positions table** — real-time P&L color-coded rows, market value, close button per position
- [x] **Recent orders table** — status badges (filled/cancelled/pending/partial), fill prices, timestamps
- [x] **Portfolio equity chart** — TradingView lightweight chart with 1W/1M/3M/1Y period selector
- [x] **Local fallback mode** — when Alpaca isn't configured, shows warning banner and falls back to original SQLite paper trading
- [x] **30-second auto-refresh** — positions, account, and orders refresh automatically

#### Frontend — New CSS (`styles.css`)
- [x] Account summary stat cards
- [x] Buy/Sell toggle button styling (green/red)
- [x] Shares/Dollars quantity mode toggle (blue)
- [x] Order preview styling
- [x] Position row P&L color coding (bullish/bearish rows)
- [x] Order status badges (filled/cancelled/pending/partial)
- [x] Alpaca status banner (shown when not configured)
- [x] Period selector buttons
- [x] Responsive layout for all new sections

#### Infrastructure
- [x] Created `start-server.bat` — starts the server from project root
- [x] Created `stop-server.bat` — kills any process on port 8005

### Files Changed:

| File | Status | Purpose |
|------|--------|---------|
| `backend/alpaca_client.py` | Modified | Added 6 trading functions + extended SDK imports |
| `backend/server.py` | Modified | Added 6 new Alpaca paper trading API endpoints |
| `frontend/js/paper.js` | Rewritten | Full Alpaca-synced paper trading UI with fallback |
| `frontend/css/styles.css` | Modified | All new CSS for paper trading components |
| `start-server.bat` | New | Server start script |
| `stop-server.bat` | New | Server stop script |
| `docs/dev/Paper Trading — Full Alpaca Integration.md` | New | Implementation plan doc |

### Testing Notes:

- ✅ Server starts cleanly — all imports resolve, no errors
- ✅ All 6 new endpoints return 200 OK (confirmed in server logs)
- ✅ Account, positions, orders, and portfolio history all pulling from Alpaca correctly
- ✅ 30-second auto-refresh confirmed working (hundreds of successful polling cycles in logs)
- ✅ WatchFiles hot-reload detected changes and reloaded cleanly mid-session
- ✅ Frontend loads paper trading page and renders all sections

### Architecture Notes:

**Alpaca Sync Direction:**
- Orders placed on Signal Deck → submitted to Alpaca paper trading API
- Positions/account data pulled from Alpaca → displayed on Signal Deck
- Orders placed on Alpaca's own dashboard will appear on Signal Deck on next refresh

**Order Types Supported:**
- Market (immediate execution)
- Limit (execute at specified price or better)
- Stop (trigger market order when stop price hit)
- Stop-Limit (trigger limit order when stop price hit)
- Bracket (market entry + take profit + stop loss legs)

### Next Steps:

- [ ] Test placing actual paper trades through the UI
- [ ] Build News Investigator tab
- [ ] Create Settings page
- [ ] Deploy to Linux server

### Next Session Prompt:

> Alpaca paper trading is fully integrated. The paper trading page now syncs with Alpaca's paper trading API — orders, positions, account data, and portfolio equity chart all pull from Alpaca. Supports all order types (market, limit, stop, stop-limit, bracket), fractional shares, and dollar-amount ordering. Falls back to local SQLite mode when Alpaca isn't configured. Start/stop scripts are at project root. Next features: News Investigator tab, Settings page, deployment.

---

## 2026-03-29 (Session 2) — Feature Expansion: Investigator, Tags, Position Sizing, Screener, Fundamentals

**Focus:** Major feature expansion across all pages — Investigator deep-dive research page, watchlist tagging system, position sizing calculator, real-time screener, stock fundamentals, earnings warnings, news sentiment analysis, and backtest fundamental filters.

### Completed:

#### Backend — New Database Schema (`database.py`)
- [x] `stock_notes` table — per-symbol Markdown notes with timestamps
- [x] `tags` table — predefined + custom tags with colors
- [x] `watchlist_tags` table — many-to-many symbol-to-tag mapping
- [x] `seed_default_tags()` — 8 predefined tags (Tech Swing, Long Term Hold, Momentum, Value Pick, Day Trade, Dividend Play, Speculative, Garbage but Volatile)
- [x] Full CRUD functions: `get_stock_notes()`, `save_stock_notes()`, `get_all_tags()`, `create_tag()`, `delete_tag()`, `get_symbol_tags()`, `add_tag_to_symbol()`, `remove_tag_from_symbol()`

#### Backend — New API Endpoints (`server.py`)
- [x] `GET/POST /api/tags` — list all tags, create custom tags
- [x] `DELETE /api/tags/{id}` — delete non-default tags
- [x] `GET/POST/DELETE /api/watchlist/{symbol}/tags` — manage tags per symbol
- [x] `GET/PUT /api/stock/{symbol}/notes` — Markdown notes per stock
- [x] `POST /api/position-size` — ATR-based position sizing calculator (account size, risk %, symbol)
- [x] `GET /api/stock/{symbol}/fundamentals` — P/E, EPS, PEG, D/E, FCF, dividend yield, market cap, etc. via yfinance
- [x] `GET /api/stock/{symbol}/earnings` — upcoming earnings date + warning if ≤7 days (Finnhub API)
- [x] `GET /api/stock/{symbol}/news` — financial news with VADER sentiment analysis (Finnhub API)
- [x] `GET /api/stock/{symbol}/insider` — insider trading data scraped from OpenInsider
- [x] `GET /api/screener` — filter watchlist by RSI, ADX, price, trend, volume ratio, signals
- [x] `GET /favicon.ico` — redirect to SVG favicon

#### Backend — Bug Fix
- [x] **Chart date range fix** — 1mo/3mo charts were empty because SMA50 needs 50 days of warmup. Server now fetches extra historical data (1mo→6mo, 3mo→1y, etc.), computes indicators, then trims to the requested display range.

#### Frontend — New Page: Investigator (`investigator.js`)
- [x] Symbol search with autocomplete
- [x] Parallel data fetching (news, fundamentals, earnings, insider trading)
- [x] News sentiment gauge — composite score with bullish/bearish/neutral breakdown, visual gradient bar
- [x] Earnings warning cards (if earnings within 7 days)
- [x] Fundamentals grid — 12 metrics (Market Cap, P/E, Forward P/E, EPS, PEG, D/E, FCF, Div Yield, Profit Margin, ROE, Beta, 52W Range)
- [x] Insider trading table with buy/sell dollar summary and net signal
- [x] News feed with per-article sentiment badges
- [x] Two-column layout: sentiment + insider (left), news (right), fundamentals (full width)

#### Frontend — Stock Detail Enhancements (`stock.js`)
- [x] Fundamentals section — auto-loaded, 6-card grid (P/E, EPS, PEG, D/E, FCF, Div Yield)
- [x] Earnings warning banner — shows when earnings ≤7 days away
- [x] Position sizing calculator — account size + risk % inputs, shows shares/stop/TP/risk
- [x] Mini-news section — button to load top 5 articles with sentiment, links to full Investigator
- [x] Markdown notes editor — EasyMDE with toolbar, auto-save to backend

#### Frontend — Dashboard Enhancements (`dashboard.js`)
- [x] Tag filter dropdown in toolbar
- [x] Tag badges displayed on stock cards with remove buttons
- [x] Tag picker dropdown on each card to add tags
- [x] Collapsible Screener panel with filters (RSI, ADX, price, trend, signals)
- [x] Screener results table with clickable rows

#### Frontend — Signals Page Enhancements (`signals.js`)
- [x] Account size and Risk % inputs in filter bar
- [x] Position sizing columns — "Shares" and "Stop Loss" calculated inline per signal

#### Frontend — Paper Trading Enhancements (`paper.js`)
- [x] Position sizing panel — auto-appears when symbol entered, shows shares/stop/TP/risk
- [x] Configurable account size and risk % inputs

#### Frontend — Backtest Enhancements (`backtest.js`)
- [x] Metric tooltips — plain English explanations on hover for all stat cards (Total Trades, Win Rate, Avg Return, Cumulative, Buy & Hold, Edge)
- [x] Fundamental Filters — checkbox in controls bar ("Fundamental Filters") toggles filter inputs
- [x] Filters: Max P/E, Min EPS, Max D/E, Min FCF — each with plain English tooltip
- [x] Warning banner when filters fail (still runs backtest, shows which criteria failed)

#### Frontend — CSS (`styles.css`)
- [x] Tag badges, tag picker, tag remove buttons
- [x] Screener filters layout
- [x] Fundamentals grid — stacked label/value, flex column, auto-fit to fill width
- [x] News feed, article cards, sentiment badges (bullish/bearish/neutral)
- [x] Investigator layout — search bar, two-column grid, sentiment gauge
- [x] Position sizing cards
- [x] Earnings warning styling
- [x] Insider trading summary
- [x] Responsive breakpoints for all new components

#### Frontend — Infrastructure
- [x] EasyMDE CDN added to `index.html` (CSS + JS)
- [x] Investigator nav item added to sidebar
- [x] `investigator.js` script tag added
- [x] Router updated for `#/investigate/:symbol` route
- [x] SVG favicon added (dark background, green chart line with arrow)
- [x] Favicon link tag in `<head>`

#### Backend — Dependencies
- [x] `requirements.txt` — added vaderSentiment, beautifulsoup4, lxml
- [x] `.env.example` — added FINNHUB_API_KEY section
- [x] `config.py` — added FINNHUB_API_KEY

### Files Changed:

| File | Status | Purpose |
|------|--------|---------|
| `backend/server.py` | Modified | Chart warmup fix, 12+ new API endpoints, favicon redirect |
| `backend/config.py` | Modified | Added FINNHUB_API_KEY |
| `backend/database.py` | Modified | 3 new tables, seed function, 8+ CRUD functions |
| `frontend/index.html` | Modified | EasyMDE CDN, Investigator nav, favicon link |
| `frontend/js/app.js` | Modified | Added investigate route |
| `frontend/js/investigator.js` | New | Full Investigator research page |
| `frontend/js/stock.js` | Modified | Fundamentals, earnings, position sizing, notes, mini-news |
| `frontend/js/signals.js` | Modified | Position sizing columns + account/risk inputs |
| `frontend/js/dashboard.js` | Modified | Tags system, tag filtering, screener panel |
| `frontend/js/paper.js` | Modified | Position sizing panel in order form |
| `frontend/js/backtest.js` | Modified | Metric tooltips, fundamental filters checkbox UX |
| `frontend/css/styles.css` | Modified | All CSS for new components (~200 lines added) |
| `frontend/favicon.svg` | New | SVG favicon |
| `requirements.txt` | Modified | Added vaderSentiment, beautifulsoup4, lxml |
| `.env.example` | Modified | Added FINNHUB_API_KEY |

### Bugs Fixed:

- 🐛 **Chart empty on 1mo/3mo** — SMA50 needs 50 days of warmup; 1mo only has ~22 trading days. Fixed by fetching extra data with WARMUP_PERIODS map, computing indicators, then trimming.
- 🐛 **Investigator page freeze** — Sentiment gauge used `position: absolute` inside `class="indicator-bar"` which had no `position: relative`, causing the red-to-green gradient to paint over the entire viewport. Fixed by using a `position: relative` div wrapper.
- 🐛 **favicon.ico 404** — Added redirect route from `/favicon.ico` to `/static/favicon.svg`.

### Testing Notes:

- ✅ Server starts cleanly with all new imports and endpoints
- ✅ Tags API returns 8 default tags (seeded on startup)
- ✅ Position sizing API: AAPL → 237 shares, stop at $240.38
- ✅ Screener API: 6 results for max_rsi=70
- ✅ Fundamentals API: AAPL → PE=31.45, EPS=$7.91, MCap=$3.66T, FCF=$106B
- ✅ All JS files pass lint with no errors
- ✅ Investigator loads news, sentiment, fundamentals, earnings, and insider data
- ✅ Dashboard tags and screener functional
- ✅ Backtest tooltips and fundamental filter checkbox working

### Next Steps:

- [ ] Settings page — provider config, model selection, signal tuning
- [ ] GPU cooldown (sleep between LLM calls)
- [ ] Intraday timeframe support (4h, 1h candles)
- [ ] Alert notifications (email/push when signals fire)
- [ ] Deploy to Linux server

### Next Session Prompt:

> Signal Deck v2 feature expansion complete. New this session: Investigator page (news sentiment + fundamentals + insider trading + earnings), watchlist tagging system, position sizing calculator (ATR-based, available on signals/stock/paper pages), real-time screener, stock fundamentals via yfinance, earnings warnings via Finnhub, Markdown notes per stock. All pages now have position sizing. Backtest has fundamental filters with plain-English tooltips. Favicon added. Next features: Settings page, GPU cooldown, intraday support, alerts, deployment.

---

## 2026-03-29 (Session 3) — Quick-Logger, Sector Heatmap, Baskets, Widget Grid

**Focus:** Three new dashboard features (Quick-Logger, Sector Heatmap, Baskets) plus a full widget grid system using gridstack.js for customizable dashboard layouts.

### Completed:

#### Feature 1: "Overheard in the Uber" Quick-Logger
- [x] **FAB (Floating Action Button)** — green `+` button on every page, expands to input panel
- [x] **Ticker resolution** — enter anything (ticker, company name like "Palantir"), backend resolves via Alpaca validate → Alpaca search → yfinance fallback
- [x] **Backend** — `look_into_later` table in SQLite, `POST /api/quick-log`, `GET /api/quick-log`, `DELETE /api/quick-log/{id}`, `POST /api/quick-log/{id}/promote`
- [x] **Dashboard widget** — pending entries displayed with resolved ticker, time ago, promote/dismiss buttons
- [x] **Clickable entries** — resolved tickers are links to stock detail page (`#/stock/SYMBOL`), plus 🔍 Investigate button navigating to `#/investigate/SYMBOL`
- [x] **Feedback** — FAB panel shows success/warning toast after submission (resolved ticker name or fallback warning)

#### Feature 2: Sector Heatmap
- [x] **11 SPDR Sector ETFs** — XLK, XLF, XLE, XLV, XLC, XLY, XLP, XLI, XLB, XLRE, XLU
- [x] **Backend** — `GET /api/sectors/performance` fetches daily change % and market cap via yfinance
- [x] **Treemap visualization** — flex-grow proportional to market cap, red-to-green gradient based on daily change %
- [x] **Color algorithm** — maps -3% to +3% through a smooth red→neutral→green gradient

#### Feature 3: "Write What You Know" Baskets
- [x] **Custom micro-sector tracking** — group related stocks into named baskets with icons
- [x] **4 default baskets seeded** — Rideshare (UBER, LYFT, DASH, GRAB, FVRR), Crohn's/GI (ABBV, JNJ, GILD, PFE, BMY, VRTX), SysAdmin (MSFT, NOW, CRM, SNOW, NET, DDOG), AI (NVDA, GOOG, META, AMD, PLTR, AI)
- [x] **Backend** — `baskets` + `basket_tickers` tables, `GET /api/baskets`, `POST /api/baskets`, `PUT /api/baskets/{id}`, `DELETE /api/baskets/{id}`, `GET /api/baskets/{id}/metrics`
- [x] **Basket metrics** — avg RSI, avg ADX, avg daily change %, trend consensus (bullish/bearish/mixed)
- [x] **Dashboard widget** — horizontal-scroll card row, expandable detail rows per basket, edit/delete support via prompt-based editor

#### Feature 4: Draggable Widget Grid (gridstack.js)
- [x] **gridstack.js v10.3.1** — CDN loaded (CSS + JS)
- [x] **Dashboard refactored** — all sections converted to gridstack widgets with dedicated containers
- [x] **6 widgets** — Signal Alerts, Baskets, Sector Heatmap, Quick-Log, Watchlist, Screener
- [x] **Min sizes enforced** — each widget has `minW`/`minH` constraints (e.g., watchlist min 6 cols, quick-log min 3 cols)
- [x] **Edit mode** — "Customize" button in page header toggles drag/resize; edit bar appears with "Reset Layout" and "Done" buttons
- [x] **Layout persistence** — saves to `localStorage` on every change, restores on page load
- [x] **Dark theme CSS** — gridstack overrides matching existing design system (card backgrounds, dashed green borders in edit mode, green resize handles, glow on hover, themed placeholders)

### Files Changed:

| File | Status | Purpose |
|------|--------|---------|
| `backend/database.py` | Modified | Added `look_into_later`, `baskets`, `basket_tickers` tables + CRUD functions + `seed_default_baskets()` |
| `backend/server.py` | Modified | Added quick-log, sector performance, and baskets endpoint groups (11 new endpoints total) |
| `frontend/index.html` | Modified | Added FAB HTML, quick-log panel, gridstack CDN links (CSS + JS) |
| `frontend/js/app.js` | Modified | FAB show/hide on auth, quick-log panel event handlers, submit handler |
| `frontend/js/dashboard.js` | Modified | Major refactor — gridstack widget system, `initGrid()`, `getWidgetPlaceholder()`, `toggleEditMode()`, `saveLayout()`/`loadLayout()`, `loadSectorHeatmap()`, `loadBaskets()`, `loadQuickLogs()`, `refreshQuickLogs()`, `heatmapColor()` |
| `frontend/css/styles.css` | Modified | FAB, quick-log panel, sector heatmap treemap, baskets cards, quick-log review, gridstack dark theme overrides, edit mode styles, widget content padding |

### API Endpoints Added:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/quick-log` | GET | List pending quick-log entries |
| `/api/quick-log` | POST | Add entry (resolves ticker from text) |
| `/api/quick-log/{id}` | DELETE | Dismiss an entry |
| `/api/quick-log/{id}/promote` | POST | Promote entry to watchlist |
| `/api/sectors/performance` | GET | Sector ETF daily performance |
| `/api/baskets` | GET | List all baskets with tickers |
| `/api/baskets` | POST | Create a basket |
| `/api/baskets/{id}` | PUT | Update basket name/icon/tickers |
| `/api/baskets/{id}` | DELETE | Delete a basket |
| `/api/baskets/{id}/metrics` | GET | Basket aggregate metrics |

### Testing Notes:

- ✅ All 11 new API endpoints return 200 OK
- ✅ Ticker resolution works: "Palantir" → PLTR, "AAPL" → AAPL
- ✅ Sector heatmap renders with proportional sizing and color gradient
- ✅ Default baskets seeded on startup, metrics load async
- ✅ Quick-log entries are clickable — stock links and investigate buttons work
- ✅ Gridstack widgets initialize correctly with default layout
- ✅ Dashboard JS file serves at 66KB, no syntax errors

### Next Steps:

- [ ] Settings page — provider config, model selection, signal tuning
- [ ] GPU cooldown (sleep between LLM calls)
- [ ] Intraday timeframe support (4h, 1h candles)
- [ ] Alert notifications (email/push when signals fire)
- [ ] Deploy to Linux server (Nginx + systemd)

### Next Session Prompt:

> Session 3 added 3 new dashboard features + widget grid system. Quick-Logger FAB on every page with ticker resolution. Sector Heatmap treemap with 11 SPDR ETFs. Custom Baskets with metrics. Dashboard refactored to gridstack.js — 6 draggable/resizable widgets with edit mode, min sizes, and localStorage layout persistence. All tested and working. Next features: Settings page, GPU cooldown, intraday support, alerts, deployment.

---

## 2026-03-30 — Discover Hub, Actions, Calculator, Settings + Bug Fixes

**Focus:** Four major new features — Discover hub with 5 discovery sources (Matchmaker, Congress, Insider, Social, Options), Trade Actions page, What-If Calculator, and Settings page. Plus bug fixes for all three web scrapers and async event loop blocking.

### Completed:

#### Feature 1: Discover Hub — 5 Discovery Sources (`discovery.py` + `discover.js`)

**Matchmaker ("Tinder for Stocks"):**
- [x] Card-based stock discovery with swipe UI (keyboard ←/→/↓ and touch swipe gestures)
- [x] Mini price chart via LightweightCharts on each card
- [x] 8 technical metrics per card: RSI, ADX, P/E, Beta, Dividend Yield, MACD, 52W Range, Trend
- [x] 5 candidate sources: S&P 500, Congress trades, Insider buying, Social momentum, Options flow
- [x] Swipe right → add to watchlist, swipe left → dismiss, swipe down → skip
- [x] Backend resolves 50 candidates per source, deduplicates, enriches with market data

**Congress/Government Trade Tracking:**
- [x] Capitol Trades scraper — parses politician name, party (R/D/I), chamber (Senate/House), ticker, trade type, amount range, dates
- [x] Senate EFDS fallback scraper if Capitol Trades fails
- [x] Aggregation view — popular tickers grid + full trade feed table
- [x] Cache in SQLite `congress_trades` table, refresh on demand

**Insider Trading Scan (Market-Wide):**
- [x] OpenInsider scraper — market-wide scan for significant insider buys/sells
- [x] Configurable minimum value filter ($100K / $500K / $1M+)
- [x] Aggregation — net signal per ticker (bullish/bearish/neutral), buy/sell dollar totals, insider count
- [x] Card grid layout with signal badges

**Social Momentum (Reddit):**
- [x] PRAW integration — scans wallstreetbets, stocks, investing, options subreddits
- [x] $TICKER pattern extraction with noise word filtering
- [x] VADER sentiment analysis on post titles
- [x] Expandable sample posts with subreddit, upvotes, and source links
- [x] Background scheduler — auto-scans every 4 hours via APScheduler

**Options Flow Scanner:**
- [x] Unusual activity detection — high Vol/OI ratios (≥500%) and whale premium (≥$1M)
- [x] Scans first 3 nearest-term expirations per symbol
- [x] Source selector: Watchlist symbols or cached S&P 500 components
- [x] Alerts table with ticker, CALL/PUT type, strike, expiry, volume, OI, Vol/OI%, IV, premium

#### Feature 2: Trade Actions Page (`actions.js`)
- [x] Automated Buy/Sell/Hold recommendations for all watchlist symbols
- [x] Confidence levels (HIGH/MEDIUM/LOW) with color-coded badges
- [x] Expandable detail cards — recent signals, full indicator summary, reasoning text
- [x] Lookback filter (3/5/7/14 days)
- [x] Action type filter (BUY/SELL/HOLD/All) with summary count bar
- [x] "View Full Analysis" link to stock detail page

#### Feature 3: What-If Trade Calculator (`calculator.js`)
- [x] Historical trade simulation — enter symbol, buy date, sell date, and dollar amount or share count
- [x] Symbol autocomplete via `/api/symbols/search` with keyboard navigation
- [x] P&L results: entry/exit price, shares, entry/exit value, P&L ($), P&L (%), days held, annualized return
- [x] Interactive candlestick chart with buy/sell markers and price annotations
- [x] Date adjustment handling for non-trading days (weekends, holidays)

#### Feature 4: Settings Page (`settings.js`)
- [x] Social Momentum settings — scan interval, mention threshold, spike ratio, subreddit list
- [x] Options Flow tuning — Vol/OI threshold, premium threshold, S&P 500 daily scan toggle, scan time
- [x] Matchmaker settings — auto-reset dismissed stocks after N days
- [x] Reddit API credential status badge (Configured / Not Configured)
- [x] Batch save and reset-to-defaults with confirmation

#### Backend — Discovery Engine (`discovery.py`, 1,148 lines)
- [x] `get_sp500_tickers()` — Wikipedia scraper with in-memory cache + 49-ticker fallback list
- [x] `fetch_congress_trades()` — Capitol Trades multi-page scraper
- [x] `_parse_capitol_trade_row()` — 10-column parser with politician/party/chamber extraction
- [x] `_fetch_senate_efds()` — Fallback Senate EFDS scraper
- [x] `aggregate_congress_trades()` — Summarize by ticker with buy/sell counts and politician lists
- [x] `scan_reddit_mentions()` — Multi-subreddit scan with VADER sentiment
- [x] `scan_options_flow()` — Options chain analysis with Vol/OI and premium detection
- [x] `scan_insider_market_wide()` — OpenInsider market-wide scraper
- [x] `aggregate_insider_scan()` — Net signal computation per ticker
- [x] `_is_nan()` — NaN-safe helper for yfinance data

#### Backend — New Database Schema (`database.py`)
- [x] `congress_trades` table — politician, party, chamber, ticker, trade type, amount, dates
- [x] `social_mentions` table — ticker, source, subreddit, mention count, sentiment, sample posts
- [x] `options_flow` table — ticker, expiration, strike, type, volume, OI, Vol/OI ratio, IV, premium
- [x] `matchmaker_seen` table — swipe history (dismissed/watchlisted)
- [x] `app_settings` table — key/value settings with defaults
- [x] `init_discover_tables()` + `seed_default_settings()` functions
- [x] CRUD: `save_congress_trades()`, `get_congress_trades()`, `get_setting()`, `get_all_settings()`, `update_setting()`, `update_settings()`

#### Backend — New API Endpoints (`server.py`)
- [x] `GET /api/discover/congress` — Congressional trades with cache/refresh
- [x] `GET /api/discover/insider-scan` — Market-wide insider scan
- [x] `GET /api/discover/social` — Reddit social momentum
- [x] `GET /api/discover/options-flow` — Unusual options activity
- [x] `GET /api/discover/matchmaker/candidates` — 50 candidates from selected sources
- [x] `GET /api/discover/matchmaker/card/{symbol}` — Single card data with chart + indicators
- [x] `POST /api/discover/matchmaker/swipe` — Log swipe action
- [x] `GET /api/discover/matchmaker/history` — Swipe history
- [x] `GET /api/actions` — Buy/Sell/Hold recommendations
- [x] `POST /api/calculator/trade` — What-if trade scenario
- [x] `GET /api/symbols/search` — Ticker autocomplete
- [x] `GET /api/settings` — Load all settings
- [x] `PUT /api/settings` — Update multiple settings

#### Frontend — Navigation & Routing
- [x] Discover nav item with compass icon + sub-tab routing
- [x] Actions nav item (new page)
- [x] Calculator nav item (new page)
- [x] Settings nav item with gear icon + nav-divider separator
- [x] `app.js` router updated with discover, actions, calculator, settings cases
- [x] `Discover.destroy()` cleanup for keyboard listeners
- [x] Script tags added for `discover.js`, `actions.js`, `calculator.js`, `settings.js`

#### Frontend — CSS (`styles.css`, ~600 lines added)
- [x] Discover tab navigation, matchmaker card with swipe animations
- [x] Congress trade feed table, party badges (R/D/I colors)
- [x] Insider signal cards with bullish/bearish/neutral styling
- [x] Social momentum table with sentiment badges
- [x] Options flow alerts table
- [x] Actions page cards with confidence badges, expandable details
- [x] Calculator form, results grid, chart container
- [x] Settings cards with input groups and status badges
- [x] Nav divider styling

#### Backend — Dependencies & Config
- [x] `requirements.txt` — added praw>=7.7.0, APScheduler>=3.10.0
- [x] `.env.example` — added REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USER_AGENT
- [x] `config.py` — added Reddit credentials + discovery settings

### Bugs Fixed:

- 🐛 **Capitol Trades parser failure** — `_parse_capitol_trade_row()` used generic CSS selectors that couldn't handle the concatenated text format (e.g., "GE HEALTHCARE TECHNOLOGI INCGEHC:US"). Rewrote with explicit 10-column index mapping. Fixed ticker extraction: initial regex captured "CGEHC" from "INCGEHC:US"; now walks backwards through uppercase chars and strips common company suffixes (INC, CORP, LTD, LLC, CO, PLC, LP, NV, SA, SE, AG).
- 🐛 **OpenInsider column mismatch** — Market-wide insider scraper assumed 12 columns but OpenInsider has 17 (col[0] is an empty "X" link). All column indices were off by one, causing the value field to read "+4%" (delta_own) instead of "+$958,650" (actual value). The `min_value=100000` filter then excluded everything. Fixed all indices: insider at col[5], title at col[6], trade_type at col[7], price at col[8], qty at col[9], owned at col[10], delta_own at col[11], value at col[12].
- 🐛 **Options flow NaN crash** — yfinance returns `float('nan')` for volume/OI fields, and `int(nan)` raises ValueError. The `or 0` fallback doesn't catch NaN because `nan` is truthy in Python. Added `_is_nan()` helper using `math.isnan()` with try/except guarding all numeric conversions.
- 🐛 **Settings page 20-25 second load** — Blocking scraper calls (Capitol Trades, OpenInsider, yfinance) in async FastAPI endpoints blocked the entire event loop, preventing other requests from being served. Wrapped all blocking calls with `asyncio.get_event_loop().run_in_executor(None, ...)` in 4 endpoints (congress, insider-scan, options-flow, matchmaker candidates).

### Files Changed:

| File | Status | Purpose |
|------|--------|---------|
| `backend/discovery.py` | New (1,148 lines) | Discovery engine — all scraping/scanning logic |
| `backend/server.py` | Modified | 13 new API endpoints, asyncio executor wrapping, APScheduler background tasks |
| `backend/database.py` | Modified | 5 new tables, seed_default_settings(), CRUD functions |
| `backend/config.py` | Modified | Reddit credentials, discovery settings |
| `frontend/js/discover.js` | New (1,273 lines) | Discover hub — 5 sub-tabs with swipe UI |
| `frontend/js/actions.js` | New (252 lines) | Trade actions / recommendations page |
| `frontend/js/calculator.js` | New (421 lines) | What-if trade calculator |
| `frontend/js/settings.js` | New (125 lines) | Settings page — discovery tuning |
| `frontend/index.html` | Modified | Nav items, script tags, nav-divider |
| `frontend/js/app.js` | Modified | Router cases, Discover.destroy() cleanup |
| `frontend/css/styles.css` | Modified | ~600 lines of new CSS for all 4 pages |
| `requirements.txt` | Modified | Added praw, APScheduler |
| `.env.example` | Modified | Added Reddit API credentials section |

### Testing Notes:

- ✅ Capitol Trades scraper returns 7 results with correct ticker extraction (GEHC verified)
- ✅ OpenInsider market-wide scan returns 13 insider trades
- ✅ Options flow handles NaN gracefully — 0 results on weekends (expected; OI=0 from yfinance on non-trading days)
- ✅ Settings page loads quickly after async fix
- ✅ Matchmaker card swipe works with keyboard and touch
- ✅ All 13 new API endpoints return 200 OK
- ✅ APScheduler background tasks start on server boot (social: every 4h, options: 09:45)
- ⚠️ Reddit social scanning requires REDDIT_CLIENT_ID/SECRET in .env (not configured = empty results)
- ⚠️ Options flow shows 0 results on weekends — yfinance reports OI=0 for all expirations outside market hours

### Known Limitations:

- **Options Flow weekend gap** — yfinance doesn't report open interest on weekends. Scanner will find activity on weekday scans.
- **Reddit API required** — Social momentum tab requires Reddit API credentials (free at reddit.com/prefs/apps). Without them, tab shows "not configured" message.
- **Capitol Trades rate limits** — Aggressive scraping may trigger rate limits. Cached in SQLite to minimize requests.

### Next Steps:

- [ ] GPU cooldown (sleep between LLM calls)
- [ ] Intraday timeframe support (4h, 1h candles)
- [ ] Alert notifications (email/push when signals fire)
- [ ] Deploy to Linux server (Nginx + systemd)

### Next Session Prompt:

> Session added 4 major features: Discover hub (Matchmaker swipe UI + Congress + Insider + Social + Options flow), Trade Actions page (automated recommendations), What-If Calculator, and Settings page. Created `discovery.py` (1,148 lines) and 4 new frontend JS modules. Fixed 4 bugs: Capitol Trades parser, OpenInsider column indices, yfinance NaN handling, async event loop blocking. All scrapers verified working. Server runs on port 8005. Next: GPU cooldown, intraday support, alerts, deployment.

---

## 2026-03-30 (Session 2) — Stock Detail Page Gridstack Rewrite + New Widgets

**Focus:** Complete rewrite of the stock detail page — converted from a static 2-column layout to a gridstack.js widget system with draggable/resizable sections, added 4 new widgets (Related Stocks, Insider Trading, Social Trending, Trade Calculator), added chart hover tooltips, company name in header, and EasyMDE dark mode CSS.

### Completed:

#### Stock Detail Page — Gridstack Widget System (`stock.js`)
- [x] **Full rewrite** — replaced old 2-column layout with gridstack.js 10.3.1 widget grid
- [x] **15 widgets** — Chart, Indicators, Signal Recommendation, Earnings, Related Stocks, Active Signals, Fundamentals, Insider Trading, Recent News, Social Trending, Position Sizing, Notes, Trade Calculator, Saved Simulations, LLM Analysis
- [x] **Edit mode** — "Customize" button toggles drag/resize with visual handles (same UX as dashboard)
- [x] **Global layout persistence** — saved to `localStorage` key `sd_stock_detail_layout` (shared across all symbols)
- [x] **Reset Layout** button — clears saved layout and reverts to defaults
- [x] **Min sizes** — enforced per widget (e.g., chart ≥ 4×6, notes ≥ 3×3)

#### New Feature: Company Name in Header
- [x] Company name displayed below symbol in stock detail header (e.g., "Apple Inc.")
- [x] Populated from fundamentals API response (`data.name`)

#### New Feature: Chart Hover Tooltip (OHLCV)
- [x] Crosshair move subscription on candlestick chart
- [x] Floating tooltip shows Open, High, Low, Close, Volume on hover
- [x] Positioned near crosshair, dark themed, auto-hides when cursor leaves chart

#### New Feature: Related Stocks / Sympathy Play Widget
- [x] Finnhub `/stock/peers` API integration
- [x] Clickable peer cards with daily % change (green/red color coding)
- [x] Cards link to stock detail page for each peer

#### New Feature: Insider Trading Widget (Light Copy from Investigator)
- [x] Calls existing `/api/stock/{symbol}/insider` endpoint
- [x] Summary bar — total buys, total sells, net signal badge (bullish/bearish/neutral)
- [x] Paginated trade table — 5 rows at a time with "Show more" button
- [x] Columns: Date, Insider, Title, Type, Shares, Value

#### New Feature: Social Trending Widget
- [x] Calls new `/api/stock/{symbol}/social` endpoint
- [x] Shows sentiment score, mention count, sentiment label
- [x] Recent posts list with subreddit badges and upvote counts
- [x] Empty state when Reddit API is not configured (explains how to set up)

#### New Feature: Indicators Flow Layout
- [x] Indicators now render in a CSS grid with `auto-fit, minmax(140px, 1fr)` wrap
- [x] Cards reflow dynamically when widget is resized

#### EasyMDE Dark Mode CSS
- [x] Comprehensive CSS overrides for EasyMDE markdown editor
- [x] Toolbar, editor area, preview pane, status bar, syntax highlighting all themed
- [x] Uses existing CSS custom properties (--bg-card, --border, --text-primary, etc.)
- [x] Fullscreen mode, scrollbars, and cursor all styled

#### Backend — New API Endpoints (`server.py`)
- [x] `GET /api/stock/{symbol}/peers` — Finnhub peers API + yfinance price enrichment (name, price, daily change %)
- [x] `GET /api/stock/{symbol}/social` — Reddit social mentions for a specific symbol from cached data, with `configured: true/false` indicator for empty state

### Files Changed:

| File | Status | Purpose |
|------|--------|---------|
| `frontend/js/stock.js` | Rewritten (~1,100 lines) | Gridstack widget system, 15 widgets, all new features |
| `backend/server.py` | Modified | 2 new API endpoints (peers, social) |
| `frontend/css/styles.css` | Modified | ~300+ lines: stock gridstack, chart tooltip, indicators flow, related stocks, social trending, EasyMDE dark mode |

### Testing Notes:

- ✅ Server starts cleanly — all new endpoints registered
- ✅ `/api/stock/AAPL/peers` → 200 OK (returns peer symbols with prices)
- ✅ `/api/stock/AAPL/social` → 200 OK (returns social data or empty state)
- ✅ `/api/stock/AAPL/insider` → 200 OK
- ✅ All existing endpoints still functional (fundamentals, earnings, notes)
- ✅ JS syntax validation passed
- ✅ Python syntax validation passed
- ✅ Backup of original stock.js saved as stock.js.bak

### Next Steps:

- [ ] GPU cooldown (sleep between LLM calls)
- [ ] Intraday timeframe support (4h, 1h candles)
- [ ] Alert notifications (email/push when signals fire)
- [ ] Deploy to Linux server (Nginx + systemd)

### Next Session Prompt:

> Stock detail page completely rewritten with gridstack.js widget system — 15 draggable/resizable widgets with global layout persistence. New widgets: Related Stocks (Finnhub peers), Insider Trading, Social Trending (Reddit), Trade Calculator. Chart now has OHLCV hover tooltip. Company name shows in header. EasyMDE notes editor has dark mode CSS. Two new backend endpoints: /api/stock/{symbol}/peers and /api/stock/{symbol}/social. All tested and working on port 8005. Next: GPU cooldown, intraday support, alerts, deployment.

---

## 2026-03-30 (Session 3) — Mobile UX Overhaul

**Focus:** Comprehensive mobile improvements — replaced always-visible sidebar with hamburger menu + drawer, separated mobile/desktop layout persistence, fixed overflow and layout issues across all pages, added touch-friendly scroll handle for gridstack edit mode.

### Completed:

#### Mobile Navigation — Hamburger Menu + Sidebar Drawer (`index.html`, `styles.css`, `app.js`)
- [x] Replaced thin always-visible sidebar on mobile with a floating hamburger menu button (☰)
- [x] Sidebar slides in from the left as an 80vw drawer overlay on tap
- [x] Semi-transparent backdrop overlay — tap outside to close
- [x] Nav items auto-close drawer on selection
- [x] Hamburger button only visible at ≤768px breakpoint
- [x] Desktop sidebar behavior unchanged

#### Separate Mobile / Desktop Layout Persistence (`dashboard.js`, `stock.js`)
- [x] New localStorage keys: `sd_dashboard_layout_mobile` and `sd_stock_detail_layout_mobile`
- [x] `getLayoutKey()` helper in both modules — returns mobile or desktop key based on `App.isMobile()` (matchMedia check)
- [x] Mobile and desktop can have completely independent widget arrangements
- [x] Reset Layout respects current device — only clears the active key

#### Dashboard Header Reflow (`styles.css`)
- [x] Page title centers on its own line at ≤768px
- [x] Action buttons (Customize, Reset Layout) wrap to a row below the title
- [x] Prevents header from being too wide or clipping on small screens

#### Gridstack Edit Mode — Scroll Handle (`dashboard.js`, `stock.js`, `styles.css`)
- [x] Fixed bottom bar appears during edit mode with ▲ / ▼ scroll buttons
- [x] Press-and-hold triggers continuous scrolling of `#main-content`
- [x] Solves the problem of not being able to scroll while dragging widgets on touch devices
- [x] Auto-removed when exiting edit mode

#### Paper Trading Overflow Fix (`styles.css`)
- [x] Paper trading cards and tables constrained to viewport width
- [x] `overflow-x: auto` on table wrappers prevents horizontal page scroll
- [x] Column layout stacks on mobile

#### Stock Detail Header Wrap (`styles.css`)
- [x] Stock detail header elements wrap properly on narrow screens
- [x] Action buttons flow below the title/price area

#### Investigator Page Overflow Fix (`styles.css`)
- [x] Investigation sections constrained with `overflow: hidden` / `overflow-x: auto`
- [x] Tables get `max-width: calc(100vw - 32px)` to prevent horizontal blowout
- [x] News cards and sentiment sections stack cleanly

#### Bottom Cutoff Fix — All Pages (`styles.css`)
- [x] App container uses `min-height: 100dvh` (dynamic viewport height) instead of `100vh`
- [x] Accounts for mobile browser chrome (address bar, bottom nav)
- [x] Added `padding-bottom: 32px` to main content for breathing room

#### Cache Busting (`index.html`)
- [x] All CSS/JS `<link>` and `<script>` tags updated with `?v=3` query string
- [x] Forces mobile browsers to fetch updated assets instead of serving stale cache

### Files Changed:

| File | Status | Purpose |
|------|--------|---------|
| `frontend/index.html` | Modified | Hamburger button + sidebar overlay HTML, cache-bust `?v=3` on all static refs |
| `frontend/css/styles.css` | Modified | ~150 lines: hamburger-btn, sidebar-overlay, drawer styles, dashboard header reflow, scroll handle, paper trading overflow, stock detail header wrap, investigator overflow, bottom cutoff fix, card/table containment |
| `frontend/js/app.js` | Modified | `closeMobileSidebar()`, `isMobile()`, hamburger toggle listeners, nav-item close-on-click |
| `frontend/js/dashboard.js` | Modified | `LAYOUT_KEY_MOBILE`, `getLayoutKey()`, `showScrollHandle()`, `hideScrollHandle()` |
| `frontend/js/stock.js` | Modified | Same as dashboard.js — mobile layout key + scroll handle methods |

### Testing Notes:

- ✅ Hamburger menu opens/closes drawer correctly on mobile
- ✅ Overlay backdrop dismisses sidebar on tap
- ✅ Nav items close sidebar and navigate
- ✅ Desktop layout completely unaffected (hamburger hidden, sidebar static)
- ✅ Dashboard and stock detail save/restore separate layouts per device
- ✅ Scroll handle appears in edit mode, scrolls smoothly, removed on exit
- ✅ No horizontal overflow on Paper Trading, Investigator, or Stock Detail pages
- ✅ Bottom content no longer cut off on mobile browsers
- ✅ Cache bust forces fresh asset load on real devices
- ✅ No JS/CSS errors in any modified files

### Next Steps:

- [ ] GPU cooldown (sleep between LLM calls)
- [ ] Intraday timeframe support (4h, 1h candles)
- [ ] Alert notifications (email/push when signals fire)
- [ ] Deploy to Linux server (Nginx + systemd)

### Next Session Prompt:

> Mobile UX overhaul complete. Sidebar replaced with hamburger menu + 80vw drawer overlay. Dashboard and stock detail have separate mobile/desktop layout persistence via `getLayoutKey()`. Gridstack edit mode has a scroll handle bar for touch devices. Overflow fixed across Paper Trading, Investigator, Stock Detail. Bottom cutoff fixed with `100dvh` + padding. All static assets cache-busted at `?v=3`. Server runs on port 8005. Next: GPU cooldown, intraday support, alerts, deployment.

---

## 2026-03-30 (Session 4) — Macro Economic Warning System + Performance Analytics

**Focus:** Two new features — Macro Economic Warning System (curated economic calendar with market status banners) and Live Performance Analytics page. Also added Alpha Vantage API integration, sidebar reorganization, and event clickability/past-event display.

### Completed:

#### Feature 1: Macro Economic Warning System

**Backend — Economic Events Engine (`economic_events.py`, new file)**
- [x] Curated 2025-2026 economic calendar: FOMC (8/year), CPI (12/year), Jobs Report (12/year), GDP (4/year)
- [x] Dates from Federal Reserve, BLS, and BEA published schedules
- [x] Sector-to-category relevance mapping (e.g., Financial → fed/gdp, Consumer → inflation/employment)
- [x] Index tickers (SPY, QQQ, etc.) get all event categories
- [x] Finnhub economic calendar supplement (medium + high impact events)
- [x] Alpha Vantage economic indicator supplement (when API key configured)
- [x] In-memory cache with 1-hour TTL, deduplication across sources
- [x] **Past 7 days included** — recently passed events returned with `passed: true` flag
- [x] `get_upcoming_events(days_ahead)` — all events within lookback + lookahead window
- [x] `get_events_for_stock(symbol, sector)` — sector-filtered events

**Backend — API Endpoints (`server.py`)**
- [x] `GET /api/economic-events?days=30` — all upcoming + recent macro events
- [x] `GET /api/stock/{symbol}/economic-events?days=30` — sector-filtered events (auto-detects sector via yfinance)
- [x] Config endpoint updated: `alpha_vantage_available` flag added

**Frontend — Dashboard Market Status Widget (`dashboard.js`)**
- [x] New gridstack widget: `market-status` (12 cols wide, top of dashboard)
- [x] Color-coded banner: 🔴 red (≤1 day), 🟡 yellow (≤3 days), 🟢 green (>3 days)
- [x] Nearest event headline with countdown (TODAY / TOMORROW / in N days)
- [x] Impact badge (HIGH/MEDIUM)
- [x] Next 5 upcoming events with category icons (🏦 Fed, 📊 Inflation, 👔 Employment, 📈 GDP)
- [x] "Recently Passed" divider with last 3 past events (dimmed styling)
- [x] **All events clickable** — links to Google search for event title + date + "results"
- [x] "All Clear" state when no events within 14 days

**Frontend — Stock Detail Macro Events Widget (`stock.js`)**
- [x] New gridstack widget: `macro-events` (6 cols wide)
- [x] Sector-filtered events — only shows categories relevant to the stock's sector
- [x] Same clickable event items with past events and urgency styling
- [x] Compact layout for widget context

#### Feature 2: Live Performance Analytics Page

**Backend — Performance API Endpoints (`server.py`)**
- [x] `GET /api/performance/summary?period=all` — 14 advanced metrics:
  - Win rate, profit factor, expectancy, max drawdown
  - Sharpe ratio (approximated), risk/reward ratio
  - Best trade, worst trade, consecutive wins/losses
  - Average trade duration, total P&L
  - Total trades, average return
- [x] `GET /api/performance/equity-curve?period=all` — equity timeline data
  - Alpaca mode: uses `get_portfolio_history()` API
  - Local fallback: builds curve from paper trades starting at $200
- [x] `GET /api/performance/by-tag?period=all` — win rate and P&L breakdown by watchlist tag
- [x] Helper functions: `_get_performance_trades()`, `_filter_trades_by_period()`, `_calc_max_drawdown()`, `_calc_consecutive()`, `_calc_avg_duration()`
- [x] Auto-detects Alpaca vs local paper trades (same pattern as Paper Trading page)

**Frontend — Performance Page (`performance.js`, new file)**
- [x] Period filter: 1W, 1M, 3M, 6M, 1Y, All Time
- [x] 14 metric cards in responsive grid — color-coded positive (green) / negative (red)
- [x] Equity curve chart via TradingView Lightweight Charts (area chart)
- [x] Win rate by tag — horizontal bar chart per watchlist tag
- [x] Trade distribution — SVG donut chart with win/loss breakdown
- [x] Empty state directing users to Paper Trading page when no trades exist

#### Sidebar Reorganization
- [x] New nav order: Dashboard → Discover → Investigator → Signals → Backtest → Paper Trading → Performance → [divider] → Settings
- [x] Represents "the entire process in a common sense order" per user request
- [x] Performance nav item with bar-chart SVG icon

#### Infrastructure & Config
- [x] `ALPHA_VANTAGE_API_KEY` added to `config.py`
- [x] `.env.example` updated with Alpha Vantage placeholder
- [x] Cache-busting versions bumped to `?v=5` on all CSS/JS tags in `index.html`

### CSS Added (~450 lines):
- [x] Market status banner: `.market-status-banner`, `.market-status-red/yellow/clear`
- [x] Event items: `.market-event-item`, `.event-urgent/warning/safe/passed`
- [x] Event divider: `.market-event-divider` with decorative line
- [x] Clickable events: hover turns text blue, cursor pointer
- [x] Past events: dimmed opacity (0.55), muted badge styling
- [x] Impact badges: `.impact-high/medium`
- [x] Performance page: `.perf-metrics-grid`, `.perf-metric-card`, `.metric-positive/negative`
- [x] Equity curve and tag chart containers
- [x] Donut chart: `.perf-donut-*` styles
- [x] Responsive breakpoints for all new components

### Bugs Fixed / Issues Resolved:
- 🐛 **Browser cache serving stale files** — Initial `?v=3` cache-bust strings were identical to previous session. Bumped through `v=4` → `v=5` across iterations.
- 🐛 **VS Code SSH port forwarding hijack** — VS Code's `remote.autoForwardPorts` feature was listening on `127.0.0.1:8005` and proxying cached content from a remote SSH session. Fixed by killing old Python process and restarting. Advised user to disable `remote.autoForwardPorts` in VS Code settings.
- 🐛 **Old server process not killed** — Server PID from previous session was still running; new restarts spawned second processes. Required explicit `Stop-Process` by PID before restart.
- 🐛 **httpx not in requirements** — Initially wrote `economic_events.py` with `httpx`; switched to `requests` (already a dependency).

### Files Changed:

| File | Status | Purpose |
|------|--------|---------|
| `backend/economic_events.py` | New | Curated economic calendar + API supplements |
| `backend/server.py` | Modified | 6 new endpoints (3 economic, 3 performance), config flag |
| `backend/config.py` | Modified | Added `ALPHA_VANTAGE_API_KEY` |
| `frontend/js/performance.js` | New | Performance analytics page |
| `frontend/js/dashboard.js` | Modified | Market status widget added to gridstack |
| `frontend/js/stock.js` | Modified | Macro events widget added to gridstack |
| `frontend/js/app.js` | Modified | Added `performance` router case |
| `frontend/index.html` | Modified | Sidebar reordered, Performance nav item, `performance.js` script, cache-bust `?v=5` |
| `frontend/css/styles.css` | Modified | ~450 lines for market status + performance page |
| `.env.example` | Modified | Added `ALPHA_VANTAGE_API_KEY` |

### Testing Notes:

- ✅ Server starts cleanly — all new endpoints registered, Alpaca connected
- ✅ `/api/economic-events?days=14` returns upcoming FOMC, CPI, Jobs, GDP events
- ✅ `/api/stock/AAPL/economic-events` returns sector-filtered events (Technology → fed, inflation, gdp)
- ✅ Dashboard Market Status widget renders with color-coded banner and event list
- ✅ Stock detail Macro Events widget shows sector-relevant events
- ✅ All events are clickable — open Google search in new tab
- ✅ Performance page renders skeleton correctly (empty state since no paper trades yet)
- ✅ Sidebar reflects new nav order
- ✅ Cache-busting confirmed working (server serves `v=5` files)
- ⚠️ No recently passed events visible (expected — last events were FOMC 3/18 and CPI 3/11, both >7 days ago; next events start 4/3)
- ⚠️ Performance page shows empty state — user hasn't done paper trading yet

### Next Steps:

- [ ] GPU cooldown (sleep between LLM calls)
- [ ] Intraday timeframe support (4h, 1h candles)
- [ ] Alert notifications (email/push when signals fire)
- [ ] Deploy to Linux server (Nginx + systemd)

### Next Session Prompt:

> Session added Macro Economic Warning System (curated 2025-2026 calendar with Finnhub + Alpha Vantage supplements, dashboard banner + stock detail widget, clickable events with past 7 days shown) and Performance Analytics page (14 metrics, equity curve, win rate by tag, trade distribution donut). Sidebar reordered to logical flow. New backend module `economic_events.py`. Alpha Vantage API integrated. Cache-busting at `?v=5`. Server runs on port 8005. Next: GPU cooldown, intraday support, alerts, deployment.

---

## 2026-03-30 (Sessions 5–7) — React + Vite Migration (Phases 1–7)

**Focus:** Complete frontend rewrite from vanilla JS/CSS/HTML to React + Vite SPA. Followed the 7-phase plan in `docs/dev/Migration-Plan.md`.

### Completed:

All 7 phases of the migration plan executed:

- **Phase 1** — Project scaffolding: Vite config (`base: '/static/'`, `outDir: '../frontend-build'`), React Router HashRouter, Zustand stores (auth + app), TanStack Query client, API fetch wrapper with JWT auth
- **Phase 2** — Shell + auth: App layout, Sidebar component, LoginPage, ToastContainer, QuickLogFab, ErrorBoundary, mobile hamburger menu
- **Phase 3** — Dashboard page: 7 widget components (Market Status, Signals, Baskets, Sector Heatmap, Quick-Log, Watchlist, Screener) + WidgetGrid via react-grid-layout + AddSymbolModal
- **Phase 4** — Stock detail page: 16 widget components (Chart, Indicators, Action Card, Earnings, Related Stocks, Macro Events, Signals, Fundamentals, Insider, News, Social, Position Sizing, Notes, Trade Calculator, Saved Simulations, LLM Analysis) + PriceChart with TradingView Lightweight Charts
- **Phase 5** — Remaining pages: Signals, Backtest, Paper Trading (Alpaca + local), Investigator, Discover (5-tab hub), Actions, Calculator, Performance, Settings
- **Phase 6** — Shared components + utilities: formatters.js, calculations.js, LoadingSkeleton, EmptyState, PageHeader, MetricCard, Modal, FilterBar, AreaChart
- **Phase 7** — Testing + deployment config: 43 Vitest tests (formatters, calculations, API client, signals), Vite build verified, backend `server.py` updated to serve `frontend-build/` with SPA catch-all route

### Backend Changes for Migration (`server.py`):
- [x] `frontend_build_dir` preferred over `frontend_dir` when `frontend-build/` exists
- [x] Static files mounted at `/static` from the active frontend directory
- [x] SPA catch-all `GET /{full_path:path}` added as last route for React Router client-side navigation

### Tech Stack:
- Vite 8.0.3, React 19, React Router v6 (HashRouter), Zustand, TanStack Query v5
- lightweight-charts 5.1.0, react-grid-layout 2.2.3, EasyMDE (kept for notes)
- Vitest 4.1.2 (43 tests), ESLint

### Migration Artifacts:
- Source: `frontend-react/` (full React project)
- Build output: `frontend-build/` (served by backend)
- Original frontend: `frontend/` (preserved, unused when build exists)
- Plan doc: `docs/dev/Migration-Plan.md`

---

## 2026-03-30 (Sessions 8–9) — Post-Migration Bug Fixes

**Focus:** Two rounds of bug fixing after the React migration was deployed and manually tested across all pages.

### Round 1 — Critical Rendering Fixes:

- 🐛 **Dashboard completely empty** — `react-grid-layout` v2.2.3's `useContainerWidth()` returns `{width, containerRef}` object, not a plain number. Code assigned the object to `width`, so `width > 0` was always falsy → grid never rendered. Fixed destructuring in `WidgetGrid.jsx`.
- 🐛 **Paper Trading API paths** — `usePaperTrading.js` used `/api/alpaca/*` but server uses `/api/paper/*` for all paper trading. Fixed all endpoint URLs with proper Alpaca/Local conditional routing.
- 🐛 **SPA catch-all intercepting API routes** — The `/{full_path:path}` catch-all was returning `index.html` for some API requests. Confirmed it only affects routes not explicitly defined above it.

### Round 2 — Crashes, Styling, and Feature Parity:

**Crashes fixed:**
- 🐛 **Investigator `toFixed` crash** — Insider API returns strings like `"$271.23"` and `"-$1,017,655"`. `formatPrice`, `formatNumber`, `formatChange` now strip `$`,`,` and coerce to Number before formatting.
- 🐛 **Backtest `addAreaSeries` crash** — lightweight-charts v5 removed `chart.addAreaSeries()`. Updated `AreaChart.jsx` and `PriceChart.jsx` to use v5 API: `chart.addSeries(AreaSeries, {...})`, etc.
- 🐛 **Related Stocks crash** — API returns `{symbol, peers: [...]}` but widget called `.map()` on the wrapper object. Fixed data access in `RelatedStocksWidget.jsx`.

**Missing features restored:**
- 🐛 **Screener widget missing** — `useGridLayout` hook didn't merge new default widgets into saved layouts. Fixed hook + Screener defaults to expanded.
- 🐛 **Matchmaker card restyled** — Rewrote card to use original CSS classes, added mini candlestick chart via new `MiniCandlestickChart.jsx`, added 52-week range + 1-month return.

**Styling fixes:**
- 🐛 **CSS class mismatches** — React components used generic class names (`.data-table`, `.badge`, `.input`, `.btn-success`, `.page-content`) that didn't exist in the legacy `styles.css`. Added ~200 lines of generic CSS rules.
- 🐛 **Missing CSS variables** — Components referenced `var(--bullish)` / `var(--bearish)` but only `--green` / `--red` were defined. Added aliases.
- 🐛 **Stock detail grid overlapping** — Widget heights too small. Increased heights and fixed y-coordinate spacing.

**Infrastructure:**
- [x] Cache-busting headers — `Cache-Control: no-store` on all `index.html` responses

### Files Changed (Bug Fix Rounds):

| File | Changes |
|------|---------|
| `frontend-react/src/components/ui/WidgetGrid.jsx` | `useContainerWidth()` destructuring fix |
| `frontend-react/src/components/ui/AreaChart.jsx` | lightweight-charts v5 API |
| `frontend-react/src/components/ui/PriceChart.jsx` | lightweight-charts v5 API (4 series types) |
| `frontend-react/src/components/ui/MiniCandlestickChart.jsx` | New — mini chart for Matchmaker |
| `frontend-react/src/utils/formatters.js` | Safe string-to-number coercion |
| `frontend-react/src/hooks/usePaperTrading.js` | Fixed API endpoint paths |
| `frontend-react/src/hooks/useGridLayout.js` | Merge missing widgets from defaults |
| `frontend-react/src/components/stock/RelatedStocksWidget.jsx` | Fixed `peers.peers` data access |
| `frontend-react/src/components/dashboard/ScreenerWidget.jsx` | Default to expanded |
| `frontend-react/src/pages/StockDetailPage.jsx` | Increased widget grid heights |
| `frontend-react/src/pages/DiscoverPage.jsx` | Matchmaker card rewrite + proper CSS classes |
| `frontend-react/src/styles/styles.css` | ~200 lines: generic classes, CSS variable aliases |
| `backend/server.py` | `Cache-Control: no-store` on index.html responses |

### Testing Notes:

- ✅ Build: 191 modules, no errors
- ✅ Tests: 43/43 passing
- ✅ Server: 200 OK
- ⚠️ Manual testing in progress — some styling gaps may remain

### Next Steps:

- [x] Continue manual testing across all pages for remaining styling gaps → done in Sessions 10–11
- [ ] GPU cooldown (sleep between LLM calls)
- [ ] Intraday timeframe support
- [ ] Alert notifications
- [ ] Deploy to Linux server (Nginx + systemd)
- [ ] Login rate limiting (`slowapi`)

---

## 2026-03-31 (Sessions 10–11) — Post-Migration Bug Fixes Round 3–4

**Focus:** Continued manual testing and bug fixing across all pages. Four rounds of targeted fixes addressing crashes, missing features, styling gaps, and UX polish.

### Round 3 — Missing Components, Styling, and Discover Page Overhaul:

**Missing components recreated:**
- 🐛 **EarningsWidget deleted** — File was deleted in prior session but never recreated. Created new `EarningsWidget.jsx` with correct API field mapping (`data.upcoming?.date`, `data.upcoming?.days_until`, earnings warning for ≤7 days).

**CSS additions (~100 lines):**
- `.search-fab` / `.search-panel` / `.search-results-list` / `.search-result-item` — Quick search overlay styling
- `.indicator-bar-fill` with `.bullish-fill` / `.bearish-fill` — colored indicator bar fills
- `.sentiment-gauge` / `.sentiment-bar` — sentiment analysis gauge component

**Discover page overhaul (all 5 tabs):**
- **Matchmaker** — centered card layout (`maxWidth: 520px`, `margin: 0 auto`)
- **Government** — bigger popular ticker cards with blue top border, spelled-out buy/sell counts ("3 buys · 2 sells · 5 politicians"), colored left borders on trade rows
- **Insider** — added "Market-Wide Insider Trading" header, colored left borders on cards based on signal
- **Options** — added "Unusual Options Activity" header, summary count cards (Alerts/Tickers) above table

**Settings page:** Changed from CSS grid layout to vertical stacked layout (`flexDirection: column`, `maxWidth: 600px`)

### Round 4 — Crashes and Feature Fixes:

**Crashes fixed:**
- 🐛 **Trade calculator `setMarkers` crash** — lightweight-charts v5 removed `series.setMarkers()`. Updated to use `createSeriesMarkers(series, markers)` (imported from `lightweight-charts`). Also fixed date field to use `actual_entry_date`/`actual_exit_date` fallbacks.
- 🐛 **Trade calculator missing metrics** — backend returns `pnl_dollars`/`pnl_pct` but frontend read `pnl`/`return_pct`. Fixed with fallback pattern: `result.pnl_dollars ?? result.pnl`.
- 🐛 **Saved simulations widget blank** — Same field name mismatch: `s.pnl_dollars ?? s.pnl`, `s.pnl_pct ?? s.return_pct`, `s.entry_value || s.invested || s.amount`.

**Feature fixes:**
- 🐛 **Options scan button not working** — `refetch()` only re-runs query with cached URL; backend requires `refresh=true` to trigger fresh scan. Rewrote to use manual `handleScan()` function with `get(/api/discover/options-flow?source=${source}&refresh=true)` + `queryClient.invalidateQueries()`.
- 🐛 **Government type badges all green** — Backend returns `"Sell"` but frontend checked `.includes('sale')`. Changed to regex: `/sell|sale/i.test(...)`.

**UX improvements:**
- 🐛 **Chart tooltip fixed position** — OHLCV tooltip was pinned to top-left corner (`top: 8, left: 8`). Now follows cursor using `param.point` coordinates, flips to left side near right edge, with border + shadow for better visibility.

### Files Changed (Sessions 10–11):

| File | Changes |
|------|---------|
| `frontend-react/src/components/stock/EarningsWidget.jsx` | Created — upcoming earnings with warning styling |
| `frontend-react/src/components/stock/TradeCalculatorWidget.jsx` | `createSeriesMarkers` import + v5 API fix, field name mapping |
| `frontend-react/src/components/stock/SavedSimulationsWidget.jsx` | Field name fallback mapping |
| `frontend-react/src/components/stock/StockPriceChart.jsx` | Cursor-following tooltip with edge detection |
| `frontend-react/src/pages/DiscoverPage.jsx` | All 5 tabs restyled, Options scan fix, Government badge fix |
| `frontend-react/src/pages/SettingsPage.jsx` | Grid → vertical stack layout |
| `frontend-react/src/styles/styles.css` | ~100 lines: search-fab, indicator bars, sentiment gauge |

### Testing Notes:

- ✅ Build: 191 modules, no errors (358ms)
- ✅ Tests: 43/43 passing
- ✅ Cache busting confirmed — `index.html` served with `Cache-Control: no-store`, JS/CSS assets use content-hash filenames

### Next Steps:

- [ ] Continue manual testing — some styling gaps may remain across pages
- [ ] GPU cooldown (sleep between LLM calls)
- [ ] Intraday timeframe support
- [ ] Alert notifications
- [ ] Deploy to Linux server (Nginx + systemd)
- [ ] Login rate limiting (`slowapi`)

### Next Session Prompt:

> React + Vite migration complete. Four rounds of post-migration bug fixes across Sessions 8–11. Key v5 API pattern: `chart.addSeries(SeriesType, opts)` and `createSeriesMarkers(series, markers)`. Backend field names: `pnl_dollars`/`pnl_pct` (not `pnl`/`return_pct`). Trade types from backend: `"Buy"`/`"Sell"` (not "Sale"/"Purchase"). Options scan requires `refresh=true` query param. Cache busting in place (`no-store` on index.html, content-hash filenames on assets). Build: 191 modules, 43 tests. Some pages may still have styling gaps — continue manual testing. Source at `frontend-react/`, build at `frontend-build/`.

---

## 2026-03-31 (Session 12) — Widget Grid v2 Fixes, Paper Trading Overhaul, Deployment Prep

**Focus:** Fixed react-grid-layout v2 API mismatches (drag/resize always enabled, widget heights tripled), overhauled Paper Trading page with 5 sub-tabs mirroring Alpaca dashboard, added `frontend-build/` to `.gitignore`, deployment preparation.

### Completed:

#### react-grid-layout v2 API Fixes (`WidgetGrid.jsx`)

Three v1→v2 API mismatches were causing bugs across Dashboard and Stock Detail:

1. **Drag/resize always enabled** — v1 flat props (`isDraggable`, `isResizable`, `draggableHandle`) are silently ignored in v2. Fixed by using v2 config objects: `dragConfig={{ enabled: editMode }}`, `resizeConfig={{ enabled: editMode }}`.
2. **Widget heights tripled** — `rowHeight` and `margin` were wrapped in a `gridConfig` object, but `ResponsiveGridLayout` in v2 exposes these as top-level props (unlike `GridLayout` which uses `gridConfig`). `rowHeight` defaulted to 150px instead of intended 50px. Moved to top-level props.
3. **Infinite chart zoom loop** — Adding `display: flex; justify-content: center; align-items: center` to `.widget-body` caused an infinite layout feedback loop between the chart's ResizeObserver and the flex container. Removed global centering, added opt-in `.widget-body-centered` class.

#### Paper Trading Page — Complete Overhaul

Rewrote `PaperTradingPage.jsx` from a single flat page to a tabbed interface with 5 sub-tabs:

**Dashboard Tab (`PaperDashboardTab.jsx`):**
- [x] Account metrics displayed as card grid (portfolio value, cash, buying power, etc.) — fills page width
- [x] Widget grid with 5 widgets: Account Metrics, Place Order, Open Positions, Recent Orders, Equity Chart
- [x] Customize/Reset layout support via existing WidgetGrid system
- [x] Alpaca Dashboard external link button (🦙) in page header
- [x] Refresh button with local-time sync timestamp

**Positions Tab (`PositionsTab.jsx`):**
- [x] Sub-tabs: All, Long, Short, Options
- [x] Asset class filter dropdown
- [x] Column picker — 15 columns (symbol, qty, side, avg entry, current price, market value, unrealized P&L, unrealized P&L %, cost basis, change today, change today %, asset class, exchange, qty available, lastday price)
- [x] Clickable symbols → stock detail page

**Orders Tab (`OrdersTab.jsx`):**
- [x] Status filter (all/open/closed/new/partially_filled/filled/canceled/expired/pending_new/accepted/replaced/stopped/rejected/suspended/pending_cancel/pending_replace)
- [x] Side filter (all/buy/sell)
- [x] Column picker — 20 columns (symbol, side, type, qty, filled qty, filled avg price, limit price, stop price, status, time in force, order class, trail price, trail percent, hwm, extended hours, notional, subtag, source, submitted at, filled at)
- [x] Pagination (50 per page)
- [x] Cancel order button
- [x] Clickable symbols → stock detail page

**Balances Tab (`BalancesTab.jsx`):**
- [x] Balance sheet view with 4 sections: Core Balances, Margin & Buying Power, Transfers & Fees, Account Info
- [x] 20+ fields from Alpaca account API (portfolio value, cash, equity, long/short market value, maintenance margin, SMA, RegT/daytrading/non-marginable buying power, accrued fees, pending transfers, multiplier, currency, account status flags, crypto status, created date)
- [x] Export as Markdown button — generates formatted `.md` file download

**Configure Tab (`ConfigureTab.jsx`):**
- [x] Account configuration toggles via Alpaca API: DTBP check, fractional trading, no shorting, trade confirm email, suspend trade, max margin multiplier, max options trading level, PDT check
- [x] Save button posts updated config to Alpaca

**Tabs styling:** Uses same `discover-tabs` / `discover-tab` CSS class pattern as Discover page for consistent look.

#### Backend — New Alpaca Functions (`alpaca_client.py`)
- [x] `get_account_activities()` — Direct REST API call to `paper-api.alpaca.markets/v2/account/activities` (SDK method doesn't exist in alpaca-py 0.43.2). Supports `activity_types` and `date` filtering.
- [x] `get_account_configurations()` — Account config via TradingClient
- [x] `update_account_configurations()` — Update config with Pydantic v2 `model_copy(update=...)` pattern
- [x] `get_orders_full()` — Extended order listing with status/side/limit params
- [x] `cancel_order()` — Cancel order by ID

#### Backend — New API Endpoints (`server.py`)
- [x] `GET /api/paper/orders/full` — Full order listing with filters
- [x] `DELETE /api/paper/orders/{order_id}/cancel` — Cancel an order
- [x] `GET /api/paper/activities` — Account activities (bypasses SDK, uses direct REST)
- [x] `GET /api/paper/configurations` — Account configuration
- [x] `PUT /api/paper/configurations` — Update account configuration

#### Frontend — API Client (`client.js`)
- [x] Added `patch()` method to API client

#### Frontend — Hooks (`usePaperTrading.js`)
- [x] `usePaperActivities()` — query for activities with type/date filters
- [x] `usePaperOrdersFull()` — query for orders with status/side/limit filters
- [x] `usePaperConfigurations()` — query for account config
- [x] `useUpdateConfigurations()` — mutation for saving config
- [x] `useCancelOrder()` — mutation for canceling orders

#### Git / Deployment Prep
- [x] Added `frontend-build/` to `.gitignore` (build artifacts shouldn't be tracked)
- [x] Removed `package-lock.json` from `.gitignore` (`npm ci` in deploy script requires it)
- [x] Form accessibility — added `id`, `name`, and `aria-label` attributes to all form fields across all paper trading tabs

### Bugs Fixed:

- 🐛 **react-grid-layout v2 flat props ignored** — `isDraggable`/`isResizable` silently ignored; widgets always draggable/resizable. Fixed with `dragConfig`/`resizeConfig` objects.
- 🐛 **rowHeight defaulting to 150px** — `gridConfig` wrapper silently ignored by `ResponsiveGridLayout`. Moved `rowHeight`/`margin` to top-level props.
- 🐛 **Chart infinite zoom loop** — `.widget-body` flex centering caused ResizeObserver feedback loop with TradingView charts. Removed global centering.
- 🐛 **Activities endpoint empty** — `get_account_activities()` SDK method doesn't exist in alpaca-py 0.43.2. Replaced with direct REST API call using `requests.get()`.
- 🐛 **Activities endpoint 404** — SDK's `.get()` prepends `/v2/`, turning `/v2/account/activities` into `/v2/v2/account/activities`. Changed to `/account/activities`.
- 🐛 **Pydantic v2 frozen models** — `setattr()` on Alpaca request objects fails in Pydantic v2. Fixed with `model_copy(update=...)` pattern.
- 🐛 **FastAPI `regex` deprecation** — `Query(regex=...)` deprecated in Pydantic v2. Changed to `Query(pattern=...)`.

### Files Changed:

| File | Status | Purpose |
|------|--------|---------|
| `frontend-react/src/components/ui/WidgetGrid.jsx` | Modified | v2 API: `dragConfig`/`resizeConfig`, top-level `rowHeight`/`margin` |
| `frontend-react/src/pages/PaperTradingPage.jsx` | Rewritten | Tabbed interface with 5 sub-tabs, Alpaca link, sync timestamp |
| `frontend-react/src/components/paper/PaperDashboardTab.jsx` | New | Dashboard tab with widget grid |
| `frontend-react/src/components/paper/PositionsTab.jsx` | New | Positions with sub-tabs + column picker |
| `frontend-react/src/components/paper/OrdersTab.jsx` | New | Orders with filters + pagination + 20 columns |
| `frontend-react/src/components/paper/BalancesTab.jsx` | New | Balance sheet + Markdown export |
| `frontend-react/src/components/paper/ConfigureTab.jsx` | New | Account config toggles |
| `frontend-react/src/components/paper/ActivitiesTab.jsx` | New (later removed) | Activities tab — removed due to SDK incompatibility |
| `frontend-react/src/hooks/usePaperTrading.js` | Modified | 5 new query/mutation hooks |
| `frontend-react/src/api/client.js` | Modified | Added `patch()` method |
| `frontend-react/src/styles/styles.css` | Modified | `.widget-body-centered`, form label fixes |
| `backend/alpaca_client.py` | Modified | 5 new functions (activities, config, orders, cancel) |
| `backend/server.py` | Modified | 5 new endpoints, Pydantic v2 fixes |
| `.gitignore` | Modified | Added `frontend-build/`, removed `package-lock.json` |

### Testing Notes:

- ✅ Build: no errors
- ✅ Dashboard tab — all 5 widgets rendering with correct Alpaca data
- ✅ Positions tab — all positions showing with column picker
- ✅ Orders tab — both orders showing with all columns, cancel works
- ✅ Balances tab — 20+ fields displayed, Markdown export generates file
- ✅ Configure tab — account settings load and save correctly
- ✅ Widget grid — drag/resize properly locked when not in customize mode
- ✅ Widget heights — correct at `rowHeight: 50` (no longer tripled)
- ✅ Chart — no infinite zoom loop
- ⚠️ Activities tab removed — alpaca-py SDK lacks `get_account_activities()`, direct REST call returned data from backend but frontend received empty array (suspected auth/serialization issue). Tab removed; activities viewable on Alpaca dashboard.

### Next Steps:

- [ ] Deploy to Linux server (Nginx + systemd) — Node.js 18+ required on server for `npm ci` + `npm run build`
- [ ] Login rate limiting — `slowapi` or similar on `/api/login`
- [ ] GPU cooldown (sleep between LLM calls)
- [ ] Intraday timeframe support (4h, 1h candles)
- [ ] Alert notifications (email/push when signals fire)

### Next Session Prompt:

> Paper Trading page fully overhauled with 5 sub-tabs (Dashboard, Positions, Orders, Balances, Configure) mirroring Alpaca. Widget grid v2 API fixes applied (dragConfig/resizeConfig, top-level rowHeight). Activities tab removed due to SDK incompatibility. `frontend-build/` added to `.gitignore`. Ready for production deployment — server needs Node.js 18+ installed, then run `deploy.sh`. Nginx config unchanged (reverse proxy to :8005, backend serves `frontend-build/` as static). Source at `frontend-react/`, 43 tests passing.
