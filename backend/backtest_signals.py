"""Signal-only backtester — tests whether technical indicator signals have
predictive value, without involving the LLM. Runs fast."""

import sys
import pandas as pd
from data_fetcher import fetch_stock_data
from indicators import add_all_indicators
from config import (
    WATCHLIST, SMA_SHORT, SMA_LONG, RSI_PERIOD,
    BB_PERIOD, BB_STD,
)


# ---------------------------------------------------------------------------
# Trade simulation helpers
# ---------------------------------------------------------------------------

def simulate_trades(df: pd.DataFrame, signals: list[dict],
                    stop_loss_pct: float = 2.0,
                    take_profit_pct: float = 3.0,
                    max_hold_days: int = 10,
                    use_atr_stops: bool = True,
                    atr_sl_mult: float = 1.5,
                    atr_tp_mult: float = 2.5) -> list[dict]:
    """Walk forward through signals and simulate outcomes.

    Supports both BUY (long) and SELL (short) signals.
    For SELL/SHORT signals, profit comes from price decline.

    If use_atr_stops is True, SL/TP are calculated from ATR at entry,
    adapting to each stock's volatility. Falls back to fixed pct if ATR
    is unavailable.
    """
    trades = []
    for sig in signals:
        entry_idx = df.index.get_loc(sig["date"])
        entry_price = sig["entry_price"]
        entry_row = df.iloc[entry_idx]
        direction = sig.get("direction", "long")  # "long" or "short"

        # ATR-based stops: adapt to the stock's actual volatility
        if use_atr_stops and "atr" in df.columns and pd.notna(entry_row.get("atr")):
            atr = entry_row["atr"]
            sl_pct = (atr * atr_sl_mult / entry_price) * 100
            tp_pct = (atr * atr_tp_mult / entry_price) * 100
            # Floor: at least 1% SL, 1.5% TP to avoid trivial stops
            sl_pct = max(sl_pct, 1.0)
            tp_pct = max(tp_pct, 1.5)
        else:
            sl_pct = stop_loss_pct
            tp_pct = take_profit_pct

        if direction == "long":
            sl_price = entry_price * (1 - sl_pct / 100)
            tp_price = entry_price * (1 + tp_pct / 100)
        else:  # short
            sl_price = entry_price * (1 + sl_pct / 100)  # SL is ABOVE entry
            tp_price = entry_price * (1 - tp_pct / 100)  # TP is BELOW entry

        exit_price = None
        exit_date = None
        exit_reason = None

        for offset in range(1, max_hold_days + 1):
            look = entry_idx + offset
            if look >= len(df):
                break
            candle = df.iloc[look]

            if direction == "long":
                # Check stop-loss first (assume worst-case intraday order)
                if candle["Low"] <= sl_price:
                    exit_price = sl_price
                    exit_date = df.index[look]
                    exit_reason = "stop_loss"
                    break
                # Then take-profit
                if candle["High"] >= tp_price:
                    exit_price = tp_price
                    exit_date = df.index[look]
                    exit_reason = "take_profit"
                    break
            else:  # short
                # SL for shorts: price goes UP past stop
                if candle["High"] >= sl_price:
                    exit_price = sl_price
                    exit_date = df.index[look]
                    exit_reason = "stop_loss"
                    break
                # TP for shorts: price goes DOWN past target
                if candle["Low"] <= tp_price:
                    exit_price = tp_price
                    exit_date = df.index[look]
                    exit_reason = "take_profit"
                    break

        # If neither hit, exit at close on last day
        if exit_price is None:
            last = min(entry_idx + max_hold_days, len(df) - 1)
            exit_price = df.iloc[last]["Close"]
            exit_date = df.index[last]
            exit_reason = "timeout"

        if direction == "long":
            pnl_pct = ((exit_price - entry_price) / entry_price) * 100
        else:  # short profits when price falls
            pnl_pct = ((entry_price - exit_price) / entry_price) * 100

        trades.append({
            "entry_date": sig["date"],
            "exit_date": exit_date,
            "signal": sig["signal"],
            "direction": direction,
            "entry_price": round(entry_price, 2),
            "exit_price": round(exit_price, 2),
            "pnl_pct": round(pnl_pct, 2),
            "exit_reason": exit_reason,
            "sl_pct": round(sl_pct, 2),
            "tp_pct": round(tp_pct, 2),
        })

    return trades


# ---------------------------------------------------------------------------
# Signal generators — each returns a list of {date, entry_price, signal}
# ---------------------------------------------------------------------------

