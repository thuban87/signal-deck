import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import WidgetGrid from '../ui/WidgetGrid';
import useGridLayout from '../../hooks/useGridLayout';
import ErrorBoundary from '../ErrorBoundary';
import useConfig from '../../hooks/useConfig';
import {
  usePaperAccount,
  usePaperPositions,
  usePaperOrders,
  usePortfolioHistory,
} from '../../hooks/usePaperTrading';
import useWatchlist from '../../hooks/useWatchlist';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import EmptyState from '../ui/EmptyState';
import AreaChart from '../ui/AreaChart';
import { formatPrice } from '../../utils/formatters';
import { useAppStore } from '../../stores/appStore';
import { useMutation } from '@tanstack/react-query';
import { post, del } from '../../api/client';
import { useRef, useEffect } from 'react';

// ── Account Metrics Widget ─────────────────────────────────────────────────
function AccountMetricsWidget() {
  const { data: account, isLoading } = usePaperAccount();
  if (isLoading) return <LoadingSkeleton type="metrics" />;
  if (!account) return <div style={{ color: 'var(--text-muted)', padding: '1rem' }}>No account data</div>;

  const todayPL = Number(account.today_pl) || 0;
  const todayPLPct = Number(account.today_pl_pct) || 0;
  const plColor = todayPL >= 0 ? 'var(--bullish)' : 'var(--bearish)';

  const stats = [
    { label: 'Portfolio Value', value: formatPrice(account.portfolio_value) },
    { label: 'Cash', value: formatPrice(account.cash) },
    { label: 'Buying Power', value: formatPrice(account.buying_power) },
    { label: 'Today P&L', value: `${todayPL >= 0 ? '+' : ''}${formatPrice(todayPL)} (${todayPLPct >= 0 ? '+' : ''}${todayPLPct.toFixed(2)}%)`, color: plColor },
    { label: 'Long Exposure', value: formatPrice(account.long_market_value) },
    { label: 'Short Exposure', value: formatPrice(account.short_market_value) },
  ];

  return (
    <div className="pt-account-bar">
      {stats.map(s => (
        <div key={s.label} className="pt-account-stat">
          <div className="pt-account-stat-label">{s.label}</div>
          <div className={`pt-account-stat-value${s.color ? (todayPL >= 0 ? ' positive' : ' negative') : ''}`} style={s.color ? { color: s.color } : undefined}>
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Place Order Widget ─────────────────────────────────────────────────────
const labelStyle = { display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' };

function PlaceOrderWidget() {
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
  const lookupTimer = useRef(null);

  useEffect(() => {
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    setPriceLookup(null);
    if (!symbol.trim()) return;

    lookupTimer.current = setTimeout(() => {
      const match = watchlist?.find(s => s.symbol === symbol.toUpperCase());
      if (match) {
        setPriceLookup({ price: match.price, change_pct: match.change_pct });
      }
    }, 500);

    return () => { if (lookupTimer.current) clearTimeout(lookupTimer.current); };
  }, [symbol, watchlist]);

  const submitOrder = useMutation({
    mutationFn: (order) => post('/api/paper/orders', order),
    onSuccess: () => {
      addToast('Order submitted', 'success');
      setSymbol(''); setQty(''); setLimitPrice(''); setStopPrice('');
      setTakeProfit(''); setStopLoss('');
      queryClient.invalidateQueries({ queryKey: ['paper-positions'] });
      queryClient.invalidateQueries({ queryKey: ['paper-orders'] });
      queryClient.invalidateQueries({ queryKey: ['paper-account'] });
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

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', padding: '0.25rem' }}>
      <div style={{ gridColumn: '1 / -1' }}>
        <label style={labelStyle}>Symbol</label>
        <input name="order-symbol" id="order-symbol" aria-label="Symbol" className="input" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} placeholder="AAPL" />
        {priceLookup && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {formatPrice(priceLookup.price)}
            <span style={{ color: priceLookup.change_pct >= 0 ? 'var(--bullish)' : 'var(--bearish)', marginLeft: '4px' }}>
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
        <label style={labelStyle}>Type</label>
        <select name="order-type" id="order-type" aria-label="Order type" className="input" value={orderType} onChange={e => setOrderType(e.target.value)} style={{ fontSize: '0.8rem' }}>
          <option value="market">Market</option>
          <option value="limit">Limit</option>
          <option value="stop">Stop</option>
          <option value="stop_limit">Stop-Limit</option>
          <option value="bracket">Bracket</option>
        </select>
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <label style={labelStyle}>{qtyMode === 'shares' ? 'Shares' : 'Dollars'}</label>
        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.25rem' }}>
          <button type="button" className={`btn btn-sm ${qtyMode === 'shares' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setQtyMode('shares')}>Shares</button>
          <button type="button" className={`btn btn-sm ${qtyMode === 'dollars' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setQtyMode('dollars')}>$</button>
        </div>
        <input name="order-qty" id="order-qty" aria-label="Quantity" className="input" type="number" step="any" min="0" value={qty} onChange={e => setQty(e.target.value)} placeholder={qtyMode === 'shares' ? '100' : '5000'} />
      </div>
      {['limit', 'stop_limit'].includes(orderType) && (
        <div><label style={labelStyle}>Limit</label><input name="order-limit-price" className="input" type="number" step="any" min="0" value={limitPrice} onChange={e => setLimitPrice(e.target.value)} /></div>
      )}
      {['stop', 'stop_limit'].includes(orderType) && (
        <div><label style={labelStyle}>Stop</label><input name="order-stop-price" className="input" type="number" step="any" min="0" value={stopPrice} onChange={e => setStopPrice(e.target.value)} /></div>
      )}
      {orderType === 'bracket' && (
        <>
          <div><label style={labelStyle}>Take Profit</label><input name="order-take-profit" className="input" type="number" step="any" min="0" value={takeProfit} onChange={e => setTakeProfit(e.target.value)} /></div>
          <div><label style={labelStyle}>Stop Loss</label><input name="order-stop-loss" className="input" type="number" step="any" min="0" value={stopLoss} onChange={e => setStopLoss(e.target.value)} /></div>
        </>
      )}
      <div style={{ gridColumn: '1 / -1' }}>
        <button className="btn btn-primary" type="submit" disabled={submitOrder.isPending} style={{ width: '100%' }}>
          {submitOrder.isPending ? 'Submitting...' : `${side === 'buy' ? 'Buy' : 'Sell'} ${symbol.toUpperCase() || '...'}`}
        </button>
      </div>
    </form>
  );
}

// ── Open Positions Widget ──────────────────────────────────────────────────
function OpenPositionsWidget() {
  const navigate = useNavigate();
  const { data: positions, isLoading } = usePaperPositions();
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
  if (!positions?.length) return <EmptyState icon="📊" title="No open positions" />;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table" style={{ width: '100%' }}>
        <thead>
          <tr><th>Symbol</th><th>Qty</th><th>Entry</th><th>Current</th><th>P&L</th><th></th></tr>
        </thead>
        <tbody>
          {positions.map(p => {
            const pl = parseFloat(p.unrealized_pl) || 0;
            const plPct = parseFloat(p.unrealized_plpc) || 0;
            return (
              <tr key={p.symbol} className={pl >= 0 ? 'bullish-row' : 'bearish-row'}>
                <td style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--accent)' }} onClick={() => navigate(`/stock/${p.symbol}`)}>{p.symbol}</td>
                <td>{Number(p.qty) % 1 !== 0 ? Number(p.qty).toFixed(4) : Number(p.qty)}</td>
                <td>{formatPrice(p.avg_entry_price)}</td>
                <td>{formatPrice(p.current_price)}</td>
                <td style={{ color: pl >= 0 ? 'var(--bullish)' : 'var(--bearish)' }}>
                  {pl >= 0 ? '+' : ''}{formatPrice(pl)} <span style={{ fontSize: '0.75rem' }}>({plPct >= 0 ? '+' : ''}{(plPct * 100).toFixed(2)}%)</span>
                </td>
                <td>
                  <button className="btn btn-sm btn-danger" onClick={() => { if (window.confirm(`Close ${p.symbol}?`)) closePosition.mutate(p.symbol); }}>×</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Recent Orders Widget ───────────────────────────────────────────────────
function RecentOrdersWidget() {
  const navigate = useNavigate();
  const { data: orders, isLoading } = usePaperOrders();

  if (isLoading) return <LoadingSkeleton type="table" />;
  if (!orders?.length) return <EmptyState icon="📋" title="No recent orders" />;

  const formatTime = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table" style={{ width: '100%' }}>
        <thead>
          <tr><th>Symbol</th><th>Side</th><th>Qty</th><th>Price</th><th>Status</th><th>Time</th></tr>
        </thead>
        <tbody>
          {orders.slice(0, 20).map((o, i) => (
            <tr key={o.id || i}>
              <td style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--accent)' }} onClick={() => navigate(`/stock/${o.symbol}`)}>{o.symbol}</td>
              <td><span className={`badge badge-${o.side === 'sell' ? 'bearish' : 'bullish'}`}>{o.side?.toUpperCase()}</span></td>
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

// ── Portfolio Equity Widget ────────────────────────────────────────────────
function EquityWidget() {
  const [period, setPeriod] = useState('1M');
  const { data, isLoading } = usePortfolioHistory(period);
  const periods = ['1W', '1M', '3M', '1Y'];

  const chartData = (() => {
    if (!data) return [];
    if (data.timestamps && data.equity) {
      return data.timestamps.map((ts, i) => ({
        time: typeof ts === 'number' ? new Date(ts * 1000).toISOString().split('T')[0] : ts,
        value: parseFloat(data.equity[i]) || 0,
      }));
    }
    if (data.points) {
      return data.points.map(p => ({
        time: typeof p.timestamp === 'number' ? new Date(p.timestamp * 1000).toISOString().split('T')[0] : p.timestamp,
        value: parseFloat(p.equity) || 0,
      }));
    }
    if (Array.isArray(data)) {
      return data.map(d => ({ time: d.time || d.date, value: parseFloat(d.value || d.equity) || 0 }));
    }
    return [];
  })();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.25rem', marginBottom: '0.5rem' }}>
        {periods.map(p => (
          <button key={p} className={`btn btn-sm ${period === p ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPeriod(p)}>{p}</button>
        ))}
      </div>
      {isLoading ? <LoadingSkeleton type="chart" /> : (
        chartData.length > 0 ? (
          <AreaChart
            data={chartData}
            height={220}
            color={chartData.length > 1 && chartData[chartData.length - 1].value >= chartData[0].value ? '#00d4aa' : '#ff4757'}
          />
        ) : (
          <EmptyState icon="📈" title="No equity data" message="Start trading to build history" />
        )
      )}
    </div>
  );
}

// ── Layout & Export ────────────────────────────────────────────────────────
const DEFAULT_LAYOUT = [
  { i: 'account-metrics', x: 0, y: 0, w: 12, h: 4, minW: 6, minH: 3 },
  { i: 'place-order',     x: 0, y: 4, w: 4, h: 10, minW: 3, minH: 6 },
  { i: 'positions',       x: 4, y: 4, w: 8, h: 6, minW: 4, minH: 4 },
  { i: 'recent-orders',   x: 4, y: 10, w: 8, h: 6, minW: 4, minH: 4 },
  { i: 'equity',          x: 0, y: 14, w: 12, h: 7, minW: 6, minH: 5 },
];

const WIDGET_MAP = {
  'account-metrics': { header: null, Content: AccountMetricsWidget, centered: true },
  'place-order':     { header: 'Place Order', Content: PlaceOrderWidget, centered: true },
  'positions':       { header: 'Open Positions', Content: OpenPositionsWidget },
  'recent-orders':   { header: 'Recent Orders', Content: RecentOrdersWidget },
  'equity':          { header: 'Portfolio Equity', Content: EquityWidget },
};

export default function PaperDashboardTab() {
  const queryClient = useQueryClient();
  const { layout, editMode, onLayoutChange, toggleEditMode, resetLayout } = useGridLayout('sd_paper_dashboard_layout', DEFAULT_LAYOUT);

  const refreshAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['paper-account'] });
    queryClient.invalidateQueries({ queryKey: ['paper-positions'] });
    queryClient.invalidateQueries({ queryKey: ['paper-orders'] });
    queryClient.invalidateQueries({ queryKey: ['portfolio-history'] });
  }, [queryClient]);

  const widgets = layout.map(item => {
    const def = WIDGET_MAP[item.i];
    if (!def) return null;
    return {
      id: item.i,
      header: def.header,
      bodyClassName: def.centered ? 'widget-body-centered' : undefined,
      content: (
        <ErrorBoundary>
          <def.Content />
        </ErrorBoundary>
      ),
    };
  }).filter(Boolean);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <button className="btn btn-ghost btn-sm" onClick={refreshAll}>↻ Refresh</button>
        <button className="btn btn-ghost btn-sm" onClick={toggleEditMode}>
          {editMode ? '✓ Done' : '⚙ Customize'}
        </button>
        {editMode && (
          <button className="btn btn-ghost btn-sm" onClick={resetLayout}>Reset Layout</button>
        )}
      </div>
      <WidgetGrid
        widgets={widgets}
        layout={layout}
        onLayoutChange={onLayoutChange}
        editMode={editMode}
      />
    </div>
  );
}
