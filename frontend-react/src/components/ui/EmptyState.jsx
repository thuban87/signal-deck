export default function EmptyState({ icon, title, message, action }) {
  return (
    <div className="empty-state" style={{ textAlign: 'center', padding: '2rem' }}>
      {icon && <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{icon}</div>}
      {title && <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{title}</h3>}
      {message && <p style={{ color: 'var(--text-muted)' }}>{message}</p>}
      {action}
    </div>
  );
}
