/* =====================================================================
   Signal Deck — Stock Detail Page
   Full analysis with candlestick chart, indicators, and LLM analysis
   Gridstack-powered draggable/resizable widget layout
   ===================================================================== */

const StockDetail = {
    chart: null,
    symbol: null,
    calcPickMode: null,   // null, 'entry', or 'exit'
    calcChart: null,
    notesEditor: null,
    grid: null,
    editMode: false,
    currentData: null,
    tooltipEl: null,

    // Widget definitions — id, title, default grid position, min sizes
    widgetDefs: [
        { id: 'chart',            title: 'Price Chart',           defaultX: 0,  defaultY: 0,  defaultW: 8,  defaultH: 9,  minW: 4, minH: 6 },
        { id: 'indicators',       title: 'Indicators',            defaultX: 8,  defaultY: 0,  defaultW: 4,  defaultH: 9,  minW: 3, minH: 4 },
        { id: 'action-card',      title: 'Signal Recommendation', defaultX: 0,  defaultY: 9,  defaultW: 4,  defaultH: 2,  minW: 3, minH: 2 },
        { id: 'earnings-warning', title: 'Earnings',              defaultX: 4,  defaultY: 9,  defaultW: 4,  defaultH: 2,  minW: 3, minH: 2 },
        { id: 'related-stocks',   title: 'Related Stocks',        defaultX: 8,  defaultY: 9,  defaultW: 4,  defaultH: 2,  minW: 3, minH: 2 },
        { id: 'signals-list',     title: 'Active Signals',        defaultX: 0,  defaultY: 11, defaultW: 6,  defaultH: 3,  minW: 3, minH: 2 },
        { id: 'fundamentals',     title: 'Fundamentals',          defaultX: 6,  defaultY: 11, defaultW: 6,  defaultH: 3,  minW: 3, minH: 2 },
        { id: 'insider-trading',  title: 'Insider Trading',       defaultX: 0,  defaultY: 14, defaultW: 4,  defaultH: 4,  minW: 3, minH: 3 },
        { id: 'mini-news',        title: 'Recent News',           defaultX: 4,  defaultY: 14, defaultW: 4,  defaultH: 4,  minW: 3, minH: 3 },
        { id: 'social-trending',  title: 'Social Trending',       defaultX: 8,  defaultY: 14, defaultW: 4,  defaultH: 4,  minW: 3, minH: 3 },
        { id: 'position-sizing',  title: 'Position Sizing',       defaultX: 0,  defaultY: 18, defaultW: 6,  defaultH: 4,  minW: 3, minH: 3 },
        { id: 'notes',            title: 'Notes',                 defaultX: 6,  defaultY: 18, defaultW: 6,  defaultH: 4,  minW: 3, minH: 3 },
        { id: 'trade-calculator', title: 'Trade Calculator',      defaultX: 0,  defaultY: 22, defaultW: 6,  defaultH: 5,  minW: 4, minH: 4 },
        { id: 'simulations',      title: 'Saved Simulations',     defaultX: 6,  defaultY: 22, defaultW: 6,  defaultH: 5,  minW: 4, minH: 3 },
        { id: 'llm-result',       title: 'LLM Analysis',          defaultX: 0,  defaultY: 27, defaultW: 12, defaultH: 3,  minW: 4, minH: 2 },
    ],

    LAYOUT_KEY: 'sd_stock_detail_layout',
    LAYOUT_KEY_MOBILE: 'sd_stock_detail_layout_mobile',

    getLayoutKey() {
        return App.isMobile() ? this.LAYOUT_KEY_MOBILE : this.LAYOUT_KEY;
    },

    async render(container, symbol) {
        this.symbol = symbol;
        this.calcPickMode = null;
        this.editMode = false;

        const today = new Date().toISOString().split('T')[0];
        const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0];

        container.innerHTML = `
            <div class="stock-detail-header">
                <a href="#/dashboard" class="btn btn-ghost btn-sm" style="margin-right:8px">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
                        <line x1="19" y1="12" x2="5" y2="12"></line>
                        <polyline points="12 19 5 12 12 5"></polyline>
                    </svg>
                </a>
                <div>
                    <div class="stock-detail-symbol" id="stock-symbol">${symbol}</div>
                    <div class="stock-detail-company-name text-muted" id="stock-company-name" style="font-size:0.85rem"></div>
                </div>
                <div style="margin-left:auto;display:flex;gap:8px;align-items:center">
                    <select id="stock-period" class="btn btn-ghost btn-sm" style="padding:6px 10px;background:var(--bg-input);border:1px solid var(--border);color:var(--text-primary)">
                        <option value="1mo">1 Month</option>
                        <option value="3mo">3 Months</option>
                        <option value="6mo" selected>6 Months</option>
                        <option value="1y">1 Year</option>
                        <option value="2y">2 Years</option>
                    </select>
                    <button class="btn btn-outline btn-sm" id="llm-btn" title="Requires Ollama running locally">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"></path>
                            <path d="M12 6v6l4 2"></path>
                        </svg>
                        LLM Analysis
                    </button>
                    <button class="btn btn-ghost btn-sm" id="stock-edit-layout-btn" title="Customize layout">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                            <rect x="3" y="3" width="7" height="7" rx="1"></rect>
                            <rect x="14" y="3" width="7" height="7" rx="1"></rect>
                            <rect x="3" y="14" width="7" height="7" rx="1"></rect>
                            <rect x="14" y="14" width="7" height="7" rx="1"></rect>
                        </svg>
                        Customize
                    </button>
                </div>
            </div>

            <div id="stock-layout-edit-bar" class="layout-edit-bar hidden">
                <span>🔧 Layout edit mode — drag widgets to reorder, resize from edges</span>
                <div style="display:flex;gap:8px">
                    <button class="btn btn-ghost btn-sm" id="stock-reset-layout-btn">Reset Layout</button>
                    <button class="btn btn-primary btn-sm" id="stock-done-layout-btn">Done</button>
                </div>
            </div>

            <div class="grid-stack" id="stock-detail-grid"></div>
        `;

        document.getElementById('stock-period').addEventListener('change', (e) => {
            this.loadData(e.target.value);
        });

        document.getElementById('llm-btn').addEventListener('click', () => this.runLLM());
        document.getElementById('stock-edit-layout-btn').addEventListener('click', () => this.toggleEditMode());
        document.getElementById('stock-done-layout-btn').addEventListener('click', () => this.toggleEditMode());
        document.getElementById('stock-reset-layout-btn').addEventListener('click', () => {
            localStorage.removeItem(this.getLayoutKey());
            this.editMode = false;
            this.render(container, symbol);
        });

        // Initialize GridStack
        this.initGrid();

        // Wire up widget event listeners after grid is built
        this.wireWidgetListeners();

        this.renderSimulations();
        await this.loadData('6mo');
        this.initNotesEditor();
        this.loadNotes();
        this.loadFundamentals();
        this.loadEarnings();
        this.loadRelatedStocks();
        this.loadInsiderTrades();
        this.loadSocialTrending();
    },

    // --- GridStack initialization ---
    initGrid() {
        const saved = this.loadLayout();

        const items = this.widgetDefs.map(def => {
            const s = saved ? saved.find(s => s.id === def.id) : null;
            return {
                id: def.id,
                x: s ? s.x : def.defaultX,
                y: s ? s.y : def.defaultY,
                w: s ? s.w : def.defaultW,
                h: s ? s.h : def.defaultH,
                minW: def.minW,
                minH: def.minH,
                content: `
                    <div class="widget-wrapper" id="stock-widget-${def.id}">
                        <div class="widget-content stock-widget-content" id="stock-widget-content-${def.id}">
                            ${this.getWidgetPlaceholder(def.id)}
                        </div>
                    </div>
                `,
            };
        });

        this.grid = GridStack.init({
            column: 12,
            cellHeight: 50,
            margin: 8,
            float: false,
            animate: true,
            disableDrag: true,
            disableResize: true,
            removable: false,
        }, '#stock-detail-grid');

        this.grid.load(items);

        this.grid.on('change', () => {
            this.saveLayout();
        });
    },

    getWidgetPlaceholder(id) {
        const today = new Date().toISOString().split('T')[0];
        const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0];

        switch (id) {
            case 'chart':
                return `
                    <div class="stock-widget-header">
                        <h3>Price Chart</h3>
                    </div>
                    <div class="chart-container" style="border:none;padding:0;min-height:0;background:transparent">
                        <div id="chart-pick-banner" class="chart-pick-banner hidden"></div>
                        <div class="chart-area" id="main-chart" style="height:100%;min-height:300px"></div>
                        <div id="chart-tooltip" class="chart-hover-tooltip hidden"></div>
                    </div>
                `;
            case 'indicators':
                return `
                    <div class="stock-widget-header">
                        <h3>Indicators</h3>
                    </div>
                    <div id="indicators-content" class="indicators-flow">
                        <div class="loading-spinner"><div class="spinner"></div></div>
                    </div>
                `;
            case 'action-card':
                return `<div id="action-card-area"><div class="text-muted" style="padding:16px;font-size:0.85rem">Loading...</div></div>`;
            case 'earnings-warning':
                return `<div id="earnings-warning-area"><div class="text-muted" style="padding:16px;font-size:0.85rem">Loading earnings...</div></div>`;
            case 'related-stocks':
                return `
                    <div class="stock-widget-header">
                        <h3>Related Stocks</h3>
                        <span class="text-muted" style="font-size:0.7rem">Sympathy plays</span>
                    </div>
                    <div id="related-stocks-content">
                        <div class="loading-spinner"><div class="spinner"></div></div>
                    </div>
                `;
            case 'signals-list':
                return `<div id="signals-list-area"></div>`;
            case 'fundamentals':
                return `
                    <div class="stock-widget-header">
                        <h3>Fundamentals</h3>
                        <span id="fund-sector" class="text-muted" style="font-size:0.75rem"></span>
                    </div>
                    <div id="fundamentals-data" class="fundamentals-grid"></div>
                `;
            case 'insider-trading':
                return `
                    <div class="stock-widget-header">
                        <h3>Insider Trading</h3>
                        <a href="#/investigate/${this.symbol}" class="btn btn-ghost btn-sm" style="font-size:0.7rem">Full Report</a>
                    </div>
                    <div id="insider-content">
                        <div class="loading-spinner"><div class="spinner"></div></div>
                    </div>
                `;
            case 'mini-news':
                return `
                    <div class="stock-widget-header">
                        <h3>Recent News</h3>
                        <div style="display:flex;gap:8px;align-items:center">
                            <span id="mini-sentiment-badge"></span>
                            <a href="#/investigate/${this.symbol}" class="btn btn-ghost btn-sm" style="font-size:0.7rem">Full Research</a>
                        </div>
                    </div>
                    <div id="mini-news-content">
                        <button class="btn btn-ghost btn-sm" id="load-mini-news" style="width:100%;padding:16px">Load News &amp; Sentiment</button>
                    </div>
                `;
            case 'social-trending':
                return `
                    <div class="stock-widget-header">
                        <h3>Social Trending</h3>
                    </div>
                    <div id="social-content">
                        <div class="loading-spinner"><div class="spinner"></div></div>
                    </div>
                `;
            case 'position-sizing':
                return `
                    <div class="stock-widget-header">
                        <h3>Position Sizing</h3>
                        <span class="text-muted" style="font-size:0.75rem">ATR-based risk management</span>
                    </div>
                    <div class="calculator-form" style="margin-bottom:12px">
                        <div class="form-group">
                            <label>Account Size ($)</label>
                            <input type="number" id="ps-account-size" value="200" min="1" step="any">
                        </div>
                        <div class="form-group">
                            <label>Risk %</label>
                            <input type="number" id="ps-risk-pct" value="2" min="0.1" max="100" step="0.1">
                        </div>
                        <div class="form-group" style="flex:0">
                            <label style="visibility:hidden">_</label>
                            <button class="btn btn-primary" id="ps-calculate">Calculate</button>
                        </div>
                    </div>
                    <div id="ps-results"></div>
                `;
            case 'notes':
                return `
                    <div class="stock-widget-header">
                        <h3>Notes</h3>
                        <div style="display:flex;gap:8px;align-items:center">
                            <span id="notes-status" class="text-muted" style="font-size:0.75rem"></span>
                            <button class="btn btn-primary btn-sm" id="save-notes">Save</button>
                        </div>
                    </div>
                    <div id="notes-editor-area">
                        <textarea id="notes-textarea"></textarea>
                    </div>
                `;
            case 'trade-calculator':
                return `
                    <div class="stock-widget-header">
                        <h3>Trade Calculator</h3>
                        <span class="text-muted" style="font-size:0.75rem">What-if scenario</span>
                    </div>
                    <div class="calculator-form" style="margin-bottom:12px">
                        <div class="form-group">
                            <label>Buy Date</label>
                            <div style="display:flex;gap:6px">
                                <input type="date" id="calc-entry-date" value="${yearAgo}" max="${today}" style="flex:1">
                                <button class="btn btn-ghost btn-sm" id="calc-pick-entry" title="Pick from chart">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <line x1="22" y1="12" x2="18" y2="12"></line>
                                        <line x1="6" y1="12" x2="2" y2="12"></line>
                                        <line x1="12" y1="6" x2="12" y2="2"></line>
                                        <line x1="12" y1="22" x2="12" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Sell Date</label>
                            <div style="display:flex;gap:6px">
                                <input type="date" id="calc-exit-date" value="${today}" max="${today}" style="flex:1">
                                <button class="btn btn-ghost btn-sm" id="calc-pick-exit" title="Pick from chart">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <line x1="22" y1="12" x2="18" y2="12"></line>
                                        <line x1="6" y1="12" x2="2" y2="12"></line>
                                        <line x1="12" y1="6" x2="12" y2="2"></line>
                                        <line x1="12" y1="22" x2="12" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Amount</label>
                            <input type="number" id="calc-amount" value="1000" min="0" step="any">
                        </div>
                        <div class="form-group" style="min-width:100px">
                            <label>Type</label>
                            <select id="calc-amount-type">
                                <option value="dollars">Dollars</option>
                                <option value="shares">Shares</option>
                            </select>
                        </div>
                        <div class="form-group" style="flex:0">
                            <label style="visibility:hidden">_</label>
                            <button class="btn btn-primary" id="calc-run">Calculate</button>
                        </div>
                    </div>
                    <div id="calc-results"></div>
                `;
            case 'simulations':
                return `
                    <div class="stock-widget-header">
                        <h3>Saved Simulations</h3>
                        <button class="btn btn-ghost btn-sm" id="clear-sims" title="Clear all">Clear</button>
                    </div>
                    <div id="simulations-list"></div>
                `;
            case 'llm-result':
                return `<div id="llm-result-area"></div>`;
            default:
                return '';
        }
    },

    wireWidgetListeners() {
        // Position sizing
        const psCalc = document.getElementById('ps-calculate');
        if (psCalc) psCalc.addEventListener('click', () => this.calculatePositionSize());

        // Notes
        const saveNotes = document.getElementById('save-notes');
        if (saveNotes) saveNotes.addEventListener('click', () => this.saveNotes());

        // Mini news
        const loadNews = document.getElementById('load-mini-news');
        if (loadNews) loadNews.addEventListener('click', () => this.loadMiniNews());

        // Calculator
        const calcRun = document.getElementById('calc-run');
        if (calcRun) calcRun.addEventListener('click', () => this.runCalculator());
        const pickEntry = document.getElementById('calc-pick-entry');
        if (pickEntry) pickEntry.addEventListener('click', () => this.startPick('entry'));
        const pickExit = document.getElementById('calc-pick-exit');
        if (pickExit) pickExit.addEventListener('click', () => this.startPick('exit'));

        // Clear simulations
        const clearSims = document.getElementById('clear-sims');
        if (clearSims) clearSims.addEventListener('click', () => this.clearSimulations());
    },

    // --- Layout edit mode ---
    toggleEditMode() {
        this.editMode = !this.editMode;
        const bar = document.getElementById('stock-layout-edit-bar');
        const gridEl = document.getElementById('stock-detail-grid');
        const editBtn = document.getElementById('stock-edit-layout-btn');

        if (this.editMode) {
            bar.classList.remove('hidden');
            gridEl.classList.add('gs-edit-mode');
            editBtn.classList.add('active');
            this.grid.enableMove(true);
            this.grid.enableResize(true);
        } else {
            bar.classList.add('hidden');
            gridEl.classList.remove('gs-edit-mode');
            editBtn.classList.remove('active');
            this.grid.enableMove(false);
            this.grid.enableResize(false);
            this.saveLayout();
        }
    },

    saveLayout() {
        if (!this.grid) return;
        const items = [];
        this.grid.engine.nodes.forEach(n => {
            items.push({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h });
        });
        localStorage.setItem(this.getLayoutKey(), JSON.stringify(items));
    },

    loadLayout() {
        try {
            const data = localStorage.getItem(this.getLayoutKey());
            return data ? JSON.parse(data) : null;
        } catch { return null; }
    },

    async loadData(period) {
        try {
            const data = await App.get(`/api/stock/${this.symbol}?period=${period}`);
            this.currentData = data;
            this.renderChart(data);
            this.renderIndicators(data.summary);
            this.renderActionCard(data.summary);
            this.renderSignalsList(data.summary);
        } catch (err) {
            App.toast(`Failed to load ${this.symbol}: ${err.message}`, 'error');
        }
    },

    // --- Chart click date picking ---
    startPick(which) {
        this.calcPickMode = which;
        const banner = document.getElementById('chart-pick-banner');
        if (banner) {
            banner.textContent = `Click on the chart to set ${which === 'entry' ? 'BUY' : 'SELL'} date`;
            banner.className = `chart-pick-banner active ${which === 'entry' ? 'pick-entry' : 'pick-exit'}`;
        }
        // Highlight the active button
        document.getElementById('calc-pick-entry').classList.toggle('btn-active', which === 'entry');
        document.getElementById('calc-pick-exit').classList.toggle('btn-active', which === 'exit');
    },

    handleChartClick(param) {
        if (!this.calcPickMode || !param.time) return;
        const dateStr = typeof param.time === 'string' ? param.time :
            `${param.time.year}-${String(param.time.month).padStart(2,'0')}-${String(param.time.day).padStart(2,'0')}`;

        if (this.calcPickMode === 'entry') {
            document.getElementById('calc-entry-date').value = dateStr;
        } else {
            document.getElementById('calc-exit-date').value = dateStr;
        }

        this.calcPickMode = null;
        const banner = document.getElementById('chart-pick-banner');
        if (banner) banner.className = 'chart-pick-banner hidden';
        document.getElementById('calc-pick-entry').classList.remove('btn-active');
        document.getElementById('calc-pick-exit').classList.remove('btn-active');
    },

    renderChart(data) {
        const el = document.getElementById('main-chart');
        if (!el) return;
        if (this.chart) {
            try { this.chart.remove(); } catch(e) {}
        }

        this.chart = LightweightCharts.createChart(el, {
            width: el.clientWidth,
            height: el.clientHeight || 380,
            layout: {
                background: { type: 'solid', color: '#1a2035' },
                textColor: '#8899b0',
                fontFamily: "'Inter', sans-serif",
                fontSize: 11,
            },
            grid: {
                vertLines: { color: 'rgba(136, 153, 176, 0.06)' },
                horzLines: { color: 'rgba(136, 153, 176, 0.06)' },
            },
            rightPriceScale: {
                borderColor: 'rgba(136, 153, 176, 0.12)',
            },
            timeScale: {
                borderColor: 'rgba(136, 153, 176, 0.12)',
                timeVisible: false,
            },
            crosshair: {
                mode: 0,
                vertLine: { color: 'rgba(136, 153, 176, 0.3)', width: 1, style: 2 },
                horzLine: { color: 'rgba(136, 153, 176, 0.3)', width: 1, style: 2 },
            },
        });

        // Subscribe to clicks for date picking
        this.chart.subscribeClick((param) => this.handleChartClick(param));

        // Candlestick series
        const candleSeries = this.chart.addCandlestickSeries({
            upColor: '#00d4aa',
            downColor: '#ff4757',
            borderVisible: false,
            wickUpColor: '#00d4aa',
            wickDownColor: '#ff4757',
        });
        candleSeries.setData(data.ohlcv);

        // SMA overlays
        if (data.indicators.sma_short?.length) {
            const smaShort = this.chart.addLineSeries({
                color: '#4a9eff',
                lineWidth: 1,
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: false,
                title: 'SMA20',
            });
            smaShort.setData(data.indicators.sma_short);
        }

        if (data.indicators.sma_long?.length) {
            const smaLong = this.chart.addLineSeries({
                color: '#a78bfa',
                lineWidth: 1,
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: false,
                title: 'SMA50',
            });
            smaLong.setData(data.indicators.sma_long);
        }

        // Bollinger Bands
        if (data.indicators.bb_upper?.length) {
            const bbUpper = this.chart.addLineSeries({
                color: 'rgba(255, 193, 7, 0.3)',
                lineWidth: 1,
                lineStyle: 2,
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: false,
            });
            bbUpper.setData(data.indicators.bb_upper);

            const bbLower = this.chart.addLineSeries({
                color: 'rgba(255, 193, 7, 0.3)',
                lineWidth: 1,
                lineStyle: 2,
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: false,
            });
            bbLower.setData(data.indicators.bb_lower);
        }

        // Volume as histogram on a separate price scale
        const volumeSeries = this.chart.addHistogramSeries({
            color: 'rgba(136, 153, 176, 0.2)',
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
            priceLineVisible: false,
            lastValueVisible: false,
        });

        this.chart.priceScale('volume').applyOptions({
            scaleMargins: { top: 0.85, bottom: 0 },
        });

        const volumeData = data.ohlcv.map(c => ({
            time: c.time,
            value: c.volume,
            color: c.close >= c.open ? 'rgba(0, 212, 170, 0.25)' : 'rgba(255, 71, 87, 0.25)',
        }));
        volumeSeries.setData(volumeData);

        this.chart.timeScale().fitContent();

        // --- Hover tooltip for OHLCV ---
        const tooltipEl = document.getElementById('chart-tooltip');
        const ohlcvMap = {};
        data.ohlcv.forEach(c => { ohlcvMap[c.time] = c; });

        this.chart.subscribeCrosshairMove((param) => {
            if (!tooltipEl) return;
            if (!param.time || param.point === undefined || param.point.x < 0 || param.point.y < 0) {
                tooltipEl.classList.add('hidden');
                return;
            }
            const d = ohlcvMap[param.time] || ohlcvMap[`${param.time.year}-${String(param.time.month).padStart(2,'0')}-${String(param.time.day).padStart(2,'0')}`];
            if (!d) { tooltipEl.classList.add('hidden'); return; }

            const change = d.close - d.open;
            const changePct = d.open ? ((change / d.open) * 100).toFixed(2) : '0.00';
            const changeSign = change >= 0 ? '+' : '';
            const changeColor = change >= 0 ? '#00d4aa' : '#ff4757';

            tooltipEl.innerHTML = `
                <div style="font-weight:600;margin-bottom:4px;color:var(--text-primary)">${d.time}</div>
                <div><span class="text-muted">O:</span> <span style="font-family:var(--font-mono)">${d.open.toFixed(2)}</span></div>
                <div><span class="text-muted">H:</span> <span style="font-family:var(--font-mono)">${d.high.toFixed(2)}</span></div>
                <div><span class="text-muted">L:</span> <span style="font-family:var(--font-mono)">${d.low.toFixed(2)}</span></div>
                <div><span class="text-muted">C:</span> <span style="font-family:var(--font-mono)">${d.close.toFixed(2)}</span></div>
                <div><span class="text-muted">V:</span> <span style="font-family:var(--font-mono)">${d.volume.toLocaleString()}</span></div>
                <div style="margin-top:4px;color:${changeColor};font-weight:600;font-family:var(--font-mono)">${changeSign}${change.toFixed(2)} (${changeSign}${changePct}%)</div>
            `;
            tooltipEl.classList.remove('hidden');

            // Position tooltip near cursor but keep within chart bounds
            const chartRect = el.getBoundingClientRect();
            let left = param.point.x + 16;
            let top = param.point.y - 10;
            if (left + 160 > chartRect.width) left = param.point.x - 170;
            if (top < 0) top = 10;
            tooltipEl.style.left = left + 'px';
            tooltipEl.style.top = top + 'px';
        });

        // Resize observer
        const resizeObserver = new ResizeObserver(() => {
            if (this.chart) {
                this.chart.applyOptions({ width: el.clientWidth, height: el.clientHeight || 380 });
            }
        });
        resizeObserver.observe(el);
    },

    renderIndicators(summary) {
        const container = document.getElementById('indicators-content');
        if (!container) return;
        const rsiClass = App.rsiClass(summary.rsi);
        const rsiColor = rsiClass === 'oversold' ? '#00d4aa' : rsiClass === 'overbought' ? '#ff4757' : '#8899b0';
        const rsiWidth = Math.min(100, Math.max(0, summary.rsi));

        const macdColor = summary.macd_histogram > 0 ? '#00d4aa' : '#ff4757';
        const adxWidth = Math.min(100, Math.max(0, (summary.adx / 50) * 100));

        container.innerHTML = `
            <div class="indicator-card" title="Relative Strength Index — measures if a stock is overbought or oversold. Below 30 = oversold (potential buy opportunity). Above 70 = overbought (potential sell signal). Between 30-70 = neutral.">
                <div class="indicator-card-label">RSI (14) <span class="tooltip-icon">?</span></div>
                <div class="indicator-card-value" style="color:${rsiColor}">${summary.rsi?.toFixed(1) ?? '—'}</div>
                <div class="indicator-bar">
                    <div class="indicator-bar-fill" style="width:${rsiWidth}%;background:${rsiColor}"></div>
                </div>
                <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:0.65rem;color:var(--text-muted)">
                    <span>Oversold (&lt;30)</span><span>Overbought (&gt;70)</span>
                </div>
            </div>

            <div class="indicator-card" title="Moving Average Convergence Divergence — tracks momentum. When MACD crosses above the Signal line, momentum is turning positive (bullish). When it crosses below, momentum is weakening (bearish). The Histogram shows the gap between them.">
                <div class="indicator-card-label">MACD <span class="tooltip-icon">?</span></div>
                <div class="indicator-card-value" style="color:${macdColor}">${summary.macd?.toFixed(4) ?? '—'}</div>
                <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">
                    Signal: ${summary.macd_signal?.toFixed(4) ?? '—'} &nbsp;|&nbsp;
                    Hist: <span style="color:${macdColor}">${summary.macd_histogram?.toFixed(4) ?? '—'}</span>
                </div>
                <div class="indicator-tooltip-text">${summary.macd_histogram > 0 ? '📈 Momentum is positive — MACD is above signal line' : '📉 Momentum is negative — MACD is below signal line'}</div>
            </div>

            <div class="indicator-card" title="Average Directional Index — measures how STRONG the trend is, not its direction. Below 20 = weak/no trend (choppy market). 20-40 = moderate trend. Above 40 = very strong trend. +DI > -DI means upward pressure dominates.">
                <div class="indicator-card-label">ADX (Trend Strength) <span class="tooltip-icon">?</span></div>
                <div class="indicator-card-value">${summary.adx?.toFixed(1) ?? '—'}</div>
                <div class="indicator-bar">
                    <div class="indicator-bar-fill" style="width:${adxWidth}%;background:var(--blue)"></div>
                </div>
                <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">
                    +DI: ${summary.adx_pos?.toFixed(1) ?? '—'} &nbsp;|&nbsp;
                    -DI: ${summary.adx_neg?.toFixed(1) ?? '—'}
                </div>
                <div class="indicator-tooltip-text">${summary.adx > 25 ? (summary.adx_pos > summary.adx_neg ? '⬆️ Strong upward trend' : '⬇️ Strong downward trend') : '↔️ Weak or no clear trend'}</div>
            </div>

            <div class="indicator-card" title="Stochastic Oscillator — compares today's close to its price range over 14 days. Below 20 = stock is near its recent low (oversold). Above 80 = near its recent high (overbought). Similar to RSI but reacts faster.">
                <div class="indicator-card-label">Stochastic <span class="tooltip-icon">?</span></div>
                <div class="indicator-card-value">${summary.stoch_k?.toFixed(1) ?? '—'}</div>
                <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">
                    %K: ${summary.stoch_k?.toFixed(1) ?? '—'} &nbsp;|&nbsp;
                    %D: ${summary.stoch_d?.toFixed(1) ?? '—'}
                </div>
                <div class="indicator-tooltip-text">${summary.stoch_k < 20 ? '🟢 Near recent lows — potential oversold bounce' : summary.stoch_k > 80 ? '🔴 Near recent highs — potentially overbought' : '⚪ Mid-range — no extreme reading'}</div>
            </div>

            <div class="indicator-card" title="Average True Range — measures daily price volatility in dollar terms. Higher ATR = bigger daily swings = more volatile. Used to set stop-losses: a stock with $5 ATR needs wider stops than one with $1 ATR.">
                <div class="indicator-card-label">ATR (Volatility) <span class="tooltip-icon">?</span></div>
                <div class="indicator-card-value">${summary.atr != null ? '$' + summary.atr.toFixed(2) : '—'}</div>
                <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">
                    ${summary.close && summary.atr ? ('Average daily swing: ' + (summary.atr / summary.close * 100).toFixed(2) + '% of price') : ''}
                </div>
            </div>

            <div class="indicator-card" title="Overall trend direction based on moving averages. Bullish = SMA20 is above SMA50 (short-term price is higher than long-term average, uptrend). Bearish = SMA20 is below SMA50 (downtrend).">
                <div class="indicator-card-label">Trend <span class="tooltip-icon">?</span></div>
                <div>
                    <span class="trend-badge ${summary.trend}">${summary.trend}</span>
                </div>
                <div style="font-size:0.75rem;color:var(--text-muted);margin-top:6px">
                    SMA20: $${summary.sma_short?.toFixed(2) ?? '—'}  (20-day avg)<br>
                    SMA50: $${summary.sma_long?.toFixed(2) ?? '—'}  (50-day avg)
                </div>
            </div>

            <div class="indicator-card" title="On-Balance Volume trend — tracks whether volume is flowing into or out of the stock. Rising = more volume on up-days (accumulation, bullish). Falling = more volume on down-days (distribution, bearish).">
                <div class="indicator-card-label">OBV Trend <span class="tooltip-icon">?</span></div>
                <div class="indicator-card-value">${summary.obv_trend ?? '—'}</div>
                <div class="indicator-tooltip-text">${summary.obv_trend === 'rising' ? '📈 Money is flowing INTO this stock' : summary.obv_trend === 'falling' ? '📉 Money is flowing OUT of this stock' : '↔️ Volume flow is neutral'}</div>
            </div>

            <div class="indicator-card" title="Current trading volume compared to the 20-day average. 1.0x = normal. 2.0x = twice the usual volume (high interest). Above-average volume makes signals more reliable.">
                <div class="indicator-card-label">Volume <span class="tooltip-icon">?</span></div>
                <div class="indicator-card-value">${summary.volume_ratio?.toFixed(1) ?? '—'}x</div>
                <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">
                    vs 20-day average
                </div>
                <div class="indicator-tooltip-text">${summary.volume_ratio > 1.5 ? '🔥 Unusually high volume — strong interest' : summary.volume_ratio < 0.7 ? '😴 Low volume — weak conviction' : '📊 Normal trading volume'}</div>
            </div>
        `;
    },

    renderActionCard(summary) {
        const area = document.getElementById('action-card-area');
        const signals = summary.signals || [];
        const strongBull = summary.strong_bullish || 0;
        const strongBear = summary.strong_bearish || 0;
        const supportBull = summary.support_bullish || 0;
        const supportBear = summary.support_bearish || 0;

        let action, actionClass, reasoning;

        if (strongBull >= 2 || (strongBull >= 1 && supportBull >= 1 && summary.trend === 'bullish')) {
            action = 'BUY';
            actionClass = 'buy';
            reasoning = `${strongBull} strong + ${supportBull} supporting bullish signals in ${summary.trend} trend`;
        } else if (strongBear >= 2 || (strongBear >= 1 && supportBear >= 1 && summary.trend === 'bearish')) {
            action = 'SELL';
            actionClass = 'sell';
            reasoning = `${strongBear} strong + ${supportBear} supporting bearish signals in ${summary.trend} trend`;
        } else {
            action = 'HOLD';
            actionClass = 'hold';
            reasoning = 'Insufficient signal confirmation for action';
        }

        area.innerHTML = `
            <div class="action-card action-${actionClass}">
                <div style="display:flex;align-items:center;justify-content:space-between">
                    <div>
                        <div class="indicator-card-label">Signal Recommendation</div>
                        <div class="action-label ${actionClass}">${action}</div>
                    </div>
                    <div style="text-align:right">
                        <div style="font-size:0.75rem;color:var(--text-muted)">
                            Bullish: ${strongBull}s + ${supportBull}sup &nbsp;|&nbsp;
                            Bearish: ${strongBear}s + ${supportBear}sup
                        </div>
                        <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:4px">${reasoning}</div>
                    </div>
                </div>
            </div>
        `;
    },

    renderSignalsList(summary) {
        const area = document.getElementById('signals-list-area');
        const signals = summary.signals || [];

        if (signals.length === 0) {
            area.innerHTML = '';
            return;
        }

        area.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3>Active Signals</h3>
                </div>
                <div style="display:flex;flex-direction:column;gap:6px">
                    ${signals.map(s => {
                        const isBullish = s.toLowerCase().includes('bullish') || s.toLowerCase().includes('oversold') ||
                                          s.toLowerCase().includes('golden') || s.toLowerCase().includes('above');
                        const color = isBullish ? 'var(--green)' : 'var(--red)';
                        return `<div style="padding:8px 12px;background:var(--bg-surface);border-radius:var(--radius-sm);font-size:0.85rem;border-left:3px solid ${color}">
                            ${App.escapeHtml(s)}
                        </div>`;
                    }).join('')}
                </div>
            </div>
        `;
    },

    // --- Trade Calculator ---
    async runCalculator() {
        const entryDate = document.getElementById('calc-entry-date').value;
        const exitDate = document.getElementById('calc-exit-date').value;
        const amount = parseFloat(document.getElementById('calc-amount').value);
        const amountType = document.getElementById('calc-amount-type').value;

        if (!entryDate || !exitDate) { App.toast('Select both dates', 'error'); return; }
        if (entryDate >= exitDate) { App.toast('Buy date must be before sell date', 'error'); return; }
        if (!amount || amount <= 0) { App.toast('Enter a valid amount', 'error'); return; }

        const resultsEl = document.getElementById('calc-results');
        resultsEl.innerHTML = '<div class="loading-spinner"><div class="spinner"></div>Calculating...</div>';

        try {
            const data = await App.post('/api/calculator/trade', {
                symbol: this.symbol,
                entry_date: entryDate,
                exit_date: exitDate,
                amount,
                amount_type: amountType,
            });

            this.renderCalcResults(data);
            this.saveSimulation(data);
        } catch (err) {
            resultsEl.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${App.escapeHtml(err.message)}</p></div>`;
        }
    },

    renderCalcResults(data) {
        const resultsEl = document.getElementById('calc-results');
        if (!resultsEl) return;

        const isProfit = data.pnl_dollars >= 0;
        const pnlClass = isProfit ? 'positive' : 'negative';
        const pnlSign = isProfit ? '+' : '';

        let dateNote = '';
        if (data.actual_entry_date !== data.entry_date || data.actual_exit_date !== data.exit_date) {
            const parts = [];
            if (data.actual_entry_date !== data.entry_date)
                parts.push(`Buy adjusted to ${data.actual_entry_date}`);
            if (data.actual_exit_date !== data.exit_date)
                parts.push(`Sell adjusted to ${data.actual_exit_date}`);
            dateNote = `<div class="date-adjusted-note">${parts.join(' | ')}</div>`;
        }

        resultsEl.innerHTML = `
            ${dateNote}
            <div class="calculator-results">
                <div class="stat-card">
                    <div class="stat-card-label">Entry Price</div>
                    <div class="stat-card-value">${App.formatPrice(data.entry_price)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-label">Exit Price</div>
                    <div class="stat-card-value">${App.formatPrice(data.exit_price)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-label">Shares</div>
                    <div class="stat-card-value">${data.shares.toLocaleString(undefined, {maximumFractionDigits: 4})}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-label">Profit / Loss</div>
                    <div class="stat-card-value ${pnlClass}">${pnlSign}${App.formatPrice(Math.abs(data.pnl_dollars))}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-label">Return</div>
                    <div class="stat-card-value ${pnlClass}">${pnlSign}${data.pnl_pct.toFixed(2)}%</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-label">Days Held</div>
                    <div class="stat-card-value">${data.days_held}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-label">Annualized</div>
                    <div class="stat-card-value ${data.annualized_return >= 0 ? 'positive' : 'negative'}">${data.annualized_return >= 0 ? '+' : ''}${data.annualized_return.toFixed(2)}%</div>
                </div>
            </div>
            <div class="calculator-chart-container" style="background:transparent;border:none;padding:0">
                <div class="calculator-chart-area" id="calc-mini-chart"></div>
            </div>
        `;

        this.renderCalcChart(data);
    },

    renderCalcChart(data) {
        const chartEl = document.getElementById('calc-mini-chart');
        if (!chartEl || !data.ohlcv || data.ohlcv.length === 0) return;

        if (this.calcChart) {
            try { this.calcChart.remove(); } catch(e) {}
            this.calcChart = null;
        }

        this.calcChart = LightweightCharts.createChart(chartEl, {
            width: chartEl.clientWidth,
            height: 250,
            layout: {
                background: { color: 'transparent' },
                textColor: '#8899b0',
                fontSize: 11,
            },
            grid: {
                vertLines: { color: 'rgba(136,153,176,0.06)' },
                horzLines: { color: 'rgba(136,153,176,0.06)' },
            },
            timeScale: { borderColor: 'rgba(136,153,176,0.1)', timeVisible: false },
            rightPriceScale: { borderColor: 'rgba(136,153,176,0.1)' },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
                vertLine: { color: 'rgba(136,153,176,0.3)', width: 1, style: 3 },
                horzLine: { color: 'rgba(136,153,176,0.3)', width: 1, style: 3 },
            },
        });

        const candleSeries = this.calcChart.addCandlestickSeries({
            upColor: '#00d4aa',
            downColor: '#ff4757',
            borderUpColor: '#00d4aa',
            borderDownColor: '#ff4757',
            wickUpColor: '#00d4aa',
            wickDownColor: '#ff4757',
        });

        candleSeries.setData(data.ohlcv);

        const isProfit = data.pnl_pct >= 0;
        candleSeries.setMarkers([
            {
                time: data.actual_entry_date,
                position: 'belowBar',
                color: '#4a9eff',
                shape: 'arrowUp',
                text: `BUY @ ${App.formatPrice(data.entry_price)}`,
            },
            {
                time: data.actual_exit_date,
                position: 'aboveBar',
                color: isProfit ? '#00d4aa' : '#ff4757',
                shape: 'arrowDown',
                text: `SELL @ ${App.formatPrice(data.exit_price)}`,
            },
        ]);

        this.calcChart.timeScale().fitContent();

        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                if (this.calcChart) {
                    this.calcChart.applyOptions({ width: entry.contentRect.width });
                }
            }
        });
        observer.observe(chartEl);
    },

    // --- Simulations persistence (localStorage) ---
    _getSimKey() {
        return `sd_sims_${this.symbol}`;
    },

    getSimulations() {
        try {
            return JSON.parse(localStorage.getItem(this._getSimKey()) || '[]');
        } catch { return []; }
    },

    saveSimulation(data) {
        const sims = this.getSimulations();
        sims.unshift({
            entry_date: data.actual_entry_date,
            exit_date: data.actual_exit_date,
            entry_price: data.entry_price,
            exit_price: data.exit_price,
            shares: data.shares,
            pnl_dollars: data.pnl_dollars,
            pnl_pct: data.pnl_pct,
            days_held: data.days_held,
            annualized_return: data.annualized_return,
            entry_value: data.entry_value,
            ran_at: new Date().toISOString(),
        });
        // Keep last 20
        if (sims.length > 20) sims.length = 20;
        localStorage.setItem(this._getSimKey(), JSON.stringify(sims));
        this.renderSimulations();
    },

    clearSimulations() {
        localStorage.removeItem(this._getSimKey());
        this.renderSimulations();
    },

    renderSimulations() {
        const listEl = document.getElementById('simulations-list');
        if (!listEl) return;

        const sims = this.getSimulations();
        if (sims.length === 0) {
            listEl.innerHTML = '<div class="text-muted" style="font-size:0.8rem;padding:8px 0">No saved simulations. Use the calculator above to run a what-if scenario.</div>';
            return;
        }

        listEl.innerHTML = `
            <table class="signals-table" style="font-size:0.8rem">
                <thead>
                    <tr>
                        <th>Buy</th>
                        <th>Sell</th>
                        <th>Entry</th>
                        <th>Exit</th>
                        <th>Invested</th>
                        <th>P&L</th>
                        <th>Return</th>
                        <th>Days</th>
                    </tr>
                </thead>
                <tbody>
                    ${sims.map(s => {
                        const isProfit = s.pnl_dollars >= 0;
                        const cls = isProfit ? 'text-green' : 'text-red';
                        const sign = isProfit ? '+' : '';
                        return `
                            <tr>
                                <td class="text-mono">${s.entry_date}</td>
                                <td class="text-mono">${s.exit_date}</td>
                                <td class="text-mono">${App.formatPrice(s.entry_price)}</td>
                                <td class="text-mono">${App.formatPrice(s.exit_price)}</td>
                                <td class="text-mono">${App.formatPrice(s.entry_value)}</td>
                                <td class="text-mono ${cls}">${sign}${App.formatPrice(Math.abs(s.pnl_dollars))}</td>
                                <td class="text-mono ${cls}">${sign}${s.pnl_pct.toFixed(2)}%</td>
                                <td class="text-mono">${s.days_held}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    },

    async runLLM() {
        const area = document.getElementById('llm-result-area');
        const btn = document.getElementById('llm-btn');

        btn.disabled = true;
        btn.innerHTML = '<div class="spinner" style="width:14px;height:14px"></div> Analyzing...';

        area.innerHTML = `
            <div class="card">
                <div class="loading-spinner"><div class="spinner"></div>Running LLM analysis (this may take 10-30 seconds)...</div>
            </div>
        `;

        try {
            const result = await App.post(`/api/llm/${this.symbol}`);
            const a = result.analysis;

            const actionClass = (a.action || '').toLowerCase();
            const confColor = a.confidence >= 6 ? 'var(--green)' : a.confidence >= 4 ? 'var(--gold)' : 'var(--red)';

            area.innerHTML = `
                <div class="action-card action-${actionClass === 'buy' ? 'buy' : actionClass === 'sell' ? 'sell' : 'hold'}">
                    <div class="card-header">
                        <h3>LLM Analysis</h3>
                        <span style="font-size:0.75rem;color:var(--text-muted)">via Ollama</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:20px;margin-bottom:12px">
                        <div class="action-label ${actionClass}">${a.action || 'N/A'}</div>
                        <div>
                            <span style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase">Confidence</span>
                            <div style="font-family:var(--font-mono);font-size:1.5rem;font-weight:700;color:${confColor}">${a.confidence || 0}/10</div>
                        </div>
                    </div>
                    <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:12px">${App.escapeHtml(a.reasoning || '')}</div>
                    ${a.key_signals?.length ? `
                        <div style="margin-bottom:8px">
                            <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Key Signals</div>
                            ${a.key_signals.map(s => `<span style="display:inline-block;padding:2px 8px;background:var(--green-dim);color:var(--green);border-radius:4px;font-size:0.75rem;margin:2px">${App.escapeHtml(s)}</span>`).join('')}
                        </div>
                    ` : ''}
                    ${a.risk_factors?.length ? `
                        <div>
                            <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Risk Factors</div>
                            ${a.risk_factors.map(r => `<span style="display:inline-block;padding:2px 8px;background:var(--red-dim);color:var(--red);border-radius:4px;font-size:0.75rem;margin:2px">${App.escapeHtml(r)}</span>`).join('')}
                        </div>
                    ` : ''}
                    ${a.suggested_stop_loss_pct ? `
                        <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);font-size:0.8rem;color:var(--text-secondary)">
                            Stop Loss: ${a.suggested_stop_loss_pct}% &nbsp;|&nbsp; Take Profit: ${a.suggested_take_profit_pct}%
                        </div>
                    ` : ''}
                </div>
            `;
        } catch (err) {
            area.innerHTML = `
                <div class="card" style="border-color:var(--red)">
                    <div style="color:var(--red);font-weight:600;margin-bottom:4px">LLM Analysis Failed</div>
                    <div style="font-size:0.85rem;color:var(--text-secondary)">${App.escapeHtml(err.message)}</div>
                    <div style="font-size:0.75rem;color:var(--text-muted);margin-top:8px">Make sure Ollama is running locally with the qwen3:8b model loaded.</div>
                </div>
            `;
        } finally {
            btn.disabled = false;
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"></path>
                    <path d="M12 6v6l4 2"></path>
                </svg>
                LLM Analysis
            `;
        }
    },

    // --- Notes ---
    initNotesEditor() {
        const textarea = document.getElementById('notes-textarea');
        if (!textarea) return;
        try {
            this.notesEditor = new EasyMDE({
                element: textarea,
                spellChecker: false,
                autosave: { enabled: false },
                status: false,
                minHeight: '200px',
                placeholder: 'Write your analysis, reasons for buying/selling, link to SEC filings, format pros/cons...',
                toolbar: ['bold', 'italic', 'heading', '|', 'unordered-list', 'ordered-list', '|',
                           'link', 'quote', 'code', '|', 'preview', 'side-by-side', '|', 'guide'],
            });
        } catch (e) {
            console.warn('EasyMDE not available, using plain textarea');
            textarea.style.width = '100%';
            textarea.style.minHeight = '200px';
            textarea.style.background = 'var(--bg-input)';
            textarea.style.color = 'var(--text-primary)';
            textarea.style.border = '1px solid var(--border)';
            textarea.style.borderRadius = 'var(--radius-sm)';
            textarea.style.padding = '12px';
            textarea.style.fontFamily = 'var(--font-mono)';
            textarea.placeholder = 'Write your analysis notes here...';
        }
    },

    async loadNotes() {
        try {
            const data = await App.get(`/api/stock/${this.symbol}/notes`);
            if (data && data.content) {
                if (this.notesEditor && this.notesEditor.value) {
                    this.notesEditor.value(data.content);
                } else {
                    const textarea = document.getElementById('notes-textarea');
                    if (textarea) textarea.value = data.content;
                }
                if (data.updated_at) {
                    const statusEl = document.getElementById('notes-status');
                    if (statusEl) statusEl.textContent = `Last saved: ${new Date(data.updated_at).toLocaleString()}`;
                }
            }
        } catch (e) {
            console.warn('Failed to load notes:', e);
        }
    },

    async saveNotes() {
        const content = this.notesEditor ? this.notesEditor.value() :
            document.getElementById('notes-textarea')?.value || '';
        try {
            const result = await App.put(`/api/stock/${this.symbol}/notes`, { content });
            const statusEl = document.getElementById('notes-status');
            if (statusEl) statusEl.textContent = `Saved at ${new Date().toLocaleTimeString()}`;
            App.toast('Notes saved', 'success');
        } catch (e) {
            App.toast('Failed to save notes: ' + e.message, 'error');
        }
    },

    // --- Fundamentals ---
    async loadFundamentals() {
        try {
            const data = await App.get(`/api/stock/${this.symbol}/fundamentals`);
            if (!data) return;

            // Set company name in header
            const nameEl = document.getElementById('stock-company-name');
            if (nameEl && data.name) {
                nameEl.textContent = data.name;
            }

            const sectorEl = document.getElementById('fund-sector');
            const gridEl = document.getElementById('fundamentals-data');
            if (sectorEl) sectorEl.textContent = `${data.sector || ''} — ${data.industry || ''}`;

            const fmt = (v, prefix = '', suffix = '') => v != null ? `${prefix}${typeof v === 'number' ? v.toLocaleString(undefined, {maximumFractionDigits: 2}) : v}${suffix}` : '—';
            const fmtPct = (v) => v != null ? `${(v * 100).toFixed(2)}%` : '—';
            const fmtMoney = (v) => {
                if (v == null) return '—';
                if (Math.abs(v) >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
                if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
                if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
                return `$${v.toLocaleString()}`;
            };

            if (gridEl) gridEl.innerHTML = `
                <div class="fund-item"><span class="fund-label">P/E Ratio</span><span class="fund-value">${fmt(data.pe_ratio)}</span></div>
                <div class="fund-item"><span class="fund-label">EPS</span><span class="fund-value">${fmt(data.eps, '$')}</span></div>
                <div class="fund-item"><span class="fund-label">PEG Ratio</span><span class="fund-value">${fmt(data.peg_ratio)}</span></div>
                <div class="fund-item"><span class="fund-label">Debt/Equity</span><span class="fund-value">${fmt(data.debt_to_equity)}</span></div>
                <div class="fund-item"><span class="fund-label">Free Cash Flow</span><span class="fund-value">${fmtMoney(data.free_cash_flow)}</span></div>
                <div class="fund-item"><span class="fund-label">Div Yield</span><span class="fund-value">${fmtPct(data.dividend_yield)}</span></div>
            `;
        } catch (e) {
            console.warn('Fundamentals load failed:', e);
        }
    },

    // --- Earnings ---
    async loadEarnings() {
        try {
            const data = await App.get(`/api/stock/${this.symbol}/earnings`);
            const area = document.getElementById('earnings-warning-area');
            if (!data || !data.upcoming) { area.innerHTML = ''; return; }

            const e = data.upcoming;
            const isWarning = data.warning;
            const borderColor = isWarning ? 'var(--red)' : 'var(--gold)';
            const icon = isWarning ? '⚠️' : '📅';

            area.innerHTML = `
                <div class="card mt-4" style="border-color:${borderColor};border-width:2px">
                    <div style="display:flex;align-items:center;gap:12px;padding:4px 0">
                        <span style="font-size:1.5rem">${icon}</span>
                        <div>
                            <div style="font-weight:600;color:${isWarning ? 'var(--red)' : 'var(--gold)'}">
                                ${isWarning ? 'EARNINGS WARNING — Consider waiting' : 'Upcoming Earnings'}
                            </div>
                            <div style="font-size:0.85rem;color:var(--text-secondary)">
                                ${e.date} (${e.days_until} days away)${e.hour ? ` — ${e.hour === 'bmo' ? 'Before Market Open' : e.hour === 'amc' ? 'After Market Close' : e.hour}` : ''}
                                ${e.estimate_eps != null ? ` | EPS Est: $${e.estimate_eps}` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } catch (e) {
            console.warn('Earnings load failed:', e);
        }
    },

    // --- Position Sizing ---
    async calculatePositionSize() {
        const accountSize = parseFloat(document.getElementById('ps-account-size').value);
        const riskPct = parseFloat(document.getElementById('ps-risk-pct').value);
        const resultsEl = document.getElementById('ps-results');

        if (!accountSize || accountSize <= 0) { App.toast('Enter a valid account size', 'error'); return; }
        if (!riskPct || riskPct <= 0) { App.toast('Enter a valid risk %', 'error'); return; }

        resultsEl.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

        try {
            const data = await App.post('/api/position-size', {
                symbol: this.symbol,
                account_size: accountSize,
                risk_pct: riskPct,
            });

            resultsEl.innerHTML = `
                <div class="calculator-results">
                    <div class="stat-card">
                        <div class="stat-card-label">Shares to Buy</div>
                        <div class="stat-card-value" style="color:var(--green)">${data.shares}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-label">Entry Price</div>
                        <div class="stat-card-value">${App.formatPrice(data.entry_price)}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-label">Stop Loss</div>
                        <div class="stat-card-value" style="color:var(--red)">${App.formatPrice(data.stop_loss_price)}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-label">Take Profit</div>
                        <div class="stat-card-value" style="color:var(--green)">${App.formatPrice(data.take_profit_price)}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-label">Risk ($)</div>
                        <div class="stat-card-value">${App.formatPrice(data.risk_dollars)}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-label">Position Value</div>
                        <div class="stat-card-value">${App.formatPrice(data.position_value)}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-label">% of Account</div>
                        <div class="stat-card-value">${data.position_pct}%</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-label">ATR</div>
                        <div class="stat-card-value">${App.formatPrice(data.atr)}</div>
                    </div>
                </div>
            `;
        } catch (err) {
            resultsEl.innerHTML = `<div class="text-red" style="padding:8px">${App.escapeHtml(err.message)}</div>`;
        }
    },

    // --- Mini News ---
    async loadMiniNews() {
        const contentEl = document.getElementById('mini-news-content');
        contentEl.innerHTML = '<div class="loading-spinner"><div class="spinner"></div>Loading news...</div>';

        try {
            const data = await App.get(`/api/stock/${this.symbol}/news?days=7`);
            const articles = data.articles || [];
            const sentiment = data.sentiment;

            // Show sentiment badge
            const badgeEl = document.getElementById('mini-sentiment-badge');
            if (sentiment && badgeEl) {
                const color = sentiment.label === 'bullish' ? 'var(--green)' : sentiment.label === 'bearish' ? 'var(--red)' : 'var(--text-muted)';
                badgeEl.innerHTML = `<span style="color:${color};font-weight:600;font-size:0.8rem;text-transform:uppercase">${sentiment.label} (${sentiment.score > 0 ? '+' : ''}${sentiment.score.toFixed(2)})</span>`;
            }

            if (articles.length === 0) {
                contentEl.innerHTML = '<p class="text-muted" style="padding:12px">No recent news</p>';
                return;
            }

            // Show top 5 articles
            contentEl.innerHTML = `
                <div class="news-feed" style="max-height:400px;overflow-y:auto">
                    ${articles.slice(0, 5).map(a => {
                        const date = a.datetime ? new Date(a.datetime * 1000) : null;
                        const timeStr = date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
                        const sentColor = a.sentiment ? (a.sentiment.label === 'bullish' ? 'var(--green)' : a.sentiment.label === 'bearish' ? 'var(--red)' : 'var(--text-muted)') : '';
                        return `
                            <div class="news-article">
                                <div class="news-article-header">
                                    <a href="${App.escapeHtml(a.url)}" target="_blank" rel="noopener noreferrer" class="news-headline">${App.escapeHtml(a.headline)}</a>
                                    ${a.sentiment ? `<span class="sentiment-badge ${a.sentiment.label}" style="font-size:0.65rem">${a.sentiment.label}</span>` : ''}
                                </div>
                                <div class="news-meta">
                                    <span>${App.escapeHtml(a.source)}</span>
                                    <span>${timeStr}</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                ${articles.length > 5 ? `<a href="#/investigate/${this.symbol}" class="btn btn-ghost btn-sm" style="width:100%;margin-top:8px">See all ${articles.length} articles</a>` : ''}
            `;
        } catch (e) {
            contentEl.innerHTML = `<p class="text-muted" style="padding:12px">Failed to load news: ${App.escapeHtml(e.message)}</p>`;
        }
    },

    // --- Related Stocks (Sympathy Plays) ---
    async loadRelatedStocks() {
        const contentEl = document.getElementById('related-stocks-content');
        if (!contentEl) return;

        try {
            const data = await App.get(`/api/stock/${this.symbol}/peers`);
            const peers = data.peers || [];

            if (peers.length === 0) {
                contentEl.innerHTML = '<p class="text-muted" style="padding:12px;font-size:0.85rem">No related stocks found</p>';
                return;
            }

            contentEl.innerHTML = `
                <div class="related-stocks-list">
                    ${peers.map(p => {
                        const changeColor = p.change_pct > 0 ? 'var(--green)' : p.change_pct < 0 ? 'var(--red)' : 'var(--text-muted)';
                        const changeSign = p.change_pct > 0 ? '+' : '';
                        return `
                            <a href="#/stock/${App.escapeHtml(p.symbol)}" class="related-stock-item">
                                <div>
                                    <div style="font-weight:600;color:var(--text-primary)">${App.escapeHtml(p.symbol)}</div>
                                    <div style="font-size:0.7rem;color:var(--text-muted);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${App.escapeHtml(p.name || p.symbol)}</div>
                                </div>
                                <div style="text-align:right">
                                    <div style="font-family:var(--font-mono);font-size:0.85rem">${p.price != null ? '$' + p.price.toFixed(2) : '—'}</div>
                                    <div style="font-family:var(--font-mono);font-size:0.8rem;font-weight:600;color:${changeColor}">
                                        ${p.change_pct != null ? `${changeSign}${p.change_pct.toFixed(2)}%` : '—'}
                                    </div>
                                </div>
                            </a>
                        `;
                    }).join('')}
                </div>
            `;
        } catch (e) {
            contentEl.innerHTML = '<p class="text-muted" style="padding:12px;font-size:0.85rem">Failed to load related stocks</p>';
        }
    },

    // --- Insider Trading (light copy from investigator) ---
    async loadInsiderTrades() {
        const contentEl = document.getElementById('insider-content');
        if (!contentEl) return;

        try {
            const data = await App.get(`/api/stock/${this.symbol}/insider`);
            const trades = data.trades || [];
            const summary = data.summary || {};

            if (trades.length === 0) {
                contentEl.innerHTML = '<p class="text-muted" style="padding:12px;font-size:0.85rem">No recent insider trades found</p>';
                return;
            }

            const signalColor = summary.signal === 'bullish' ? 'var(--green)' : summary.signal === 'bearish' ? 'var(--red)' : 'var(--text-muted)';
            const visibleCount = 5;

            contentEl.innerHTML = `
                ${summary.trade_count > 0 ? `
                    <div style="display:flex;gap:16px;padding:8px 0;margin-bottom:8px;border-bottom:1px solid var(--border);flex-wrap:wrap">
                        <div><span class="text-muted" style="font-size:0.7rem">Signal</span><div style="font-weight:600;color:${signalColor};text-transform:uppercase">${summary.signal || 'N/A'}</div></div>
                        <div><span class="text-muted" style="font-size:0.7rem">Bought</span><div class="text-green" style="font-weight:600">$${(summary.total_bought || 0).toLocaleString()}</div></div>
                        <div><span class="text-muted" style="font-size:0.7rem">Sold</span><div class="text-red" style="font-weight:600">$${(summary.total_sold || 0).toLocaleString()}</div></div>
                    </div>
                ` : ''}
                <div class="signals-table-wrap" style="max-height:300px;overflow-y:auto">
                    <table class="signals-table" style="font-size:0.75rem">
                        <thead>
                            <tr><th>Date</th><th>Insider</th><th>Type</th><th>Value</th></tr>
                        </thead>
                        <tbody id="insider-table-body">
                            ${trades.slice(0, visibleCount).map(t => `
                                <tr>
                                    <td class="text-mono">${App.escapeHtml(t.trade_date)}</td>
                                    <td>${App.escapeHtml(t.insider)}</td>
                                    <td><span class="direction-badge ${t.type === 'Buy' ? 'buy' : 'sell'}">${t.type}</span></td>
                                    <td class="text-mono">${App.escapeHtml(t.value)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                ${trades.length > visibleCount ? `
                    <button class="btn btn-ghost btn-sm" id="insider-show-more" style="width:100%;margin-top:8px" data-showing="${visibleCount}">
                        Show more (${trades.length - visibleCount} remaining)
                    </button>
                ` : ''}
            `;

            // Pagination for insider trades
            const showMoreBtn = document.getElementById('insider-show-more');
            if (showMoreBtn) {
                showMoreBtn.addEventListener('click', () => {
                    const current = parseInt(showMoreBtn.dataset.showing);
                    const next = current + 5;
                    const tbody = document.getElementById('insider-table-body');
                    if (!tbody) return;

                    const newRows = trades.slice(current, next).map(t => `
                        <tr>
                            <td class="text-mono">${App.escapeHtml(t.trade_date)}</td>
                            <td>${App.escapeHtml(t.insider)}</td>
                            <td><span class="direction-badge ${t.type === 'Buy' ? 'buy' : 'sell'}">${t.type}</span></td>
                            <td class="text-mono">${App.escapeHtml(t.value)}</td>
                        </tr>
                    `).join('');
                    tbody.insertAdjacentHTML('beforeend', newRows);
                    showMoreBtn.dataset.showing = next;

                    if (next >= trades.length) {
                        showMoreBtn.remove();
                    } else {
                        showMoreBtn.textContent = `Show more (${trades.length - next} remaining)`;
                    }
                });
            }
        } catch (e) {
            contentEl.innerHTML = '<p class="text-muted" style="padding:12px;font-size:0.85rem">Failed to load insider trades</p>';
        }
    },

    // --- Social Trending ---
    async loadSocialTrending() {
        const contentEl = document.getElementById('social-content');
        if (!contentEl) return;

        try {
            const data = await App.get(`/api/stock/${this.symbol}/social`);

            if (!data.configured) {
                contentEl.innerHTML = `
                    <div class="social-empty-state">
                        <div style="font-size:2rem;margin-bottom:8px">📡</div>
                        <div style="font-weight:600;color:var(--text-primary);margin-bottom:4px">Reddit Not Connected</div>
                        <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:12px">Configure Reddit API credentials in Settings to see social trending data for ${this.symbol}.</div>
                        <a href="#/settings" class="btn btn-outline btn-sm">Go to Settings</a>
                    </div>
                `;
                return;
            }

            if (!data.mentions || data.mentions === 0) {
                contentEl.innerHTML = `
                    <div class="social-empty-state">
                        <div style="font-size:2rem;margin-bottom:8px">🔇</div>
                        <div style="font-weight:600;color:var(--text-primary);margin-bottom:4px">No Recent Mentions</div>
                        <div style="font-size:0.8rem;color:var(--text-muted)">${this.symbol} hasn't been mentioned in tracked subreddits recently.</div>
                        ${data.last_updated ? `<div style="font-size:0.7rem;color:var(--text-muted);margin-top:8px">Last scan: ${new Date(data.last_updated).toLocaleString()}</div>` : ''}
                    </div>
                `;
                return;
            }

            // Sentiment display
            const sentScore = data.sentiment || 0;
            const sentLabel = data.sentiment_label || 'neutral';
            const sentColor = sentLabel === 'bullish' ? 'var(--green)' : sentLabel === 'bearish' ? 'var(--red)' : 'var(--text-muted)';

            const posts = data.posts || [];

            contentEl.innerHTML = `
                <div style="text-align:center;padding:8px 0;margin-bottom:8px;border-bottom:1px solid var(--border)">
                    <div style="font-size:1.5rem;font-weight:800;color:${sentColor};font-family:var(--font-mono)">${sentScore > 0 ? '+' : ''}${sentScore.toFixed(3)}</div>
                    <div style="font-size:0.8rem;font-weight:600;color:${sentColor};text-transform:uppercase">${sentLabel}</div>
                    <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">${data.mentions} mentions across Reddit</div>
                </div>
                ${posts.length > 0 ? `
                    <div style="font-size:0.7rem;text-transform:uppercase;color:var(--text-muted);letter-spacing:0.5px;margin-bottom:6px;font-weight:600">Recent Posts</div>
                    <div class="social-posts-list">
                        ${posts.slice(0, 5).map(post => {
                            const postSent = post.sentiment || 0;
                            const postColor = postSent > 0.1 ? 'var(--green)' : postSent < -0.1 ? 'var(--red)' : 'var(--text-muted)';
                            return `
                                <div class="social-post-item">
                                    <div style="font-size:0.8rem;color:var(--text-primary);margin-bottom:2px">${App.escapeHtml(post.title || post.text || '')}</div>
                                    <div style="display:flex;gap:8px;font-size:0.7rem;color:var(--text-muted)">
                                        <span>r/${App.escapeHtml(post.subreddit || '')}</span>
                                        <span style="color:${postColor}">${postSent > 0 ? '+' : ''}${postSent.toFixed(2)}</span>
                                        ${post.score ? `<span>⬆${post.score}</span>` : ''}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : ''}
                ${data.last_updated ? `<div style="font-size:0.65rem;color:var(--text-muted);margin-top:8px;text-align:center">Last scan: ${new Date(data.last_updated).toLocaleString()}</div>` : ''}
            `;
        } catch (e) {
            contentEl.innerHTML = '<p class="text-muted" style="padding:12px;font-size:0.85rem">Failed to load social data</p>';
        }
    },
};
