/* =====================================================================
   Signal Deck — Stock Detail Page
   Full analysis with candlestick chart, indicators, and LLM analysis
   ===================================================================== */

const StockDetail = {
    chart: null,
    symbol: null,
    calcPickMode: null,   // null, 'entry', or 'exit'
    calcChart: null,
    notesEditor: null,

    async render(container, symbol) {
        this.symbol = symbol;
        this.calcPickMode = null;

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
                </div>
            </div>

            <div class="stock-detail-grid">
                <div>
                    <div class="chart-container">
                        <div id="chart-pick-banner" class="chart-pick-banner hidden"></div>
                        <div class="chart-area" id="main-chart"></div>
                    </div>
                    <div id="action-card-area" class="mt-4"></div>
                    <div id="earnings-warning-area"></div>
                    <div id="llm-result-area" class="mt-4"></div>
                    <div id="signals-list-area" class="mt-4"></div>

                    <!-- Fundamentals Section -->
                    <div class="card mt-4" id="fundamentals-section" style="display:none">
                        <div class="card-header">
                            <h3>Fundamentals</h3>
                            <span id="fund-sector" class="text-muted" style="font-size:0.75rem"></span>
                        </div>
                        <div id="fundamentals-data" class="fundamentals-grid"></div>
                    </div>

                    <!-- Position Sizing -->
                    <div class="card mt-4" id="position-size-section">
                        <div class="card-header">
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
                    </div>

                    <!-- Mini News / Research -->
                    <div class="card mt-4" id="mini-news-section">
                        <div class="card-header">
                            <h3>Recent News</h3>
                            <div style="display:flex;gap:8px;align-items:center">
                                <span id="mini-sentiment-badge"></span>
                                <a href="#/investigate/${symbol}" class="btn btn-outline btn-sm">Full Research</a>
                            </div>
                        </div>
                        <div id="mini-news-content">
                            <button class="btn btn-ghost btn-sm" id="load-mini-news" style="width:100%;padding:16px">Load News &amp; Sentiment</button>
                        </div>
                    </div>

                    <!-- Notes Section -->
                    <div class="card mt-4" id="notes-section">
                        <div class="card-header">
                            <h3>Notes</h3>
                            <div style="display:flex;gap:8px;align-items:center">
                                <span id="notes-status" class="text-muted" style="font-size:0.75rem"></span>
                                <button class="btn btn-primary btn-sm" id="save-notes">Save</button>
                            </div>
                        </div>
                        <div id="notes-editor-area">
                            <textarea id="notes-textarea"></textarea>
                        </div>
                    </div>

                    <div class="card mt-6" id="calc-section">
                        <div class="card-header">
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
                    </div>

                    <div class="card mt-4" id="simulations-section">
                        <div class="card-header">
                            <h3>Saved Simulations</h3>
                            <button class="btn btn-ghost btn-sm" id="clear-sims" title="Clear all">Clear</button>
                        </div>
                        <div id="simulations-list"></div>
                    </div>
                </div>
                <div class="indicators-sidebar" id="indicators-sidebar">
                    <div class="loading-spinner"><div class="spinner"></div></div>
                </div>
            </div>
        `;

        document.getElementById('stock-period').addEventListener('change', (e) => {
            this.loadData(e.target.value);
        });

        document.getElementById('llm-btn').addEventListener('click', () => this.runLLM());
        document.getElementById('calc-run').addEventListener('click', () => this.runCalculator());
        document.getElementById('calc-pick-entry').addEventListener('click', () => this.startPick('entry'));
        document.getElementById('calc-pick-exit').addEventListener('click', () => this.startPick('exit'));
        document.getElementById('clear-sims').addEventListener('click', () => {
            this.clearSimulations();
        });

        // Position sizing
        document.getElementById('ps-calculate').addEventListener('click', () => this.calculatePositionSize());

        // Notes
        document.getElementById('save-notes').addEventListener('click', () => this.saveNotes());

        // Mini news
        document.getElementById('load-mini-news').addEventListener('click', () => this.loadMiniNews());

        this.renderSimulations();
        await this.loadData('6mo');
        this.initNotesEditor();
        this.loadNotes();
        this.loadFundamentals();
        this.loadEarnings();
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
        if (this.chart) {
            try { this.chart.remove(); } catch(e) {}
        }

        this.chart = LightweightCharts.createChart(el, {
            width: el.clientWidth,
            height: 380,
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

        // Resize observer
        const resizeObserver = new ResizeObserver(() => {
            if (this.chart) {
                this.chart.applyOptions({ width: el.clientWidth });
            }
        });
        resizeObserver.observe(el);
    },

    renderIndicators(summary) {
        const sidebar = document.getElementById('indicators-sidebar');
        const rsiClass = App.rsiClass(summary.rsi);
        const rsiColor = rsiClass === 'oversold' ? '#00d4aa' : rsiClass === 'overbought' ? '#ff4757' : '#8899b0';
        const rsiWidth = Math.min(100, Math.max(0, summary.rsi));

        const macdColor = summary.macd_histogram > 0 ? '#00d4aa' : '#ff4757';
        const adxWidth = Math.min(100, Math.max(0, (summary.adx / 50) * 100));

        sidebar.innerHTML = `
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

            const section = document.getElementById('fundamentals-section');
            const sectorEl = document.getElementById('fund-sector');
            const gridEl = document.getElementById('fundamentals-data');
            section.style.display = '';
            sectorEl.textContent = `${data.sector || ''} — ${data.industry || ''}`;

            const fmt = (v, prefix = '', suffix = '') => v != null ? `${prefix}${typeof v === 'number' ? v.toLocaleString(undefined, {maximumFractionDigits: 2}) : v}${suffix}` : '—';
            const fmtPct = (v) => v != null ? `${(v * 100).toFixed(2)}%` : '—';
            const fmtMoney = (v) => {
                if (v == null) return '—';
                if (Math.abs(v) >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
                if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
                if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
                return `$${v.toLocaleString()}`;
            };

            gridEl.innerHTML = `
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
};
