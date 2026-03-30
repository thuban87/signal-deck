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
    filterTag: 'all',
    allTags: [],
    symbolTags: {},
    grid: null,
    editMode: false,

    // Widget definitions — id, title, default grid position, min sizes
    // Grid is 12 columns. minW/minH are in grid units.
    widgetDefs: [
        { id: 'market-status', title: '⚡ Market Status',     defaultX: 0, defaultY: 0, defaultW: 12, defaultH: 3, minW: 6,  minH: 2 },
        { id: 'signals-alert', title: 'Signal Alerts',       defaultX: 0, defaultY: 3, defaultW: 12, defaultH: 1, minW: 6,  minH: 1 },
        { id: 'baskets',       title: 'Your Baskets',        defaultX: 0, defaultY: 4, defaultW: 12, defaultH: 4, minW: 4,  minH: 3 },
        { id: 'sector-heatmap',title: 'Sector Heatmap',      defaultX: 0, defaultY: 8, defaultW: 12, defaultH: 4, minW: 4,  minH: 3 },
        { id: 'quick-log',     title: '🚗 Look Into Later',  defaultX: 0, defaultY: 12,defaultW: 6,  defaultH: 4, minW: 3,  minH: 3 },
        { id: 'watchlist',     title: 'Watchlist',            defaultX: 0, defaultY: 16,defaultW: 12, defaultH: 6, minW: 6,  minH: 4 },
        { id: 'screener',      title: 'Screener',            defaultX: 0, defaultY: 22,defaultW: 12, defaultH: 5, minW: 6,  minH: 3 },
    ],

    LAYOUT_KEY: 'sd_dashboard_layout',
    LAYOUT_KEY_MOBILE: 'sd_dashboard_layout_mobile',

    getLayoutKey() {
        return App.isMobile() ? this.LAYOUT_KEY_MOBILE : this.LAYOUT_KEY;
    },

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
                    <button class="btn btn-ghost btn-sm" id="edit-layout-btn" title="Customize layout">
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

            <div id="layout-edit-bar" class="layout-edit-bar hidden">
                <span>🔧 Layout edit mode — drag widgets to reorder, resize from edges</span>
                <div style="display:flex;gap:8px">
                    <button class="btn btn-ghost btn-sm" id="reset-layout-btn">Reset Layout</button>
                    <button class="btn btn-primary btn-sm" id="done-layout-btn">Done</button>
                </div>
            </div>

            <div class="grid-stack" id="dashboard-grid"></div>
        `;

        // --- Header button listeners ---
        document.getElementById('add-symbol-btn').addEventListener('click', () => {
            document.getElementById('add-symbol-modal').classList.remove('hidden');
            document.getElementById('add-symbol-input').value = '';
            document.getElementById('add-symbol-input').focus();
        });

        document.getElementById('refresh-btn').addEventListener('click', () => this.refresh());

        document.getElementById('edit-layout-btn').addEventListener('click', () => this.toggleEditMode());
        document.getElementById('done-layout-btn').addEventListener('click', () => this.toggleEditMode());
        document.getElementById('reset-layout-btn').addEventListener('click', () => {
            localStorage.removeItem(this.getLayoutKey());
            this.editMode = false;
            this.render(container);
        });

        // --- Initialize GridStack ---
        this.initGrid();

        // --- Wire up watchlist toolbar listeners ---
        const viewToggle = document.getElementById('view-toggle');
        if (viewToggle) {
            viewToggle.addEventListener('click', (e) => {
                const btn = e.target.closest('.view-btn');
                if (!btn) return;
                document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.viewMode = btn.dataset.view;
                this.renderContent();
            });
        }

        const filterTrend = document.getElementById('dash-filter-trend');
        if (filterTrend) filterTrend.addEventListener('change', (e) => {
            this.filterTrend = e.target.value;
            this.renderContent();
        });
        const filterSignals = document.getElementById('dash-filter-signals');
        if (filterSignals) filterSignals.addEventListener('change', (e) => {
            this.filterSignals = e.target.value;
            this.renderContent();
        });
        const sortSelect = document.getElementById('dash-sort');
        if (sortSelect) sortSelect.addEventListener('change', (e) => {
            this.sortBy = e.target.value;
            this.renderContent();
        });
        const sortDirBtn = document.getElementById('dash-sort-dir');
        if (sortDirBtn) sortDirBtn.addEventListener('click', () => {
            this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
            sortDirBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                    ${this.sortDir === 'asc'
                        ? '<polyline points="18 15 12 9 6 15"></polyline>'
                        : '<polyline points="6 9 12 15 18 9"></polyline>'}
                </svg>
            `;
            this.renderContent();
        });
        const filterTag = document.getElementById('dash-filter-tag');
        if (filterTag) filterTag.addEventListener('change', (e) => {
            this.filterTag = e.target.value;
            this.renderContent();
        });

        // Screener toggle & run
        const screenerToggle = document.getElementById('screener-toggle');
        if (screenerToggle) screenerToggle.addEventListener('click', () => {
            document.getElementById('screener-panel').classList.toggle('hidden');
        });
        const scrRun = document.getElementById('scr-run');
        if (scrRun) scrRun.addEventListener('click', () => this.runScreener());

        // --- Load data into widgets ---
        await this.loadTags();
        await this.loadData();
        this.loadSectorHeatmap();
        this.loadBaskets();
        this.loadQuickLogs();
        this.loadMarketStatus();
    },

    initGrid() {
        const saved = this.loadLayout();

        // Build gridstack items
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
                    <div class="widget-wrapper" id="widget-${def.id}">
                        <div class="widget-content" id="widget-content-${def.id}">
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
        }, '#dashboard-grid');

        this.grid.load(items);

        // Save layout on change
        this.grid.on('change', () => {
            this.saveLayout();
        });
    },

    getWidgetPlaceholder(id) {
        switch (id) {
            case 'market-status':
                return '<div id="market-status-section" class="market-status-section"><div class="loading-text">Loading economic calendar...</div></div>';
            case 'signals-alert':
                return '<div id="signal-alert-area"></div>';
            case 'baskets':
                return '<div id="baskets-section" class="baskets-section"></div>';
            case 'sector-heatmap':
                return '<div id="sector-heatmap-section" class="sector-heatmap-section"></div>';
            case 'quick-log':
                return '<div id="quick-log-section" class="quick-log-review-section"></div>';
            case 'watchlist':
                return `
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
                            <select id="dash-filter-tag">
                                <option value="all">All Tags</option>
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
            case 'screener':
                return `
                    <div class="card-header" style="cursor:pointer" id="screener-toggle">
                        <h3>Screener</h3>
                        <span class="text-muted" style="font-size:0.8rem">Filter watchlist by technicals</span>
                    </div>
                    <div id="screener-panel" class="hidden" style="padding:16px">
                        <div class="screener-filters">
                            <div class="form-group">
                                <label>Min RSI</label>
                                <input type="number" id="scr-min-rsi" placeholder="30" step="1" min="0" max="100">
                            </div>
                            <div class="form-group">
                                <label>Max RSI</label>
                                <input type="number" id="scr-max-rsi" placeholder="70" step="1" min="0" max="100">
                            </div>
                            <div class="form-group">
                                <label>Min ADX</label>
                                <input type="number" id="scr-min-adx" placeholder="20" step="1" min="0">
                            </div>
                            <div class="form-group">
                                <label>Min Price</label>
                                <input type="number" id="scr-min-price" placeholder="0" step="0.01" min="0">
                            </div>
                            <div class="form-group">
                                <label>Max Price</label>
                                <input type="number" id="scr-max-price" placeholder="1000" step="0.01" min="0">
                            </div>
                            <div class="form-group">
                                <label>Trend</label>
                                <select id="scr-trend">
                                    <option value="">Any</option>
                                    <option value="bullish">Bullish</option>
                                    <option value="bearish">Bearish</option>
                                    <option value="neutral">Neutral</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Has Signals</label>
                                <select id="scr-signals">
                                    <option value="">Either</option>
                                    <option value="true">Yes</option>
                                    <option value="false">No</option>
                                </select>
                            </div>
                            <div class="form-group" style="display:flex;align-items:flex-end">
                                <button class="btn btn-primary btn-sm" id="scr-run">Screen</button>
                            </div>
                        </div>
                        <div id="screener-results"></div>
                    </div>
                `;
            default:
                return '';
        }
    },

    // --- Layout edit mode ---
    toggleEditMode() {
        this.editMode = !this.editMode;
        const bar = document.getElementById('layout-edit-bar');
        const gridEl = document.getElementById('dashboard-grid');
        const editBtn = document.getElementById('edit-layout-btn');

        if (this.editMode) {
            bar.classList.remove('hidden');
            gridEl.classList.add('gs-edit-mode');
            editBtn.classList.add('active');
            this.grid.enableMove(true);
            this.grid.enableResize(true);
            this.showScrollHandle();
        } else {
            bar.classList.add('hidden');
            gridEl.classList.remove('gs-edit-mode');
            editBtn.classList.remove('active');
            this.grid.enableMove(false);
            this.grid.enableResize(false);
            this.saveLayout();
            this.hideScrollHandle();
        }
    },

    showScrollHandle() {
        if (!App.isMobile()) return;
        if (document.getElementById('gs-scroll-handle')) return;
        const handle = document.createElement('div');
        handle.id = 'gs-scroll-handle';
        handle.className = 'gs-scroll-handle';
        handle.style.display = 'block';
        handle.innerHTML = `
            <div class="gs-scroll-handle-inner">
                <button class="gs-scroll-btn" id="gs-scroll-up">&#9650;</button>
                <span class="gs-scroll-label">Scroll</span>
                <button class="gs-scroll-btn" id="gs-scroll-down">&#9660;</button>
            </div>
        `;
        document.body.appendChild(handle);

        let scrollInterval = null;
        const mainContent = document.getElementById('main-content');
        const startScroll = (dir) => {
            scrollInterval = setInterval(() => {
                mainContent.scrollBy({ top: dir * 80 });
            }, 100);
        };
        const stopScroll = () => { clearInterval(scrollInterval); scrollInterval = null; };

        const upBtn = document.getElementById('gs-scroll-up');
        const downBtn = document.getElementById('gs-scroll-down');
        upBtn.addEventListener('mousedown', () => startScroll(-1));
        upBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startScroll(-1); }, { passive: false });
        downBtn.addEventListener('mousedown', () => startScroll(1));
        downBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startScroll(1); }, { passive: false });
        document.addEventListener('mouseup', stopScroll);
        document.addEventListener('touchend', stopScroll);
    },

    hideScrollHandle() {
        const handle = document.getElementById('gs-scroll-handle');
        if (handle) handle.remove();
    },

    saveLayout() {
        if (!this.grid) return;
        const items = this.grid.getGridItems();
        const layout = items.map(el => {
            const node = el.gridstackNode;
            return {
                id: node.id,
                x: node.x,
                y: node.y,
                w: node.w,
                h: node.h,
            };
        });
        localStorage.setItem(this.getLayoutKey(), JSON.stringify(layout));
    },

    loadLayout() {
        try {
            const data = localStorage.getItem(this.getLayoutKey());
            return data ? JSON.parse(data) : null;
        } catch { return null; }
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

            // Load symbol tags
            if (this.data && this.data.symbols) {
                await this.loadSymbolTags(this.data.symbols);
            }

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

        // Filter by tag
        if (this.filterTag !== 'all') {
            const tagId = parseInt(this.filterTag);
            symbols = symbols.filter(s => (this.symbolTags[s] || []).some(t => t.id === tagId));
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

            // Compute action recommendation
            const strongBull = d.strong_bullish || 0;
            const strongBear = d.strong_bearish || 0;
            const supportBull = d.support_bullish || 0;
            const supportBear = d.support_bearish || 0;
            let action, actionClass;
            if (strongBull >= 2 || (strongBull >= 1 && supportBull >= 1 && d.trend === 'bullish')) {
                action = 'BUY'; actionClass = 'buy';
            } else if (strongBear >= 2 || (strongBear >= 1 && supportBear >= 1 && d.trend === 'bearish')) {
                action = 'SELL'; actionClass = 'sell';
            } else {
                action = 'HOLD'; actionClass = 'hold';
            }

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
                    ${this.renderTagBadges(symbol)}
                    ${this.renderTagPicker(symbol)}
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
                        <div style="display:flex;align-items:center;gap:8px">
                            <span class="action-badge action-badge-${actionClass}">${action}</span>
                            <div class="signal-indicator">
                                <span class="signal-dot ${hasSignals ? 'active' : 'none'}"></span>
                                <span style="font-size:0.75rem;color:var(--text-muted)">${signalCount}</span>
                            </div>
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
                            <th>Action</th>
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

                            // Compute action
                            const sBull = d.strong_bullish || 0;
                            const sBear = d.strong_bearish || 0;
                            const supBull = d.support_bullish || 0;
                            const supBear = d.support_bearish || 0;
                            let tAction, tActionClass;
                            if (sBull >= 2 || (sBull >= 1 && supBull >= 1 && d.trend === 'bullish')) {
                                tAction = 'BUY'; tActionClass = 'buy';
                            } else if (sBear >= 2 || (sBear >= 1 && supBear >= 1 && d.trend === 'bearish')) {
                                tAction = 'SELL'; tActionClass = 'sell';
                            } else {
                                tAction = 'HOLD'; tActionClass = 'hold';
                            }

                            return `
                                <tr class="${rowClass}" style="cursor:pointer" data-symbol="${symbol}">
                                    <td><strong>${App.escapeHtml(symbol)}</strong></td>
                                    <td class="text-mono">${App.formatPrice(d.price)}</td>
                                    <td class="text-mono ${isPositive ? 'text-green' : 'text-red'}">${App.formatChange(changePct)}</td>
                                    <td><span class="trend-badge ${trendClass}">${d.trend || '\u2014'}</span></td>
                                    <td><span class="action-badge action-badge-${tActionClass}">${tAction}</span></td>
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

            // Compute action
            const csBull = d.strong_bullish || 0;
            const csBear = d.strong_bearish || 0;
            const csupBull = d.support_bullish || 0;
            const csupBear = d.support_bearish || 0;
            let cAction, cActionClass;
            if (csBull >= 2 || (csBull >= 1 && csupBull >= 1 && d.trend === 'bullish')) {
                cAction = 'BUY'; cActionClass = 'buy';
            } else if (csBear >= 2 || (csBear >= 1 && csupBear >= 1 && d.trend === 'bearish')) {
                cAction = 'SELL'; cActionClass = 'sell';
            } else {
                cAction = 'HOLD'; cActionClass = 'hold';
            }

            return `
                <div class="compact-card" data-symbol="${symbol}">
                    <strong class="stock-symbol" style="min-width:60px">${App.escapeHtml(symbol)}</strong>
                    <span class="text-mono" style="min-width:70px">${App.formatPrice(d.price)}</span>
                    <span class="text-mono ${isPositive ? 'text-green' : 'text-red'}" style="min-width:70px">${App.formatChange(changePct)}</span>
                    <span class="trend-badge ${trendClass}" style="min-width:60px">${d.trend || '\u2014'}</span>
                    <span class="action-badge action-badge-${cActionClass}" style="min-width:40px">${cAction}</span>
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
                if (e.target.closest('.stock-card-delete') || e.target.closest('.tag-remove') || e.target.closest('.tag-picker')) return;
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

        // Tag listeners
        this.attachTagListeners(grid);
    },

    async loadTags() {
        try {
            this.allTags = await App.get('/api/tags');
            // Populate tag filter dropdown
            const select = document.getElementById('dash-filter-tag');
            if (select) {
                select.innerHTML = '<option value="all">All Tags</option>' +
                    this.allTags.map(t => `<option value="${t.id}">${App.escapeHtml(t.name)}</option>`).join('');
            }
            // Load tags for each watchlist symbol
            if (this.data && this.data.symbols) {
                await this.loadSymbolTags(this.data.symbols);
            }
        } catch (e) {
            this.allTags = [];
        }
    },

    async loadSymbolTags(symbols) {
        const promises = symbols.map(async s => {
            try {
                this.symbolTags[s] = await App.get(`/api/watchlist/${s}/tags`);
            } catch { this.symbolTags[s] = []; }
        });
        await Promise.all(promises);
    },

    renderTagBadges(symbol) {
        const tags = this.symbolTags[symbol] || [];
        if (tags.length === 0) return '';
        return `<div class="tag-badges">${tags.map(t =>
            `<span class="tag-badge" style="background:${t.color}20;color:${t.color};border:1px solid ${t.color}40">${App.escapeHtml(t.name)}<button class="tag-remove" data-symbol="${symbol}" data-tag-id="${t.id}">&times;</button></span>`
        ).join('')}</div>`;
    },

    renderTagPicker(symbol) {
        const assigned = (this.symbolTags[symbol] || []).map(t => t.id);
        const available = this.allTags.filter(t => !assigned.includes(t.id));
        if (available.length === 0) return '';
        return `<select class="tag-picker" data-symbol="${symbol}">
            <option value="">+ Tag</option>
            ${available.map(t => `<option value="${t.id}">${App.escapeHtml(t.name)}</option>`).join('')}
        </select>`;
    },

    attachTagListeners(container) {
        // Tag remove buttons
        container.querySelectorAll('.tag-remove').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const symbol = btn.dataset.symbol;
                const tagId = btn.dataset.tagId;
                try {
                    await App.del(`/api/watchlist/${symbol}/tags/${tagId}`);
                    this.symbolTags[symbol] = (this.symbolTags[symbol] || []).filter(t => t.id != tagId);
                    this.renderContent();
                } catch (err) { App.toast(err.message, 'error'); }
            });
        });

        // Tag picker selects
        container.querySelectorAll('.tag-picker').forEach(sel => {
            sel.addEventListener('change', async (e) => {
                e.stopPropagation();
                const symbol = sel.dataset.symbol;
                const tagId = parseInt(sel.value);
                if (!tagId) return;
                try {
                    await App.post(`/api/watchlist/${symbol}/tags`, { tag_id: tagId });
                    const tag = this.allTags.find(t => t.id === tagId);
                    if (tag) {
                        if (!this.symbolTags[symbol]) this.symbolTags[symbol] = [];
                        this.symbolTags[symbol].push(tag);
                    }
                    this.renderContent();
                } catch (err) { App.toast(err.message, 'error'); }
            });
        });
    },

    async runScreener() {
        const params = new URLSearchParams();
        const minRsi = document.getElementById('scr-min-rsi').value;
        const maxRsi = document.getElementById('scr-max-rsi').value;
        const minAdx = document.getElementById('scr-min-adx').value;
        const minPrice = document.getElementById('scr-min-price').value;
        const maxPrice = document.getElementById('scr-max-price').value;
        const trend = document.getElementById('scr-trend').value;
        const signals = document.getElementById('scr-signals').value;

        if (minRsi) params.set('min_rsi', minRsi);
        if (maxRsi) params.set('max_rsi', maxRsi);
        if (minAdx) params.set('min_adx', minAdx);
        if (minPrice) params.set('min_price', minPrice);
        if (maxPrice) params.set('max_price', maxPrice);
        if (trend) params.set('trend', trend);
        if (signals) params.set('has_signals', signals);

        const area = document.getElementById('screener-results');
        area.innerHTML = '<div class="loading-spinner"><div class="spinner"></div>Screening...</div>';

        try {
            const results = await App.get(`/api/screener?${params.toString()}`);
            if (results.length === 0) {
                area.innerHTML = '<p class="text-muted" style="padding:12px 0">No symbols match the criteria.</p>';
                return;
            }
            area.innerHTML = `
                <p style="padding:8px 0;font-size:0.85rem;color:var(--text-secondary)">${results.length} match${results.length !== 1 ? 'es' : ''}</p>
                <div class="signals-table-wrap">
                    <table class="signals-table">
                        <thead><tr><th>Symbol</th><th>Price</th><th>Change</th><th>RSI</th><th>ADX</th><th>Trend</th><th>Signals</th></tr></thead>
                        <tbody>
                            ${results.map(r => {
                                const chgClass = r.change_pct >= 0 ? 'text-green' : 'text-red';
                                const rsiClass = App.rsiClass(r.rsi);
                                return `<tr style="cursor:pointer" data-symbol="${r.symbol}">
                                    <td><strong>${App.escapeHtml(r.symbol)}</strong></td>
                                    <td class="text-mono">${App.formatPrice(r.price)}</td>
                                    <td class="text-mono ${chgClass}">${App.formatChange(r.change_pct)}</td>
                                    <td class="text-mono"><span class="rsi-value ${rsiClass}">${r.rsi != null ? r.rsi.toFixed(1) : '\u2014'}</span></td>
                                    <td class="text-mono">${r.adx != null ? r.adx.toFixed(1) : '\u2014'}</td>
                                    <td><span class="trend-badge ${r.trend || ''}">${r.trend || '\u2014'}</span></td>
                                    <td>${r.signal_count || 0}</td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            area.querySelectorAll('tbody tr').forEach(row => {
                row.addEventListener('click', () => App.navigate(`#/stock/${row.dataset.symbol}`));
            });
        } catch (err) {
            area.innerHTML = `<p class="text-red" style="padding:12px 0">${App.escapeHtml(err.message)}</p>`;
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

    // ---------------------------------------------------------------
    // Sector Heatmap
    // ---------------------------------------------------------------
    async loadSectorHeatmap() {
        const section = document.getElementById('sector-heatmap-section');
        if (!section) return;

        section.innerHTML = `
            <div class="card mb-4">
                <div class="card-header">
                    <h3>Sector Heatmap</h3>
                    <span class="text-muted" style="font-size:0.8rem">Daily sector performance</span>
                </div>
                <div class="sector-heatmap-grid" id="sector-heatmap-grid">
                    <div class="loading-spinner"><div class="spinner"></div>Loading sectors...</div>
                </div>
            </div>
        `;

        try {
            const sectors = await App.get('/api/sectors/performance');
            const grid = document.getElementById('sector-heatmap-grid');

            if (!sectors || sectors.length === 0) {
                grid.innerHTML = '<p class="text-muted" style="padding:16px">No sector data available.</p>';
                return;
            }

            // Sort by market cap descending for sizing
            sectors.sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0));
            const totalCap = sectors.reduce((sum, s) => sum + (s.market_cap || 1e9), 0);

            grid.innerHTML = `<div class="heatmap-treemap">${sectors.map(s => {
                const weight = Math.max(((s.market_cap || 1e9) / totalCap) * 100, 5);
                const chg = s.change_pct || 0;
                const bg = this.heatmapColor(chg);
                const textColor = Math.abs(chg) > 1.5 ? '#fff' : 'var(--text-primary)';
                return `
                    <div class="heatmap-cell" style="flex-grow:${weight.toFixed(1)};background:${bg};color:${textColor}">
                        <span class="heatmap-label">${App.escapeHtml(s.name)}</span>
                        <span class="heatmap-value">${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%</span>
                        <span class="heatmap-ticker">${s.symbol}</span>
                    </div>
                `;
            }).join('')}</div>`;
        } catch (err) {
            const grid = document.getElementById('sector-heatmap-grid');
            if (grid) grid.innerHTML = `<p class="text-red" style="padding:16px">${App.escapeHtml(err.message)}</p>`;
        }
    },

    heatmapColor(changePct) {
        // Map from -3% (deep red) through 0 (neutral) to +3% (bright green)
        const clamped = Math.max(-3, Math.min(3, changePct));
        const ratio = (clamped + 3) / 6; // 0 to 1
        if (ratio < 0.5) {
            // Red to neutral
            const r = 255;
            const g = Math.round(60 + ratio * 2 * 140);
            const b = Math.round(60 + ratio * 2 * 100);
            return `rgba(${r}, ${g}, ${b}, 0.85)`;
        } else {
            // Neutral to green
            const t = (ratio - 0.5) * 2;
            const r = Math.round(200 - t * 200);
            const g = Math.round(200 + t * 55);
            const b = Math.round(160 - t * 60);
            return `rgba(${r}, ${g}, ${b}, 0.85)`;
        }
    },

    // ---------------------------------------------------------------
    // Baskets ("Write What You Know")
    // ---------------------------------------------------------------
    async loadBaskets() {
        const section = document.getElementById('baskets-section');
        if (!section) return;

        try {
            const baskets = await App.get('/api/baskets');
            if (!baskets || baskets.length === 0) {
                section.innerHTML = '';
                return;
            }

            section.innerHTML = `
                <div class="card mb-4">
                    <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
                        <div>
                            <h3>Your Baskets</h3>
                            <span class="text-muted" style="font-size:0.8rem">Custom sector tracking</span>
                        </div>
                        <button class="btn btn-ghost btn-sm" id="add-basket-btn">+ New Basket</button>
                    </div>
                    <div class="baskets-scroll" id="baskets-container">
                        ${baskets.map(b => `
                            <div class="basket-card" data-basket-id="${b.id}">
                                <div class="basket-card-header">
                                    <span class="basket-icon">${b.icon || '📊'}</span>
                                    <span class="basket-name">${App.escapeHtml(b.name)}</span>
                                    <span class="basket-count">${b.tickers.length} stocks</span>
                                </div>
                                <div class="basket-tickers">${b.tickers.map(t =>
                                    `<span class="basket-ticker-chip">${t}</span>`
                                ).join('')}</div>
                                <div class="basket-metrics" id="basket-metrics-${b.id}">
                                    <div class="loading-spinner" style="padding:4px"><div class="spinner" style="width:14px;height:14px"></div></div>
                                </div>
                                <div class="basket-actions">
                                    <button class="btn btn-ghost btn-sm basket-edit-btn" data-basket-id="${b.id}" title="Edit basket">Edit</button>
                                    <button class="btn btn-ghost btn-sm basket-delete-btn" data-basket-id="${b.id}" title="Delete basket" style="color:var(--red)">Delete</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;

            // Load metrics for each basket async
            for (const b of baskets) {
                this.loadBasketMetrics(b.id);
            }

            // Expand on click
            section.querySelectorAll('.basket-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    if (e.target.closest('.basket-edit-btn') || e.target.closest('.basket-delete-btn')) return;
                    card.classList.toggle('expanded');
                });
            });

            // Delete buttons
            section.querySelectorAll('.basket-delete-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (!confirm('Delete this basket?')) return;
                    try {
                        await App.del(`/api/baskets/${btn.dataset.basketId}`);
                        App.toast('Basket deleted', 'info');
                        this.loadBaskets();
                    } catch (err) { App.toast(err.message, 'error'); }
                });
            });

            // Edit buttons
            section.querySelectorAll('.basket-edit-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const bid = parseInt(btn.dataset.basketId);
                    const basket = baskets.find(b => b.id === bid);
                    if (basket) this.showBasketEditor(basket);
                });
            });

            // Add basket button
            document.getElementById('add-basket-btn')?.addEventListener('click', () => {
                this.showBasketEditor(null);
            });

        } catch (err) {
            section.innerHTML = '';
        }
    },

    async loadBasketMetrics(basketId) {
        const el = document.getElementById(`basket-metrics-${basketId}`);
        if (!el) return;

        try {
            const data = await App.get(`/api/baskets/${basketId}/metrics`);
            const m = data.metrics;
            const consensus = m.trend_consensus || 'neutral';
            const consensusClass = consensus === 'bullish' ? 'text-green' : consensus === 'bearish' ? 'text-red' : '';

            el.innerHTML = `
                <div class="basket-metric">
                    <span class="indicator-label">Avg RSI</span>
                    <span class="rsi-value ${App.rsiClass(m.avg_rsi)}">${m.avg_rsi != null ? m.avg_rsi.toFixed(1) : '—'}</span>
                </div>
                <div class="basket-metric">
                    <span class="indicator-label">Avg Change</span>
                    <span class="${(m.avg_change || 0) >= 0 ? 'text-green' : 'text-red'}">${m.avg_change != null ? App.formatChange(m.avg_change) : '—'}</span>
                </div>
                <div class="basket-metric">
                    <span class="indicator-label">Trend</span>
                    <span class="trend-badge ${consensus}">${consensus}</span>
                </div>
                <div class="basket-metric">
                    <span class="indicator-label">Signals</span>
                    <span>${m.total_signals || 0}</span>
                </div>
            `;

            // Expanded detail — show individual ticker rows
            const card = el.closest('.basket-card');
            let detailEl = card.querySelector('.basket-detail');
            if (!detailEl) {
                detailEl = document.createElement('div');
                detailEl.className = 'basket-detail';
                card.appendChild(detailEl);
            }

            detailEl.innerHTML = `
                <div class="basket-detail-grid">
                    ${data.tickers.map(t => {
                        const chgClass = (t.change_pct || 0) >= 0 ? 'text-green' : 'text-red';
                        const rsiClass = App.rsiClass(t.rsi);
                        return `
                            <div class="basket-detail-row" data-symbol="${t.symbol}" style="cursor:pointer">
                                <strong>${t.symbol}</strong>
                                <span class="text-mono">${App.formatPrice(t.price)}</span>
                                <span class="text-mono ${chgClass}">${App.formatChange(t.change_pct)}</span>
                                <span class="rsi-value ${rsiClass}">${t.rsi != null ? t.rsi.toFixed(1) : '—'}</span>
                                <span class="trend-badge ${t.trend || ''}">${t.trend || '—'}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;

            detailEl.querySelectorAll('.basket-detail-row').forEach(row => {
                row.addEventListener('click', (e) => {
                    e.stopPropagation();
                    App.navigate(`#/stock/${row.dataset.symbol}`);
                });
            });

        } catch (err) {
            if (el) el.innerHTML = '<span class="text-muted" style="font-size:0.75rem">Failed to load</span>';
        }
    },

    showBasketEditor(basket) {
        // Simple prompt-based editor (can be upgraded to a modal later)
        const name = prompt('Basket name:', basket ? basket.name : '');
        if (!name) return;
        const icon = prompt('Icon emoji:', basket ? basket.icon : '📊') || '📊';
        const tickersStr = prompt('Tickers (comma-separated):', basket ? basket.tickers.join(', ') : '');
        if (tickersStr === null) return;
        const tickers = tickersStr.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);

        if (basket) {
            App.put(`/api/baskets/${basket.id}`, { name, icon, tickers }).then(() => {
                App.toast('Basket updated', 'success');
                this.loadBaskets();
            }).catch(err => App.toast(err.message, 'error'));
        } else {
            App.post('/api/baskets', { name, icon, tickers }).then(() => {
                App.toast('Basket created', 'success');
                this.loadBaskets();
            }).catch(err => App.toast(err.message, 'error'));
        }
    },

    // ---------------------------------------------------------------
    // Quick-Log Review Section
    // ---------------------------------------------------------------
    async loadQuickLogs() {
        const section = document.getElementById('quick-log-section');
        if (!section) return;

        try {
            const logs = await App.get('/api/quick-log');
            const pending = logs.filter(l => l.status === 'new');

            if (pending.length === 0) {
                section.innerHTML = '';
                return;
            }

            section.innerHTML = `
                <div class="card mb-4">
                    <div class="card-header">
                        <h3>🚗 Look Into Later</h3>
                        <span class="text-muted" style="font-size:0.8rem">${pending.length} idea${pending.length !== 1 ? 's' : ''} logged</span>
                    </div>
                    <div class="quick-log-list">
                        ${pending.map(l => `
                            <div class="quick-log-item" data-id="${l.id}">
                                <div class="quick-log-item-info">
                                    <span class="quick-log-raw">"${App.escapeHtml(l.raw_input)}"</span>
                                    ${l.resolved_ticker
                                        ? `<a href="#/stock/${l.resolved_ticker}" class="quick-log-resolved ql-stock-link">→ <strong>${l.resolved_ticker}</strong>${l.resolved_name ? ' — ' + App.escapeHtml(l.resolved_name) : ''}</a>`
                                        : '<span class="quick-log-unresolved">⚠ No ticker match</span>'
                                    }
                                    <span class="quick-log-time">${this.timeAgo(l.created_at)}</span>
                                </div>
                                <div class="quick-log-item-actions">
                                    ${l.resolved_ticker ? `
                                        <button class="btn btn-ghost btn-sm ql-investigate" data-symbol="${l.resolved_ticker}" title="Deep-dive research">🔍 Investigate</button>
                                        <button class="btn btn-primary btn-sm ql-promote" data-id="${l.id}" title="Add to watchlist">+ Watchlist</button>
                                    ` : ''}
                                    <button class="btn btn-ghost btn-sm ql-dismiss" data-id="${l.id}" title="Dismiss">&times;</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;

            // Investigate buttons
            section.querySelectorAll('.ql-investigate').forEach(btn => {
                btn.addEventListener('click', () => {
                    App.navigate(`#/investigate/${btn.dataset.symbol}`);
                });
            });

            // Promote buttons
            section.querySelectorAll('.ql-promote').forEach(btn => {
                btn.addEventListener('click', async () => {
                    try {
                        const result = await App.post(`/api/quick-log/${btn.dataset.id}/promote`, {});
                        App.toast(`${result.symbol} added to watchlist`, 'success');
                        this.loadQuickLogs();
                        this.refresh();
                    } catch (err) { App.toast(err.message, 'error'); }
                });
            });

            // Dismiss buttons
            section.querySelectorAll('.ql-dismiss').forEach(btn => {
                btn.addEventListener('click', async () => {
                    try {
                        await App.del(`/api/quick-log/${btn.dataset.id}`);
                        this.loadQuickLogs();
                    } catch (err) { App.toast(err.message, 'error'); }
                });
            });

        } catch (err) {
            section.innerHTML = '';
        }
    },

    refreshQuickLogs() {
        this.loadQuickLogs();
    },

    // ---------------------------------------------------------------
    // Market Status — Economic Calendar Widget
    // ---------------------------------------------------------------
    async loadMarketStatus() {
        const section = document.getElementById('market-status-section');
        if (!section) return;

        try {
            const events = await App.get('/api/economic-events?days=14');
            if (!events || events.length === 0) {
                section.innerHTML = `
                    <div class="market-status-banner market-status-clear">
                        <div class="market-status-icon">✅</div>
                        <div class="market-status-text">
                            <strong>All Clear</strong>
                            <span>No major economic events in the next 14 days</span>
                        </div>
                    </div>`;
                return;
            }

            // Separate past and upcoming events
            const upcoming = events.filter(e => e.days_until >= 0);
            const recent = events.filter(e => e.days_until < 0).reverse(); // Most recent first
            const nearest = upcoming.length > 0 ? upcoming[0] : null;

            const isImminent = nearest && nearest.days_until <= 1;
            const isWarning = nearest && nearest.days_until <= 3;
            const bannerClass = !nearest ? 'market-status-clear' : isImminent ? 'market-status-red' : isWarning ? 'market-status-yellow' : 'market-status-clear';
            const statusIcon = !nearest ? '✅' : isImminent ? '🔴' : isWarning ? '🟡' : '🟢';

            const countdownText = !nearest ? 'No upcoming events'
                : nearest.days_until === 0 ? 'TODAY'
                : nearest.days_until === 1 ? 'TOMORROW'
                : `in ${nearest.days_until} days`;

            const makeSearchUrl = (e) => `https://www.google.com/search?q=${encodeURIComponent(e.event + ' ' + e.date + ' results')}`;

            // Build upcoming event list (show next 5)
            const upcomingHtml = upcoming.slice(0, 5).map(e => {
                const dayLabel = e.days_until === 0 ? 'TODAY' : e.days_until === 1 ? 'Tomorrow' : `${e.days_until}d`;
                const urgencyClass = e.days_until <= 1 ? 'event-urgent' : e.days_until <= 3 ? 'event-warning' : 'event-safe';
                const catIcon = this._eventCategoryIcon(e.category);
                return `
                    <a href="${makeSearchUrl(e)}" target="_blank" rel="noopener" class="market-event-item ${urgencyClass}" title="Search for results">
                        <span class="event-cat-icon">${catIcon}</span>
                        <span class="event-name">${App.escapeHtml(e.event)}</span>
                        <span class="event-date">${e.date}</span>
                        <span class="event-countdown-badge">${dayLabel}</span>
                    </a>`;
            }).join('');

            // Build recent past event list (show last 3)
            const recentHtml = recent.length > 0 ? `
                <div class="market-event-divider"><span>Recently Passed</span></div>
                ${recent.slice(0, 3).map(e => {
                    const daysAgo = Math.abs(e.days_until);
                    const dayLabel = daysAgo === 1 ? '1d ago' : `${daysAgo}d ago`;
                    const catIcon = this._eventCategoryIcon(e.category);
                    return `
                        <a href="${makeSearchUrl(e)}" target="_blank" rel="noopener" class="market-event-item event-passed" title="Search for results">
                            <span class="event-cat-icon">${catIcon}</span>
                            <span class="event-name">${App.escapeHtml(e.event)}</span>
                            <span class="event-date">${e.date}</span>
                            <span class="event-countdown-badge event-passed-badge">${dayLabel}</span>
                        </a>`;
                }).join('')}
            ` : '';

            section.innerHTML = `
                <div class="market-status-banner ${bannerClass}">
                    <div class="market-status-header">
                        <div class="market-status-icon">${statusIcon}</div>
                        <div class="market-status-text">
                            <strong>${nearest ? App.escapeHtml(nearest.event) : 'All Clear'}</strong>
                            <span>${nearest ? `${countdownText} — ${nearest.date}` : 'No major events in the next 14 days'}</span>
                        </div>
                        ${nearest ? `<div class="market-status-impact-badge impact-${nearest.impact}">${nearest.impact.toUpperCase()}</div>` : ''}
                    </div>
                    <div class="market-event-list">
                        ${upcomingHtml}
                        ${recentHtml}
                    </div>
                </div>`;
        } catch (err) {
            section.innerHTML = `<div class="text-muted" style="padding:12px">Economic calendar unavailable</div>`;
        }
    },

    _eventCategoryIcon(category) {
        const icons = {
            fed: '🏦', inflation: '📊', employment: '👔', gdp: '📈',
            consumer: '🛒', housing: '🏠', other: '📅'
        };
        return icons[category] || '📅';
    },

    timeAgo(dateStr) {
        if (!dateStr) return '';
        const now = new Date();
        const then = new Date(dateStr + (dateStr.includes('Z') ? '' : 'Z'));
        const diff = Math.floor((now - then) / 1000);
        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    },
};
