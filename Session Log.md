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
