# Trading Crash Course — What You Need to Know

> Written based on what came up during our backtesting session. This is a practical guide for someone building trading tools, not a get-rich-quick manual.

---

## Part 1: The Basics You Can't Skip

### What Is a Candle (OHLCV)?

Every piece of market data in this system is a **candlestick** with five values:

- **O** — Open: price when the period started
- **H** — High: highest price during the period
- **L** — Low: lowest price during the period
- **C** — Close: price when the period ended
- **V** — Volume: how many shares traded during the period

A "daily candle" covers one trading day. A "1-hour candle" covers one hour. Everything we built uses daily candles from Yahoo Finance.

### What Is Buy & Hold?

Simply buying a stock at the start of a period and holding it until the end, doing nothing. This is your baseline competitor. If your trading system doesn't beat buy & hold, it's not worth the complexity.

In our results: TSLA buy & hold returned +15.35% over the year. Our signal system returned +48.65% cumulative. That's a **+33.30% edge** — meaning the system is worthwhile for TSLA.

### What Is a Stop-Loss?

An automatic exit order that sells your position if the price drops by a certain percentage. Protects you from catastrophic losses.

Example: you buy AAPL at $250. With a 2% stop-loss, you auto-sell at $245 if the price falls there.

### What Is a Take-Profit?

The opposite — an automatic sell if the price rises by a certain percentage, locking in a gain.

Example: same $250 AAPL buy, 3% take-profit → auto-sell at $257.50.

### What Is Reward-to-Risk (R:R) Ratio?

The ratio of potential gain to potential loss on a trade.

- 3% take-profit / 2% stop-loss = **1.5:1 R:R**
- 5% take-profit / 2% stop-loss = **2.5:1 R:R**

**Why it matters:** At 1.5:1 R:R, you only need to be right 40% of the time to be profitable. At 1:1, you need 50%+. Higher R:R ratios let you survive more losses.

Our ATR-based stops used 1.5x ATR (stop) and 2.5x ATR (target), giving roughly 1.67:1 R:R.

---

## Part 2: Technical Indicators — What We Used

These are mathematical calculations applied to price and volume data to identify patterns and momentum.

### RSI — Relative Strength Index

**What it is:** Measures how fast and how much a stock's price has moved recently, on a 0–100 scale.

- **Below 30:** Oversold — the stock has fallen hard and fast. Potential buying opportunity.
- **Above 70:** Overbought — the stock has risen hard and fast. Potential selling opportunity.
- **Around 50:** Neutral.

**What we found:** RSI recovering from below 30 (crossing back above) was a reliable bullish signal, especially combined with Stochastic oversold.

**The catch:** A stock can stay oversold for weeks in a downtrend. RSI below 30 alone is not enough — you need confirmation.

### MACD — Moving Average Convergence Divergence

**What it is:** The difference between two exponential moving averages (fast EMA minus slow EMA). Generates a "signal line" (smoothed MACD) and a "histogram" (difference between MACD and signal line).

- **MACD crosses above the signal line:** Bullish — momentum is turning positive. This was one of our best signals.
- **MACD crosses below the signal line:** Bearish.
- **Histogram expanding:** Momentum strengthening in the current direction.

**What we found:** MACD bullish crossover was the most consistent single signal — 57% win rate on AAPL over 7 trades. Combined with volume spike, it hit 100% win rate (small sample).

### Bollinger Bands

**What they are:** Three lines around a moving average — an upper band, the middle (SMA), and a lower band. The width adapts to volatility (uses standard deviation).

- **Price touches lower band:** Stock is statistically far below its recent average. Can indicate oversold conditions.
- **Price touches upper band:** Statistically far above average. Can indicate overbought.
- **BB %B:** Tells you where price is within the bands. 0 = at lower band, 1 = at upper band.

**What we found:** Bollinger Band lower bounce (price touches lower band then closes above it) was a solid moderate signal, especially combined with EMA positioning.

