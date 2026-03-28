/* =====================================================================
   Signal Deck — Stock Detail Page
   Full analysis with candlestick chart, indicators, and LLM analysis
   ===================================================================== */

const StockDetail = {
    chart: null,
    symbol: null,

    async render(container, symbol) {
        this.symbol = symbol;
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
                        <div class="chart-area" id="main-chart"></div>
                    </div>
                    <div id="action-card-area" class="mt-4"></div>
                    <div id="llm-result-area" class="mt-4"></div>
                    <div id="signals-list-area" class="mt-4"></div>
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

        await this.loadData('6mo');
    },

    async loadData(period) {
        try {
            const data = await App.get(`/api/stock/${this.symbol}?period=${period}`);
            this.renderChart(data);
            this.renderIndicators(data.summary);
            this.renderActionCard(data.summary);
            this.renderSignalsList(data.summary);
        } catch (err) {
            App.toast(`Failed to load ${this.symbol}: ${err.message}`, 'error');
        }
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
};
