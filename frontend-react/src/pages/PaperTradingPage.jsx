import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { post, put } from '../api/client';
import useConfig from '../hooks/useConfig';
import { usePaperPositions } from '../hooks/usePaperTrading';
import PageHeader from '../components/ui/PageHeader';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import { formatPrice } from '../utils/formatters';
import { useAppStore } from '../stores/appStore';

import PaperDashboardTab from '../components/paper/PaperDashboardTab';
import PositionsTab from '../components/paper/PositionsTab';
import OrdersTab from '../components/paper/OrdersTab';
import BalancesTab from '../components/paper/BalancesTab';
import ConfigureTab from '../components/paper/ConfigureTab';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'positions', label: 'Positions', icon: '💼' },
  { id: 'orders', label: 'Orders', icon: '📋' },
  { id: 'balances', label: 'Balances', icon: '💰' },
  { id: 'configure', label: 'Configure', icon: '⚙' },
];

// ── Local Stats Bar ─────────────────────────────────────────────────────────
function LocalStatsBar({ openTrades, closedTrades }) {
  const wins = closedTrades.filter(t => parseFloat(t.pnl_pct) > 0).length;
  const totalPL = closedTrades.reduce((s, t) => s + (parseFloat(t.pnl_pct) || 0), 0);
  const winRate = closedTrades.length > 0 ? ((wins / closedTrades.length) * 100).toFixed(1) : '0.0';

  const stats = [
    { label: 'Open Trades', value: openTrades.length },
    { label: 'Closed Trades', value: closedTrades.length },
    { label: 'Win Rate', value: `${winRate}%` },
    { label: 'Total P&L', value: `${totalPL >= 0 ? '+' : ''}${totalPL.toFixed(2)}%`, color: totalPL >= 0 ? 'var(--bullish)' : 'var(--bearish)' },
  ];

  return (
    <div className="pt-account-bar">
      {stats.map(s => (
        <div key={s.label} className="pt-account-stat">
          <div className="pt-account-stat-label">{s.label}</div>
          <div className={`pt-account-stat-value${s.color ? (totalPL >= 0 ? ' positive' : ' negative') : ''}`}>
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Local Order Form (simple) ──────────────────────────────────────────────
const labelStyle = { display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' };

function LocalOrderForm({ onSubmitted }) {
  const addToast = useAppStore(s => s.addToast);
  const queryClient = useQueryClient();
  const [symbol, setSymbol] = useState('');
  const [direction, setDirection] = useState('long');
  const [entryPrice, setEntryPrice] = useState('');

  const createTrade = useMutation({
    mutationFn: (body) => post('/api/paper/trades', body),
    onSuccess: () => {
      addToast('Trade created', 'success');
      setSymbol(''); setEntryPrice('');
      queryClient.invalidateQueries({ queryKey: ['paper-positions'] });
      queryClient.invalidateQueries({ queryKey: ['paper-orders'] });
      if (onSubmitted) onSubmitted();
    },
    onError: (err) => addToast(err.message, 'error'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!symbol.trim() || !entryPrice) { addToast('All fields required', 'error'); return; }
    createTrade.mutate({
      symbol: symbol.toUpperCase(),
      direction,
      entry_price: parseFloat(entryPrice),
      entry_date: new Date().toISOString().split('T')[0],
    });
  };

  return (
    <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
      <h3 style={{ margin: '0 0 1rem' }}>New Trade</h3>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'end' }}>
        <div>
          <label style={labelStyle}>Symbol</label>
          <input className="input" name="local-symbol" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} placeholder="AAPL" />
        </div>
        <div>
          <label style={labelStyle}>Direction</label>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button type="button" className={`btn btn-sm ${direction === 'long' ? 'btn-success' : 'btn-ghost'}`} onClick={() => setDirection('long')}>Long</button>
            <button type="button" className={`btn btn-sm ${direction === 'short' ? 'btn-danger' : 'btn-ghost'}`} onClick={() => setDirection('short')}>Short</button>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Entry Price</label>
          <input className="input" name="local-entry-price" type="number" step="any" min="0" value={entryPrice} onChange={e => setEntryPrice(e.target.value)} />
        </div>
        <button className="btn btn-primary" type="submit" disabled={createTrade.isPending}>
          {createTrade.isPending ? 'Creating...' : 'Create Trade'}
        </button>
      </form>
    </div>
  );
}

// ── Trades Tables (Local) ──────────────────────────────────────────────────
function LocalTrades({ trades }) {
  const addToast = useAppStore(s => s.addToast);
  const queryClient = useQueryClient();

  const closeTrade = useMutation({
    mutationFn: ({ id, exit_price }) => put(`/api/paper/trades/${id}/close`, {
      exit_price,
      exit_date: new Date().toISOString().split('T')[0],
      exit_reason: 'manual',
    }),
    onSuccess: (data) => {
      addToast(`Trade closed — P&L ${data?.pnl_pct >= 0 ? '+' : ''}${data?.pnl_pct?.toFixed(2)}%`, 'success');
      queryClient.invalidateQueries({ queryKey: ['paper-positions'] });
      queryClient.invalidateQueries({ queryKey: ['paper-orders'] });
    },
    onError: (err) => addToast(err.message, 'error'),
  });

  const openTrades = (trades || []).filter(t => t.status === 'open');
  const closedTrades = (trades || []).filter(t => t.status === 'closed');

  return (
    <>
      <LocalStatsBar openTrades={openTrades} closedTrades={closedTrades} />

      <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem', overflowX: 'auto' }}>
        <h3 style={{ margin: '0 0 1rem' }}>Open Trades</h3>
        {openTrades.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No open trades</p>
        ) : (
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr><th>ID</th><th>Symbol</th><th>Dir</th><th>Entry</th><th>Date</th><th>Signal</th><th></th></tr>
            </thead>
            <tbody>
              {openTrades.map(t => (
                <tr key={t.id}>
                  <td>{t.id}</td>
                  <td style={{ fontWeight: 600 }}>{t.symbol}</td>
                  <td><span className={`badge badge-${t.direction === 'short' ? 'bearish' : 'bullish'}`}>{t.direction === 'short' ? 'S' : 'L'}</span></td>
                  <td>{formatPrice(t.entry_price)}</td>
                  <td>{t.entry_date}</td>
                  <td>{t.signal_name || '—'}</td>
                  <td>
                    <button className="btn btn-sm btn-danger" onClick={() => {
                      const exit = prompt('Exit price:');
                      if (exit && !isNaN(parseFloat(exit))) closeTrade.mutate({ id: t.id, exit_price: parseFloat(exit) });
                    }}>Close</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem', overflowX: 'auto' }}>
        <h3 style={{ margin: '0 0 1rem' }}>Closed Trades</h3>
        {closedTrades.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No closed trades yet</p>
        ) : (
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr><th>Symbol</th><th>Dir</th><th>Entry</th><th>Exit</th><th>P&L</th><th>Reason</th></tr>
            </thead>
            <tbody>
              {closedTrades.map(t => {
                const pnl = parseFloat(t.pnl_pct) || 0;
                return (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>{t.symbol}</td>
                    <td><span className={`badge badge-${t.direction === 'short' ? 'bearish' : 'bullish'}`}>{t.direction === 'short' ? 'S' : 'L'}</span></td>
                    <td>{formatPrice(t.entry_price)} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{t.entry_date}</span></td>
                    <td>{formatPrice(t.exit_price)} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{t.exit_date}</span></td>
                    <td style={{ color: pnl >= 0 ? 'var(--bullish)' : 'var(--bearish)', fontWeight: 600 }}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%</td>
                    <td>{t.exit_reason || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ── Local Fallback Page ────────────────────────────────────────────────────
function LocalFallbackPage() {
  const { data: positions, isLoading } = usePaperPositions();
  const queryClient = useQueryClient();

  const refreshAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['paper-positions'] });
  }, [queryClient]);

  return (
    <div>
      <div className="card" style={{ padding: '1rem 1.5rem', marginBottom: '1rem', borderLeft: '3px solid var(--warning)' }}>
        <strong>Local Mode</strong> — Alpaca API not connected. Add <code>ALPACA_API_KEY</code> and <code>ALPACA_SECRET_KEY</code> to <code>.env</code> and restart for full paper trading.
      </div>
      <LocalOrderForm onSubmitted={refreshAll} />
      {isLoading ? <LoadingSkeleton type="table" /> : <LocalTrades trades={positions} />}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function PaperTradingPage() {
  const { data: config, isLoading: configLoading } = useConfig();
  const isAlpaca = config?.alpaca_connected;
  const [activeTab, setActiveTab] = useState('dashboard');
  const [lastSync, setLastSync] = useState(null);
  const queryClient = useQueryClient();

  const refreshAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['paper-account'] });
    queryClient.invalidateQueries({ queryKey: ['paper-positions'] });
    queryClient.invalidateQueries({ queryKey: ['paper-orders'] });
    queryClient.invalidateQueries({ queryKey: ['paper-orders-full'] });
    queryClient.invalidateQueries({ queryKey: ['paper-activities'] });
    queryClient.invalidateQueries({ queryKey: ['paper-configurations'] });
    queryClient.invalidateQueries({ queryKey: ['portfolio-history'] });
    setLastSync(new Date());
  }, [queryClient]);

  if (configLoading) return <div className="page-content"><LoadingSkeleton type="card" /></div>;

  const renderTab = () => {
    if (!isAlpaca) return <LocalFallbackPage />;
    switch (activeTab) {
      case 'dashboard': return <PaperDashboardTab />;
      case 'positions': return <div className="card" style={{ padding: '1.5rem' }}><PositionsTab /></div>;
      case 'orders': return <div className="card" style={{ padding: '1.5rem' }}><OrdersTab /></div>;
      case 'balances': return <div className="card" style={{ padding: '1.5rem' }}><BalancesTab /></div>;
      case 'configure': return <div className="card" style={{ padding: '1.5rem' }}><ConfigureTab /></div>;
      default: return <PaperDashboardTab />;
    }
  };

  return (
    <div className="page-content">
      <PageHeader title="Paper Trading">
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <a
            href="https://app.alpaca.markets/paper/dashboard/overview"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            🦙 Alpaca Dashboard ↗
          </a>
          <button className="btn btn-ghost btn-sm" onClick={refreshAll}>↻ Refresh</button>
          {lastSync && (
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Synced {lastSync.toLocaleTimeString()}
            </span>
          )}
        </div>
      </PageHeader>

      {isAlpaca && (
        <div className="discover-tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`discover-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      )}

      {renderTab()}
    </div>
  );
}
