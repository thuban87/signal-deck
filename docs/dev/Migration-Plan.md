# Signal Deck: React + Vite Migration Plan

## Context

Signal Deck is a full-stack trading signal dashboard with a vanilla JS/CSS/HTML SPA frontend (8,781 lines JS, 4,730 lines CSS, no build step) served by a Python FastAPI backend. The migration to React + Vite is motivated by: learning React for professional use, future React Native mobile app, performance improvements (skeleton loading, caching), better charting ecosystem, and resume value. The backend stays unchanged — only the frontend is being rewritten.

**Current pain point:** Pages take 5-15 seconds to load because every page visit re-fetches all data with no caching. React + TanStack Query will fix this with stale-while-revalidate caching and per-widget loading states.

**Deployment stays simple:** deploy.bat → SSH → deploy.sh (git pull + build + restart). Just adds `npm ci && npm run build` to the deploy script.

---

## Technical Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| State management | **Zustand** | Mirrors the singleton pattern already used; minimal boilerplate; easy for React learners |
| Routing | **React Router v6 (HashRouter)** | Backend only serves index.html on `/` and `/login` — no catch-all needed with hash routing |
| CSS | **Keep existing styles.css as global import** | 4,730 lines of well-organized CSS with design tokens in `:root`. Extract to CSS Modules incrementally later |
| Charting | **TradingView Lightweight Charts (npm)** | Already used; has official React wrapper. Install via npm instead of CDN |
| Widget grid | **react-grid-layout** | Built for React (declarative). Replaces GridStack which mutates DOM directly |
| Data fetching | **TanStack Query v5** | Caching, loading/error states, background refetching. This alone fixes the 5-15s load times |
| Markdown editor | **@uiw/react-md-editor** | Replaces EasyMDE (imperative DOM library). Eliminates 200 lines of dark-mode CSS hacks |
| TypeScript | **No (plain JSX)** | User is learning React — TS can be added later by renaming `.jsx` → `.tsx` |

**npm dependencies:** `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `react-router-dom`, `zustand`, `@tanstack/react-query`, `lightweight-charts`, `react-grid-layout`, `@uiw/react-md-editor`, `dompurify`, `@fontsource/inter`, `@fontsource/jetbrains-mono`

**Dev dependencies:** `vitest`, `eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `prettier`

---

## File Structure

```
frontend-react/
├── public/favicon.svg
├── src/
│   ├── main.jsx                         # Entry, QueryClientProvider
│   ├── App.jsx                          # HashRouter, AuthGuard, Layout
│   ├── api/client.js                    # fetch wrapper with JWT auth (hub — no store imports)
│   ├── stores/
│   │   ├── authStore.js                 # Zustand: token, login/logout, JWT expiry check
│   │   └── appStore.js                  # Zustand: config, toasts
│   ├── hooks/
│   │   ├── useWatchlist.js              # TanStack Query: GET /api/watchlist
│   │   ├── useStockData.js              # TanStack Query: GET /api/stock/{symbol}
│   │   ├── useConfig.js                 # TanStack Query: GET /api/config
│   │   ├── useLocalStorage.js           # Generic localStorage hook
│   │   ├── useGridLayout.js             # react-grid-layout + localStorage persistence
│   │   ├── useEconomicEvents.js
│   │   ├── useBaskets.js
│   │   ├── usePaperTrading.js
│   │   └── usePerformance.js
│   ├── components/
│   │   ├── Sidebar.jsx
│   │   ├── LoginPage.jsx
│   │   ├── ToastContainer.jsx
│   │   ├── QuickLogFab.jsx
│   │   ├── AddSymbolModal.jsx
│   │   ├── ErrorBoundary.jsx            # Catches render errors per-widget and per-page
│   │   ├── ui/                          # Shared primitives
│   │   │   ├── LoadingSkeleton.jsx
│   │   │   ├── PriceChart.jsx           # TradingView wrapper (ref + useEffect)
│   │   │   ├── AreaChart.jsx            # Lighter TradingView wrapper
│   │   │   ├── WidgetGrid.jsx           # react-grid-layout wrapper with edit mode
│   │   │   ├── StockCard.jsx
│   │   │   ├── FilterBar.jsx
│   │   │   ├── MetricCard.jsx
│   │   │   ├── Modal.jsx
│   │   │   ├── PageHeader.jsx
│   │   │   └── EmptyState.jsx
│   │   ├── dashboard/                   # 7 widget components
│   │   ├── stock/                       # 16 widget components
│   │   ├── paper/                       # Paper trading components
│   │   ├── performance/                 # Performance charts
│   │   └── discover/                    # 5 tab components
│   ├── pages/                           # 9 page components (lazy-loaded)
│   ├── utils/
│   │   ├── formatters.js               # Port of App.formatPrice, formatChange, etc.
│   │   ├── calculations.js             # Shared trade math (position sizing, P&L, annualized return)
│   │   └── signals.js                  # BUY/SELL/HOLD recommendation logic (single source of truth)
│   └── styles/styles.css                # Copied from frontend/css/styles.css
├── index.html
├── package.json
├── vite.config.js
├── .eslintrc.cjs
└── .prettierrc
```

