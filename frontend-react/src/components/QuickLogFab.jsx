import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { post, get } from '../api/client';
import { useAppStore } from '../stores/appStore';

export default function QuickLogFab() {
  const navigate = useNavigate();
  const [panelOpen, setPanelOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [input, setInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const inputRef = useRef(null);
  const searchInputRef = useRef(null);
  const searchTimer = useRef(null);
  const addToast = useAppStore((s) => s.addToast);

  useEffect(() => {
    if (panelOpen && inputRef.current) {
      setTimeout(() => inputRef.current.focus(), 100);
    }
  }, [panelOpen]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current.focus(), 100);
    }
  }, [searchOpen]);

  const doSearch = useCallback((q) => {
    if (!q.trim()) { setSearchResults([]); return; }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const data = await get(`/api/symbols/search?q=${encodeURIComponent(q)}&limit=8`);
        setSearchResults(data || []);
      } catch { setSearchResults([]); }
    }, 250);
  }, []);

  const navigateToStock = useCallback((sym) => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    navigate(`/stock/${sym.toUpperCase()}`);
  }, [navigate]);

  const handleSubmit = async () => {
    const raw = input.trim();
    if (!raw) return;

    try {
      const result = await post('/api/quick-log', { input: raw });
      setInput('');
      if (result.resolved_ticker) {
        setFeedback({
          type: 'success',
          text: `\u2713 Logged: ${result.resolved_ticker}${result.resolved_name ? ' \u2014 ' + result.resolved_name : ''}`,
        });
      } else {
        setFeedback({
          type: 'warning',
          text: `\u26A0 Logged "${raw}" \u2014 couldn't resolve a ticker`,
        });
      }
      addToast('Idea logged', 'success');
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <>
      {/* Search FAB */}
      <div
        className="search-fab"
        title="Search for a stock"
        onClick={() => {
          setSearchOpen(!searchOpen);
          setPanelOpen(false);
          setSearchQuery('');
          setSearchResults([]);
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>
      {searchOpen && (
        <div className="quick-log-panel search-panel">
          <div className="quick-log-header">
            <span>🔍 Search Stock</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setSearchOpen(false)}>
              &times;
            </button>
          </div>
          <div className="quick-log-body">
            <input
              ref={searchInputRef}
              type="text"
              className="quick-log-input"
              placeholder='Ticker or company name… e.g. "AAPL" or "Apple"'
              autoComplete="off"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value.toUpperCase()); doSearch(e.target.value); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  navigateToStock(searchQuery.trim());
                }
              }}
            />
            {searchResults.length > 0 && (
              <div className="search-results-list">
                {searchResults.map((r) => (
                  <div
                    key={r.symbol}
                    className="search-result-item"
                    onClick={() => navigateToStock(r.symbol)}
                  >
                    <strong>{r.symbol}</strong>
                    <span className="text-muted" style={{ marginLeft: 8, fontSize: '0.8rem' }}>{r.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Log FAB */}
      <div
        className="quick-log-fab"
        title="Quick-log a ticker idea"
        onClick={() => {
          setPanelOpen(!panelOpen);
          setSearchOpen(false);
          setFeedback(null);
          setInput('');
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </div>
      {panelOpen && (
        <div className="quick-log-panel">
          <div className="quick-log-header">
            <span>{'\uD83D\uDE97'} Quick Log</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setPanelOpen(false)}>
              &times;
            </button>
          </div>
          <div className="quick-log-body">
            <input
              ref={inputRef}
              type="text"
              className="quick-log-input"
              placeholder='Ticker or company name\u2026 e.g. "NVDA" or "Palantir"'
              autoComplete="off"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button className="btn btn-primary btn-full" onClick={handleSubmit}>
              Log It
            </button>
            {feedback && (
              <p className={`quick-log-feedback ${feedback.type}`}>{feedback.text}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
