import { useQuery } from '@tanstack/react-query';
import { get } from '../../api/client';
import { formatNumber } from '../../utils/formatters';

function fmt(val, type) {
  if (val == null) return '\u2014';
  if (type === 'pct') return `${(val * 100).toFixed(2)}%`;
  if (type === 'dollar') return `$${val.toFixed(2)}`;
  if (type === 'ratio') return val.toFixed(2);
  if (type === 'money') return formatNumber(val);
  return String(val);
}

const METRIC_TOOLTIPS = {
  'P/E Ratio': 'Price-to-Earnings \u2014 how much investors pay per dollar of earnings. Lower may indicate undervaluation.',
  'Forward P/E': 'Forward Price-to-Earnings \u2014 based on projected future earnings. Lower suggests better value.',
  'EPS': 'Earnings Per Share \u2014 company profit divided by outstanding shares. Higher is better.',
  'PEG Ratio': 'Price/Earnings-to-Growth \u2014 P/E adjusted for growth rate. Below 1.0 may be undervalued.',
  'Debt/Equity': 'Total debt relative to shareholder equity. Lower means less leveraged.',
  'Free Cash Flow': 'Cash generated after capital expenditures. Positive FCF indicates financial health.',
  'Div Yield': 'Dividend Yield \u2014 annual dividend as a percentage of stock price.',
  'Profit Margin': 'Net income as a percentage of revenue. Higher margins indicate better efficiency.',
  'ROE': 'Return on Equity \u2014 net income as a percentage of shareholder equity. Measures management effectiveness.',
  'Beta': 'Stock volatility relative to the market. >1 means more volatile, <1 means less.',
  'Market Cap': 'Total market value of outstanding shares.',
  '52W Range': '52-week price range showing the lowest and highest prices over the past year.',
};

export default function FundamentalsWidget({ symbol, onCompanyName }) {
  const { data, isLoading } = useQuery({
    queryKey: ['fundamentals', symbol],
    queryFn: async () => {
      const res = await get(`/api/stock/${symbol}/fundamentals`);
      if (res?.company_name && onCompanyName) onCompanyName(res.company_name);
      return res;
    },
    staleTime: 30 * 60 * 1000,
  });

  if (isLoading) return <div className="loading-text">Loading fundamentals...</div>;
  if (!data) return <div className="text-muted" style={{ padding: 12, fontSize: '0.85rem' }}>No fundamental data</div>;

  const metrics = [
    { label: 'P/E Ratio', value: fmt(data.pe_ratio, 'ratio') },
    { label: 'Forward P/E', value: fmt(data.forward_pe, 'ratio') },
    { label: 'EPS', value: fmt(data.eps, 'dollar') },
    { label: 'PEG Ratio', value: fmt(data.peg_ratio, 'ratio') },
    { label: 'Debt/Equity', value: fmt(data.debt_to_equity, 'ratio') },
    { label: 'Free Cash Flow', value: fmt(data.free_cash_flow, 'money') },
    { label: 'Div Yield', value: data.dividend_yield != null ? `${(data.dividend_yield * 100).toFixed(2)}%` : '\u2014' },
    { label: 'Profit Margin', value: fmt(data.profit_margin, 'pct') },
    { label: 'ROE', value: fmt(data.roe || data.return_on_equity, 'pct') },
    { label: 'Beta', value: fmt(data.beta, 'ratio') },
    { label: 'Market Cap', value: fmt(data.market_cap, 'money') },
    { label: '52W Range', value: data.fifty_two_week_low != null && data.fifty_two_week_high != null
        ? `$${Number(data.fifty_two_week_low).toFixed(2)} \u2014 $${Number(data.fifty_two_week_high).toFixed(2)}`
        : '\u2014' },
  ];

  return (
    <div>
      {(data.sector || data.industry) && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>
          {data.sector}{data.industry ? ` \u2014 ${data.industry}` : ''}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
        {metrics.map(m => (
          <div key={m.label} className="indicator-card" title={METRIC_TOOLTIPS[m.label] || m.label}>
            <div className="indicator-label">
              {m.label}
              <span className="tooltip-icon" title={METRIC_TOOLTIPS[m.label]}>{'\u24D8'}</span>
            </div>
            <div className="indicator-value text-mono">{m.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
