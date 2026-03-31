import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get } from '../../api/client';
import { formatPrice, formatChange, rsiClass } from '../../utils/formatters';
import { useNavigate } from 'react-router-dom';

export default function ScreenerWidget() {
  const [open, setOpen] = useState(true);
  const [params, setParams] = useState(null);
  const navigate = useNavigate();

  const { data: results, isLoading, isFetching } = useQuery({
    queryKey: ['screener', params],
    queryFn: () => get(`/api/screener?${params}`),
    enabled: !!params,
    staleTime: 60 * 1000,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const qs = new URLSearchParams();
    for (const [k, v] of fd.entries()) {
      if (v) qs.set(k, v);
    }
    setParams(qs.toString());
  };

  return (
    <>
      <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <h3>Screener</h3>
        <span className="text-muted" style={{ fontSize: '0.8rem' }}>Filter watchlist by technicals</span>
      </div>
      {open && (
        <div style={{ padding: 16 }}>
          <form className="screener-filters" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Min RSI</label>
              <input type="number" name="min_rsi" placeholder="30" step="1" min="0" max="100" />
            </div>
            <div className="form-group">
              <label>Max RSI</label>
              <input type="number" name="max_rsi" placeholder="70" step="1" min="0" max="100" />
            </div>
            <div className="form-group">
              <label>Min ADX</label>
              <input type="number" name="min_adx" placeholder="20" step="1" min="0" />
            </div>
            <div className="form-group">
              <label>Min Price</label>
              <input type="number" name="min_price" placeholder="0" step="0.01" min="0" />
            </div>
            <div className="form-group">
              <label>Max Price</label>
              <input type="number" name="max_price" placeholder="1000" step="0.01" min="0" />
            </div>
            <div className="form-group">
              <label>Trend</label>
              <select name="trend"><option value="">Any</option><option value="bullish">Bullish</option><option value="bearish">Bearish</option><option value="neutral">Neutral</option></select>
            </div>
            <div className="form-group">
              <label>Has Signals</label>
              <select name="has_signals"><option value="">Either</option><option value="true">Yes</option><option value="false">No</option></select>
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="submit" className="btn btn-primary btn-sm">Screen</button>
            </div>
          </form>

          {(isLoading || isFetching) && <div className="loading-spinner"><div className="spinner" />Screening...</div>}

          {results && !isFetching && results.length === 0 && (
            <p className="text-muted" style={{ padding: '12px 0' }}>No symbols match the criteria.</p>
          )}

          {results && !isFetching && results.length > 0 && (
            <>
              <p style={{ padding: '8px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{results.length} match{results.length !== 1 ? 'es' : ''}</p>
              <div className="signals-table-wrap">
                <table className="signals-table">
                  <thead><tr><th>Symbol</th><th>Price</th><th>Change</th><th>RSI</th><th>ADX</th><th>Trend</th><th>Signals</th></tr></thead>
                  <tbody>
                    {results.map(r => (
                      <tr key={r.symbol} style={{ cursor: 'pointer' }} onClick={() => navigate(`/stock/${r.symbol}`)}>
                        <td><strong>{r.symbol}</strong></td>
                        <td className="text-mono">{formatPrice(r.price)}</td>
                        <td className={`text-mono ${r.change_pct >= 0 ? 'text-green' : 'text-red'}`}>{formatChange(r.change_pct)}</td>
                        <td className="text-mono"><span className={`rsi-value ${rsiClass(r.rsi)}`}>{r.rsi != null ? r.rsi.toFixed(1) : '\u2014'}</span></td>
                        <td className="text-mono">{r.adx != null ? r.adx.toFixed(1) : '\u2014'}</td>
                        <td><span className={`trend-badge ${r.trend || ''}`}>{r.trend || '\u2014'}</span></td>
                        <td>{r.signal_count || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
