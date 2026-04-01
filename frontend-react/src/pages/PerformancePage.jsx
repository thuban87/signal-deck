import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  usePerformanceSummary,
  useEquityCurve,
  usePerformanceByTag,
} from '../hooks/usePerformance';
import PageHeader from '../components/ui/PageHeader';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import EmptyState from '../components/ui/EmptyState';
import AreaChart from '../components/ui/AreaChart';

const PERIODS = [
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: '1Y', label: '1Y' },
  { value: 'all', label: 'All Time' },
];

// ── Metric Cards ────────────────────────────────────────────────────────────
function MetricsGrid({ data }) {
  const metrics = [
    { label: 'Total P&L', value: fmtPct(data.total_pnl), color: plColor(data.total_pnl), sub: `${data.total_trades || 0} trades`, highlight: true },
    { label: 'Win Rate', value: fmtPct(data.win_rate), sub: `${data.wins || 0}W / ${data.losses || 0}L` },
    { label: 'Profit Factor', value: fmtRatio(data.profit_factor), sub: 'gross P / gross L' },
    { label: 'Expectancy', value: fmtPct(data.expectancy), sub: 'avg per trade' },
    { label: 'Max Drawdown', value: fmtPct(data.max_drawdown), color: 'var(--bearish)', sub: 'peak to trough' },
    { label: 'Sharpe Ratio', value: fmtRatio(data.sharpe_ratio), sub: 'return/vol' },
    { label: 'Risk/Reward', value: fmtRatio(data.risk_reward), sub: 'avg win/avg loss' },
    { label: 'Avg Win', value: fmtPct(data.avg_win), color: 'var(--bullish)' },
    { label: 'Avg Loss', value: fmtPct(data.avg_loss), color: 'var(--bearish)' },
    { label: 'Best Trade', value: fmtPct(data.best_trade?.pnl_pct), color: 'var(--bullish)', sub: data.best_trade?.symbol },
    { label: 'Worst Trade', value: fmtPct(data.worst_trade?.pnl_pct), color: 'var(--bearish)', sub: data.worst_trade?.symbol },
    { label: 'Avg Hold Time', value: `${data.avg_hold_days?.toFixed(1) || '—'}d`, sub: 'days held' },
    { label: 'Win Streak', value: data.max_consecutive_wins ?? '—', sub: 'consecutive' },
    { label: 'Loss Streak', value: data.max_consecutive_losses ?? '—', sub: 'consecutive' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
      {metrics.map(m => (
        <div key={m.label} className="card" style={{ padding: '1rem', borderLeft: m.highlight ? '3px solid var(--accent)' : undefined }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>{m.label}</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: m.color || 'var(--text-primary)' }}>{m.value}</div>
          {m.sub && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{m.sub}</div>}
        </div>
      ))}
    </div>
  );
}

