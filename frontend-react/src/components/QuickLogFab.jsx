import { useState, useRef, useEffect } from 'react';
import { post } from '../api/client';
import { useAppStore } from '../stores/appStore';

export default function QuickLogFab() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState(null);
  const inputRef = useRef(null);
  const addToast = useAppStore((s) => s.addToast);

  useEffect(() => {
    if (panelOpen && inputRef.current) {
      setTimeout(() => inputRef.current.focus(), 100);
    }
  }, [panelOpen]);

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
      <div
        className="quick-log-fab"
        title="Quick-log a ticker idea"
        onClick={() => {
          setPanelOpen(!panelOpen);
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
