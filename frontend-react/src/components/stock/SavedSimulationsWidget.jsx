import { useState } from 'react';
import { formatPrice, formatChange } from '../../utils/formatters';
import useLocalStorage from '../../hooks/useLocalStorage';

export default function SavedSimulationsWidget({ symbol }) {
  const [simulations, setSimulations] = useLocalStorage(`sd_sims_${symbol}`, []);
  const [page, setPage] = useState(0);
  const perPage = 5;

  if (!simulations || simulations.length === 0) {
    return <div className="text-muted" style={{ padding: 12, fontSize: '0.85rem' }}>No saved simulations. Run the Trade Calculator above.</div>;
  }

  const totalPages = Math.ceil(simulations.length / perPage);
  const pageItems = simulations.slice(page * perPage, (page + 1) * perPage);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span className="text-muted" style={{ fontSize: '0.8rem' }}>{simulations.length} simulation{simulations.length !== 1 ? 's' : ''}</span>
        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => { if (confirm('Clear all simulations?')) setSimulations([]); }}>Clear</button>
      </div>
      <div className="signals-table-wrap">
        <table className="signals-table" style={{ fontSize: '0.8rem' }}>
          <thead><tr><th>Buy</th><th>Sell</th><th>Entry</th><th>Exit</th><th>Invested</th><th>P&L</th><th>Return</th><th>Days</th></tr></thead>
          <tbody>
            {pageItems.map((s, i) => {
              const pnl = s.pnl_dollars ?? s.pnl ?? 0;
              const retPct = s.pnl_pct ?? s.return_pct ?? 0;
              return (
                <tr key={i}>
                  <td>{s.entry_date}</td>
                  <td>{s.exit_date}</td>
                  <td className="text-mono">{formatPrice(s.entry_price)}</td>
                  <td className="text-mono">{formatPrice(s.exit_price)}</td>
                  <td className="text-mono">{formatPrice(s.entry_value || s.invested || s.amount)}</td>
                  <td className={`text-mono ${pnl >= 0 ? 'text-green' : 'text-red'}`}>{pnl >= 0 ? '+' : ''}{formatPrice(pnl)}</td>
                  <td className={`text-mono ${retPct >= 0 ? 'text-green' : 'text-red'}`}>{formatChange(retPct)}</td>
                  <td>{s.days_held}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
          <button className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</button>
          <span className="text-muted" style={{ fontSize: '0.8rem' }}>{page + 1}/{totalPages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
