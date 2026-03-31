import { useEffect, useRef, useCallback } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';

const defaultChartOptions = {
  layout: {
    background: { type: 'solid', color: '#1a2035' },
    textColor: '#8899b0',
    fontFamily: "'Inter', sans-serif",
    fontSize: 11,
  },
  grid: {
    vertLines: { color: 'rgba(136, 153, 176, 0.06)' },
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
    vertLine: { color: 'rgba(136, 153, 176, 0.3)', width: 1, style: 2 },
    horzLine: { color: 'rgba(136, 153, 176, 0.3)', width: 1, style: 2 },
  },
};

export default function PriceChart({
  data,
  volumeData,
  smaOverlays,
  markers,
  height = 380,
  onCrosshairMove,
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const smaSeriesRefs = useRef([]);

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      ...defaultChartOptions,
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight || height,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#00d4aa',
      downColor: '#ff4757',
      borderVisible: false,
      wickUpColor: '#00d4aa',
      wickDownColor: '#ff4757',
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    // Resize observer
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
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      smaSeriesRefs.current = [];
    };
  }, [height]);

  // Update candle data
  useEffect(() => {
    if (!candleSeriesRef.current || !data) return;
    candleSeriesRef.current.setData(data);
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [data]);

  // Update volume
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !volumeData) return;

    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.setData(volumeData);
    } else {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: 'rgba(0, 212, 170, 0.3)',
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
        priceLineVisible: false,
        lastValueVisible: false,
      });
      chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.85, bottom: 0 },
      });
      volumeSeries.setData(volumeData);
      volumeSeriesRef.current = volumeSeries;
    }
  }, [volumeData]);

  // Update SMA overlays
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    // Remove old SMA series
    smaSeriesRefs.current.forEach((s) => {
      try { chart.removeSeries(s); } catch {}
    });
    smaSeriesRefs.current = [];

    if (!smaOverlays || smaOverlays.length === 0) return;

    smaOverlays.forEach((sma) => {
      const series = chart.addSeries(LineSeries, {
        color: sma.color,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        title: sma.title || '',
      });
      series.setData(sma.data);
      smaSeriesRefs.current.push(series);
    });
  }, [smaOverlays]);

  // Update markers
  useEffect(() => {
    if (!candleSeriesRef.current || !markers) return;
    candleSeriesRef.current.setMarkers(markers);
  }, [markers]);

  // Crosshair move handler
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !onCrosshairMove) return;

    const handler = (param) => {
      onCrosshairMove(param, candleSeriesRef.current);
    };
    chart.subscribeCrosshairMove(handler);
    return () => chart.unsubscribeCrosshairMove(handler);
  }, [onCrosshairMove]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: `${height}px`, position: 'relative' }}
    />
  );
}
