import { useQuery } from '@tanstack/react-query';
import { get } from '../../api/client';

export default function EarningsWidget({ symbol }) {
  const { data, isLoading } = useQuery({
    queryKey: ['earnings', symbol],
    queryFn: () => get(`/api/stock/${symbol}/earnings`),
    staleTime: 30 * 60 * 1000,
  });

  if (isLoading) return <div className="loading-text">Loading earnings...</div>;

  const upcoming = data?.upcoming;
  if (!upcoming || !upcoming.date) {
    return <div className="text-muted" style={{ padding: 12, fontSize: '0.85rem' }}>No upcoming earnings date</div>;
  }

  const isWarning = data.warning || (upcoming.days_until != null && upcoming.days_until <= 7);
  const borderColor = isWarning ? 'var(--red)' : 'var(--border)';

  return (
    <div style={{ padding: 12, borderLeft: `3px solid ${borderColor}`, borderRadius: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: '1.2rem' }}>{isWarning ? '\u26A0\uFE0F' : '\uD83D\uDCC5'}</span>
        <div>
          <strong>{upcoming.date}</strong>
          {upcoming.days_until != null && (
            <span style={{ marginLeft: 8, fontSize: '0.85rem', color: isWarning ? 'var(--red)' : 'var(--text-muted)' }}>
              {upcoming.days_until === 0 ? 'TODAY' : upcoming.days_until === 1 ? 'TOMORROW' : `in ${upcoming.days_until} days`}
            </span>
          )}
        </div>
      </div>
      {upcoming.hour && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
          {upcoming.hour === 'bmo' ? 'Before Market Open' : upcoming.hour === 'amc' ? 'After Market Close' : upcoming.hour}
        </div>
      )}
      {upcoming.estimate_eps != null && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
          EPS Est: ${upcoming.estimate_eps}
        </div>
      )}
      {data.message && (
        <div style={{ fontSize: '0.8rem', color: isWarning ? 'var(--red)' : 'var(--text-muted)', marginTop: 4 }}>
          {data.message}
        </div>
      )}
    </div>
  );
}
