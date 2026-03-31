import { useState, useCallback, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, del, put } from '../api/client';
import useConfig from '../hooks/useConfig';
import {
  usePaperAccount,
  usePaperPositions,
  usePaperOrders,
  usePortfolioHistory,
} from '../hooks/usePaperTrading';
import useWatchlist from '../hooks/useWatchlist';
import PageHeader from '../components/ui/PageHeader';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import EmptyState from '../components/ui/EmptyState';
import AreaChart from '../components/ui/AreaChart';
import { formatPrice } from '../utils/formatters';
import { useAppStore } from '../stores/appStore';

// ── Alpaca Account Bar ──────────────────────────────────────────────────────
function AccountBar({ account }) {
  if (!account) return null;
  const todayPL = Number(account.today_pl) || 0;
  const todayPLPct = Number(account.today_pl_pct) || 0;
  const plColor = todayPL >= 0 ? 'var(--bullish)' : 'var(--bearish)';

  return (
    <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', padding: '1rem 1.5rem', marginBottom: '1rem' }}>
      <StatItem label="Portfolio Value" value={formatPrice(account.portfolio_value)} />
      <StatItem label="Cash" value={formatPrice(account.cash)} />
      <StatItem label="Buying Power" value={formatPrice(account.buying_power)} />
      <StatItem label="Today P&L" value={`${todayPL >= 0 ? '+' : ''}${formatPrice(todayPL)} (${todayPLPct >= 0 ? '+' : ''}${todayPLPct.toFixed(2)}%)`} color={plColor} />
      <StatItem label="Long Exposure" value={formatPrice(account.long_market_value)} />
      <StatItem label="Short Exposure" value={formatPrice(account.short_market_value)} />
    </div>
  );
}

