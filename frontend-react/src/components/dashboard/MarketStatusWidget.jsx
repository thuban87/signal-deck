import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get } from '../../api/client';
import { Link } from 'react-router-dom';

function eventCategoryIcon(category) {
  const icons = { fed: '\uD83C\uDFE6', inflation: '\uD83D\uDCCA', employment: '\uD83D\uDC54', gdp: '\uD83D\uDCC8', consumer: '\uD83D\uDED2', housing: '\uD83C\uDFE0', other: '\uD83D\uDCC5' };
  return icons[category] || '\uD83D\uDCC5';
}

export default function MarketStatusWidget() {
  const { data: events, isLoading } = useQuery({
    queryKey: ['economic-events', 14],
    queryFn: () => get('/api/economic-events?days=14'),
    staleTime: 30 * 60 * 1000,
  });

  if (isLoading) return <div className="loading-text">Loading economic calendar...</div>;

  if (!events || events.length === 0) {
    return (
      <div className="market-status-banner market-status-clear">
        <div className="market-status-icon">{'\u2705'}</div>
        <div className="market-status-text">
          <strong>All Clear</strong>
          <span>No major economic events in the next 14 days</span>
        </div>
      </div>
    );
  }

  const upcoming = events.filter(e => e.days_until >= 0);
  const recent = events.filter(e => e.days_until < 0).reverse();
  const nearest = upcoming.length > 0 ? upcoming[0] : null;

  const isImminent = nearest && nearest.days_until <= 1;
  const isWarning = nearest && nearest.days_until <= 3;
  const bannerClass = !nearest ? 'market-status-clear' : isImminent ? 'market-status-red' : isWarning ? 'market-status-yellow' : 'market-status-clear';
  const statusIcon = !nearest ? '\u2705' : isImminent ? '\uD83D\uDD34' : isWarning ? '\uD83D\uDFE1' : '\uD83D\uDFE2';

  const countdownText = !nearest ? 'No upcoming events'
    : nearest.days_until === 0 ? 'TODAY'
    : nearest.days_until === 1 ? 'TOMORROW'
    : `in ${nearest.days_until} days`;

  const makeSearchUrl = (e) => `https://www.google.com/search?q=${encodeURIComponent(e.event + ' ' + e.date + ' results')}`;

  return (
    <div className={`market-status-banner ${bannerClass}`}>
      <div className="market-status-header">
        <div className="market-status-icon">{statusIcon}</div>
        <div className="market-status-text">
          <strong>{nearest ? nearest.event : 'All Clear'}</strong>
          <span>{nearest ? `${countdownText} \u2014 ${nearest.date}` : 'No major events in the next 14 days'}</span>
        </div>
        {nearest && <div className={`market-status-impact-badge impact-${nearest.impact}`}>{nearest.impact.toUpperCase()}</div>}
      </div>
      <div className="market-event-list">
        {upcoming.slice(0, 5).map((e, i) => {
          const dayLabel = e.days_until === 0 ? 'TODAY' : e.days_until === 1 ? 'Tomorrow' : `${e.days_until}d`;
          const urgencyClass = e.days_until <= 1 ? 'event-urgent' : e.days_until <= 3 ? 'event-warning' : 'event-safe';
          return (
            <a key={i} href={makeSearchUrl(e)} target="_blank" rel="noopener noreferrer" className={`market-event-item ${urgencyClass}`} title="Search for results">
              <span className="event-cat-icon">{eventCategoryIcon(e.category)}</span>
              <span className="event-name">{e.event}</span>
              <span className="event-date">{e.date}</span>
              <span className="event-countdown-badge">{dayLabel}</span>
            </a>
          );
        })}
        {recent.length > 0 && (
          <>
            <div className="market-event-divider"><span>Recently Passed</span></div>
            {recent.slice(0, 3).map((e, i) => {
              const daysAgo = Math.abs(e.days_until);
              const dayLabel = daysAgo === 1 ? '1d ago' : `${daysAgo}d ago`;
              return (
                <a key={`past-${i}`} href={makeSearchUrl(e)} target="_blank" rel="noopener noreferrer" className="market-event-item event-passed" title="Search for results">
                  <span className="event-cat-icon">{eventCategoryIcon(e.category)}</span>
                  <span className="event-name">{e.event}</span>
                  <span className="event-date">{e.date}</span>
                  <span className="event-countdown-badge event-passed-badge">{dayLabel}</span>
                </a>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