### SMA — Simple Moving Average

**What it is:** The average closing price over N days. SMA20 = last 20 days. SMA50 = last 50 days.

- **SMA20 > SMA50:** Uptrend — shorter-term price is above longer-term price. "Bullish trend."
- **SMA20 < SMA50:** Downtrend.

**Golden Cross:** SMA20 crosses above SMA50 → major bullish signal (but lagging — often signals after the move already started).

**Death Cross:** SMA20 crosses below SMA50 → major bearish signal.

**What we found:** Trend direction (SMA20 vs SMA50) is best used as a **filter**, not a primary signal. We applied it in the multi-signal confirmation: easier entry requirements when in bullish trend, harder when bearish.

### EMA — Exponential Moving Average

Like SMA but gives more weight to recent prices. Reacts faster. We used EMA9 and EMA12 as short-term momentum gauges.

- Price above EMA9 and EMA12 = short-term bullish momentum
- Price below both = short-term bearish

### ATR — Average True Range

**What it is:** The average of the daily high-low range over 14 days. Measures **volatility** — not direction, just how much a stock moves on a typical day.

**Why it matters for stops:** This was the most impactful change we made. Using ATR to size stops (1.5x ATR for stop-loss) adapts to each stock's actual movement:

- TSLA ATR might be 4-5% of price → stop-loss gives it 6-7.5% room
- SPY ATR might be 0.5% of price → stop-loss gives only 0.75% room

Fixed 2% stops got blown out on TSLA constantly. ATR-based stops solved this.

**Formula we used:**
```
stop_loss_pct = (ATR × 1.5 / entry_price) × 100
take_profit_pct = (ATR × 2.5 / entry_price) × 100
```

### Stochastic Oscillator

**What it is:** Compares the closing price to the high-low range over 14 days. Like RSI but based on range rather than speed.

- **K below 20 AND D below 20:** Oversold
- **K above 80 AND D above 80:** Overbought

Best used as confirmation — RSI oversold + Stochastic oversold together was one of our 100% win-rate combos.

### ADX — Average Directional Index

**What it is:** Measures trend **strength** (not direction). 0–100 scale.

- **ADX below 20:** Weak or no trend — signals are less reliable
- **ADX above 25:** Trend is gaining strength
- **ADX above 40:** Very strong trend
- **+DI line:** Strength of upward movement
- **-DI line:** Strength of downward movement

If ADX > 25 and +DI > -DI → strong bullish trend. This is a supporting signal for BUY.

**What we found:** ADX > 25 is a useful confirmation but fires too often to be a standalone trigger. Most effective as a filter on top of other signals.

### OBV — On-Balance Volume

**What it is:** A running total of volume — adds volume on up days, subtracts on down days. Tracks whether volume is generally buying (accumulation) or selling (distribution).

**OBV divergence:** When price falls but OBV rises, it means people are buying quietly while the price is down. This often precedes a price recovery — and was our strongest standalone signal on NVDA (83% win rate).

---

## Part 3: Strategy Concepts

### Signal Confirmation

The single most important concept from our testing: **one indicator is noise, two or more are a signal.**

Every indicator has false positives — times it fires but the price doesn't follow. The way to filter these out is to require multiple independent signals to agree before acting. "Independent" matters — two indicators that both use moving averages aren't truly independent.

**Examples of independent signals:**
- RSI (momentum) + MACD (trend crossover) → two different mechanisms agreeing
- Volume spike + BB bounce → price and volume confirming each other
- OBV divergence + RSI recovery → smart money accumulation + price showing strength

### Trend-Aware Strategies

One of our key improvements: making the multi-signal threshold **depend on the trend direction**.

- In an uptrend (SMA20 > SMA50): one strong + one supporting signal is enough. You're trading with the wind.
- In a downtrend (SMA20 < SMA50): require more confirmation. You're fighting the wind.

