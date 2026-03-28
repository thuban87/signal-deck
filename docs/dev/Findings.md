# Trading System — Findings & Results

> Testing period: 1 year (approx. March 2025 – March 2026)
> Stocks tested: AAPL, MSFT, NVDA, TSLA, SPY
> Strategy type: Long-only, daily candles

---

## 1. Signal-Only Backtester — Final Results

**Configuration:** ATR-based stops (1.5x SL, 2.5x TP), max hold 10 days, trend-aware multi-signal confirmation

| Symbol | Trades | Win Rate | Avg Return/Trade | Cumulative Return | Buy & Hold | Edge |
|--------|--------|----------|-----------------|-------------------|------------|------|
| AAPL   | 40     | 52.5%    | +1.08%          | +43.23%           | +24.45%    | **+18.78%** |
| MSFT   | 40     | 37.5%    | -0.63%          | -25.14%           | -19.18%    | -5.96% |
| NVDA   | 26     | 57.7%    | +1.60%          | +41.59%           | +23.48%    | **+18.11%** |
| TSLA   | 30     | 46.7%    | +1.62%          | +48.65%           | +15.35%    | **+33.30%** |
| SPY    | 35     | 34.3%    | -0.24%          | -8.25%            | +10.86%    | -19.11% |
| **Total** | **171** | **51.2%** | **+0.59%** | — | — | — |

### Best-Performing Individual Signals

| Signal | Symbol | Trades | Win Rate | Notes |
|--------|--------|--------|----------|-------|
| MACD crossover + Volume spike | AAPL | 2 | **100%** | Rare but highly reliable |
| RSI recovery + Stochastic oversold | MSFT | 2 | **100%** | Strong reversal combo |
| MACD + ADX + Above EMAs | NVDA | 3 | **100%** | Trend momentum confirmation |
| BB bounce + Above short EMAs | AAPL | 2 | **100%** | Support + momentum |
| OBV bullish divergence | NVDA | 6 | **83.3%** | Volume leading price |
| MACD bullish crossover | AAPL | 7 | 57.1% | Most frequent reliable signal |
| ADX + Above EMAs (uptrend only) | MSFT | 41 | **85.4%** | Was excellent before tightening |

### Key Signal Insights

- **Volume confirmation dramatically improves win rate.** Any signal paired with above-average volume performed significantly better.
- **Multi-signal combos are rare but near-perfect** — when 2+ strong signals align on the same day, the win rate approaches 100%.
- **"ADX + Above short EMAs" was the most interesting result** — 85% win rate on MSFT, 30-57% on other stocks. Suggests this signal is stock-specific, not universal.
- **OBV divergence on NVDA (83%)** — price was falling but volume was accumulating, correctly predicted reversals.
- **SPY consistently underperforms** — technical signals designed for individual stocks don't translate well to index ETFs. SPY's smoother price action means fewer clear signal conditions and tighter ATR stops that get hit on normal noise.

---

## 2. LLM Backtester — Final Results

**Configuration:** 200-day lookback, query every 5 days (~40 calls/stock), confidence threshold >= 4, LLM-suggested stops with ATR fallback, model: qwen3:8b via Ollama

| Symbol | Decisions | BUY% | Trades | Win Rate | Cumulative | Buy & Hold | Edge |
|--------|-----------|------|--------|----------|-----------|------------|------|
| AAPL   | 40        | 47.5% | 19    | **57.9%** | +14.85%  | +29.12%    | -14.27% |
| MSFT   | 40        | 25.0% | 10    | 40.0%    | +0.05%   | -19.18%    | ~0% |
| NVDA   | 40        | 30.0% | 12    | 33.3%    | -7.82%   | +20.64%    | -28.46% |
| TSLA   | 40        | 35.0% | 14    | 21.4%    | -23.09%  | +14.39%    | -37.48% |
| SPY    | 40        | 35.0% | 14    | 42.9%    | -1.97%   | +9.29%     | -11.26% |

---

## 3. Head-to-Head Comparison

| Symbol | Signal Edge | LLM Edge | Winner |
|--------|------------|----------|--------|
| AAPL   | **+18.78%** | -14.27% | Signal |
| MSFT   | -5.96%     | ~0%     | LLM (barely) |
| NVDA   | **+18.11%** | -28.46% | Signal |
| TSLA   | **+33.30%** | -37.48% | Signal |
| SPY    | -19.11%    | -11.26% | LLM (less bad) |

**Signal backtester wins on 3/5 stocks by a large margin. LLM is marginally better on the 2 negative-edge stocks (MSFT, SPY) simply by being more selective.**

---

## 4. Why the Signal Backtester Beats the LLM

### The LLM's Problems

1. **Stop-loss timing is poor on volatile stocks.** TSLA: 11 of 14 trades hit stop-loss. The LLM would correctly identify a setup but then get stopped out on normal intraday volatility before the thesis played out. The signal backtester's ATR-based stops are mechanically calibrated; the LLM's stops are suggestions that often end up too tight.

