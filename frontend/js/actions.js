/**
 * Trade Ideas page — Buy/Sell/Hold recommendations for watchlist symbols.
 */
const Actions = {
    data: [],
    filterAction: 'all',
    lookbackDays: 5,
    expandedSymbol: null,

    async render(container) {
        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h2>Trade Ideas</h2>
                    <p class="text-secondary">Actionable recommendations based on signal analysis</p>
                </div>
                <div style="display:flex;gap:8px">
                    <button class="btn btn-ghost btn-sm" id="actions-refresh" title="Refresh">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="23 4 23 10 17 10"></polyline>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                        </svg>
                        Refresh
                    </button>
                </div>
            </div>

            <div class="filter-bar">
                <div class="form-group">
                    <label>Action</label>
                    <select id="actions-filter-action">
                        <option value="all">All</option>
                        <option value="BUY">BUY only</option>
                        <option value="SELL">SELL only</option>
                        <option value="HOLD">HOLD only</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Lookback</label>
                    <select id="actions-lookback">
                        <option value="3">3 days</option>
                        <option value="5" selected>5 days</option>
                        <option value="7">7 days</option>
                        <option value="14">14 days</option>
                    </select>
                </div>
            </div>

            <div id="actions-summary" class="actions-summary"></div>
            <div id="actions-grid" class="actions-grid">
                <div class="loading-spinner"><div class="spinner"></div>Analyzing watchlist...</div>
            </div>
            <div id="actions-updated" class="text-muted" style="margin-top:12px;font-size:0.75rem"></div>
        `;

        document.getElementById('actions-refresh').addEventListener('click', () => this.loadData());
        document.getElementById('actions-filter-action').addEventListener('change', (e) => {
            this.filterAction = e.target.value;
            this.renderContent();
        });
        document.getElementById('actions-lookback').addEventListener('change', (e) => {
            this.lookbackDays = parseInt(e.target.value);
            this.loadData();
        });

        await this.loadData();
    },

    async loadData() {
        const grid = document.getElementById('actions-grid');
        if (grid) grid.innerHTML = '<div class="loading-spinner"><div class="spinner"></div>Analyzing watchlist...</div>';

        try {
            this.data = await App.get(`/api/actions?days=${this.lookbackDays}`);
            this.expandedSymbol = null;
            this.renderContent();
            const updated = document.getElementById('actions-updated');
            if (updated) updated.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
        } catch (err) {
            const grid = document.getElementById('actions-grid');
            if (grid) grid.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${App.escapeHtml(err.message)}</p></div>`;
        }
    },

    renderContent() {
        const grid = document.getElementById('actions-grid');
        const summaryEl = document.getElementById('actions-summary');
        if (!grid) return;

        // Filter
        const filtered = this.filterAction === 'all'
            ? this.data
            : this.data.filter(d => d.action === this.filterAction);

        // Summary counts
        const buyCount = this.data.filter(d => d.action === 'BUY').length;
        const sellCount = this.data.filter(d => d.action === 'SELL').length;
        const holdCount = this.data.filter(d => d.action === 'HOLD').length;

        if (summaryEl) {
            summaryEl.innerHTML = `
                <div class="actions-summary-stat"><span style="color:var(--green)">&#9650;</span> ${buyCount} BUY</div>
                <div class="actions-summary-stat"><span style="color:var(--red)">&#9660;</span> ${sellCount} SELL</div>
                <div class="actions-summary-stat"><span style="color:var(--text-muted)">&#9644;</span> ${holdCount} HOLD</div>
            `;
        }

        if (filtered.length === 0) {
            grid.innerHTML = `<div class="empty-state"><h3>No results</h3><p>No symbols match the selected filter.</p></div>`;
            return;
        }

        grid.innerHTML = filtered.map(item => this.renderCard(item)).join('');

        // Attach click handlers
        grid.querySelectorAll('.action-card[data-symbol]').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't toggle if clicking the "View Analysis" link
                if (e.target.closest('a')) return;
                const sym = card.dataset.symbol;
                this.expandedSymbol = this.expandedSymbol === sym ? null : sym;
                this.renderContent();
            });
        });
    },

    renderCard(item) {
        const actionClass = item.action.toLowerCase();
        const isExpanded = this.expandedSymbol === item.symbol;
        const changePct = item.change_pct != null ? item.change_pct : 0;
        const changeClass = changePct >= 0 ? 'positive' : 'negative';
        const changeSign = changePct >= 0 ? '+' : '';
        const signalCount = (item.signals || []).length;

        let detailHtml = '';
        if (isExpanded) {
            detailHtml = this.renderDetail(item);
        }

        return `
            <div class="action-card action-${actionClass}" data-symbol="${App.escapeHtml(item.symbol)}">
                <div class="action-card-header">
                    <div>
                        <div class="action-card-symbol">${App.escapeHtml(item.symbol)}</div>
                        <span class="stat-card-value ${changeClass}" style="font-size:0.85rem">${changeSign}${changePct.toFixed(2)}%</span>
                    </div>
                    <div style="text-align:right">
                        <div class="action-label ${actionClass}">${item.action}</div>
                        <div class="confidence-badge ${item.confidence.toLowerCase()}">${item.confidence}</div>
                    </div>
                </div>
                <div class="action-card-meta">
                    <span style="font-weight:700;color:var(--text-primary)">${item.price != null ? App.formatPrice(item.price) : '—'}</span>
                    <span class="trend-badge ${item.trend === 'bullish' ? 'bullish' : item.trend === 'bearish' ? 'bearish' : ''}">${item.trend || '—'}</span>
                    <span>RSI ${item.rsi != null ? item.rsi.toFixed(1) : '—'}</span>
                    <span>${signalCount} signal${signalCount !== 1 ? 's' : ''}</span>
                </div>
                ${detailHtml}
            </div>
        `;
    },

    renderDetail(item) {
        const signals = item.signals || [];
        const ind = item.indicator_summary || {};

        let signalsHtml = '';
        if (signals.length > 0) {
            signalsHtml = `
                <div style="margin-bottom:8px;font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">Recent Signals</div>
                <div class="detail-signals">
                    ${signals.map(s => {
                        const isBull = s.direction !== 'short';
                        return `<div class="detail-signal-item ${isBull ? 'bullish' : 'bearish'}">
                            <span>${App.escapeHtml(s.signal)}</span>
                            <span class="text-muted" style="font-size:0.75rem">${s.days_ago === 0 ? 'Today' : s.days_ago + 'd ago'}</span>
                        </div>`;
                    }).join('')}
                </div>
            `;
        } else {
            signalsHtml = '<div class="text-muted" style="font-size:0.8rem;margin-bottom:12px">No recent signals fired</div>';
        }

        const fmtInd = (val, decimals = 2) => val != null ? Number(val).toFixed(decimals) : '—';

        return `
            <div class="action-card-detail">
                ${signalsHtml}

                <div style="margin-bottom:8px;font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">Key Indicators</div>
                <div class="detail-indicators-grid">
                    <div class="detail-indicator">
                        <div class="detail-indicator-label">RSI</div>
                        <div class="detail-indicator-value ${ind.rsi < 30 ? 'text-green' : ind.rsi > 70 ? 'text-red' : ''}">${fmtInd(ind.rsi, 1)}</div>
                    </div>
                    <div class="detail-indicator">
                        <div class="detail-indicator-label">MACD</div>
                        <div class="detail-indicator-value">${fmtInd(ind.macd, 4)}</div>
                    </div>
                    <div class="detail-indicator">
                        <div class="detail-indicator-label">ADX</div>
                        <div class="detail-indicator-value">${fmtInd(ind.adx, 1)}</div>
                    </div>
                    <div class="detail-indicator">
                        <div class="detail-indicator-label">Stoch %K</div>
                        <div class="detail-indicator-value">${fmtInd(ind.stoch_k, 1)}</div>
                    </div>
                    <div class="detail-indicator">
                        <div class="detail-indicator-label">ATR</div>
                        <div class="detail-indicator-value">${fmtInd(ind.atr)}</div>
                    </div>
                    <div class="detail-indicator">
                        <div class="detail-indicator-label">Vol Ratio</div>
                        <div class="detail-indicator-value">${fmtInd(ind.volume_ratio)}</div>
                    </div>
                    <div class="detail-indicator">
                        <div class="detail-indicator-label">OBV Trend</div>
                        <div class="detail-indicator-value">${ind.obv_trend || '—'}</div>
                    </div>
                    <div class="detail-indicator">
                        <div class="detail-indicator-label">Trend</div>
                        <div class="detail-indicator-value ${ind.trend === 'bullish' ? 'text-green' : ind.trend === 'bearish' ? 'text-red' : ''}">${ind.trend || '—'}</div>
                    </div>
                </div>

                <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:12px">
                    ${App.escapeHtml(item.reasoning || '')}
                </div>

                <div style="display:flex;justify-content:space-between;align-items:center">
                    <span style="font-size:0.75rem;color:var(--text-muted)">
                        Bull: ${item.strong_bullish}s + ${item.support_bullish}sup &nbsp;|&nbsp;
                        Bear: ${item.strong_bearish}s + ${item.support_bearish}sup
                    </span>
                    <a href="#/stock/${App.escapeHtml(item.symbol)}" class="btn btn-ghost btn-sm" style="font-size:0.75rem">
                        View Full Analysis &rarr;
                    </a>
                </div>
            </div>
        `;
    },
};