function StatItem({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 600, color: color || 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

// ── Local Stats Bar ─────────────────────────────────────────────────────────
function LocalStatsBar({ openTrades, closedTrades }) {
  const wins = closedTrades.filter(t => parseFloat(t.pnl_pct) > 0).length;
  const totalPL = closedTrades.reduce((s, t) => s + (parseFloat(t.pnl_pct) || 0), 0);
  const winRate = closedTrades.length > 0 ? ((wins / closedTrades.length) * 100).toFixed(1) : '0.0';

  return (
    <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', padding: '1rem 1.5rem', marginBottom: '1rem' }}>
      <StatItem label="Open Trades" value={openTrades.length} />
      <StatItem label="Closed Trades" value={closedTrades.length} />
      <StatItem label="Win Rate" value={`${winRate}%`} />
      <StatItem label="Total P&L" value={`${totalPL >= 0 ? '+' : ''}${totalPL.toFixed(2)}%`} color={totalPL >= 0 ? 'var(--bullish)' : 'var(--bearish)'} />
    </div>
  );
}

// ── Order Form ──────────────────────────────────────────────────────────────
const labelStyle = { display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' };

function AlpacaOrderForm({ onSubmitted }) {
  const addToast = useAppStore(s => s.addToast);
  const { data: watchlist } = useWatchlist();
  const queryClient = useQueryClient();

  const [symbol, setSymbol] = useState('');
  const [side, setSide] = useState('buy');
  const [orderType, setOrderType] = useState('market');
  const [qtyMode, setQtyMode] = useState('shares');
  const [qty, setQty] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [priceLookup, setPriceLookup] = useState(null);
  const [posSize, setPosSize] = useState(null);
  const [accountSize, setAccountSize] = useState('10000');
  const [riskPct, setRiskPct] = useState('2');
  const lookupTimer = useRef(null);

  // Symbol price lookup with debounce
  useEffect(() => {
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    setPriceLookup(null);
    setPosSize(null);
    if (!symbol.trim()) return;

    lookupTimer.current = setTimeout(() => {
      const match = watchlist?.find(s => s.symbol === symbol.toUpperCase());
      if (match) {
        setPriceLookup({ price: match.price, change_pct: match.change_pct });
        post('/api/position-size', {
          symbol: symbol.toUpperCase(),
          account_size: parseFloat(accountSize) || 10000,
          risk_pct: parseFloat(riskPct) || 2,
        }).then(data => data && setPosSize(data)).catch(() => {});
      }
    }, 500);

    return () => { if (lookupTimer.current) clearTimeout(lookupTimer.current); };
  }, [symbol, watchlist, accountSize, riskPct]);

  const submitOrder = useMutation({
    mutationFn: (order) => post('/api/paper/orders', order),
    onSuccess: () => {
      addToast('Order submitted', 'success');
      setSymbol(''); setQty(''); setLimitPrice(''); setStopPrice('');
      setTakeProfit(''); setStopLoss('');
      queryClient.invalidateQueries({ queryKey: ['paper-positions'] });
      queryClient.invalidateQueries({ queryKey: ['paper-orders'] });
      queryClient.invalidateQueries({ queryKey: ['paper-account'] });
      if (onSubmitted) onSubmitted();
    },
    onError: (err) => addToast(err.message, 'error'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!symbol.trim()) { addToast('Symbol is required', 'error'); return; }
    if (!qty) { addToast('Quantity is required', 'error'); return; }

    const order = { symbol: symbol.toUpperCase(), side, order_type: orderType };

    if (qtyMode === 'shares') order.qty = parseFloat(qty);
    else order.notional = parseFloat(qty);

    if (['limit', 'stop_limit'].includes(orderType) && limitPrice) order.limit_price = limitPrice;
    if (['stop', 'stop_limit'].includes(orderType) && stopPrice) order.stop_price = stopPrice;
    if (orderType === 'bracket') {
      if (takeProfit) order.take_profit_price = takeProfit;
      if (stopLoss) order.stop_loss_price = stopLoss;
    }

    submitOrder.mutate(order);
  };

  const previewText = `${side === 'buy' ? 'Buy' : 'Sell'} ${qty || '—'} ${qtyMode === 'shares' ? 'shares' : 'dollars'} of ${symbol.toUpperCase() || '—'} (${orderType.replace('_', '-')})`;

  return (
    <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
      <h3 style={{ margin: '0 0 1rem' }}>Place Order</h3>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
        <div>
          <label style={labelStyle}>Symbol</label>
          <input className="input" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} placeholder="AAPL" />
          {priceLookup && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {formatPrice(priceLookup.price)}{' '}
              <span style={{ color: priceLookup.change_pct >= 0 ? 'var(--bullish)' : 'var(--bearish)' }}>
                ({priceLookup.change_pct >= 0 ? '+' : ''}{priceLookup.change_pct?.toFixed(2)}%)
              </span>
            </div>
          )}
        </div>
        <div>
          <label style={labelStyle}>Side</label>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button type="button" className={`btn btn-sm ${side === 'buy' ? 'btn-success' : 'btn-ghost'}`} onClick={() => setSide('buy')}>Buy</button>
            <button type="button" className={`btn btn-sm ${side === 'sell' ? 'btn-danger' : 'btn-ghost'}`} onClick={() => setSide('sell')}>Sell</button>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Order Type</label>
          <select className="input" value={orderType} onChange={e => setOrderType(e.target.value)}>
            <option value="market">Market</option>
            <option value="limit">Limit</option>
            <option value="stop">Stop</option>
            <option value="stop_limit">Stop-Limit</option>
            <option value="bracket">Bracket</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>{qtyMode === 'shares' ? 'Shares' : 'Dollars'}</label>
          <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.25rem' }}>
            <button type="button" className={`btn btn-sm ${qtyMode === 'shares' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setQtyMode('shares')}>Shares</button>
            <button type="button" className={`btn btn-sm ${qtyMode === 'dollars' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setQtyMode('dollars')}>Dollars</button>
          </div>
          <input className="input" type="number" step="any" min="0" value={qty} onChange={e => setQty(e.target.value)} placeholder={qtyMode === 'shares' ? '100' : '5000'} />
        </div>
        {['limit', 'stop_limit'].includes(orderType) && (
          <div>
            <label style={labelStyle}>Limit Price</label>
            <input className="input" type="number" step="any" min="0" value={limitPrice} onChange={e => setLimitPrice(e.target.value)} />
          </div>
        )}
        {['stop', 'stop_limit'].includes(orderType) && (
          <div>
            <label style={labelStyle}>Stop Price</label>
            <input className="input" type="number" step="any" min="0" value={stopPrice} onChange={e => setStopPrice(e.target.value)} />
          </div>
        )}
        {orderType === 'bracket' && (
          <>
            <div>
              <label style={labelStyle}>Take Profit</label>
              <input className="input" type="number" step="any" min="0" value={takeProfit} onChange={e => setTakeProfit(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Stop Loss</label>
              <input className="input" type="number" step="any" min="0" value={stopLoss} onChange={e => setStopLoss(e.target.value)} />
            </div>
          </>
        )}
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{previewText}</div>
          <button className="btn btn-primary" type="submit" disabled={submitOrder.isPending}>
            {submitOrder.isPending ? 'Submitting...' : 'Submit Order'}
          </button>
        </div>
      </form>

      {priceLookup && (
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Position Sizing</h4>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'end', marginBottom: '0.5rem' }}>
            <div>
              <label style={labelStyle}>Account $</label>
              <input className="input" type="number" style={{ width: '120px' }} value={accountSize} onChange={e => setAccountSize(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Risk %</label>
              <input className="input" type="number" step="0.5" min="0.5" max="10" style={{ width: '80px' }} value={riskPct} onChange={e => setRiskPct(e.target.value)} />
            </div>
          </div>
          {posSize && (
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
              <span><strong>Shares:</strong> {posSize.shares}</span>
              <span><strong>Stop:</strong> {formatPrice(posSize.stop_loss)}</span>
              <span><strong>Target:</strong> {formatPrice(posSize.take_profit)}</span>
              <span><strong>Risk:</strong> {formatPrice(posSize.risk_amount)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Local Order Form (simple) ──────────────────────────────────────────────
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
          <input className="input" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} placeholder="AAPL" />
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
          <input className="input" type="number" step="any" min="0" value={entryPrice} onChange={e => setEntryPrice(e.target.value)} />
        </div>
        <button className="btn btn-primary" type="submit" disabled={createTrade.isPending}>
          {createTrade.isPending ? 'Creating...' : 'Create Trade'}
        </button>
      </form>
    </div>
  );
}

// ── Positions Table (Alpaca) ────────────────────────────────────────────────
function AlpacaPositions({ positions }) {
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

  if (!positions?.length) return <EmptyState icon="📊" title="No open positions" message="Place an order to open a position" />;

  return (
    <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem', overflowX: 'auto' }}>
      <h3 style={{ margin: '0 0 1rem' }}>Open Positions</h3>
      <table className="data-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>Symbol</th><th>Qty</th><th>Avg Entry</th><th>Current</th>
            <th>Mkt Value</th><th>P&L</th><th>P&L %</th><th></th>
          </tr>
        </thead>
        <tbody>
          {positions.map(p => {
            const pl = parseFloat(p.unrealized_pl) || 0;
            const plPct = parseFloat(p.unrealized_plpc) || 0;
            return (
              <tr key={p.symbol} className={pl >= 0 ? 'bullish-row' : 'bearish-row'}>
                <td style={{ fontWeight: 600 }}>{p.symbol}</td>
                <td>{Number(p.qty) % 1 !== 0 ? Number(p.qty).toFixed(4) : Number(p.qty)}</td>
                <td>{formatPrice(p.avg_entry_price)}</td>
                <td>{formatPrice(p.current_price)}</td>
                <td>{formatPrice(p.market_value)}</td>
                <td style={{ color: pl >= 0 ? 'var(--bullish)' : 'var(--bearish)' }}>{pl >= 0 ? '+' : ''}{formatPrice(pl)}</td>
                <td style={{ color: plPct >= 0 ? 'var(--bullish)' : 'var(--bearish)' }}>{plPct >= 0 ? '+' : ''}{(plPct * 100).toFixed(2)}%</td>
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

// ── Recent Orders (Alpaca) ──────────────────────────────────────────────────
function AlpacaOrders({ orders }) {
  if (!orders?.length) return null;

  const formatType = (t) => (t || '').replace('_', '-');
  const formatTime = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem', overflowX: 'auto' }}>
      <h3 style={{ margin: '0 0 1rem' }}>Recent Orders</h3>
      <table className="data-table" style={{ width: '100%' }}>
        <thead>
          <tr><th>Symbol</th><th>Side</th><th>Type</th><th>Qty</th><th>Fill Price</th><th>Status</th><th>Submitted</th></tr>
        </thead>
        <tbody>
          {orders.slice(0, 30).map((o, i) => (
            <tr key={o.id || i}>
              <td style={{ fontWeight: 600 }}>{o.symbol}</td>
              <td><span className={`badge badge-${o.side === 'sell' ? 'bearish' : 'bullish'}`}>{o.side?.toUpperCase()}</span></td>
              <td>{formatType(o.order_type || o.type)}</td>
              <td>{o.filled_qty || o.qty}</td>
              <td>{formatPrice(o.filled_avg_price)}</td>
              <td><span className="badge">{o.status}</span></td>
              <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatTime(o.submitted_at || o.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Equity Chart ────────────────────────────────────────────────────────────
function formatEquityData(data) {
  if (!data) return [];
  if (data.timestamps && data.equity) {
    return data.timestamps.map((ts, i) => ({
      time: typeof ts === 'number' ? new Date(ts * 1000).toISOString().split('T')[0] : ts,
      value: parseFloat(data.equity[i]) || 0,
    }));
  }
  if (Array.isArray(data)) {
    return data.map(d => ({
      time: d.time || d.date,
      value: parseFloat(d.value || d.equity) || 0,
    }));
  }
  return [];
}

function EquityChartSection({ isAlpaca }) {
  const [period, setPeriod] = useState('1M');
  const { data, isLoading } = usePortfolioHistory(period);
  const periods = ['1W', '1M', '3M', '1Y'];

  const chartData = formatEquityData(data);

  if (!isAlpaca) return null;

  return (
    <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>Portfolio Equity</h3>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {periods.map(p => (
            <button key={p} className={`btn btn-sm ${period === p ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPeriod(p)}>{p}</button>
          ))}
        </div>
      </div>
      {isLoading ? <LoadingSkeleton type="chart" /> : (
        chartData.length > 0 ? (
          <AreaChart
            data={chartData}
            height={280}
            color={chartData.length > 1 && chartData[chartData.length - 1].value >= chartData[0].value ? '#00d4aa' : '#ff4757'}
          />
        ) : (
          <EmptyState icon="📈" title="No equity data" message="Start trading to see your equity curve" />
        )
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function PaperTradingPage() {
  const { data: config, isLoading: configLoading } = useConfig();
  const isAlpaca = config?.alpaca_connected;

  const { data: account, isLoading: accountLoading } = usePaperAccount();
  const { data: positions, isLoading: positionsLoading } = usePaperPositions();
  const { data: orders, isLoading: ordersLoading } = usePaperOrders();
  const queryClient = useQueryClient();

  const refreshAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['paper-account'] });
    queryClient.invalidateQueries({ queryKey: ['paper-positions'] });
    queryClient.invalidateQueries({ queryKey: ['paper-orders'] });
    queryClient.invalidateQueries({ queryKey: ['portfolio-history'] });
  }, [queryClient]);

  if (configLoading) return <div className="page-content"><LoadingSkeleton type="card" /></div>;

  return (
    <div className="page-content">
      <PageHeader title="Paper Trading">
        <button className="btn btn-ghost" onClick={refreshAll}>↻ Refresh</button>
      </PageHeader>

      {!isAlpaca && (
        <div className="card" style={{ padding: '1rem 1.5rem', marginBottom: '1rem', borderLeft: '3px solid var(--warning)' }}>
          <strong>Local Mode</strong> — Alpaca API not connected. Add <code>ALPACA_API_KEY</code> and <code>ALPACA_SECRET_KEY</code> to <code>.env</code> and restart for full paper trading.
        </div>
      )}

      {isAlpaca && (accountLoading ? <LoadingSkeleton type="metrics" /> : <AccountBar account={account} />)}

      {isAlpaca ? <AlpacaOrderForm onSubmitted={refreshAll} /> : <LocalOrderForm onSubmitted={refreshAll} />}

      {isAlpaca ? (
        positionsLoading ? <LoadingSkeleton type="table" /> : <AlpacaPositions positions={positions} />
      ) : (
        positionsLoading ? <LoadingSkeleton type="table" /> : <LocalTrades trades={positions} />
      )}

      {isAlpaca && (ordersLoading ? <LoadingSkeleton type="table" /> : <AlpacaOrders orders={orders} />)}

      <EquityChartSection isAlpaca={isAlpaca} />
    </div>
  );
}
