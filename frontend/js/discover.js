/* =====================================================================
   Discover — Stock discovery hub with sub-tabs:
   Matchmaker, Government, Insider, Social, Options Flow
   ===================================================================== */

const Discover = {
    activeTab: 'matchmaker',
    matchmaker: { candidates: [], currentIndex: 0, loading: false, sources: ['sp500'] },
    congress: { trades: [], summary: null, loading: false },
    insider: { data: null, loading: false },
    social: { mentions: [], loading: false },
    options: { alerts: [], loading: false, source: 'watchlist' },

    // ---------------------------------------------------------------
    // Main render
    // ---------------------------------------------------------------
    async render(container, subTab) {
        if (subTab) this.activeTab = subTab;

        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h1>Discover</h1>
                    <p class="page-subtitle">Find new trading opportunities</p>
                </div>
            </div>

            <div class="discover-tabs">
                <button class="discover-tab ${this.activeTab === 'matchmaker' ? 'active' : ''}" data-tab="matchmaker">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                    Matchmaker
                </button>
                <button class="discover-tab ${this.activeTab === 'congress' ? 'active' : ''}" data-tab="congress">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"></path>
                    </svg>
                    Government
                </button>
                <button class="discover-tab ${this.activeTab === 'insider' ? 'active' : ''}" data-tab="insider">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="8.5" cy="7" r="4"></circle>
                        <line x1="20" y1="8" x2="20" y2="14"></line>
                        <line x1="23" y1="11" x2="17" y2="11"></line>
                    </svg>
                    Insider
                </button>
                <button class="discover-tab ${this.activeTab === 'social' ? 'active' : ''}" data-tab="social">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                    </svg>
                    Social
                </button>
                <button class="discover-tab ${this.activeTab === 'options' ? 'active' : ''}" data-tab="options">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                    </svg>
                    Options Flow
                </button>
            </div>

            <div id="discover-content" class="discover-content">
                <div class="loading-spinner"></div>
            </div>
        `;

        // Tab switching
        container.querySelectorAll('.discover-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                this.activeTab = btn.dataset.tab;
                container.querySelectorAll('.discover-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.renderActiveTab();
            });
        });

        this.renderActiveTab();
    },

    renderActiveTab() {
        const content = document.getElementById('discover-content');
        if (!content) return;

        switch (this.activeTab) {
            case 'matchmaker': this.renderMatchmaker(content); break;
            case 'congress': this.renderCongress(content); break;
            case 'insider': this.renderInsider(content); break;
            case 'social': this.renderSocial(content); break;
            case 'options': this.renderOptions(content); break;
        }
    },

    // ---------------------------------------------------------------
    // MATCHMAKER — Tinder for Stocks
    // ---------------------------------------------------------------
    async renderMatchmaker(container) {
        container.innerHTML = `
            <div class="matchmaker-container">
                <div class="matchmaker-controls">
                    <div class="matchmaker-sources">
                        <label class="matchmaker-source-label">Stock Sources:</label>
                        <div class="matchmaker-source-checks">
                            <label class="checkbox-label">
                                <input type="checkbox" value="sp500" ${this.matchmaker.sources.includes('sp500') ? 'checked' : ''}> S&P 500
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" value="congress" ${this.matchmaker.sources.includes('congress') ? 'checked' : ''}> Government
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" value="insider" ${this.matchmaker.sources.includes('insider') ? 'checked' : ''}> Insider
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" value="social" ${this.matchmaker.sources.includes('social') ? 'checked' : ''}> Social
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" value="options" ${this.matchmaker.sources.includes('options') ? 'checked' : ''}> Options
                            </label>
                        </div>
                        <button class="btn btn-primary btn-sm" id="matchmaker-load-btn">Load Candidates</button>
                    </div>
                    <div class="matchmaker-progress">
                        <span id="matchmaker-counter">0 / 0</span> candidates
                    </div>
                </div>

                <div id="matchmaker-card-area" class="matchmaker-card-area">
                    <div class="empty-state">
                        <p>Select sources and click <strong>Load Candidates</strong> to start</p>
                    </div>
                </div>

                <div class="matchmaker-actions" id="matchmaker-actions" style="display:none;">
                    <button class="matchmaker-btn matchmaker-btn-pass" id="matchmaker-pass" title="Pass (←)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="28" height="28">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                        <span>Pass</span>
                    </button>
                    <button class="matchmaker-btn matchmaker-btn-info" id="matchmaker-detail" title="View Details (↓)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="28" height="28">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <span>Detail</span>
                    </button>
                    <button class="matchmaker-btn matchmaker-btn-add" id="matchmaker-add" title="Add to Watchlist (→)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="28" height="28">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                            </svg>
                        <span>Watchlist</span>
                    </button>
                </div>
            </div>
        `;

        // Source checkboxes
        container.querySelectorAll('.matchmaker-source-checks input').forEach(cb => {
            cb.addEventListener('change', () => {
                this.matchmaker.sources = Array.from(
                    container.querySelectorAll('.matchmaker-source-checks input:checked')
                ).map(c => c.value);
            });
        });

        // Load button
        document.getElementById('matchmaker-load-btn').addEventListener('click', () => this.loadMatchmakerCandidates());

        // Action buttons
        document.getElementById('matchmaker-pass').addEventListener('click', () => this.matchmakerSwipe('dismissed'));
        document.getElementById('matchmaker-add').addEventListener('click', () => this.matchmakerSwipe('watchlisted'));
        document.getElementById('matchmaker-detail').addEventListener('click', () => {
            const card = this.matchmaker.candidates[this.matchmaker.currentIndex];
            if (card) App.navigate(`#/stock/${card}`);
        });

        // Keyboard shortcuts
        this._matchmakerKeyHandler = (e) => {
            if (e.target.tagName === 'INPUT') return;
            if (e.key === 'ArrowLeft') this.matchmakerSwipe('dismissed');
            if (e.key === 'ArrowRight') this.matchmakerSwipe('watchlisted');
            if (e.key === 'ArrowDown') {
                const card = this.matchmaker.candidates[this.matchmaker.currentIndex];
                if (card) App.navigate(`#/stock/${card}`);
            }
        };
        document.addEventListener('keydown', this._matchmakerKeyHandler);
    },

    async loadMatchmakerCandidates() {
        if (this.matchmaker.sources.length === 0) {
            App.toast('Select at least one source', 'error');
            return;
        }

        this.matchmaker.loading = true;
        const cardArea = document.getElementById('matchmaker-card-area');
        cardArea.innerHTML = '<div class="loading-spinner"></div>';

        try {
            const data = await App.get(`/api/discover/matchmaker/candidates?sources=${this.matchmaker.sources.join(',')}&limit=50`);
            this.matchmaker.candidates = data.candidates || [];
            this.matchmaker.currentIndex = 0;

            if (this.matchmaker.candidates.length === 0) {
                cardArea.innerHTML = '<div class="empty-state"><p>No new candidates found. Try different sources or wait for dismissed stocks to reset.</p></div>';
                document.getElementById('matchmaker-actions').style.display = 'none';
            } else {
                document.getElementById('matchmaker-actions').style.display = 'flex';
                this.showMatchmakerCard();
            }
        } catch (e) {
            cardArea.innerHTML = `<div class="empty-state"><p>Error loading candidates: ${App.escapeHtml(e.message)}</p></div>`;
        }
        this.matchmaker.loading = false;
    },

    async showMatchmakerCard() {
        const cardArea = document.getElementById('matchmaker-card-area');
        const counter = document.getElementById('matchmaker-counter');
        const idx = this.matchmaker.currentIndex;
        const total = this.matchmaker.candidates.length;

        if (idx >= total) {
            cardArea.innerHTML = '<div class="empty-state"><p>All done! Load more candidates or try different sources.</p></div>';
            document.getElementById('matchmaker-actions').style.display = 'none';
            counter.textContent = `${total} / ${total}`;
            return;
        }

        counter.textContent = `${idx + 1} / ${total}`;
        const symbol = this.matchmaker.candidates[idx];
        cardArea.innerHTML = '<div class="loading-spinner"></div>';

        try {
            const data = await App.get(`/api/discover/matchmaker/card/${symbol}`);
            this._renderMatchmakerCard(cardArea, data);
        } catch (e) {
            // Skip failed cards
            this.matchmaker.currentIndex++;
            this.showMatchmakerCard();
        }
    },

    _renderMatchmakerCard(container, data) {
        const changeClass = (data.change_pct || 0) >= 0 ? 'text-green' : 'text-red';
        const changeSign = (data.change_pct || 0) >= 0 ? '+' : '';
        const trendClass = data.trend === 'bullish' ? 'bullish' : data.trend === 'bearish' ? 'bearish' : 'neutral';

        const formatMcap = (val) => {
            if (!val) return 'N/A';
            if (val >= 1e12) return `$${(val/1e12).toFixed(1)}T`;
            if (val >= 1e9) return `$${(val/1e9).toFixed(1)}B`;
            if (val >= 1e6) return `$${(val/1e6).toFixed(0)}M`;
            return `$${val.toLocaleString()}`;
        };

        container.innerHTML = `
            <div class="matchmaker-card" id="matchmaker-swipe-card">
                <div class="matchmaker-card-section matchmaker-card-info">
                    <div class="matchmaker-card-header">
                        <div>
                            <span class="matchmaker-symbol">${App.escapeHtml(data.symbol)}</span>
                            <span class="matchmaker-name">${App.escapeHtml(data.name || '')}</span>
                        </div>
                        <span class="trend-badge ${trendClass}">${data.trend || 'N/A'}</span>
                    </div>
                    <div class="matchmaker-card-meta">
                        <span>${App.escapeHtml(data.sector || 'N/A')}</span>
                        <span class="text-muted">•</span>
                        <span>${App.escapeHtml(data.industry || 'N/A')}</span>
                        <span class="text-muted">•</span>
                        <span>Mkt Cap: ${formatMcap(data.market_cap)}</span>
                    </div>
                </div>

                <div class="matchmaker-card-section matchmaker-card-market">
                    <div class="matchmaker-card-price-row">
                        <div>
                            <span class="matchmaker-price">${App.formatPrice(data.price)}</span>
                            <span class="matchmaker-change ${changeClass}">${changeSign}${(data.change_pct || 0).toFixed(2)}%</span>
                        </div>
                        <div class="matchmaker-month-return">
                            <span class="text-muted">1mo return:</span>
                            <span class="${(data.month_return || 0) >= 0 ? 'text-green' : 'text-red'}">${data.month_return != null ? (data.month_return >= 0 ? '+' : '') + data.month_return.toFixed(2) + '%' : 'N/A'}</span>
                        </div>
                    </div>
                    <div class="matchmaker-chart" id="matchmaker-chart-container"></div>
                </div>

                <div class="matchmaker-card-section matchmaker-card-advanced">
                    <div class="matchmaker-card-section-header">Advanced Metrics</div>
                    <div class="matchmaker-metrics-grid">
                        <div class="matchmaker-metric" title="Relative Strength Index — measures momentum. Below 30 = oversold (potential buy), above 70 = overbought (potential sell).">
                            <span class="matchmaker-metric-label">RSI <span class="tooltip-icon">?</span></span>
                            <span class="matchmaker-metric-value rsi-value ${App.rsiClass(data.rsi)}">${data.rsi != null ? data.rsi.toFixed(1) : 'N/A'}</span>
                        </div>
                        <div class="matchmaker-metric" title="Average Directional Index — measures trend strength. Above 25 = strong trend. Higher = stronger trend regardless of direction.">
                            <span class="matchmaker-metric-label">ADX <span class="tooltip-icon">?</span></span>
                            <span class="matchmaker-metric-value">${data.adx != null ? data.adx.toFixed(1) : 'N/A'}</span>
                        </div>
                        <div class="matchmaker-metric" title="Price-to-Earnings Ratio — how much you pay per dollar of earnings. Lower is usually cheaper. Compare within same sector.">
                            <span class="matchmaker-metric-label">P/E <span class="tooltip-icon">?</span></span>
                            <span class="matchmaker-metric-value">${data.pe_ratio != null ? data.pe_ratio.toFixed(1) : 'N/A'}</span>
                        </div>
                        <div class="matchmaker-metric" title="Forward Price-to-Earnings — same as P/E but based on projected future earnings. Lower may mean undervalued.">
                            <span class="matchmaker-metric-label">Fwd P/E <span class="tooltip-icon">?</span></span>
                            <span class="matchmaker-metric-value">${data.forward_pe != null ? data.forward_pe.toFixed(1) : 'N/A'}</span>
                        </div>
                        <div class="matchmaker-metric" title="Earnings Per Share — company profit divided by shares outstanding. Higher is generally better.">
                            <span class="matchmaker-metric-label">EPS <span class="tooltip-icon">?</span></span>
                            <span class="matchmaker-metric-value">${data.eps != null ? '$' + data.eps.toFixed(2) : 'N/A'}</span>
                        </div>
                        <div class="matchmaker-metric" title="Beta — measures volatility vs the market. 1.0 = market average. Above 1 = more volatile. Below 1 = less volatile.">
                            <span class="matchmaker-metric-label">Beta <span class="tooltip-icon">?</span></span>
                            <span class="matchmaker-metric-value">${data.beta != null ? data.beta.toFixed(2) : 'N/A'}</span>
                        </div>
                        <div class="matchmaker-metric" title="Dividend Yield — annual dividend as a percentage of stock price. Higher = more income. 0 = no dividend.">
                            <span class="matchmaker-metric-label">Div Yield <span class="tooltip-icon">?</span></span>
                            <span class="matchmaker-metric-value">${data.dividend_yield != null ? (data.dividend_yield * 100).toFixed(2) + '%' : 'N/A'}</span>
                        </div>
                        <div class="matchmaker-metric" title="MACD — Moving Average Convergence Divergence. Positive = bullish momentum. Negative = bearish momentum.">
                            <span class="matchmaker-metric-label">MACD <span class="tooltip-icon">?</span></span>
                            <span class="matchmaker-metric-value ${data.macd > 0 ? 'text-green' : data.macd < 0 ? 'text-red' : ''}">${data.macd != null ? data.macd.toFixed(2) : 'N/A'}</span>
                        </div>
                    </div>
                    ${data.signals && data.signals.length > 0 ? `
                        <div class="matchmaker-signals">
                            ${data.signals.map(s => `<span class="trend-badge ${s.includes('bearish') || s.includes('Bearish') ? 'bearish' : 'bullish'}">${App.escapeHtml(s)}</span>`).join(' ')}
                        </div>
                    ` : ''}
                    <div class="matchmaker-52w">
                        <span class="text-muted">52w: </span>
                        <span class="text-red">${data.fifty_two_week_low != null ? '$' + data.fifty_two_week_low.toFixed(2) : '?'}</span>
                        <span class="text-muted"> — </span>
                        <span class="text-green">${data.fifty_two_week_high != null ? '$' + data.fifty_two_week_high.toFixed(2) : '?'}</span>
                    </div>
                </div>
            </div>
        `;

        // Render mini chart
        if (data.chart && data.chart.length > 0) {
            try {
                const chartContainer = document.getElementById('matchmaker-chart-container');
                const chart = LightweightCharts.createChart(chartContainer, {
                    width: chartContainer.clientWidth,
                    height: 120,
                    layout: { background: { color: 'transparent' }, textColor: '#8899b0' },
                    grid: { vertLines: { visible: false }, horzLines: { color: 'rgba(136,153,176,0.06)' } },
                    rightPriceScale: { borderVisible: false },
                    timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
                    crosshair: { mode: 0 },
                });
                const series = chart.addCandlestickSeries({
                    upColor: '#00d4aa', downColor: '#ff4757',
                    borderUpColor: '#00d4aa', borderDownColor: '#ff4757',
                    wickUpColor: '#00d4aa', wickDownColor: '#ff4757',
                });
                series.setData(data.chart);
                chart.timeScale().fitContent();
            } catch (e) { /* chart is non-critical */ }
        }

        // Touch swipe support
        this._initSwipeGesture(document.getElementById('matchmaker-swipe-card'));
    },

    _initSwipeGesture(el) {
        if (!el) return;
        let startX = 0, startY = 0, currentX = 0, swiping = false;

        el.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            swiping = true;
            el.style.transition = 'none';
        }, { passive: true });

        el.addEventListener('touchmove', (e) => {
            if (!swiping) return;
            currentX = e.touches[0].clientX - startX;
            const currentY = e.touches[0].clientY - startY;
            // Only horizontal swipe
            if (Math.abs(currentX) > Math.abs(currentY)) {
                el.style.transform = `translateX(${currentX}px) rotate(${currentX * 0.05}deg)`;
                el.style.opacity = Math.max(0.5, 1 - Math.abs(currentX) / 400);

                if (currentX > 50) el.classList.add('swiping-right');
                else el.classList.remove('swiping-right');
                if (currentX < -50) el.classList.add('swiping-left');
                else el.classList.remove('swiping-left');
            }
        }, { passive: true });

        el.addEventListener('touchend', () => {
            swiping = false;
            el.style.transition = 'transform 0.3s, opacity 0.3s';
            if (currentX > 100) {
                el.style.transform = 'translateX(500px) rotate(15deg)';
                el.style.opacity = '0';
                setTimeout(() => this.matchmakerSwipe('watchlisted'), 200);
            } else if (currentX < -100) {
                el.style.transform = 'translateX(-500px) rotate(-15deg)';
                el.style.opacity = '0';
                setTimeout(() => this.matchmakerSwipe('dismissed'), 200);
            } else {
                el.style.transform = '';
                el.style.opacity = '';
                el.classList.remove('swiping-left', 'swiping-right');
            }
            currentX = 0;
        });
    },

    async matchmakerSwipe(action) {
        const symbol = this.matchmaker.candidates[this.matchmaker.currentIndex];
        if (!symbol) return;

        try {
            await App.post('/api/discover/matchmaker/swipe', { ticker: symbol, action });
            if (action === 'watchlisted') {
                App.toast(`${symbol} added to watchlist`, 'success');
            }
        } catch (e) { /* non-critical */ }

        this.matchmaker.currentIndex++;
        this.showMatchmakerCard();
    },

    // ---------------------------------------------------------------
    // CONGRESS — Government Trade Tracker
    // ---------------------------------------------------------------
    async renderCongress(container) {
        container.innerHTML = `
            <div class="discover-section">
                <div class="discover-toolbar">
                    <h3>Congressional Stock Trades</h3>
                    <button class="btn btn-outline btn-sm" id="congress-refresh">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                            <polyline points="23 4 23 10 17 10"></polyline>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                        </svg>
                        Refresh
                    </button>
                </div>
                <div id="congress-content"><div class="loading-spinner"></div></div>
            </div>
        `;

        document.getElementById('congress-refresh').addEventListener('click', () => this.loadCongress(true));
        this.loadCongress(false);
    },

    async loadCongress(refresh) {
        const content = document.getElementById('congress-content');
        if (!content) return;
        content.innerHTML = '<div class="loading-spinner"></div>';

        try {
            const data = await App.get(`/api/discover/congress?refresh=${refresh}`);
            this.congress.trades = data.trades || [];
            this.congress.summary = data.summary || null;
            this._renderCongressContent(content, data);
        } catch (e) {
            content.innerHTML = `<div class="empty-state"><p>Error loading congressional trades: ${App.escapeHtml(e.message)}</p></div>`;
        }
    },

    _renderCongressContent(container, data) {
        const summary = data.summary || {};
        const popular = summary.popular_tickers || [];
        const trades = data.trades || [];

        let html = '';

        // Popular tickers highlight
        if (popular.length > 0) {
            html += `
                <div class="discover-highlight-section">
                    <h4>Most Traded by Politicians</h4>
                    <div class="congress-popular-grid">
                        ${popular.slice(0, 10).map(t => `
                            <div class="congress-popular-card" onclick="App.navigate('#/stock/${App.escapeHtml(t.ticker)}')">
                                <div class="congress-popular-ticker">${App.escapeHtml(t.ticker)}</div>
                                <div class="congress-popular-stats">
                                    <span class="text-green">${t.buy_count} buys</span>
                                    <span class="text-red">${t.sell_count} sells</span>
                                </div>
                                <div class="text-muted">${t.politician_count} politician${t.politician_count !== 1 ? 's' : ''}</div>
                                ${t.parties && t.parties.length > 0 ? `<div class="congress-parties">${t.parties.map(p => `<span class="party-badge party-${p.toLowerCase()}">${p}</span>`).join('')}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Trade feed table
        if (trades.length > 0) {
            html += `
                <div class="discover-table-section">
                    <h4>Recent Trades (${trades.length})</h4>
                    <div class="table-scroll">
                        <table class="signals-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Politician</th>
                                    <th>Party</th>
                                    <th>Ticker</th>
                                    <th>Type</th>
                                    <th>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${trades.slice(0, 100).map(t => `
                                    <tr class="${t.trade_type === 'Buy' ? 'bullish-row' : t.trade_type === 'Sell' ? 'bearish-row' : ''}">
                                        <td>${App.escapeHtml(t.trade_date || t.disclosure_date || '—')}</td>
                                        <td>
                                            ${App.escapeHtml(t.politician || '—')}
                                            ${t.chamber ? `<span class="text-muted"> (${App.escapeHtml(t.chamber)})</span>` : ''}
                                        </td>
                                        <td>${t.party ? `<span class="party-badge party-${t.party.toLowerCase()}">${App.escapeHtml(t.party)}</span>` : '—'}</td>
                                        <td>
                                            <a href="#/stock/${App.escapeHtml(t.ticker)}" class="ticker-link">${App.escapeHtml(t.ticker)}</a>
                                        </td>
                                        <td>
                                            <span class="action-badge-${t.trade_type === 'Buy' ? 'buy' : 'sell'}">${App.escapeHtml(t.trade_type)}</span>
                                        </td>
                                        <td>${App.escapeHtml(t.amount_range || '—')}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } else {
            html += '<div class="empty-state"><p>No congressional trades found. Click Refresh to fetch data.</p></div>';
        }

        if (data.last_updated) {
            html += `<p class="text-muted discover-last-updated">Last updated: ${new Date(data.last_updated).toLocaleString()}</p>`;
        }

        container.innerHTML = html;
    },

    // ---------------------------------------------------------------
    // INSIDER — Market-wide Insider Scan
    // ---------------------------------------------------------------
    async renderInsider(container) {
        container.innerHTML = `
            <div class="discover-section">
                <div class="discover-toolbar">
                    <h3>Market-Wide Insider Trading</h3>
                    <div>
                        <label class="text-muted">Min value: </label>
                        <select id="insider-min-value" class="select-sm">
                            <option value="100000" selected>$100K+</option>
                            <option value="500000">$500K+</option>
                            <option value="1000000">$1M+</option>
                        </select>
                        <button class="btn btn-outline btn-sm" id="insider-scan-btn">Scan</button>
                    </div>
                </div>
                <div id="insider-content"><div class="loading-spinner"></div></div>
            </div>
        `;

        document.getElementById('insider-scan-btn').addEventListener('click', () => {
            const minVal = document.getElementById('insider-min-value').value;
            this.loadInsiderScan(minVal);
        });

        this.loadInsiderScan(100000);
    },

    async loadInsiderScan(minValue) {
        const content = document.getElementById('insider-content');
        if (!content) return;
        content.innerHTML = '<div class="loading-spinner"></div>';

        try {
            const data = await App.get(`/api/discover/insider-scan?min_value=${minValue}`);
            this._renderInsiderContent(content, data);
        } catch (e) {
            content.innerHTML = `<div class="empty-state"><p>Error: ${App.escapeHtml(e.message)}</p></div>`;
        }
    },

    _renderInsiderContent(container, data) {
        const summary = data.summary || {};
        const tickers = summary.tickers || [];

        if (tickers.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No notable insider trades found.</p></div>';
            return;
        }

        let html = `
            <div class="discover-stats-bar">
                <div class="discover-stat">
                    <span class="discover-stat-value">${summary.total_trades || 0}</span>
                    <span class="discover-stat-label">Trades</span>
                </div>
                <div class="discover-stat">
                    <span class="discover-stat-value">${summary.unique_tickers || 0}</span>
                    <span class="discover-stat-label">Tickers</span>
                </div>
            </div>

            <div class="discover-cards-grid">
                ${tickers.slice(0, 30).map(t => `
                    <div class="insider-card ${t.signal}" onclick="App.navigate('#/stock/${App.escapeHtml(t.ticker)}')">
                        <div class="insider-card-header">
                            <span class="insider-ticker">${App.escapeHtml(t.ticker)}</span>
                            <span class="trend-badge ${t.signal}">${t.signal}</span>
                        </div>
                        <div class="insider-card-stats">
                            <div>
                                <span class="text-green">Buys: ${t.buy_count}</span>
                                <span class="text-muted">($${(t.total_buy_value/1000).toFixed(0)}K)</span>
                            </div>
                            <div>
                                <span class="text-red">Sells: ${t.sell_count}</span>
                                <span class="text-muted">($${(t.total_sell_value/1000).toFixed(0)}K)</span>
                            </div>
                        </div>
                        <div class="insider-card-footer">
                            <span class="text-muted">${t.insider_count} insider${t.insider_count !== 1 ? 's' : ''}</span>
                            <span class="text-muted">${App.escapeHtml(t.latest_date || '')}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        container.innerHTML = html;
    },

    // ---------------------------------------------------------------
    // SOCIAL — Reddit Momentum
    // ---------------------------------------------------------------
    async renderSocial(container) {
        container.innerHTML = `
            <div class="discover-section">
                <div class="discover-toolbar">
                    <h3>Social Momentum (Reddit)</h3>
                    <button class="btn btn-outline btn-sm" id="social-refresh">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                            <polyline points="23 4 23 10 17 10"></polyline>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                        </svg>
                        Scan Now
                    </button>
                </div>
                <div id="social-content"><div class="loading-spinner"></div></div>
            </div>
        `;

        document.getElementById('social-refresh').addEventListener('click', () => this.loadSocial(true));
        this.loadSocial(false);
    },

    async loadSocial(refresh) {
        const content = document.getElementById('social-content');
        if (!content) return;
        content.innerHTML = '<div class="loading-spinner"></div>';

        try {
            const data = await App.get(`/api/discover/social?refresh=${refresh}`);
            this._renderSocialContent(content, data);
        } catch (e) {
            content.innerHTML = `<div class="empty-state"><p>Error: ${App.escapeHtml(e.message)}</p></div>`;
        }
    },

    _renderSocialContent(container, data) {
        const mentions = data.mentions || [];

        if (!data.configured) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>Reddit API credentials not configured.</p>
                    <p class="text-muted">Add <code>REDDIT_CLIENT_ID</code> and <code>REDDIT_CLIENT_SECRET</code> to your .env file.</p>
                    <p class="text-muted">Get free credentials at <a href="https://www.reddit.com/prefs/apps" target="_blank">reddit.com/prefs/apps</a></p>
                </div>
            `;
            return;
        }

        if (mentions.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No trending tickers found. Click "Scan Now" to fetch fresh data.</p></div>';
            return;
        }

        let html = `
            <div class="discover-table-section">
                <div class="table-scroll">
                    <table class="signals-table">
                        <thead>
                            <tr>
                                <th>Ticker</th>
                                <th>Mentions</th>
                                <th>Sentiment</th>
                                <th>Score</th>
                                <th>Subreddits</th>
                                <th>Posts</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${mentions.map(m => {
                                const sentClass = m.sentiment_label === 'bullish' ? 'positive' : m.sentiment_label === 'bearish' ? 'negative' : 'neutral';
                                const posts = m.sample_posts || [];
                                return `
                                    <tr>
                                        <td><a href="#/stock/${App.escapeHtml(m.ticker)}" class="ticker-link">${App.escapeHtml(m.ticker)}</a></td>
                                        <td><strong>${m.mention_count}</strong></td>
                                        <td><span class="sentiment-badge ${sentClass}">${App.escapeHtml(m.sentiment_label || 'N/A')}</span></td>
                                        <td class="${m.sentiment_score > 0 ? 'text-green' : m.sentiment_score < 0 ? 'text-red' : ''}">${m.sentiment_score != null ? m.sentiment_score.toFixed(3) : '—'}</td>
                                        <td class="text-muted">${App.escapeHtml(m.subreddit || '')}</td>
                                        <td>
                                            ${posts.length > 0 ? `
                                                <details class="social-posts-detail">
                                                    <summary>${posts.length} post${posts.length !== 1 ? 's' : ''}</summary>
                                                    <ul class="social-posts-list">
                                                        ${posts.map(p => `
                                                            <li>
                                                                <a href="${App.escapeHtml(p.url)}" target="_blank" rel="noopener">${App.escapeHtml(p.title)}</a>
                                                                <span class="text-muted">r/${App.escapeHtml(p.subreddit)} · ${p.score} pts</span>
                                                            </li>
                                                        `).join('')}
                                                    </ul>
                                                </details>
                                            ` : '—'}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        if (data.last_updated) {
            html += `<p class="text-muted discover-last-updated">Last scan: ${new Date(data.last_updated).toLocaleString()}</p>`;
        }

        container.innerHTML = html;
    },

    // ---------------------------------------------------------------
    // OPTIONS FLOW — Unusual Activity
    // ---------------------------------------------------------------
    async renderOptions(container) {
        container.innerHTML = `
            <div class="discover-section">
                <div class="discover-toolbar">
                    <h3>Unusual Options Activity</h3>
                    <div class="discover-toolbar-controls">
                        <select id="options-source" class="select-sm">
                            <option value="watchlist" ${this.options.source === 'watchlist' ? 'selected' : ''}>Watchlist</option>
                            <option value="sp500" ${this.options.source === 'sp500' ? 'selected' : ''}>S&P 500 (cached)</option>
                        </select>
                        <button class="btn btn-outline btn-sm" id="options-refresh">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                                <polyline points="23 4 23 10 17 10"></polyline>
                                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                            </svg>
                            Scan
                        </button>
                    </div>
                </div>
                <div id="options-content"><div class="loading-spinner"></div></div>
            </div>
        `;

        document.getElementById('options-source').addEventListener('change', (e) => {
            this.options.source = e.target.value;
        });

        document.getElementById('options-refresh').addEventListener('click', () => {
            this.loadOptionsFlow(true);
        });

        this.loadOptionsFlow(false);
    },

    async loadOptionsFlow(refresh) {
        const content = document.getElementById('options-content');
        if (!content) return;
        content.innerHTML = '<div class="loading-spinner"></div>';

        try {
            const data = await App.get(`/api/discover/options-flow?source=${this.options.source}&refresh=${refresh}`);
            this._renderOptionsContent(content, data);
        } catch (e) {
            content.innerHTML = `<div class="empty-state"><p>Error: ${App.escapeHtml(e.message)}</p></div>`;
        }
    },

    _renderOptionsContent(container, data) {
        const alerts = data.alerts || [];

        if (alerts.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No unusual options activity detected.</p>
                    <p class="text-muted">Click Scan to analyze ${this.options.source === 'watchlist' ? 'your watchlist' : 'S&P 500'} stocks.</p>
                </div>
            `;
            return;
        }

        let html = `
            <div class="discover-stats-bar">
                <div class="discover-stat">
                    <span class="discover-stat-value">${alerts.length}</span>
                    <span class="discover-stat-label">Alerts</span>
                </div>
                <div class="discover-stat">
                    <span class="discover-stat-value">${new Set(alerts.map(a => a.ticker)).size}</span>
                    <span class="discover-stat-label">Tickers</span>
                </div>
            </div>

            <div class="discover-table-section">
                <div class="table-scroll">
                    <table class="signals-table">
                        <thead>
                            <tr>
                                <th>Ticker</th>
                                <th>Type</th>
                                <th>Strike</th>
                                <th>Expiry</th>
                                <th>Volume</th>
                                <th>OI</th>
                                <th>Vol/OI</th>
                                <th>IV</th>
                                <th>Premium</th>
                                <th>Flags</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${alerts.slice(0, 100).map(a => {
                                const isCall = a.option_type === 'call';
                                return `
                                    <tr>
                                        <td><a href="#/stock/${App.escapeHtml(a.ticker)}" class="ticker-link">${App.escapeHtml(a.ticker)}</a></td>
                                        <td><span class="option-type-badge ${isCall ? 'call' : 'put'}">${isCall ? 'CALL' : 'PUT'}</span></td>
                                        <td class="text-mono">$${a.strike.toFixed(2)}</td>
                                        <td>${App.escapeHtml(a.expiration)}</td>
                                        <td class="text-mono">${a.volume.toLocaleString()}</td>
                                        <td class="text-mono">${a.open_interest.toLocaleString()}</td>
                                        <td class="text-mono ${a.vol_oi_ratio >= 500 ? 'text-gold' : ''}">${a.vol_oi_ratio.toFixed(0)}%</td>
                                        <td class="text-mono">${a.implied_volatility.toFixed(1)}%</td>
                                        <td class="text-mono">$${(a.premium_volume / 1000).toFixed(0)}K</td>
                                        <td>
                                            ${(a.flags || []).map(f => `<span class="options-flag">${App.escapeHtml(f)}</span>`).join(' ')}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        if (data.last_updated) {
            html += `<p class="text-muted discover-last-updated">Last scan: ${new Date(data.last_updated).toLocaleString()}</p>`;
        }

        container.innerHTML = html;
    },

    // ---------------------------------------------------------------
    // Cleanup
    // ---------------------------------------------------------------
    destroy() {
        if (this._matchmakerKeyHandler) {
            document.removeEventListener('keydown', this._matchmakerKeyHandler);
            this._matchmakerKeyHandler = null;
        }
    },
};