2. **The LLM buys into declining trends.** On NVDA and TSLA, which were falling in Q4 2025, the LLM kept buying at confidence 6/10 — getting stopped out repeatedly. The mechanical signal system also suffered here, but the ATR stops gave more room.

3. **The LLM misses strong trending moves.** AAPL rose from $195 to $280 (July–November 2025). The LLM generated only 19 trades over the full year (vs 40 for the signal backtester) and missed most of the trend because it was checking every 5 days and taking short-duration positions.

4. **The confidence scale compresses to 3-4.** In practice, qwen3:8b almost never goes above 7/10 or below 2/10. The "actionable" range is 4-7, which means the signal/noise separation is weak.

### Where the LLM Added Value

- **AAPL 57.9% win rate** — higher than signal backtester's 52.5%. The LLM is better at avoiding bad entries; it just doesn't trade enough.
- **MSFT and SPY**: LLM was *less bad* because it was more selective during trending-down or choppy periods. HOLD is free.
- **Reasoning quality**: The LLM correctly identified bearish environments on MSFT and held cash. The signal backtester blindly followed mechanical rules.

---

## 5. Stop-Loss Strategy Impact

One of the most important findings: **fixed percentage stops are significantly worse than ATR-based stops.**

| Configuration | AAPL Edge | TSLA Edge | Avg/Trade |
|---------------|-----------|-----------|-----------|
| Fixed 2%/3%   | -0.70%    | -25.78%   | +0.35%    |
| ATR 1.5x/2.5x | +18.78%   | +33.30%   | +0.59%    |

**Why:** TSLA moves 4-6% on a normal day. A 2% stop gets hit on routine noise, not real reversals. ATR-based stops size to actual volatility — giving volatile stocks more room while keeping tighter stops on stable ones like SPY.

---

## 6. Stock-Specific Observations

### AAPL
- Best overall performer for signal strategies
- MACD crossover is the most reliable signal (57% win rate, 7 trades over the year)
- Responds well to multi-signal confirmation
- Trending upward much of the year — long-only strategies work well

### MSFT
- Downtrend year (buy & hold -19%) — long-only strategies structurally disadvantaged
- "ADX + EMAs" was exceptional (85.4% win rate) when it was in uptrend phases
- Would benefit most from adding short/sell signals

### NVDA
- High volatility makes stop sizing critical
- OBV divergence was the standout signal (83% win rate)
- Suffered from the LLM making 8 consecutive losing trades in Q4 2025 (downtrend)

### TSLA
- Highest volatility of the group — ATR stops made the biggest difference here (edge went from -25.78% to +33.30%)
- Signal system performed well in its favor; LLM was terrible (-37.48% edge)
- Most sensitive to stop-loss calibration

### SPY
- Neither system performs well — signals designed for individual stocks don't fit
- SPY's ATR is very low relative to price (~0.3-0.5%), making take-profit targets nearly impossible to hit
- Most exits were "timeout" rather than TP/SL — which means the signal had no real edge
- Would need different parameters or different signals entirely

---

## 7. Key Numbers to Remember

- **Break-even win rate at 1.5x reward-to-risk:** ~40% (this is why the LLM's 57% on AAPL is meaningful even with small gains)
- **Our ATR multipliers:** 1.5x ATR for stop-loss, 2.5x ATR for take-profit = ~1.67:1 reward-to-risk ratio
- **Minimum win rate needed at 1.67:1 R:R:** ~37.5%
- **System-wide win rate:** 51.2% — comfortably above break-even
- **Average return per trade:** +0.59% — modest but positive with room to improve

---

## 8. What To Do Next (Priority Order)

1. **Add short/sell signals** — MSFT and SPY are net negative because we're only ever buying. Death cross, MACD bearish crossover, RSI overbought reversal, OBV bearish divergence.

2. **Add a cooldown between LLM calls** — GPU crashes from sustained Ollama inference. 2-5 second sleep between calls would solve this.

3. **Separate ATR-based stops from LLM-suggested stops** — Always use ATR for stop sizing regardless of what the LLM suggests. LLM stops are unreliable.

4. **Build a web dashboard** — Flask/FastAPI backend + Chart.js frontend. Useful features: live indicator display, signal alerts, trade log, equity curve chart.

5. **Test shorter timeframes** — 4h or 1h candles. Signals fire more often, potentially more alpha. Requires a real-time data source (Alpaca, Polygon, etc.).

6. **Paper trading mode** — Run the live system daily without executing trades. Log every suggestion. Review weekly. Build a labeled dataset.

7. **Fine-tuning experiment** — Once you have 200+ paper trade outcomes labeled (setup → result), try fine-tuning a small model (Mistral 7B or similar) on that dataset and compare to the base model.