def find_rsi_oversold_signals(df: pd.DataFrame) -> list[dict]:
    """RSI dropping below 30 then recovering."""
    signals = []
    for i in range(1, len(df)):
        if df.iloc[i - 1]["rsi"] < 30 and df.iloc[i]["rsi"] >= 30:
            signals.append({
                "date": df.index[i],
                "entry_price": df.iloc[i]["Close"],
                "signal": "RSI oversold recovery",
            })
    return signals


def find_macd_crossover_signals(df: pd.DataFrame) -> list[dict]:
    """Bullish MACD crossover with volume at or above average."""
    signals = []
    for i in range(1, len(df)):
        prev = df.iloc[i - 1]
        curr = df.iloc[i]
        if (prev["macd"] < prev["macd_signal"]
                and curr["macd"] > curr["macd_signal"]
                and curr["volume_ratio"] >= 0.8):  # Not on dying volume
            signals.append({
                "date": df.index[i],
                "entry_price": curr["Close"],
                "signal": "MACD bullish crossover",
            })
    return signals


def find_bb_bounce_signals(df: pd.DataFrame) -> list[dict]:
    """Price touches lower Bollinger Band then closes above it, with volume."""
    signals = []
    for i in range(1, len(df)):
        prev = df.iloc[i - 1]
        curr = df.iloc[i]
        if (prev["Close"] <= prev["bb_lower"]
                and curr["Close"] > curr["bb_lower"]
                and curr["volume_ratio"] >= 0.8):  # Not on dying volume
            signals.append({
                "date": df.index[i],
                "entry_price": curr["Close"],
                "signal": "BB lower bounce",
            })
    return signals


def find_golden_cross_signals(df: pd.DataFrame) -> list[dict]:
    """SMA short crosses above SMA long."""
    signals = []
    for i in range(1, len(df)):
        prev = df.iloc[i - 1]
        curr = df.iloc[i]
        if prev["sma_short"] < prev["sma_long"] and curr["sma_short"] > curr["sma_long"]:
            signals.append({
                "date": df.index[i],
                "entry_price": curr["Close"],
                "signal": "Golden cross",
            })
    return signals


def find_volume_spike_signals(df: pd.DataFrame) -> list[dict]:
    """Volume spike (>2x average) on a green candle."""
    signals = []
    for i in range(len(df)):
        row = df.iloc[i]
        if row["volume_ratio"] > 2.0 and row["Close"] > row["Open"]:
            signals.append({
                "date": df.index[i],
                "entry_price": row["Close"],
                "signal": "Volume spike (green candle)",
            })
    return signals


def find_adx_trend_signals(df: pd.DataFrame) -> list[dict]:
    """Strong bullish trend confirmed by ADX > 30, +DI > -DI, and above-average volume."""
    signals = []
    for i in range(1, len(df)):
        prev = df.iloc[i - 1]
        curr = df.iloc[i]
        # Tighter: ADX must cross 30 (not 25), volume must confirm
        if (prev["adx"] <= 30 and curr["adx"] > 30
                and curr["adx_pos"] > curr["adx_neg"]
                and curr["volume_ratio"] > 1.0):
            signals.append({
                "date": df.index[i],
                "entry_price": curr["Close"],
                "signal": "ADX bullish trend confirmation",
            })
    return signals


def find_obv_divergence_signals(df: pd.DataFrame) -> list[dict]:
    """Bullish OBV divergence — price declining over 5 days but OBV rising,
    with RSI confirming we're in oversold territory."""
    signals = []
    for i in range(5, len(df)):
        curr = df.iloc[i]
        five_ago = df.iloc[i - 5]
        # Price dropped over 5 days but OBV rose — stronger divergence signal
        if (curr["Close"] < five_ago["Close"]
                and curr["obv"] > five_ago["obv"]
                and curr["rsi"] < 40
                and curr["Close"] > curr["bb_lower"]):  # Not in freefall
            signals.append({
                "date": df.index[i],
                "entry_price": curr["Close"],
                "signal": "OBV bullish divergence",
            })
    return signals


