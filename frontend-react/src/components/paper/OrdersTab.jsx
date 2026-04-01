import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { del } from '../../api/client';
import { usePaperOrdersFull } from '../../hooks/usePaperTrading';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import EmptyState from '../ui/EmptyState';
import { formatPrice } from '../../utils/formatters';
import { useAppStore } from '../../stores/appStore';

const ALL_COLUMNS = [
  { key: 'symbol', label: 'Symbol', default: true },
  { key: 'side', label: 'Side', default: true },
  { key: 'type', label: 'Type', default: true },
  { key: 'order_class', label: 'Order Class', default: false },
  { key: 'qty', label: 'Qty', default: true },
  { key: 'filled_qty', label: 'Filled Qty', default: true },
  { key: 'notional', label: 'Notional', default: false },
  { key: 'limit_price', label: 'Limit Price', default: true },
  { key: 'stop_price', label: 'Stop Price', default: false },
  { key: 'filled_avg_price', label: 'Fill Price', default: true },
  { key: 'status', label: 'Status', default: true },
  { key: 'time_in_force', label: 'TIF', default: true },
  { key: 'extended_hours', label: 'Ext Hours', default: false },
  { key: 'trail_percent', label: 'Trail %', default: false },
  { key: 'trail_price', label: 'Trail $', default: false },
  { key: 'hwm', label: 'HWM', default: false },
  { key: 'submitted_at', label: 'Submitted', default: true },
  { key: 'filled_at', label: 'Filled At', default: false },
  { key: 'created_at', label: 'Created', default: false },
  { key: 'expired_at', label: 'Expired At', default: false },
  { key: 'canceled_at', label: 'Canceled At', default: false },
  { key: 'failed_at', label: 'Failed At', default: false },
  { key: 'replaced_by', label: 'Replaced By', default: false },
  { key: 'client_order_id', label: 'Client Order ID', default: false },
  { key: 'asset_class', label: 'Asset Class', default: false },
  { key: 'id', label: 'Order ID', default: false },
];

const PAGE_SIZE = 50;

