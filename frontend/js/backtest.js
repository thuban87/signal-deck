/* =====================================================================
   Signal Deck — Backtest Page
   Run signal backtests from the UI with equity curves
   ===================================================================== */

const Backtest = {
    chart: null,
    lastResult: null,

    async render(container, preSelectedSymbol) {
        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h2>Backtester</h2>
                    <p>Test signal strategies against historical data</p>
                </div>
            </div>

            <div class="backtest-controls">
                <div class="form-group" style="margin-bottom:0">
                    <label for="bt-symbol">Symbol</label>
                    <input type="text" id="bt-symbol" value="${preSelectedSymbol || 'AAPL'}" placeholder="AAPL" style="width:120px">
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
        document.getElementById('bt-symbol').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.runBacktest();
        });

        if (preSelectedSymbol) {
            this.runBacktest();
        }
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

            <div class="card">
                <div class="card-header">
                    <h3>Trade Log</h3>
                    <span style="font-size:0.75rem;color:var(--text-muted)">${data.trades.length} trades</span>
                </div>
                <div class="signals-table-wrap">
                    <table class="signals-table">
                        <thead>
                            <tr>
                                <th>Entry</th>
                                <th>Exit</th>
                                <th>Dir</th>
                                <th>Signal</th>
                                <th>Entry $</th>
                                <th>Exit $</th>
                                <th>P&L</th>
                                <th>Exit</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.trades.map(t => {
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
                </div>
            </div>
        `;

        this.renderEquityChart(data.equity_curve);
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

        const lineData = curve.map(c => ({ time: c.date, value: c.cumulative }));
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
