"""LLM backtester — walks forward through historical data, queries Ollama
for each day, and simulates trades based on the LLM's recommendations.
Much slower than signal-only but tests the full system."""

import sys
import json
import pandas as pd
from data_fetcher import fetch_stock_data
from indicators import add_all_indicators, get_signal_summary
from llm_analyst import query_ollama
from config import WATCHLIST


def format_candles_for_prompt(df: pd.DataFrame, end_idx: int, n: int = 5) -> str:
    """Format N candles ending at end_idx for the LLM prompt."""
    start = max(0, end_idx - n + 1)
    subset = df.iloc[start:end_idx + 1]
    lines = []
    for date, row in subset.iterrows():
        change = row["Close"] - row["Open"]
        direction = "+" if change >= 0 else ""
        lines.append(
            f"  {date.strftime('%Y-%m-%d')}: "
            f"O=${row['Open']:.2f} H=${row['High']:.2f} "
            f"L=${row['Low']:.2f} C=${row['Close']:.2f} "
            f"({direction}{change:.2f}) Vol={int(row['Volume']):,}"
        )
    return "\n".join(lines)


def compute_atr_stops(df: pd.DataFrame, idx: int,
                      atr_sl_mult: float = 1.5,
                      atr_tp_mult: float = 2.5) -> tuple[float, float]:
    """Compute ATR-based SL/TP percentages at a given index."""
    row = df.iloc[idx]
    atr = row.get("atr")
    if pd.notna(atr) and atr > 0:
        sl_pct = max((atr * atr_sl_mult / row["Close"]) * 100, 1.0)
        tp_pct = max((atr * atr_tp_mult / row["Close"]) * 100, 1.5)
    else:
        sl_pct, tp_pct = 2.0, 3.0
    return round(sl_pct, 2), round(tp_pct, 2)


def simulate_trade(df: pd.DataFrame, entry_idx: int,
                   stop_loss_pct: float, take_profit_pct: float,
                   max_hold_days: int = 10) -> dict:
    """Simulate a single trade from entry_idx forward."""
    entry_price = df.iloc[entry_idx]["Close"]
    sl_price = entry_price * (1 - stop_loss_pct / 100)
    tp_price = entry_price * (1 + take_profit_pct / 100)

    exit_price = None
    exit_date = None
    exit_reason = None

    for offset in range(1, max_hold_days + 1):
        look = entry_idx + offset
        if look >= len(df):
            break
        candle = df.iloc[look]

        if candle["Low"] <= sl_price:
            exit_price = sl_price
            exit_date = df.index[look]
            exit_reason = "stop_loss"
            break
        if candle["High"] >= tp_price:
            exit_price = tp_price
            exit_date = df.index[look]
            exit_reason = "take_profit"
            break

    if exit_price is None:
        last = min(entry_idx + max_hold_days, len(df) - 1)
        exit_price = df.iloc[last]["Close"]
        exit_date = df.index[last]
        exit_reason = "timeout"

    pnl_pct = ((exit_price - entry_price) / entry_price) * 100
    return {
        "entry_date": df.index[entry_idx],
        "exit_date": exit_date,
        "entry_price": round(entry_price, 2),
        "exit_price": round(exit_price, 2),
        "pnl_pct": round(pnl_pct, 2),
        "exit_reason": exit_reason,
        "sl_pct": round(stop_loss_pct, 2),
        "tp_pct": round(take_profit_pct, 2),
    }