const formatTime = (ts) => {
  if (!ts || ts === 'None') return '—';
  const d = new Date(ts);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export default function OrdersTab() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('all');
  const [sideFilter, setSideFilter] = useState(null);
  const [page, setPage] = useState(0);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [visibleCols, setVisibleCols] = useState(
    () => ALL_COLUMNS.filter(c => c.default).map(c => c.key)
  );

  const limit = PAGE_SIZE * 5; // Fetch more, paginate client-side
  const { data: orders, isLoading } = usePaperOrdersFull(statusFilter, limit, sideFilter);
  const addToast = useAppStore(s => s.addToast);
  const queryClient = useQueryClient();

  const cancelOrder = useMutation({
    mutationFn: (orderId) => del(`/api/paper/orders/${encodeURIComponent(orderId)}`),
    onSuccess: () => {
      addToast('Order canceled', 'success');
      queryClient.invalidateQueries({ queryKey: ['paper-orders-full'] });
      queryClient.invalidateQueries({ queryKey: ['paper-orders'] });
      queryClient.invalidateQueries({ queryKey: ['paper-account'] });
    },
    onError: (err) => addToast(err.message, 'error'),
  });

  if (isLoading) return <LoadingSkeleton type="table" />;

  const allOrders = orders || [];
  const totalPages = Math.ceil(allOrders.length / PAGE_SIZE);
  const paged = allOrders.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleColumn = (key) => {
    setVisibleCols(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const renderCell = (o, col) => {
    switch (col) {
      case 'symbol': return <td key={col} style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--accent)' }} onClick={() => navigate(`/stock/${o.symbol}`)}>{o.symbol}</td>;
      case 'side': return <td key={col}><span className={`badge badge-${o.side === 'sell' ? 'bearish' : 'bullish'}`}>{(o.side || '').toUpperCase()}</span></td>;
      case 'type': return <td key={col}>{(o.type || '').replace(/_/g, '-')}</td>;
      case 'status': {
        const s = o.status || '';
        const cls = s === 'filled' ? 'bullish' : s === 'canceled' || s === 'expired' || s === 'rejected' ? 'bearish' : '';
        return <td key={col}><span className={`badge${cls ? ` badge-${cls}` : ''}`}>{s}</span></td>;
      }
      case 'qty': return <td key={col}>{o.qty || '—'}</td>;
      case 'filled_qty': return <td key={col}>{o.filled_qty || '—'}</td>;
      case 'notional': return <td key={col}>{o.notional ? formatPrice(o.notional) : '—'}</td>;
      case 'limit_price': return <td key={col}>{o.limit_price ? formatPrice(o.limit_price) : '—'}</td>;
      case 'stop_price': return <td key={col}>{o.stop_price ? formatPrice(o.stop_price) : '—'}</td>;
      case 'filled_avg_price': return <td key={col}>{o.filled_avg_price ? formatPrice(o.filled_avg_price) : '—'}</td>;
      case 'time_in_force': return <td key={col}>{(o.time_in_force || '').toUpperCase()}</td>;
      case 'extended_hours': return <td key={col}>{o.extended_hours ? 'Yes' : 'No'}</td>;
      case 'submitted_at': return <td key={col} style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatTime(o.submitted_at)}</td>;
      case 'filled_at': return <td key={col} style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatTime(o.filled_at)}</td>;
      case 'created_at': return <td key={col} style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatTime(o.created_at)}</td>;
      case 'expired_at': return <td key={col} style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatTime(o.expired_at)}</td>;
      case 'canceled_at': return <td key={col} style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatTime(o.canceled_at)}</td>;
      case 'failed_at': return <td key={col} style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatTime(o.failed_at)}</td>;
      case 'order_class': return <td key={col}>{o.order_class || '—'}</td>;
      case 'trail_percent': return <td key={col}>{o.trail_percent || '—'}</td>;
      case 'trail_price': return <td key={col}>{o.trail_price ? formatPrice(o.trail_price) : '—'}</td>;
      case 'hwm': return <td key={col}>{o.hwm ? formatPrice(o.hwm) : '—'}</td>;
      case 'replaced_by': return <td key={col} style={{ fontSize: '0.7rem' }}>{o.replaced_by || '—'}</td>;
      case 'client_order_id': return <td key={col} style={{ fontSize: '0.7rem' }}>{o.client_order_id || '—'}</td>;
      case 'asset_class': return <td key={col}>{o.asset_class || '—'}</td>;
      case 'id': return <td key={col} style={{ fontSize: '0.7rem' }}>{o.id || '—'}</td>;
      default: return <td key={col}>—</td>;
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select name="order-status-filter" id="order-status-filter" aria-label="Order status filter" className="input" style={{ width: 'auto', fontSize: '0.8rem', padding: '4px 8px' }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}>
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
        <select name="order-side-filter" id="order-side-filter" aria-label="Order side filter" className="input" style={{ width: 'auto', fontSize: '0.8rem', padding: '4px 8px' }} value={sideFilter || ''} onChange={e => { setSideFilter(e.target.value || null); setPage(0); }}>
          <option value="">All Sides</option>
          <option value="buy">Buy</option>
          <option value="sell">Sell</option>
        </select>
        <div style={{ marginLeft: 'auto', position: 'relative' }}>
          <button className="btn btn-sm btn-ghost" onClick={() => setShowColumnPicker(!showColumnPicker)}>⚙ Columns ({visibleCols.length})</button>
          {showColumnPicker && (
            <div className="card" style={{ position: 'absolute', right: 0, top: '100%', zIndex: 100, padding: '0.75rem', minWidth: '200px', maxHeight: '400px', overflowY: 'auto' }}>
              {ALL_COLUMNS.map(c => (
                <label key={c.key} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.8rem', padding: '2px 0', cursor: 'pointer' }}>
                  <input type="checkbox" name={`order-col-${c.key}`} id={`order-col-${c.key}`} checked={visibleCols.includes(c.key)} onChange={() => toggleColumn(c.key)} />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {allOrders.length === 0 ? (
        <EmptyState icon="📋" title="No orders" message="Submit an order to see it here" />
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  {ALL_COLUMNS.filter(c => visibleCols.includes(c.key)).map(c => (
                    <th key={c.key}>{c.label}</th>
                  ))}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paged.map((o, i) => (
                  <tr key={o.id || i}>
                    {visibleCols.map(col => renderCell(o, col))}
                    <td>
                      {(o.status === 'new' || o.status === 'accepted' || o.status === 'pending_new' || o.status === 'partially_filled') && (
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => { if (window.confirm(`Cancel order for ${o.symbol}?`)) cancelOrder.mutate(o.id); }}
                          disabled={cancelOrder.isPending}
                        >Cancel</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem', alignItems: 'center' }}>
              <button className="btn btn-sm btn-ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Page {page + 1} of {totalPages} ({allOrders.length} orders)
              </span>
              <button className="btn btn-sm btn-ghost" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
