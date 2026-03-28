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
