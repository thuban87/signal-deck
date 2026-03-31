import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get } from '../api/client';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/ui/PageHeader';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import EmptyState from '../components/ui/EmptyState';
import { formatPrice } from '../utils/formatters';

const DAYS_OPTIONS = [
  { value: 1, label: 'Today' },
  { value: 3, label: '3 Days' },
  { value: 7, label: '7 Days' },
  { value: 14, label: '14 Days' },
  { value: 30, label: '30 Days' },
];

function useSignalsScan(days) {
  return useQuery({
    queryKey: ['signals-scan', days],
    queryFn: () => get(`/api/signals/scan?days=${days}`),
    staleTime: 2 * 60 * 1000,
  });
}

export default function SignalsPage() {
  const navigate = useNavigate();
  const [days, setDays] = useState(7);
  const [dirFilter, setDirFilter] = useState('all');
  const [symbolFilter, setSymbolFilter] = useState('');
  const [signalFilter, setSignalFilter] = useState('');
  const [accountSize, setAccountSize] = useState(200);
  const [riskPct, setRiskPct] = useState(2);
  const [sortCol, setSortCol] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  const { data: rawSignals, isLoading, refetch } = useSignalsScan(days);

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const sortArrow = (col) => sortCol === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ↕';

  const signals = useMemo(() => {
    let list = rawSignals || [];

    if (dirFilter === 'bullish') list = list.filter(s => s.direction === 'long');
    else if (dirFilter === 'bearish') list = list.filter(s => s.direction === 'short');

    if (symbolFilter) {
      const q = symbolFilter.toLowerCase();
      list = list.filter(s => s.symbol?.toLowerCase().includes(q));
    }
    if (signalFilter) {
      const q = signalFilter.toLowerCase();
      list = list.filter(s => s.signal?.toLowerCase().includes(q));
    }

    const sorted = [...list].sort((a, b) => {
      let va, vb;
      switch (sortCol) {
        case 'date': va = a.date || ''; vb = b.date || ''; break;
        case 'symbol': va = (a.symbol || '').toLowerCase(); vb = (b.symbol || '').toLowerCase(); break;
        case 'direction': va = (a.direction || '').toLowerCase(); vb = (b.direction || '').toLowerCase(); break;
        case 'signal': va = (a.signal || '').toLowerCase(); vb = (b.signal || '').toLowerCase(); break;
        case 'price': va = a.price || 0; vb = b.price || 0; break;
        case 'age': va = a.days_ago || 0; vb = b.days_ago || 0; break;
        default: va = ''; vb = '';
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [rawSignals, dirFilter, symbolFilter, signalFilter, sortCol, sortDir]);

  const calcPosition = (price, direction) => {
    const riskDollars = accountSize * (riskPct / 100);
    const atrEstimate = price * 0.02;
    const stopDistance = atrEstimate * 1.5;
    const shares = Math.floor(riskDollars / stopDistance);
    const stopLoss = direction === 'long' ? price - stopDistance : price + stopDistance;
    return { shares, stopLoss };
  };

  const ageLabel = (daysAgo) => {
    if (daysAgo === 0) return 'Today';
    if (daysAgo === 1) return '1 day';
    return `${daysAgo} days`;
  };

  return (
    <div className="page-content">
      <PageHeader title="Signals">
        <button className="btn btn-ghost" onClick={() => refetch()}>⚡ Scan</button>
      </PageHeader>

      {/* Filters */}
      <div className="card" style={{ padding: '1rem 1.5rem', marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'end' }}>
        <div>
          <label style={labelStyle}>Direction</label>
          <select className="input" value={dirFilter} onChange={e => setDirFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="bullish">Bullish Only</option>
            <option value="bearish">Bearish Only</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Days</label>
          <select className="input" value={days} onChange={e => setDays(Number(e.target.value))}>
            {DAYS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Symbol</label>
          <input className="input" value={symbolFilter} onChange={e => setSymbolFilter(e.target.value)} placeholder="Filter..." style={{ width: 100 }} />
        </div>
        <div>
          <label style={labelStyle}>Signal</label>
          <input className="input" value={signalFilter} onChange={e => setSignalFilter(e.target.value)} placeholder="Filter..." style={{ width: 120 }} />
        </div>
        <div>
          <label style={labelStyle}>Account $</label>
          <input className="input" type="number" value={accountSize} onChange={e => setAccountSize(Number(e.target.value))} style={{ width: 90 }} />
        </div>
        <div>
          <label style={labelStyle}>Risk %</label>
          <input className="input" type="number" step="0.5" min="0.5" max="10" value={riskPct} onChange={e => setRiskPct(Number(e.target.value))} style={{ width: 70 }} />
        </div>
      </div>

      {/* Table */}
      {isLoading ? <LoadingSkeleton type="table" /> : signals.length === 0 ? (
        <EmptyState icon="⚡" title="No signals found" message="Adjust filters or scan a different time range" />
      ) : (
        <div className="card" style={{ padding: '1.5rem', overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={thSortStyle} onClick={() => toggleSort('date')}>Date{sortArrow('date')}</th>
                <th style={thSortStyle} onClick={() => toggleSort('symbol')}>Symbol{sortArrow('symbol')}</th>
                <th style={thSortStyle} onClick={() => toggleSort('direction')}>Direction{sortArrow('direction')}</th>
                <th style={thSortStyle} onClick={() => toggleSort('signal')}>Signal{sortArrow('signal')}</th>
                <th style={thSortStyle} onClick={() => toggleSort('price')}>Price{sortArrow('price')}</th>
                <th>Shares</th>
                <th>Stop Loss</th>
                <th style={thSortStyle} onClick={() => toggleSort('age')}>Age{sortArrow('age')}</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((s, i) => {
                const pos = calcPosition(s.price, s.direction);
                return (
                  <tr
                    key={`${s.symbol}-${s.date}-${i}`}
                    className={s.direction === 'long' ? 'bullish-row' : 'bearish-row'}
                    onClick={() => navigate(`/stock/${s.symbol}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>{s.date}</td>
                    <td style={{ fontWeight: 600 }}>{s.symbol}</td>
                    <td><span className={`badge badge-${s.direction === 'long' ? 'bullish' : 'bearish'}`}>{s.direction === 'long' ? 'BUY' : 'SELL'}</span></td>
                    <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.signal}>{s.signal}</td>
                    <td>{formatPrice(s.price)}</td>
                    <td>{pos.shares}</td>
                    <td>{formatPrice(pos.stopLoss)}</td>
                    <td>{ageLabel(s.days_ago)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' };
const thSortStyle = { cursor: 'pointer', userSelect: 'none' };
