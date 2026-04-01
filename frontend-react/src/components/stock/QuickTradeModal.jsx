import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { post } from '../../api/client';
import { useAppStore } from '../../stores/appStore';
import { formatPrice } from '../../utils/formatters';
import useWatchlist from '../../hooks/useWatchlist';

const labelStyle = { display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' };

export default function QuickTradeModal({ symbol, open, onClose }) {
  const addToast = useAppStore(s => s.addToast);
  const queryClient = useQueryClient();
  const { data: watchlist } = useWatchlist();
  const modalRef = useRef(null);

  const [side, setSide] = useState('buy');
  const [orderType, setOrderType] = useState('market');
  const [qtyMode, setQtyMode] = useState('shares');
  const [qty, setQty] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [stopLoss, setStopLoss] = useState('');

  const currentPrice = watchlist?.data?.[symbol]?.price;

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) onClose();
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  const submitOrder = useMutation({
    mutationFn: (order) => post('/api/paper/orders', order),
    onSuccess: () => {
      addToast(`Order placed for ${symbol}`, 'success');
      onClose();
      setQty(''); setLimitPrice(''); setStopPrice('');
      setTakeProfit(''); setStopLoss('');
      queryClient.invalidateQueries({ queryKey: ['paper-positions'] });
      queryClient.invalidateQueries({ queryKey: ['paper-orders'] });
      queryClient.invalidateQueries({ queryKey: ['paper-account'] });
    },
    onError: (err) => addToast(err.message, 'error'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!qty) { addToast('Quantity is required', 'error'); return; }

    const order = { symbol, side, order_type: orderType };
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

  if (!open) return null;

  return (
    <div className="quick-trade-overlay">
      <div className="quick-trade-modal" ref={modalRef}>
        <div className="quick-trade-header">
          <div>
            <strong>Trade {symbol}</strong>
            {currentPrice && <span className="text-muted" style={{ marginLeft: 8, fontSize: '0.85rem' }}>{formatPrice(currentPrice)}</span>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ fontSize: '1.2rem', padding: '0 6px' }}>×</button>
        </div>
        <form onSubmit={handleSubmit} className="quick-trade-form">
          <div>
            <label style={labelStyle}>Side</label>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button type="button" className={`btn btn-sm ${side === 'buy' ? 'btn-success' : 'btn-ghost'}`} onClick={() => setSide('buy')}>Buy</button>
              <button type="button" className={`btn btn-sm ${side === 'sell' ? 'btn-danger' : 'btn-ghost'}`} onClick={() => setSide('sell')}>Sell</button>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Type</label>
            <select className="input" value={orderType} onChange={e => setOrderType(e.target.value)} style={{ fontSize: '0.8rem' }}>
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
            <input className="input" type="number" step="any" min="0" value={qty} onChange={e => setQty(e.target.value)} placeholder={qtyMode === 'shares' ? '100' : '5000'} />
          </div>
          {['limit', 'stop_limit'].includes(orderType) && (
            <div><label style={labelStyle}>Limit</label><input className="input" type="number" step="any" min="0" value={limitPrice} onChange={e => setLimitPrice(e.target.value)} /></div>
          )}
          {['stop', 'stop_limit'].includes(orderType) && (
            <div><label style={labelStyle}>Stop</label><input className="input" type="number" step="any" min="0" value={stopPrice} onChange={e => setStopPrice(e.target.value)} /></div>
          )}
          {orderType === 'bracket' && (
            <>
              <div><label style={labelStyle}>Take Profit</label><input className="input" type="number" step="any" min="0" value={takeProfit} onChange={e => setTakeProfit(e.target.value)} /></div>
              <div><label style={labelStyle}>Stop Loss</label><input className="input" type="number" step="any" min="0" value={stopLoss} onChange={e => setStopLoss(e.target.value)} /></div>
            </>
          )}
          <div style={{ gridColumn: '1 / -1' }}>
            <button className="btn btn-primary" type="submit" disabled={submitOrder.isPending} style={{ width: '100%' }}>
              {submitOrder.isPending ? 'Submitting...' : `${side === 'buy' ? 'Buy' : 'Sell'} ${symbol}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