This dramatically improved TSLA and AAPL results. MSFT stayed negative because it was in a downtrend all year and we only have long (buy) strategies.

### Walk-Forward Testing

When backtesting, you must **never use future data to generate a signal.** This is called lookahead bias, and it's the most common way backtests lie to you.

Our backtester correctly computes indicators only using data up to the day being tested. When testing day 100, it can't see day 101. This is called walk-forward testing.

### Paper Trading

Running your system for real market conditions but without real money. You log every signal and what would have happened if you traded it. After a month, you have live (non-backtested) data to evaluate.

This is the most honest test of a system because it's out-of-sample data — the system has never seen it before.

### Drawdown

The peak-to-trough decline in your portfolio value during a losing streak. Even a profitable system has drawdowns. The question is whether you can survive them psychologically and financially.

A system with 60% win rate can still have 6 losses in a row (it happens). If each loss is 3%, that's an 18% drawdown. Size positions accordingly.

---

## Part 4: LLMs in Trading — Honest Assessment

### What 8B Local Models Can and Can't Do

**Can do:**
- Parse and summarize structured indicator data
- Apply rule-based reasoning ("if RSI < 30 and MACD crossing up → buy")
- Provide consistent output format (JSON)
- Explain its reasoning in natural language

**Can't do:**
- Predict prices
- Consistently outperform mechanical rules
- Handle ambiguous market conditions better than a well-tuned algorithm
- Replace quantitative analysis

### Why the Signal Backtester Won

The signal backtester beat the LLM on every stock it had an edge on. The reasons:

1. **Consistency** — Mechanical rules execute identically every time. The LLM interprets the same data differently across calls due to temperature and non-determinism.
2. **Speed** — The signal backtester is instant. The LLM takes 5-10 seconds per call.
3. **Calibration** — We tuned the ATR multipliers deliberately. The LLM's stop suggestions were often wrong for the stock's volatility.
4. **No hallucination** — The signal backtester can't rationalize a bad setup.

### Where LLMs Genuinely Add Value in Trading

- **Sentiment analysis** — Parsing earnings call transcripts, SEC filings, news articles for qualitative signals
- **Context summarization** — "Given that NVDA just reported earnings and guidance was cut, how should I interpret this MACD crossover?"
- **Research assistance** — Understanding a company's business before trading its stock
- **Thesis articulation** — Forcing you to write out why you're entering a trade (accountability)

### The Fine-Tuning Path (Future)

If you accumulate enough labeled paper trade data, you can fine-tune a small model (7-13B) on it:

- Input: indicator snapshot on a given day
- Output: whether the trade that followed was a win or loss

After enough examples, the model may learn to distinguish setups that mechanical rules miss. But you'd need 500+ labeled examples for this to be meaningful, and the base models are already pretty good at the mechanical reasoning — the real question is whether fine-tuning on your specific stocks/timeframe improves edge.

---

## Part 5: Building Your Trading Website

For a personal trading tracking/prediction website, here's the recommended stack and approach.

### Architecture

```
[Data Pipeline]  →  [Indicator Engine]  →  [Signal Detector]
       ↓                                          ↓
[Yahoo Finance /               [Flask/FastAPI API]
  Alpaca / Polygon]                     ↓
                               [React or plain HTML/JS frontend]
                                        ↓
                               [Chart.js / Plotly charts]
                                        ↓
                               [SQLite or PostgreSQL trade log]
```

### Data Sources

- **Yahoo Finance (yfinance)** — Free, daily data only, no real-time. Good for daily candles.
- **Alpaca** — Free API for US stocks, real-time and historical data, also supports paper trading with actual brokerage integration. **Recommended for your next step.**
- **Polygon.io** — More comprehensive, has a free tier. Good for intraday data.

### Pages to Build

