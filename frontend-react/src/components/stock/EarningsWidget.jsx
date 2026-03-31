import { useQuery } from '@tanstack/react-query';
import { get } from '../../api/client';

export default function EarningsWidget({ symbol }) {
  const { data, isLoading } = useQuery({
    queryKey: ['earnings', symbol],
    queryFn: () => get(`/api/stock/${symbol}/earnings`),
    staleTime: 30 * 60 * 1000,
  });

  if (isLoading) return <div className="loading-text">Loading earnings...</div>;
  if (!data || !data.date) return <div className="text-muted" style={{ padding: 12, fontSize: '0.85rem' }}>No upcoming earnings date</div>;

  const isWarning = data.days_until != null && data.days_until <= 7;
  const borderColor = isWarning ? 'var(--red)' : 'var(--border)';

  return (
    <div style={{ padding: 12, borderLeft: `3px solid ${borderColor}`, borderRadius: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: '1.2rem' }}>{isWarning ? '\u26A0\uFE0F' : '\uD83D\uDCC5'}</span>
        <div>
          <strong>{data.date}</strong>
          {data.days_until != null && (
            <span style={{ marginLeft: 8, fontSize: '0.85rem', color: isWarning ? 'var(--red)' : 'var(--text-muted)' }}>
              {data.days_until === 0 ? 'TODAY' : data.days_until === 1 ? 'TOMORROW' : `in ${data.days_until} days`}
            </span>
          )}
        </div>
      </div>
      {data.hour && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>{data.hour === 'bmo' ? 'Before Market Open' : data.hour === 'amc' ? 'After Market Close' : data.hour}</div>}
      {data.eps_estimate != null && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>EPS Est: ${data.eps_estimate}</div>}
    </div>
  );
}
