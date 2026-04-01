import { rsiClass } from '../../utils/formatters';

const INDICATOR_TOOLTIPS = {
  'RSI (14)': 'Relative Strength Index \u2014 measures speed/change of price movements. <30 = oversold (potential buy), >70 = overbought (potential sell).',
  'MACD': 'Moving Average Convergence Divergence \u2014 trend-following momentum indicator. Bullish when MACD crosses above signal line.',
  'ADX (Trend Strength)': 'Average Directional Index \u2014 measures trend strength regardless of direction. >25 = strong trend, >50 = very strong.',
  'Stochastic': 'Stochastic Oscillator \u2014 compares closing price to price range. %K < 20 = oversold, %K > 80 = overbought.',
  'ATR (Volatility)': 'Average True Range \u2014 measures market volatility. Higher ATR = more volatile price action.',
  'Trend': 'Overall trend direction based on SMA20 vs SMA50 crossover. SMA20 > SMA50 = bullish uptrend.',
  'OBV Trend': 'On-Balance Volume \u2014 cumulative volume indicator. Rising OBV confirms uptrend, falling confirms downtrend.',
  'Volume': 'Current volume relative to 20-day average. >1.5x = high interest, <0.7x = low conviction.',
};

export default function IndicatorsWidget({ summary }) {
  if (!summary) return <div className="loading-text">Loading indicators...</div>;

  const s = summary;
  const rsi = s.rsi;
  const rsiCls = rsiClass(rsi);
  const rsiLabel = rsi > 70 ? 'Overbought (>70)' : rsi < 30 ? 'Oversold (<30)' : 'Neutral';
  const macdMomentum = s.macd_histogram > 0 ? 'Momentum is positive \u2014 MACD is above signal line' : 'Momentum is negative \u2014 MACD is below signal line';
  const macdIcon = s.macd_histogram > 0 ? '\u25A0 bullish' : '\u25A0 bearish';
  const adxStrength = s.adx > 50 ? 'Very Strong' : s.adx > 25 ? 'Strong' : s.adx > 20 ? 'Moderate' : 'Weak or no clear trend';
  const stochLabel = s.stoch_k > 80 ? 'Overbought' : s.stoch_k < 20 ? 'Oversold' : 'Neutral';
  const stochEmoji = s.stoch_k > 80 ? '\u26A0\uFE0F' : s.stoch_k < 20 ? '\u2705' : '\u2796';
  const stochContext = s.stoch_k < 20 ? 'Near recent lows \u2014 potential oversold bounce' : s.stoch_k > 80 ? 'Near recent highs \u2014 potential pullback' : 'Mid-range \u2014 no extreme reading';
  const atrPct = s.price ? ((s.atr / s.price) * 100).toFixed(2) : '?';
  const trendClass = s.trend === 'bullish' ? 'bullish' : s.trend === 'bearish' ? 'bearish' : '';
  const obvLabel = s.obv_trend === 'rising' ? '\uD83D\uDCC8 Rising' : s.obv_trend === 'falling' ? '\uD83D\uDCC9 Falling' : '\u2796 Flat';
  const obvContext = s.obv_trend === 'rising' ? 'Money is flowing INTO this stock' : s.obv_trend === 'falling' ? 'Money is flowing OUT of this stock' : 'No clear volume trend';
  const volRatio = s.volume_ratio || 0;
  const volLabel = volRatio > 1.5 ? 'High interest' : volRatio < 0.7 ? 'Low conviction' : 'Normal trading volume';

  const cards = [
    {
      label: 'RSI (14)', value: rsi != null ? rsi.toFixed(1) : '\u2014',
      extra: (
        <>
          <div className="indicator-bar"><div className={`indicator-bar-fill ${rsiCls}`} style={{ width: `${Math.min(rsi || 0, 100)}%` }} /></div>
          <small className={rsiCls}>{rsiLabel}</small>
        </>
      ),
    },
    {
      label: 'MACD', value: s.macd != null ? s.macd.toFixed(4) : '\u2014',
      extra: (
        <>
          <small>Signal: {s.macd_signal?.toFixed(4) ?? '\u2014'} | Hist: {s.macd_histogram?.toFixed(4) ?? '\u2014'}</small>
          <div className="indicator-bar"><div className={`indicator-bar-fill ${s.macd_histogram > 0 ? 'bullish-fill' : 'bearish-fill'}`} style={{ width: '60%' }} /></div>
          <small>{macdIcon}</small>
          <small className="text-muted" style={{ fontSize: '0.65rem' }}>{macdMomentum}</small>
        </>
      ),
    },
    {
      label: 'ADX (Trend Strength)', value: s.adx != null ? s.adx.toFixed(1) : '\u2014',
      extra: (
        <>
          <div className="indicator-bar"><div className="indicator-bar-fill" style={{ width: `${Math.min(s.adx || 0, 100)}%`, background: 'var(--primary)' }} /></div>
          <small>+DI: {s.plus_di?.toFixed(1) ?? '\u2014'} / -DI: {s.minus_di?.toFixed(1) ?? '\u2014'}</small>
          <small>{adxStrength}</small>
        </>
      ),
    },
    {
      label: 'Stochastic', value: s.stoch_k != null ? s.stoch_k.toFixed(1) : '\u2014',
      extra: (
        <>
          <small>%K: {s.stoch_k?.toFixed(1) ?? '\u2014'} | %D: {s.stoch_d?.toFixed(1) ?? '\u2014'}</small>
          <small>{stochEmoji} {stochLabel}</small>
          <small className="text-muted" style={{ fontSize: '0.65rem' }}>{stochContext}</small>
        </>
      ),
    },
    {
      label: 'ATR (Volatility)', value: s.atr != null ? `$${s.atr.toFixed(2)}` : '\u2014',
      extra: (
        <>
          <small>Average daily swing: {atrPct}% of price</small>
          <small className="text-muted" style={{ fontSize: '0.65rem' }}>Used for stop-loss and position sizing</small>
        </>
      ),
    },
    {
      label: 'Trend', value: <span className={`trend-badge ${trendClass}`}>{s.trend || '\u2014'}</span>,
      extra: (
        <>
          <small>SMA20: {s.sma20?.toFixed(2) ?? '\u2014'}</small>
          <small>SMA50: {s.sma50?.toFixed(2) ?? '\u2014'}</small>
        </>
      ),
    },
    {
      label: 'OBV Trend', value: obvLabel,
      extra: (
        <small className="text-muted" style={{ fontSize: '0.65rem' }}>{obvContext}</small>
      ),
    },
    {
      label: 'Volume', value: volRatio ? `${volRatio.toFixed(2)}x avg` : '\u2014',
      extra: (
        <>
          <small>vs 20-day average</small>
          <small className="text-muted" style={{ fontSize: '0.65rem' }}>{volLabel}</small>
        </>
      ),
    },
  ];

  return (
    <div className="indicators-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
      {cards.map(c => (
        <div key={c.label} className="indicator-card" title={INDICATOR_TOOLTIPS[c.label] || c.label}>
          <div className="indicator-label">
            {c.label}
            <span className="tooltip-icon" title={INDICATOR_TOOLTIPS[c.label]}>{'\u24D8'}</span>
          </div>
          <div className="indicator-value text-mono">{c.value}</div>
          {c.extra}
        </div>
      ))}
    </div>
  );
}