// ── Donut Chart ─────────────────────────────────────────────────────────────
function DonutChart({ data }) {
  const wins = data.wins || 0;
  const losses = data.losses || 0;
  const total = wins + losses;
  if (total === 0) return <EmptyState icon="🍩" title="No trades" message="Complete some trades to see distribution" />;

  const winPct = (wins / total) * 100;
  const lossPct = 100 - winPct;
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const winDash = (winPct / 100) * circumference;
  const lossDash = (lossPct / 100) * circumference;

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      <h3 style={{ margin: '0 0 1rem' }}>Trade Distribution</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <svg width="180" height="180" viewBox="0 0 180 180">
          <circle cx="90" cy="90" r={radius} fill="none" stroke="var(--bg-hover)" strokeWidth="20" />
          <circle
            cx="90" cy="90" r={radius} fill="none"
            stroke="#00d4aa" strokeWidth="20"
            strokeDasharray={`${winDash} ${circumference}`}
            strokeDashoffset="0"
            transform="rotate(-90 90 90)"
            strokeLinecap="round"
          />
          <circle
            cx="90" cy="90" r={radius} fill="none"
            stroke="#ff4757" strokeWidth="20"
            strokeDasharray={`${lossDash} ${circumference}`}
            strokeDashoffset={`${-winDash}`}
            transform="rotate(-90 90 90)"
            strokeLinecap="round"
          />
          <text x="90" y="82" textAnchor="middle" fill="var(--text-primary)" fontSize="22" fontWeight="700">{winPct.toFixed(0)}%</text>
          <text x="90" y="104" textAnchor="middle" fill="var(--text-muted)" fontSize="11">Win Rate</text>
        </svg>
        <div style={{ fontSize: '0.85rem' }}>
          <div style={{ marginBottom: '0.5rem' }}><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#00d4aa', marginRight: 6 }} />Wins: {wins}</div>
          <div style={{ marginBottom: '0.5rem' }}><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#ff4757', marginRight: 6 }} />Losses: {losses}</div>
          <div style={{ marginBottom: '0.75rem', color: 'var(--text-muted)' }}>Total: {total}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <div>Avg Win: <span style={{ color: 'var(--bullish)' }}>{fmtPct(data.avg_win)}</span></div>
            <div>Avg Loss: <span style={{ color: 'var(--bearish)' }}>{fmtPct(data.avg_loss)}</span></div>
            <div>R:R: {fmtRatio(data.risk_reward)}</div>
            <div>Expectancy: {fmtPct(data.expectancy)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Win Rate by Tag ─────────────────────────────────────────────────────────
function TagBreakdown({ tags }) {
  if (!tags || tags.length === 0) {
    return (
      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem' }}>Win Rate by Tag</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No tagged trades yet. Tag watchlist symbols to see breakdown.</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      <h3 style={{ margin: '0 0 1rem' }}>Win Rate by Tag</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {tags.map(t => {
          const winRate = t.win_rate || 0;
          const totalPL = t.total_pnl || 0;
          return (
            <div key={t.tag} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ minWidth: 120, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
                {t.tag} <span style={{ color: 'var(--text-muted)' }}>({t.count})</span>
              </div>
              <div style={{ flex: 1, height: 18, background: 'var(--bg-hover)', borderRadius: 9, overflow: 'hidden', position: 'relative' }}>
                <div style={{ width: `${winRate}%`, height: '100%', background: 'var(--bullish)', borderRadius: 9, transition: 'width 0.3s' }} />
                <span style={{ position: 'absolute', right: 8, top: 0, lineHeight: '18px', fontSize: '0.7rem', color: 'var(--text-primary)' }}>{winRate.toFixed(0)}%</span>
              </div>
              <div style={{ minWidth: 80, fontSize: '0.75rem', textAlign: 'right' }}>
                <span style={{ color: totalPL >= 0 ? 'var(--bullish)' : 'var(--bearish)', fontWeight: 600 }}>
                  {totalPL >= 0 ? '+' : ''}{totalPL.toFixed(1)}%
                </span>
                <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>{t.wins || 0}W/{t.losses || 0}L</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Equity Curve ────────────────────────────────────────────────────────────
function EquityCurveSection({ period }) {
  const { data, isLoading } = useEquityCurve(period);

  const chartData = formatCurveData(data);

  return (
    <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
      <h3 style={{ margin: '0 0 1rem' }}>Equity Curve</h3>
      {isLoading ? <LoadingSkeleton type="chart" /> : (
        chartData.length > 0 ? (
          <AreaChart data={chartData} height={300} color="#00d4aa" />
        ) : (
          <EmptyState icon="📈" title="No equity data" message="Complete trades to see your equity curve" />
        )
      )}
    </div>
  );
}

function formatCurveData(data) {
  if (!data) return [];
  if (Array.isArray(data)) {
    return data.map(d => ({
      time: d.time || d.date,
      value: parseFloat(d.value || d.equity) || 0,
    }));
  }
  if (data.timestamps && data.equity) {
    return data.timestamps.map((ts, i) => ({
      time: typeof ts === 'number' ? new Date(ts * 1000).toISOString().split('T')[0] : ts,
      value: parseFloat(data.equity[i]) || 0,
    }));
  }
  return [];
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmtPct(val) {
  if (val == null) return '—';
  return `${Number(val) >= 0 ? '+' : ''}${Number(val).toFixed(2)}%`;
}

function fmtRatio(val) {
  if (val == null) return '—';
  if (!isFinite(val)) return '∞';
  return Number(val).toFixed(2);
}

function plColor(val) {
  if (val == null) return undefined;
  return Number(val) >= 0 ? 'var(--bullish)' : 'var(--bearish)';
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function PerformancePage() {
  const [period, setPeriod] = useState('all');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: summary, isLoading: summaryLoading } = usePerformanceSummary(period);
  const { data: tags, isLoading: tagsLoading } = usePerformanceByTag(period);

  const refreshAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['performance-summary'] });
    queryClient.invalidateQueries({ queryKey: ['equity-curve'] });
    queryClient.invalidateQueries({ queryKey: ['performance-by-tag'] });
  }, [queryClient]);

  const hasTrades = summary && (summary.total_trades > 0);

  return (
    <div className="page-content">
      <PageHeader title="Performance">
        <select className="input" value={period} onChange={e => setPeriod(e.target.value)} style={{ width: 'auto', minWidth: 120 }}>
          {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <button className="btn btn-ghost" onClick={refreshAll}>↻ Refresh</button>
      </PageHeader>

      {/* Source badge */}
      {summary?.source && (
        <div style={{ marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Data source: <span className="badge">{summary.source}</span>
          {summary.total_trades != null && <span style={{ marginLeft: 8 }}>{summary.total_trades} closed trades</span>}
        </div>
      )}

      {summaryLoading ? (
        <LoadingSkeleton type="metrics" />
      ) : !hasTrades ? (
        <EmptyState
          icon="📊"
          title="No trades yet"
          message="Complete paper trades to see performance analytics"
          action={<button className="btn btn-primary" onClick={() => navigate('/paper')}>Go to Paper Trading</button>}
        />
      ) : (
        <>
          <MetricsGrid data={summary} />

          <EquityCurveSection period={period} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            {tagsLoading ? <LoadingSkeleton type="card" /> : <TagBreakdown tags={tags} />}
            <DonutChart data={summary} />
          </div>
        </>
      )}
    </div>
  );
}
