import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../api/client';
import PageHeader from '../components/ui/PageHeader';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import EmptyState from '../components/ui/EmptyState';
import { formatPrice, formatNumber, formatChange } from '../utils/formatters';
import { useAppStore } from '../stores/appStore';
import MiniCandlestickChart from '../components/ui/MiniCandlestickChart';

const TABS = [
  { id: 'matchmaker', label: '💘 Matchmaker' },
  { id: 'industries', label: '🏭 Industries' },
  { id: 'congress', label: '🏛️ Government' },
  { id: 'insider', label: '👤 Insider' },
  { id: 'social', label: '📱 Social' },
  { id: 'options', label: '📊 Options' },
];

// ── Matchmaker Tab ──────────────────────────────────────────────────────────
function MatchmakerTab() {
  const addToast = useAppStore(s => s.addToast);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sources, setSources] = useState(['sp500']);
  const [candidates, setCandidates] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cardLoading, setCardLoading] = useState(false);
  const cardRef = useRef(null);
  const touchStart = useRef(null);

  const toggleSource = (src) => {
    setSources(prev => prev.includes(src) ? prev.filter(s => s !== src) : [...prev, src]);
  };

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await get(`/api/discover/matchmaker/candidates?sources=${sources.join(',')}&limit=50`);
      setCandidates(data?.candidates || []);
      setCurrentIndex(0);
      setCard(null);
    } catch { addToast('Failed to load candidates', 'error'); }
    setLoading(false);
  }, [sources, addToast]);

  const loadCard = useCallback(async (symbol) => {
    setCardLoading(true);
    try {
      const data = await get(`/api/discover/matchmaker/card/${encodeURIComponent(symbol)}`);
      setCard(data);
    } catch { setCard(null); }
    setCardLoading(false);
  }, []);

  useEffect(() => {
    if (candidates.length > 0 && currentIndex < candidates.length) {
      loadCard(candidates[currentIndex]);
    }
  }, [candidates, currentIndex, loadCard]);

  // Auto-load on first mount
  const hasAutoLoaded = useRef(false);
  useEffect(() => {
    if (!hasAutoLoaded.current && sources.length > 0) {
      hasAutoLoaded.current = true;
      loadCandidates();
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const swipe = useCallback(async (action) => {
    if (!card) return;
    try {
      await post('/api/discover/matchmaker/swipe', { ticker: card.symbol, action });
      if (action === 'watchlisted') {
        addToast(`${card.symbol} added to watchlist`, 'success');
        queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      }
    } catch {}
    setCurrentIndex(i => i + 1);
  }, [card, addToast, queryClient]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowLeft') swipe('dismissed');
      else if (e.key === 'ArrowRight') swipe('watchlisted');
      else if (e.key === 'ArrowDown' && card) navigate(`/stock/${card.symbol}`);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [swipe, card, navigate]);

  // Touch swipe
  const onTouchStart = (e) => { touchStart.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStart.current == null) return;
    const diff = e.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(diff) > 100) {
      swipe(diff > 0 ? 'watchlisted' : 'dismissed');
    }
    touchStart.current = null;
  };

  const allSources = [
    { id: 'sp500', label: 'S&P 500' },
    { id: 'industries', label: 'Industries' },
    { id: 'congress', label: 'Government' },
    { id: 'insider', label: 'Insider' },
    { id: 'social', label: 'Social' },
    { id: 'options', label: 'Options' },
  ];

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      {/* Source Selection */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
        {allSources.map(s => (
          <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={sources.includes(s.id)} onChange={() => toggleSource(s.id)} />{s.label}
          </label>
        ))}
        <button className="btn btn-primary btn-sm" onClick={loadCandidates} disabled={loading || sources.length === 0}>
          {loading ? 'Loading...' : 'Load Candidates'}
        </button>
      </div>

      {/* Card */}
      {candidates.length === 0 && !loading ? (
        <EmptyState icon="💘" title="Tinder for Stocks" message="Select sources and load candidates to start swiping" />
      ) : currentIndex >= candidates.length ? (
        <EmptyState icon="✅" title="All done!" message="You've reviewed all candidates. Load more or change sources." />
      ) : cardLoading ? (
        <LoadingSkeleton type="card" />
      ) : card ? (
        <div className="matchmaker-card-area">
          <div ref={cardRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="matchmaker-card">
            {/* Info section */}
            <div className="matchmaker-card-section matchmaker-card-info">
              <div className="matchmaker-card-header">
                <div>
                  <span className="matchmaker-symbol">{card.symbol}</span>
                  <span className="matchmaker-name">{card.name}</span>
                </div>
                <span className={`trend-badge ${card.trend || ''}`}>{card.trend || 'N/A'}</span>
              </div>
              <div className="matchmaker-card-meta">
                <span>{card.sector || 'N/A'}</span>
                <span className="text-muted">•</span>
                <span>{card.industry || 'N/A'}</span>
                {card.market_cap && <>
                  <span className="text-muted">•</span>
                  <span>Mkt Cap: {formatNumber(card.market_cap)}</span>
                </>}
              </div>
            </div>

            {/* Market section with chart */}
            <div className="matchmaker-card-section matchmaker-card-market">
              <div className="matchmaker-card-price-row">
                <div>
                  <span className="matchmaker-price">{formatPrice(card.price)}</span>
                  <span className={`matchmaker-change ${(card.change_pct || 0) >= 0 ? 'text-green' : 'text-red'}`}>
                    {(card.change_pct || 0) >= 0 ? '+' : ''}{card.change_pct?.toFixed(2)}%
                  </span>
                </div>
                {card.month_return != null && (
                  <div className="matchmaker-month-return">
                    <span className="text-muted">1mo return:</span>
                    <span className={card.month_return >= 0 ? 'text-green' : 'text-red'}>
                      {card.month_return >= 0 ? '+' : ''}{card.month_return.toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>
              {card.chart?.length > 0 && (
                <div className="matchmaker-chart">
                  <MiniCandlestickChart data={card.chart} height={120} />
                </div>
              )}
            </div>

            {/* Advanced Metrics section */}
            <div className="matchmaker-card-section matchmaker-card-advanced">
              <div className="matchmaker-card-section-header">Advanced Metrics</div>
              <div className="matchmaker-metrics-grid">
                {[
                  { label: 'RSI', value: card.rsi?.toFixed(1), className: `rsi-value ${card.rsi < 30 ? 'oversold' : card.rsi > 70 ? 'overbought' : 'neutral'}` },
                  { label: 'ADX', value: card.adx?.toFixed(1) },
                  { label: 'P/E', value: card.pe_ratio?.toFixed(1) },
                  { label: 'Fwd P/E', value: card.forward_pe?.toFixed(1) },
                  { label: 'EPS', value: card.eps != null ? `$${card.eps.toFixed(2)}` : null },
                  { label: 'Beta', value: card.beta?.toFixed(2) },
                  { label: 'Div Yield', value: card.dividend_yield != null ? `${(card.dividend_yield * 100).toFixed(2)}%` : null },
                  { label: 'MACD', value: card.macd?.toFixed(2), className: card.macd > 0 ? 'text-green' : card.macd < 0 ? 'text-red' : '' },
                ].map(m => (
                  <div key={m.label} className="matchmaker-metric">
                    <span className="matchmaker-metric-label">{m.label}</span>
                    <span className={`matchmaker-metric-value ${m.className || ''}`}>{m.value ?? 'N/A'}</span>
                  </div>
                ))}
              </div>

              {/* Signals */}
              {card.signals?.length > 0 && (
                <div className="matchmaker-signals">
                  {card.signals.map((s, i) => (
                    <span key={i} className={`trend-badge ${s.toLowerCase().includes('bearish') ? 'bearish' : 'bullish'}`}>{s}</span>
                  ))}
                </div>
              )}

              {/* 52-week range */}
              {(card.fifty_two_week_low != null || card.fifty_two_week_high != null) && (
                <div className="matchmaker-52w">
                  <span className="text-muted">52w: </span>
                  <span className="text-red">{card.fifty_two_week_low != null ? `$${card.fifty_two_week_low.toFixed(2)}` : '?'}</span>
                  <span className="text-muted"> — </span>
                  <span className="text-green">{card.fifty_two_week_high != null ? `$${card.fifty_two_week_high.toFixed(2)}` : '?'}</span>
                </div>
              )}
            </div>

            {/* Progress + Action Buttons */}
            <div className="matchmaker-card-section" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>{currentIndex + 1} / {candidates.length}</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                <button className="btn btn-danger" onClick={() => swipe('dismissed')} title="Pass (←)" style={{ width: 56, height: 56, borderRadius: '50%', fontSize: '1.2rem' }}>✕</button>
                <button className="btn btn-ghost" onClick={() => navigate(`/stock/${card.symbol}`)} title="Detail (↓)" style={{ width: 56, height: 56, borderRadius: '50%', fontSize: '1.2rem' }}>🔍</button>
                <button className="btn btn-success" onClick={() => swipe('watchlisted')} title="Watchlist (→)" style={{ width: 56, height: 56, borderRadius: '50%', fontSize: '1.2rem' }}>♥</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Government Tab ──────────────────────────────────────────────────────────
function GovernmentTab() {
  const navigate = useNavigate();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['discover-congress'],
    queryFn: () => get('/api/discover/congress'),
    staleTime: 5 * 60 * 1000,
  });

  const partyBadge = (p) => {
    const colors = { R: '#ff4757', D: '#3742fa', I: '#ffa502' };
    return <span style={{ background: colors[p] || 'var(--bg-hover)', color: 'white', padding: '1px 6px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600 }}>{p}</span>;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => refetch()}>↻ Refresh</button>
      </div>

      {isLoading ? <LoadingSkeleton type="card" /> : !data?.trades?.length ? (
        <EmptyState icon="🏛️" title="No data" message="Congress trading data unavailable" />
      ) : (
        <>
          {/* Popular tickers */}
          {data.summary?.popular_tickers?.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ margin: '0 0 0.75rem' }}>Most Traded by Politicians</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
                {data.summary.popular_tickers.slice(0, 10).map(t => (
                  <div key={t.ticker} className="card" style={{ padding: '1rem', cursor: 'pointer', textAlign: 'center', borderTop: '3px solid var(--blue)' }} onClick={() => navigate(`/stock/${t.ticker}`)}>
                    <div style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: '0.35rem' }}>{t.ticker}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      <span style={{ color: 'var(--green)' }}>{t.buy_count} {t.buy_count === 1 ? 'buy' : 'buys'}</span>
                      {' · '}
                      <span style={{ color: 'var(--red)' }}>{t.sell_count} {t.sell_count === 1 ? 'sell' : 'sells'}</span>
                      <br />
                      <span>{t.politician_count} politician{t.politician_count !== 1 ? 's' : ''}</span>
                    </div>
                    {t.parties && <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center', marginTop: '0.4rem' }}>{t.parties.map(p => <span key={p}>{partyBadge(p)}</span>)}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trade table */}
          <div className="card" style={{ padding: '1.5rem', overflowX: 'auto' }}>
            <h3 style={{ margin: '0 0 1rem' }}>Trade Feed</h3>
            <table className="data-table" style={{ width: '100%' }}>
              <thead><tr><th>Date</th><th>Politician</th><th>Party</th><th>Ticker</th><th>Type</th><th>Amount</th></tr></thead>
              <tbody>
                {data.trades.slice(0, 100).map((t, i) => {
                  const isSale = /sell|sale/i.test(t.trade_type || '');
                  return (
                    <tr key={i} style={{ borderLeft: `3px solid ${isSale ? 'var(--red)' : 'var(--green)'}` }}>
                      <td>{t.trade_date || t.disclosure_date}</td>
                      <td>{t.politician} <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>({t.chamber})</span></td>
                      <td>{partyBadge(t.party)}</td>
                      <td style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--accent)' }} onClick={() => navigate(`/stock/${t.ticker}`)}>{t.ticker}</td>
                      <td><span className={`badge badge-${isSale ? 'bearish' : 'bullish'}`} style={{ color: isSale ? 'var(--red)' : 'var(--green)' }}>{t.trade_type}</span></td>
                      <td style={{ fontSize: '0.8rem' }}>{t.amount_range}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Insider Tab ─────────────────────────────────────────────────────────────
function InsiderTab() {
  const navigate = useNavigate();
  const [minValue, setMinValue] = useState('100000');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['discover-insider', minValue],
    queryFn: () => get(`/api/discover/insider-scan?min_value=${minValue}`),
    staleTime: 5 * 60 * 1000,
  });

  const sigColor = (s) => s === 'bullish' ? 'var(--bullish)' : s === 'bearish' ? 'var(--bearish)' : 'var(--text-muted)';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>Market-Wide Insider Trading</h3>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select className="input" value={minValue} onChange={e => setMinValue(e.target.value)} style={{ width: 'auto' }}>
            <option value="100000">$100K+</option>
            <option value="500000">$500K+</option>
            <option value="1000000">$1M+</option>
          </select>
          <button className="btn btn-primary btn-sm" onClick={() => refetch()}>🔍 Scan</button>
        </div>
      </div>

      {isLoading ? <LoadingSkeleton type="card" /> : !data?.summary?.tickers?.length ? (
        <EmptyState icon="👤" title="No insider activity" message="Try a lower minimum value" />
      ) : (
        <>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span>Trades: {data.summary.total_trades}</span>
            <span>Tickers: {data.summary.unique_tickers}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
            {data.summary.tickers.slice(0, 30).map(t => {
              const borderColor = t.signal === 'bullish' ? 'var(--green)' : t.signal === 'bearish' ? 'var(--red)' : 'var(--border)';
              return (
                <div key={t.ticker} className="card" style={{ padding: '1rem', cursor: 'pointer', borderLeft: `3px solid ${borderColor}` }} onClick={() => navigate(`/stock/${t.ticker}`)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 700 }}>{t.ticker}</span>
                    <span style={{ color: sigColor(t.signal), fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem' }}>{t.signal}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <div>Buy: <span style={{ color: 'var(--green)' }}>{t.buy_count} ({formatNumber(t.total_buy_value)})</span></div>
                    <div>Sell: <span style={{ color: 'var(--red)' }}>{t.sell_count} ({formatNumber(t.total_sell_value)})</span></div>
                    <div>{t.insider_count} insiders · Latest: {t.latest_date}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Social Tab ──────────────────────────────────────────────────────────────
function SocialTab() {
  const navigate = useNavigate();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['discover-social'],
    queryFn: () => get('/api/discover/social'),
    staleTime: 5 * 60 * 1000,
  });

  const sentColor = (l) => l === 'positive' || l === 'bullish' ? 'var(--bullish)' : l === 'negative' || l === 'bearish' ? 'var(--bearish)' : 'var(--text-muted)';

  if (isLoading) return <LoadingSkeleton type="table" />;

  if (data && !data.configured) {
    return (
      <EmptyState
        icon="📱"
        title="Reddit Not Configured"
        message="Add REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET to .env to enable social momentum scanning"
      />
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Last scan: {data?.last_updated || 'Never'}</span>
        <button className="btn btn-ghost btn-sm" onClick={() => refetch()}>🔍 Scan Now</button>
      </div>

      {!data?.mentions?.length ? (
        <EmptyState icon="📱" title="No mentions" message="No trending tickers found in recent Reddit posts" />
      ) : (
        <div className="card" style={{ padding: '1.5rem', overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead><tr><th>Ticker</th><th>Mentions</th><th>Sentiment</th><th>Score</th><th>Subreddit</th><th>Posts</th></tr></thead>
            <tbody>
              {data.mentions.map((m, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--accent)' }} onClick={() => navigate(`/stock/${m.ticker}`)}>{m.ticker}</td>
                  <td>{m.mention_count}</td>
                  <td><span style={{ color: sentColor(m.sentiment_label), fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem' }}>{m.sentiment_label}</span></td>
                  <td>{m.sentiment_score?.toFixed(3)}</td>
                  <td style={{ fontSize: '0.75rem' }}>{m.subreddit}</td>
                  <td>
                    {m.sample_posts?.length > 0 && (
                      <details>
                        <summary style={{ cursor: 'pointer', fontSize: '0.75rem' }}>{m.sample_posts.length} posts</summary>
                        <div style={{ marginTop: '0.25rem' }}>
                          {m.sample_posts.map((p, j) => (
                            <div key={j} style={{ fontSize: '0.7rem', marginBottom: '0.25rem' }}>
                              <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{p.title}</a>
                              <span style={{ color: 'var(--text-muted)' }}> · r/{p.subreddit} · ↑{p.score}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Options Tab ─────────────────────────────────────────────────────────────
function OptionsTab() {
  const navigate = useNavigate();
  const [source, setSource] = useState('watchlist');
  const queryClient = useQueryClient();
  const [scanning, setScanning] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['discover-options', source],
    queryFn: () => get(`/api/discover/options-flow?source=${source}`),
    staleTime: 5 * 60 * 1000,
  });

  const handleScan = async () => {
    setScanning(true);
    try {
      await get(`/api/discover/options-flow?source=${source}&refresh=true`);
      queryClient.invalidateQueries({ queryKey: ['discover-options', source] });
    } catch {}
    setScanning(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>Unusual Options Activity</h3>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select className="input" value={source} onChange={e => setSource(e.target.value)} style={{ width: 'auto' }}>
            <option value="watchlist">Watchlist</option>
            <option value="sp500">S&amp;P 500</option>
          </select>
          <button className="btn btn-primary btn-sm" onClick={handleScan} disabled={scanning}>{scanning ? 'Scanning...' : '🔍 Scan'}</button>
          {data?.last_updated && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Last: {data.last_updated}</span>}
        </div>
      </div>

      {isLoading ? <LoadingSkeleton type="table" /> : !data?.alerts?.length ? (
        <EmptyState icon="📊" title="No unusual activity" message="No options flow alerts found" />
      ) : (
        <>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
          <div className="card" style={{ padding: '0.75rem 1rem', textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>{data.alerts.length}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Alerts</div>
          </div>
          <div className="card" style={{ padding: '0.75rem 1rem', textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>{new Set(data.alerts.map(a => a.ticker)).size}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tickers</div>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead><tr><th>Ticker</th><th>Type</th><th>Strike</th><th>Expiry</th><th>Volume</th><th>OI</th><th>Vol/OI</th><th>IV</th><th>Premium</th><th>Flags</th></tr></thead>
            <tbody>
              {data.alerts.slice(0, 100).map((a, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--accent)' }} onClick={() => navigate(`/stock/${a.ticker}`)}>{a.ticker}</td>
                  <td><span className={`badge badge-${a.option_type === 'put' ? 'bearish' : 'bullish'}`}>{(a.option_type || '').toUpperCase()}</span></td>
                  <td>{formatPrice(a.strike)}</td>
                  <td>{a.expiration}</td>
                  <td>{a.volume?.toLocaleString()}</td>
                  <td>{a.open_interest?.toLocaleString()}</td>
                  <td style={{ color: (a.vol_oi_ratio || 0) >= 500 ? '#ffa502' : 'inherit', fontWeight: (a.vol_oi_ratio || 0) >= 500 ? 600 : 400 }}>{a.vol_oi_ratio?.toFixed(0)}%</td>
                  <td>{a.implied_volatility ? `${(a.implied_volatility * 100).toFixed(0)}%` : '—'}</td>
                  <td>{a.premium_volume ? `$${(a.premium_volume / 1000).toFixed(0)}K` : '—'}</td>
                  <td>{a.flags?.map((f, j) => <span key={j} className="badge" style={{ fontSize: '0.6rem', marginRight: 2 }}>{f}</span>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}

// ── Industries Tab ───────────────────────────────────────────────────────────
function heatmapColor(changePct) {
  const clamped = Math.max(-3, Math.min(3, changePct));
  const ratio = (clamped + 3) / 6;
  if (ratio < 0.5) {
    const r = 255;
    const g = Math.round(60 + ratio * 2 * 140);
    const b = Math.round(60 + ratio * 2 * 100);
    return `rgba(${r}, ${g}, ${b}, 0.85)`;
  } else {
    const t = (ratio - 0.5) * 2;
    const r = Math.round(200 - t * 200);
    const g = Math.round(200 + t * 55);
    const b = Math.round(160 - t * 60);
    return `rgba(${r}, ${g}, ${b}, 0.85)`;
  }
}

function SectorCard({ sector, defaultExpanded }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['sector-constituents', sector.symbol],
    queryFn: () => get(`/api/sectors/${sector.symbol}/constituents`),
    staleTime: 5 * 60 * 1000,
    enabled: expanded,
  });

  const chg = sector.change_pct || 0;
  const bg = heatmapColor(chg);
  const textColor = Math.abs(chg) > 1.5 ? '#fff' : 'var(--text-primary)';

  const stocks = data?.stocks || [];
  const gainers = stocks.filter(s => s.change_pct >= 0).slice(0, 5);
  const losers = [...stocks].sort((a, b) => a.change_pct - b.change_pct).filter(s => s.change_pct < 0).slice(0, 5);

  return (
    <div className="industry-card">
      <div
        className="industry-card-header"
        style={{ background: bg, color: textColor }}
        onClick={() => setExpanded(e => !e)}
      >
        <div className="industry-card-name">{sector.name}</div>
        <div className="industry-card-change">{formatChange(chg)}</div>
        <div className="industry-card-etf">{sector.symbol}</div>
        <div className="industry-card-toggle">{expanded ? '▼' : '▶'}</div>
      </div>
      {expanded && (
        <div className="industry-card-body">
          {isLoading ? (
            <LoadingSkeleton type="table" />
          ) : stocks.length === 0 ? (
            <p className="text-muted" style={{ padding: '0.5rem' }}>No data available</p>
          ) : (
            <div className="industry-card-lists">
              <div className="industry-card-list">
                <div className="industry-list-header text-green">▲ Top Gainers</div>
                {gainers.length === 0 ? (
                  <p className="text-muted" style={{ fontSize: '0.75rem', padding: '0.25rem 0' }}>No gainers today</p>
                ) : gainers.map(s => (
                  <div key={s.symbol} className="industry-stock-row" onClick={() => navigate(`/stock/${s.symbol}`)}>
                    <span className="industry-stock-symbol">{s.symbol}</span>
                    <span className="industry-stock-name">{s.name}</span>
                    <span className="industry-stock-price">{formatPrice(s.price)}</span>
                    <span className="industry-stock-change text-green">{formatChange(s.change_pct)}</span>
                  </div>
                ))}
              </div>
              <div className="industry-card-list">
                <div className="industry-list-header text-red">▼ Top Losers</div>
                {losers.length === 0 ? (
                  <p className="text-muted" style={{ fontSize: '0.75rem', padding: '0.25rem 0' }}>No losers today</p>
                ) : losers.map(s => (
                  <div key={s.symbol} className="industry-stock-row" onClick={() => navigate(`/stock/${s.symbol}`)}>
                    <span className="industry-stock-symbol">{s.symbol}</span>
                    <span className="industry-stock-name">{s.name}</span>
                    <span className="industry-stock-price">{formatPrice(s.price)}</span>
                    <span className="industry-stock-change text-red">{formatChange(s.change_pct)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function IndustriesTab({ expandSector }) {
  const { data: sectors, isLoading } = useQuery({
    queryKey: ['sectors-performance'],
    queryFn: () => get('/api/sectors/performance'),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <LoadingSkeleton type="card" />;
  if (!sectors || sectors.length === 0) return <EmptyState icon="🏭" title="No sector data" message="Sector performance data unavailable" />;

  const sorted = [...sectors].sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0));

  return (
    <div className="industries-grid">
      {sorted.map(s => (
        <SectorCard
          key={s.symbol}
          sector={s}
          defaultExpanded={expandSector === s.symbol}
        />
      ))}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function DiscoverPage() {
  const { tab: routeTab } = useParams();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(routeTab || 'matchmaker');
  const [expandSector, setExpandSector] = useState(null);

  useEffect(() => {
    if (routeTab && TABS.some(t => t.id === routeTab)) setActiveTab(routeTab);
  }, [routeTab]);

  useEffect(() => {
    const searchStr = location.search || '';
    const params = new URLSearchParams(searchStr);
    const sector = params.get('sector');
    if (sector) {
      setActiveTab('industries');
      setExpandSector(sector.toUpperCase());
    }
  }, [location]);

  const renderTab = () => {
    switch (activeTab) {
      case 'matchmaker': return <MatchmakerTab />;
      case 'industries': return <IndustriesTab expandSector={expandSector} />;
      case 'congress': return <GovernmentTab />;
      case 'insider': return <InsiderTab />;
      case 'social': return <SocialTab />;
      case 'options': return <OptionsTab />;
      default: return <MatchmakerTab />;
    }
  };

  return (
    <div className="page-content">
      <PageHeader title="Discover" />

      {/* Tab bar */}
      <div className="discover-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`discover-tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {renderTab()}
    </div>
  );
}
