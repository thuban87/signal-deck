# Signal Deck — Trading Signal Dashboard

## Project Overview

A full-stack trading signal dashboard that:
1. Fetches real-time market data via **Alpaca** (with yfinance fallback)
2. Computes technical indicators (RSI, MACD, Bollinger Bands, ADX, OBV, ATR, Stochastic)
3. Detects bullish AND bearish trading signals using tiered multi-signal confirmation
4. Displays everything on a premium web dashboard with interactive TradingView charts
5. Supports paper trading to test strategies without real money
6. Deep-dive **Investigator** page — news sentiment, fundamentals, insider trading, earnings
7. Watchlist tagging, screener, position sizing calculator, per-stock Markdown notes
8. **Quick-Logger** FAB — log stock ideas from anywhere, auto-resolves tickers
9. **Sector Heatmap** — treemap of 11 SPDR sector ETFs with daily performance
10. **Custom Baskets** — "Write What You Know" micro-sector groups with aggregate metrics
11. **Widget Grid** — draggable/resizable dashboard layout via gridstack.js with edit mode and persistence
12. **Discover Hub** — 5-source stock discovery (Matchmaker swipe UI, Congress trades, Insider scan, Reddit social momentum, Options flow)
13. **Trade Actions** — automated Buy/Sell/Hold recommendations with confidence levels
14. **What-If Calculator** — historical trade simulation with candlestick chart and P&L
15. **Settings** page — discovery tuning, Reddit config, options flow thresholds
16. Optionally queries a local LLM (Ollama) for on-demand analysis

**Not a live trading system.** All suggestions are for research and paper trading only.

---

## Project Structure

```
Trading/
├── backend/                    # Python server + analysis engine
│   ├── server.py              # FastAPI app — REST API + static serving
│   ├── config.py              # Env-var-driven configuration
│   ├── database.py            # SQLite: watchlist, signals, paper trades, tags, notes, discover
│   ├── alpaca_client.py       # Alpaca SDK wrapper + paper trading API
│   ├── discovery.py           # Discovery engine — scrapers, scanners, aggregators
│   ├── indicators.py          # Technical indicator computation
│   ├── backtest_signals.py    # Signal finders + trade simulator (long+short)
│   ├── data_fetcher.py        # yfinance data fetching
│   ├── llm_analyst.py         # Ollama LLM integration (optional)
│   └── main.py                # Original CLI entry point
├── frontend/                   # Web UI (vanilla HTML/CSS/JS)
│   ├── index.html             # App shell + sidebar nav + EasyMDE/gridstack CDN
│   ├── favicon.svg            # SVG favicon (dark bg, green chart line)
│   ├── css/styles.css         # Premium dark-mode design system
│   └── js/
│       ├── app.js             # Router, API client, auth, state, Quick-Logger FAB
│       ├── dashboard.js       # Widget grid + watchlist + heatmap + baskets + screener
│       ├── signals.js         # Signal feed table + filters + position sizing
│       ├── stock.js           # Gridstack stock detail — chart, indicators, peers, insider, social, notes
│       ├── backtest.js        # Backtester + equity curve + fundamental filters
│       ├── paper.js           # Paper trading (Alpaca-synced + local fallback)
│       ├── investigator.js    # Deep-dive research (news, sentiment, insider, earnings)
│       ├── discover.js        # Discover hub — Matchmaker, Congress, Insider, Social, Options
│       ├── actions.js         # Trade actions — Buy/Sell/Hold recommendations
│       ├── calculator.js      # What-if trade calculator with chart
│       └── settings.js        # Settings page — discovery tuning
├── docs/dev/
│   ├── Deployment.md          # Nginx + systemd deployment guide
│   ├── Findings.md            # Backtest results analysis
│   ├── Paper Trading — Full Alpaca Integration.md
│   └── Trading Crash Course.md
├── start-server.bat           # Launch backend server — Windows (port 8005)
├── stop-server.bat            # Kill running server processes — Windows
├── .env.example               # Template for secrets
├── .gitignore
├── requirements.txt
└── Session Log.md
```

---

## Running the System

The project runs on both **Windows** (development) and **Linux** (production server).

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

### Windows (development):
```
start-server.bat   # Opens terminal, starts the server
stop-server.bat    # Kills server processes on port 8005
```

### Linux (production):
```bash
# Via systemd (see docs/dev/Deployment.md)
sudo systemctl start signaldeck
sudo systemctl status signaldeck
sudo journalctl -u signaldeck -f   # tail logs

# Or run directly
cd backend && python server.py
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
- **Fallback:** yfinance (15-min delayed, no paper trading API; also used for fundamentals data)
- **Finnhub:** Earnings calendar, financial news articles (requires `FINNHUB_API_KEY` in `.env`)
- **OpenInsider:** Insider trading data (scraped via BeautifulSoup, no API key needed)
- **Capitol Trades:** Congressional stock trading data (scraped, no API key needed)
- **Reddit/PRAW:** Social momentum — ticker mentions + sentiment from wallstreetbets, stocks, investing, options (requires `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` in `.env`)
- **VADER Sentiment:** NLP sentiment analysis on news headlines/summaries and Reddit posts
- **Local DB:** SQLite for watchlist, signal history, local paper trades, tags, notes, discover data
- **Config:** Set `ALPACA_API_KEY`, `ALPACA_SECRET_KEY`, `FINNHUB_API_KEY`, and optionally `REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET` in `.env`

---

## Investigator Page

Deep-dive research for any symbol at `#/investigate/:symbol`:

