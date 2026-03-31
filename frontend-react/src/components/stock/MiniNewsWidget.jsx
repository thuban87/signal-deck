import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get } from '../../api/client';
import { Link } from 'react-router-dom';

export default function MiniNewsWidget({ symbol }) {
  const [loaded, setLoaded] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['mini-news', symbol],
    queryFn: () => get(`/api/stock/${symbol}/news?days=7`),
    staleTime: 10 * 60 * 1000,
    enabled: loaded,
  });

  if (!loaded) {
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        <button className="btn btn-primary btn-sm" onClick={() => setLoaded(true)}>Load News & Sentiment</button>
      </div>
    );
  }

  if (isLoading) return <div className="loading-text">Loading news...</div>;
  if (!data) return <div className="text-muted" style={{ padding: 12, fontSize: '0.85rem' }}>No news data</div>;

  const articles = data.articles || [];
  const sentiment = data.sentiment;
  const sentimentEmoji = sentiment?.label === 'bullish' ? '\uD83D\uDFE2' : sentiment?.label === 'bearish' ? '\uD83D\uDD34' : '\u26AA';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        {sentiment && (
          <span style={{ fontSize: '0.85rem' }}>
            {sentimentEmoji} <strong>{sentiment.label}</strong> <span className="text-muted">({sentiment.score?.toFixed(2)})</span>
          </span>
        )}
        <Link to={`/investigate/${symbol}`} style={{ fontSize: '0.75rem' }}>Full Research &rarr;</Link>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
        {articles.slice(0, 5).map((a, i) => {
          const artSentiment = a.sentiment?.label;
          const artBadge = artSentiment === 'bullish' ? '\uD83D\uDFE2' : artSentiment === 'bearish' ? '\uD83D\uDD34' : '\u26AA';
          return (
            <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.82rem', color: 'var(--text-primary)', textDecoration: 'none', borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <span>{artBadge}</span>
                <div>
                  <div style={{ fontWeight: 500 }}>{a.headline || a.title}</div>
                  <div className="text-muted" style={{ fontSize: '0.75rem' }}>{a.source} {a.date && `\u2014 ${a.date}`}</div>
                </div>
              </div>
            </a>
          );
        })}
        {articles.length === 0 && <div className="text-muted" style={{ fontSize: '0.85rem' }}>No recent articles</div>}
      </div>
    </div>
  );
}
