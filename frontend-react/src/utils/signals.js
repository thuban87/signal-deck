export function getActionRecommendation({ strong_bullish = 0, strong_bearish = 0, support_bullish = 0, support_bearish = 0, trend = 'neutral' }) {
  const isUptrend = trend === 'uptrend';
  const isDowntrend = trend === 'downtrend';

  // Bullish signals
  if (isUptrend && strong_bullish >= 1 && support_bullish >= 1) {
    return { action: 'BUY', confidence: 'HIGH', reasoning: `Strong uptrend with ${strong_bullish} strong + ${support_bullish} supporting bullish signals` };
  }
  if (strong_bullish >= 2) {
    return { action: 'BUY', confidence: 'HIGH', reasoning: `${strong_bullish} strong bullish signals detected` };
  }
  if (strong_bullish >= 1 && support_bullish >= 2) {
    return { action: 'BUY', confidence: 'MEDIUM', reasoning: `${strong_bullish} strong + ${support_bullish} supporting bullish signals` };
  }
  if (strong_bullish >= 1 && support_bullish >= 1) {
    return { action: 'BUY', confidence: 'LOW', reasoning: `${strong_bullish} strong + ${support_bullish} supporting bullish signal` };
  }

  // Bearish signals
  if (isDowntrend && strong_bearish >= 1 && support_bearish >= 1) {
    return { action: 'SELL', confidence: 'HIGH', reasoning: `Downtrend with ${strong_bearish} strong + ${support_bearish} supporting bearish signals` };
  }
  if (strong_bearish >= 2) {
    return { action: 'SELL', confidence: 'HIGH', reasoning: `${strong_bearish} strong bearish signals detected` };
  }
  if (strong_bearish >= 1 && support_bearish >= 2) {
    return { action: 'SELL', confidence: 'MEDIUM', reasoning: `${strong_bearish} strong + ${support_bearish} supporting bearish signals` };
  }
  if (strong_bearish >= 1 && support_bearish >= 1) {
    return { action: 'SELL', confidence: 'LOW', reasoning: `${strong_bearish} strong + ${support_bearish} supporting bearish signal` };
  }

  return { action: 'HOLD', confidence: 'LOW', reasoning: 'No clear signal pattern detected' };
}
