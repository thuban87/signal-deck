export default function SignalsListWidget({ summary }) {
  const signals = summary?.signals || [];

  if (signals.length === 0) {
    return <div className="text-muted" style={{ padding: 12, fontSize: '0.85rem' }}>No active signals</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {signals.map((sig, i) => {
        const sigText = typeof sig === 'string' ? sig : (sig.name || sig.signal_name || 'Signal');
        const sigLower = sigText.toLowerCase();
        const isBearish = sigLower.includes('bearish') || sigLower.includes('overbought') || sigLower.includes('death') || sigLower.includes('below');
        const borderColor = isBearish ? 'var(--red)' : 'var(--green)';
        return (
          <div key={i} style={{ borderLeft: `3px solid ${borderColor}`, padding: '6px 10px', borderRadius: 4, fontSize: '0.85rem', background: 'var(--bg-card)' }}>
            <span style={{ fontWeight: 500 }}>{sigText}</span>
          </div>
        );
      })}
    </div>
  );
}
