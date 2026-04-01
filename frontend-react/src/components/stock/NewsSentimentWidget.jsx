import { useQuery } from '@tanstack/react-query';
import { get } from '../../api/client';

function SentimentGauge({ sentiment }) {
  if (!sentiment) return <div className="text-muted" style={{ padding: 12, fontSize: '0.85rem' }}>No news sentiment data</div>;

  const score = sentiment.score || 0;
  const label = (sentiment.label || 'NEUTRAL').toUpperCase();
  const position = ((score + 1) / 2) * 100;
  const labelColor = label === 'BULLISH' ? 'var(--bullish)' : label === 'BEARISH' ? 'var(--bearish)' : 'var(--text-muted)';

  return (
    <div style={{ textAlign: 'center', padding: '0.5rem' }}>
      <div style={{ fontSize: '1.8rem', fontWeight: 700, color: labelColor }}>{score.toFixed(3)}</div>
      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: labelColor, marginBottom: '0.75rem', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ height: 8, borderRadius: 4, background: 'linear-gradient(to right, var(--bearish), var(--text-muted), var(--bullish))', position: 'relative', marginBottom: '0.75rem' }}>
        <div style={{ position: 'absolute', top: -4, left: `${position}%`, width: 16, height: 16, borderRadius: '50%', background: 'white', border: '2px solid var(--bg-card)', transform: 'translateX(-50%)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <span>🐻 {sentiment.bearish || 0}</span>
        <span>{sentiment.count || 0} articles</span>
        <span>{sentiment.bullish || 0} 🐂</span>
      </div>
    </div>
  );
}

export default function NewsSentimentWidget({ symbol }) {
  const { data, isLoading } = useQuery({
    queryKey: ['news-sentiment', symbol],
    queryFn: () => get(`/api/stock/${symbol}/news?days=14`),
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) return <div className="loading-text">Loading sentiment...</div>;

  return <SentimentGauge sentiment={data?.sentiment} />;
}
