import { useEffect, useRef } from 'react';
import { createChart, AreaSeries } from 'lightweight-charts';

export default function AreaChart({ data, height = 200, color = '#00d4aa' }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight || height,
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: '#8899b0',
        fontFamily: "'Inter', sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: 'rgba(136, 153, 176, 0.06)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(136, 153, 176, 0.12)',
      },
      timeScale: {
        borderColor: 'rgba(136, 153, 176, 0.12)',
        timeVisible: false,
      },
      crosshair: {
        mode: 0,
      },
    });

    const series = chart.addSeries(AreaSeries, {
      topColor: color + '40',
      bottomColor: color + '05',
      lineColor: color,
      lineWidth: 2,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const resizeObserver = new ResizeObserver(() => {
      if (chartRef.current && containerRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight || height,
        });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [height, color]);

  // Update data
  useEffect(() => {
    if (!seriesRef.current || !data) return;
    seriesRef.current.setData(data);
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [data]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: `${height}px` }}
    />
  );
}
