import { rsiClass } from '../../utils/formatters';

export default function IndicatorsWidget({ summary }) {
  if (!summary) return <div className="loading-text">Loading indicators...</div>;

  const s = summary;
  const rsi = s.rsi;
  const rsiCls = rsiClass(rsi);
  const rsiLabel = rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : 'Neutral';
  const macdMomentum = s.macd_histogram > 0 ? '\u2B06\uFE0F bullish' : '\u2B07\uFE0F bearish';
  const adxStrength = s.adx > 50 ? 'Very Strong' : s.adx > 25 ? 'Strong' : s.adx > 20 ? 'Moderate' : 'Weak';
  const stochLabel = s.stoch_k > 80 ? 'Overbought' : s.stoch_k < 20 ? 'Oversold' : 'Neutral';
  const stochEmoji = s.stoch_k > 80 ? '\u26A0\uFE0F' : s.stoch_k < 20 ? '\u2705' : '\u2796';
  const atrPct = s.price ? ((s.atr / s.price) * 100).toFixed(2) : '?';
  const trendClass = s.trend === 'bullish' ? 'bullish' : s.trend === 'bearish' ? 'bearish' : '';
  const obvLabel = s.obv_trend === 'rising' ? '\uD83D\uDCC8 Rising' : s.obv_trend === 'falling' ? '\uD83D\uDCC9 Falling' : '\u2796 Flat';
  const volRatio = s.volume_ratio || 0;
  const volLabel = volRatio > 1.5 ? 'High interest' : volRatio < 0.7 ? 'Low conviction' : 'Normal';

  const cards = [
    {
      label: 'RSI (14)', value: rsi != null ? rsi.toFixed(1) : '\u2014',
      extra: <><div className="indicator-bar"><div className={`indicator-bar-fill ${rsiCls}`} style={{ width: `${Math.min(rsi || 0, 100)}%` }} /></div><small className={rsiCls}>{rsiLabel}</small></>,
    },
    {
      label: 'MACD', value: s.macd != null ? s.macd.toFixed(3) : '\u2014',
      extra: <><small>Signal: {s.macd_signal?.toFixed(3) ?? '\u2014'}</small><small>Hist: {s.macd_histogram?.toFixed(3) ?? '\u2014'} {macdMomentum}</small></>,
    },
    {
      label: 'ADX (Trend)', value: s.adx != null ? s.adx.toFixed(1) : '\u2014',
      extra: <><div className="indicator-bar"><div className="indicator-bar-fill" style={{ width: `${Math.min(s.adx || 0, 100)}%`, background: 'var(--primary)' }} /></div><small>+DI: {s.plus_di?.toFixed(1) ?? '\u2014'} / -DI: {s.minus_di?.toFixed(1) ?? '\u2014'}</small><small>{adxStrength}</small></>,
    },
    {
      label: 'Stochastic', value: s.stoch_k != null ? `%K ${s.stoch_k.toFixed(1)}` : '\u2014',
      extra: <><small>%D: {s.stoch_d?.toFixed(1) ?? '\u2014'}</small><small>{stochEmoji} {stochLabel}</small></>,
    },
    {
      label: 'ATR (Volatility)', value: s.atr != null ? `$${s.atr.toFixed(2)}` : '\u2014',
      extra: <small>{atrPct}% of price</small>,
    },
    {
      label: 'Trend', value: <span className={`trend-badge ${trendClass}`}>{s.trend || '\u2014'}</span>,
      extra: <><small>SMA20: {s.sma20?.toFixed(2) ?? '\u2014'}</small><small>SMA50: {s.sma50?.toFixed(2) ?? '\u2014'}</small></>,
    },
    {
      label: 'OBV Trend', value: obvLabel,
      extra: null,
    },
    {
      label: 'Volume', value: volRatio ? `${volRatio.toFixed(2)}x avg` : '\u2014',
      extra: <small>{volLabel}</small>,
    },
  ];

  return (
    <div className="indicators-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
      {cards.map(c => (
        <div key={c.label} className="indicator-card">
          <div className="indicator-label">{c.label}</div>
          <div className="indicator-value text-mono">{c.value}</div>
          {c.extra}
        </div>
      ))}
    </div>
  );
}
