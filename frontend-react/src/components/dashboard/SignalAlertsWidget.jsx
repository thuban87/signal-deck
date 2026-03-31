import { useQuery } from '@tanstack/react-query';
import { get } from '../../api/client';
import { Link } from 'react-router-dom';

export default function SignalAlertsWidget() {
  const { data: signals } = useQuery({
    queryKey: ['signals-today'],
    queryFn: () => get('/api/signals/today'),
    staleTime: 2 * 60 * 1000,
  });

  if (!signals || signals.length === 0) return null;

  const buySignals = signals.filter(s => s.direction !== 'short');
  const sellSignals = signals.filter(s => s.direction === 'short');
  const summary = [];
  if (buySignals.length) summary.push(`${buySignals.length} bullish`);
  if (sellSignals.length) summary.push(`${sellSignals.length} bearish`);
  const symbolList = [...new Set(signals.map(s => s.symbol))].join(', ');

  return (
    <div className="signal-alert-bar">
      <div className="signal-alert-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      </div>
      <div className="signal-alert-text">
        <strong>{signals.length} signal{signals.length !== 1 ? 's' : ''} active</strong>
        <p>{summary.join(', ')} across {symbolList}</p>
      </div>
      <Link to="/signals" className="btn btn-outline btn-sm">View All</Link>
    </div>
  );
}
