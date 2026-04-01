import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, del } from '../../api/client';
import { formatPrice, formatChange, rsiClass } from '../../utils/formatters';
import { getActionRecommendation } from '../../utils/signals';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../stores/appStore';

/* ---------- SVG Mini Sparkline (NOT TradingView) ---------- */
function MiniSparkline({ symbol }) {
  const { data } = useQuery({
    queryKey: ['sparkline', symbol],
    queryFn: () => get(`/api/stock/${symbol}?period=1mo`),
    staleTime: 10 * 60 * 1000,
  });

  if (!data?.ohlcv || data.ohlcv.length < 2) return <div className="stock-card-chart" />;

  const closes = data.ohlcv.map(c => c.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const w = 200;
  const h = 60;
  const points = closes.map((v, i) => `${(i / (closes.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  const isPositive = closes[closes.length - 1] >= closes[0];
  const color = isPositive ? '#00d4aa' : '#ff4757';

  return (
    <div className="stock-card-chart">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: 60 }}>
        <defs>
          <linearGradient id={`grad-${symbol}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,${h} ${points} ${w},${h}`} fill={`url(#grad-${symbol})`} />
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" />
      </svg>
    </div>
  );
}

/* ---------- Tag Badges ---------- */
function TagBadges({ symbol, tags, allTags, onRemoveTag, onAddTag }) {
  const assigned = tags.map(t => t.id);
  const available = allTags.filter(t => !assigned.includes(t.id));

  return (
    <>
      {tags.length > 0 && (
        <div className="tag-badges">
          {tags.map(t => (
            <span key={t.id} className="tag-badge" style={{ background: `${t.color}20`, color: t.color, border: `1px solid ${t.color}40` }}>
              {t.name}
              <button className="tag-remove" onClick={e => { e.stopPropagation(); onRemoveTag(symbol, t.id); }}>&times;</button>
            </span>
          ))}
        </div>
      )}
      {available.length > 0 && (
        <select className="tag-picker" value="" onChange={e => { e.stopPropagation(); if (e.target.value) onAddTag(symbol, parseInt(e.target.value)); e.target.value = ''; }} onClick={e => e.stopPropagation()}>
          <option value="">+ Tag</option>
          {available.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}
    </>
  );
}

export default function WatchlistWidget() {
  const [viewMode, setViewMode] = useState('cards');
  const [filterTrend, setFilterTrend] = useState('all');
  const [filterSignals, setFilterSignals] = useState('all');
  const [filterTag, setFilterTag] = useState('all');
  const [sortBy, setSortBy] = useState('symbol');
  const [sortDir, setSortDir] = useState('asc');

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useAppStore(s => s.addToast);

  const { data: watchlistData, isLoading: loadingWatchlist } = useQuery({
    queryKey: ['watchlist'],
    queryFn: () => get('/api/watchlist'),
    staleTime: 2 * 60 * 1000,
  });

  const { data: allTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: () => get('/api/tags'),
    staleTime: 5 * 60 * 1000,
  });

  // Load tags for all symbols
  const symbols = watchlistData?.symbols || [];
  const { data: symbolTagsMap = {} } = useQuery({
    queryKey: ['symbol-tags', symbols.join(',')],
    queryFn: async () => {
      const map = {};
      await Promise.all(symbols.map(async s => {
        try { map[s] = await get(`/api/watchlist/${s}/tags`); } catch { map[s] = []; }
      }));
      return map;
    },
    staleTime: 2 * 60 * 1000,
    enabled: symbols.length > 0,
  });

  const removeMutation = useMutation({
    mutationFn: (symbol) => del(`/api/watchlist/${symbol}`),
    onSuccess: (_, symbol) => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      toast(`${symbol} removed`, 'info');
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const addTagMutation = useMutation({
    mutationFn: ({ symbol, tagId }) => post(`/api/watchlist/${symbol}/tags`, { tag_id: tagId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['symbol-tags'] }),
    onError: (err) => toast(err.message, 'error'),
  });

  const removeTagMutation = useMutation({
    mutationFn: ({ symbol, tagId }) => del(`/api/watchlist/${symbol}/tags/${tagId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['symbol-tags'] }),
    onError: (err) => toast(err.message, 'error'),
  });

  const handleRemove = useCallback((symbol) => {
    if (confirm(`Remove ${symbol} from watchlist?`)) removeMutation.mutate(symbol);
  }, [removeMutation]);

  const handleAddTag = useCallback((symbol, tagId) => addTagMutation.mutate({ symbol, tagId }), [addTagMutation]);
  const handleRemoveTag = useCallback((symbol, tagId) => removeTagMutation.mutate({ symbol, tagId }), [removeTagMutation]);

  // Filter + sort
  const filteredSymbols = useMemo(() => {
    if (!watchlistData) return [];
    let syms = [...(watchlistData.symbols || [])];
    const data = watchlistData.data || {};

    if (filterTrend !== 'all') {
      syms = syms.filter(s => {
        const d = data[s];
        if (!d) return false;
        if (filterTrend === 'neutral') return !d.trend || d.trend === 'neutral';
        return d.trend === filterTrend;
      });
    }
    if (filterSignals === 'active') syms = syms.filter(s => (data[s]?.signals || []).length > 0);
    else if (filterSignals === 'none') syms = syms.filter(s => (data[s]?.signals || []).length === 0);
    if (filterTag !== 'all') {
      const tagId = parseInt(filterTag);
      syms = syms.filter(s => (symbolTagsMap[s] || []).some(t => t.id === tagId));
    }

    syms.sort((a, b) => {
      const da = data[a] || {}, db = data[b] || {};
      let valA, valB;
      switch (sortBy) {
        case 'price': valA = da.price || 0; valB = db.price || 0; break;
        case 'change_pct': valA = da.change_pct || 0; valB = db.change_pct || 0; break;
        case 'rsi': valA = da.rsi || 0; valB = db.rsi || 0; break;
        case 'adx': valA = da.adx || 0; valB = db.adx || 0; break;
        case 'signals': valA = (da.signals || []).length; valB = (db.signals || []).length; break;
        default: valA = a.toLowerCase(); valB = b.toLowerCase();
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return syms;
  }, [watchlistData, filterTrend, filterSignals, filterTag, sortBy, sortDir, symbolTagsMap]);

  if (loadingWatchlist) return <div className="loading-spinner"><div className="spinner" />Loading watchlist...</div>;

  const data = watchlistData?.data || {};

  const renderStock = (symbol) => {
    const d = data[symbol] || {};
    const changePct = d.change_pct || 0;
    const isPositive = changePct >= 0;
    const trendClass = d.trend === 'bullish' ? 'bullish' : d.trend === 'bearish' ? 'bearish' : '';
    const signalCount = (d.signals || []).length;
    const hasSignals = signalCount > 0;
    const action = getActionRecommendation(d);
    const tags = symbolTagsMap[symbol] || [];
    return { d, changePct, isPositive, trendClass, signalCount, hasSignals, action, tags };
  };

  return (
    <>
      {/* Toolbar */}
      <div className="dashboard-toolbar">
        <div className="view-toggle">
          {['cards', 'table', 'compact'].map(mode => (
            <button key={mode} className={`btn btn-ghost btn-sm view-btn ${viewMode === mode ? 'active' : ''}`} onClick={() => setViewMode(mode)} title={mode.charAt(0).toUpperCase() + mode.slice(1)}>
              {mode === 'cards' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>}
              {mode === 'table' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>}
              {mode === 'compact' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><line x1="3" y1="5" x2="21" y2="5" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="3" y1="20" x2="21" y2="20" /></svg>}
            </button>
          ))}
        </div>
        <div className="filter-bar" style={{ marginBottom: 0 }}>
          <select value={filterTrend} onChange={e => setFilterTrend(e.target.value)}>
            <option value="all">All Trends</option>
            <option value="bullish">Bullish</option>
            <option value="bearish">Bearish</option>
            <option value="neutral">Neutral</option>
          </select>
          <select value={filterSignals} onChange={e => setFilterSignals(e.target.value)}>
            <option value="all">All</option>
            <option value="active">Has Signals</option>
            <option value="none">No Signals</option>
          </select>
          <select value={filterTag} onChange={e => setFilterTag(e.target.value)}>
            <option value="all">All Tags</option>
            {allTags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="symbol">Sort: Symbol</option>
            <option value="price">Sort: Price</option>
            <option value="change_pct">Sort: Change %</option>
            <option value="rsi">Sort: RSI</option>
            <option value="adx">Sort: ADX</option>
            <option value="signals">Sort: Signals</option>
          </select>
          <button className="btn btn-ghost btn-sm" title="Toggle sort direction" onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
              {sortDir === 'asc' ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Empty states */}
      {symbols.length === 0 && (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>
          <h3>No symbols in watchlist</h3>
          <p>Click &ldquo;Add Symbol&rdquo; to start tracking stocks</p>
        </div>
      )}
      {symbols.length > 0 && filteredSymbols.length === 0 && (
        <div className="empty-state"><h3>No matches</h3><p>No symbols match the current filters</p></div>
      )}

      {/* Cards view */}
      {viewMode === 'cards' && filteredSymbols.length > 0 && (
        <div className="watchlist-grid">
          {filteredSymbols.map(symbol => {
            const { d, changePct, isPositive, trendClass, signalCount, hasSignals, action, tags } = renderStock(symbol);
            return (
              <div key={symbol} className={`stock-card ${trendClass}`} onClick={() => navigate(`/stock/${symbol}`)}>
                <button className="stock-card-delete" onClick={e => { e.stopPropagation(); handleRemove(symbol); }} title="Remove from watchlist">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
                <div className="stock-card-top">
                  <div>
                    <div className="stock-symbol">{symbol}</div>
                    <span className={`stock-change ${isPositive ? 'positive' : 'negative'}`}>{formatChange(changePct)}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="stock-price">{formatPrice(d.price)}</div>
                    <span className={`trend-badge ${trendClass}`}>{d.trend || '\u2014'}</span>
                  </div>
                </div>
                <MiniSparkline symbol={symbol} />
                <TagBadges symbol={symbol} tags={tags} allTags={allTags} onAddTag={handleAddTag} onRemoveTag={handleRemoveTag} />
                <div className="stock-card-bottom">
                  <div className="stock-indicators">
                    <div className="indicator-chip"><span className="indicator-label">RSI</span><span className={`rsi-value ${rsiClass(d.rsi)}`}>{d.rsi != null ? d.rsi.toFixed(1) : '\u2014'}</span></div>
                    <div className="indicator-chip"><span className="indicator-label">ADX</span><span className="text-mono">{d.adx != null ? d.adx.toFixed(1) : '\u2014'}</span></div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`action-badge action-badge-${action.actionClass}`}>{action.action}</span>
                    <div className="signal-indicator"><span className={`signal-dot ${hasSignals ? 'active' : 'none'}`} /><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{signalCount}</span></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table view */}
      {viewMode === 'table' && filteredSymbols.length > 0 && (
        <div className="signals-table-wrap">
          <table className="signals-table">
            <thead><tr><th>Symbol</th><th>Price</th><th>Change</th><th>Trend</th><th>Action</th><th>RSI</th><th>ADX</th><th>Signals</th><th></th></tr></thead>
            <tbody>
              {filteredSymbols.map(symbol => {
                const { d, changePct, isPositive, trendClass, signalCount, hasSignals, action } = renderStock(symbol);
                const rowClass = trendClass === 'bullish' ? 'bullish-row' : trendClass === 'bearish' ? 'bearish-row' : '';
                return (
                  <tr key={symbol} className={rowClass} style={{ cursor: 'pointer' }} onClick={() => navigate(`/stock/${symbol}`)}>
                    <td><strong>{symbol}</strong></td>
                    <td className="text-mono">{formatPrice(d.price)}</td>
                    <td className={`text-mono ${isPositive ? 'text-green' : 'text-red'}`}>{formatChange(changePct)}</td>
                    <td><span className={`trend-badge ${trendClass}`}>{d.trend || '\u2014'}</span></td>
                    <td><span className={`action-badge action-badge-${action.actionClass}`}>{action.action}</span></td>
                    <td className="text-mono"><span className={`rsi-value ${rsiClass(d.rsi)}`}>{d.rsi != null ? d.rsi.toFixed(1) : '\u2014'}</span></td>
                    <td className="text-mono">{d.adx != null ? d.adx.toFixed(1) : '\u2014'}</td>
                    <td><span className={`signal-dot ${hasSignals ? 'active' : 'none'}`} /><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{signalCount}</span></td>
                    <td>
                      <button className="stock-card-delete-inline" onClick={e => { e.stopPropagation(); handleRemove(symbol); }} title="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, opacity: 0.5 }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Compact view */}
      {viewMode === 'compact' && filteredSymbols.length > 0 && (
        <div className="watchlist-compact">
          {filteredSymbols.map(symbol => {
            const { d, changePct, isPositive, trendClass, signalCount, hasSignals, action } = renderStock(symbol);
            return (
              <div key={symbol} className="compact-card" onClick={() => navigate(`/stock/${symbol}`)}>
                <strong className="stock-symbol" style={{ minWidth: 60 }}>{symbol}</strong>
                <span className="text-mono" style={{ minWidth: 70 }}>{formatPrice(d.price)}</span>
                <span className={`text-mono ${isPositive ? 'text-green' : 'text-red'}`} style={{ minWidth: 70 }}>{formatChange(changePct)}</span>
                <span className={`trend-badge ${trendClass}`} style={{ minWidth: 60 }}>{d.trend || '\u2014'}</span>
                <span className={`action-badge action-badge-${action.actionClass}`} style={{ minWidth: 40 }}>{action.action}</span>
                <span style={{ minWidth: 50, fontSize: '0.8rem' }}><span className="indicator-label" style={{ marginRight: 4 }}>RSI</span><span className={`rsi-value ${rsiClass(d.rsi)}`}>{d.rsi != null ? d.rsi.toFixed(1) : '\u2014'}</span></span>
                <span style={{ minWidth: 50, fontSize: '0.8rem' }}><span className="indicator-label" style={{ marginRight: 4 }}>ADX</span><span className="text-mono">{d.adx != null ? d.adx.toFixed(1) : '\u2014'}</span></span>
                <span style={{ minWidth: 30 }}><span className={`signal-dot ${hasSignals ? 'active' : 'none'}`} /> <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{signalCount}</span></span>
                <button className="stock-card-delete-inline" onClick={e => { e.stopPropagation(); handleRemove(symbol); }} title="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, opacity: 0, marginLeft: 'auto' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 12, height: 12 }}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
