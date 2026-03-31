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
    ['P/E Ratio', fmt(data.pe_ratio, 'ratio')],
    ['EPS', fmt(data.eps, 'dollar')],
    ['PEG Ratio', fmt(data.peg_ratio, 'ratio')],
    ['Debt/Equity', fmt(data.debt_to_equity, 'ratio')],
    ['Free Cash Flow', fmt(data.free_cash_flow, 'money')],
    ['Div Yield', data.dividend_yield != null ? `${(data.dividend_yield * 100).toFixed(2)}%` : '\u2014'],
    ['Profit Margin', fmt(data.profit_margin, 'pct')],
    ['ROE', fmt(data.roe, 'pct')],
    ['Beta', fmt(data.beta, 'ratio')],
    ['Market Cap', fmt(data.market_cap, 'money')],
    ['52W High', fmt(data.fifty_two_week_high, 'dollar')],
    ['52W Low', fmt(data.fifty_two_week_low, 'dollar')],
  ];

  return (
    <div>
      {(data.sector || data.industry) && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>
          {data.sector}{data.industry ? ` \u2014 ${data.industry}` : ''}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 16px', fontSize: '0.85rem' }}>
        {metrics.map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="text-muted">{label}</span>
            <span className="text-mono">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
