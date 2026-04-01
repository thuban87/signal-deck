import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, put, del } from '../../api/client';
import { formatPrice, formatChange, rsiClass } from '../../utils/formatters';
import { Link } from 'react-router-dom';
import { useAppStore } from '../../stores/appStore';

function BasketMetrics({ basketId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['basket-metrics', basketId],
    queryFn: () => get(`/api/baskets/${basketId}/metrics`),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <div className="loading-spinner" style={{ padding: 4 }}><div className="spinner" style={{ width: 14, height: 14 }} /></div>;
  if (!data) return null;

  const m = data.metrics;
  const consensus = m.trend_consensus || 'neutral';

  return (
    <>
      <div className="basket-metrics">
        <div className="basket-metric">
          <span className="indicator-label">Avg RSI</span>
          <span className={`rsi-value ${rsiClass(m.avg_rsi)}`}>{m.avg_rsi != null ? m.avg_rsi.toFixed(1) : '\u2014'}</span>
        </div>
        <div className="basket-metric">
          <span className="indicator-label">Avg Change</span>
          <span className={(m.avg_change || 0) >= 0 ? 'text-green' : 'text-red'}>{m.avg_change != null ? formatChange(m.avg_change) : '\u2014'}</span>
        </div>
        <div className="basket-metric">
          <span className="indicator-label">Trend</span>
          <span className={`trend-badge ${consensus}`}>{consensus}</span>
        </div>
        <div className="basket-metric">
          <span className="indicator-label">Signals</span>
          <span>{m.total_signals || 0}</span>
        </div>
      </div>
      {data.tickers && data.tickers.length > 0 && (
        <div className="basket-detail">
          <div className="basket-detail-grid">
            {data.tickers.map(t => (
              <Link key={t.symbol} to={`/stock/${t.symbol}`} className="basket-detail-row" style={{ cursor: 'pointer', textDecoration: 'none', color: 'inherit' }} onClick={e => e.stopPropagation()}>
                <strong>{t.symbol}</strong>
                <span className="text-mono">{formatPrice(t.price)}</span>
                <span className={`text-mono ${(t.change_pct || 0) >= 0 ? 'text-green' : 'text-red'}`}>{formatChange(t.change_pct)}</span>
                <span className={`rsi-value ${rsiClass(t.rsi)}`}>{t.rsi != null ? t.rsi.toFixed(1) : '\u2014'}</span>
                <span className={`trend-badge ${t.trend || ''}`}>{t.trend || '\u2014'}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default function BasketsWidget() {
  const [expanded, setExpanded] = useState({});
  const queryClient = useQueryClient();
  const toast = useAppStore(s => s.addToast);

  const { data: baskets, isLoading } = useQuery({
    queryKey: ['baskets'],
    queryFn: () => get('/api/baskets'),
    staleTime: 5 * 60 * 1000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => del(`/api/baskets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['baskets'] });
      toast('Basket deleted', 'info');
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => post('/api/baskets', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['baskets'] });
      toast('Basket created', 'success');
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }) => put(`/api/baskets/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['baskets'] });
      toast('Basket updated', 'success');
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const handleEdit = (basket) => {
    const name = prompt('Basket name:', basket ? basket.name : '');
    if (!name) return;
    const icon = prompt('Icon emoji:', basket ? basket.icon : '\uD83D\uDCCA') || '\uD83D\uDCCA';
    const tickersStr = prompt('Tickers (comma-separated):', basket ? basket.tickers.join(', ') : '');
    if (tickersStr === null) return;
    const tickers = tickersStr.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);

    if (basket) {
      updateMutation.mutate({ id: basket.id, name, icon, tickers });
    } else {
      createMutation.mutate({ name, icon, tickers });
    }
  };

  const handleDelete = (id) => {
    if (!confirm('Delete this basket?')) return;
    deleteMutation.mutate(id);
  };

  if (isLoading) return <div className="loading-text">Loading baskets...</div>;
  if (!baskets || baskets.length === 0) return null;

  return (
    <div className="card mb-4">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3>Your Baskets</h3>
          <span className="text-muted" style={{ fontSize: '0.8rem' }}>Custom sector tracking</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(null)}>+ New Basket</button>
      </div>
      <div className="baskets-scroll">
        {baskets.map(b => (
          <div
            key={b.id}
            className={`basket-card ${expanded[b.id] ? 'expanded' : ''}`}
            onClick={() => setExpanded(prev => ({ ...prev, [b.id]: !prev[b.id] }))}
          >
            <div className="basket-card-header">
              <span className="basket-icon">{b.icon || '\uD83D\uDCCA'}</span>
              <span className="basket-name">{b.name}</span>
              <span className="basket-count">{b.tickers.length} stocks</span>
            </div>
            <div className="basket-tickers">
              {b.tickers.map(t => <span key={t} className="basket-ticker-chip">{t}</span>)}
            </div>
            <BasketMetrics basketId={b.id} />
            <div className="basket-actions" onClick={e => e.stopPropagation()}>
              <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(b)}>Edit</button>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => handleDelete(b.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