---

## Phase Dependency Graph

```
Phase 1 (Scaffolding)
    ↓
Phase 2 (Shared Components + Hooks)
    ↓
    ├── Phase 3 (Dashboard)      ─┐
    ├── Phase 4 (Stock Detail)    │  Can run in parallel
    ├── Phase 5 (Paper + Perf)    │
    └── Phase 6 (All remaining)  ─┘
                ↓
         Phase 7 (Deploy + Cutover)
```

**Phases 3-6 are parallelizable** once Phase 2 is complete. Each produces a working page that can be tested independently.

---

## Phase 1: Scaffolding — Vite + React + Routing + Auth + Layout Shell

**Source files to port:** `frontend/js/app.js` (408 lines), `frontend/index.html` (230 lines)

**Build:**
- Init Vite React project in `frontend-react/`
- Install all npm deps listed above (including dev deps)
- Initialize ESLint (`eslint-plugin-react`, `eslint-plugin-react-hooks`) and Prettier. This catches hook dependency issues and enforces consistent formatting across all 7 phases — critical when agents are working on different phases.
- `vite.config.js`: dev proxy `/api` → `localhost:8005`, production `base: '/static/'`, `build.outDir: '../frontend-build'`
- Port `App.api()`, `App.get()`, `App.post()`, `App.put()`, `App.del()` → `api/client.js` (same fetch wrapper with Bearer token). The API client is a **hub module** — it must NOT import any store directly. Instead, accept a `getToken` function at setup time via dependency injection:
  ```js
  // api/client.js
  let tokenProvider = () => null;
  export const setTokenProvider = (fn) => { tokenProvider = fn; };
  // Uses tokenProvider() in the Authorization header

  // main.jsx (wiring)
  import { setTokenProvider } from './api/client';
  import { useAuthStore } from './stores/authStore';
  setTokenProvider(() => useAuthStore.getState().token);
  ```
- `useAuthStore`: **Use Zustand's `persist` middleware** to handle token storage in localStorage (`sd_token` key) automatically. This centralizes hydration logic within the store itself rather than spreading it across hooks. Implement `onRehydrateStorage` to **decode the JWT payload (`JSON.parse(atob(token.split('.')[1]))`) and check `exp` against `Date.now()/1000`. If expired, call `logout()` immediately** — this prevents a flash of authenticated UI followed by redirect when the first API call returns 401. The `useLocalStorage` hook (Phase 2) is for non-store preferences only (sort order, view mode, etc.), not auth state.
- `useAppStore`: config object, toast queue
- `<App>`: HashRouter with AuthGuard, Sidebar, Outlet. **Use `React.lazy()` + `<Suspense fallback={<LoadingSkeleton />}>` for all route pages** — this gives automatic per-route code splitting so the initial bundle only contains the shell:
  ```jsx
  const DashboardPage = lazy(() => import('./pages/DashboardPage'));
  const StockDetailPage = lazy(() => import('./pages/StockDetailPage'));
  // ... etc
  ```
- Port sidebar nav (same icons, order, active state via `useLocation()`). Add `role="navigation"`, `aria-current="page"` on active nav items, and keyboard `Enter`/`Space` handling on interactive elements.
- Port login screen as `<LoginPage>`
- Port toast system as `<ToastContainer>` reading from `useAppStore`
- Port Quick-Logger FAB as `<QuickLogFab>` (lives outside router, visible on all pages)
- Port Add Symbol modal as `<AddSymbolModal>`
- Port mobile hamburger menu (drawer overlay at ≤768px)
- Create 9 placeholder page components (just render page title): Dashboard, StockDetail, Discover, Investigator, Signals, Backtest, PaperTrading, Performance, Settings
- Copy `styles.css` and `favicon.svg`. Install `@fontsource/inter` and `@fontsource/jetbrains-mono` from npm and import in `main.jsx` — this eliminates the external Google Fonts CDN dependency and improves cold-load performance. Remove the Google Fonts `<link>` tags from `index.html`.

