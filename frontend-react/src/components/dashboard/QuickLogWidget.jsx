import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, del } from '../../api/client';
import { Link } from 'react-router-dom';
import { useAppStore } from '../../stores/appStore';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const then = new Date(dateStr + (dateStr.includes('Z') ? '' : 'Z'));
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function QuickLogWidget() {
  const queryClient = useQueryClient();
  const toast = useAppStore(s => s.addToast);

  const { data: logs } = useQuery({
    queryKey: ['quick-logs'],
    queryFn: () => get('/api/quick-log'),
    staleTime: 2 * 60 * 1000,
  });

  const promoteMutation = useMutation({
    mutationFn: (id) => post(`/api/quick-log/${id}/promote`, {}),
    onSuccess: (result) => {
      toast(`${result.symbol} added to watchlist`, 'success');
      queryClient.invalidateQueries({ queryKey: ['quick-logs'] });
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const dismissMutation = useMutation({
    mutationFn: (id) => del(`/api/quick-log/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quick-logs'] }),
    onError: (err) => toast(err.message, 'error'),
  });

  const pending = (logs || []).filter(l => l.status === 'new');
  if (pending.length === 0) return null;

  return (
    <div className="card mb-4">
      <div className="card-header">
        <h3>{'\uD83D\uDE97'} Look Into Later</h3>
        <span className="text-muted" style={{ fontSize: '0.8rem' }}>{pending.length} idea{pending.length !== 1 ? 's' : ''} logged</span>
      </div>
      <div className="quick-log-list">
        {pending.map(l => (
          <div key={l.id} className="quick-log-item">
            <div className="quick-log-item-info">
              <span className="quick-log-raw">&ldquo;{l.raw_input}&rdquo;</span>
              {l.resolved_ticker ? (
                <Link to={`/stock/${l.resolved_ticker}`} className="quick-log-resolved ql-stock-link">
                  &rarr; <strong>{l.resolved_ticker}</strong>{l.resolved_name ? ` \u2014 ${l.resolved_name}` : ''}
                </Link>
              ) : (
                <span className="quick-log-unresolved">{'\u26A0'} No ticker match</span>
              )}
              <span className="quick-log-time">{timeAgo(l.created_at)}</span>
            </div>
            <div className="quick-log-item-actions">
              {l.resolved_ticker && (
                <>
                  <Link to={`/investigate/${l.resolved_ticker}`} className="btn btn-ghost btn-sm">{'\uD83D\uDD0D'} Investigate</Link>
                  <button className="btn btn-primary btn-sm" onClick={() => promoteMutation.mutate(l.id)}>+ Watchlist</button>
                </>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => dismissMutation.mutate(l.id)}>&times;</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
