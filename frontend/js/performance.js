/* =====================================================================
   Signal Deck — Performance Analytics Page
   Live trading performance metrics, equity curve, win rate by tag
   ===================================================================== */

const Performance = {
    chart: null,
    period: 'all',

    async render(container) {
        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h2>Performance</h2>
                    <p class="text-secondary">Trading performance analytics</p>
                </div>
                <div class="page-actions">
                    <select id="perf-period" class="btn btn-ghost btn-sm" style="padding:6px 10px;background:var(--bg-input);border:1px solid var(--border);color:var(--text-primary)">
                        <option value="1W">1 Week</option>
                        <option value="1M">1 Month</option>
                        <option value="3M">3 Months</option>
                        <option value="6M">6 Months</option>
                        <option value="1Y">1 Year</option>
                        <option value="all" selected>All Time</option>
                    </select>
                    <button class="btn btn-ghost btn-sm" id="perf-refresh">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                            <polyline points="23 4 23 10 17 10"></polyline>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                        </svg>
                        Refresh
                    </button>
                </div>
            </div>

            <div id="perf-source-badge" class="perf-source-badge"></div>

            <!-- Metrics Grid -->
            <div id="perf-metrics" class="perf-metrics-grid">
                <div class="loading-spinner"><div class="spinner"></div></div>
            </div>

            <!-- Equity Curve -->
            <div class="card" style="margin-bottom:24px">
                <div class="card-header">
                    <h3>Equity Curve</h3>
                </div>
                <div id="perf-equity-chart" style="height:350px;position:relative">
                    <div class="loading-spinner"><div class="spinner"></div></div>
                </div>
            </div>

            <!-- Bottom row: Win Rate by Tag + Trade Distribution -->
            <div class="perf-bottom-row">
                <div class="card perf-tag-card">
                    <div class="card-header">
                        <h3>Win Rate by Tag</h3>
                    </div>
                    <div id="perf-by-tag">
                        <div class="loading-spinner"><div class="spinner"></div></div>
                    </div>
                </div>
                <div class="card perf-dist-card">
                    <div class="card-header">
                        <h3>Trade Distribution</h3>
                    </div>
                    <div id="perf-distribution">
                        <div class="loading-spinner"><div class="spinner"></div></div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('perf-period').addEventListener('change', (e) => {
            this.period = e.target.value;
            this.loadAll();
        });

        document.getElementById('perf-refresh').addEventListener('click', () => this.loadAll());

        await this.loadAll();
    },

    async loadAll() {
        await Promise.all([
            this.loadSummary(),
            this.loadEquityCurve(),
            this.loadByTag(),
        ]);
    },

    // ---------------------------------------------------------------
    // Summary metrics
    // ---------------------------------------------------------------
    async loadSummary() {
        const metricsEl = document.getElementById('perf-metrics');
        if (!metricsEl) return;

        try {
            const data = await App.get(`/api/performance/summary?period=${this.period}`);
            const sourceEl = document.getElementById('perf-source-badge');

            if (!data || data.total_trades === 0) {
                metricsEl.innerHTML = `
                    <div class="perf-empty-state">
                        <div style="font-size:2.5rem;margin-bottom:12px">📊</div>
                        <h3>No Trading Data Yet</h3>
                        <p class="text-muted">Complete some paper trades or connect Alpaca to see your performance analytics here.</p>
                        <a href="#/paper" class="btn btn-primary" style="margin-top:12px">Go to Paper Trading</a>
                    </div>`;
                if (sourceEl) sourceEl.innerHTML = '';
                return;
            }

            if (sourceEl) {
                sourceEl.innerHTML = `<span class="source-indicator">Data source: ${data.source === 'alpaca' ? 'Alpaca Paper' : 'Local Paper Trades'} · ${data.closed_trades} closed trade${data.closed_trades !== 1 ? 's' : ''}</span>`;
            }

            const totalPnlClass = data.total_pnl >= 0 ? 'metric-positive' : 'metric-negative';
            const totalPnlSign = data.total_pnl >= 0 ? '+' : '';

            metricsEl.innerHTML = `
                <div class="perf-metric-card highlight">
                    <div class="perf-metric-label">Total P&L</div>
                    <div class="perf-metric-value ${totalPnlClass}">${totalPnlSign}${data.total_pnl}%</div>
                    <div class="perf-metric-sub">${data.closed_trades} trades</div>
                </div>
                <div class="perf-metric-card">
                    <div class="perf-metric-label">Win Rate</div>
                    <div class="perf-metric-value">${data.win_rate}%</div>
                    <div class="perf-metric-sub">${data.wins}W / ${data.losses}L</div>
                </div>
                <div class="perf-metric-card">
                    <div class="perf-metric-label">Profit Factor</div>
                    <div class="perf-metric-value">${data.profit_factor === Infinity ? '∞' : data.profit_factor}</div>
                    <div class="perf-metric-sub">Gross profit / loss</div>
                </div>
                <div class="perf-metric-card">
                    <div class="perf-metric-label">Expectancy</div>
                    <div class="perf-metric-value ${data.expectancy >= 0 ? 'metric-positive' : 'metric-negative'}">${data.expectancy >= 0 ? '+' : ''}${data.expectancy}%</div>
                    <div class="perf-metric-sub">Per trade</div>
                </div>
                <div class="perf-metric-card">
                    <div class="perf-metric-label">Max Drawdown</div>
                    <div class="perf-metric-value metric-negative">-${data.max_drawdown}%</div>
                    <div class="perf-metric-sub">Peak to trough</div>
                </div>
                <div class="perf-metric-card">
                    <div class="perf-metric-label">Sharpe Ratio</div>
                    <div class="perf-metric-value">${data.sharpe_ratio}</div>
                    <div class="perf-metric-sub">Return / volatility</div>
                </div>
                <div class="perf-metric-card">
                    <div class="perf-metric-label">Risk/Reward</div>
                    <div class="perf-metric-value">${data.risk_reward === Infinity ? '∞' : data.risk_reward}</div>
                    <div class="perf-metric-sub">Avg win / avg loss</div>
                </div>
                <div class="perf-metric-card">
                    <div class="perf-metric-label">Avg Win</div>
                    <div class="perf-metric-value metric-positive">+${data.avg_win}%</div>
                    <div class="perf-metric-sub">Per winning trade</div>
                </div>
                <div class="perf-metric-card">
                    <div class="perf-metric-label">Avg Loss</div>
                    <div class="perf-metric-value metric-negative">-${data.avg_loss}%</div>
                    <div class="perf-metric-sub">Per losing trade</div>
                </div>
                <div class="perf-metric-card">
                    <div class="perf-metric-label">Best Trade</div>
                    <div class="perf-metric-value metric-positive">${data.best_trade.symbol}</div>
                    <div class="perf-metric-sub">+${data.best_trade.pnl_pct}%</div>
                </div>
                <div class="perf-metric-card">
                    <div class="perf-metric-label">Worst Trade</div>
                    <div class="perf-metric-value metric-negative">${data.worst_trade.symbol}</div>
                    <div class="perf-metric-sub">${data.worst_trade.pnl_pct}%</div>
                </div>
                <div class="perf-metric-card">
                    <div class="perf-metric-label">Avg Hold Time</div>
                    <div class="perf-metric-value">${data.avg_duration_days}d</div>
                    <div class="perf-metric-sub">Days held</div>
                </div>
                <div class="perf-metric-card">
                    <div class="perf-metric-label">Win Streak</div>
                    <div class="perf-metric-value metric-positive">${data.max_consec_wins}</div>
                    <div class="perf-metric-sub">Max consecutive</div>
                </div>
                <div class="perf-metric-card">
                    <div class="perf-metric-label">Loss Streak</div>
                    <div class="perf-metric-value metric-negative">${data.max_consec_losses}</div>
                    <div class="perf-metric-sub">Max consecutive</div>
                </div>
            `;

            // Also populate distribution
            this.renderDistribution(data);
        } catch (err) {
            metricsEl.innerHTML = `<div class="text-muted" style="padding:24px">Failed to load performance data: ${err.message}</div>`;
        }
    },

    // ---------------------------------------------------------------
    // Equity curve chart
    // ---------------------------------------------------------------
    async loadEquityCurve() {
        const chartEl = document.getElementById('perf-equity-chart');
        if (!chartEl) return;

        try {
            const data = await App.get(`/api/performance/equity-curve?period=${this.period}`);

            if (!data || !data.data || data.data.length === 0) {
                chartEl.innerHTML = `<div class="text-muted" style="padding:40px;text-align:center">No equity data available for this period</div>`;
                return;
            }

            chartEl.innerHTML = '';

            if (this.chart) {
                this.chart.remove();
                this.chart = null;
            }

            this.chart = LightweightCharts.createChart(chartEl, {
                layout: {
                    background: { type: 'solid', color: 'transparent' },
                    textColor: '#8892a4',
                    fontFamily: 'Inter, sans-serif',
                },
                grid: {
                    vertLines: { color: 'rgba(42, 46, 57, 0.4)' },
                    horzLines: { color: 'rgba(42, 46, 57, 0.4)' },
                },
                rightPriceScale: {
                    borderColor: 'rgba(42, 46, 57, 0.6)',
                },
                timeScale: {
                    borderColor: 'rgba(42, 46, 57, 0.6)',
                    timeVisible: false,
                },
                crosshair: {
                    mode: LightweightCharts.CrosshairMode.Normal,
                },
                handleScroll: true,
                handleScale: true,
            });

            const areaSeries = this.chart.addAreaSeries({
                lineColor: '#00d4aa',
                topColor: 'rgba(0, 212, 170, 0.3)',
                bottomColor: 'rgba(0, 212, 170, 0.02)',
                lineWidth: 2,
                priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
            });

            const chartData = data.data.map(pt => ({
                time: pt.date,
                value: pt.equity,
            }));

            areaSeries.setData(chartData);
            this.chart.timeScale().fitContent();

            // Resize handler
            const resizeObserver = new ResizeObserver(() => {
                if (this.chart && chartEl.clientWidth > 0) {
                    this.chart.applyOptions({ width: chartEl.clientWidth, height: chartEl.clientHeight });
                }
            });
            resizeObserver.observe(chartEl);

        } catch (err) {
            chartEl.innerHTML = `<div class="text-muted" style="padding:40px;text-align:center">Failed to load equity curve</div>`;
        }
    },

    // ---------------------------------------------------------------
    // Win Rate by Tag
    // ---------------------------------------------------------------
    async loadByTag() {
        const tagEl = document.getElementById('perf-by-tag');
        if (!tagEl) return;

        try {
            const data = await App.get(`/api/performance/by-tag?period=${this.period}`);

            if (!data || data.length === 0) {
                tagEl.innerHTML = `<div class="text-muted" style="padding:24px;text-align:center">No tag data — tag your watchlist stocks to see win rate by strategy</div>`;
                return;
            }

            tagEl.innerHTML = data.map(tag => {
                const winWidth = Math.max(tag.win_rate, 2);
                const barColor = tag.color || '#4a9eff';
                const pnlClass = tag.total_pnl >= 0 ? 'metric-positive' : 'metric-negative';
                const pnlSign = tag.total_pnl >= 0 ? '+' : '';

                return `
                    <div class="perf-tag-row">
                        <div class="perf-tag-info">
                            <span class="perf-tag-badge" style="background:${barColor}">${App.escapeHtml(tag.tag)}</span>
                            <span class="perf-tag-trades">${tag.total_trades} trade${tag.total_trades !== 1 ? 's' : ''}</span>
                        </div>
                        <div class="perf-tag-bar-container">
                            <div class="perf-tag-bar" style="width:${winWidth}%;background:${barColor}"></div>
                            <span class="perf-tag-bar-label">${tag.win_rate}%</span>
                        </div>
                        <div class="perf-tag-stats">
                            <span class="${pnlClass}">${pnlSign}${tag.total_pnl}%</span>
                            <span class="text-muted">${tag.wins}W/${tag.losses}L</span>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (err) {
            tagEl.innerHTML = `<div class="text-muted" style="padding:24px;text-align:center">Failed to load tag data</div>`;
        }
    },

    // ---------------------------------------------------------------
    // Trade Distribution (rendered from summary data)
    // ---------------------------------------------------------------
    renderDistribution(data) {
        const distEl = document.getElementById('perf-distribution');
        if (!distEl || !data) return;

        const wins = data.wins || 0;
        const losses = data.losses || 0;
        const total = wins + losses;
        if (total === 0) {
            distEl.innerHTML = '<div class="text-muted" style="padding:24px;text-align:center">No trades</div>';
            return;
        }

        const winPct = (wins / total * 100).toFixed(1);
        const lossPct = (losses / total * 100).toFixed(1);

        distEl.innerHTML = `
            <div class="perf-donut-section">
                <div class="perf-donut">
                    <svg viewBox="0 0 36 36" class="perf-donut-svg">
                        <path class="perf-donut-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <path class="perf-donut-win" stroke-dasharray="${winPct}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                    <div class="perf-donut-center">
                        <div class="perf-donut-value">${winPct}%</div>
                        <div class="perf-donut-label">Win Rate</div>
                    </div>
                </div>
                <div class="perf-donut-legend">
                    <div class="perf-legend-item">
                        <span class="perf-legend-dot" style="background:var(--green)"></span>
                        <span>Wins: ${wins}</span>
                    </div>
                    <div class="perf-legend-item">
                        <span class="perf-legend-dot" style="background:var(--red)"></span>
                        <span>Losses: ${losses}</span>
                    </div>
                    <div class="perf-legend-item">
                        <span class="perf-legend-dot" style="background:var(--text-muted)"></span>
                        <span>Total: ${total}</span>
                    </div>
                </div>
            </div>
            <div class="perf-extra-stats">
                <div class="perf-stat-row">
                    <span>Avg Win</span>
                    <span class="metric-positive">+${data.avg_win}%</span>
                </div>
                <div class="perf-stat-row">
                    <span>Avg Loss</span>
                    <span class="metric-negative">-${data.avg_loss}%</span>
                </div>
                <div class="perf-stat-row">
                    <span>Risk/Reward</span>
                    <span>${data.risk_reward === Infinity ? '∞' : data.risk_reward + ':1'}</span>
                </div>
                <div class="perf-stat-row">
                    <span>Expectancy</span>
                    <span class="${data.expectancy >= 0 ? 'metric-positive' : 'metric-negative'}">${data.expectancy >= 0 ? '+' : ''}${data.expectancy}%</span>
                </div>
            </div>
        `;
    },
};