**Watch for:**
- Vite dev proxy must handle `/api/*` for auth to work during development
- Quick-Logger FAB is a sibling of `<Outlet>`, not inside any route
- Sidebar active state: compare `useLocation().hash` against route paths (not `data-page` attributes)
- Mobile detection: `window.matchMedia('(max-width: 768px)')` — same logic as current `App.isMobile()`
- **CORS**: The backend has no CORS config, which works in production because the frontend is served from the same origin. The Vite dev proxy handles this transparently in development. If you ever need to bypass the proxy (e.g., direct API calls from a mobile preview), add `CORSMiddleware` to `server.py` gated behind `DEBUG=true`. Never deploy with `allow_origins=["*"]`.
- **Environment variables**: Never prefix secrets with `VITE_`. Vite exposes any `VITE_`-prefixed env var to the client bundle. The only client-exposed env vars should be `VITE_API_BASE_URL` (if needed). All API keys stay backend-only in `.env`.

**Verify:** `npm run dev` → login works → all 9 nav links render placeholders → sidebar highlights correctly → toast works → Quick-Logger FAB submits → mobile hamburger opens drawer → expired JWT token causes immediate logout (not flash-then-redirect)

---

## Phase 2: Shared Components + Hooks Library

**No pages built — only reusable building blocks for Phases 3-6.**

**Global rules:**
- **No `dangerouslySetInnerHTML`.** All user-visible data (symbol names, notes content, news headlines, Reddit post titles) MUST go through JSX interpolation `{variable}` which auto-escapes. The Markdown editor handles its own sanitization. If raw HTML is ever needed (e.g., LLM analysis output), sanitize with `DOMPurify.sanitize(html)` before rendering.
- **Wrap every widget in `<ErrorBoundary>`.** A bad API response in one widget must not crash the entire page. Also wrap each lazy route in a page-level error boundary.

**Hooks:**
- `useLocalStorage(key, defaultValue)` — generic localStorage sync
- `useGridLayout(layoutKey, defaultLayout)` — wraps react-grid-layout with localStorage save/load, edit mode toggle, reset, mobile/desktop key switching
- `useWatchlist()` — TanStack Query for `GET /api/watchlist`
- `useStockData(symbol, period)` — TanStack Query for `GET /api/stock/{symbol}`
- `useConfig()` — TanStack Query for `GET /api/config`
- `useEconomicEvents(days)`, `useBaskets()`, `usePaperTrading()`, `usePerformance(period)`

**Components:**
- `<PriceChart>` — **Most critical.** Wraps TradingView `createChart()` with `useRef` + `useEffect`. Props: candlestick data, volume, optional SMA overlays, optional markers (buy/sell points), crosshair tooltip callback. Must destroy chart on unmount (`chart.remove()`), resize via ResizeObserver. Reference: `frontend/js/stock.js` lines 523-687
- `<AreaChart>` — Lighter TradingView wrapper for equity curves (area series only)
- `<WidgetGrid>` — Wraps react-grid-layout's `<ResponsiveGridLayout>`. Props: widget definitions array, layout, onLayoutChange, editMode. Includes toolbar (Customize/Done/Reset buttons). Translates current `{id, x, y, w, h, minW, minH}` format to RGL format. Reference: `frontend/js/dashboard.js` lines 191-207 for GridStack init pattern
- `<LoadingSkeleton>` — Card, table row, and chart skeleton shapes
- `<ErrorBoundary>` — Class component with `componentDidCatch`. Renders "Something went wrong" fallback in-place (widget-level) or a full-page error (route-level). Props: `fallback` (optional custom fallback), `onError` (optional callback for logging).
- `<StockCard>`, `<FilterBar>`, `<MetricCard>`, `<Modal>`, `<PageHeader>`, `<EmptyState>`