def find_multi_signal_confirmation(df: pd.DataFrame) -> list[dict]:
    """Tiered multi-signal confirmation.

    Signals are categorized as STRONG (actionable on their own in combination)
    or SUPPORTING (add confidence but don't count as primary triggers).

    Trigger thresholds are trend-aware:
    - Bullish trend (SMA short > SMA long): 1 strong + 1 supporting is enough
    - Bearish/neutral trend: need 2+ strong, OR 1 strong + 2 supporting
    This recovers good trend-following trades without reintroducing noise
    in bearish conditions.
    """
    signals = []

    for i in range(1, len(df)):
        curr = df.iloc[i]
        prev = df.iloc[i - 1]

        # STRONG signals — these represent actual events/reversals
        strong = []
        if prev["rsi"] < 30 and curr["rsi"] >= 30:
            strong.append("RSI recovery")
        if (prev["macd"] < prev["macd_signal"]
                and curr["macd"] > curr["macd_signal"]):
            strong.append("MACD crossover")
        if prev["Close"] <= prev["bb_lower"] and curr["Close"] > curr["bb_lower"]:
            strong.append("BB bounce")
        if curr["volume_ratio"] > 2.0 and curr["Close"] > curr["Open"]:
            strong.append("Volume spike")
        if curr["stoch_k"] < 20 and curr["stoch_d"] < 20:
            strong.append("Stochastic oversold")

        # SUPPORTING signals — confirm direction but too persistent to be triggers
        supporting = []
        if curr["adx"] > 25 and curr["adx_pos"] > curr["adx_neg"]:
            supporting.append("ADX bullish")
        if (curr["Close"] < prev["Close"] and curr["obv"] > prev["obv"]
                and curr["rsi"] < 45):
            supporting.append("OBV divergence")
        if curr["Close"] > curr["ema_9"] and curr["Close"] > curr["ema_12"]:
            supporting.append("Above short EMAs")
        if curr["volume_ratio"] >= 1.2:
            supporting.append("Above-avg volume")

        # Trend-aware thresholds
        in_bullish_trend = curr["sma_short"] > curr["sma_long"]

        if in_bullish_trend:
            # Easier trigger in confirmed uptrend: 1 strong + 1 supporting
            triggered = len(strong) >= 2 or (len(strong) >= 1 and len(supporting) >= 1)
        else:
            # Harder trigger against the trend: 2 strong, or 1 strong + 2 supporting
            triggered = len(strong) >= 2 or (len(strong) >= 1 and len(supporting) >= 2)

        if triggered:
            trend_tag = "uptrend" if in_bullish_trend else "counter-trend"
            label = " + ".join(strong)
            if supporting:
                label += " [+" + ", ".join(supporting) + "]"
            signals.append({
                "date": df.index[i],
                "entry_price": curr["Close"],
                "signal": "Multi-signal/%s (%s)" % (trend_tag, label),
            })

    return signals


ALL_SIGNAL_FINDERS = [
    find_rsi_oversold_signals,
    find_macd_crossover_signals,
    find_bb_bounce_signals,
    find_golden_cross_signals,
    find_volume_spike_signals,
    find_adx_trend_signals,
    find_obv_divergence_signals,
    find_multi_signal_confirmation,
]


# ---------------------------------------------------------------------------
# Bearish / Short signal generators
# ---------------------------------------------------------------------------

def find_macd_bearish_crossover_signals(df: pd.DataFrame) -> list[dict]:
    """Bearish MACD crossover with volume at or above average."""
    signals = []
    for i in range(1, len(df)):
        prev = df.iloc[i - 1]
        curr = df.iloc[i]
        if (prev["macd"] > prev["macd_signal"]
                and curr["macd"] < curr["macd_signal"]
                and curr["volume_ratio"] >= 0.8):
            signals.append({
                "date": df.index[i],
                "entry_price": curr["Close"],
                "signal": "MACD bearish crossover",
                "direction": "short",
            })
    return signals


def find_rsi_overbought_signals(df: pd.DataFrame) -> list[dict]:
    """RSI crossing back below 70 from overbought territory."""
    signals = []
    for i in range(1, len(df)):
        if df.iloc[i - 1]["rsi"] > 70 and df.iloc[i]["rsi"] <= 70:
            signals.append({
                "date": df.index[i],
                "entry_price": df.iloc[i]["Close"],
                "signal": "RSI overbought reversal",
                "direction": "short",
            })
    return signals


def find_death_cross_signals(df: pd.DataFrame) -> list[dict]:
    """SMA short crosses below SMA long."""
    signals = []
    for i in range(1, len(df)):
        prev = df.iloc[i - 1]
        curr = df.iloc[i]
        if prev["sma_short"] > prev["sma_long"] and curr["sma_short"] < curr["sma_long"]:
            signals.append({
                "date": df.index[i],
                "entry_price": curr["Close"],
                "signal": "Death cross",
                "direction": "short",
            })
    return signals


