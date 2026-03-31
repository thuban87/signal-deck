import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { get } from '../api/client';
import WidgetGrid from '../components/ui/WidgetGrid';
import useGridLayout from '../hooks/useGridLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import StockPriceChart from '../components/stock/StockPriceChart';
import IndicatorsWidget from '../components/stock/IndicatorsWidget';
import ActionCardWidget from '../components/stock/ActionCardWidget';
import EarningsWidget from '../components/stock/EarningsWidget';
import RelatedStocksWidget from '../components/stock/RelatedStocksWidget';
import StockMacroEventsWidget from '../components/stock/StockMacroEventsWidget';
import SignalsListWidget from '../components/stock/SignalsListWidget';
import FundamentalsWidget from '../components/stock/FundamentalsWidget';
import InsiderTradingWidget from '../components/stock/InsiderTradingWidget';
import MiniNewsWidget from '../components/stock/MiniNewsWidget';
import SocialTrendingWidget from '../components/stock/SocialTrendingWidget';
import PositionSizingWidget from '../components/stock/PositionSizingWidget';
import NotesWidget from '../components/stock/NotesWidget';
import TradeCalculatorWidget from '../components/stock/TradeCalculatorWidget';
import SavedSimulationsWidget from '../components/stock/SavedSimulationsWidget';
import LLMAnalysisWidget from '../components/stock/LLMAnalysisWidget';

const DEFAULT_LAYOUT = [
  { i: 'chart',            x: 0, y: 0,  w: 8,  h: 9,  minW: 4, minH: 6 },
  { i: 'indicators',       x: 8, y: 0,  w: 4,  h: 9,  minW: 3, minH: 4 },
  { i: 'action-card',      x: 0, y: 9,  w: 4,  h: 4,  minW: 3, minH: 3 },
  { i: 'earnings-warning', x: 4, y: 9,  w: 4,  h: 4,  minW: 3, minH: 3 },
  { i: 'related-stocks',   x: 8, y: 9,  w: 4,  h: 4,  minW: 3, minH: 3 },
  { i: 'macro-events',     x: 0, y: 13, w: 6,  h: 5,  minW: 3, minH: 3 },
  { i: 'signals-list',     x: 6, y: 13, w: 6,  h: 5,  minW: 3, minH: 3 },
  { i: 'fundamentals',     x: 0, y: 18, w: 6,  h: 5,  minW: 3, minH: 3 },
  { i: 'insider-trading',  x: 6, y: 18, w: 6,  h: 5,  minW: 3, minH: 3 },
  { i: 'mini-news',        x: 0, y: 23, w: 4,  h: 5,  minW: 3, minH: 3 },
  { i: 'social-trending',  x: 4, y: 23, w: 4,  h: 5,  minW: 3, minH: 3 },
  { i: 'position-sizing',  x: 8, y: 23, w: 4,  h: 5,  minW: 3, minH: 3 },
  { i: 'notes',            x: 0, y: 28, w: 6,  h: 5,  minW: 3, minH: 3 },
  { i: 'trade-calculator', x: 6, y: 28, w: 6,  h: 6,  minW: 4, minH: 4 },
  { i: 'simulations',      x: 0, y: 34, w: 6,  h: 5,  minW: 4, minH: 3 },
  { i: 'llm-result',       x: 6, y: 34, w: 6,  h: 5,  minW: 4, minH: 3 },
];

const WIDGET_TITLES = {
  'chart': 'Price Chart',
  'indicators': 'Indicators',
  'action-card': 'Signal Recommendation',
  'earnings-warning': 'Earnings',
  'related-stocks': 'Related Stocks',
  'macro-events': 'Macro Events',
  'signals-list': 'Active Signals',
  'fundamentals': 'Fundamentals',
  'insider-trading': 'Insider Trading',
  'mini-news': 'Recent News',
  'social-trending': 'Social Trending',
  'position-sizing': 'Position Sizing',
  'notes': 'Notes',
  'trade-calculator': 'Trade Calculator',
  'simulations': 'Saved Simulations',
  'llm-result': 'LLM Analysis',
};

export default function StockDetailPage() {
  const { symbol } = useParams();
  const [period, setPeriod] = useState('6mo');
  const [companyName, setCompanyName] = useState('');
  const [calcEntryDate, setCalcEntryDate] = useState(null);
  const [calcExitDate, setCalcExitDate] = useState(null);

  const { layout, editMode, onLayoutChange, toggleEditMode, resetLayout } = useGridLayout('sd_stock_detail_layout', DEFAULT_LAYOUT);

  const { data: stockData, isLoading } = useQuery({
    queryKey: ['stock-data', symbol, period],
    queryFn: () => get(`/api/stock/${symbol}?period=${period}`),
    staleTime: 5 * 60 * 1000,
  });

  const handleDatePick = useCallback((which, date) => {
    if (which === 'entry') setCalcEntryDate(date);
    else setCalcExitDate(date);
  }, []);

  const summary = stockData?.summary;

  const widgetContent = {
    'chart': (
      <div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {['1mo', '3mo', '6mo', '1y', '2y'].map(p => (
            <button key={p} className={`btn btn-ghost btn-sm ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>{p}</button>
          ))}
        </div>
        {isLoading ? <div className="loading-spinner"><div className="spinner" />Loading chart...</div> : <StockPriceChart data={stockData} onDatePick={handleDatePick} />}
      </div>
    ),
    'indicators': <IndicatorsWidget summary={summary} />,
    'action-card': <ActionCardWidget summary={summary} />,
    'earnings-warning': <EarningsWidget symbol={symbol} />,
    'related-stocks': <RelatedStocksWidget symbol={symbol} />,
    'macro-events': <StockMacroEventsWidget symbol={symbol} />,
    'signals-list': <SignalsListWidget summary={summary} />,
    'fundamentals': <FundamentalsWidget symbol={symbol} onCompanyName={setCompanyName} />,
    'insider-trading': <InsiderTradingWidget symbol={symbol} />,
    'mini-news': <MiniNewsWidget symbol={symbol} />,
    'social-trending': <SocialTrendingWidget symbol={symbol} />,
    'position-sizing': <PositionSizingWidget symbol={symbol} />,
    'notes': <NotesWidget symbol={symbol} />,
    'trade-calculator': <TradeCalculatorWidget symbol={symbol} entryDate={calcEntryDate} exitDate={calcExitDate} onEntryDate={setCalcEntryDate} onExitDate={setCalcExitDate} />,
    'simulations': <SavedSimulationsWidget symbol={symbol} />,
    'llm-result': <LLMAnalysisWidget symbol={symbol} />,
  };

  const widgets = layout.map(item => ({
    id: item.i,
    header: WIDGET_TITLES[item.i] || item.i,
    content: <ErrorBoundary>{widgetContent[item.i] || null}</ErrorBoundary>,
  }));

  return (
    <div className="page-content">
      <div className="page-header" style={{ marginBottom: 16 }}>
        <h2>{symbol}</h2>
        {companyName && <div className="text-muted" style={{ fontSize: '0.9rem' }}>{companyName}</div>}
      </div>

      <WidgetGrid
        widgets={widgets}
        layout={layout}
        onLayoutChange={onLayoutChange}
        editMode={editMode}
        onToggleEdit={toggleEditMode}
        onReset={resetLayout}
      />
    </div>
  );
}
