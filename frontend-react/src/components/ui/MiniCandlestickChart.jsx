import { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries } from 'lightweight-charts';

export default function MiniCandlestickChart({ data, height = 120 }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !data?.length) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: { background: { color: 'transparent' }, textColor: '#8899b0' },
      grid: { vertLines: { visible: false }, horzLines: { color: 'rgba(136,153,176,0.06)' } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
      crosshair: { mode: 0 },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#00d4aa',
      downColor: '#ff4757',
      borderUpColor: '#00d4aa',
      borderDownColor: '#ff4757',
      wickUpColor: '#00d4aa',
      wickDownColor: '#ff4757',
    });

    series.setData(data);
    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [data, height]);

  return <div ref={containerRef} style={{ height, width: '100%' }} />;
}
