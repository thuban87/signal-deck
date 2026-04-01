import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { get } from '../api/client';
import PageHeader from '../components/ui/PageHeader';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import EmptyState from '../components/ui/EmptyState';
import { formatPrice, formatNumber } from '../utils/formatters';

// ── Autocomplete ────────────────────────────────────────────────────────────
function SymbolAutocomplete({ value, onChange, onSubmit }) {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [hlIndex, setHlIndex] = useState(-1);
  const timer = useRef(null);
  const blurTimer = useRef(null);

  useEffect(() => { setQuery(value || ''); }, [value]);

  const doSearch = useCallback((q) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const data = await get(`/api/symbols/search?q=${encodeURIComponent(q)}&limit=8`);
        setResults(data || []);
        setOpen((data || []).length > 0);
        setHlIndex(-1);
      } catch { setResults([]); }
    }, 250);
  }, []);

  const select = (sym) => { setQuery(sym); onChange(sym); setOpen(false); setResults([]); };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHlIndex(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHlIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (hlIndex >= 0 && results[hlIndex]) select(results[hlIndex].symbol); else { onChange(query.toUpperCase()); onSubmit(); } }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <input className="input" value={query} onChange={e => { setQuery(e.target.value.toUpperCase()); doSearch(e.target.value); }} onKeyDown={handleKeyDown} onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }} onFocus={() => { if (results.length) setOpen(true); }} placeholder="AAPL" style={{ width: 140 }} />
      {open && results.length > 0 && (
        <div style={dropdownStyle}>
          {results.map((r, i) => (
            <div key={r.symbol} onMouseDown={() => select(r.symbol)} style={{ ...dropdownItemStyle, background: i === hlIndex ? 'var(--bg-hover)' : undefined }}>
              <strong>{r.symbol}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{r.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sentiment Gauge ─────────────────────────────────────────────────────────
function SentimentGauge({ sentiment }) {
  if (!sentiment) return <EmptyState icon="📰" title="No news data" message="Finnhub API key may not be configured" />;

  const score = sentiment.score || 0;
  const label = sentiment.label || 'NEUTRAL';
  const position = ((score + 1) / 2) * 100;
  const labelColor = label === 'BULLISH' ? 'var(--bullish)' : label === 'BEARISH' ? 'var(--bearish)' : 'var(--text-muted)';

  return (
    <div style={{ textAlign: 'center', padding: '1rem' }}>
      <div style={{ fontSize: '2rem', fontWeight: 700, color: labelColor }}>{score.toFixed(3)}</div>
      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: labelColor, marginBottom: '1rem', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ height: 8, borderRadius: 4, background: 'linear-gradient(to right, var(--bearish), var(--text-muted), var(--bullish))', position: 'relative', marginBottom: '0.75rem' }}>
        <div style={{ position: 'absolute', top: -4, left: `${position}%`, width: 16, height: 16, borderRadius: '50%', background: 'white', border: '2px solid var(--bg-card)', transform: 'translateX(-50%)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <span>🐻 {sentiment.bearish || 0}</span>
        <span>{sentiment.count || 0} articles</span>
        <span>{sentiment.bullish || 0} 🐂</span>
      </div>
    </div>
  );
}

// ── News Feed ───────────────────────────────────────────────────────────────
function NewsFeed({ articles }) {
  if (!articles?.length) return <p style={{ color: 'var(--text-muted)' }}>No articles found</p>;

  const sentColor = (label) => label === 'BULLISH' || label === 'positive' ? 'var(--bullish)' : label === 'BEARISH' || label === 'negative' ? 'var(--bearish)' : 'var(--text-muted)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {articles.map((a, i) => (
        <div key={i} style={{ padding: '0.75rem', background: 'var(--bg-hover)', borderRadius: 8 }}>
          <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none' }}>
            {a.headline}
          </a>
          {a.sentiment && (
            <span style={{ marginLeft: 8, fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, background: 'var(--bg-card)', color: sentColor(a.sentiment.label) }}>
              {a.sentiment.label} ({a.sentiment.compound?.toFixed(2)})
            </span>
          )}
          {a.summary && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>{a.summary.slice(0, 200)}{a.summary.length > 200 ? '...' : ''}</p>}
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {a.source} · {a.datetime ? new Date(a.datetime * 1000).toLocaleDateString() : ''}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Insider Trading ─────────────────────────────────────────────────────────
function InsiderSection({ data }) {
  if (!data?.trades?.length) return <p style={{ color: 'var(--text-muted)' }}>No insider data available</p>;

  const { summary, trades } = data;
  const sigColor = (s) => s === 'bullish' ? 'var(--bullish)' : s === 'bearish' ? 'var(--bearish)' : 'var(--text-muted)';

  return (
    <div>
      {summary && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
          <span style={{ color: sigColor(summary.signal), fontWeight: 700, textTransform: 'uppercase' }}>{summary.signal}</span>
          <span style={{ color: 'var(--bullish)' }}>Bought: {formatNumber(summary.total_bought)}</span>
          <span style={{ color: 'var(--bearish)' }}>Sold: {formatNumber(summary.total_sold)}</span>
          <span>Net: <span style={{ color: sigColor(summary.signal) }}>{formatNumber(summary.net)}</span></span>
        </div>
      )}
      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
        <table className="data-table" style={{ width: '100%', fontSize: '0.8rem' }}>
          <thead><tr><th>Date</th><th>Insider</th><th>Title</th><th>Type</th><th>Price</th><th>Value</th></tr></thead>
          <tbody>
            {trades.map((t, i) => (
              <tr key={i}>
                <td>{t.trade_date}</td>
                <td>{t.insider}</td>
                <td style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</td>
                <td><span className={`badge badge-${(t.type || '').toLowerCase().includes('buy') ? 'bullish' : 'bearish'}`}>{t.type}</span></td>
                <td>{formatPrice(t.price)}</td>
                <td>{formatNumber(t.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Fundamentals ────────────────────────────────────────────────────────────
function FundamentalsGrid({ data }) {
  if (!data) return <p style={{ color: 'var(--text-muted)' }}>No fundamentals data</p>;

  const metrics = [
    { label: 'Market Cap', value: formatNumber(data.market_cap) },
    { label: 'P/E Ratio', value: data.pe_ratio?.toFixed(2) ?? '—' },
    { label: 'Forward P/E', value: data.forward_pe?.toFixed(2) ?? '—' },
    { label: 'EPS', value: data.eps?.toFixed(2) ?? '—' },
    { label: 'PEG Ratio', value: data.peg_ratio?.toFixed(2) ?? '—' },
    { label: 'Debt/Equity', value: data.debt_to_equity?.toFixed(2) ?? '—' },
    { label: 'Free Cash Flow', value: formatNumber(data.free_cash_flow) },
    { label: 'Div Yield', value: data.dividend_yield ? `${(data.dividend_yield * 100).toFixed(2)}%` : '—' },
    { label: 'Profit Margin', value: data.profit_margin ? `${(data.profit_margin * 100).toFixed(1)}%` : '—' },
    { label: 'ROE', value: data.return_on_equity ? `${(data.return_on_equity * 100).toFixed(1)}%` : '—' },
    { label: 'Beta', value: data.beta?.toFixed(2) ?? '—' },
    { label: '52W Range', value: data.fifty_two_week_low && data.fifty_two_week_high ? `${formatPrice(data.fifty_two_week_low)} – ${formatPrice(data.fifty_two_week_high)}` : '—' },
  ];

  return (
    <div>
      {(data.sector || data.industry) && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
          {data.sector}{data.industry ? ` · ${data.industry}` : ''}
        </p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem' }}>
        {metrics.map(m => (
          <div key={m.label} style={{ padding: '0.5rem', background: 'var(--bg-hover)', borderRadius: 6 }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{m.label}</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{m.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function InvestigatorPage() {
  const { symbol: routeSymbol } = useParams();
  const navigate = useNavigate();
  const [symbol, setSymbol] = useState(routeSymbol || '');
  const [activeSymbol, setActiveSymbol] = useState(routeSymbol || '');

  const { data: newsData, isLoading: newsLoading } = useQuery({
    queryKey: ['inv-news', activeSymbol],
    queryFn: () => get(`/api/stock/${encodeURIComponent(activeSymbol)}/news?days=14`),
    enabled: !!activeSymbol,
    staleTime: 5 * 60 * 1000,
  });

  const { data: fundamentals, isLoading: fundLoading } = useQuery({
    queryKey: ['inv-fund', activeSymbol],
    queryFn: () => get(`/api/stock/${encodeURIComponent(activeSymbol)}/fundamentals`),
    enabled: !!activeSymbol,
    staleTime: 5 * 60 * 1000,
  });

  const { data: earnings, isLoading: earningsLoading } = useQuery({
    queryKey: ['inv-earnings', activeSymbol],
    queryFn: () => get(`/api/stock/${encodeURIComponent(activeSymbol)}/earnings`),
    enabled: !!activeSymbol,
    staleTime: 5 * 60 * 1000,
  });

  const { data: insider, isLoading: insiderLoading } = useQuery({
    queryKey: ['inv-insider', activeSymbol],
    queryFn: () => get(`/api/stock/${encodeURIComponent(activeSymbol)}/insider`),
    enabled: !!activeSymbol,
    staleTime: 5 * 60 * 1000,
  });

  const investigate = useCallback(() => {
    if (!symbol.trim()) return;
    const sym = symbol.toUpperCase();
    setActiveSymbol(sym);
    window.history.replaceState(null, '', `#/investigate/${sym}`);
  }, [symbol]);

  // Auto-investigate from URL
  useEffect(() => {
    if (routeSymbol && !activeSymbol) {
      setSymbol(routeSymbol.toUpperCase());
      setActiveSymbol(routeSymbol.toUpperCase());
    }
  }, [routeSymbol]);

  const isLoading = newsLoading || fundLoading || earningsLoading || insiderLoading;

  return (
    <div className="page-content">
      <PageHeader title="Investigator">
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <SymbolAutocomplete value={symbol} onChange={setSymbol} onSubmit={investigate} />
          <button className="btn btn-primary" onClick={investigate}>🔍 Investigate</button>
          {activeSymbol && (
            <button className="btn btn-ghost" onClick={() => navigate(`/stock/${activeSymbol}`)}>📈 Technical</button>
          )}
        </div>
      </PageHeader>

      {!activeSymbol ? (
        <EmptyState icon="🔍" title="Enter a symbol" message="Search for a stock to begin your deep-dive investigation" />
      ) : isLoading ? (
        <LoadingSkeleton type="card" />
      ) : (
        <>
          {/* Earnings Warning */}
          {earnings?.upcoming && (
            <div className="card" style={{ padding: '1rem 1.5rem', marginBottom: '1rem', borderLeft: `3px solid ${earnings.warning ? 'var(--bearish)' : 'var(--warning)'}` }}>
              <strong>{earnings.warning ? '⚠️' : '📅'} Earnings: {earnings.upcoming.date}</strong>
              <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>
                {earnings.upcoming.days_until === 0 ? 'TODAY' : `in ${earnings.upcoming.days_until} days`}
                {earnings.upcoming.hour && ` · ${earnings.upcoming.hour === 'bmo' ? 'Before Market' : 'After Market'}`}
                {earnings.upcoming.estimate_eps != null && ` · Est EPS: ${earnings.upcoming.estimate_eps}`}
              </span>
            </div>
          )}

          {/* Main Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            {/* Sentiment + Insider */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="card" style={{ padding: '1rem 1.5rem' }}>
                <h3 style={{ margin: '0 0 0.5rem' }}>News Sentiment</h3>
                <SentimentGauge sentiment={newsData?.sentiment} />
              </div>
              <div className="card" style={{ padding: '1rem 1.5rem' }}>
                <h3 style={{ margin: '0 0 0.5rem' }}>Insider Trading</h3>
                <InsiderSection data={insider} />
              </div>
            </div>

            {/* News Feed */}
            <div className="card" style={{ padding: '1rem 1.5rem' }}>
              <h3 style={{ margin: '0 0 0.5rem' }}>News Feed ({newsData?.articles?.length || 0})</h3>
              <NewsFeed articles={newsData?.articles} />
            </div>

            {/* Fundamentals */}
            <div className="card" style={{ padding: '1rem 1.5rem' }}>
              <h3 style={{ margin: '0 0 0.5rem' }}>Fundamentals</h3>
              <FundamentalsGrid data={fundamentals} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const dropdownStyle = { position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' };
const dropdownItemStyle = { padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem' };
