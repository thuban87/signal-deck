Paper Trading — Full Alpaca Integration
Replace the current local-only paper trading page with a full Alpaca-synced paper trading experience. Trades placed on Signal Deck execute against Alpaca's paper trading engine, so everything stays in sync between your site and your Alpaca dashboard.

Current State
Right now, the paper trading page is purely local:

Manual entry of symbol, direction, and price → stored in SQLite
Manual close with a typed exit price → P&L computed locally
No connection to Alpaca's paper trading API at all
The _trading_client already exists in alpaca_client.py (configured with paper=True) but is only used for validate_symbol()
What This Plan Delivers
Account Overview — see your Alpaca paper account balance, buying power, and portfolio value in real time
Place Real Orders — market orders submitted through Alpaca's paper trading API (shows up on alpaca.markets too)
Live Positions — see all open positions with real-time P&L pulled from Alpaca
Order History — see recent filled/cancelled orders
Close Positions — close positions from your site (syncs to Alpaca)
Portfolio Equity Curve — track your account value over time via Alpaca's portfolio history API
IMPORTANT

Alpaca Sync Direction: Orders placed on Signal Deck → submitted to Alpaca. Positions/account data pulled from Alpaca → displayed on Signal Deck. If you also place orders from Alpaca's dashboard or app, they will appear here on the next refresh.

User Review Required
WARNING

Starting Capital: Alpaca paper accounts typically start with $100,000 virtual cash. This is configurable by resetting your paper account on alpaca.markets. Is $100k fine as the starting amount?

IMPORTANT

Order Type: For simplicity, the initial implementation will use market orders only (execute immediately at current market price). Limit orders, stop orders, and bracket orders could be added later. Does that work for you?

IMPORTANT

Quantity Input: The form will ask for number of shares (supports fractional, e.g. 0.5 shares). Alternatively, I could add a "dollar amount" mode where you say "buy $500 of AAPL" and it calculates the shares. Which do you prefer, or both?

Proposed Changes
Backend — Alpaca Trading Functions
[MODIFY] 
alpaca_client.py
Add new functions that wrap the _trading_client:

get_account() → account balance, buying power, equity, portfolio value
get_positions() → all open positions with unrealized P&L
submit_order(symbol, qty, side) → submit market order, return order details
close_position(symbol) → close entire position for a symbol
get_orders(status, limit) → recent order history
get_portfolio_history(period, timeframe) → equity curve data over time
All functions return clean dicts (not Alpaca SDK objects) and include yfinance fallback messaging when Alpaca isn't configured.

Backend — New API Endpoints
[MODIFY] 
server.py
Add new endpoints under /api/paper/:

Endpoint	Method	Description
/api/paper/account	GET	Alpaca account info (balance, buying power, equity)
/api/paper/positions	GET	All open positions from Alpaca
/api/paper/orders	POST	Submit a market order (buy or sell)
/api/paper/orders	GET	Recent order history
/api/paper/positions/{symbol}	DELETE	Close a position
/api/paper/portfolio-history	GET	Portfolio equity over time
The existing local paper trade endpoints (/api/paper/trades, etc.) will remain as a backup/fallback for when Alpaca isn't configured. The frontend will detect Alpaca availability and use the appropriate endpoints.

Frontend — Redesigned Paper Trading Page
[MODIFY] 
paper.js
Complete rewrite of the paper trading UI with these sections:

1. Account Summary Bar (top)

Portfolio value, cash balance, buying power
Today's P&L (dollar + percentage)
Animated value updates
2. New Order Form (card)

Symbol input (with auto-fill of current price)
Side toggle: Buy / Sell (with visual color coding)
Quantity input (shares) OR dollar amount toggle
Estimated cost/proceeds preview
Submit button with confirmation
3. Open Positions Table (card)

Symbol, qty, avg entry, current price, market value
Unrealized P&L ($ and %)
Close button per position
Color-coded rows (green/red based on P&L)
4. Recent Orders Table (card)

Order ID, symbol, side, qty, type, status, fill price, submitted time
Status badges (filled, cancelled, pending)
5. Portfolio Equity Chart (card)

TradingView lightweight chart showing portfolio value over time
Period selector (1W, 1M, 3M, All)
6. Fallback Mode

When Alpaca isn't configured, show a banner explaining the limitation
Fall back to the current local-only paper trading (existing behavior)
Frontend — Styling
[MODIFY] 
styles.css
New CSS additions:

Account summary stat cards with gradient backgrounds
Buy/Sell toggle button styling (green/red)
Position row P&L color coding
Order status badges
Responsive layout for the new sections
Price preview/estimate styling
Architecture Decision: Alpaca-First with Local Fallback
Yes
No
User clicks 'Buy'
Alpaca configured?
Submit to Alpaca API
Order fills on Alpaca
Positions/Account updated on Alpaca
Frontend refreshes from Alpaca
Store in local SQLite
Local paper trade tracking
Open Questions
IMPORTANT

Starting with market orders only — is that acceptable for v1, or do you want limit orders right away?
    -No, I want it all added from the start.
Quantity vs. dollar amount — should the order form support both, or just shares?
    -Both
Fractional shares — Alpaca supports buying 0.5 shares of AAPL. Want that enabled?
    -Yes, enable this.
Verification Plan
Automated Tests
Start the server and verify all new API endpoints respond correctly
Test placing a buy order, verify it shows in positions
Test closing a position, verify it disappears
Verify account balance updates after trades
Test equity curve chart renders with portfolio history data
Manual Verification
Place a trade on Signal Deck, then check alpaca.markets to confirm it synced
Place a trade on Alpaca's dashboard, then refresh Signal Deck to confirm it appears
Verify the fallback mode works when Alpaca keys are removed