/* =====================================================================
   Signal Deck — Backtest Page
   Run signal backtests from the UI with equity curves
   ===================================================================== */

const Backtest = {
    chart: null,
    lastResult: null,
    tradeSort: { column: 'entry_date', direction: 'asc' },
    tradeFilters: { direction: 'all', exitReason: 'all', pnl: 'all' },
    acTimer: null,
    acResults: [],
    acIndex: -1,

    async render(container, preSelectedSymbol) {
        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h2>Backtester</h2>
                    <p>Test signal strategies against historical data</p>
                </div>
            </div>

            <div class="backtest-controls">
                <div class="form-group" style="margin-bottom:0;position:relative">
                    <label for="bt-symbol">Symbol</label>
                    <input type="text" id="bt-symbol" value="${preSelectedSymbol || 'AAPL'}" placeholder="AAPL" style="width:120px" autocomplete="off">
                    <div id="bt-autocomplete" class="autocomplete-dropdown hidden"></div>
                </div>
                <div class="form-group" style="margin-bottom:0">
                    <label for="bt-period">Period</label>
                    <select id="bt-period">
                        <option value="3mo">3 Months</option>
                        <option value="6mo">6 Months</option>
                        <option value="1y" selected>1 Year</option>
                        <option value="2y">2 Years</option>
                    </select>
                </div>
                <div class="form-group" style="margin-bottom:0">
                    <label style="visibility:hidden">_</label>
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.85rem;padding:8px 0">
                        <input type="checkbox" id="bt-bearish" checked> Include Bearish
                    </label>
                </div>
                <div class="form-group" style="margin-bottom:0">
                    <label style="visibility:hidden">_</label>
                    <button class="btn btn-primary" id="bt-run">Run Backtest</button>
                </div>
            </div>

            <div id="bt-results"></div>
        `;

        document.getElementById('bt-run').addEventListener('click', () => this.runBacktest());

        const symbolInput = document.getElementById('bt-symbol');

        // Autocomplete: debounced search on input
        symbolInput.addEventListener('input', (e) => {
            clearTimeout(this.acTimer);
            const query = e.target.value.trim();
            if (query.length < 1) {
                this.hideAutocomplete();
                return;
            }
            this.acTimer = setTimeout(() => this.searchSymbols(query), 250);
        });

        // Keyboard navigation for autocomplete + Enter to run
        symbolInput.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.acIndex = Math.min(this.acIndex + 1, this.acResults.length - 1);
                this.highlightResult();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.acIndex = Math.max(this.acIndex - 1, -1);
                this.highlightResult();
            } else if (e.key === 'Enter') {
                if (this.acIndex >= 0 && this.acResults[this.acIndex]) {
                    this.selectSymbol(this.acResults[this.acIndex].symbol);
                } else {
                    this.hideAutocomplete();
                    this.runBacktest();
                }
            } else if (e.key === 'Escape') {
                this.hideAutocomplete();
            }
        });

        // Close autocomplete on blur (delayed so click on dropdown works)
        symbolInput.addEventListener('blur', () => {
            setTimeout(() => this.hideAutocomplete(), 150);
        });

        if (preSelectedSymbol) {
            this.runBacktest();
        }
    },

    async searchSymbols(query) {
        try {
            this.acResults = await App.get(`/api/symbols/search?q=${encodeURIComponent(query)}&limit=8`);
            this.acIndex = -1;
            this.renderAutocomplete();
        } catch (e) {
            this.hideAutocomplete();
        }
    },

    renderAutocomplete() {
        const dropdown = document.getElementById('bt-autocomplete');
        if (!dropdown || !this.acResults.length) {
            this.hideAutocomplete();
            return;
        }
        dropdown.innerHTML = this.acResults.map((r, i) => `
            <div class="ac-item ${i === this.acIndex ? 'active' : ''}" data-index="${i}">
                <strong>${App.escapeHtml(r.symbol)}</strong>
                <span style="margin-left:8px;font-size:0.8rem;color:var(--text-secondary)">${App.escapeHtml(r.name)}</span>
            </div>
        `).join('');
        dropdown.classList.remove('hidden');

        dropdown.querySelectorAll('.ac-item').forEach(item => {
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.selectSymbol(this.acResults[parseInt(item.dataset.index)].symbol);
            });
        });
    },

    selectSymbol(symbol) {
        document.getElementById('bt-symbol').value = symbol;
        this.hideAutocomplete();
    },

    hideAutocomplete() {
        const dropdown = document.getElementById('bt-autocomplete');
        if (dropdown) dropdown.classList.add('hidden');
        this.acResults = [];
        this.acIndex = -1;
    },

    highlightResult() {
        const items = document.querySelectorAll('#bt-autocomplete .ac-item');
        items.forEach((item, i) => {
            item.classList.toggle('active', i === this.acIndex);
        });
    },

    async runBacktest() {
        const symbol = document.getElementById('bt-symbol').value.trim().toUpperCase();
        const period = document.getElementById('bt-period').value;
        const includeBearish = document.getElementById('bt-bearish').checked;
        const resultsArea = document.getElementById('bt-results');

        if (!symbol) return;

        const btn = document.getElementById('bt-run');
        btn.disabled = true;
        btn.textContent = 'Running...';

        resultsArea.innerHTML = `
            <div class="loading-spinner"><div class="spinner"></div>Running backtest for ${symbol}...</div>
        `;

        try {
            const data = await App.get(`/api/backtest/${symbol}?period=${period}&include_bearish=${includeBearish}`);
            this.lastResult = data;
            this.tradeFilters = { direction: 'all', exitReason: 'all', pnl: 'all' };
            this.tradeSort = { column: 'entry_date', direction: 'asc' };
            this.renderResults(data);
        } catch (err) {
            resultsArea.innerHTML = `
                <div class="empty-state">
                    <h3>Backtest failed</h3>
                    <p>${App.escapeHtml(err.message)}</p>
                </div>
            `;
        } finally {
            btn.disabled = false;
            btn.textContent = 'Run Backtest';
        }
    },

    renderResults(data) {
        const resultsArea = document.getElementById('bt-results');
        const edgeColor = data.edge >= 0 ? 'positive' : 'negative';
        const pnlColor = data.total_pnl >= 0 ? 'positive' : 'negative';
        const bhColor = data.buy_hold_pct >= 0 ? 'positive' : 'negative';

        // Get unique exit reasons for filter dropdown
        const exitReasons = [...new Set(data.trades.map(t => t.exit_reason))].sort();

        resultsArea.innerHTML = `
            <div class="backtest-results">
                <div class="stat-card">
                    <div class="stat-card-value">${data.total_trades}</div>
                    <div class="stat-card-label">Total Trades</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-value">${data.long_trades}L / ${data.short_trades}S</div>
                    <div class="stat-card-label">Long / Short</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-value">${data.win_rate}%</div>
                    <div class="stat-card-label">Win Rate</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-value ${pnlColor}">${data.avg_pnl >= 0 ? '+' : ''}${data.avg_pnl}%</div>
                    <div class="stat-card-label">Avg Return/Trade</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-value ${pnlColor}">${data.total_pnl >= 0 ? '+' : ''}${data.total_pnl}%</div>
                    <div class="stat-card-label">Cumulative Return</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-value ${bhColor}">${data.buy_hold_pct >= 0 ? '+' : ''}${data.buy_hold_pct}%</div>
                    <div class="stat-card-label">Buy & Hold</div>
                </div>
                <div class="stat-card" style="border-color:${data.edge >= 0 ? 'rgba(0,212,170,0.3)' : 'rgba(255,71,87,0.3)'}">
                    <div class="stat-card-value ${edgeColor}">${data.edge >= 0 ? '+' : ''}${data.edge}%</div>
                    <div class="stat-card-label">Edge vs Buy & Hold</div>
                </div>
            </div>

            <div class="equity-chart-container">
                <div class="card-header"><h3>Equity Curve</h3></div>
                <div class="equity-chart-area" id="equity-chart"></div>
            </div>

            <div class="card" id="bt-trade-log-card">
                <div class="card-header">
                    <h3>Trade Log</h3>
                    <span id="bt-trade-count" style="font-size:0.75rem;color:var(--text-muted)">${data.trades.length} trades</span>
                </div>
                <div class="filter-bar" style="margin-bottom:8px">
                    <select id="bt-filter-direction">
                        <option value="all">All Directions</option>
                        <option value="long">Long Only</option>
                        <option value="short">Short Only</option>
                    </select>
                    <select id="bt-filter-exit">
                        <option value="all">All Exits</option>
                        ${exitReasons.map(r => `<option value="${App.escapeHtml(r)}">${App.escapeHtml(r)}</option>`).join('')}
                    </select>
                    <select id="bt-filter-pnl">
                        <option value="all">All Trades</option>
                        <option value="win">Winners</option>
                        <option value="loss">Losers</option>
                    </select>
                </div>
                <div class="signals-table-wrap" id="bt-trade-log-wrap"></div>
            </div>
        `;

        // Wire up trade log filter listeners
        ['bt-filter-direction', 'bt-filter-exit', 'bt-filter-pnl'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => {
                this.tradeFilters.direction = document.getElementById('bt-filter-direction').value;
                this.tradeFilters.exitReason = document.getElementById('bt-filter-exit').value;
                this.tradeFilters.pnl = document.getElementById('bt-filter-pnl').value;
                this.renderTradeLog();
            });
        });

        this.renderTradeLog();
        this.renderEquityChart(data.equity_curve);
    },

    renderTradeLog() {
        const wrap = document.getElementById('bt-trade-log-wrap');
        if (!wrap || !this.lastResult) return;

        let trades = [...this.lastResult.trades];

        // Apply filters
        if (this.tradeFilters.direction !== 'all') {
            trades = trades.filter(t => t.direction === this.tradeFilters.direction);
        }
        if (this.tradeFilters.exitReason !== 'all') {
            trades = trades.filter(t => t.exit_reason === this.tradeFilters.exitReason);
        }
        if (this.tradeFilters.pnl === 'win') {
            trades = trades.filter(t => t.pnl_pct > 0);
        } else if (this.tradeFilters.pnl === 'loss') {
            trades = trades.filter(t => t.pnl_pct <= 0);
        }

        // Sort
        const col = this.tradeSort.column;
        const dir = this.tradeSort.direction;
        trades.sort((a, b) => {
            let valA = a[col], valB = b[col];
            if (col === 'entry_price' || col === 'exit_price' || col === 'pnl_pct') {
                valA = Number(valA) || 0;
                valB = Number(valB) || 0;
            } else {
                valA = String(valA || '').toLowerCase();
                valB = String(valB || '').toLowerCase();
            }
            if (valA < valB) return dir === 'asc' ? -1 : 1;
            if (valA > valB) return dir === 'asc' ? 1 : -1;
            return 0;
        });

        // Update count
        const countEl = document.getElementById('bt-trade-count');
        if (countEl) {
            const total = this.lastResult.trades.length;
            countEl.textContent = trades.length === total ? `${total} trades` : `${trades.length} of ${total} trades`;
        }

        const arrow = (c) => {
            if (this.tradeSort.column !== c) return '<span class="sort-arrow">\u2195</span>';
            return `<span class="sort-arrow">${this.tradeSort.direction === 'asc' ? '\u25B2' : '\u25BC'}</span>`;
        };
        const ac = (c) => this.tradeSort.column === c ? 'active' : '';

        wrap.innerHTML = `
            <table class="signals-table">
                <thead>
                    <tr>
                        <th class="sortable ${ac('entry_date')}" data-sort="entry_date">Entry ${arrow('entry_date')}</th>
                        <th class="sortable ${ac('exit_date')}" data-sort="exit_date">Exit ${arrow('exit_date')}</th>
                        <th class="sortable ${ac('direction')}" data-sort="direction">Dir ${arrow('direction')}</th>
                        <th>Signal</th>
                        <th class="sortable ${ac('entry_price')}" data-sort="entry_price">Entry $ ${arrow('entry_price')}</th>
                        <th class="sortable ${ac('exit_price')}" data-sort="exit_price">Exit $ ${arrow('exit_price')}</th>
                        <th class="sortable ${ac('pnl_pct')}" data-sort="pnl_pct">P&L ${arrow('pnl_pct')}</th>
                        <th class="sortable ${ac('exit_reason')}" data-sort="exit_reason">Exit ${arrow('exit_reason')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${trades.map(t => {
                        const isWin = t.pnl_pct > 0;
                        const rowClass = t.direction === 'short' ? 'bearish-row' : 'bullish-row';
                        const dirLabel = t.direction === 'short' ? 'SHORT' : 'LONG';
                        const dirClass = t.direction === 'short' ? 'sell' : 'buy';
                        const pnlClass = isWin ? 'text-green' : 'text-red';

                        return `
                            <tr class="${rowClass}">
                                <td class="text-mono">${t.entry_date}</td>
                                <td class="text-mono">${t.exit_date}</td>
                                <td><span class="direction-badge ${dirClass}">${dirLabel}</span></td>
                                <td style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${App.escapeHtml(t.signal)}">${App.escapeHtml(t.signal)}</td>
                                <td class="text-mono">${App.formatPrice(t.entry_price)}</td>
                                <td class="text-mono">${App.formatPrice(t.exit_price)}</td>
                                <td class="text-mono ${pnlClass} font-bold">${t.pnl_pct >= 0 ? '+' : ''}${t.pnl_pct}%</td>
                                <td class="text-muted">${t.exit_reason}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;

        // Sortable column headers
        wrap.querySelectorAll('th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const c = th.dataset.sort;
                if (this.tradeSort.column === c) {
                    this.tradeSort.direction = this.tradeSort.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    this.tradeSort = { column: c, direction: 'asc' };
                }
                this.renderTradeLog();
            });
        });
    },

    renderEquityChart(curve) {
        const el = document.getElementById('equity-chart');
        if (!el || !curve?.length) return;

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
        const topColor = lastValue >= 0 ? 'rgba(0, 212, 170, 0.2)' : 'rgba(255, 71, 87, 0.2)';

        const series = this.chart.addAreaSeries({
            lineColor,
            topColor,
            bottomColor: 'transparent',
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: true,
        });

        // Add zero line
        const baselineSeries = this.chart.addLineSeries({
            color: 'rgba(136, 153, 176, 0.3)',
            lineWidth: 1,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
        });

        const rawData = curve.map(c => ({ time: c.date, value: c.cumulative }));
        // Deduplicate by time (LightweightCharts requires unique timestamps)
        const deduped = {};
        rawData.forEach(p => { deduped[p.time] = p; });
        const lineData = Object.values(deduped);
        series.setData(lineData);

        if (lineData.length >= 2) {
            baselineSeries.setData([
                { time: lineData[0].time, value: 0 },
                { time: lineData[lineData.length - 1].time, value: 0 },
            ]);
        }

        this.chart.timeScale().fitContent();

        const resizeObserver = new ResizeObserver(() => {
            if (this.chart) this.chart.applyOptions({ width: el.clientWidth });
        });
        resizeObserver.observe(el);
    },
};
