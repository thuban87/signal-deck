import { usePaperAccount } from '../../hooks/usePaperTrading';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import { formatPrice } from '../../utils/formatters';
import { useAppStore } from '../../stores/appStore';

function BalanceRow({ label, value, isCurrency = true, color }) {
  return (
    <tr>
      <td style={{ fontWeight: 500, padding: '10px 16px' }}>{label}</td>
      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, textAlign: 'right', padding: '10px 16px', color: color || 'var(--text-primary)' }}>
        {isCurrency ? formatPrice(value) : value}
      </td>
    </tr>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <h3 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', paddingLeft: '16px' }}>{title}</h3>
      <table className="data-table" style={{ width: '100%' }}>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export default function BalancesTab() {
  const { data: account, isLoading } = usePaperAccount();
  const addToast = useAppStore(s => s.addToast);

  if (isLoading) return <LoadingSkeleton type="card" />;
  if (!account) return <div style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Account data unavailable</div>;

  const todayPL = Number(account.today_pl) || (Number(account.equity) - Number(account.last_equity));
  const todayPLPct = Number(account.today_pl_pct) || (account.last_equity ? ((Number(account.equity) - Number(account.last_equity)) / Number(account.last_equity) * 100) : 0);

  const exportMarkdown = () => {
    const now = new Date().toISOString().split('T')[0];
    const lines = [
      `# Paper Trading Balances — ${now}`,
      '',
      '## Account Summary',
      `| Metric | Value |`,
      `| --- | --- |`,
      `| Status | ${account.status || 'active'} |`,
      `| Account Number | ${account.account_number || '—'} |`,
      `| Currency | ${account.currency || 'USD'} |`,
      `| Margin Multiplier | ${account.multiplier || 1}× |`,
      '',
      '## Equity',
      `| Metric | Value |`,
      `| --- | --- |`,
      `| Portfolio Value | ${formatPrice(account.portfolio_value)} |`,
      `| Equity | ${formatPrice(account.equity)} |`,
      `| Last Equity | ${formatPrice(account.last_equity)} |`,
      `| Today P&L | ${todayPL >= 0 ? '+' : ''}${formatPrice(todayPL)} (${todayPLPct >= 0 ? '+' : ''}${todayPLPct.toFixed(2)}%) |`,
      '',
      '## Cash & Buying Power',
      `| Metric | Value |`,
      `| --- | --- |`,
      `| Cash | ${formatPrice(account.cash)} |`,
      `| Buying Power | ${formatPrice(account.buying_power)} |`,
      `| RegT Buying Power | ${formatPrice(account.regt_buying_power)} |`,
      `| Day Trading Buying Power | ${formatPrice(account.daytrading_buying_power)} |`,
      `| Non-Marginable Buying Power | ${formatPrice(account.non_marginable_buying_power)} |`,
      '',
      '## Margin',
      `| Metric | Value |`,
      `| --- | --- |`,
      `| Initial Margin | ${formatPrice(account.initial_margin)} |`,
      `| Maintenance Margin | ${formatPrice(account.maintenance_margin)} |`,
      `| SMA | ${formatPrice(account.sma)} |`,
      '',
      '## Exposure',
      `| Metric | Value |`,
      `| --- | --- |`,
      `| Long Market Value | ${formatPrice(account.long_market_value)} |`,
      `| Short Market Value | ${formatPrice(account.short_market_value)} |`,
      '',
      '## Transfers & Fees',
      `| Metric | Value |`,
      `| --- | --- |`,
      `| Pending Transfer In | ${formatPrice(account.pending_transfer_in)} |`,
      `| Pending Transfer Out | ${formatPrice(account.pending_transfer_out)} |`,
      `| Accrued Fees | ${formatPrice(account.accrued_fees)} |`,
      '',
      '## Trading Status',
      `| Metric | Value |`,
      `| --- | --- |`,
      `| Day Trades (5-day) | ${account.daytrade_count ?? '—'} |`,
      `| Pattern Day Trader | ${account.pattern_day_trader ? 'Yes' : 'No'} |`,
      `| Shorting Enabled | ${account.shorting_enabled ? 'Yes' : 'No'} |`,
      `| Trading Blocked | ${account.trading_blocked ? 'Yes' : 'No'} |`,
      `| Transfers Blocked | ${account.transfers_blocked ? 'Yes' : 'No'} |`,
      `| Account Blocked | ${account.account_blocked ? 'Yes' : 'No'} |`,
    ];

    const md = lines.join('\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paper-balances-${now}.md`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Balances exported as Markdown', 'success');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn btn-sm btn-ghost" onClick={exportMarkdown}>📄 Export as Markdown</button>
      </div>

      <Section title="Account Summary">
        <BalanceRow label="Status" value={account.status || 'active'} isCurrency={false} />
        <BalanceRow label="Account Number" value={account.account_number || '—'} isCurrency={false} />
        <BalanceRow label="Currency" value={account.currency || 'USD'} isCurrency={false} />
        <BalanceRow label="Margin Multiplier" value={`${account.multiplier || 1}×`} isCurrency={false} />
        {account.created_at && <BalanceRow label="Account Created" value={new Date(account.created_at).toLocaleDateString()} isCurrency={false} />}
      </Section>

      <Section title="Equity">
        <BalanceRow label="Portfolio Value" value={account.portfolio_value} />
        <BalanceRow label="Equity" value={account.equity} />
        <BalanceRow label="Last Equity (prev close)" value={account.last_equity} />
        <BalanceRow label="Today P&L" value={`${todayPL >= 0 ? '+' : ''}${formatPrice(todayPL)} (${todayPLPct >= 0 ? '+' : ''}${todayPLPct.toFixed(2)}%)`} isCurrency={false} color={todayPL >= 0 ? 'var(--bullish)' : 'var(--bearish)'} />
      </Section>

      <Section title="Cash & Buying Power">
        <BalanceRow label="Cash" value={account.cash} />
        <BalanceRow label="Buying Power" value={account.buying_power} />
        <BalanceRow label="RegT Buying Power" value={account.regt_buying_power} />
        <BalanceRow label="Day Trading Buying Power" value={account.daytrading_buying_power} />
        <BalanceRow label="Non-Marginable Buying Power" value={account.non_marginable_buying_power} />
      </Section>

      <Section title="Margin">
        <BalanceRow label="Initial Margin" value={account.initial_margin} />
        <BalanceRow label="Maintenance Margin" value={account.maintenance_margin} />
        <BalanceRow label="SMA" value={account.sma} />
      </Section>

      <Section title="Exposure">
        <BalanceRow label="Long Market Value" value={account.long_market_value} />
        <BalanceRow label="Short Market Value" value={account.short_market_value} />
      </Section>

      <Section title="Transfers & Fees">
        <BalanceRow label="Pending Transfer In" value={account.pending_transfer_in} />
        <BalanceRow label="Pending Transfer Out" value={account.pending_transfer_out} />
        <BalanceRow label="Accrued Fees" value={account.accrued_fees} />
      </Section>

      <Section title="Trading Status">
        <BalanceRow label="Day Trades (5-day)" value={account.daytrade_count ?? '—'} isCurrency={false} />
        <BalanceRow label="Pattern Day Trader" value={account.pattern_day_trader ? 'Yes' : 'No'} isCurrency={false} />
        <BalanceRow label="Shorting Enabled" value={account.shorting_enabled ? 'Yes' : 'No'} isCurrency={false} />
        <BalanceRow label="Trading Blocked" value={account.trading_blocked ? 'Yes' : 'No'} isCurrency={false} color={account.trading_blocked ? 'var(--bearish)' : undefined} />
        <BalanceRow label="Transfers Blocked" value={account.transfers_blocked ? 'Yes' : 'No'} isCurrency={false} color={account.transfers_blocked ? 'var(--bearish)' : undefined} />
        <BalanceRow label="Account Blocked" value={account.account_blocked ? 'Yes' : 'No'} isCurrency={false} color={account.account_blocked ? 'var(--bearish)' : undefined} />
        {account.crypto_status && <BalanceRow label="Crypto Status" value={account.crypto_status} isCurrency={false} />}
      </Section>
    </div>
  );
}
