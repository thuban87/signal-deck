import { useEffect, useRef, useCallback, useState } from 'react';
import { createChart } from 'lightweight-charts';

export default function StockPriceChart({ data, onDatePick }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [pickMode, setPickMode] = useState(null);

  const handleChartClick = useCallback((param) => {
    if (!pickMode || !param.time) return;
    const dateStr = typeof param.time === 'string' ? param.time : `${param.time.year}-${String(param.time.month).padStart(2,'0')}-${String(param.time.day).padStart(2,'0')}`;
    onDatePick?.(pickMode, dateStr);
    setPickMode(null);
  }, [pickMode, onDatePick]);

  useEffect(() => {
    if (!containerRef.current || !data?.ohlcv) return;

    const chart = createChart(containerRef.current, {
      layout: { background: { type: 'solid', color: '#1a2035' }, textColor: '#8899b0' },
      grid: { vertLines: { color: '#1e2a42' }, horzLines: { color: '#1e2a42' } },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: '#2a3a5c' },
      timeScale: { borderColor: '#2a3a5c', timeVisible: false },
    });
    chartRef.current = chart;

    // Candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#00d4aa', downColor: '#ff4757',
      borderUpColor: '#00d4aa', borderDownColor: '#ff4757',
      wickUpColor: '#00d4aa', wickDownColor: '#ff4757',
    });
    candleSeries.setData(data.ohlcv.map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })));

    // Volume
    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a', priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volumeSeries.setData(data.ohlcv.map(c => ({ time: c.time, value: c.volume, color: c.close >= c.open ? '#00d4aa40' : '#ff475740' })));

    // SMA overlays from summary
    if (data.summary) {
      if (data.summary.sma20_series) {
        const sma20 = chart.addLineSeries({ color: '#2196F3', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        sma20.setData(data.summary.sma20_series.map(p => ({ time: p.time, value: p.value })));
      }
      if (data.summary.sma50_series) {
        const sma50 = chart.addLineSeries({ color: '#9C27B0', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        sma50.setData(data.summary.sma50_series.map(p => ({ time: p.time, value: p.value })));
      }
      if (data.summary.bb_upper_series) {
        const bbUp = chart.addLineSeries({ color: '#FFD700', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
        bbUp.setData(data.summary.bb_upper_series.map(p => ({ time: p.time, value: p.value })));
      }
      if (data.summary.bb_lower_series) {
        const bbLow = chart.addLineSeries({ color: '#FFD700', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
        bbLow.setData(data.summary.bb_lower_series.map(p => ({ time: p.time, value: p.value })));
      }
    }

    chart.timeScale().fitContent();

    // Crosshair tooltip
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        setTooltip(null);
        return;
      }
      const cd = param.seriesData.get(candleSeries);
      const vd = param.seriesData.get(volumeSeries);
      if (cd) {
        const change = cd.close - cd.open;
        const changePct = cd.open !== 0 ? (change / cd.open) * 100 : 0;
        setTooltip({ open: cd.open, high: cd.high, low: cd.low, close: cd.close, volume: vd?.value, change, changePct });
      }
    });

    // Click for date picking
    chart.subscribeClick(handleChartClick);

    // Resize
    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [data, handleChartClick]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 300 }}>
      {pickMode && (
        <div className="chart-pick-banner" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, background: 'var(--primary)', color: '#fff', padding: '6px 12px', fontSize: '0.85rem', textAlign: 'center', borderRadius: '4px 4px 0 0' }}>
          Click the chart to pick {pickMode === 'entry' ? 'buy' : 'sell'} date
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 12, color: '#fff' }} onClick={() => setPickMode(null)}>Cancel</button>
        </div>
      )}
      {tooltip && (
        <div className="chart-tooltip" style={{ position: 'absolute', top: 8, left: 8, zIndex: 9, background: 'rgba(26,32,53,0.92)', padding: '6px 10px', borderRadius: 6, fontSize: '0.78rem', color: '#e0e6f0', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          <span>O: {tooltip.open?.toFixed(2)}</span>{' '}
          <span>H: {tooltip.high?.toFixed(2)}</span>{' '}
          <span>L: {tooltip.low?.toFixed(2)}</span>{' '}
          <span>C: {tooltip.close?.toFixed(2)}</span>{' '}
          {tooltip.volume != null && <span>V: {(tooltip.volume / 1e6).toFixed(1)}M</span>}
          {tooltip.change != null && (
            <span style={{ color: tooltip.change >= 0 ? '#00d4aa' : '#ff4757', marginLeft: 8 }}>
              {tooltip.change >= 0 ? '+' : ''}{tooltip.change.toFixed(2)} ({tooltip.changePct.toFixed(2)}%)
            </span>
          )}
        </div>
      )}
      <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 300 }} />
      {onDatePick && (
        <div style={{ display: 'flex', gap: 8, padding: '4px 0' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setPickMode('entry')} title="Pick buy date from chart">{'\uD83D\uDCC5'} Pick Buy Date</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setPickMode('exit')} title="Pick sell date from chart">{'\uD83D\uDCC5'} Pick Sell Date</button>
        </div>
      )}
    </div>
  );
}
