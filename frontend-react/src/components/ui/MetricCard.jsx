export default function MetricCard({ label, value, subtext, className = '' }) {
  return (
    <div className={`metric-card card ${className}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {subtext && <div className="metric-subtext">{subtext}</div>}
    </div>
  );
}
