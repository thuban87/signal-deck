import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { post } from '../../api/client';
import { formatPrice } from '../../utils/formatters';
import { useAppStore } from '../../stores/appStore';

export default function PositionSizingWidget({ symbol }) {
  const [accountSize, setAccountSize] = useState(200000);
  const [riskPct, setRiskPct] = useState(2);
  const toast = useAppStore(s => s.addToast);

  const { mutate, data: result, isPending } = useMutation({
    mutationFn: () => post('/api/position-size', { account_size: accountSize, risk_pct: riskPct, symbol }),
    onError: (err) => toast(err.message, 'error'),
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: '0.75rem' }}>Account Size ($)</label>
          <input type="number" value={accountSize} onChange={e => setAccountSize(Number(e.target.value))} style={{ width: 120 }} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: '0.75rem' }}>Risk %</label>
          <input type="number" value={riskPct} onChange={e => setRiskPct(Number(e.target.value))} step="0.5" min="0.5" max="10" style={{ width: 70 }} />
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => mutate()} disabled={isPending}>{isPending ? 'Calculating...' : 'Calculate'}</button>
      </div>

      {result && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, fontSize: '0.85rem' }}>
          {[
            ['Shares', result.shares],
            ['Entry', formatPrice(result.entry_price)],
            ['Stop Loss', formatPrice(result.stop_loss)],
            ['Take Profit', formatPrice(result.take_profit)],
            ['Risk $', formatPrice(result.risk_amount)],
            ['Position', formatPrice(result.position_value)],
            ['% of Account', `${result.pct_of_account?.toFixed(1)}%`],
            ['ATR', formatPrice(result.atr)],
          ].map(([label, value]) => (
            <div key={label} className="indicator-card" style={{ padding: 8, textAlign: 'center' }}>
              <div className="indicator-label">{label}</div>
              <div className="text-mono" style={{ fontWeight: 600 }}>{value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