def find_obv_bearish_divergence_signals(df: pd.DataFrame) -> list[dict]:
    """Bearish OBV divergence — price rising over 5 days but OBV falling,
    with RSI confirming overbought territory."""
    signals = []
    for i in range(5, len(df)):
        curr = df.iloc[i]
        five_ago = df.iloc[i - 5]
        if (curr["Close"] > five_ago["Close"]
                and curr["obv"] < five_ago["obv"]
                and curr["rsi"] > 60
                and curr["Close"] < curr["bb_upper"]):  # Not in a breakout
            signals.append({
                "date": df.index[i],
                "entry_price": curr["Close"],
                "signal": "OBV bearish divergence",
                "direction": "short",
            })
    return signals


def find_multi_signal_bearish_confirmation(df: pd.DataFrame) -> list[dict]:
    """Tiered multi-signal bearish confirmation.

    Mirror of bullish confirmation but for short/sell setups.
    Trend-aware thresholds:
    - Bearish trend (SMA short < SMA long): 1 strong + 1 supporting
    - Bullish/neutral: 2 strong, or 1 strong + 2 supporting
    """
    signals = []

    for i in range(1, len(df)):
        curr = df.iloc[i]
        prev = df.iloc[i - 1]

        # STRONG bearish signals
        strong = []
        if prev["rsi"] > 70 and curr["rsi"] <= 70:
            strong.append("RSI overbought reversal")
        if (prev["macd"] > prev["macd_signal"]
                and curr["macd"] < curr["macd_signal"]):
            strong.append("MACD bearish crossover")
        if prev["Close"] >= prev["bb_upper"] and curr["Close"] < curr["bb_upper"]:
            strong.append("BB upper rejection")
        if curr["volume_ratio"] > 2.0 and curr["Close"] < curr["Open"]:
            strong.append("Volume spike (red candle)")
        if curr["stoch_k"] > 80 and curr["stoch_d"] > 80:
            strong.append("Stochastic overbought")

        # SUPPORTING bearish signals
        supporting = []
        if curr["adx"] > 25 and curr["adx_neg"] > curr["adx_pos"]:
            supporting.append("ADX bearish")
        if (curr["Close"] > prev["Close"] and curr["obv"] < prev["obv"]
                and curr["rsi"] > 55):
            supporting.append("OBV bearish divergence")
        if curr["Close"] < curr["ema_9"] and curr["Close"] < curr["ema_12"]:
            supporting.append("Below short EMAs")
        if curr["volume_ratio"] >= 1.2:
            supporting.append("Above-avg volume")

        # Trend-aware thresholds
        in_bearish_trend = curr["sma_short"] < curr["sma_long"]

        if in_bearish_trend:
            triggered = len(strong) >= 2 or (len(strong) >= 1 and len(supporting) >= 1)
        else:
            triggered = len(strong) >= 2 or (len(strong) >= 1 and len(supporting) >= 2)

        if triggered:
            trend_tag = "downtrend" if in_bearish_trend else "counter-trend"
            label = " + ".join(strong)
            if supporting:
                label += " [+" + ", ".join(supporting) + "]"
            signals.append({
                "date": df.index[i],
                "entry_price": curr["Close"],
                "signal": "Multi-signal-SELL/%s (%s)" % (trend_tag, label),
                "direction": "short",
            })

    return signals


ALL_BEARISH_SIGNAL_FINDERS = [
    find_macd_bearish_crossover_signals,
    find_rsi_overbought_signals,
    find_death_cross_signals,
    find_obv_bearish_divergence_signals,
    find_multi_signal_bearish_confirmation,
]

ALL_COMBINED_SIGNAL_FINDERS = ALL_SIGNAL_FINDERS + ALL_BEARISH_SIGNAL_FINDERS


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------

