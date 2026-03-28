"""Computes technical indicators from OHLCV data."""

import pandas as pd
import ta
from config import (
    RSI_PERIOD, MACD_FAST, MACD_SLOW, MACD_SIGNAL,
    BB_PERIOD, BB_STD, SMA_SHORT, SMA_LONG,
)


def add_all_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Add all technical indicators to a DataFrame with OHLCV columns."""
    df = df.copy()

    # Trend indicators
    df["sma_short"] = ta.trend.sma_indicator(df["Close"], window=SMA_SHORT)
    df["sma_long"] = ta.trend.sma_indicator(df["Close"], window=SMA_LONG)
    df["ema_12"] = ta.trend.ema_indicator(df["Close"], window=12)
    df["ema_26"] = ta.trend.ema_indicator(df["Close"], window=26)

    # MACD
    macd = ta.trend.MACD(
        df["Close"], window_slow=MACD_SLOW, window_fast=MACD_FAST,
        window_sign=MACD_SIGNAL,
    )
    df["macd"] = macd.macd()
    df["macd_signal"] = macd.macd_signal()
    df["macd_histogram"] = macd.macd_diff()

    # RSI
    df["rsi"] = ta.momentum.rsi(df["Close"], window=RSI_PERIOD)

    # Bollinger Bands
    bb = ta.volatility.BollingerBands(
        df["Close"], window=BB_PERIOD, window_dev=BB_STD,
    )
    df["bb_upper"] = bb.bollinger_hband()
    df["bb_middle"] = bb.bollinger_mavg()
    df["bb_lower"] = bb.bollinger_lband()
    df["bb_pct"] = bb.bollinger_pband()

    # Volume indicators
    df["volume_sma_20"] = ta.trend.sma_indicator(
        df["Volume"].astype(float), window=20,
    )
    df["volume_ratio"] = df["Volume"] / df["volume_sma_20"]

    # ATR (volatility)
    df["atr"] = ta.volatility.average_true_range(
        df["High"], df["Low"], df["Close"], window=14,
    )

    # Stochastic
    stoch = ta.momentum.StochasticOscillator(
        df["High"], df["Low"], df["Close"],
    )
    df["stoch_k"] = stoch.stoch()
    df["stoch_d"] = stoch.stoch_signal()

    # VWAP approximation (cumulative for each day — useful for intraday,
    # approximated here as typical-price * volume cumsum / volume cumsum)
    typical_price = (df["High"] + df["Low"] + df["Close"]) / 3
    df["vwap"] = (typical_price * df["Volume"]).cumsum() / df["Volume"].cumsum()

    # EMA 9 (fast trend for short-term momentum)
    df["ema_9"] = ta.trend.ema_indicator(df["Close"], window=9)

    # ADX — trend strength
    adx = ta.trend.ADXIndicator(df["High"], df["Low"], df["Close"], window=14)
    df["adx"] = adx.adx()
    df["adx_pos"] = adx.adx_pos()
    df["adx_neg"] = adx.adx_neg()

    # OBV — on-balance volume
    df["obv"] = ta.volume.on_balance_volume(df["Close"], df["Volume"])
    df["obv_sma_20"] = ta.trend.sma_indicator(df["obv"], window=20)

    return df


def get_signal_summary(df: pd.DataFrame, idx: int = -1) -> dict:
    """Extract indicator values and generate signal flags.

    Args:
        df: DataFrame with all indicators computed.
        idx: Row index to summarize.  Defaults to -1 (latest row).
    """
    latest = df.iloc[idx]
    prev = df.iloc[idx - 1]

    signals = []

    # RSI signals
    if latest["rsi"] < 30:
        signals.append("RSI oversold (%.1f)" % latest["rsi"])
    elif latest["rsi"] > 70:
        signals.append("RSI overbought (%.1f)" % latest["rsi"])

    # MACD crossover
    if prev["macd"] < prev["macd_signal"] and latest["macd"] > latest["macd_signal"]:
        signals.append("MACD bullish crossover")
    elif prev["macd"] > prev["macd_signal"] and latest["macd"] < latest["macd_signal"]:
        signals.append("MACD bearish crossover")

    # Price vs Bollinger Bands
    if latest["Close"] < latest["bb_lower"]:
        signals.append("Price below lower Bollinger Band")
    elif latest["Close"] > latest["bb_upper"]:
        signals.append("Price above upper Bollinger Band")

    # SMA crossover
    if prev["sma_short"] < prev["sma_long"] and latest["sma_short"] > latest["sma_long"]:
        signals.append("Golden cross (SMA %d > SMA %d)" % (SMA_SHORT, SMA_LONG))
    elif prev["sma_short"] > prev["sma_long"] and latest["sma_short"] < latest["sma_long"]:
        signals.append("Death cross (SMA %d < SMA %d)" % (SMA_SHORT, SMA_LONG))

    # Volume spike
    if latest["volume_ratio"] > 2.0:
        signals.append("Volume spike (%.1fx average)" % latest["volume_ratio"])

    # Stochastic
    if latest["stoch_k"] < 20 and latest["stoch_d"] < 20:
        signals.append("Stochastic oversold")
    elif latest["stoch_k"] > 80 and latest["stoch_d"] > 80:
        signals.append("Stochastic overbought")

    # ADX trend strength
    if latest["adx"] > 25 and latest["adx_pos"] > latest["adx_neg"]:
        signals.append("Strong bullish trend (ADX %.1f, +DI > -DI)" % latest["adx"])
    elif latest["adx"] > 25 and latest["adx_neg"] > latest["adx_pos"]:
        signals.append("Strong bearish trend (ADX %.1f, -DI > +DI)" % latest["adx"])

    # OBV divergence — price falling but OBV rising (bullish divergence)
    if latest["Close"] < prev["Close"] and latest["obv"] > prev["obv"]:
        signals.append("Bullish OBV divergence (price down, volume accumulating)")
    elif latest["Close"] > prev["Close"] and latest["obv"] < prev["obv"]:
        signals.append("Bearish OBV divergence (price up, volume distributing)")

    # EMA 9/21 momentum — price above both short EMAs
    if latest["Close"] > latest["ema_9"] and latest["Close"] > latest["ema_12"]:
        signals.append("Price above EMA9 and EMA12 (short-term bullish)")
    elif latest["Close"] < latest["ema_9"] and latest["Close"] < latest["ema_12"]:
        signals.append("Price below EMA9 and EMA12 (short-term bearish)")

    # Trend direction
    trend = "bullish" if latest["sma_short"] > latest["sma_long"] else "bearish"

    # Tiered signal counting — strong signals are actionable events,
    # supporting signals confirm direction but are too persistent alone
    strong_bullish_kw = ["oversold", "MACD bullish", "Golden cross", "below lower Bollinger"]
    strong_bearish_kw = ["overbought", "MACD bearish", "Death cross", "above upper Bollinger"]
    support_bullish_kw = ["bullish trend", "bullish OBV", "above EMA", "accumulating"]
    support_bearish_kw = ["bearish trend", "bearish OBV", "below EMA", "distributing"]

    strong_bullish = sum(1 for s in signals if any(k in s for k in strong_bullish_kw))
    strong_bearish = sum(1 for s in signals if any(k in s for k in strong_bearish_kw))
    support_bullish = sum(1 for s in signals if any(k in s for k in support_bullish_kw))
    support_bearish = sum(1 for s in signals if any(k in s for k in support_bearish_kw))

    bullish_count = strong_bullish + support_bullish
    bearish_count = strong_bearish + support_bearish

    return {
        "close": round(latest["Close"], 2),
        "rsi": round(latest["rsi"], 2),
        "macd": round(latest["macd"], 4),
        "macd_signal": round(latest["macd_signal"], 4),
        "macd_histogram": round(latest["macd_histogram"], 4),
        "bb_upper": round(latest["bb_upper"], 2),
        "bb_lower": round(latest["bb_lower"], 2),
        "bb_pct": round(latest["bb_pct"], 4),
        "atr": round(latest["atr"], 2),
        "stoch_k": round(latest["stoch_k"], 2),
        "stoch_d": round(latest["stoch_d"], 2),
        "volume_ratio": round(latest["volume_ratio"], 2),
        "sma_short": round(latest["sma_short"], 2),
        "sma_long": round(latest["sma_long"], 2),
        "adx": round(latest["adx"], 2),
        "adx_pos": round(latest["adx_pos"], 2),
        "adx_neg": round(latest["adx_neg"], 2),
        "ema_9": round(latest["ema_9"], 2),
        "obv_trend": "rising" if latest["obv"] > latest["obv_sma_20"] else "falling",
        "trend": trend,
        "signals": signals,
        "bullish_count": bullish_count,
        "bearish_count": bearish_count,
        "strong_bullish": strong_bullish,
        "strong_bearish": strong_bearish,
        "support_bullish": support_bullish,
        "support_bearish": support_bearish,
    }
