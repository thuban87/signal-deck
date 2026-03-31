import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get } from '../../api/client';
import { formatPrice } from '../../utils/formatters';
import { Link } from 'react-router-dom';

export default function InsiderTradingWidget({ symbol }) {
  const [showCount, setShowCount] = useState(5);

  const { data, isLoading } = useQuery({
    queryKey: ['insider', symbol],
    queryFn: () => get(`/api/stock/${symbol}/insider`),
    staleTime: 30 * 60 * 1000,
  });

  if (isLoading) return <div className="loading-text">Loading insider data...</div>;
  if (!data || (!data.trades?.length && !data.summary)) return <div className="text-muted" style={{ padding: 12, fontSize: '0.85rem' }}>No insider trading data</div>;

  const summary = data.summary || {};
  const trades = data.trades || [];
  const netSignal = summary.net_signal || 'neutral';
  const netColor = netSignal === 'bullish' ? 'var(--green)' : netSignal === 'bearish' ? 'var(--red)' : 'var(--text-muted)';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 16, fontSize: '0.85rem' }}>
          <span>Net: <strong style={{ color: netColor }}>{netSignal.toUpperCase()}</strong></span>
          {summary.total_bought != null && <span className="text-green">Bought: ${(summary.total_bought / 1e6).toFixed(1)}M</span>}
          {summary.total_sold != null && <span className="text-red">Sold: ${(summary.total_sold / 1e6).toFixed(1)}M</span>}
        </div>
        <Link to={`/investigate/${symbol}`} style={{ fontSize: '0.75rem' }}>Full Research &rarr;</Link>
      </div>
      {trades.length > 0 && (
        <>
          <div className="signals-table-wrap">
            <table className="signals-table" style={{ fontSize: '0.8rem' }}>
              <thead><tr><th>Date</th><th>Insider</th><th>Type</th><th>Value</th></tr></thead>
              <tbody>
                {trades.slice(0, showCount).map((t, i) => (
                  <tr key={i}>
                    <td>{t.trade_date || t.date}</td>
                    <td>{t.insider || t.owner_name || '\u2014'}</td>
                    <td><span className={`trend-badge ${t.trade_type === 'Purchase' || t.trade_type === 'Buy' ? 'bullish' : 'bearish'}`}>{t.trade_type}</span></td>
                    <td className="text-mono">{t.value ? formatPrice(t.value) : '\u2014'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {trades.length > showCount && (
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 4 }} onClick={() => setShowCount(c => c + 5)}>Show more ({trades.length - showCount} remaining)</button>
          )}
        </>
      )}
    </div>
  );
}
