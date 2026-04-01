import { useState } from 'react';
import { post } from '../api/client';
import { useAppStore } from '../stores/appStore';

export default function AddSymbolModal({ open, onClose }) {
  const [symbol, setSymbol] = useState('');
  const [error, setError] = useState('');
  const addToast = useAppStore((s) => s.addToast);

  if (!open) return null;

  const handleAdd = async () => {
    const s = symbol.trim().toUpperCase();
    if (!s) return;

    try {
      await post('/api/watchlist', { symbol: s });
      onClose();
      setSymbol('');
      setError('');
      addToast(`${s} added to watchlist`, 'success');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAdd();
  };

  return (
    <div className="modal">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content">
        <h3>Add Symbol to Watchlist</h3>
        <div className="form-group">
          <label htmlFor="add-symbol-input">Ticker Symbol</label>
          <input
            type="text"
            id="add-symbol-input"
            placeholder="e.g. GOOGL"
            maxLength={10}
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleAdd}>
            Add
          </button>
        </div>
        {error && <p className="form-error">{error}</p>}
      </div>
    </div>
  );
}