def print_report(symbol: str, all_trades: list[dict], buy_hold_pct: float):
    """Print a summary report for one symbol."""
    print(f"\n{'='*60}")
    print(f"  BACKTEST RESULTS: {symbol}")
    print(f"{'='*60}")

    if not all_trades:
        print("  No signals generated in this period.")
        print(f"  Buy & hold return: {buy_hold_pct:+.2f}%")
        return

    # Group by signal type
    by_signal = {}
    for t in all_trades:
        by_signal.setdefault(t["signal"], []).append(t)

    for sig_name, trades in by_signal.items():
        wins = [t for t in trades if t["pnl_pct"] > 0]
        losses = [t for t in trades if t["pnl_pct"] <= 0]
        avg_pnl = sum(t["pnl_pct"] for t in trades) / len(trades)
        win_rate = len(wins) / len(trades) * 100
        direction = trades[0].get("direction", "long").upper()

        print(f"\n  Signal: {sig_name} [{direction}]")
        print(f"    Trades: {len(trades)} | Wins: {len(wins)} | Losses: {len(losses)}")
        print(f"    Win rate: {win_rate:.1f}%")
        print(f"    Avg return per trade: {avg_pnl:+.2f}%")

        tp_exits = len([t for t in trades if t["exit_reason"] == "take_profit"])
        sl_exits = len([t for t in trades if t["exit_reason"] == "stop_loss"])
        to_exits = len([t for t in trades if t["exit_reason"] == "timeout"])
        print(f"    Exits: {tp_exits} TP | {sl_exits} SL | {to_exits} timeout")

        # Show individual trades
        for t in trades:
            marker = "W" if t["pnl_pct"] > 0 else "L"
            stops = f"SL:{t['sl_pct']:.1f}%/TP:{t['tp_pct']:.1f}%"
            d_tag = "S" if t.get("direction") == "short" else "L"
            print(
                f"      [{marker}{d_tag}] {str(t['entry_date'].date()):>10} -> "
                f"{str(t['exit_date'].date()):>10} | "
                f"${t['entry_price']:>8.2f} -> ${t['exit_price']:>8.2f} | "
                f"{t['pnl_pct']:>+6.2f}% ({t['exit_reason']}) [{stops}]"
            )

    # Overall — split by direction
    long_trades = [t for t in all_trades if t.get("direction", "long") == "long"]
    short_trades = [t for t in all_trades if t.get("direction") == "short"]

    for label, trades in [("LONG", long_trades), ("SHORT", short_trades), ("COMBINED", all_trades)]:
        if not trades:
            continue
        total_pnl = sum(t["pnl_pct"] for t in trades)
        avg_pnl = total_pnl / len(trades)
        total_wins = len([t for t in trades if t["pnl_pct"] > 0])
        total_win_rate = total_wins / len(trades) * 100

        print(f"\n  {label} SUMMARY:")
        print(f"    Total trades: {len(trades)}")
        print(f"    Win rate: {total_win_rate:.1f}%")
        print(f"    Average return per trade: {avg_pnl:+.2f}%")
        print(f"    Cumulative return (non-compounded): {total_pnl:+.2f}%")

    print(f"\n  Buy & hold return: {buy_hold_pct:+.2f}%")
    total_pnl = sum(t["pnl_pct"] for t in all_trades)
    edge = total_pnl - buy_hold_pct
    print(f"  Combined edge vs buy & hold: {edge:+.2f}%")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def backtest_symbol(symbol: str, period: str = "1y",
                    include_bearish: bool = True) -> list[dict]:
    """Run all signal strategies against historical data for one symbol."""
    print(f"\n  Fetching {symbol} ({period})...")
    df = fetch_stock_data(symbol, period=period)
    df = add_all_indicators(df)

    # Drop rows where indicators haven't warmed up yet
    df = df.dropna(subset=["sma_long", "rsi", "macd", "bb_lower"])

    buy_hold_pct = ((df.iloc[-1]["Close"] - df.iloc[0]["Close"]) / df.iloc[0]["Close"]) * 100

    finders = ALL_COMBINED_SIGNAL_FINDERS if include_bearish else ALL_SIGNAL_FINDERS

    all_trades = []
    for finder in finders:
        signals = finder(df)
        if signals:
            trades = simulate_trades(df, signals)
            all_trades.extend(trades)

    print_report(symbol, all_trades, buy_hold_pct)
    return all_trades


def main():
    symbols = sys.argv[1:] if len(sys.argv) > 1 else WATCHLIST
    period = "1y"

    print("Signal Backtester (Long + Short)")
    print(f"Period: {period}")
    print(f"Symbols: {', '.join(symbols)}")
    print(f"Stops: ATR-based (1.5x SL, 2.5x TP) | Max hold: 10 days")

    all_results = {}
    for symbol in symbols:
        try:
            all_results[symbol] = backtest_symbol(symbol, period)
        except Exception as e:
            print(f"\n  ERROR backtesting {symbol}: {e}")

    # Grand summary
    every_trade = [t for trades in all_results.values() for t in trades]
    if every_trade:
        print(f"\n{'='*60}")
        print(f"  GRAND SUMMARY ACROSS ALL SYMBOLS")
        print(f"{'='*60}")
        total = len(every_trade)
        wins = len([t for t in every_trade if t["pnl_pct"] > 0])
        avg = sum(t["pnl_pct"] for t in every_trade) / total
        longs = [t for t in every_trade if t.get("direction", "long") == "long"]
        shorts = [t for t in every_trade if t.get("direction") == "short"]
        print(f"  Total trades: {total} ({len(longs)} long, {len(shorts)} short)")
        print(f"  Win rate: {wins/total*100:.1f}%")
        print(f"  Average return per trade: {avg:+.2f}%")


if __name__ == "__main__":
    main()

