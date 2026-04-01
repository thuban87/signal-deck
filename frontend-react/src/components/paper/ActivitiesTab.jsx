import { useState } from 'react';
import { usePaperActivities } from '../../hooks/usePaperTrading';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import EmptyState from '../ui/EmptyState';
import { formatPrice } from '../../utils/formatters';

const ACTIVITY_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'FILL', label: 'Fills' },
  { value: 'ACATC', label: 'ACAT (Cash)' },
  { value: 'ACATS', label: 'ACAT (Securities)' },
  { value: 'CSD', label: 'Cash Deposit' },
  { value: 'CSW', label: 'Cash Withdrawal' },
  { value: 'DIV', label: 'Dividend' },
  { value: 'JNLC', label: 'Journal (Cash)' },
  { value: 'JNLS', label: 'Journal (Securities)' },
  { value: 'MA', label: 'Merger/Acquisition' },
  { value: 'NC', label: 'Name Change' },
  { value: 'PTC', label: 'Pass-Thru Charge' },
  { value: 'REORG', label: 'Reorganization' },
  { value: 'SSO', label: 'Stock Spinoff' },
  { value: 'SSP', label: 'Stock Split' },
];

const formatDate = (d) => {
  if (!d || d === 'None') return '—';
  const date = new Date(d);
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export default function ActivitiesTab() {
  const [typeFilter, setTypeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const { data: activities, isLoading, isError, error, isFetching, status, fetchStatus } = usePaperActivities(typeFilter || null, 200);

  console.log('[ActivitiesTab] status:', status, 'fetchStatus:', fetchStatus, 'data:', activities, 'error:', error);

  if (isLoading) return <LoadingSkeleton type="table" />;
  if (isError) return <EmptyState icon="⚠️" title="Error loading activities" message={error?.message || 'Unknown error'} />;

  const filtered = (activities || []).filter(a => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toUpperCase();
    return (
      (a.symbol && a.symbol.toUpperCase().includes(q)) ||
      (a.activity_type && a.activity_type.toUpperCase().includes(q)) ||
      (a.description && a.description.toUpperCase().includes(q)) ||
      (a.date && a.date.includes(q))
    );
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select name="activity-type-filter" id="activity-type-filter" aria-label="Activity type filter" className="input" style={{ width: 'auto', fontSize: '0.8rem', padding: '4px 8px' }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          {ACTIVITY_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <input
          name="activity-search"
          id="activity-search"
          aria-label="Search activities"
          className="input"
          style={{ width: '250px', fontSize: '0.8rem', padding: '4px 8px' }}
          placeholder="Search by symbol, type, or date..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {filtered.length} activities
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="📄" title="No activities" message="Account activity will appear here" />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Symbol</th>
                <th>Side</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Net Amount</th>
                <th>Status</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => (
                <tr key={a.id || i}>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {formatDate(a.transaction_time || a.date)}
                  </td>
                  <td><span className="badge">{a.activity_type || '—'}</span></td>
                  <td style={{ fontWeight: 600 }}>{a.symbol || '—'}</td>
                  <td>
                    {a.side ? (
                      <span className={`badge badge-${a.side === 'sell' || a.side === 'sell_short' ? 'bearish' : 'bullish'}`}>
                        {a.side.toUpperCase()}
                      </span>
                    ) : '—'}
                  </td>
                  <td>{a.qty || '—'}</td>
                  <td>{a.price ? formatPrice(a.price) : '—'}</td>
                  <td style={{
                    color: a.net_amount ? (parseFloat(a.net_amount) >= 0 ? 'var(--bullish)' : 'var(--bearish)') : 'inherit'
                  }}>
                    {a.net_amount ? formatPrice(a.net_amount) : '—'}
                  </td>
                  <td>{a.status || '—'}</td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {a.description || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
