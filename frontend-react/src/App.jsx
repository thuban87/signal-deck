import { lazy, Suspense, useState, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import Sidebar from './components/Sidebar';
import LoginPage from './components/LoginPage';
import ToastContainer from './components/ToastContainer';
import QuickLogFab from './components/QuickLogFab';
import ErrorBoundary from './components/ErrorBoundary';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const StockDetailPage = lazy(() => import('./pages/StockDetailPage'));
const DiscoverPage = lazy(() => import('./pages/DiscoverPage'));
const SignalsPage = lazy(() => import('./pages/SignalsPage'));
const BacktestPage = lazy(() => import('./pages/BacktestPage'));
const PaperTradingPage = lazy(() => import('./pages/PaperTradingPage'));
const PerformancePage = lazy(() => import('./pages/PerformancePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function InvestigatorRedirect() {
  const { symbol } = useParams();
  if (symbol) return <Navigate to={`/stock/${symbol}`} replace />;
  return <Navigate to="/dashboard" replace />;
}

function LoadingSkeleton() {
  return (
    <div className="page-content" style={{ padding: '2rem' }}>
      <div className="skeleton" style={{ width: '200px', height: '28px', marginBottom: '1rem', borderRadius: '6px', background: 'var(--bg-card)' }} />
      <div className="skeleton" style={{ width: '100%', height: '200px', borderRadius: '12px', background: 'var(--bg-card)' }} />
    </div>
  );
}

function AuthGuard({ children }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <LoginPage />;
  return children;
}

function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = useCallback(() => {
    setMobileOpen(false);
  }, []);

  return (
    <div className="app-container">
      <button
        className="hamburger-btn"
        aria-label="Open menu"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {mobileOpen && (
        <div
          className={`sidebar-overlay visible`}
          onClick={closeMobile}
        />
      )}

      <Sidebar mobileOpen={mobileOpen} onCloseMobile={closeMobile} />

      <main className="main-content">
        <ErrorBoundary>
          <Suspense fallback={<LoadingSkeleton />}>
            <Routes>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/stock/:symbol" element={<StockDetailPage />} />
              <Route path="/discover/:tab?" element={<DiscoverPage />} />
              <Route path="/investigate/:symbol?" element={<InvestigatorRedirect />} />
              <Route path="/signals" element={<SignalsPage />} />
              <Route path="/backtest/:symbol?" element={<BacktestPage />} />
              <Route path="/paper" element={<PaperTradingPage />} />
              <Route path="/performance" element={<PerformancePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>

      <QuickLogFab />
      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    </HashRouter>
  );
}
