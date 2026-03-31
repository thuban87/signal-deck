import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get } from '../api/client';
import { useParams } from 'react-router-dom';
import PageHeader from '../components/ui/PageHeader';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import EmptyState from '../components/ui/EmptyState';
import AreaChart from '../components/ui/AreaChart';
import MetricCard from '../components/ui/MetricCard';
import { formatPrice } from '../utils/formatters';

const PERIODS = [
  { value: '3mo', label: '3 Months' },
  { value: '6mo', label: '6 Months' },
  { value: '1y', label: '1 Year' },
  { value: '2y', label: '2 Years' },
];

// ── Autocomplete ────────────────────────────────────────────────────────────
function SymbolAutocomplete({ value, onChange, onSubmit }) {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [hlIndex, setHlIndex] = useState(-1);
  const timer = useRef(null);
  const blurTimer = useRef(null);

  useEffect(() => { setQuery(value || ''); }, [value]);

  const doSearch = useCallback((q) => {
    if (!q.trim() || q.length < 1) { setResults([]); setOpen(false); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const data = await get(`/api/symbols/search?q=${encodeURIComponent(q)}&limit=8`);
        setResults(data || []);
        setOpen((data || []).length > 0);
        setHlIndex(-1);
      } catch { setResults([]); }
    }, 250);
  }, []);

  const select = (sym) => {
    setQuery(sym);
    onChange(sym);
    setOpen(false);
    setResults([]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHlIndex(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHlIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (hlIndex >= 0 && results[hlIndex]) select(results[hlIndex].symbol);
      else { onChange(query.toUpperCase()); onSubmit(); }
    }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="input"
        value={query}
        onChange={e => { setQuery(e.target.value.toUpperCase()); doSearch(e.target.value); }}
        onKeyDown={handleKeyDown}
        onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }}
        onFocus={() => { if (results.length) setOpen(true); }}
        placeholder="AAPL"
        style={{ width: 120 }}
      />
      {open && results.length > 0 && (
        <div style={dropdownStyle}>
          {results.map((r, i) => (
            <div key={r.symbol} onMouseDown={() => select(r.symbol)} style={{ ...dropdownItemStyle, background: i === hlIndex ? 'var(--bg-hover)' : undefined }}>
              <strong>{r.symbol}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{r.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Backtest Results ────────────────────────────────────────────────────────
function BacktestResults({ data, fundWarnings }) {
  const [tradeSort, setTradeSort] = useState({ col: 'entry_date', dir: 'asc' });
  const [tradeFilters, setTradeFilters] = useState({ direction: 'all', exitReason: 'all', pnl: 'all' });

  if (!data) return null;

  const toggleSort = (col) => {
    setTradeSort(prev => prev.col === col ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' });
  };
  const sortArrow = (col) => tradeSort.col === col ? (tradeSort.dir === 'asc' ? ' ▲' : ' ▼') : ' ↕';

  let trades = data.trades || [];
  if (tradeFilters.direction !== 'all') trades = trades.filter(t => t.direction === tradeFilters.direction);
  if (tradeFilters.exitReason !== 'all') trades = trades.filter(t => t.exit_reason === tradeFilters.exitReason);
  if (tradeFilters.pnl === 'winners') trades = trades.filter(t => t.pnl_pct > 0);
  else if (tradeFilters.pnl === 'losers') trades = trades.filter(t => t.pnl_pct <= 0);

  trades = [...trades].sort((a, b) => {
    let va, vb;
    switch (tradeSort.col) {
      case 'entry_date': va = a.entry_date || ''; vb = b.entry_date || ''; break;
      case 'exit_date': va = a.exit_date || ''; vb = b.exit_date || ''; break;
      case 'direction': va = a.direction || ''; vb = b.direction || ''; break;
      case 'entry_price': va = a.entry_price || 0; vb = b.entry_price || 0; break;
      case 'exit_price': va = a.exit_price || 0; vb = b.exit_price || 0; break;
      case 'pnl_pct': va = a.pnl_pct || 0; vb = b.pnl_pct || 0; break;
      case 'exit_reason': va = a.exit_reason || ''; vb = b.exit_reason || ''; break;
      default: va = ''; vb = '';
    }
    if (va < vb) return tradeSort.dir === 'asc' ? -1 : 1;
    if (va > vb) return tradeSort.dir === 'asc' ? 1 : -1;
    return 0;
  });

  const exitReasons = [...new Set((data.trades || []).map(t => t.exit_reason).filter(Boolean))];
  const curveData = (data.equity_curve || []).map(d => ({ time: d.date, value: d.cumulative }));
  const pnlColor = (v) => v >= 0 ? 'var(--bullish)' : 'var(--bearish)';

  return (
    <>
      {fundWarnings && fundWarnings.length > 0 && (
        <div className="card" style={{ padding: '1rem 1.5rem', marginBottom: '1rem', borderLeft: '3px solid var(--bearish)', color: 'var(--bearish)' }}>
          ⚠️ Fundamental filter warnings: {fundWarnings.join(' | ')}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <MetricCard label="Total Trades" value={data.total_trades} subtext={`${data.long_trades || 0}L / ${data.short_trades || 0}S`} />
        <MetricCard label="Win Rate" value={`${(data.win_rate || 0).toFixed(1)}%`} />
        <MetricCard label="Avg Return" value={<span style={{ color: pnlColor(data.avg_pnl) }}>{data.avg_pnl >= 0 ? '+' : ''}{(data.avg_pnl || 0).toFixed(2)}%</span>} />
        <MetricCard label="Cumulative" value={<span style={{ color: pnlColor(data.total_pnl) }}>{data.total_pnl >= 0 ? '+' : ''}{(data.total_pnl || 0).toFixed(2)}%</span>} />
        <MetricCard label="Buy & Hold" value={<span style={{ color: pnlColor(data.buy_hold_pct) }}>{data.buy_hold_pct >= 0 ? '+' : ''}{(data.buy_hold_pct || 0).toFixed(2)}%</span>} />
        <MetricCard label="Edge" value={<span style={{ color: pnlColor(data.edge) }}>{data.edge >= 0 ? '+' : ''}{(data.edge || 0).toFixed(2)}%</span>} />
      </div>

      {curveData.length > 0 && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem' }}>Equity Curve</h3>
          <AreaChart data={curveData} height={280} color={curveData.length > 1 && curveData[curveData.length - 1].value >= 0 ? '#00d4aa' : '#ff4757'} />
        </div>
      )}

      <div className="card" style={{ padding: '1.5rem', overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ margin: 0 }}>Trade Log <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 400 }}>({trades.length}/{(data.trades || []).length})</span></h3>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <select className="input" value={tradeFilters.direction} onChange={e => setTradeFilters(f => ({ ...f, direction: e.target.value }))} style={{ width: 'auto' }}>
              <option value="all">All Dirs</option>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
            <select className="input" value={tradeFilters.exitReason} onChange={e => setTradeFilters(f => ({ ...f, exitReason: e.target.value }))} style={{ width: 'auto' }}>
              <option value="all">All Reasons</option>
              {exitReasons.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select className="input" value={tradeFilters.pnl} onChange={e => setTradeFilters(f => ({ ...f, pnl: e.target.value }))} style={{ width: 'auto' }}>
              <option value="all">All P&L</option>
              <option value="winners">Winners</option>
              <option value="losers">Losers</option>
            </select>
          </div>
        </div>

        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={thSort} onClick={() => toggleSort('entry_date')}>Entry{sortArrow('entry_date')}</th>
              <th style={thSort} onClick={() => toggleSort('exit_date')}>Exit{sortArrow('exit_date')}</th>
              <th style={thSort} onClick={() => toggleSort('direction')}>Dir{sortArrow('direction')}</th>
              <th>Signal</th>
              <th style={thSort} onClick={() => toggleSort('entry_price')}>Entry ${sortArrow('entry_price')}</th>
              <th style={thSort} onClick={() => toggleSort('exit_price')}>Exit ${sortArrow('exit_price')}</th>
              <th style={thSort} onClick={() => toggleSort('pnl_pct')}>P&L{sortArrow('pnl_pct')}</th>
              <th style={thSort} onClick={() => toggleSort('exit_reason')}>Reason{sortArrow('exit_reason')}</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t, i) => (
              <tr key={i} className={t.pnl_pct >= 0 ? 'bullish-row' : 'bearish-row'}>
                <td>{t.entry_date}</td>
                <td>{t.exit_date}</td>
                <td><span className={`badge badge-${t.direction === 'long' ? 'bullish' : 'bearish'}`}>{t.direction === 'long' ? 'LONG' : 'SHORT'}</span></td>
                <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.signal}>{t.signal}</td>
                <td>{formatPrice(t.entry_price)}</td>
                <td>{formatPrice(t.exit_price)}</td>
                <td style={{ color: pnlColor(t.pnl_pct), fontWeight: 600 }}>{t.pnl_pct >= 0 ? '+' : ''}{(t.pnl_pct || 0).toFixed(2)}%</td>
                <td>{t.exit_reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function BacktestPage() {
  const { symbol: preSelected } = useParams();

  const [symbol, setSymbol] = useState(preSelected || '');
  const [period, setPeriod] = useState('1y');
  const [includeBearish, setIncludeBearish] = useState(true);
  const [showFundFilters, setShowFundFilters] = useState(false);
  const [fundFilters, setFundFilters] = useState({ maxPE: '', minEPS: '', maxDE: '', minFCF: '' });
  const [runSymbol, setRunSymbol] = useState(preSelected || '');
  const [runPeriod, setRunPeriod] = useState('1y');
  const [runBearish, setRunBearish] = useState(true);
  const [fundWarnings, setFundWarnings] = useState([]);

  const { data, isLoading } = useQuery({
    queryKey: ['backtest', runSymbol, runPeriod, runBearish],
    queryFn: () => get(`/api/backtest/${encodeURIComponent(runSymbol)}?period=${runPeriod}&include_bearish=${runBearish}`),
    enabled: !!runSymbol,
    staleTime: 5 * 60 * 1000,
  });

  const runBacktest = useCallback(async () => {
    if (!symbol.trim()) return;
    const sym = symbol.toUpperCase();

    if (showFundFilters) {
      try {
        const fund = await get(`/api/stock/${encodeURIComponent(sym)}/fundamentals`);
        const warnings = [];
        if (fundFilters.maxPE && fund.pe_ratio && fund.pe_ratio > Number(fundFilters.maxPE)) warnings.push(`P/E ${fund.pe_ratio.toFixed(1)} > ${fundFilters.maxPE}`);
        if (fundFilters.minEPS && fund.eps != null && fund.eps < Number(fundFilters.minEPS)) warnings.push(`EPS ${fund.eps.toFixed(2)} < ${fundFilters.minEPS}`);
        if (fundFilters.maxDE && fund.debt_to_equity && fund.debt_to_equity > Number(fundFilters.maxDE)) warnings.push(`D/E ${fund.debt_to_equity.toFixed(2)} > ${fundFilters.maxDE}`);
        if (fundFilters.minFCF && fund.free_cash_flow != null && fund.free_cash_flow / 1e6 < Number(fundFilters.minFCF)) warnings.push(`FCF ${(fund.free_cash_flow / 1e6).toFixed(0)}M < ${fundFilters.minFCF}M`);
        setFundWarnings(warnings);
      } catch { setFundWarnings([]); }
    } else {
      setFundWarnings([]);
    }

    setRunSymbol(sym);
    setRunPeriod(period);
    setRunBearish(includeBearish);
  }, [symbol, period, includeBearish, showFundFilters, fundFilters]);

  useEffect(() => {
    if (preSelected && !data) runBacktest();
  }, [preSelected]);

  return (
    <div className="page-content">
      <PageHeader title="Backtest" />

      <div className="card" style={{ padding: '1rem 1.5rem', marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'end' }}>
        <div>
          <label style={labelStyle}>Symbol</label>
          <SymbolAutocomplete value={symbol} onChange={setSymbol} onSubmit={runBacktest} />
        </div>
        <div>
          <label style={labelStyle}>Period</label>
          <select className="input" value={period} onChange={e => setPeriod(e.target.value)}>
            {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" id="bearish-cb" checked={includeBearish} onChange={e => setIncludeBearish(e.target.checked)} />
          <label htmlFor="bearish-cb" style={{ fontSize: '0.8rem', cursor: 'pointer' }}>Include Bearish</label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" id="fund-cb" checked={showFundFilters} onChange={e => setShowFundFilters(e.target.checked)} />
          <label htmlFor="fund-cb" style={{ fontSize: '0.8rem', cursor: 'pointer' }}>Fundamental Filters</label>
        </div>
        <button className="btn btn-primary" onClick={runBacktest} disabled={isLoading || !symbol.trim()}>
          {isLoading ? 'Running...' : 'Run Backtest'}
        </button>
      </div>

      {showFundFilters && (
        <div className="card" style={{ padding: '1rem 1.5rem', marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'end' }}>
          <div>
            <label style={labelStyle}>Max P/E</label>
            <input className="input" type="number" value={fundFilters.maxPE} onChange={e => setFundFilters(f => ({ ...f, maxPE: e.target.value }))} placeholder="30" style={{ width: 80 }} />
          </div>
          <div>
            <label style={labelStyle}>Min EPS</label>
            <input className="input" type="number" value={fundFilters.minEPS} onChange={e => setFundFilters(f => ({ ...f, minEPS: e.target.value }))} placeholder="0" style={{ width: 80 }} />
          </div>
          <div>
            <label style={labelStyle}>Max D/E</label>
            <input className="input" type="number" value={fundFilters.maxDE} onChange={e => setFundFilters(f => ({ ...f, maxDE: e.target.value }))} placeholder="2" style={{ width: 80 }} />
          </div>
          <div>
            <label style={labelStyle}>Min FCF (M)</label>
            <input className="input" type="number" value={fundFilters.minFCF} onChange={e => setFundFilters(f => ({ ...f, minFCF: e.target.value }))} placeholder="0" style={{ width: 80 }} />
          </div>
        </div>
      )}

      {isLoading ? <LoadingSkeleton type="metrics" /> : data ? (
        <BacktestResults data={data} fundWarnings={fundWarnings} />
      ) : (
        <EmptyState icon="📊" title="Run a backtest" message="Enter a symbol and click Run Backtest to see results" />
      )}
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' };
const thSort = { cursor: 'pointer', userSelect: 'none' };
const dropdownStyle = { position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' };
const dropdownItemStyle = { padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem' };
