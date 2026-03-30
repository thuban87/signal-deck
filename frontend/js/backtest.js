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
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.85rem;padding:8px 0" title="Check fundamentals (P/E, EPS, D/E, FCF) before running — warns if the stock fails your criteria">
                        <input type="checkbox" id="bt-fund-check"> Fundamental Filters
                    </label>
                </div>
                <div class="form-group" style="margin-bottom:0">
                    <label style="visibility:hidden">_</label>
                    <button class="btn btn-primary" id="bt-run">Run Backtest</button>
                </div>
            </div>

            <div id="bt-fund-panel" class="hidden" style="margin-top:12px;padding:14px 16px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md)">
                <div class="screener-filters">
                    <div class="form-group" title="Price-to-Earnings ratio — how much investors pay per dollar of earnings. Lower means cheaper relative to profits. A P/E of 15 is considered average, above 30 is expensive.">
                        <label>Max P/E</label>
                        <input type="number" id="bt-max-pe" placeholder="30" step="1">
                    </div>
                    <div class="form-group" title="Earnings Per Share — how much profit the company makes for each share of stock. Higher is better. Negative means the company is losing money.">
                        <label>Min EPS</label>
                        <input type="number" id="bt-min-eps" placeholder="0" step="0.1">
                    </div>
                    <div class="form-group" title="Debt-to-Equity ratio — how much debt the company has compared to shareholder value. Below 1 is conservative, above 2 means heavy debt. Lower is generally safer.">
                        <label>Max D/E</label>
                        <input type="number" id="bt-max-de" placeholder="2" step="0.1">
                    </div>
                    <div class="form-group" title="Free Cash Flow in millions — actual cash the company generates after expenses. Positive means the company is producing real cash, not just paper profits. Higher is better.">
                        <label>Min FCF (M)</label>
                        <input type="number" id="bt-min-fcf" placeholder="0" step="100">
                    </div>
                </div>
                <p style="font-size:0.75rem;color:var(--text-muted);margin-top:8px">If the stock fails any filter, the backtest will still run but show a warning.</p>
            </div>

            <div id="bt-results"></div>
        `;

        document.getElementById('bt-run').addEventListener('click', () => this.runBacktest());

        // Fundamental filters checkbox toggle
        document.getElementById('bt-fund-check').addEventListener('change', (e) => {
            const panel = document.getElementById('bt-fund-panel');
            if (e.target.checked) {
                panel.classList.remove('hidden');
            } else {
                panel.classList.add('hidden');
            }
        });

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

        // Check fundamental filters (only if checkbox is checked)
        let fundWarnings = [];
        const fundEnabled = document.getElementById('bt-fund-check')?.checked;
        const maxPe = parseFloat(document.getElementById('bt-max-pe')?.value);
        const minEps = parseFloat(document.getElementById('bt-min-eps')?.value);
        const maxDe = parseFloat(document.getElementById('bt-max-de')?.value);
        const minFcf = parseFloat(document.getElementById('bt-min-fcf')?.value);

        if (fundEnabled && (!isNaN(maxPe) || !isNaN(minEps) || !isNaN(maxDe) || !isNaN(minFcf))) {
            try {
                const fund = await App.get(`/api/stock/${symbol}/fundamentals`);
                if (!isNaN(maxPe) && fund.pe_ratio != null && fund.pe_ratio > maxPe) fundWarnings.push(`P/E ${fund.pe_ratio.toFixed(1)} > ${maxPe}`);
                if (!isNaN(minEps) && fund.eps != null && fund.eps < minEps) fundWarnings.push(`EPS ${fund.eps.toFixed(2)} < ${minEps}`);
                if (!isNaN(maxDe) && fund.debt_to_equity != null && fund.debt_to_equity > maxDe) fundWarnings.push(`D/E ${fund.debt_to_equity.toFixed(2)} > ${maxDe}`);
                if (!isNaN(minFcf) && fund.free_cash_flow != null && (fund.free_cash_flow / 1e6) < minFcf) fundWarnings.push(`FCF $${(fund.free_cash_flow / 1e6).toFixed(0)}M < $${minFcf}M`);
            } catch { /* fundamentals unavailable, skip */ }
        }

        try {
            const data = await App.get(`/api/backtest/${symbol}?period=${period}&include_bearish=${includeBearish}`);
            this.lastResult = data;
            this.lastFundWarnings = fundWarnings;
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

        // Fundamental warnings
        const fundWarnings = this.lastFundWarnings || [];
        const fundWarningHtml = fundWarnings.length > 0
            ? `<div style="background:var(--red-dim);border:1px solid rgba(255,71,87,0.3);border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:0.85rem">
                <strong style="color:var(--red)">Fundamental Filters Failed:</strong>
                <span style="color:var(--text-secondary);margin-left:8px">${fundWarnings.join(' | ')}</span>
               </div>`
            : '';

        resultsArea.innerHTML = `
            ${fundWarningHtml}
            <div class="backtest-results">
                <div class="stat-card" title="Total number of trades the signal strategy opened and closed during this period">
                    <div class="stat-card-value">${data.total_trades}</div>
                    <div class="stat-card-label">Total Trades</div>
                </div>
                <div class="stat-card" title="How many trades were bullish bets (Long) vs bearish bets (Short)">
                    <div class="stat-card-value">${data.long_trades}L / ${data.short_trades}S</div>
                    <div class="stat-card-label">Long / Short</div>
                </div>
                <div class="stat-card" title="Percentage of trades that made money. Above 50% means more winners than losers">
                    <div class="stat-card-value">${data.win_rate}%</div>
                    <div class="stat-card-label">Win Rate</div>
                </div>
                <div class="stat-card" title="Average profit or loss per trade. Positive means the strategy makes money on a typical trade">
                    <div class="stat-card-value ${pnlColor}">${data.avg_pnl >= 0 ? '+' : ''}${data.avg_pnl}%</div>
                    <div class="stat-card-label">Avg Return/Trade</div>
                </div>
                <div class="stat-card" title="Total return if you followed every signal. This is what your portfolio would have gained or lost">
                    <div class="stat-card-value ${pnlColor}">${data.total_pnl >= 0 ? '+' : ''}${data.total_pnl}%</div>
                    <div class="stat-card-label">Cumulative Return</div>
                </div>
                <div class="stat-card" title="What you'd have made just buying the stock and holding it the whole time — the simplest strategy to beat">
                    <div class="stat-card-value ${bhColor}">${data.buy_hold_pct >= 0 ? '+' : ''}${data.buy_hold_pct}%</div>
                    <div class="stat-card-label">Buy & Hold</div>
                </div>
                <div class="stat-card" title="The difference between the signal strategy and buy & hold. Positive means the signals beat just holding the stock" style="border-color:${data.edge >= 0 ? 'rgba(0,212,170,0.3)' : 'rgba(255,71,87,0.3)'}">
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
