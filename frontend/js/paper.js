/* =====================================================================
   Signal Deck — Paper Trading Page
   Track simulated trades and equity curve
   ===================================================================== */

const PaperTrading = {
    chart: null,
    trades: [],

    async render(container) {
        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h2>Paper Trading</h2>
                    <p>Track trades without real money to validate your strategy</p>
                </div>
            </div>

            <div id="paper-stats" class="paper-stats-row"></div>

            <div class="card mb-4">
                <div class="card-header">
                    <h3>New Paper Trade</h3>
                </div>
                <div class="paper-trade-form">
                    <div class="form-group" style="margin-bottom:0">
                        <label for="pt-symbol">Symbol</label>
                        <input type="text" id="pt-symbol" placeholder="AAPL" maxlength="10">
                    </div>
                    <div class="form-group" style="margin-bottom:0">
                        <label for="pt-direction">Direction</label>
                        <select id="pt-direction">
                            <option value="long">Long (Buy)</option>
                            <option value="short">Short (Sell)</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom:0">
                        <label for="pt-price">Entry Price</label>
                        <input type="number" id="pt-price" placeholder="150.00" step="0.01">
                    </div>
                    <div class="form-group" style="margin-bottom:0">
                        <label style="visibility:hidden">_</label>
                        <button class="btn btn-primary" id="pt-create">Open Trade</button>
                    </div>
                </div>
            </div>

            <div class="equity-chart-container mb-4" id="paper-equity-area">
                <div class="card-header"><h3>Equity Curve</h3></div>
                <div class="equity-chart-area" id="paper-equity-chart"></div>
            </div>

            <div class="card mb-4">
                <div class="card-header">
                    <h3>Open Trades</h3>
                </div>
                <div id="open-trades-area">
                    <div class="loading-spinner"><div class="spinner"></div>Loading...</div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3>Closed Trades</h3>
                </div>
                <div id="closed-trades-area">
                    <div class="loading-spinner"><div class="spinner"></div>Loading...</div>
                </div>
            </div>
        `;

        document.getElementById('pt-create').addEventListener('click', () => this.createTrade());
        document.getElementById('pt-symbol').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.createTrade();
        });

        await this.loadData();
    },

    async loadData() {
        try {
            const [openTrades, closedTrades, equity] = await Promise.all([
                App.get('/api/paper/trades?status=open'),
                App.get('/api/paper/trades?status=closed'),
                App.get('/api/paper/equity'),
            ]);

            this.renderStats(openTrades || [], closedTrades || []);
            this.renderOpenTrades(openTrades || []);
            this.renderClosedTrades(closedTrades || []);
            this.renderEquityChart(equity || []);
        } catch (err) {
            App.toast('Failed to load paper trades: ' + err.message, 'error');
        }
    },

    renderStats(openTrades, closedTrades) {
        const area = document.getElementById('paper-stats');
        const totalClosed = closedTrades.length;
        const wins = closedTrades.filter(t => t.pnl_pct > 0).length;
        const winRate = totalClosed > 0 ? (wins / totalClosed * 100).toFixed(1) : '—';
        const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl_pct || 0), 0);
        const avgPnl = totalClosed > 0 ? (totalPnl / totalClosed).toFixed(2) : '—';

        area.innerHTML = `
            <div class="stat-card">
                <div class="stat-card-value">${openTrades.length}</div>
                <div class="stat-card-label">Open Trades</div>
            </div>
            <div class="stat-card">
                <div class="stat-card-value">${totalClosed}</div>
                <div class="stat-card-label">Closed Trades</div>
            </div>
            <div class="stat-card">
                <div class="stat-card-value">${winRate}${winRate !== '—' ? '%' : ''}</div>
                <div class="stat-card-label">Win Rate</div>
            </div>
            <div class="stat-card">
                <div class="stat-card-value ${totalPnl >= 0 ? 'positive' : 'negative'}">${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}%</div>
                <div class="stat-card-label">Total P&L</div>
            </div>
            <div class="stat-card">
                <div class="stat-card-value">${avgPnl !== '—' ? (avgPnl >= 0 ? '+' : '') + avgPnl + '%' : '—'}</div>
                <div class="stat-card-label">Avg P&L / Trade</div>
            </div>
        `;
    },

    renderOpenTrades(trades) {
        const area = document.getElementById('open-trades-area');

        if (trades.length === 0) {
            area.innerHTML = `<div class="empty-state" style="padding:30px"><p>No open trades. Create one above to start paper trading.</p></div>`;
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
                                        <button class="btn btn-danger btn-sm close-trade-btn" data-id="${t.id}">Close</button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        area.querySelectorAll('.close-trade-btn').forEach(btn => {
            btn.addEventListener('click', () => this.closeTrade(parseInt(btn.dataset.id)));
        });
    },

    renderClosedTrades(trades) {
        const area = document.getElementById('closed-trades-area');

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
                            <th>Signal</th>
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
                                    <td class="text-muted" style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${App.escapeHtml(t.signal_name || '—')}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    renderEquityChart(curve) {
        const el = document.getElementById('paper-equity-chart');
        const area = document.getElementById('paper-equity-area');

        if (!curve || curve.length === 0) {
            area.style.display = 'none';
            return;
        }
        area.style.display = '';

        if (this.chart) {
            try { this.chart.remove(); } catch(e) {}
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
            rightPriceScale: { borderColor: 'rgba(136, 153, 176, 0.12)' },
            timeScale: { borderColor: 'rgba(136, 153, 176, 0.12)' },
        });

        const lastValue = curve[curve.length - 1]?.cumulative || 0;
        const lineColor = lastValue >= 0 ? '#00d4aa' : '#ff4757';

        const series = this.chart.addAreaSeries({
            lineColor,
            topColor: lineColor + '30',
            bottomColor: 'transparent',
            lineWidth: 2,
        });

        series.setData(curve.map(c => ({ time: c.date, value: c.cumulative })));
        this.chart.timeScale().fitContent();
    },

    async createTrade() {
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
            await this.loadData();
        } catch (err) {
            App.toast(err.message, 'error');
        }
    },

    async closeTrade(tradeId) {
        const priceStr = prompt('Enter exit price:');
        if (!priceStr) return;

        const exitPrice = parseFloat(priceStr);
        if (isNaN(exitPrice)) {
            App.toast('Invalid price', 'error');
            return;
        }

        try {
            const result = await App.put(`/api/paper/trades/${tradeId}/close`, {
                exit_price: exitPrice,
                exit_reason: 'manual',
            });
            App.toast(`Trade closed: ${result.pnl_pct >= 0 ? '+' : ''}${result.pnl_pct}%`, result.pnl_pct >= 0 ? 'success' : 'error');
            await this.loadData();
        } catch (err) {
            App.toast(err.message, 'error');
        }
    },
};