1. **Dashboard** — Watchlist with current price, daily change, RSI, trend direction, any active signals
2. **Signal Feed** — Table of signals that fired today across your watchlist
3. **Trade Log** — Every trade the system suggested, what happened, P&L
4. **Equity Curve** — Chart of cumulative P&L over time
5. **Indicator Detail** — Per-stock page with price chart + indicator overlays

### Charting Libraries

- **Chart.js** — Simple, well-documented, good for line charts and bar charts. Use for equity curves and volume.
- **Plotly.js** — More powerful, supports candlestick charts natively. Use for the main price chart.
- **Lightweight Charts (TradingView)** — Free library from TradingView specifically for financial charts. Best-looking candlestick charts.

### Backend

- **Flask** — Simple Python web framework, easy to integrate with your existing Python code. Good starting point.
- **FastAPI** — Faster, better for APIs, auto-generates documentation. Use if you want a clean REST API that the frontend calls.
- **SQLite** → **PostgreSQL** — Start with SQLite (no setup), migrate to PostgreSQL if you need concurrent access or are running it as an actual server.

### Key Features for a Trading Site

- **Alerts** — Email or desktop notification when a signal fires
- **Paper trade log** — Record every suggestion with entry price, outcome
- **Backtesting UI** — Run the signal backtester from the web UI on any symbol/period
- **LLM analysis on demand** — Click a button on a stock page to get the LLM's current read

---

## Part 6: Things to Learn Next

In rough priority order based on what will most improve your results:

### 1. Risk Management (Highest Priority)

Position sizing is more important than signal accuracy. How much of your portfolio do you risk per trade? The Kelly Criterion and fixed fractional position sizing are the two standard approaches.

**Key concept:** If you're risking 10% of your portfolio per trade and you have a 5-trade losing streak, you're down 41%. If you risk 2% per trade, the same losing streak is only a 9.6% drawdown.

### 2. Short Selling / Bearish Strategies

Our system is long-only. MSFT was in a downtrend all year and lost money. Adding bearish signals (MACD death cross, RSI overbought reversal, OBV bearish divergence) would let the system also make money in down markets.

### 3. Timeframe Selection

Daily candles are slow — signals might be 1-3 days late. Intraday data (4h, 1h, 15m) generates signals faster and allows tighter stop-losses. The tradeoff is more noise and higher transaction costs.

### 4. Backtesting Validity

Key pitfalls to understand:
- **Lookahead bias** — Using future data in signal calculation (we avoided this)
- **Survivorship bias** — Only testing stocks that still exist (we're implicitly doing this)
- **Overfitting** — Tuning so many parameters that the system only works on historical data
- **Transaction costs** — We didn't model commissions or slippage. In real trading, each trade costs something.

### 5. Market Microstructure (For Later)

When you move to intraday trading, the bid-ask spread, order book depth, and latency matter. At daily candles, you can safely ignore this.

### 6. Fundamental Analysis

Technical analysis (what we built) looks at price patterns. Fundamental analysis looks at company financials — earnings, revenue growth, P/E ratios, debt levels. The two approaches can complement each other. A stock with great fundamentals and a bullish technical setup is a stronger trade than either alone.

---

## Quick Reference: Signal Strength Hierarchy

Based on our testing results, rough order of signal reliability:

| Rank | Signal | Notes |
|------|--------|-------|
| 1 | Multi-signal (2+ strong, same day) | Rare, near-perfect accuracy |
| 2 | MACD crossover + Volume spike | Our highest win-rate combo |
| 3 | RSI recovery + Stochastic oversold | Strong reversal confirmation |
| 4 | OBV bullish divergence (NVDA) | 83% win rate, stock-specific |
| 5 | BB lower bounce + above EMAs | Price + momentum confirmation |
| 6 | MACD crossover alone | Solid ~57% win rate |
| 7 | ADX trend confirmation (bullish trend only) | Good filter, weak trigger |
| 8 | Single indicator alone | Not reliable |