**Utilities:**
- `utils/formatters.js` — port `App.formatPrice()`, `App.formatChange()`, `App.formatDate()`, `App.rsiClass()`, `App.directionClass()`. Do NOT port `App.escapeHtml()` — React's JSX auto-escapes. Remove all references to it.
- `utils/calculations.js` — shared trade math hub:
  - `calculateTradeResult(entryPrice, exitPrice, amount, amountType)` — P&L, shares, annualized return
  - `calculatePositionSize(accountSize, riskPct, atr, entryPrice)` — shares, stop-loss, take-profit
  - `calculateAnnualizedReturn(entryPrice, exitPrice, daysHeld)`
  - Used by: `<TradeCalculatorWidget>` (Phase 4), `<PositionSizingWidget>` (Phase 4), `<OrderForm>` (Phase 5)
- `utils/signals.js` — single source of truth for BUY/SELL/HOLD logic:
  - `getActionRecommendation({ strong_bullish, strong_bearish, support_bullish, support_bearish, trend })` → `{ action, confidence, reasoning }`
  - Currently duplicated in 3 places: dashboard.js (cards/table/compact), stock.js (action card), server.py. This collapses the frontend copies into 1.
  - Used by: `<WatchlistWidget>` (Phase 3), `<ActionCardWidget>` (Phase 4), Signals page (Phase 6)

**TanStack Query config:**

Default: `staleTime: 2 * 60 * 1000` (2 min), `gcTime: 10 * 60 * 1000` (10 min).

