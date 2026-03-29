/* =====================================================================
   Signal Deck — Paper Trading Page
   Alpaca-synced paper trading with local fallback
   ===================================================================== */

const PaperTrading = {
    chart: null,
    alpacaAvailable: false,
    refreshTimer: null,

    async render(container) {
        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h2>Paper Trading</h2>
                    <p>Trade with virtual money synced to your Alpaca paper account</p>
                </div>
                <div class="page-actions">
                    <button class="btn btn-ghost btn-sm" id="pt-refresh" title="Refresh">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                            <polyline points="23 4 23 10 17 10"></polyline>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                        </svg>
                        Refresh
                    </button>
                </div>
            </div>

            <div id="pt-alpaca-banner" class="alpaca-status-banner hidden"></div>

            <!-- Account Summary -->
            <div id="pt-account-bar" class="pt-account-bar hidden"></div>

            <!-- Order Form + Positions side-by-side -->
            <div class="pt-main-grid">
                <!-- Order Form -->
                <div class="card mb-4" id="pt-order-card">
                    <div class="card-header">
                        <h3>New Order</h3>
                    </div>
                    <div id="pt-order-form-area"></div>
                </div>

                <!-- Open Positions -->
                <div class="card mb-4">
                    <div class="card-header">
                        <h3>Open Positions</h3>
                        <span id="pt-positions-count" class="text-muted"></span>
                    </div>
                    <div id="pt-positions-area">
                        <div class="loading-spinner"><div class="spinner"></div>Loading...</div>
                    </div>
                </div>
            </div>

            <!-- Portfolio Equity Chart -->
            <div class="equity-chart-container mb-4" id="pt-equity-area" style="display:none">
                <div class="card-header">
                    <h3>Portfolio Equity</h3>
                    <div class="pt-period-selector" id="pt-period-selector">
                        <button class="btn btn-ghost btn-sm pt-period-btn" data-period="1W">1W</button>
                        <button class="btn btn-ghost btn-sm pt-period-btn active" data-period="1M">1M</button>
                        <button class="btn btn-ghost btn-sm pt-period-btn" data-period="3M">3M</button>
                        <button class="btn btn-ghost btn-sm pt-period-btn" data-period="1A">1Y</button>
                    </div>
                </div>
                <div class="equity-chart-area" id="pt-equity-chart"></div>
            </div>

            <!-- Recent Orders -->
            <div class="card mb-4">
                <div class="card-header">
                    <h3>Recent Orders</h3>
                </div>
                <div id="pt-orders-area">
                    <div class="loading-spinner"><div class="spinner"></div>Loading...</div>
                </div>
            </div>
        `;

        document.getElementById('pt-refresh').addEventListener('click', () => this.loadAlpacaData());

        // Period selector
        document.getElementById('pt-period-selector').addEventListener('click', (e) => {
            const btn = e.target.closest('.pt-period-btn');
            if (!btn) return;
            document.querySelectorAll('.pt-period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.loadEquityChart(btn.dataset.period);
        });

        // Detect Alpaca availability
        await this.detectAlpaca();

        if (this.alpacaAvailable) {
            await this.loadAlpacaData();
            this.startAutoRefresh();
        } else {
            await this.loadLocalFallback();
        }
    },

    async detectAlpaca() {
        try {
            const config = await App.get('/api/config');
            this.alpacaAvailable = config && config.alpaca_connected;
        } catch {
            this.alpacaAvailable = false;
        }

        const banner = document.getElementById('pt-alpaca-banner');
        if (!this.alpacaAvailable) {
            banner.classList.remove('hidden');
            banner.innerHTML = `
                <div class="alpaca-banner-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                </div>
                <div>
                    <strong>Alpaca Not Connected</strong>
                    <p>Paper trading is running in local-only mode. Add your Alpaca API keys to .env and restart the server for full Alpaca sync.</p>
                </div>
            `;
        }
    },

    startAutoRefresh() {
        if (this.refreshTimer) clearInterval(this.refreshTimer);
        this.refreshTimer = setInterval(() => this.loadAlpacaData(), 30000);
    },

    // -----------------------------------------------------------------
    // Alpaca Mode
    // -----------------------------------------------------------------

    async loadAlpacaData() {
        this.renderOrderForm();
        await Promise.all([
            this.loadAccount(),
            this.loadPositions(),
            this.loadOrders(),
            this.loadEquityChart('1M'),
        ]);
    },

    async loadAccount() {
        const bar = document.getElementById('pt-account-bar');
        try {
            const acct = await App.get('/api/paper/account');
            bar.classList.remove('hidden');

            const todayPL = acct.equity - acct.last_equity;
            const todayPLPct = acct.last_equity ? (todayPL / acct.last_equity * 100) : 0;
            const plClass = todayPL >= 0 ? 'positive' : 'negative';

            bar.innerHTML = `
                <div class="pt-account-stat">
                    <div class="pt-account-stat-label">Portfolio Value</div>
                    <div class="pt-account-stat-value">${this.fmtMoney(acct.portfolio_value)}</div>
                </div>
                <div class="pt-account-stat">
                    <div class="pt-account-stat-label">Cash</div>
                    <div class="pt-account-stat-value">${this.fmtMoney(acct.cash)}</div>
                </div>
                <div class="pt-account-stat">
                    <div class="pt-account-stat-label">Buying Power</div>
                    <div class="pt-account-stat-value">${this.fmtMoney(acct.buying_power)}</div>
                </div>
                <div class="pt-account-stat">
                    <div class="pt-account-stat-label">Today's P&L</div>
                    <div class="pt-account-stat-value ${plClass}">
                        ${todayPL >= 0 ? '+' : ''}${this.fmtMoney(todayPL)}
                        <span class="pt-account-stat-pct">(${todayPL >= 0 ? '+' : ''}${todayPLPct.toFixed(2)}%)</span>
                    </div>
                </div>
                <div class="pt-account-stat">
                    <div class="pt-account-stat-label">Long Exposure</div>
                    <div class="pt-account-stat-value">${this.fmtMoney(acct.long_market_value)}</div>
                </div>
                <div class="pt-account-stat">
                    <div class="pt-account-stat-label">Short Exposure</div>
                    <div class="pt-account-stat-value">${this.fmtMoney(Math.abs(acct.short_market_value))}</div>
                </div>
            `;
        } catch (e) {
            bar.classList.add('hidden');
        }
    },

    renderOrderForm() {
        const area = document.getElementById('pt-order-form-area');
        area.innerHTML = `
            <div class="pt-order-form">
                <div class="form-group">
                    <label for="pt-symbol">Symbol</label>
                    <input type="text" id="pt-symbol" placeholder="AAPL" maxlength="10" autocomplete="off">
                    <div id="pt-current-price" class="pt-price-hint"></div>
                </div>

                <div class="form-group">
                    <label>Side</label>
                    <div class="pt-side-toggle">
                        <button class="pt-side-btn buy active" id="pt-side-buy" data-side="buy">Buy</button>
                        <button class="pt-side-btn sell" id="pt-side-sell" data-side="sell">Sell</button>
                    </div>
                </div>

                <div class="form-group">
                    <label for="pt-order-type">Order Type</label>
                    <select id="pt-order-type">
                        <option value="market">Market</option>
                        <option value="limit">Limit</option>
                        <option value="stop">Stop</option>
                        <option value="stop_limit">Stop Limit</option>
                        <option value="bracket">Bracket</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Quantity Mode</label>
                    <div class="pt-qty-toggle">
                        <button class="pt-qty-mode-btn active" data-mode="shares" id="pt-mode-shares">Shares</button>
                        <button class="pt-qty-mode-btn" data-mode="dollars" id="pt-mode-dollars">Dollars</button>
                    </div>
                </div>

                <div class="form-group" id="pt-qty-group">
                    <label for="pt-qty">Shares</label>
                    <input type="number" id="pt-qty" placeholder="10" step="0.001" min="0.001">
                </div>

                <!-- Conditional price fields -->
                <div class="form-group hidden" id="pt-limit-group">
                    <label for="pt-limit-price">Limit Price</label>
                    <input type="number" id="pt-limit-price" placeholder="150.00" step="0.01">
                </div>

                <div class="form-group hidden" id="pt-stop-group">
                    <label for="pt-stop-price">Stop Price</label>
                    <input type="number" id="pt-stop-price" placeholder="145.00" step="0.01">
                </div>

                <div class="form-group hidden" id="pt-tp-group">
                    <label for="pt-tp-price">Take Profit</label>
                    <input type="number" id="pt-tp-price" placeholder="160.00" step="0.01">
                </div>

                <div class="form-group hidden" id="pt-sl-group">
                    <label for="pt-sl-price">Stop Loss</label>
                    <input type="number" id="pt-sl-price" placeholder="140.00" step="0.01">
                </div>

                <div id="pt-order-preview" class="pt-order-preview"></div>

                <button class="btn btn-primary btn-full mt-4" id="pt-submit-order">Place Order</button>
            </div>
        `;

        // Side toggle
        area.querySelectorAll('.pt-side-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                area.querySelectorAll('.pt-side-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.updateOrderPreview();
            });
        });

        // Quantity mode toggle
        area.querySelectorAll('.pt-qty-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                area.querySelectorAll('.pt-qty-mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const label = document.querySelector('#pt-qty-group label');
                const input = document.getElementById('pt-qty');
                if (btn.dataset.mode === 'dollars') {
                    label.textContent = 'Dollar Amount';
                    input.placeholder = '500.00';
                    input.step = '0.01';
                } else {
                    label.textContent = 'Shares';
                    input.placeholder = '10';
                    input.step = '0.001';
                }
                this.updateOrderPreview();
            });
        });

        // Order type changes
        document.getElementById('pt-order-type').addEventListener('change', () => this.updateOrderFields());
        this.updateOrderFields();

        // Symbol price lookup
        let priceTimeout = null;
        document.getElementById('pt-symbol').addEventListener('input', () => {
            clearTimeout(priceTimeout);
            priceTimeout = setTimeout(() => this.lookupPrice(), 500);
        });

        // Qty/price change for preview
        ['pt-qty', 'pt-limit-price', 'pt-stop-price'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => this.updateOrderPreview());
        });

        // Submit
        document.getElementById('pt-submit-order').addEventListener('click', () => this.submitOrder());
    },

    updateOrderFields() {
        const type = document.getElementById('pt-order-type').value;
        const limitGroup = document.getElementById('pt-limit-group');
        const stopGroup = document.getElementById('pt-stop-group');
        const tpGroup = document.getElementById('pt-tp-group');
        const slGroup = document.getElementById('pt-sl-group');

        limitGroup.classList.add('hidden');
        stopGroup.classList.add('hidden');
        tpGroup.classList.add('hidden');
        slGroup.classList.add('hidden');

        if (type === 'limit' || type === 'stop_limit') limitGroup.classList.remove('hidden');
        if (type === 'stop' || type === 'stop_limit') stopGroup.classList.remove('hidden');
        if (type === 'bracket') {
            tpGroup.classList.remove('hidden');
            slGroup.classList.remove('hidden');
        }
    },

    async lookupPrice() {
        const symbol = document.getElementById('pt-symbol').value.trim().toUpperCase();
        const hint = document.getElementById('pt-current-price');
        if (!symbol || symbol.length < 1) {
            hint.innerHTML = '';
            return;
        }
        try {
            const data = await App.get(`/api/watchlist`);
            const snap = data?.data?.[symbol];
            if (snap && snap.price) {
                const changeClass = snap.change_pct >= 0 ? 'text-green' : 'text-red';
                hint.innerHTML = `Current: <strong>$${snap.price.toFixed(2)}</strong> <span class="${changeClass}">${snap.change_pct >= 0 ? '+' : ''}${snap.change_pct?.toFixed(2) || 0}%</span>`;
            } else {
                hint.innerHTML = '';
            }
        } catch {
            hint.innerHTML = '';
        }
        this.updateOrderPreview();
    },

    updateOrderPreview() {
        const preview = document.getElementById('pt-order-preview');
        if (!preview) return;

        const symbol = document.getElementById('pt-symbol').value.trim().toUpperCase();
        const side = document.querySelector('.pt-side-btn.active')?.dataset.side || 'buy';
        const qtyMode = document.querySelector('.pt-qty-mode-btn.active')?.dataset.mode || 'shares';
        const qtyVal = parseFloat(document.getElementById('pt-qty').value);

        if (!symbol || isNaN(qtyVal) || qtyVal <= 0) {
            preview.innerHTML = '';
            return;
        }

        const sideLabel = side === 'buy' ? 'Buy' : 'Sell';
        const sideClass = side === 'buy' ? 'text-green' : 'text-red';
        const type = document.getElementById('pt-order-type').value;

        let desc = '';
        if (qtyMode === 'dollars') {
            desc = `<span class="${sideClass}">${sideLabel}</span> $${qtyVal.toFixed(2)} of <strong>${App.escapeHtml(symbol)}</strong>`;
        } else {
            desc = `<span class="${sideClass}">${sideLabel}</span> ${qtyVal} shares of <strong>${App.escapeHtml(symbol)}</strong>`;
        }
        desc += ` (${type})`;

        preview.innerHTML = desc;
    },

    async submitOrder() {
        const symbol = document.getElementById('pt-symbol').value.trim().toUpperCase();
        const side = document.querySelector('.pt-side-btn.active')?.dataset.side || 'buy';
        const orderType = document.getElementById('pt-order-type').value;
        const qtyMode = document.querySelector('.pt-qty-mode-btn.active')?.dataset.mode || 'shares';
        const qtyVal = parseFloat(document.getElementById('pt-qty').value);

        if (!symbol) return App.toast('Enter a symbol', 'error');
        if (isNaN(qtyVal) || qtyVal <= 0) return App.toast('Enter a valid quantity', 'error');

        const body = { symbol, side, order_type: orderType };

        if (qtyMode === 'dollars') {
            body.notional = qtyVal;
        } else {
            body.qty = qtyVal;
        }

        if (orderType === 'limit' || orderType === 'stop_limit') {
            const lp = parseFloat(document.getElementById('pt-limit-price').value);
            if (isNaN(lp)) return App.toast('Limit price is required', 'error');
            body.limit_price = lp;
        }
        if (orderType === 'stop' || orderType === 'stop_limit') {
            const sp = parseFloat(document.getElementById('pt-stop-price').value);
            if (isNaN(sp)) return App.toast('Stop price is required', 'error');
            body.stop_price = sp;
        }
        if (orderType === 'bracket') {
            const tp = parseFloat(document.getElementById('pt-tp-price').value);
            const sl = parseFloat(document.getElementById('pt-sl-price').value);
            if (isNaN(tp)) return App.toast('Take profit price is required', 'error');
            if (isNaN(sl)) return App.toast('Stop loss price is required', 'error');
            body.take_profit_price = tp;
            body.stop_loss_price = sl;
        }

        const btn = document.getElementById('pt-submit-order');
        btn.disabled = true;
        btn.textContent = 'Submitting...';

        try {
            const result = await App.post('/api/paper/orders', body);
            App.toast(`Order submitted: ${side.toUpperCase()} ${symbol} — ${result.status}`, 'success');

            // Clear form
            document.getElementById('pt-symbol').value = '';
            document.getElementById('pt-qty').value = '';
            document.getElementById('pt-current-price').innerHTML = '';
            document.getElementById('pt-order-preview').innerHTML = '';

            // Refresh data
            await this.loadAlpacaData();
        } catch (e) {
            App.toast(`Order failed: ${e.message}`, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Place Order';
        }
    },

    async loadPositions() {
        const area = document.getElementById('pt-positions-area');
        const count = document.getElementById('pt-positions-count');
        try {
            const positions = await App.get('/api/paper/positions');
            count.textContent = `${positions.length} open`;

            if (positions.length === 0) {
                area.innerHTML = `<div class="empty-state" style="padding:30px"><p>No open positions</p></div>`;
                return;
            }

            area.innerHTML = `
                <div class="signals-table-wrap">
                    <table class="signals-table">
                        <thead>
                            <tr>
                                <th>Symbol</th>
                                <th>Qty</th>
                                <th>Avg Entry</th>
                                <th>Current</th>
                                <th>Market Value</th>
                                <th>P&L</th>
                                <th>P&L %</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${positions.map(p => {
                                const plClass = p.unrealized_pl >= 0 ? 'text-green' : 'text-red';
                                const rowClass = p.unrealized_pl >= 0 ? 'bullish-row' : 'bearish-row';
                                return `
                                    <tr class="${rowClass}">
                                        <td><strong>${App.escapeHtml(p.symbol)}</strong></td>
                                        <td class="text-mono">${parseFloat(p.qty).toFixed(p.qty % 1 ? 4 : 0)}</td>
                                        <td class="text-mono">${App.formatPrice(p.avg_entry_price)}</td>
                                        <td class="text-mono">${App.formatPrice(p.current_price)}</td>
                                        <td class="text-mono">${this.fmtMoney(p.market_value)}</td>
                                        <td class="text-mono ${plClass} font-bold">${p.unrealized_pl >= 0 ? '+' : ''}${this.fmtMoney(p.unrealized_pl)}</td>
                                        <td class="text-mono ${plClass}">${(p.unrealized_plpc * 100).toFixed(2)}%</td>
                                        <td>
                                            <button class="btn btn-danger btn-sm pt-close-pos" data-symbol="${App.escapeHtml(p.symbol)}">Close</button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;

            area.querySelectorAll('.pt-close-pos').forEach(btn => {
                btn.addEventListener('click', () => this.closePosition(btn.dataset.symbol));
            });
        } catch (e) {
            area.innerHTML = `<div class="empty-state" style="padding:30px"><p>Failed to load positions</p></div>`;
        }
    },

    async closePosition(symbol) {
        if (!confirm(`Close entire ${symbol} position?`)) return;
        try {
            await App.del(`/api/paper/positions/${symbol}`);
            App.toast(`${symbol} position closed`, 'success');
            await this.loadAlpacaData();
        } catch (e) {
            App.toast(`Failed to close ${symbol}: ${e.message}`, 'error');
        }
    },

    async loadOrders() {
        const area = document.getElementById('pt-orders-area');
        try {
            const orders = await App.get('/api/paper/orders/history?status=all&limit=30');

            if (!orders || orders.length === 0) {
                area.innerHTML = `<div class="empty-state" style="padding:30px"><p>No orders yet. Place your first trade above.</p></div>`;
                return;
            }

            area.innerHTML = `
                <div class="signals-table-wrap">
                    <table class="signals-table">
                        <thead>
                            <tr>
                                <th>Symbol</th>
                                <th>Side</th>
                                <th>Type</th>
                                <th>Qty</th>
                                <th>Fill Price</th>
                                <th>Status</th>
                                <th>Submitted</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${orders.map(o => {
                                const sideClass = o.side?.includes('buy') ? 'buy' : 'sell';
                                const sideLabel = o.side?.includes('buy') ? 'BUY' : 'SELL';
                                const statusClass = this.orderStatusClass(o.status);
                                const qty = o.filled_qty || o.qty || o.notional;
                                const fillPrice = o.filled_avg_price ? `$${parseFloat(o.filled_avg_price).toFixed(2)}` : '—';
                                const time = this.fmtTime(o.submitted_at);
                                const typeLabel = (o.type || '').replace('OrderType.', '').replace('_', ' ');
                                const statusLabel = (o.status || '').replace('OrderStatus.', '');
                                return `
                                    <tr>
                                        <td><strong>${App.escapeHtml(o.symbol)}</strong></td>
                                        <td><span class="direction-badge ${sideClass}">${sideLabel}</span></td>
                                        <td class="text-muted">${typeLabel}</td>
                                        <td class="text-mono">${qty || '—'}</td>
                                        <td class="text-mono">${fillPrice}</td>
                                        <td><span class="order-status-badge ${statusClass}">${statusLabel}</span></td>
                                        <td class="text-muted text-mono">${time}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (e) {
            area.innerHTML = `<div class="empty-state" style="padding:30px"><p>Failed to load orders</p></div>`;
        }
    },

    async loadEquityChart(period = '1M') {
        const el = document.getElementById('pt-equity-chart');
        const area = document.getElementById('pt-equity-area');

        try {
            const history = await App.get(`/api/paper/portfolio-history?period=${period}&timeframe=1D`);
            if (!history || !history.points || history.points.length === 0) {
                area.style.display = 'none';
                return;
            }
            area.style.display = '';

            if (this.chart) {
                try { this.chart.remove(); } catch (e) {}
            }

            this.chart = LightweightCharts.createChart(el, {
                width: el.clientWidth,
                height: 280,
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
                    mode: 0,
                },
                timeScale: { borderColor: 'rgba(136, 153, 176, 0.12)' },
                localization: {
                    priceFormatter: (price) => '$' + price.toFixed(0),
                },
            });

            const points = history.points.filter(p => p.equity != null);
            const lastEquity = points.length > 0 ? points[points.length - 1].equity : 0;
            const firstEquity = points.length > 0 ? points[0].equity : 0;
            const lineColor = lastEquity >= firstEquity ? '#00d4aa' : '#ff4757';

            const series = this.chart.addAreaSeries({
                lineColor,
                topColor: lineColor + '30',
                bottomColor: 'transparent',
                lineWidth: 2,
            });

            series.setData(points.map(p => ({
                time: p.timestamp,
                value: p.equity,
            })));

            this.chart.timeScale().fitContent();

            // Resize handler
            const resizeObserver = new ResizeObserver(() => {
                if (this.chart) this.chart.applyOptions({ width: el.clientWidth });
            });
            resizeObserver.observe(el);
        } catch (e) {
            area.style.display = 'none';
        }
    },

    // -----------------------------------------------------------------
    // Local Fallback Mode (existing behavior)
    // -----------------------------------------------------------------

    async loadLocalFallback() {
        // Render the simpler local-only form
        const formArea = document.getElementById('pt-order-form-area');
        formArea.innerHTML = `
            <div class="pt-order-form">
                <div class="form-group">
                    <label for="pt-symbol">Symbol</label>
                    <input type="text" id="pt-symbol" placeholder="AAPL" maxlength="10">
                </div>
                <div class="form-group">
                    <label for="pt-direction">Direction</label>
                    <select id="pt-direction">
                        <option value="long">Long (Buy)</option>
                        <option value="short">Short (Sell)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="pt-price">Entry Price</label>
                    <input type="number" id="pt-price" placeholder="150.00" step="0.01">
                </div>
                <button class="btn btn-primary btn-full mt-4" id="pt-create-local">Open Trade</button>
            </div>
        `;

        document.getElementById('pt-create-local').addEventListener('click', () => this.createLocalTrade());

        // Hide equity chart and period selector since no Alpaca
        document.getElementById('pt-equity-area').style.display = 'none';

        await this.loadLocalData();
    },

    async loadLocalData() {
        try {
            const [openTrades, closedTrades, equity] = await Promise.all([
                App.get('/api/paper/trades?status=open'),
                App.get('/api/paper/trades?status=closed'),
                App.get('/api/paper/equity'),
            ]);

            this.renderLocalPositions(openTrades || []);
            this.renderLocalOrders(closedTrades || []);
            this.renderLocalStats(openTrades || [], closedTrades || []);
        } catch (err) {
            App.toast('Failed to load paper trades: ' + err.message, 'error');
        }
    },

    renderLocalStats(openTrades, closedTrades) {
        const bar = document.getElementById('pt-account-bar');
        bar.classList.remove('hidden');

        const totalClosed = closedTrades.length;
        const wins = closedTrades.filter(t => t.pnl_pct > 0).length;
        const winRate = totalClosed > 0 ? (wins / totalClosed * 100).toFixed(1) : '—';
        const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl_pct || 0), 0);

        bar.innerHTML = `
            <div class="pt-account-stat">
                <div class="pt-account-stat-label">Open Trades</div>
                <div class="pt-account-stat-value">${openTrades.length}</div>
            </div>
            <div class="pt-account-stat">
                <div class="pt-account-stat-label">Closed Trades</div>
                <div class="pt-account-stat-value">${totalClosed}</div>
            </div>
            <div class="pt-account-stat">
                <div class="pt-account-stat-label">Win Rate</div>
                <div class="pt-account-stat-value">${winRate}${winRate !== '—' ? '%' : ''}</div>
            </div>
            <div class="pt-account-stat">
                <div class="pt-account-stat-label">Total P&L</div>
                <div class="pt-account-stat-value ${totalPnl >= 0 ? 'positive' : 'negative'}">${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}%</div>
            </div>
        `;
    },

    renderLocalPositions(trades) {
        const area = document.getElementById('pt-positions-area');
        const count = document.getElementById('pt-positions-count');
        count.textContent = `${trades.length} open`;

        if (trades.length === 0) {
            area.innerHTML = `<div class="empty-state" style="padding:30px"><p>No open trades. Create one above.</p></div>`;
            return;
        }

        area.innerHTML = `
            <div class="signals-table-wrap">
                <table class="signals-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Symbol</th>
                            <th>Direction</th>
                            <th>Entry Price</th>
                            <th>Entry Date</th>
                            <th>Signal</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${trades.map(t => {
                            const dirClass = t.direction === 'short' ? 'sell' : 'buy';
                            const dirLabel = t.direction === 'short' ? 'SHORT' : 'LONG';
                            return `
                                <tr>
                                    <td class="text-muted">#${t.id}</td>
                                    <td><strong>${App.escapeHtml(t.symbol)}</strong></td>
                                    <td><span class="direction-badge ${dirClass}">${dirLabel}</span></td>
                                    <td class="text-mono">${App.formatPrice(t.entry_price)}</td>
                                    <td class="text-mono">${t.entry_date}</td>
                                    <td class="text-muted">${App.escapeHtml(t.signal_name || '—')}</td>
                                    <td>
                                        <button class="btn btn-danger btn-sm close-local-trade" data-id="${t.id}">Close</button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        area.querySelectorAll('.close-local-trade').forEach(btn => {
            btn.addEventListener('click', () => this.closeLocalTrade(parseInt(btn.dataset.id)));
        });
    },

    renderLocalOrders(trades) {
        const area = document.getElementById('pt-orders-area');

        if (trades.length === 0) {
            area.innerHTML = `<div class="empty-state" style="padding:30px"><p>No closed trades yet.</p></div>`;
            return;
        }

        area.innerHTML = `
            <div class="signals-table-wrap">
                <table class="signals-table">
                    <thead>
                        <tr>
                            <th>Symbol</th>
                            <th>Dir</th>
                            <th>Entry</th>
                            <th>Exit</th>
                            <th>P&L</th>
                            <th>Exit Reason</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${trades.map(t => {
                            const dirClass = t.direction === 'short' ? 'sell' : 'buy';
                            const dirLabel = t.direction === 'short' ? 'S' : 'L';
                            const pnlClass = t.pnl_pct > 0 ? 'text-green' : 'text-red';
                            return `
                                <tr>
                                    <td><strong>${App.escapeHtml(t.symbol)}</strong></td>
                                    <td><span class="direction-badge ${dirClass}">${dirLabel}</span></td>
                                    <td class="text-mono">$${t.entry_price?.toFixed(2)} <span class="text-muted">(${t.entry_date})</span></td>
                                    <td class="text-mono">$${t.exit_price?.toFixed(2)} <span class="text-muted">(${t.exit_date})</span></td>
                                    <td class="text-mono ${pnlClass} font-bold">${t.pnl_pct >= 0 ? '+' : ''}${t.pnl_pct}%</td>
                                    <td class="text-muted">${t.exit_reason || '—'}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    async createLocalTrade() {
        const symbol = document.getElementById('pt-symbol').value.trim().toUpperCase();
        const direction = document.getElementById('pt-direction').value;
        const price = parseFloat(document.getElementById('pt-price').value);

        if (!symbol || !price || isNaN(price)) {
            App.toast('Please fill in symbol and price', 'error');
            return;
        }

        try {
            await App.post('/api/paper/trades', {
                symbol,
                direction,
                entry_price: price,
                entry_date: new Date().toISOString().split('T')[0],
            });
            App.toast(`Paper trade opened: ${direction.toUpperCase()} ${symbol} @ $${price.toFixed(2)}`, 'success');
            document.getElementById('pt-symbol').value = '';
            document.getElementById('pt-price').value = '';
            await this.loadLocalData();
        } catch (err) {
            App.toast(err.message, 'error');
        }
    },

    async closeLocalTrade(tradeId) {
        const priceStr = prompt('Enter exit price:');
        if (!priceStr) return;
        const exitPrice = parseFloat(priceStr);
        if (isNaN(exitPrice)) return App.toast('Invalid price', 'error');

        try {
            const result = await App.put(`/api/paper/trades/${tradeId}/close`, {
                exit_price: exitPrice,
                exit_reason: 'manual',
            });
            App.toast(`Trade closed: ${result.pnl_pct >= 0 ? '+' : ''}${result.pnl_pct}%`, result.pnl_pct >= 0 ? 'success' : 'error');
            await this.loadLocalData();
        } catch (err) {
            App.toast(err.message, 'error');
        }
    },

    // -----------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------

    fmtMoney(val) {
        if (val == null) return '$0.00';
        return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    fmtTime(isoStr) {
        if (!isoStr || isoStr === 'None') return '—';
        try {
            const d = new Date(isoStr);
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
                   d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        } catch {
            return isoStr;
        }
    },

    orderStatusClass(status) {
        if (!status) return '';
        const s = status.toLowerCase();
        if (s.includes('filled')) return 'status-filled';
        if (s.includes('cancel')) return 'status-cancelled';
        if (s.includes('new') || s.includes('pending') || s.includes('accepted')) return 'status-pending';
        if (s.includes('partial')) return 'status-partial';
        return '';
    },
};
