"""Sends structured prompts to Ollama and parses trade suggestions."""

import json
import time
import requests
from config import OLLAMA_BASE_URL, OLLAMA_MODEL


SYSTEM_PROMPT = """You are a stock market technical analyst who balances opportunity with risk.
Your job is to identify favorable risk/reward setups — not to avoid all risk.

CONFIDENCE CALIBRATION — this is critical:
- 1-3: Conflicting signals, no clear setup. Action: HOLD.
- 4-5: Moderate setup — one strong signal plus supporting context. Action: BUY or SELL is appropriate.
- 6-7: Good setup — two strong signals aligning. Action: BUY or SELL with conviction.
- 8-10: Exceptional setup — rare, multiple strong confirmations. Action: strong BUY or SELL.

You should recommend BUY or SELL on roughly 30-40% of days when real opportunities exist.
Defaulting to HOLD every time is a failure — you are missing real setups.

WHEN TO BUY:
- RSI recovering from below 40 (not just 30) with price showing strength — this is a setup
- MACD crossing above signal line — this alone is a moderate BUY (conf 4-5)
- Price bouncing off Bollinger lower band with volume — moderate BUY
- Price above both EMA9 and EMA12 while trending up — supporting signal
- OBV rising while price is flat or pulling back — accumulation, bullish
- ADX > 25 with +DI > -DI — confirms bullish momentum
- Trend (SMA short > SMA long) is a supporting signal, NOT a requirement. Early-stage recoveries happen BEFORE the SMA crossover.

WHEN TO SELL:
- RSI dropping from above 60 with price showing weakness
- MACD crossing below signal line
- Price breaking below Bollinger lower band on high volume
- OBV falling while price is rising — distribution, bearish

KEY PRINCIPLE: A single strong signal (MACD crossover, RSI recovery, BB bounce) combined with
ANY supporting signal (volume, OBV, EMA position, ADX) is enough for a confidence 4-5 trade.
Do NOT require perfect alignment of all indicators — that never happens in real markets.

STOP-LOSS / TAKE-PROFIT:
- Scale stop-loss to ATR: suggest stop_loss_pct = roughly 1.5x ATR as a percentage of price.
- Scale take-profit to at least 1.5x the stop-loss (minimum 1.5:1 reward-to-risk ratio).

Respond with ONLY valid JSON in this exact format:
{
    "action": "BUY" | "SELL" | "HOLD",
    "confidence": 1-10,
    "reasoning": "brief explanation of why",
    "key_signals": ["list of the most important signals driving this"],
    "confirming_signals": ["signals that agree with the action"],
    "contradicting_signals": ["signals that disagree — be honest about these"],
    "risk_factors": ["list of risks to watch"],
    "suggested_stop_loss_pct": number,
    "suggested_take_profit_pct": number
}"""


def build_analysis_prompt(symbol: str, summary: dict, recent_candles: str) -> str:
    """Build the user prompt with indicator data."""
    signals_text = "\n".join(f"  - {s}" for s in summary["signals"]) or "  - No strong signals"

    bullish_count = summary.get('bullish_count', 0)
    bearish_count = summary.get('bearish_count', 0)
    adx = summary.get('adx', 0)
    adx_pos = summary.get('adx_pos', 0)
    adx_neg = summary.get('adx_neg', 0)
    ema_9 = summary.get('ema_9', 0)
    obv_trend = summary.get('obv_trend', 'unknown')

    return f"""Analyze {symbol} for a potential trade. Remember: only recommend BUY/SELL with 2+ confirming signals.

CURRENT DATA:
- Price: ${summary['close']}
- Trend: {summary['trend']} (SMA{summary.get('sma_short', 20)} vs SMA{summary.get('sma_long', 50)})
- RSI(14): {summary['rsi']}
- MACD: {summary['macd']} | Signal: {summary['macd_signal']} | Histogram: {summary['macd_histogram']}
- Bollinger Band %B: {summary['bb_pct']} (Upper: ${summary['bb_upper']}, Lower: ${summary['bb_lower']})
- ATR(14): ${summary['atr']} (= {round(summary['atr'] / summary['close'] * 100, 2)}% of price)
- Stochastic: K={summary['stoch_k']} D={summary['stoch_d']}
- Volume ratio vs 20d avg: {summary['volume_ratio']}x
- ADX: {adx} (+DI: {adx_pos}, -DI: {adx_neg})
- EMA(9): ${ema_9} (price {'above' if summary['close'] > ema_9 else 'below'})
- OBV trend: {obv_trend}

SIGNAL SUMMARY:
- Strong bullish signals: {summary.get('strong_bullish', 0)} | Supporting bullish: {summary.get('support_bullish', 0)}
- Strong bearish signals: {summary.get('strong_bearish', 0)} | Supporting bearish: {summary.get('support_bearish', 0)}
- Total bullish: {bullish_count} | Total bearish: {bearish_count}
- Active signals:
{signals_text}

RECENT PRICE ACTION (last 5 days):
{recent_candles}

Apply the decision rules strictly. Respond with JSON only."""


def query_ollama(symbol: str, summary: dict, recent_candles: str,
                 max_retries: int = 3) -> dict:
    """Send analysis request to Ollama and parse the response."""
    prompt = build_analysis_prompt(symbol, summary, recent_candles)

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "system": SYSTEM_PROMPT,
        "stream": False,
        "think": False,
        "options": {
            "temperature": 0.3,
            "num_predict": 1024,
        },
    }

    for attempt in range(max_retries):
        try:
            response = requests.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json=payload,
                timeout=120,
            )
            response.raise_for_status()
            break
        except (requests.ConnectionError, requests.Timeout) as e:
            if attempt < max_retries - 1:
                wait = 5 * (attempt + 1)
                print(f"[retry {attempt+1}/{max_retries} in {wait}s] ", end="", flush=True)
                time.sleep(wait)
            else:
                raise

    data = response.json()

    # Qwen3 and other thinking models put reasoning in a separate "thinking"
    # field and may leave "response" empty. Check both fields for JSON.
    raw_text = data.get("response", "")
    thinking_text = data.get("thinking", "")

    result = parse_llm_response(raw_text)
    if result.get("confidence") == 0 and thinking_text:
        # Response was empty/unparseable — try extracting from thinking
        result = parse_llm_response(thinking_text)

    return result


def parse_llm_response(text: str) -> dict:
    """Try to extract JSON from the LLM response."""
    # Try direct parse first
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try to find JSON block in the response
    start = text.find("{")
    end = text.rfind("}") + 1
    if start != -1 and end > start:
        try:
            return json.loads(text[start:end])
        except json.JSONDecodeError:
            pass

    return {
        "action": "HOLD",
        "confidence": 0,
        "reasoning": f"Failed to parse LLM response: {text[:200]}",
        "key_signals": [],
        "risk_factors": ["LLM response was unparseable"],
        "suggested_stop_loss_pct": 0,
        "suggested_take_profit_pct": 0,
        "raw_response": text,
    }