- **News Sentiment** — Finnhub articles analyzed with VADER; composite score + bullish/bearish/neutral gauge
- **Fundamentals** — 12 metrics from yfinance (Market Cap, P/E, Forward P/E, EPS, PEG, D/E, FCF, Div Yield, Profit Margin, ROE, Beta, 52-Week Range)
- **Earnings** — upcoming date from Finnhub, warning card if ≤7 days away
- **Insider Trading** — OpenInsider scrape with buy/sell totals and net signal
- **News Feed** — per-article sentiment badges, links to sources

---

## Tags, Notes & Screener

- **Tags:** 8 predefined tags (Tech Swing, Long Term Hold, Momentum, etc.) + custom tags. Filter watchlist by tag. Stored in SQLite `tags` + `watchlist_tags` tables.
- **Notes:** Per-stock Markdown notes with EasyMDE editor. Stored in SQLite `stock_notes` table.
- **Screener:** Filter watchlist by RSI range, ADX, price, trend direction, volume ratio, active signals.

---

## Quick-Logger ("Overheard in the Uber")

FAB (floating action button) on every page. Enter a company name or ticker — backend resolves it via Alpaca validate → Alpaca search → yfinance fallback. Entries appear on the dashboard with:
- Clickable ticker links to stock detail page
- 🔍 Investigate button for deep-dive research
- Promote to watchlist / dismiss buttons
- Stored in SQLite `look_into_later` table

---

## Sector Heatmap

Treemap visualization of 11 SPDR sector ETFs (XLK, XLF, XLE, XLV, XLC, XLY, XLP, XLI, XLB, XLRE, XLU). Cell size proportional to market cap, color from smooth red→neutral→green gradient based on daily change %. Data fetched via yfinance.

---

## Custom Baskets ("Write What You Know")

Group related stocks into named baskets with emoji icons. 4 default baskets seeded: Rideshare, Crohn's/GI, SysAdmin, AI. Each basket shows aggregate metrics: avg RSI, avg ADX, avg change %, trend consensus. Expandable detail rows. Edit/delete via prompt-based editor.

---

## Widget Grid System

Both the **Dashboard** and **Stock Detail** pages use **gridstack.js v10.3.1** for draggable/resizable widget layout.

### Dashboard Widgets
- **6 widgets:** Signal Alerts, Baskets, Sector Heatmap, Quick-Log, Watchlist, Screener
- **Edit mode:** "Customize" button toggles drag/resize with visual handles
- **Min sizes:** enforced per widget (e.g., watchlist ≥ 6 cols, quick-log ≥ 3 cols)
- **Persistence:** layout auto-saved to `localStorage`, restored on page load
- **Separate mobile/desktop layouts:** `sd_dashboard_layout` (desktop) and `sd_dashboard_layout_mobile` (mobile) via `getLayoutKey()` helper
- **Reset:** "Reset Layout" button clears saved layout for the current device and reverts to defaults

### Stock Detail Widgets
- **15 widgets:** Price Chart, Indicators, Signal Recommendation, Earnings, Related Stocks, Active Signals, Fundamentals, Insider Trading, Recent News, Social Trending, Position Sizing, Notes, Trade Calculator, Saved Simulations, LLM Analysis
- **Edit mode:** same UX as dashboard — "Customize" button with drag/resize handles
- **Global layout:** saved to `localStorage` keys `sd_stock_detail_layout` / `sd_stock_detail_layout_mobile` (shared across all symbols, separate per device)
- **Chart hover tooltip:** OHLCV values displayed on crosshair move
- **Company name:** displayed in header below symbol, populated from fundamentals API
- **Related Stocks:** Finnhub peers API with daily % change and clickable links
- **Insider Trading:** light copy from Investigator — summary bar + paginated table (5 at a time)
- **Social Trending:** Reddit mentions with sentiment, or empty state when not configured
- **Indicators flow:** CSS grid with auto-fit wrap, reflows when widget is resized
- **EasyMDE dark mode:** comprehensive CSS overrides for the Markdown notes editor

### Mobile
- **Scroll handle:** fixed bottom bar with ▲/▼ buttons appears during edit mode for touch-device scrolling
- **`App.isMobile()`** — `matchMedia('(max-width: 768px)')` check used by `getLayoutKey()` in both modules

---

## Mobile Navigation

At ≤768px, the sidebar is hidden and replaced with a **hamburger menu button** (☰) that opens the sidebar as an **80vw drawer overlay** from the left. A semi-transparent backdrop overlay closes the drawer on tap. Nav items auto-close the drawer on selection. Desktop sidebar behavior is unchanged.

---

## Discover Hub

Stock discovery engine at `#/discover` with 5 sub-tabs:

