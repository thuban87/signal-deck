export function formatPrice(price) {
  if (price == null) return '—';
  const n = Number(String(price).replace(/[$,]/g, ''));
  if (isNaN(n)) return String(price);
  return '$' + n.toFixed(2);
}

export function formatChange(pct) {
  if (pct == null) return '—';
  const n = Number(pct);
  if (isNaN(n)) return String(pct);
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function rsiClass(rsi) {
  if (rsi == null) return 'neutral';
  if (rsi < 30) return 'oversold';
  if (rsi > 70) return 'overbought';
  return 'neutral';
}

export function directionClass(direction) {
  return direction === 'short' || direction === 'sell' ? 'sell' : 'buy';
}

export function formatNumber(num) {
  if (num == null) return '—';
  const n = Number(String(num).replace(/[$,]/g, ''));
  if (isNaN(n)) return String(num);
  if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(2);
}

export function isMobile() {
  return window.matchMedia('(max-width: 768px)').matches;
}
