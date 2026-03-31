import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get } from '../../api/client';

function eventCategoryIcon(category) {
  const icons = { fed: '\uD83C\uDFE6', inflation: '\uD83D\uDCCA', employment: '\uD83D\uDC54', gdp: '\uD83D\uDCC8', consumer: '\uD83D\uDED2', housing: '\uD83C\uDFE0', other: '\uD83D\uDCC5' };
  return icons[category] || '\uD83D\uDCC5';
}

export default function StockMacroEventsWidget({ symbol }) {
  const { data: events, isLoading } = useQuery({
    queryKey: ['stock-economic-events', symbol],
    queryFn: () => get(`/api/stock/${symbol}/economic-events?days=30`),
    staleTime: 30 * 60 * 1000,
  });

  const { upcoming, recent, nearest, bannerClass, statusIcon, countdownText } = useMemo(() => {
    if (!events || events.length === 0) return { upcoming: [], recent: [], nearest: null, bannerClass: 'market-status-clear', statusIcon: '\u2705', countdownText: 'No upcoming events' };
    const up = events.filter(e => e.days_until >= 0);
    const rec = events.filter(e => e.days_until < 0).reverse();
    const nr = up.length > 0 ? up[0] : null;
    const imm = nr && nr.days_until <= 1;
    const warn = nr && nr.days_until <= 3;
    return {
      upcoming: up, recent: rec, nearest: nr,
      bannerClass: !nr ? 'market-status-clear' : imm ? 'market-status-red' : warn ? 'market-status-yellow' : 'market-status-clear',
      statusIcon: !nr ? '\u2705' : imm ? '\uD83D\uDD34' : warn ? '\uD83D\uDFE1' : '\uD83D\uDFE2',
      countdownText: !nr ? 'No upcoming events' : nr.days_until === 0 ? 'TODAY' : nr.days_until === 1 ? 'TOMORROW' : `in ${nr.days_until} days`,
    };
  }, [events]);

  if (isLoading) return <div className="loading-text">Loading macro events...</div>;

  const makeSearchUrl = (e) => `https://www.google.com/search?q=${encodeURIComponent(e.event + ' ' + e.date + ' results')}`;

  if (!events || events.length === 0) {
    return <div className="text-muted" style={{ padding: 12, fontSize: '0.85rem' }}>{'\u2705'} No relevant macro events</div>;
  }

  return (
    <div className={`market-status-banner ${bannerClass}`} style={{ padding: 10, fontSize: '0.85rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span>{statusIcon}</span>
        <div>
          <strong>{nearest ? nearest.event : 'All Clear'}</strong>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{nearest ? `${countdownText} \u2014 ${nearest.date}` : ''}</div>
        </div>
      </div>
      <div className="market-event-list" style={{ fontSize: '0.8rem' }}>
        {upcoming.slice(0, 4).map((e, i) => {
          const dayLabel = e.days_until === 0 ? 'TODAY' : e.days_until === 1 ? 'Tomorrow' : `${e.days_until}d`;
          const urgencyClass = e.days_until <= 1 ? 'event-urgent' : e.days_until <= 3 ? 'event-warning' : 'event-safe';
          return (
            <a key={i} href={makeSearchUrl(e)} target="_blank" rel="noopener noreferrer" className={`market-event-item ${urgencyClass}`} title="Search for results">
              <span className="event-cat-icon">{eventCategoryIcon(e.category)}</span>
              <span className="event-name">{e.event}</span>
              <span className="event-countdown-badge">{dayLabel}</span>
            </a>
          );
        })}
        {recent.length > 0 && (
          <>
            <div className="market-event-divider"><span>Recent</span></div>
            {recent.slice(0, 2).map((e, i) => (
              <a key={`past-${i}`} href={makeSearchUrl(e)} target="_blank" rel="noopener noreferrer" className="market-event-item event-passed">
                <span className="event-cat-icon">{eventCategoryIcon(e.category)}</span>
                <span className="event-name">{e.event}</span>
                <span className="event-countdown-badge event-passed-badge">{Math.abs(e.days_until)}d ago</span>
              </a>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
