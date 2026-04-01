import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patch } from '../../api/client';
import { usePaperConfigurations } from '../../hooks/usePaperTrading';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import { useAppStore } from '../../stores/appStore';

const labelStyle = { fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' };

function ConfigToggle({ label, description, checked, onChange }) {
  const nameSlug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <div>
        <div style={{ fontWeight: 500 }}>{label}</div>
        {description && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{description}</div>}
      </div>
      <label style={{ position: 'relative', width: '44px', height: '24px', cursor: 'pointer' }}>
        <input type="checkbox" name={`config-${nameSlug}`} checked={checked} onChange={e => onChange(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
        <span style={{
          position: 'absolute', inset: 0, borderRadius: '12px',
          background: checked ? 'var(--accent)' : 'var(--bg-tertiary)',
          transition: 'background 0.2s',
        }}>
          <span style={{
            position: 'absolute', top: '2px', left: checked ? '22px' : '2px',
            width: '20px', height: '20px', borderRadius: '50%',
            background: 'white', transition: 'left 0.2s',
          }} />
        </span>
      </label>
    </div>
  );
}

function ConfigSelect({ label, description, value, onChange, options }) {
  const nameSlug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 500 }}>{label}</div>
          {description && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{description}</div>}
        </div>
        <select name={`config-${nameSlug}`} className="input" style={{ width: 'auto', fontSize: '0.8rem', padding: '4px 8px' }} value={value || ''} onChange={e => onChange(e.target.value)}>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    </div>
  );
}

export default function ConfigureTab() {
  const { data: config, isLoading } = usePaperConfigurations();
  const [draft, setDraft] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const addToast = useAppStore(s => s.addToast);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (config && !draft) {
      setDraft({ ...config });
    }
  }, [config, draft]);

  const saveConfig = useMutation({
    mutationFn: (updates) => patch('/api/paper/configurations', updates),
    onSuccess: (data) => {
      addToast('Configuration saved', 'success');
      setDraft(data);
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['paper-configurations'] });
    },
    onError: (err) => addToast(err.message, 'error'),
  });

  if (isLoading) return <LoadingSkeleton type="card" />;
  if (!draft) return <div style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Configuration unavailable</div>;

  const update = (key, value) => {
    setDraft(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    const changes = {};
    for (const key of Object.keys(draft)) {
      if (config && draft[key] !== config[key]) {
        changes[key] = draft[key];
      }
    }
    if (Object.keys(changes).length > 0) {
      saveConfig.mutate(changes);
    }
  };

  const handleReset = () => {
    if (config) {
      setDraft({ ...config });
      setHasChanges(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px' }}>
      <ConfigToggle
        label="Fractional Trading"
        description="Allow buying/selling fractional shares"
        checked={draft.fractional_trading}
        onChange={v => update('fractional_trading', v)}
      />
      <ConfigToggle
        label="Suspend Trading"
        description="Block all new orders when enabled"
        checked={draft.suspend_trade}
        onChange={v => update('suspend_trade', v)}
      />
      <ConfigToggle
        label="No Shorting"
        description="Long-only mode — block short sells"
        checked={draft.no_shorting}
        onChange={v => update('no_shorting', v)}
      />
      <ConfigSelect
        label="Max Margin Multiplier"
        description="Margin leverage limit"
        value={draft.max_margin_multiplier}
        onChange={v => update('max_margin_multiplier', v)}
        options={[
          { value: '1', label: '1x (no margin)' },
          { value: '2', label: '2x' },
          { value: '4', label: '4x (day trade)' },
        ]}
      />
      <ConfigSelect
        label="Trade Confirm Email"
        description="Email notifications for filled orders"
        value={draft.trade_confirm_email}
        onChange={v => update('trade_confirm_email', v)}
        options={[
          { value: 'all', label: 'All' },
          { value: 'none', label: 'None' },
        ]}
      />
      <ConfigSelect
        label="DTBP Check"
        description="Day Trading Buying Power check enforcement"
        value={draft.dtbp_check}
        onChange={v => update('dtbp_check', v)}
        options={[
          { value: 'both', label: 'Both (entry & exit)' },
          { value: 'entry', label: 'Entry only' },
          { value: 'exit', label: 'Exit only' },
        ]}
      />
      <ConfigSelect
        label="Max Options Trading Level"
        description="Highest options strategy level allowed"
        value={String(draft.max_options_trading_level ?? 0)}
        onChange={v => update('max_options_trading_level', parseInt(v))}
        options={[
          { value: '0', label: '0 — Disabled' },
          { value: '1', label: '1 — Covered Calls / Cash-Secured Puts' },
          { value: '2', label: '2 — Long Calls / Puts' },
          { value: '3', label: '3 — Spreads / Straddles' },
        ]}
      />

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={!hasChanges || saveConfig.isPending}>
          {saveConfig.isPending ? 'Saving...' : 'Save Changes'}
        </button>
        {hasChanges && (
          <button className="btn btn-ghost" onClick={handleReset}>Reset</button>
        )}
      </div>
    </div>
  );
}
