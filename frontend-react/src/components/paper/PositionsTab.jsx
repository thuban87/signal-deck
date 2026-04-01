import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { del } from '../../api/client';
import { usePaperPositions } from '../../hooks/usePaperTrading';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import EmptyState from '../ui/EmptyState';
import { formatPrice } from '../../utils/formatters';
import { useAppStore } from '../../stores/appStore';

const ALL_COLUMNS = [
  { key: 'symbol', label: 'Symbol', default: true },
  { key: 'qty', label: 'Qty', default: true },
  { key: 'side', label: 'Side', default: true },
  { key: 'avg_entry_price', label: 'Avg Entry', default: true },
  { key: 'current_price', label: 'Current', default: true },
  { key: 'market_value', label: 'Mkt Value', default: true },
  { key: 'cost_basis', label: 'Cost Basis', default: false },
  { key: 'unrealized_pl', label: 'P&L', default: true },
  { key: 'unrealized_plpc', label: 'P&L %', default: true },
  { key: 'change_today', label: 'Today %', default: false },
];

export default function PositionsTab() {
  const navigate = useNavigate();
  const { data: positions, isLoading } = usePaperPositions();
  const [tab, setTab] = useState('all');
  const [assetFilter, setAssetFilter] = useState('all');
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [visibleCols, setVisibleCols] = useState(
    () => ALL_COLUMNS.filter(c => c.default).map(c => c.key)
  );

  const addToast = useAppStore(s => s.addToast);
  const queryClient = useQueryClient();

  const closePosition = useMutation({
    mutationFn: (sym) => del(`/api/paper/positions/${encodeURIComponent(sym)}`),
    onSuccess: () => {
      addToast('Position closed', 'success');
      queryClient.invalidateQueries({ queryKey: ['paper-positions'] });
      queryClient.invalidateQueries({ queryKey: ['paper-account'] });
    },
    onError: (err) => addToast(err.message, 'error'),
  });

  if (isLoading) return <LoadingSkeleton type="table" />;
  if (!positions?.length) return <EmptyState icon="📊" title="No open positions" message="Place an order to open a position" />;

  const filtered = (positions || []).filter(p => {
    // Tab filter
    const qty = Number(p.qty);
    if (tab === 'long' && qty <= 0) return false;
    if (tab === 'short' && qty >= 0) return false;
    if (tab === 'options' && !(p.asset_class || '').toLowerCase().includes('option')) return false;

    // Asset class filter
    if (assetFilter !== 'all') {
      const cls = (p.asset_class || 'us_equity').toLowerCase();
      if (assetFilter === 'equities' && !cls.includes('equity')) return false;
      if (assetFilter === 'crypto' && !cls.includes('crypto')) return false;
    }
    return true;
  });

  const toggleColumn = (key) => {
    setVisibleCols(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const renderCell = (p, col) => {
    const pl = parseFloat(p.unrealized_pl) || 0;
    const plPct = parseFloat(p.unrealized_plpc) || 0;
    switch (col) {
      case 'symbol': return <td key={col} style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--accent)' }} onClick={() => navigate(`/stock/${p.symbol}`)}>{p.symbol}</td>;
      case 'qty': return <td key={col}>{Number(p.qty) % 1 !== 0 ? Number(p.qty).toFixed(4) : Number(p.qty)}</td>;
      case 'side': return <td key={col}><span className={`badge badge-${Number(p.qty) < 0 ? 'bearish' : 'bullish'}`}>{Number(p.qty) < 0 ? 'SHORT' : 'LONG'}</span></td>;
      case 'avg_entry_price': return <td key={col}>{formatPrice(p.avg_entry_price)}</td>;
      case 'current_price': return <td key={col}>{formatPrice(p.current_price)}</td>;
      case 'market_value': return <td key={col}>{formatPrice(p.market_value)}</td>;
      case 'cost_basis': return <td key={col}>{formatPrice(p.cost_basis)}</td>;
      case 'unrealized_pl': return <td key={col} style={{ color: pl >= 0 ? 'var(--bullish)' : 'var(--bearish)' }}>{pl >= 0 ? '+' : ''}{formatPrice(pl)}</td>;
      case 'unrealized_plpc': return <td key={col} style={{ color: plPct >= 0 ? 'var(--bullish)' : 'var(--bearish)' }}>{plPct >= 0 ? '+' : ''}{(plPct * 100).toFixed(2)}%</td>;
      case 'change_today': {
        const ct = parseFloat(p.change_today) || 0;
        return <td key={col} style={{ color: ct >= 0 ? 'var(--bullish)' : 'var(--bearish)' }}>{(ct * 100).toFixed(2)}%</td>;
      }
      default: return <td key={col}>—</td>;
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {['all', 'long', 'short', 'options'].map(t => (
          <button key={t} className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select name="position-asset-filter" id="position-asset-filter" aria-label="Asset class filter" className="input" style={{ width: 'auto', fontSize: '0.8rem', padding: '4px 8px' }} value={assetFilter} onChange={e => setAssetFilter(e.target.value)}>
            <option value="all">All Assets</option>
            <option value="equities">Equities</option>
            <option value="crypto">Crypto</option>
          </select>
          <div style={{ position: 'relative' }}>
            <button className="btn btn-sm btn-ghost" onClick={() => setShowColumnPicker(!showColumnPicker)}>⚙ Columns</button>
            {showColumnPicker && (
              <div className="card" style={{ position: 'absolute', right: 0, top: '100%', zIndex: 100, padding: '0.75rem', minWidth: '180px' }}>
                {ALL_COLUMNS.map(c => (
                  <label key={c.key} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.8rem', padding: '2px 0', cursor: 'pointer' }}>
                    <input type="checkbox" name={`pos-col-${c.key}`} id={`pos-col-${c.key}`} checked={visibleCols.includes(c.key)} onChange={() => toggleColumn(c.key)} />
                    {c.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

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
            {filtered.map(p => {
              const pl = parseFloat(p.unrealized_pl) || 0;
              return (
                <tr key={p.symbol} className={pl >= 0 ? 'bullish-row' : 'bearish-row'}>
                  {visibleCols.map(col => renderCell(p, col))}
                  <td>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => { if (window.confirm(`Close entire ${p.symbol} position?`)) closePosition.mutate(p.symbol); }}
                      disabled={closePosition.isPending}
                    >Close</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>No positions match filters</p>}
    </div>
  );
}