def backtest_llm(symbol: str, period: str = "1y",
                 lookback_days: int = 60, skip_days: int = 3) -> list[dict]:
    """Run the LLM backtester.

    Args:
        symbol: Stock ticker.
        period: Data fetch period.
        lookback_days: How many of the most recent trading days to test.
        skip_days: Query the LLM every N days (to keep runtime manageable).
    """
    print(f"\n{'='*60}")
    print(f"  LLM BACKTEST: {symbol}")
    print(f"{'='*60}")

    print(f"  Fetching data ({period})...")
    df = fetch_stock_data(symbol, period=period)
    df = add_all_indicators(df)
    df = df.dropna(subset=["sma_long", "rsi", "macd", "bb_lower"])

    total_rows = len(df)
    start_idx = max(5, total_rows - lookback_days)
    test_indices = list(range(start_idx, total_rows - 1, skip_days))

    print(f"  Testing {len(test_indices)} days (every {skip_days} days over last {lookback_days} trading days)")
    print(f"  This will make {len(test_indices)} LLM calls — please be patient.\n")

    trades = []
    decisions = []

    for count, idx in enumerate(test_indices, 1):
        date = df.index[idx]
        # Use the shared signal summary from indicators.py
        summary = get_signal_summary(df, idx)
        candles_text = format_candles_for_prompt(df, idx, n=5)

        print(f"  [{count}/{len(test_indices)}] {date.date()} | ${summary['close']} | ", end="", flush=True)

        try:
            analysis = query_ollama(symbol, summary, candles_text)
        except Exception as e:
            print(f"LLM error: {e}")
            continue

        action = analysis.get("action", "HOLD")
        confidence = analysis.get("confidence", 0)

        # Use LLM-suggested stops if reasonable, otherwise fall back to ATR-based
        atr_sl, atr_tp = compute_atr_stops(df, idx)
        llm_sl = analysis.get("suggested_stop_loss_pct") or 0
        llm_tp = analysis.get("suggested_take_profit_pct") or 0

        # Accept LLM stops if they're in a sane range, otherwise use ATR
        if 0.5 <= llm_sl <= 10 and llm_tp >= llm_sl * 1.2:
            sl_pct, tp_pct = llm_sl, llm_tp
            stops_source = "llm"
        else:
            sl_pct, tp_pct = atr_sl, atr_tp
            stops_source = "atr"

        print(f"{action} (conf: {confidence}/10)", end="")

        decision = {
            "date": date,
            "price": summary["close"],
            "action": action,
            "confidence": confidence,
            "reasoning": analysis.get("reasoning", ""),
            "sl_pct": sl_pct,
            "tp_pct": tp_pct,
            "stops_source": stops_source,
        }
        decisions.append(decision)

        # Only simulate trades for BUY recommendations with confidence >= 4
        if action == "BUY" and confidence >= 4:
            trade = simulate_trade(df, idx, sl_pct, tp_pct)
            trade["confidence"] = confidence
            trade["reasoning"] = analysis.get("reasoning", "")
            trade["stops_source"] = stops_source
            trades.append(trade)
            marker = "W" if trade["pnl_pct"] > 0 else "L"
            print(f" -> [{marker}] {trade['pnl_pct']:+.2f}% ({trade['exit_reason']}) "
                  f"[SL:{sl_pct:.1f}%/TP:{tp_pct:.1f}% {stops_source}]")
        else:
            print()

    # Report
    print(f"\n  {'='*50}")
    print(f"  RESULTS: {symbol}")
    print(f"  {'='*50}")

    total_decisions = len(decisions)
    buy_count = len([d for d in decisions if d["action"] == "BUY"])
    sell_count = len([d for d in decisions if d["action"] == "SELL"])
    hold_count = len([d for d in decisions if d["action"] == "HOLD"])

    print(f"  Decisions: {total_decisions} total")
    print(f"    BUY: {buy_count} | SELL: {sell_count} | HOLD: {hold_count}")

    if trades:
        wins = [t for t in trades if t["pnl_pct"] > 0]
        losses = [t for t in trades if t["pnl_pct"] <= 0]
        avg_pnl = sum(t["pnl_pct"] for t in trades) / len(trades)
        total_pnl = sum(t["pnl_pct"] for t in trades)
        win_rate = len(wins) / len(trades) * 100

        print(f"\n  Trades executed (BUY with confidence >= 4):")
        print(f"    Total: {len(trades)} | Wins: {len(wins)} | Losses: {len(losses)}")
        print(f"    Win rate: {win_rate:.1f}%")
        print(f"    Average return: {avg_pnl:+.2f}%")
        print(f"    Cumulative return: {total_pnl:+.2f}%")

        # Individual trades
        for t in trades:
            marker = "W" if t["pnl_pct"] > 0 else "L"
            print(
                f"    [{marker}] {str(t['entry_date'].date()):>10} -> "
                f"{str(t['exit_date'].date()):>10} | "
                f"${t['entry_price']:>8.2f} -> ${t['exit_price']:>8.2f} | "
                f"{t['pnl_pct']:>+6.2f}% | conf:{t['confidence']}/10 "
                f"({t['exit_reason']}) [{t['stops_source']}]"
            )
    else:
        print("\n  No BUY signals with confidence >= 4 were generated.")

    # Buy & hold comparison
    start_price = df.iloc[start_idx]["Close"]
    end_price = df.iloc[-1]["Close"]
    bh_pct = ((end_price - start_price) / start_price) * 100
    print(f"\n  Buy & hold over same period: {bh_pct:+.2f}%")

    if trades:
        total_pnl = sum(t["pnl_pct"] for t in trades)
        edge = total_pnl - bh_pct
        print(f"  Edge vs buy & hold: {edge:+.2f}%")

    # Save detailed log
    log_file = f"backtest_llm_{symbol}.json"
    log_data = {
        "symbol": symbol,
        "period": period,
        "lookback_days": lookback_days,
        "skip_days": skip_days,
        "decisions": [{**d, "date": str(d["date"].date())} for d in decisions],
        "trades": [
            {**t, "entry_date": str(t["entry_date"].date()),
             "exit_date": str(t["exit_date"].date())}
            for t in trades
        ],
    }
    with open(log_file, "w") as f:
        json.dump(log_data, f, indent=2)
    print(f"\n  Detailed log saved to {log_file}")

    return trades


def main():
    symbols = sys.argv[1:] if len(sys.argv) > 1 else WATCHLIST[:1]
    lookback = 200
    skip = 5

    print("LLM Backtester")
    print(f"Symbols: {', '.join(symbols)}")
    print(f"Testing last {lookback} trading days, querying every {skip} days")
    print(f"Minimum confidence to trade: 4/10")
    print(f"Stops: LLM-suggested with ATR fallback (1.5x SL, 2.5x TP)")

    all_trades = []
    for symbol in symbols:
        try:
            trades = backtest_llm(symbol, lookback_days=lookback, skip_days=skip)
            all_trades.extend(trades)
        except Exception as e:
            print(f"\n  ERROR backtesting {symbol}: {e}")

    if all_trades:
        print(f"\n{'='*60}")
        print(f"  GRAND SUMMARY")
        print(f"{'='*60}")
        total = len(all_trades)
        wins = len([t for t in all_trades if t["pnl_pct"] > 0])
        avg = sum(t["pnl_pct"] for t in all_trades) / total
        cum = sum(t["pnl_pct"] for t in all_trades)
        print(f"  Total trades: {total}")
        print(f"  Win rate: {wins/total*100:.1f}%")
        print(f"  Average return per trade: {avg:+.2f}%")
        print(f"  Cumulative return: {cum:+.2f}%")

    print("\n  Disclaimer: This is not financial advice. Past performance != future results.")


if __name__ == "__main__":
    main()
