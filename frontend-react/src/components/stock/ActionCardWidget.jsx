import { getActionRecommendation } from '../../utils/signals';

export default function ActionCardWidget({ summary }) {
  if (!summary) return null;
  const { action, actionClass, reasoning } = getActionRecommendation(summary);

  return (
    <div className={`action-card action-card-${actionClass}`} style={{ padding: 16, borderRadius: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className={`action-badge action-badge-${actionClass}`} style={{ fontSize: '1.1rem', padding: '6px 16px' }}>{action}</span>
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Signal Recommendation</div>
          {reasoning && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>{reasoning}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: '0.8rem' }}>
        <span>Strong Bull: {summary.strong_bullish || 0}</span>
        <span>Support Bull: {summary.support_bullish || 0}</span>
        <span>Strong Bear: {summary.strong_bearish || 0}</span>
        <span>Support Bear: {summary.support_bearish || 0}</span>
      </div>
    </div>
  );
}
