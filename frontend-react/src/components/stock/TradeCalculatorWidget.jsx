import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { post } from '../../api/client';
import { formatPrice } from '../../utils/formatters';
import { calculateAnnualizedReturn } from '../../utils/calculations';
import { useAppStore } from '../../stores/appStore';
import { createChart, CandlestickSeries, createSeriesMarkers } from 'lightweight-charts';
import useLocalStorage from '../../hooks/useLocalStorage';

export default function TradeCalculatorWidget({ symbol, entryDate, exitDate, onEntryDate, onExitDate }) {
  const [amount, setAmount] = useState(10000);
  const [amountType, setAmountType] = useState('dollars');
  const chartRef = useRef(null);
  const chartContainerRef = useRef(null);
  const toast = useAppStore(s => s.addToast);
  const [simulations, setSimulations] = useLocalStorage(`sd_sims_${symbol}`, []);

  // Default dates
  const today = new Date().toISOString().slice(0, 10);
  const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const [localEntry, setLocalEntry] = useState(entryDate || yearAgo);
  const [localExit, setLocalExit] = useState(exitDate || today);

  useEffect(() => { if (entryDate) setLocalEntry(entryDate); }, [entryDate]);
  useEffect(() => { if (exitDate) setLocalExit(exitDate); }, [exitDate]);

  const { mutate, data: result, isPending } = useMutation({
    mutationFn: () => post('/api/calculator/trade', {
      symbol,
      entry_date: localEntry,
      exit_date: localExit,
      amount,
      amount_type: amountType,
    }),
    onSuccess: (data) => {
      // Save simulation
      const sim = { ...data, entry_date: localEntry, exit_date: localExit, amount, amount_type: amountType, timestamp: new Date().toISOString() };
      setSimulations(prev => [sim, ...(prev || [])].slice(0, 20));
      // Render chart
      renderChart(data);
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const renderChart = (data) => {
    if (!chartContainerRef.current || !data?.ohlcv) return;
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 200,
      layout: { background: { type: 'solid', color: '#1a2035' }, textColor: '#8899b0' },
      grid: { vertLines: { color: '#1e2a42' }, horzLines: { color: '#1e2a42' } },
      rightPriceScale: { borderColor: '#2a3a5c' },
      timeScale: { borderColor: '#2a3a5c' },
    });
    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#00d4aa', downColor: '#ff4757',
      borderUpColor: '#00d4aa', borderDownColor: '#ff4757',
      wickUpColor: '#00d4aa', wickDownColor: '#ff4757',
    });
    series.setData(data.ohlcv.map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })));

    // Add markers
    const markers = [];
    if (data.actual_entry_date || data.entry_date) markers.push({ time: data.actual_entry_date || data.entry_date, position: 'belowBar', color: '#00d4aa', shape: 'arrowUp', text: 'BUY' });
    if (data.actual_exit_date || data.exit_date) markers.push({ time: data.actual_exit_date || data.exit_date, position: 'aboveBar', color: '#ff4757', shape: 'arrowDown', text: 'SELL' });
    if (markers.length) createSeriesMarkers(series, markers);
    chart.timeScale().fitContent();
  };

  useEffect(() => {
    return () => { if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; } };
  }, []);

  const pnl = result?.pnl_dollars ?? result?.pnl ?? null;
  const returnPct = result?.pnl_pct ?? result?.return_pct ?? null;
  const annualized = result?.annualized_return ?? (returnPct != null ? calculateAnnualizedReturn(returnPct, result.days_held) : null);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'flex-end' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: '0.75rem' }}>Buy Date</label>
          <input type="date" value={localEntry} onChange={e => { setLocalEntry(e.target.value); onEntryDate?.(e.target.value); }} min={yearAgo} max={today} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: '0.75rem' }}>Sell Date</label>
          <input type="date" value={localExit} onChange={e => { setLocalExit(e.target.value); onExitDate?.(e.target.value); }} min={yearAgo} max={today} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: '0.75rem' }}>Amount</label>
          <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} style={{ width: 100 }} />
        </div>
        <select value={amountType} onChange={e => setAmountType(e.target.value)} style={{ height: 34 }}>
          <option value="dollars">Dollars</option>
          <option value="shares">Shares</option>
        </select>
        <button className="btn btn-primary btn-sm" onClick={() => mutate()} disabled={isPending}>{isPending ? 'Running...' : 'Calculate'}</button>
      </div>

      {result && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, fontSize: '0.82rem', marginBottom: 12 }}>
          {[
            ['Entry', formatPrice(result.entry_price)],
            ['Exit', formatPrice(result.exit_price)],
            ['Shares', result.shares?.toFixed(2)],
            ['P&L', <span key="pnl" className={pnl >= 0 ? 'text-green' : 'text-red'}>{pnl >= 0 ? '+' : ''}{formatPrice(pnl)}</span>],
            ['Return', <span key="ret" className={returnPct >= 0 ? 'text-green' : 'text-red'}>{returnPct >= 0 ? '+' : ''}{returnPct?.toFixed(2)}%</span>],
            ['Days', result.days_held],
            ['Annualized', annualized != null ? `${annualized >= 0 ? '+' : ''}${annualized.toFixed(1)}%` : '\u2014'],
          ].map(([label, value]) => (
            <div key={label} className="indicator-card" style={{ padding: 6, textAlign: 'center' }}>
              <div className="indicator-label" style={{ fontSize: '0.7rem' }}>{label}</div>
              <div className="text-mono" style={{ fontWeight: 600 }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      <div ref={chartContainerRef} style={{ width: '100%', height: 200, borderRadius: 4 }} />
    </div>
  );
}
