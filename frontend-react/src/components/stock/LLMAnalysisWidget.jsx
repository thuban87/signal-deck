import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { post } from '../../api/client';
import { useAppStore } from '../../stores/appStore';

export default function LLMAnalysisWidget({ symbol }) {
  const toast = useAppStore(s => s.addToast);

  const { mutate, data: result, isPending, error } = useMutation({
    mutationFn: () => post(`/api/llm/${symbol}`, {}),
    onError: (err) => toast(err.message, 'error'),
  });

  if (!result && !isPending) {
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: 8 }}>Requires local Ollama running qwen3:8b</p>
        <button className="btn btn-primary btn-sm" onClick={() => mutate()}>Run LLM Analysis</button>
      </div>
    );
  }

  if (isPending) {
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        <div className="loading-spinner"><div className="spinner" /></div>
        <p className="text-muted" style={{ fontSize: '0.85rem' }}>Analyzing {symbol}... (10-30s)</p>
      </div>
    );
  }

  if (error || !result) {
    return <div className="text-red" style={{ padding: 12, fontSize: '0.85rem' }}>Analysis failed. Is Ollama running?</div>;
  }

  const actionClass = result.action === 'BUY' ? 'buy' : result.action === 'SELL' ? 'sell' : 'hold';
  const confColor = result.confidence >= 7 ? 'var(--green)' : result.confidence >= 4 ? 'var(--yellow, #FFD700)' : 'var(--red)';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <span className={`action-badge action-badge-${actionClass}`} style={{ fontSize: '1rem', padding: '6px 14px' }}>{result.action}</span>
        <div>
          <span style={{ fontSize: '0.85rem' }}>Confidence: </span>
          <strong style={{ color: confColor }}>{result.confidence}/10</strong>
        </div>
      </div>
      {result.reasoning && <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 8 }}>{result.reasoning}</p>}
      {result.key_signals?.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <span className="text-muted" style={{ fontSize: '0.75rem' }}>Key Signals: </span>
          {result.key_signals.map((s, i) => <span key={i} className="tag-badge" style={{ marginRight: 4, fontSize: '0.75rem' }}>{s}</span>)}
        </div>
      )}
      {result.risk_factors?.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <span className="text-muted" style={{ fontSize: '0.75rem' }}>Risk Factors: </span>
          {result.risk_factors.map((r, i) => <span key={i} className="tag-badge" style={{ marginRight: 4, fontSize: '0.75rem', background: 'rgba(255,71,87,0.15)', color: 'var(--red)' }}>{r}</span>)}
        </div>
      )}
      {(result.stop_loss_pct || result.take_profit_pct) && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {result.stop_loss_pct && <span>Stop Loss: {result.stop_loss_pct}% </span>}
          {result.take_profit_pct && <span>Take Profit: {result.take_profit_pct}%</span>}
        </div>
      )}
      <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => mutate()}>Re-run Analysis</button>
    </div>
  );
}
