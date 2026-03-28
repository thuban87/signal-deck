"""Main entry point — fetches data, computes indicators, queries LLM."""

import sys
from data_fetcher import fetch_stock_data, get_latest_price
from indicators import add_all_indicators, get_signal_summary
from llm_analyst import query_ollama
from config import WATCHLIST


def format_recent_candles(df, n=5) -> str:
    """Format the last N candles as a readable string."""
    recent = df.tail(n)
    lines = []
    for date, row in recent.iterrows():
        change = row["Close"] - row["Open"]
        direction = "+" if change >= 0 else ""
        lines.append(
            f"  {date.strftime('%Y-%m-%d')}: "
            f"O=${row['Open']:.2f} H=${row['High']:.2f} "
            f"L=${row['Low']:.2f} C=${row['Close']:.2f} "
            f"({direction}{change:.2f}) Vol={int(row['Volume']):,}"
        )
    return "\n".join(lines)


def analyze_symbol(symbol: str) -> dict:
    """Full analysis pipeline for a single symbol."""
    print(f"\n{'='*60}")
    print(f"  Analyzing {symbol}")
    print(f"{'='*60}")

    # Step 1: Fetch data
    print("  Fetching data...")
    df = fetch_stock_data(symbol)
    price_info = get_latest_price(symbol)
    print(f"  Latest: ${price_info['price']} ({price_info['change_pct']:+.2f}%)")

    # Step 2: Compute indicators
    print("  Computing indicators...")
    df = add_all_indicators(df)
    summary = get_signal_summary(df)

    if summary["signals"]:
        print("  Active signals:")
        for s in summary["signals"]:
            print(f"    - {s}")
    else:
        print("  No strong signals detected")

    # Step 3: Query LLM
    print("  Querying LLM for analysis...")
    recent_candles = format_recent_candles(df)
    analysis = query_ollama(symbol, summary, recent_candles)

    # Step 4: Display results
    print(f"\n  LLM RECOMMENDATION: {analysis.get('action', 'N/A')}")
    print(f"  Confidence: {analysis.get('confidence', 'N/A')}/10")
    print(f"  Reasoning: {analysis.get('reasoning', 'N/A')}")

    if analysis.get("key_signals"):
        print("  Key signals:")
        for s in analysis["key_signals"]:
            print(f"    - {s}")

    if analysis.get("risk_factors"):
        print("  Risk factors:")
        for r in analysis["risk_factors"]:
            print(f"    - {r}")

    sl = analysis.get("suggested_stop_loss_pct", 0)
    tp = analysis.get("suggested_take_profit_pct", 0)
    if sl:
        print(f"  Stop loss: {sl}% (${price_info['price'] * (1 - sl/100):.2f})")
    if tp:
        print(f"  Take profit: {tp}% (${price_info['price'] * (1 + tp/100):.2f})")

    return {
        "symbol": symbol,
        "price_info": price_info,
        "indicators": summary,
        "analysis": analysis,
    }


def main():
    symbols = sys.argv[1:] if len(sys.argv) > 1 else WATCHLIST

    print("Trading Analysis System")
    print(f"Analyzing: {', '.join(symbols)}")

    results = []
    for symbol in symbols:
        try:
            result = analyze_symbol(symbol)
            results.append(result)
        except Exception as e:
            print(f"\n  ERROR analyzing {symbol}: {e}")

    # Summary table
    print(f"\n{'='*60}")
    print("  SUMMARY")
    print(f"{'='*60}")
    print(f"  {'Symbol':<8} {'Price':>10} {'Change':>8} {'RSI':>6} {'Trend':<8} {'Action':<6} {'Conf':>4}")
    print(f"  {'-'*54}")
    for r in results:
        p = r["price_info"]
        i = r["indicators"]
        a = r["analysis"]
        print(
            f"  {p['symbol']:<8} ${p['price']:>9.2f} {p['change_pct']:>+7.2f}% "
            f"{i['rsi']:>5.1f} {i['trend']:<8} {a.get('action', 'N/A'):<6} "
            f"{a.get('confidence', 'N/A'):>4}/10"
        )

    print(f"\n  Disclaimer: This is not financial advice. Always do your own research.")


if __name__ == "__main__":
    main()
