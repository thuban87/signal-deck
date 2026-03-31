import { useQuery } from '@tanstack/react-query';
import { get } from '../../api/client';
import { formatChange } from '../../utils/formatters';

function heatmapColor(changePct) {
  const clamped = Math.max(-3, Math.min(3, changePct));
  const ratio = (clamped + 3) / 6;
  if (ratio < 0.5) {
    const r = 255;
    const g = Math.round(60 + ratio * 2 * 140);
    const b = Math.round(60 + ratio * 2 * 100);
    return `rgba(${r}, ${g}, ${b}, 0.85)`;
  } else {
    const t = (ratio - 0.5) * 2;
    const r = Math.round(200 - t * 200);
    const g = Math.round(200 + t * 55);
    const b = Math.round(160 - t * 60);
    return `rgba(${r}, ${g}, ${b}, 0.85)`;
  }
}

export default function SectorHeatmapWidget() {
  const { data: sectors, isLoading } = useQuery({
    queryKey: ['sectors-performance'],
    queryFn: () => get('/api/sectors/performance'),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <div className="loading-spinner"><div className="spinner" />Loading sectors...</div>;

  if (!sectors || sectors.length === 0) {
    return <p className="text-muted" style={{ padding: 16 }}>No sector data available.</p>;
  }

  const sorted = [...sectors].sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0));
  const totalCap = sorted.reduce((sum, s) => sum + (s.market_cap || 1e9), 0);

  return (
    <div className="card mb-4">
      <div className="card-header">
        <h3>Sector Heatmap</h3>
        <span className="text-muted" style={{ fontSize: '0.8rem' }}>Daily sector performance</span>
      </div>
      <div className="sector-heatmap-grid">
        <div className="heatmap-treemap">
          {sorted.map(s => {
            const weight = Math.max(((s.market_cap || 1e9) / totalCap) * 100, 5);
            const chg = s.change_pct || 0;
            const bg = heatmapColor(chg);
            const textColor = Math.abs(chg) > 1.5 ? '#fff' : 'var(--text-primary)';
            return (
              <div key={s.symbol} className="heatmap-cell" style={{ flexGrow: weight.toFixed(1), background: bg, color: textColor }}>
                <span className="heatmap-label">{s.name}</span>
                <span className="heatmap-value">{formatChange(chg)}</span>
                <span className="heatmap-ticker">{s.symbol}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