- **Matchmaker** — "Tinder for Stocks" swipe UI. Cards show mini price chart + 8 technical metrics. Swipe right → watchlist, left → dismiss, down → skip. Sources: S&P 500, Congress trades, Insider buying, Social momentum, Options flow.
- **Government** — Congressional stock trades scraped from Capitol Trades with Senate EFDS fallback. Shows politician, party (R/D/I), chamber, ticker, trade type, amount, dates. Aggregated popular tickers view.
- **Insider** — Market-wide insider trading scan via OpenInsider. Configurable min value ($100K/$500K/$1M+). Cards show net signal (bullish/bearish/neutral), buy/sell dollar totals.
- **Social** — Reddit mentions via PRAW across 4 subreddits. VADER sentiment on post titles. Background scheduler scans every 4 hours via APScheduler.
- **Options Flow** — Unusual options activity scanner. Flags high Vol/OI ratios (≥500%) and whale premium (≥$1M). Scans nearest 3 expirations.

Data cached in SQLite (`congress_trades`, `social_mentions`, `options_flow`, `matchmaker_seen` tables). Settings configurable via Settings page.

---

## Trade Actions

Automated Buy/Sell/Hold recommendations for all watchlist symbols at `#/actions`:
- Confidence levels: HIGH, MEDIUM, LOW with color-coded badges
- Expandable cards with recent signals, full indicator summary, reasoning
- Lookback filter (3/5/7/14 days)
- Action type filter (BUY/SELL/HOLD/All)

---

## What-If Calculator

Historical trade simulation at `#/calculator`:
- Enter symbol, buy date, sell date, dollar amount or share count
- Symbol autocomplete with keyboard navigation
- Results: entry/exit price, shares, P&L ($), P&L (%), days held, annualized return
- Interactive candlestick chart with buy/sell markers
- Handles non-trading days (weekends, holidays) with date adjustment

---

## Settings

Discovery tuning at `#/settings`:
- Social Momentum: scan interval, mention threshold, spike ratio, subreddit list
- Options Flow: Vol/OI threshold, premium threshold, S&P 500 daily scan toggle, scan time
- Matchmaker: auto-reset dismissed stocks after N days
- Reddit API credential status badge
- Batch save and reset-to-defaults

Stored in SQLite `app_settings` table.

---

## Position Sizing

ATR-based position sizing available on Signals, Stock Detail, and Paper Trading pages:

```
risk_per_share = ATR × 1.5
shares = (account_size × risk_pct) / risk_per_share
stop_loss = entry - risk_per_share
take_profit = entry + (ATR × 2.5)
```

Configurable account size and risk percentage inputs on each page.

---

## Known Issues / Limitations

- **Daily candles only** — intraday data not yet supported
- **No transaction costs modeled** — real trading has commissions and slippage
- **GPU crashes** — sustained LLM inference overloads GPU; run one symbol at a time
- **SPY underperforms** — signal parameters tuned for individual stocks, not indices
- **Finnhub rate limits** — free tier has 60 calls/min; investigator page batches requests
- **Options flow weekend gap** — yfinance reports OI=0 outside market hours; scanner finds activity on weekday scans only
- **Reddit API required** — Social momentum tab requires Reddit credentials (free at reddit.com/prefs/apps)

---

## Planned Improvements

- [x] News Investigator tab — sentiment-classified financial news
- [x] Watchlist tagging system
- [x] Position sizing calculator
- [x] Stock screener
- [x] Fundamentals display + backtest filters
- [x] Quick-Logger FAB — log ideas from anywhere, auto-resolve tickers
- [x] Sector Heatmap — treemap of 11 SPDR sector ETFs
- [x] Custom Baskets — micro-sector groups with aggregate metrics
- [x] Widget Grid — draggable/resizable dashboard layout with gridstack.js
- [x] Discover Hub — 5-source stock discovery (Matchmaker, Congress, Insider, Social, Options)
- [x] Trade Actions — automated Buy/Sell/Hold recommendations
- [x] What-If Calculator — historical trade simulation with chart
- [x] Settings page — discovery tuning, Reddit config, options flow thresholds
- [x] Stock detail gridstack widget system (15 draggable/resizable widgets)
- [x] Related Stocks widget (Finnhub peers with daily % change)
- [x] Chart hover tooltip (OHLCV on crosshair move)
- [x] Insider trading widget on stock detail (light copy from Investigator)
- [x] Social trending widget with Reddit empty state
- [x] EasyMDE dark mode CSS
- [x] Mobile hamburger menu + sidebar drawer (replaces thin sidebar at ≤768px)
- [x] Separate mobile/desktop layout persistence (dashboard + stock detail)
- [x] Mobile scroll handle for gridstack edit mode
- [x] Mobile overflow fixes (Paper Trading, Investigator, Stock Detail)
- [x] Bottom cutoff fix (`100dvh` + padding)
- [ ] GPU cooldown (sleep between LLM calls)
- [ ] Intraday timeframe support (4h, 1h candles)
- [ ] Alert notifications (email/push when signals fire)
- [ ] Deploy to Linux server (Nginx + systemd)
