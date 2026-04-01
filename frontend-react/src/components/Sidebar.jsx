import { useLocation, Link } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';
import { useEffect, useState, useCallback } from 'react';
import { get } from '../api/client';

const navItems = [
  {
    path: '/dashboard',
    page: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    path: '/discover',
    page: 'discover',
    label: 'Discover',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
      </svg>
    ),
  },
  {
    path: '/signals',
    page: 'signals',
    label: 'Signals',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
  {
    path: '/backtest',
    page: 'backtest',
    label: 'Backtest',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    path: '/paper',
    page: 'paper',
    label: 'Paper Trading',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    path: '/performance',
    page: 'performance',
    label: 'Performance',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
];

const settingsItem = {
  path: '/settings',
  page: 'settings',
  label: 'Settings',
  icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
};

export default function Sidebar({ mobileOpen, onCloseMobile }) {
  const location = useLocation();
  const logout = useAuthStore((s) => s.logout);
  const config = useAppStore((s) => s.config);
  const setConfig = useAppStore((s) => s.setConfig);

  useEffect(() => {
    get('/api/config')
      .then((data) => data && setConfig(data))
      .catch(() => {});
  }, [setConfig]);

  const currentPage = location.pathname.split('/')[1] || 'dashboard';

  const handleNavClick = useCallback(() => {
    if (window.matchMedia('(max-width: 768px)').matches) {
      onCloseMobile();
    }
  }, [onCloseMobile]);

  const dataSourceLabel = config
    ? config.data_source === 'alpaca'
      ? 'Alpaca Live'
      : 'yFinance'
    : 'Loading...';
  const isOffline = config && config.data_source !== 'alpaca';

  return (
    <nav
      className={`sidebar${mobileOpen ? ' mobile-open' : ''}`}
      role="navigation"
    >
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
            <polyline points="16 7 22 7 22 13" />
          </svg>
          <span>Signal Deck</span>
        </div>
      </div>

      <div className="sidebar-nav">
        {navItems.map((item) => (
          <Link
            key={item.page}
            to={item.path}
            className={`nav-item${currentPage === item.page ? ' active' : ''}`}
            aria-current={currentPage === item.page ? 'page' : undefined}
            onClick={handleNavClick}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}

        <div className="nav-divider" />

        <Link
          to={settingsItem.path}
          className={`nav-item${currentPage === settingsItem.page ? ' active' : ''}`}
          aria-current={currentPage === settingsItem.page ? 'page' : undefined}
          onClick={handleNavClick}
        >
          {settingsItem.icon}
          <span>{settingsItem.label}</span>
        </Link>
      </div>

      <div className="sidebar-footer">
        <div className={`data-source-badge${isOffline ? ' offline' : ''}`}>
          <span className="source-dot" />
          <span>{dataSourceLabel}</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={logout} title="Logout">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
