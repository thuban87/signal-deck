import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, put } from '../api/client';
import PageHeader from '../components/ui/PageHeader';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import { useAppStore } from '../stores/appStore';

const DEFAULTS = {
  social_scan_interval_hours: '4',
  social_mention_threshold: '5',
  social_spike_ratio: '2.0',
  social_subreddits: 'wallstreetbets,stocks,investing,options',
  options_flow_vol_oi_threshold: '500',
  options_flow_premium_threshold: '1000000',
  options_sp500_scan_enabled: 'false',
  options_sp500_scan_time: '09:45',
  matchmaker_reset_days: '7',
};

function SettingRow({ label, description, children }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>{label}</label>
      {description && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.15rem 0 0.4rem' }}>{description}</p>}
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const addToast = useAppStore(s => s.addToast);
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => get('/api/settings'),
    staleTime: 60 * 1000,
  });

  const [form, setForm] = useState({});

  useEffect(() => {
    if (settings) setForm({ ...DEFAULTS, ...settings });
  }, [settings]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    try {
      await put('/api/settings', form);
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      addToast('Settings saved', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to save', 'error');
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset all settings to defaults?')) return;
    try {
      await put('/api/settings', DEFAULTS);
      setForm({ ...DEFAULTS, reddit_configured: form.reddit_configured });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      addToast('Settings reset to defaults', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to reset', 'error');
    }
  };

  if (isLoading) return <div className="page-content"><LoadingSkeleton type="card" /></div>;

  return (
    <div className="page-content">
      <PageHeader title="Settings">
        <button className="btn btn-ghost" onClick={handleReset}>Reset to Defaults</button>
        <button className="btn btn-primary" onClick={handleSave}>Save Settings</button>
      </PageHeader>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 600 }}>
        {/* Social Momentum */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Social Momentum (Reddit)</h3>
            <span className="badge" style={{ background: form.reddit_configured ? 'var(--bullish)' : 'var(--bearish)', color: 'white' }}>
              {form.reddit_configured ? 'Configured' : 'Not Configured'}
            </span>
          </div>
          <SettingRow label="Scan Interval (hours)" description="How often to scan Reddit for ticker mentions">
            <input className="input" type="number" min="1" max="24" value={form.social_scan_interval_hours || ''} onChange={e => set('social_scan_interval_hours', e.target.value)} />
          </SettingRow>
          <SettingRow label="Mention Threshold" description="Minimum mentions to appear in results">
            <input className="input" type="number" min="1" max="100" value={form.social_mention_threshold || ''} onChange={e => set('social_mention_threshold', e.target.value)} />
          </SettingRow>
          <SettingRow label="Spike Ratio" description="Multiplier vs baseline to flag as trending">
            <input className="input" type="number" min="1" max="10" step="0.5" value={form.social_spike_ratio || ''} onChange={e => set('social_spike_ratio', e.target.value)} />
          </SettingRow>
          <SettingRow label="Subreddits" description="Comma-separated list of subreddits to scan">
            <input className="input" value={form.social_subreddits || ''} onChange={e => set('social_subreddits', e.target.value)} placeholder="wallstreetbets,stocks,investing,options" />
          </SettingRow>
        </div>

        {/* Options Flow */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem' }}>Options Flow</h3>
          <SettingRow label="Vol/OI Threshold (%)" description="Volume/Open Interest ratio to flag unusual activity">
            <input className="input" type="number" min="100" max="5000" step="50" value={form.options_flow_vol_oi_threshold || ''} onChange={e => set('options_flow_vol_oi_threshold', e.target.value)} />
          </SettingRow>
          <SettingRow label="Premium Threshold ($)" description="Minimum premium volume to flag whale trades">
            <input className="input" type="number" min="10000" step="100000" value={form.options_flow_premium_threshold || ''} onChange={e => set('options_flow_premium_threshold', e.target.value)} />
          </SettingRow>
          <SettingRow label="S&P 500 Daily Scan" description="Automatically scan S&P 500 options daily">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.options_sp500_scan_enabled === 'true' || form.options_sp500_scan_enabled === true} onChange={e => set('options_sp500_scan_enabled', e.target.checked ? 'true' : 'false')} />
              <span style={{ fontSize: '0.85rem' }}>Enabled</span>
            </label>
          </SettingRow>
          <SettingRow label="S&P 500 Scan Time" description="Time to run daily S&P 500 scan (24h format)">
            <input className="input" type="time" value={form.options_sp500_scan_time || '09:45'} onChange={e => set('options_sp500_scan_time', e.target.value)} />
          </SettingRow>
        </div>

        {/* Matchmaker */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem' }}>Matchmaker</h3>
          <SettingRow label="Reset Dismissed After (days)" description="Auto-resurface dismissed stocks after this many days">
            <input className="input" type="number" min="1" max="90" value={form.matchmaker_reset_days || ''} onChange={e => set('matchmaker_reset_days', e.target.value)} />
          </SettingRow>
        </div>
      </div>
    </div>
  );
}
