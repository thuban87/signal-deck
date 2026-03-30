/**
 * Trade Calculator page — Historical what-if trade scenarios.
 */
const Calculator = {
    chart: null,
    lastResult: null,
    acTimer: null,
    acResults: [],
    acIndex: -1,

    async render(container) {
        // Default dates: 1 year ago → today
        const today = new Date();
        const oneYearAgo = new Date(today);
        oneYearAgo.setFullYear(today.getFullYear() - 1);
        const todayStr = today.toISOString().split('T')[0];
        const yearAgoStr = oneYearAgo.toISOString().split('T')[0];

        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h2>Trade Calculator</h2>
                    <p class="text-secondary">Calculate historical what-if trade scenarios</p>
                </div>
            </div>

            <div class="card" style="margin-bottom:24px">
                <div class="calculator-form">
                    <div class="form-group" style="position:relative">
                        <label for="calc-symbol">Symbol</label>
                        <input type="text" id="calc-symbol" placeholder="AAPL" autocomplete="off" style="text-transform:uppercase">
                        <div id="calc-autocomplete" class="autocomplete-dropdown hidden"></div>
                    </div>
                    <div class="form-group">
                        <label for="calc-entry-date">Buy Date</label>
                        <input type="date" id="calc-entry-date" value="${yearAgoStr}" max="${todayStr}">
                    </div>
                    <div class="form-group">
                        <label for="calc-exit-date">Sell Date</label>
                        <input type="date" id="calc-exit-date" value="${todayStr}" max="${todayStr}">
                    </div>
                    <div class="form-group">
                        <label for="calc-amount">Amount</label>
                        <input type="number" id="calc-amount" placeholder="1000" min="0" step="any" value="1000">
                    </div>
                    <div class="form-group" style="min-width:100px">
                        <label for="calc-amount-type">Type</label>
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
            </div>

            <div id="calc-results"></div>
        `;

        document.getElementById('calc-run').addEventListener('click', () => this.calculate());

        // Symbol autocomplete
        const symbolInput = document.getElementById('calc-symbol');

        symbolInput.addEventListener('input', (e) => {
            clearTimeout(this.acTimer);
            const query = e.target.value.trim();
            if (query.length < 1) {
                this.hideAutocomplete();
                return;
            }
            this.acTimer = setTimeout(() => this.searchSymbols(query), 250);
        });

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
                    this.calculate();
                }
            } else if (e.key === 'Escape') {
                this.hideAutocomplete();
            }
        });

        symbolInput.addEventListener('blur', () => {
            setTimeout(() => this.hideAutocomplete(), 150);
        });
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
        const dropdown = document.getElementById('calc-autocomplete');
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
        document.getElementById('calc-symbol').value = symbol;
        this.hideAutocomplete();
    },

    hideAutocomplete() {
        const dropdown = document.getElementById('calc-autocomplete');
        if (dropdown) dropdown.classList.add('hidden');
        this.acResults = [];
        this.acIndex = -1;
    },

    highlightResult() {
        const items = document.querySelectorAll('#calc-autocomplete .ac-item');
        items.forEach((item, i) => {
            item.classList.toggle('active', i === this.acIndex);
        });
    },

    async calculate() {
        const symbol = document.getElementById('calc-symbol').value.trim().toUpperCase();
        const entryDate = document.getElementById('calc-entry-date').value;
        const exitDate = document.getElementById('calc-exit-date').value;
        const amount = parseFloat(document.getElementById('calc-amount').value);
        const amountType = document.getElementById('calc-amount-type').value;

        if (!symbol) { App.toast('Enter a symbol', 'error'); return; }
        if (!entryDate || !exitDate) { App.toast('Select both dates', 'error'); return; }
        if (entryDate >= exitDate) { App.toast('Buy date must be before sell date', 'error'); return; }
        if (!amount || amount <= 0) { App.toast('Enter a valid amount', 'error'); return; }

        const resultsEl = document.getElementById('calc-results');
        resultsEl.innerHTML = '<div class="loading-spinner"><div class="spinner"></div>Calculating...</div>';

        try {
            const data = await App.post('/api/calculator/trade', {
                symbol,
                entry_date: entryDate,
                exit_date: exitDate,
                amount,
                amount_type: amountType,
            });
            this.lastResult = data;
            this.renderResults(data);
        } catch (err) {
            resultsEl.innerHTML = `<div class="card"><div class="empty-state"><h3>Error</h3><p>${App.escapeHtml(err.message)}</p></div></div>`;
        }
    },

    renderResults(data) {
        const resultsEl = document.getElementById('calc-results');
        if (!resultsEl) return;

        const isProfit = data.pnl_dollars >= 0;
        const pnlClass = isProfit ? 'positive' : 'negative';
        const pnlSign = isProfit ? '+' : '';
        const amountType = document.getElementById('calc-amount-type').value;

        // Check if dates were adjusted
        let dateNote = '';
        if (data.actual_entry_date !== data.entry_date || data.actual_exit_date !== data.exit_date) {
            const parts = [];
            if (data.actual_entry_date !== data.entry_date)
                parts.push(`Buy adjusted to ${data.actual_entry_date} (nearest trading day)`);
            if (data.actual_exit_date !== data.exit_date)
                parts.push(`Sell adjusted to ${data.actual_exit_date} (nearest trading day)`);
            dateNote = `<div class="date-adjusted-note">${parts.join(' &bull; ')}</div>`;
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
                    <div class="stat-card-label">${amountType === 'dollars' ? 'Invested' : 'Entry Value'}</div>
                    <div class="stat-card-value">${App.formatPrice(data.entry_value)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-label">Exit Value</div>
                    <div class="stat-card-value ${pnlClass}">${App.formatPrice(data.exit_value)}</div>
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
                    <div class="stat-card-label">Holding Period</div>
                    <div class="stat-card-value">${data.days_held} days</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-label">Annualized</div>
                    <div class="stat-card-value ${data.annualized_return >= 0 ? 'positive' : 'negative'}">${data.annualized_return >= 0 ? '+' : ''}${data.annualized_return.toFixed(2)}%</div>
                </div>
            </div>

            <div class="calculator-chart-container">
                <div class="card-header"><h3>${data.symbol} — ${data.actual_entry_date} to ${data.actual_exit_date}</h3></div>
                <div class="calculator-chart-area" id="calc-chart"></div>
            </div>
        `;

        this.renderChart(data);
    },

    renderChart(data) {
        const chartEl = document.getElementById('calc-chart');
        if (!chartEl || !data.ohlcv || data.ohlcv.length === 0) return;

        // Clean up previous chart
        if (this.chart) {
            this.chart.remove();
            this.chart = null;
        }

        this.chart = LightweightCharts.createChart(chartEl, {
            width: chartEl.clientWidth,
            height: 300,
            layout: {
                background: { color: 'transparent' },
                textColor: '#8899b0',
                fontSize: 11,
            },
            grid: {
                vertLines: { color: 'rgba(136,153,176,0.06)' },
                horzLines: { color: 'rgba(136,153,176,0.06)' },
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
                vertLine: { color: 'rgba(136,153,176,0.3)', width: 1, style: 3 },
                horzLine: { color: 'rgba(136,153,176,0.3)', width: 1, style: 3 },
            },
            timeScale: {
                borderColor: 'rgba(136,153,176,0.1)',
                timeVisible: false,
            },
            rightPriceScale: {
                borderColor: 'rgba(136,153,176,0.1)',
            },
        });

        const candleSeries = this.chart.addCandlestickSeries({
            upColor: '#00d4aa',
            downColor: '#ff4757',
            borderUpColor: '#00d4aa',
            borderDownColor: '#ff4757',
            wickUpColor: '#00d4aa',
            wickDownColor: '#ff4757',
        });

        candleSeries.setData(data.ohlcv);

        // Add buy/sell markers
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

        this.chart.timeScale().fitContent();

        // Responsive resize
        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                if (this.chart) {
                    this.chart.applyOptions({ width: entry.contentRect.width });
                }
            }
        });
        observer.observe(chartEl);
    },
};
