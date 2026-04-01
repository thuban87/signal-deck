import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { get } from '../api/client';
import { formatChange } from '../utils/formatters';

const SOURCES = [
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'sp500', label: 'S&P 500' },
  { id: 'congress', label: 'Gov Trades' },
  { id: 'insider', label: 'Insider' },
];

const TICKER_DEFAULTS = {
  ticker_cycle_speed: 6,
  ticker_cycle_type: 'batch',
  ticker_visible_count: 3,
  ticker_default_source: 'watchlist',
};

export default function SidebarTicker() {
  const navigate = useNavigate();

  // Load settings
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => get('/api/settings'),
    staleTime: 60 * 1000,
  });

  const cycleSpeed = Number(settings?.ticker_cycle_speed) || TICKER_DEFAULTS.ticker_cycle_speed;
  const cycleType = settings?.ticker_cycle_type || TICKER_DEFAULTS.ticker_cycle_type;
  const visibleCount = Math.min(Math.max(Number(settings?.ticker_visible_count) || TICKER_DEFAULTS.ticker_visible_count, 1), 6);
  const defaultSource = settings?.ticker_default_source || TICKER_DEFAULTS.ticker_default_source;

  const [source, setSource] = useState(defaultSource);
  const [offset, setOffset] = useState(0);

  // Sync source when settings load
  useEffect(() => {
    if (settings?.ticker_default_source) setSource(settings.ticker_default_source);
  }, [settings?.ticker_default_source]);

  // Fetch watchlist data (always — default source)
  const { data: watchlist } = useQuery({
    queryKey: ['watchlist'],
    queryFn: () => get('/api/watchlist'),
    staleTime: 2 * 60 * 1000,
  });

  // Pre-fetch all sources eagerly so switching is instant
  const { data: congressData, isLoading: congressLoading } = useQuery({
    queryKey: ['discover-congress'],
    queryFn: () => get('/api/discover/congress'),
    staleTime: 5 * 60 * 1000,
  });

  const { data: insiderData, isLoading: insiderLoading } = useQuery({
    queryKey: ['discover-insider', '100000'],
    queryFn: () => get('/api/discover/insider-scan?min_value=100000'),
    staleTime: 5 * 60 * 1000,
  });

  const { data: sp500Data, isLoading: sp500Loading } = useQuery({
    queryKey: ['sidebar-sp500'],
    queryFn: async () => {
      const sectors = ['XLK','XLF','XLE','XLV','XLC','XLY','XLP','XLI','XLB','XLRE','XLU'];
      const results = await Promise.all(sectors.map(s => get(`/api/sectors/${s}/constituents`).catch(() => ({ stocks: [] }))));
      return results.flatMap(r => r.stocks || []);
    },
    staleTime: 5 * 60 * 1000,
  });

  const isSourceLoading = (source === 'sp500' && sp500Loading) ||
    (source === 'congress' && congressLoading) ||
    (source === 'insider' && insiderLoading);

  // Normalize items based on source
  const items = useMemo(() => {
    if (source === 'watchlist') {
      const syms = watchlist?.symbols || [];
      const dataMap = watchlist?.data || {};
      if (!syms.length) return [];
      return syms.map(sym => {
        const s = dataMap[sym] || {};
        return {
          symbol: sym,
          change_pct: s.change_pct,
          trend: s.trend,
          rsi: s.rsi,
          signal_count: s.signal_count || 0,
        };
      });
    }
    if (source === 'sp500') {
      if (!sp500Data?.length) return [];
      return sp500Data.map(s => ({
        symbol: s.symbol,
        change_pct: s.change_pct,
        trend: null,
        rsi: null,
        signal_count: 0,
      }));
    }
    if (source === 'congress') {
      const tickers = congressData?.summary?.popular_tickers || [];
      return tickers.slice(0, 30).map(t => ({
        symbol: t.ticker,
        change_pct: null,
        trend: null,
        rsi: null,
        signal_count: 0,
        extra: `${t.buy_count}B / ${t.sell_count}S`,
      }));
    }
    if (source === 'insider') {
      const tickers = insiderData?.summary?.tickers || [];
      return tickers.slice(0, 30).map(t => ({
        symbol: t.ticker,
        change_pct: null,
        trend: null,
        rsi: null,
        signal_count: 0,
        signal: t.signal,
        extra: `${t.buy_count}B / ${t.sell_count}S`,
      }));
    }
    return [];
  }, [source, watchlist, congressData, insiderData, sp500Data]);

  // Rotate through items
  useEffect(() => {
    if (items.length <= visibleCount) return;
    const intervalMs = cycleSpeed * 1000;
    const timer = setInterval(() => {
      setOffset(prev => {
        if (cycleType === 'batch') {
          // Swap all visible at once: 0→3→6→9...
          const next = prev + visibleCount;
          return next >= items.length ? 0 : next;
        }
        if (cycleType === 'random') {
          // Jump to a random offset
          return Math.floor(Math.random() * items.length);
        }
        // 'slide' — advance one at a time (original behavior)
        return (prev + 1) % items.length;
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [items.length, visibleCount, cycleSpeed, cycleType]);

  // Reset offset when source changes
  useEffect(() => { setOffset(0); }, [source]);

  const visibleItems = useMemo(() => {
    if (items.length === 0) return [];
    const count = Math.min(visibleCount, items.length);
    const result = [];
    for (let i = 0; i < count; i++) {
      result.push(items[(offset + i) % items.length]);
    }
    return result;
  }, [items, offset, visibleCount]);

  const cycleSource = useCallback(() => {
    const idx = SOURCES.findIndex(s => s.id === source);
    setSource(SOURCES[(idx + 1) % SOURCES.length].id);
  }, [source]);

  if (items.length === 0 && source === 'watchlist') return null;

  const currentSourceLabel = SOURCES.find(s => s.id === source)?.label || source;

  return (
    <div className="sidebar-ticker">
      <div className="sidebar-ticker-header" onClick={cycleSource} title="Click to change source">
        <span className="sidebar-ticker-label">📊 {currentSourceLabel}</span>
        <span className="sidebar-ticker-cycle">⟳</span>
      </div>
      <div className="sidebar-ticker-items">
        {visibleItems.map((item, i) => (
          <div
            key={`${item.symbol}-${i}`}
            className="sidebar-ticker-item"
            onClick={() => navigate(`/stock/${item.symbol}`)}
          >
            <div className="sidebar-ticker-row">
              <span className="sidebar-ticker-symbol">{item.symbol}</span>
              {item.change_pct != null && (
                <span className={`sidebar-ticker-change ${item.change_pct >= 0 ? 'text-green' : 'text-red'}`}>
                  {formatChange(item.change_pct)}
                </span>
              )}
            </div>
            <div className="sidebar-ticker-row">
              {item.trend && <span className={`trend-badge ${item.trend}`} style={{ fontSize: '0.6rem', padding: '1px 5px' }}>{item.trend}</span>}
              {item.signal_count > 0 && <span className="badge" style={{ fontSize: '0.6rem', padding: '1px 5px', background: 'var(--accent)', color: '#000' }}>{item.signal_count} sig</span>}
              {item.signal && <span className={`trend-badge ${item.signal}`} style={{ fontSize: '0.6rem', padding: '1px 5px' }}>{item.signal}</span>}
              {item.extra && <span className="text-muted" style={{ fontSize: '0.65rem' }}>{item.extra}</span>}
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-muted" style={{ fontSize: '0.7rem', padding: '4px 0', textAlign: 'center' }}>
            {isSourceLoading ? '⏳ Loading...' : 'No data'}
          </div>
        )}
      </div>
    </div>
  );
}
