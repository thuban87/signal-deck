import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import WidgetGrid from '../components/ui/WidgetGrid';
import useGridLayout from '../hooks/useGridLayout';
import AddSymbolModal from '../components/AddSymbolModal';
import ErrorBoundary from '../components/ErrorBoundary';
import MarketStatusWidget from '../components/dashboard/MarketStatusWidget';
import SignalAlertsWidget from '../components/dashboard/SignalAlertsWidget';
import BasketsWidget from '../components/dashboard/BasketsWidget';
import SectorHeatmapWidget from '../components/dashboard/SectorHeatmapWidget';
import QuickLogWidget from '../components/dashboard/QuickLogWidget';
import WatchlistWidget from '../components/dashboard/WatchlistWidget';
import ScreenerWidget from '../components/dashboard/ScreenerWidget';

const DEFAULT_LAYOUT = [
  { i: 'market-status', x: 0, y: 0, w: 12, h: 6, minW: 6, minH: 3 },
  { i: 'signals-alert', x: 0, y: 6, w: 12, h: 2, minW: 6, minH: 2 },
  { i: 'baskets',       x: 0, y: 8, w: 6, h: 7, minW: 4, minH: 4 },
  { i: 'sector-heatmap',x: 6, y: 8, w: 6, h: 7, minW: 4, minH: 4 },
  { i: 'quick-log',     x: 0, y: 15, w: 6, h: 6, minW: 3, minH: 3 },
  { i: 'watchlist',     x: 0, y: 21, w: 12, h: 12, minW: 6, minH: 6 },
  { i: 'screener',      x: 6, y: 15, w: 6, h: 6, minW: 4, minH: 3 },
];

const WIDGET_MAP = {
  'market-status':  { header: null,               Content: MarketStatusWidget, centered: true },
  'signals-alert':  { header: null,               Content: SignalAlertsWidget, centered: true },
  'baskets':        { header: null,               Content: BasketsWidget, centered: true },
  'sector-heatmap': { header: null,               Content: SectorHeatmapWidget, centered: true },
  'quick-log':      { header: null,               Content: QuickLogWidget },
  'watchlist':      { header: null,               Content: WatchlistWidget },
  'screener':       { header: null,               Content: ScreenerWidget, centered: true },
};

export default function DashboardPage() {
  const [showAdd, setShowAdd] = useState(false);
  const queryClient = useQueryClient();
  const { layout, editMode, onLayoutChange, toggleEditMode, resetLayout } = useGridLayout('sd_dashboard_layout', DEFAULT_LAYOUT);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    queryClient.invalidateQueries({ queryKey: ['signals-today'] });
    queryClient.invalidateQueries({ queryKey: ['baskets'] });
    queryClient.invalidateQueries({ queryKey: ['sectors-performance'] });
    queryClient.invalidateQueries({ queryKey: ['quick-logs'] });
    queryClient.invalidateQueries({ queryKey: ['economic-events'] });
  }, [queryClient]);

  const widgets = layout.map(item => {
    const def = WIDGET_MAP[item.i];
    if (!def) return null;
    return {
      id: item.i,
      header: def.header,
      bodyClassName: def.centered ? 'widget-body-centered' : undefined,
      content: (
        <ErrorBoundary>
          <def.Content />
        </ErrorBoundary>
      ),
    };
  }).filter(Boolean);

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Dashboard</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={handleRefresh}>Refresh</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Add Symbol</button>
          <button className="btn btn-ghost btn-sm" onClick={toggleEditMode}>
            {editMode ? '✓ Done' : '⚙ Customize'}
          </button>
          {editMode && (
            <button className="btn btn-ghost btn-sm" onClick={resetLayout}>Reset Layout</button>
          )}
        </div>
      </div>

      <WidgetGrid
        widgets={widgets}
        layout={layout}
        onLayoutChange={onLayoutChange}
        editMode={editMode}
      />

      <AddSymbolModal open={showAdd} onClose={() => { setShowAdd(false); queryClient.invalidateQueries({ queryKey: ['watchlist'] }); }} />
    </div>
  );
}
