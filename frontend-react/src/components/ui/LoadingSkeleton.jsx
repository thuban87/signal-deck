export default function LoadingSkeleton({ type = 'card' }) {
  if (type === 'chart') {
    return (
      <div className="skeleton-container">
        <div className="skeleton" style={{ width: '100%', height: '380px', borderRadius: '12px', background: 'var(--bg-card)' }} />
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className="skeleton-container">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="skeleton" style={{ width: '100%', height: '40px', marginBottom: '8px', borderRadius: '6px', background: 'var(--bg-card)' }} />
        ))}
      </div>
    );
  }

  if (type === 'metrics') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton" style={{ height: '80px', borderRadius: '12px', background: 'var(--bg-card)' }} />
        ))}
      </div>
    );
  }

  return (
    <div className="skeleton-container">
      <div className="skeleton" style={{ width: '60%', height: '24px', marginBottom: '1rem', borderRadius: '6px', background: 'var(--bg-card)' }} />
      <div className="skeleton" style={{ width: '100%', height: '200px', borderRadius: '12px', background: 'var(--bg-card)' }} />
    </div>
  );
}
