import { useQuery } from '@tanstack/react-query';
import { get } from '../../api/client';
import { useAppStore } from '../../stores/appStore';
import { Link } from 'react-router-dom';

export default function SocialTrendingWidget({ symbol }) {
  const config = useAppStore(s => s.config);
  const hasReddit = config?.reddit_configured;

  const { data, isLoading } = useQuery({
    queryKey: ['social', symbol],
    queryFn: () => get(`/api/stock/${symbol}/social`),
    staleTime: 10 * 60 * 1000,
    enabled: !!hasReddit,
  });

  if (!hasReddit) {
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>{'\uD83D\uDCE1'}</div>
        <p className="text-muted" style={{ fontSize: '0.85rem' }}>Reddit API not configured</p>
        <Link to="/settings" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }}>Configure in Settings</Link>
      </div>
    );
  }

  if (isLoading) return <div className="loading-text">Loading social data...</div>;
  if (!data || !data.mentions) return <div className="text-muted" style={{ padding: 12, fontSize: '0.85rem' }}>No social mentions found</div>;

  const sentimentLabel = data.sentiment_label || 'neutral';
  const sentimentEmoji = sentimentLabel === 'bullish' ? '\uD83D\uDFE2' : sentimentLabel === 'bearish' ? '\uD83D\uDD34' : '\u26AA';

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: '1.3rem' }}>{sentimentEmoji}</div>
        <div style={{ fontSize: '0.9rem' }}>{data.mention_count || 0} mention{data.mention_count !== 1 ? 's' : ''}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sentiment: <strong>{sentimentLabel}</strong> ({data.sentiment_score?.toFixed(2) ?? '\u2014'})</div>
      </div>
      {data.mentions && data.mentions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 150, overflowY: 'auto', fontSize: '0.8rem' }}>
          {data.mentions.slice(0, 5).map((m, i) => (
            <div key={i} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
              <div style={{ fontWeight: 500 }}>{m.title}</div>
              <div className="text-muted" style={{ fontSize: '0.7rem' }}>r/{m.subreddit} {'\u2022'} {m.upvotes}{'\u2191'} {'\u2022'} {m.sentiment_label || ''}</div>
            </div>
          ))}
        </div>
      )}
      {data.last_scan && <div className="text-muted" style={{ fontSize: '0.7rem', marginTop: 8 }}>Last scan: {data.last_scan}</div>}
    </div>
  );
}
