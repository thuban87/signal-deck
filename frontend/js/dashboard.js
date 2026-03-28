/* =====================================================================
   Signal Deck — Dashboard Page
   Watchlist overview with price cards and signal highlights
   ===================================================================== */

const Dashboard = {
    data: null,
    miniCharts: {},

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
            this.renderGrid(watchlistRes);
        } catch (err) {
            document.getElementById('watchlist-grid').innerHTML = `
                <div class="empty-state">
                    <h3>Failed to load</h3>
                    <p>${App.escapeHtml(err.message)}</p>
                </div>
            `;
        }
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

    renderGrid(data) {
        const grid = document.getElementById('watchlist-grid');
        if (!data || !data.symbols || data.symbols.length === 0) {
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

        grid.innerHTML = data.symbols.map(symbol => {
            const d = data.data[symbol] || {};
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
                            <span class="trend-badge ${trendClass}">${d.trend || '—'}</span>
                        </div>
                    </div>
                    <div class="stock-card-chart" id="minichart-${symbol}"></div>
                    <div class="stock-card-bottom">
                        <div class="stock-indicators">
                            <div class="indicator-chip">
                                <span class="indicator-label">RSI</span>
                                <span class="rsi-value ${rsiClass}">${rsi != null ? rsi.toFixed(1) : '—'}</span>
                            </div>
                            <div class="indicator-chip">
                                <span class="indicator-label">ADX</span>
                                <span class="text-mono">${d.adx != null ? d.adx.toFixed(1) : '—'}</span>
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

        // Attach click handlers
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

        // Render mini sparkline charts
        this.renderMiniCharts(data.symbols);
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