Override staleTime per-hook where appropriate:
- `useWatchlist()`: `staleTime: 2min` (prices change frequently)
- `useStockData()`: `staleTime: 5min` (daily candles won't change intraday)
- `useConfig()`: `staleTime: Infinity` (never changes mid-session)
- `useEconomicEvents()`: `staleTime: 30min` (calendar data is static-ish)
- `useBaskets()`: `staleTime: 5min`
- `usePaperTrading()` positions/account: `staleTime: 30s` (near real-time)

**Testing:**

Install `vitest` (Vite-native). Create basic smoke tests for:
- `api/client.js` — mock fetch, verify auth header injection, 401 handling
- `utils/formatters.js` — unit test price/date formatting edge cases
- `utils/calculations.js` — unit test trade math (P&L, position sizing, annualized return)
- `utils/signals.js` — unit test BUY/SELL/HOLD thresholds
This gives a regression safety net without requiring component tests for every widget.

**Watch for:**
- `<PriceChart>` must update data via `series.setData()` when props change, NOT recreate the chart. Use a ref for the chart instance and effects for data updates.
- `<WidgetGrid>` must use `useMemo` for the layout array to prevent re-renders when widget content updates
- Layout localStorage keys must match current ones (`sd_dashboard_layout`, `sd_dashboard_layout_mobile`, `sd_stock_detail_layout`, `sd_stock_detail_layout_mobile`) so existing user layouts carry over

**Verify:** Each component renders in isolation. PriceChart renders candlesticks, resizes, cleans up. WidgetGrid supports drag/resize/persist/reset. Skeleton loading displays during fetches. `npm run test` passes for all utility tests. ErrorBoundary catches a thrown error and renders fallback.

---

## Phase 3: Dashboard Page

**Source:** `frontend/js/dashboard.js` (1,531 lines) — 7 widgets in a draggable grid

**Build `<DashboardPage>` with 7 widget components:**

1. `<MarketStatusWidget>` — Macro events banner. Color-coded urgency (red ≤1d, yellow ≤3d, green). Countdown, clickable events, recently-passed section. Uses `useEconomicEvents(30)`. Reference: dashboard.js market status rendering.

2. `<SignalAlertsWidget>` — Signal count badges from watchlist data.

3. `<BasketsWidget>` — Basket cards with aggregate metrics, expand/collapse. Uses `useBaskets()` + `GET /api/baskets/{id}/metrics`. Reference: dashboard.js baskets section.

4. `<SectorHeatmapWidget>` — Treemap of 11 SPDR ETFs. Port the treemap sizing algorithm as a pure function → render positioned divs. Uses `GET /api/sectors/performance`.

5. `<QuickLogWidget>` — "Look Into Later" list. Promote/dismiss/investigate actions. Uses `GET /api/quick-log`.

6. **`<WatchlistWidget>`** — **Highest complexity (~400 lines).** Two view modes (cards/table), three filter dimensions (trend, signals, tag), sort, mini SVG sparklines per card, tag management. Create `<MiniSparkline>` subcomponent (see watch-for below). Uses `useWatchlist()`. **Uses `getActionRecommendation()` from `utils/signals.js`** — do NOT duplicate the BUY/SELL/HOLD logic inline.

7. `<ScreenerWidget>` — Filter form (RSI, ADX, price, trend, volume, signals) + results. Uses `GET /api/screener?...`.

**Watch for:**
- **WatchlistWidget mini charts — use SVG, NOT TradingView.** Build `<MiniSparkline>` as a pure SVG `<polyline>` component that takes an array of close prices and renders a simple line. Each TradingView instance creates its own canvas, render loop, and event listeners — with 20+ watchlist symbols, this will thrash the GPU and kill scrolling performance. The current mini charts only display a simple line with no interactivity, so a lightweight SVG path achieves the exact same visual at 1/100th the cost. Reserve full TradingView instances for pages with chart interactivity (Stock Detail, Calculator, equity curves).
- **Sector heatmap treemap algorithm**: Port as pure function `(sectors) => [{symbol, x, y, width, height, color}]`, render as positioned divs.
- **Auto-refresh**: Replace `setInterval(5min)` with TanStack Query's `refetchInterval: 300_000` on the watchlist query.
- **Layout persistence**: Preserve `sd_dashboard_layout` / `sd_dashboard_layout_mobile` localStorage keys.

**Verify:** All 7 widgets render with real data. Grid edit mode works. Layout persists. Watchlist cards show charts, clicking navigates to stock. Filters/sort work. Data loads fast on revisit (cached).

---

## Phase 4: Stock Detail Page

**Source:** `frontend/js/stock.js` (1,684 lines) — 16 widgets, most complex page

**Build `<StockDetailPage>` with 16 widget components:**

**High-priority (complex):**

1. **`<PriceChartWidget>`** — Candlestick chart with volume histogram, period selector (1mo/3mo/6mo/1y/2y), crosshair OHLCV tooltip. Uses `<PriceChart>` from Phase 2 with SMA overlays. Tooltip = React state updated via `subscribeCrosshairMove`. Reference: stock.js lines 523-687.

2. **`<NotesWidget>`** — Replace EasyMDE with `@uiw/react-md-editor`. Dark theme via CSS variables. Save/load via `GET/PUT /api/stock/{symbol}/notes`. This eliminates ~200 lines of EasyMDE dark-mode CSS hacks.

3. **`<TradeCalculatorWidget>`** — What-if calculator with its own `<PriceChart>` for buy/sell markers. **Use `calculateTradeResult()` from `utils/calculations.js`** — do NOT duplicate the math. Chart date-picker mode (click chart to set buy/sell date). Reference: stock.js lines 852-1020.

4. **`<InsiderTradingWidget>`** — Summary bar + paginated table (5 at a time). Reference: stock.js insider section.

**Standard widgets (follow established patterns):**

5. `<IndicatorsWidget>` — RSI, MACD, BB, ADX, OBV, ATR, Stochastic as metric cards in CSS grid
6. `<ActionCardWidget>` — BUY/SELL/HOLD recommendation with confidence badge. **Uses `getActionRecommendation()` from `utils/signals.js`.**
7. `<EarningsWidget>` — Earnings date warning card (highlight if ≤7 days)
8. `<RelatedStocksWidget>` — Peer stocks with daily % change, clickable links
9. `<MacroEventsWidget>` — Sector-filtered economic events
10. `<SignalsListWidget>` — Active signals table
11. `<FundamentalsWidget>` — 12 metrics grid (Market Cap, P/E, EPS, etc.)
12. `<MiniNewsWidget>` — News articles with sentiment badges
13. `<SocialTrendingWidget>` — Reddit mentions or empty state when not configured
14. `<PositionSizingWidget>` — ATR calculator with account size / risk % inputs. **Uses `calculatePositionSize()` from `utils/calculations.js`.**
15. `<SavedSimulationsWidget>` — List from localStorage keyed by symbol
16. `<LLMAnalysisWidget>` — On-demand Ollama analysis with loading state

**Watch for:**
- **Chart tooltip**: `subscribeCrosshairMove` callback updates React state → renders tooltip div. Do NOT manipulate DOM directly.
- **Symbol changes**: Navigating `#/stock/AAPL` → `#/stock/MSFT` must clean up all chart instances and reload data. Use `symbol` from `useParams()` as key/dependency.
- **Each widget fetches independently**: Use separate TanStack Query hooks per widget. This gives per-widget skeleton loading — major UX improvement over current all-or-nothing spinner.
- **Calculator chart-within-widget**: The calculator has its own `<PriceChart>` instance separate from the main chart. Use separate refs.
- **16 widgets in RGL**: Use `React.memo` on widget components and `useMemo` on layout array to prevent cascade re-renders.

**Verify:** All 16 widgets render for AAPL, NVDA, SPY. Chart renders with OHLCV + tooltip. Grid drag/resize works. Notes save/load. Calculator computes P&L with chart markers. LLM analysis runs. Switching symbols cleans up properly.

---

## Phase 5: Paper Trading + Performance Pages

**Sources:** `frontend/js/paper.js` (943 lines), `frontend/js/performance.js` (385 lines)

### Paper Trading — `<PaperTradingPage>`

- `<AccountSummary>` — Portfolio value, cash, buying power, today's P&L
- **`<OrderForm>`** — **Most complex form.** Symbol input with price lookup, side toggle (buy/sell), order type dropdown (market/limit/stop/stop-limit/bracket) with conditionally visible fields. Quantity vs dollar toggle. Position sizing helper. Use `useReducer` for form state.
- `<PositionsTable>` — Open positions with P&L, close button
- `<EquityChart>` — Portfolio equity curve with period selector. Uses `<AreaChart>`.
- `<OrdersTable>` — Recent orders with status badges

**Watch for:**
- **Alpaca dual-mode**: `useConfig()` returns `alpaca_connected`. Conditionally render Alpaca-mode components or local-fallback UI. API endpoints differ: `/api/alpaca/*` vs `/api/paper/*`.
- **Order form conditional fields**: Limit price (limit/stop-limit), stop price (stop/stop-limit), TP/SL legs (bracket). Show/hide based on order type selection.
- **30-second auto-refresh**: TanStack Query `refetchInterval: 30_000` on positions and account queries.

### Performance — `<PerformancePage>`

- `<MetricsGrid>` — 14 metric cards using `<MetricCard>` from Phase 2
- `<EquityCurveSection>` — `<AreaChart>` with period selector
- `<WinRateByTag>` — Horizontal bar chart (CSS bars, no library needed)
- `<TradeDistribution>` — SVG donut chart (wins vs losses)

**Verify:** Paper trading auto-detects Alpaca. Order submission works. Positions close. Equity chart renders. Performance shows 14 metrics + 3 visualizations. Period filter works.

---

## Phase 6: Remaining Pages

**Sources:** discover.js (891), backtest.js (510), investigator.js (431), signals.js (225), settings.js (197)

**Note:** `actions.js` (243 lines) and `calculator.js` (333 lines) exist as files on disk but are **orphaned** — they are not loaded in `index.html` and not routed in `app.js`. Their functionality already lives elsewhere: action recommendations are in the stock detail `<ActionCardWidget>` and dashboard cards (both use `utils/signals.js`), and the calculator is the stock detail `<TradeCalculatorWidget>`. These files are **not migrated as standalone pages**.

### Discover Hub — `<DiscoverPage>` with 5 tabs

**High-priority:**
- **`<MatchmakerTab>`** — Swipe UI ("Tinder for Stocks"). Card with mini `<PriceChart>` + 8 metrics. Use pointer events (`onPointerDown/Move/Up`) for drag, CSS transforms for position, CSS transitions for release animation. Source selector refreshes candidates. Reference: discover.js matchmaker section.

**Standard tabs:**
- `<CongressTab>` — Congressional trades table + popular tickers aggregation
- `<InsiderTab>` — Market-wide insider scan with min-value filter
- `<SocialTab>` — Reddit mentions with sentiment badges
- `<OptionsTab>` — Unusual options activity table

### Other Pages (straightforward — follow established patterns)

- `<SignalsPage>` — Signal feed table with filters (action, symbol, lookback), position sizing per signal
- `<BacktestPage>` — Symbol input (optional URL param auto-runs), strategy config, results + equity curve
- `<InvestigatorPage>` — Symbol input (optional URL param), news sentiment, fundamentals, earnings, insider, news feed. Each section as a card with independent loading.
- `<SettingsPage>` — Form sections for Social, Options, Matchmaker settings. Batch save + reset-to-defaults

**Watch for:**
- **Matchmaker swipe cleanup**: Each card has a mini chart that must be cleaned up on swipe.
- **Discover tab state preservation**: Keep `activeTab` in component state. Render all tabs but display only active one (prevent unmount/remount losing state).
- **Backtest URL params**: `useParams()` for symbol, `useEffect` to auto-run when param present.

**Verify:** All 5 pages render with real data. Matchmaker swipe works (mouse + touch). Discover tabs preserve state. Backtest auto-runs from URL. Settings save/reset works. Skeleton loading on all pages.

---

## Phase 7: Deployment Pipeline + Cutover

**Build pipeline:**
- `vite.config.js`: `build.outDir: '../frontend-build'`, `base: '/static/'`
- `npm run build` → outputs `frontend-build/` with hashed JS/CSS bundles + index.html

**Backend changes (minimal):**
- `server.py`: Change static mount from `frontend/` → `frontend-build/`. The static mount path stays `/static`.
- Add SPA catch-all: any GET not matching `/api/*` or `/static/*` → serve `index.html` (safety net for hash routing)
- **Disable Swagger docs in production**: Change `docs_url="/api/docs"` to `docs_url="/api/docs" if os.environ.get("DEBUG") else None`. The API docs endpoint is currently accessible without authentication.

**Deploy script updates:**
- `deploy.sh`: Add `cd frontend-react && npm ci && npm run build` between `pip install` and `systemctl restart`
- Ensure Node.js is available on production server (one-time: `curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash && sudo apt-get install -y nodejs`)
- `deploy.bat`: No changes needed (just SSHs to run deploy.sh)

**Rollback safety:**
- Keep `frontend/` directory intact. If React build has issues, point `server.py` back at `frontend/`.
- Only delete old frontend once React has been stable.

**Verify:**
- `npm run build` produces `frontend-build/` with hashed assets
- `python server.py` serves built React app at `localhost:8005`
- All pages work in production build (no dev-only features broken)
- `deploy.bat` deploys successfully to production
- Page loads under 2s for cached pages, under 5s for cold loads
- No console errors, no broken asset references
- `/api/docs` returns 404 (not exposed in production)

**Post-migration follow-up (not blocking cutover):**
- Add Playwright E2E smoke tests for critical flows (Login → Dashboard → Stock Detail → Paper Trade submission). Don't add during migration — the UI is actively being rewritten phase-by-phase and tests would break constantly. Add once React app is stable after Phase 7.

---

## Critical Source Files Reference

| File | Lines | Migrated In | Key Complexity |
|------|-------|------------|----------------|
| `frontend/js/app.js` | 408 | Phase 1 | Router, API client, auth, toast, Quick-Logger |
| `frontend/js/dashboard.js` | 1,531 | Phase 3 | GridStack 7 widgets, mini charts, heatmap |
| `frontend/js/stock.js` | 1,684 | Phase 4 | TradingView charts, GridStack 16 widgets, EasyMDE, calculator |
| `frontend/js/paper.js` | 943 | Phase 5 | Alpaca dual-mode, 5 order types, equity chart |
| `frontend/js/discover.js` | 891 | Phase 6 | 5 sub-tabs, matchmaker swipe UI |
| `frontend/js/backtest.js` | 510 | Phase 6 | Backtest runner + equity curve |
| `frontend/js/investigator.js` | 431 | Phase 6 | Multi-section research page |
| `frontend/js/performance.js` | 385 | Phase 5 | 14 metrics, equity curve, donut chart |
| `frontend/js/signals.js` | 225 | Phase 6 | Signal feed table |
| `frontend/js/settings.js` | 197 | Phase 6 | Settings form |
| `frontend/js/calculator.js` | 333 | — | Orphaned WIP (functionality in stock.js `<TradeCalculatorWidget>`) |
| `frontend/js/actions.js` | 243 | — | Orphaned WIP (functionality in dashboard cards + stock.js `<ActionCardWidget>`) |
| `frontend/css/styles.css` | 4,730 | Phase 1 | Global CSS, design tokens, dark theme |
| `backend/server.py` | 2,638 | Phase 7 | Static mount + SPA catch-all + docs_url update |
