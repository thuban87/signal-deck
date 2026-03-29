/* =====================================================================
   Signal Deck — Dashboard Page
   Watchlist overview with price cards and signal highlights
   ===================================================================== */

const Dashboard = {
    data: null,
    miniCharts: {},
    viewMode: 'cards',
    sortBy: 'symbol',
    sortDir: 'asc',
    filterTrend: 'all',
    filterSignals: 'all',

    async render(container) {
        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h2>Dashboard</h2>
                    <p>Your watchlist at a glance</p>
                </div>
                <div class="page-actions">
                    <button class="btn btn-primary btn-sm" id="add-symbol-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Add Symbol
                    </button>
                    <button class="btn btn-ghost btn-sm" id="refresh-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="23 4 23 10 17 10"></polyline>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                        </svg>
                        Refresh
                    </button>
                </div>
            </div>
            <div id="signal-alert-area"></div>

            <div class="dashboard-toolbar" id="dashboard-toolbar">
                <div class="view-toggle" id="view-toggle">
                    <button class="btn btn-ghost btn-sm view-btn ${this.viewMode === 'cards' ? 'active' : ''}" data-view="cards" title="Cards">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                            <rect x="3" y="3" width="7" height="7"></rect>
                            <rect x="14" y="3" width="7" height="7"></rect>
                            <rect x="3" y="14" width="7" height="7"></rect>
                            <rect x="14" y="14" width="7" height="7"></rect>
                        </svg>
                    </button>
                    <button class="btn btn-ghost btn-sm view-btn ${this.viewMode === 'table' ? 'active' : ''}" data-view="table" title="Table">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                            <line x1="3" y1="6" x2="21" y2="6"></line>
                            <line x1="3" y1="12" x2="21" y2="12"></line>
                            <line x1="3" y1="18" x2="21" y2="18"></line>
                        </svg>
                    </button>
                    <button class="btn btn-ghost btn-sm view-btn ${this.viewMode === 'compact' ? 'active' : ''}" data-view="compact" title="Compact">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                            <line x1="3" y1="5" x2="21" y2="5"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                            <line x1="3" y1="15" x2="21" y2="15"></line>
                            <line x1="3" y1="20" x2="21" y2="20"></line>
                        </svg>
                    </button>
                </div>
                <div class="filter-bar" style="margin-bottom:0">
                    <select id="dash-filter-trend">
                        <option value="all">All Trends</option>
                        <option value="bullish">Bullish</option>
                        <option value="bearish">Bearish</option>
                        <option value="neutral">Neutral</option>
                    </select>
                    <select id="dash-filter-signals">
                        <option value="all">All</option>
                        <option value="active">Has Signals</option>
                        <option value="none">No Signals</option>
                    </select>
                    <select id="dash-sort">
                        <option value="symbol">Sort: Symbol</option>
                        <option value="price">Sort: Price</option>
                        <option value="change_pct">Sort: Change %</option>
                        <option value="rsi">Sort: RSI</option>
                        <option value="adx">Sort: ADX</option>
                        <option value="signals">Sort: Signals</option>
                    </select>
                    <button class="btn btn-ghost btn-sm" id="dash-sort-dir" title="Toggle sort direction">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                            ${this.sortDir === 'asc'
                                ? '<polyline points="18 15 12 9 6 15"></polyline>'
                                : '<polyline points="6 9 12 15 18 9"></polyline>'}
                        </svg>
                    </button>
                </div>
            </div>

            <div id="watchlist-grid" class="watchlist-grid">
                <div class="loading-spinner"><div class="spinner"></div>Loading watchlist...</div>
            </div>
        `;

        document.getElementById('add-symbol-btn').addEventListener('click', () => {
            document.getElementById('add-symbol-modal').classList.remove('hidden');
            document.getElementById('add-symbol-input').value = '';
            document.getElementById('add-symbol-input').focus();
        });

        document.getElementById('refresh-btn').addEventListener('click', () => this.refresh());

        // View toggle
        document.getElementById('view-toggle').addEventListener('click', (e) => {
            const btn = e.target.closest('.view-btn');
            if (!btn) return;
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.viewMode = btn.dataset.view;
            this.renderContent();
        });

        // Filters & sort
        document.getElementById('dash-filter-trend').addEventListener('change', (e) => {
            this.filterTrend = e.target.value;
            this.renderContent();
        });
        document.getElementById('dash-filter-signals').addEventListener('change', (e) => {
            this.filterSignals = e.target.value;
            this.renderContent();
        });
        document.getElementById('dash-sort').addEventListener('change', (e) => {
            this.sortBy = e.target.value;
            this.renderContent();
        });
        document.getElementById('dash-sort-dir').addEventListener('click', () => {
            this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
            // Update arrow icon
            const btn = document.getElementById('dash-sort-dir');
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                    ${this.sortDir === 'asc'
                        ? '<polyline points="18 15 12 9 6 15"></polyline>'
                        : '<polyline points="6 9 12 15 18 9"></polyline>'}
                </svg>
            `;
            this.renderContent();
        });

        await this.loadData();
    },

    async refresh() {
        await this.loadData();
    },

    async loadData() {
        try {
            const [watchlistRes, signalsRes] = await Promise.all([
                App.get('/api/watchlist'),
                App.get('/api/signals/today'),
            ]);

            this.data = watchlistRes;
            this.renderSignalAlert(signalsRes || []);
            this.renderContent();
        } catch (err) {
            document.getElementById('watchlist-grid').innerHTML = `
                <div class="empty-state">
                    <h3>Failed to load</h3>
                    <p>${App.escapeHtml(err.message)}</p>
                </div>
            `;
        }
    },

    getFilteredSortedSymbols() {
        if (!this.data || !this.data.symbols) return [];
        let symbols = [...this.data.symbols];
        const data = this.data.data || {};

        // Filter by trend
        if (this.filterTrend !== 'all') {
            symbols = symbols.filter(s => {
                const d = data[s];
                if (!d) return false;
                if (this.filterTrend === 'neutral') return !d.trend || d.trend === 'neutral';
                return d.trend === this.filterTrend;
            });
        }

        // Filter by signal presence
        if (this.filterSignals === 'active') {
            symbols = symbols.filter(s => (data[s]?.signals || []).length > 0);
        } else if (this.filterSignals === 'none') {
            symbols = symbols.filter(s => (data[s]?.signals || []).length === 0);
        }

        // Sort
        symbols.sort((a, b) => {
            const da = data[a] || {}, db = data[b] || {};
            let valA, valB;

            switch (this.sortBy) {
                case 'price':
                    valA = da.price || 0; valB = db.price || 0; break;
                case 'change_pct':
                    valA = da.change_pct || 0; valB = db.change_pct || 0; break;
                case 'rsi':
                    valA = da.rsi || 0; valB = db.rsi || 0; break;
                case 'adx':
                    valA = da.adx || 0; valB = db.adx || 0; break;
                case 'signals':
                    valA = (da.signals || []).length; valB = (db.signals || []).length; break;
                default:
                    valA = a.toLowerCase(); valB = b.toLowerCase();
            }

            if (valA < valB) return this.sortDir === 'asc' ? -1 : 1;
            if (valA > valB) return this.sortDir === 'asc' ? 1 : -1;
            return 0;
        });

        return symbols;
    },

    renderContent() {
        if (!this.data) return;
        // Destroy old mini charts when switching views
        Object.values(this.miniCharts).forEach(c => { try { c.remove(); } catch(e) {} });
        this.miniCharts = {};

        const symbols = this.getFilteredSortedSymbols();
        const grid = document.getElementById('watchlist-grid');

        if (symbols.length === 0 && (!this.data.symbols || this.data.symbols.length === 0)) {
            grid.className = 'watchlist-grid';
            grid.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
                        <polyline points="16 7 22 7 22 13"></polyline>
                    </svg>
                    <h3>No symbols in watchlist</h3>
                    <p>Click "Add Symbol" to start tracking stocks</p>
                </div>
            `;
            return;
        }

        if (symbols.length === 0) {
            grid.className = 'watchlist-grid';
            grid.innerHTML = `
                <div class="empty-state">
                    <h3>No matches</h3>
                    <p>No symbols match the current filters</p>
                </div>
            `;
            return;
        }

        switch (this.viewMode) {
            case 'table': this.renderTable(symbols, grid); break;
            case 'compact': this.renderCompact(symbols, grid); break;
            default: this.renderCards(symbols, grid); break;
        }
    },

    renderCards(symbols, grid) {
        grid.className = 'watchlist-grid';
        const data = this.data.data || {};

        grid.innerHTML = symbols.map(symbol => {
            const d = data[symbol] || {};
            const changePct = d.change_pct || 0;
            const isPositive = changePct >= 0;
            const trendClass = (d.trend === 'bullish') ? 'bullish' : (d.trend === 'bearish' ? 'bearish' : '');
            const rsi = d.rsi;
            const rsiClass = App.rsiClass(rsi);
            const signalCount = (d.signals || []).length;
            const hasSignals = signalCount > 0;

            return `
                <div class="stock-card ${trendClass}" data-symbol="${symbol}" id="card-${symbol}">
                    <button class="stock-card-delete" data-symbol="${symbol}" title="Remove from watchlist">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                    <div class="stock-card-top">
                        <div>
                            <div class="stock-symbol">${App.escapeHtml(symbol)}</div>
                            <span class="stock-change ${isPositive ? 'positive' : 'negative'}">
                                ${App.formatChange(changePct)}
                            </span>
                        </div>
                        <div style="text-align: right">
                            <div class="stock-price">${App.formatPrice(d.price)}</div>
                            <span class="trend-badge ${trendClass}">${d.trend || '\u2014'}</span>
                        </div>
                    </div>
                    <div class="stock-card-chart" id="minichart-${symbol}"></div>
                    <div class="stock-card-bottom">
                        <div class="stock-indicators">
                            <div class="indicator-chip">
                                <span class="indicator-label">RSI</span>
                                <span class="rsi-value ${rsiClass}">${rsi != null ? rsi.toFixed(1) : '\u2014'}</span>
                            </div>
                            <div class="indicator-chip">
                                <span class="indicator-label">ADX</span>
                                <span class="text-mono">${d.adx != null ? d.adx.toFixed(1) : '\u2014'}</span>
                            </div>
                        </div>
                        <div class="signal-indicator">
                            <span class="signal-dot ${hasSignals ? 'active' : 'none'}"></span>
                            <span style="font-size:0.75rem;color:var(--text-muted)">${signalCount}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        this.attachCardListeners(grid);
        this.renderMiniCharts(symbols);
    },

    renderTable(symbols, grid) {
        grid.className = '';
        const data = this.data.data || {};

        grid.innerHTML = `
            <div class="signals-table-wrap">
                <table class="signals-table">
                    <thead>
                        <tr>
                            <th>Symbol</th>
                            <th>Price</th>
                            <th>Change</th>
                            <th>Trend</th>
                            <th>RSI</th>
                            <th>ADX</th>
                            <th>Signals</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${symbols.map(symbol => {
                            const d = data[symbol] || {};
                            const changePct = d.change_pct || 0;
                            const isPositive = changePct >= 0;
                            const trendClass = (d.trend === 'bullish') ? 'bullish' : (d.trend === 'bearish' ? 'bearish' : '');
                            const rsi = d.rsi;
                            const rsiClass = App.rsiClass(rsi);
                            const signalCount = (d.signals || []).length;
                            const hasSignals = signalCount > 0;
                            const rowClass = trendClass === 'bullish' ? 'bullish-row' : (trendClass === 'bearish' ? 'bearish-row' : '');

                            return `
                                <tr class="${rowClass}" style="cursor:pointer" data-symbol="${symbol}">
                                    <td><strong>${App.escapeHtml(symbol)}</strong></td>
                                    <td class="text-mono">${App.formatPrice(d.price)}</td>
                                    <td class="text-mono ${isPositive ? 'text-green' : 'text-red'}">${App.formatChange(changePct)}</td>
                                    <td><span class="trend-badge ${trendClass}">${d.trend || '\u2014'}</span></td>
                                    <td class="text-mono"><span class="rsi-value ${rsiClass}">${rsi != null ? rsi.toFixed(1) : '\u2014'}</span></td>
                                    <td class="text-mono">${d.adx != null ? d.adx.toFixed(1) : '\u2014'}</td>
                                    <td>
                                        <span class="signal-dot ${hasSignals ? 'active' : 'none'}"></span>
                                        <span style="font-size:0.75rem;color:var(--text-muted)">${signalCount}</span>
                                    </td>
                                    <td>
                                        <button class="stock-card-delete-inline" data-symbol="${symbol}" title="Remove from watchlist" style="background:none;border:none;cursor:pointer;color:var(--text-muted);padding:4px;opacity:0.5;transition:opacity 0.15s">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                                <line x1="6" y1="6" x2="18" y2="18"></line>
                                            </svg>
                                        </button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        // Row click -> stock detail
        grid.querySelectorAll('tbody tr').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.closest('.stock-card-delete-inline')) return;
                App.navigate(`#/stock/${row.dataset.symbol}`);
            });
        });

        // Delete buttons
        grid.querySelectorAll('.stock-card-delete-inline').forEach(btn => {
            btn.addEventListener('mouseover', () => { btn.style.opacity = '1'; });
            btn.addEventListener('mouseout', () => { btn.style.opacity = '0.5'; });
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const symbol = btn.dataset.symbol;
                if (confirm(`Remove ${symbol} from watchlist?`)) {
                    try {
                        await App.del(`/api/watchlist/${symbol}`);
                        App.toast(`${symbol} removed`, 'info');
                        this.refresh();
                    } catch (err) {
                        App.toast(err.message, 'error');
                    }
                }
            });
        });
    },

    renderCompact(symbols, grid) {
        grid.className = 'watchlist-compact';
        const data = this.data.data || {};

        grid.innerHTML = symbols.map(symbol => {
            const d = data[symbol] || {};
            const changePct = d.change_pct || 0;
            const isPositive = changePct >= 0;
            const trendClass = (d.trend === 'bullish') ? 'bullish' : (d.trend === 'bearish' ? 'bearish' : '');
            const rsi = d.rsi;
            const rsiClass = App.rsiClass(rsi);
            const signalCount = (d.signals || []).length;
            const hasSignals = signalCount > 0;

            return `
                <div class="compact-card" data-symbol="${symbol}">
                    <strong class="stock-symbol" style="min-width:60px">${App.escapeHtml(symbol)}</strong>
                    <span class="text-mono" style="min-width:70px">${App.formatPrice(d.price)}</span>
                    <span class="text-mono ${isPositive ? 'text-green' : 'text-red'}" style="min-width:70px">${App.formatChange(changePct)}</span>
                    <span class="trend-badge ${trendClass}" style="min-width:60px">${d.trend || '\u2014'}</span>
                    <span style="min-width:50px;font-size:0.8rem"><span class="indicator-label" style="margin-right:4px">RSI</span><span class="rsi-value ${rsiClass}">${rsi != null ? rsi.toFixed(1) : '\u2014'}</span></span>
                    <span style="min-width:50px;font-size:0.8rem"><span class="indicator-label" style="margin-right:4px">ADX</span><span class="text-mono">${d.adx != null ? d.adx.toFixed(1) : '\u2014'}</span></span>
                    <span style="min-width:30px"><span class="signal-dot ${hasSignals ? 'active' : 'none'}"></span> <span style="font-size:0.75rem;color:var(--text-muted)">${signalCount}</span></span>
                    <button class="stock-card-delete-inline" data-symbol="${symbol}" title="Remove" style="background:none;border:none;cursor:pointer;color:var(--text-muted);padding:4px;opacity:0;transition:opacity 0.15s;margin-left:auto">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            `;
        }).join('');

        // Click -> stock detail
        grid.querySelectorAll('.compact-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.stock-card-delete-inline')) return;
                App.navigate(`#/stock/${card.dataset.symbol}`);
            });
            // Show delete on hover
            card.addEventListener('mouseover', () => {
                const del = card.querySelector('.stock-card-delete-inline');
                if (del) del.style.opacity = '1';
            });
            card.addEventListener('mouseout', () => {
                const del = card.querySelector('.stock-card-delete-inline');
                if (del) del.style.opacity = '0';
            });
        });

        // Delete buttons
        grid.querySelectorAll('.stock-card-delete-inline').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const symbol = btn.dataset.symbol;
                if (confirm(`Remove ${symbol} from watchlist?`)) {
                    try {
                        await App.del(`/api/watchlist/${symbol}`);
                        App.toast(`${symbol} removed`, 'info');
                        this.refresh();
                    } catch (err) {
                        App.toast(err.message, 'error');
                    }
                }
            });
        });
    },

    attachCardListeners(grid) {
        // Click handlers for card view
        grid.querySelectorAll('.stock-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.stock-card-delete')) return;
                App.navigate(`#/stock/${card.dataset.symbol}`);
            });
        });

        // Delete buttons
        grid.querySelectorAll('.stock-card-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const symbol = btn.dataset.symbol;
                if (confirm(`Remove ${symbol} from watchlist?`)) {
                    try {
                        await App.del(`/api/watchlist/${symbol}`);
                        App.toast(`${symbol} removed`, 'info');
                        this.refresh();
                    } catch (err) {
                        App.toast(err.message, 'error');
                    }
                }
            });
        });
    },

    renderSignalAlert(signals) {
        const area = document.getElementById('signal-alert-area');
        if (!signals || signals.length === 0) {
            area.innerHTML = '';
            const badge = document.getElementById('signal-badge');
            badge.classList.add('hidden');
            return;
        }

        const badge = document.getElementById('signal-badge');
        badge.textContent = signals.length;
        badge.classList.remove('hidden');

        const buySignals = signals.filter(s => s.direction !== 'short');
        const sellSignals = signals.filter(s => s.direction === 'short');

        let summary = [];
        if (buySignals.length) summary.push(`${buySignals.length} bullish`);
        if (sellSignals.length) summary.push(`${sellSignals.length} bearish`);

        const symbolList = [...new Set(signals.map(s => s.symbol))].join(', ');

        area.innerHTML = `
            <div class="signal-alert-bar">
                <div class="signal-alert-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
                    </svg>
                </div>
                <div class="signal-alert-text">
                    <strong>${signals.length} signal${signals.length !== 1 ? 's' : ''} active</strong>
                    <p>${summary.join(', ')} across ${symbolList}</p>
                </div>
                <a href="#/signals" class="btn btn-outline btn-sm">View All</a>
            </div>
        `;
    },

    async renderMiniCharts(symbols) {
        // Destroy old charts
        Object.values(this.miniCharts).forEach(c => { try { c.remove(); } catch(e) {} });
        this.miniCharts = {};

        for (const symbol of symbols) {
            const el = document.getElementById(`minichart-${symbol}`);
            if (!el) continue;

            try {
                const chart = LightweightCharts.createChart(el, {
                    width: el.clientWidth,
                    height: 60,
                    layout: {
                        background: { type: 'solid', color: 'transparent' },
                        textColor: 'transparent',
                    },
                    grid: { vertLines: { visible: false }, horzLines: { visible: false } },
                    rightPriceScale: { visible: false },
                    timeScale: { visible: false },
                    crosshair: { mode: 0 },
                    handleScroll: false,
                    handleScale: false,
                });

                const data = this.data?.data?.[symbol];
                const changePct = data?.change_pct || 0;
                const color = changePct >= 0 ? '#00d4aa' : '#ff4757';

                const series = chart.addAreaSeries({
                    lineColor: color,
                    topColor: color + '30',
                    bottomColor: 'transparent',
                    lineWidth: 2,
                    crosshairMarkerVisible: false,
                    priceLineVisible: false,
                    lastValueVisible: false,
                });

                // Fetch a tiny amount of data for the sparkline
                const res = await App.get(`/api/stock/${symbol}?period=1mo`);
                if (res && res.ohlcv) {
                    const lineData = res.ohlcv.map(c => ({
                        time: c.time,
                        value: c.close,
                    }));
                    series.setData(lineData);
                    chart.timeScale().fitContent();
                }

                this.miniCharts[symbol] = chart;
            } catch (e) {
                // Sparkline is non-critical
            }
        }
    },
};
