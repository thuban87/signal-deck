export default function SignalsListWidget({ summary }) {
  const signals = summary?.signals || [];

  if (signals.length === 0) {
    return <div className="text-muted" style={{ padding: 12, fontSize: '0.85rem' }}>No active signals</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {signals.map((sig, i) => {
        const isBullish = sig.direction !== 'short' && sig.direction !== 'bearish';
        const borderColor = isBullish ? 'var(--green)' : 'var(--red)';
        return (
          <div key={i} style={{ borderLeft: `3px solid ${borderColor}`, padding: '6px 10px', borderRadius: 4, fontSize: '0.85rem', background: 'var(--surface)' }}>
            <span style={{ fontWeight: 500 }}>{sig.name || sig.signal_name || 'Signal'}</span>
            {sig.type && <span className="text-muted" style={{ marginLeft: 8, fontSize: '0.75rem' }}>{sig.type}</span>}
          </div>
        );
      })}
    </div>
  );
}
