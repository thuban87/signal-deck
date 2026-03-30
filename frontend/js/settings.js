/* =====================================================================
   Settings — Application configuration page
   ===================================================================== */

const Settings = {
    settings: {},
    loading: false,

    async render(container) {
        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h1>Settings</h1>
                    <p class="page-subtitle">Configure scans, thresholds, and preferences</p>
                </div>
            </div>

            <div id="settings-content"><div class="loading-spinner"></div></div>
        `;

        await this.loadSettings();
    },

    async loadSettings() {
        const content = document.getElementById('settings-content');
        try {
            this.settings = await App.get('/api/settings') || {};
            this._renderSettings(content);
        } catch (e) {
            content.innerHTML = `<div class="empty-state"><p>Error loading settings: ${App.escapeHtml(e.message)}</p></div>`;
        }
    },

    _renderSettings(container) {
        const s = this.settings;

        container.innerHTML = `
            <div class="settings-grid">
                <!-- Social Momentum Settings -->
                <div class="card settings-card">
                    <div class="card-header">
                        <h3>Social Momentum (Reddit)</h3>
                        <span class="settings-status ${s.reddit_configured ? 'configured' : 'not-configured'}">
                            ${s.reddit_configured ? 'Configured' : 'Not Configured'}
                        </span>
                    </div>
                    <div class="settings-body">
                        <div class="setting-row">
                            <div class="setting-info">
                                <label>Scan Interval (hours)</label>
                                <p class="text-muted">How often to automatically scan Reddit for trending tickers</p>
                            </div>
                            <input type="number" class="setting-input" id="setting-social_scan_interval_hours"
                                   value="${App.escapeHtml(s.social_scan_interval_hours || '4')}" min="1" max="24">
                        </div>
                        <div class="setting-row">
                            <div class="setting-info">
                                <label>Mention Threshold</label>
                                <p class="text-muted">Minimum mentions to flag a ticker as trending</p>
                            </div>
                            <input type="number" class="setting-input" id="setting-social_mention_threshold"
                                   value="${App.escapeHtml(s.social_mention_threshold || '5')}" min="1" max="100">
                        </div>
                        <div class="setting-row">
                            <div class="setting-info">
                                <label>Spike Ratio</label>
                                <p class="text-muted">Threshold multiplier vs 7-day average for spike detection</p>
                            </div>
                            <input type="number" class="setting-input" id="setting-social_spike_ratio"
                                   value="${App.escapeHtml(s.social_spike_ratio || '2.0')}" min="1" max="10" step="0.5">
                        </div>
                        <div class="setting-row">
                            <div class="setting-info">
                                <label>Subreddits</label>
                                <p class="text-muted">Comma-separated list of subreddits to scan</p>
                            </div>
                            <input type="text" class="setting-input setting-input-wide" id="setting-social_subreddits"
                                   value="${App.escapeHtml(s.social_subreddits || 'wallstreetbets,stocks,investing,options')}">
                        </div>
                    </div>
                </div>

                <!-- Options Flow Settings -->
                <div class="card settings-card">
                    <div class="card-header">
                        <h3>Options Flow</h3>
                    </div>
                    <div class="settings-body">
                        <div class="setting-row">
                            <div class="setting-info">
                                <label>Vol/OI Threshold (%)</label>
                                <p class="text-muted">Flag options where Volume/Open Interest exceeds this percentage</p>
                            </div>
                            <input type="number" class="setting-input" id="setting-options_flow_vol_oi_threshold"
                                   value="${App.escapeHtml(s.options_flow_vol_oi_threshold || '500')}" min="100" max="5000" step="50">
                        </div>
                        <div class="setting-row">
                            <div class="setting-info">
                                <label>Premium Threshold ($)</label>
                                <p class="text-muted">Flag options with total premium volume above this dollar amount</p>
                            </div>
                            <input type="number" class="setting-input" id="setting-options_flow_premium_threshold"
                                   value="${App.escapeHtml(s.options_flow_premium_threshold || '1000000')}" min="10000" step="100000">
                        </div>
                        <div class="setting-row">
                            <div class="setting-info">
                                <label>S&P 500 Daily Scan</label>
                                <p class="text-muted">Enable automatic daily scan of all S&P 500 options chains</p>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" id="setting-options_sp500_scan_enabled"
                                       ${s.options_sp500_scan_enabled === 'true' ? 'checked' : ''}>
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                        <div class="setting-row">
                            <div class="setting-info">
                                <label>S&P 500 Scan Time</label>
                                <p class="text-muted">Time of day to run the S&P 500 options scan (24h format)</p>
                            </div>
                            <input type="time" class="setting-input" id="setting-options_sp500_scan_time"
                                   value="${App.escapeHtml(s.options_sp500_scan_time || '09:45')}">
                        </div>
                    </div>
                </div>

                <!-- Matchmaker Settings -->
                <div class="card settings-card">
                    <div class="card-header">
                        <h3>Matchmaker</h3>
                    </div>
                    <div class="settings-body">
                        <div class="setting-row">
                            <div class="setting-info">
                                <label>Reset Dismissed After (days)</label>
                                <p class="text-muted">Dismissed stocks reappear after this many days</p>
                            </div>
                            <input type="number" class="setting-input" id="setting-matchmaker_reset_days"
                                   value="${App.escapeHtml(s.matchmaker_reset_days || '7')}" min="1" max="90">
                        </div>
                    </div>
                </div>
            </div>

            <div class="settings-actions">
                <button class="btn btn-primary" id="settings-save-btn">Save Settings</button>
                <button class="btn btn-ghost" id="settings-reset-btn">Reset to Defaults</button>
            </div>
        `;

        // Save
        document.getElementById('settings-save-btn').addEventListener('click', () => this.saveSettings());
        document.getElementById('settings-reset-btn').addEventListener('click', () => this.resetSettings());
    },

    async saveSettings() {
        const settings = {};
        const inputs = document.querySelectorAll('[id^="setting-"]');
        inputs.forEach(input => {
            const key = input.id.replace('setting-', '');
            if (input.type === 'checkbox') {
                settings[key] = input.checked ? 'true' : 'false';
            } else {
                settings[key] = input.value;
            }
        });

        try {
            await App.put('/api/settings', settings);
            App.toast('Settings saved', 'success');
        } catch (e) {
            App.toast('Failed to save: ' + e.message, 'error');
        }
    },

    async resetSettings() {
        if (!confirm('Reset all settings to defaults?')) return;
        try {
            const defaults = {
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
            await App.put('/api/settings', defaults);
            App.toast('Settings reset to defaults', 'success');
            await this.loadSettings();
        } catch (e) {
            App.toast('Failed to reset: ' + e.message, 'error');
        }
    },
};
