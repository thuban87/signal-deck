/* =====================================================================
   Signal Deck — Investigator Page
   Deep-dive research: news, sentiment, insider trading, fundamentals
   ===================================================================== */

const Investigator = {
    symbol: null,
    acTimer: null,
    acResults: [],
    acIndex: -1,

    async render(container, preSelectedSymbol) {
        this.symbol = preSelectedSymbol || '';

        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h2>Investigator</h2>
                    <p>Deep-dive research &amp; sentiment analysis</p>
                </div>
            </div>

            <div class="investigator-search-bar">
                <div class="form-group" style="margin-bottom:0;position:relative;flex:1;max-width:400px">
                    <input type="text" id="inv-symbol" value="${this.symbol}" placeholder="Enter symbol (e.g. AAPL)" autocomplete="off" style="font-size:1.1rem;padding:12px 16px">
                    <div id="inv-autocomplete" class="autocomplete-dropdown hidden"></div>
                </div>
                <button class="btn btn-primary" id="inv-search" style="padding:12px 24px">Investigate</button>
            </div>

            <div id="inv-results"></div>
        `;

        const symbolInput = document.getElementById('inv-symbol');
        document.getElementById('inv-search').addEventListener('click', () => this.investigate());

        symbolInput.addEventListener('input', (e) => {
            clearTimeout(this.acTimer);
            const query = e.target.value.trim();
            if (query.length < 1) { this.hideAutocomplete(); return; }
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
                    this.investigate();
                }
            } else if (e.key === 'Escape') {
                this.hideAutocomplete();
            }
        });

        symbolInput.addEventListener('blur', () => {
            setTimeout(() => this.hideAutocomplete(), 150);
        });

        if (preSelectedSymbol) {
            this.investigate();
        }
    },

    async searchSymbols(query) {
        try {
            const results = await App.get(`/api/symbols/search?q=${encodeURIComponent(query)}&limit=8`);
            this.acResults = results || [];
            this.acIndex = -1;
            this.renderAutocomplete();
        } catch { this.hideAutocomplete(); }
    },

    renderAutocomplete() {
        const dropdown = document.getElementById('inv-autocomplete');
        if (!this.acResults.length) { this.hideAutocomplete(); return; }
        dropdown.classList.remove('hidden');
        dropdown.innerHTML = this.acResults.map((r, i) => `
            <div class="autocomplete-item ${i === this.acIndex ? 'highlighted' : ''}" data-symbol="${App.escapeHtml(r.symbol)}">
                <strong>${App.escapeHtml(r.symbol)}</strong>
                <span class="text-muted" style="margin-left:8px;font-size:0.8rem">${App.escapeHtml(r.name || '')}</span>
            </div>
        `).join('');
        dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.selectSymbol(item.dataset.symbol);
            });
        });
    },

    highlightResult() {
        const items = document.querySelectorAll('#inv-autocomplete .autocomplete-item');
        items.forEach((el, i) => el.classList.toggle('highlighted', i === this.acIndex));
    },

    selectSymbol(symbol) {
        document.getElementById('inv-symbol').value = symbol;
        this.hideAutocomplete();
        this.symbol = symbol;
        this.investigate();
    },

    hideAutocomplete() {
        const dropdown = document.getElementById('inv-autocomplete');
        if (dropdown) dropdown.classList.add('hidden');
        this.acResults = [];
        this.acIndex = -1;
    },

    async investigate() {
        this.symbol = document.getElementById('inv-symbol').value.trim().toUpperCase();
        if (!this.symbol) { App.toast('Enter a symbol', 'error'); return; }

        const resultsEl = document.getElementById('inv-results');
        resultsEl.innerHTML = `
            <div class="loading-spinner" style="padding:60px 0">
                <div class="spinner"></div>
                <div style="margin-top:12px">Investigating ${App.escapeHtml(this.symbol)}...</div>
            </div>
        `;

        // Update URL
        window.history.replaceState(null, '', `#/investigate/${this.symbol}`);

        // Fetch all data in parallel
        const [newsData, fundamentals, earnings, insider] = await Promise.allSettled([
            App.get(`/api/stock/${this.symbol}/news?days=14`),
            App.get(`/api/stock/${this.symbol}/fundamentals`),
            App.get(`/api/stock/${this.symbol}/earnings`),
            App.get(`/api/stock/${this.symbol}/insider`),
        ]);

        const news = newsData.status === 'fulfilled' ? newsData.value : { articles: [], sentiment: null };
        const funds = fundamentals.status === 'fulfilled' ? fundamentals.value : null;
        const earn = earnings.status === 'fulfilled' ? earnings.value : null;
        const ins = insider.status === 'fulfilled' ? insider.value : null;

        this.renderResults(news, funds, earn, ins);
    },

    renderResults(news, fundamentals, earnings, insider) {
        const resultsEl = document.getElementById('inv-results');

        // Sentiment gauge
        const sentimentHtml = this.renderSentimentGauge(news.sentiment);

        // Earnings warning
        const earningsHtml = this.renderEarnings(earnings);

        // Fundamentals
        const fundamentalsHtml = this.renderFundamentals(fundamentals);

        // Insider trading
        const insiderHtml = this.renderInsider(insider);

        // News feed
        const newsHtml = this.renderNewsFeed(news.articles);

        resultsEl.innerHTML = `
            <div class="inv-header">
                <h3>${App.escapeHtml(this.symbol)} — Research Report</h3>
                <a href="#/stock/${this.symbol}" class="btn btn-outline btn-sm">View Technical Analysis</a>
            </div>

            ${earningsHtml}

            <div class="inv-grid">
                <div class="inv-col">
                    ${sentimentHtml}
                    ${insiderHtml}
                </div>
                <div class="inv-col">
                    ${newsHtml}
                </div>
                <div class="inv-col-wide">
                    ${fundamentalsHtml}
                </div>
            </div>
        `;
    },

    renderSentimentGauge(sentiment) {
        if (!sentiment) return '<div class="card mb-4"><div class="card-header"><h3>Sentiment</h3></div><p class="text-muted" style="padding:12px">No sentiment data available</p></div>';

        const score = sentiment.score || 0;
        const label = sentiment.label || 'neutral';
        const color = label === 'bullish' ? 'var(--green)' : label === 'bearish' ? 'var(--red)' : 'var(--text-muted)';
        // Scale: -1 to +1, map to 0-100% for the gauge
        const pct = Math.round((score + 1) / 2 * 100);

        return `
            <div class="card mb-4">
                <div class="card-header">
                    <h3>News Sentiment</h3>
                    <span class="text-muted" style="font-size:0.75rem">${sentiment.count} articles analyzed</span>
                </div>
                <div style="text-align:center;padding:16px 0">
                    <div style="font-size:2.5rem;font-weight:800;color:${color};font-family:var(--font-mono)">${score > 0 ? '+' : ''}${score.toFixed(3)}</div>
                    <div style="font-size:1rem;font-weight:600;color:${color};text-transform:uppercase;margin-top:4px">${label}</div>
                    <div style="position:relative;margin:12px 0;height:8px;overflow:visible">
                        <div style="position:absolute;left:0;right:0;top:0;bottom:0;background:linear-gradient(to right, var(--red), var(--text-muted), var(--green));border-radius:4px;opacity:0.3"></div>
                        <div style="position:absolute;left:${pct}%;top:-2px;width:12px;height:12px;background:${color};border-radius:50%;transform:translateX(-50%);border:2px solid var(--bg-card)"></div>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-muted)">
                        <span>Bearish</span><span>Neutral</span><span>Bullish</span>
                    </div>
                </div>
                <div style="display:flex;justify-content:center;gap:24px;padding:8px 0;border-top:1px solid var(--border)">
                    <div style="text-align:center">
                        <div style="font-size:1.2rem;font-weight:700;color:var(--green)">${sentiment.bullish || 0}</div>
                        <div style="font-size:0.7rem;color:var(--text-muted)">Bullish</div>
                    </div>
                    <div style="text-align:center">
                        <div style="font-size:1.2rem;font-weight:700;color:var(--text-muted)">${sentiment.neutral || 0}</div>
                        <div style="font-size:0.7rem;color:var(--text-muted)">Neutral</div>
                    </div>
                    <div style="text-align:center">
                        <div style="font-size:1.2rem;font-weight:700;color:var(--red)">${sentiment.bearish || 0}</div>
                        <div style="font-size:0.7rem;color:var(--text-muted)">Bearish</div>
                    </div>
                </div>
            </div>
        `;
    },

    renderEarnings(earnings) {
        if (!earnings || !earnings.upcoming) return '';
        const e = earnings.upcoming;
        const isWarning = earnings.warning;
        const borderColor = isWarning ? 'var(--red)' : 'var(--gold)';
        const icon = isWarning ? '⚠️' : '📅';

        return `
            <div class="card mb-4" style="border-color:${borderColor};border-width:2px">
                <div style="display:flex;align-items:center;gap:12px;padding:4px 0">
                    <span style="font-size:1.5rem">${icon}</span>
                    <div>
                        <div style="font-weight:600;color:${isWarning ? 'var(--red)' : 'var(--gold)'}">
                            ${isWarning ? 'EARNINGS WARNING' : 'Upcoming Earnings'}
                        </div>
                        <div style="font-size:0.85rem;color:var(--text-secondary)">
                            ${e.date} (${e.days_until} days away)${e.hour ? ` — ${e.hour === 'bmo' ? 'Before Market Open' : e.hour === 'amc' ? 'After Market Close' : e.hour}` : ''}
                            ${e.estimate_eps != null ? ` | EPS Est: $${e.estimate_eps}` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderFundamentals(data) {
        if (!data) return '';

        const fmt = (v, prefix = '', suffix = '') => v != null ? `${prefix}${typeof v === 'number' ? v.toLocaleString(undefined, {maximumFractionDigits: 2}) : v}${suffix}` : '—';
        const fmtPct = (v) => v != null ? `${(v * 100).toFixed(2)}%` : '—';
        const fmtMoney = (v) => {
            if (v == null) return '—';
            if (Math.abs(v) >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
            if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
            if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
            return `$${v.toLocaleString()}`;
        };

        return `
            <div class="card mb-4">
                <div class="card-header">
                    <h3>Fundamentals</h3>
                    <span class="text-muted" style="font-size:0.75rem">${App.escapeHtml(data.sector || '')} — ${App.escapeHtml(data.industry || '')}</span>
                </div>
                <div class="fundamentals-grid">
                    <div class="fund-item">
                        <span class="fund-label">Market Cap</span>
                        <span class="fund-value">${fmtMoney(data.market_cap)}</span>
                    </div>
                    <div class="fund-item">
                        <span class="fund-label">P/E Ratio</span>
                        <span class="fund-value">${fmt(data.pe_ratio)}</span>
                    </div>
                    <div class="fund-item">
                        <span class="fund-label">Forward P/E</span>
                        <span class="fund-value">${fmt(data.forward_pe)}</span>
                    </div>
                    <div class="fund-item">
                        <span class="fund-label">EPS</span>
                        <span class="fund-value">${fmt(data.eps, '$')}</span>
                    </div>
                    <div class="fund-item">
                        <span class="fund-label">PEG Ratio</span>
                        <span class="fund-value">${fmt(data.peg_ratio)}</span>
                    </div>
                    <div class="fund-item">
                        <span class="fund-label">Debt/Equity</span>
                        <span class="fund-value">${fmt(data.debt_to_equity)}</span>
                    </div>
                    <div class="fund-item">
                        <span class="fund-label">Free Cash Flow</span>
                        <span class="fund-value">${fmtMoney(data.free_cash_flow)}</span>
                    </div>
                    <div class="fund-item">
                        <span class="fund-label">Dividend Yield</span>
                        <span class="fund-value">${fmtPct(data.dividend_yield)}</span>
                    </div>
                    <div class="fund-item">
                        <span class="fund-label">Profit Margin</span>
                        <span class="fund-value">${fmtPct(data.profit_margin)}</span>
                    </div>
                    <div class="fund-item">
                        <span class="fund-label">ROE</span>
                        <span class="fund-value">${fmtPct(data.return_on_equity)}</span>
                    </div>
                    <div class="fund-item">
                        <span class="fund-label">Beta</span>
                        <span class="fund-value">${fmt(data.beta)}</span>
                    </div>
                    <div class="fund-item">
                        <span class="fund-label">52W Range</span>
                        <span class="fund-value">${data.fifty_two_week_low != null ? `$${data.fifty_two_week_low.toFixed(2)} — $${data.fifty_two_week_high.toFixed(2)}` : '—'}</span>
                    </div>
                </div>
            </div>
        `;
    },

    renderInsider(data) {
        if (!data || !data.trades || data.trades.length === 0) {
            return `
                <div class="card mb-4">
                    <div class="card-header"><h3>Insider Trading</h3></div>
                    <p class="text-muted" style="padding:12px">No recent insider trades found</p>
                </div>
            `;
        }

        const summary = data.summary || {};
        const signalColor = summary.signal === 'bullish' ? 'var(--green)' : summary.signal === 'bearish' ? 'var(--red)' : 'var(--text-muted)';

        return `
            <div class="card mb-4">
                <div class="card-header">
                    <h3>Insider Trading</h3>
                    <span style="color:${signalColor};font-weight:600;font-size:0.8rem;text-transform:uppercase">${summary.signal || 'N/A'}</span>
                </div>
                ${summary.trade_count > 0 ? `
                    <div style="display:flex;gap:16px;padding:8px 0;margin-bottom:8px;border-bottom:1px solid var(--border)">
                        <div><span class="text-muted" style="font-size:0.7rem">Total Bought</span><div class="text-green font-bold">$${(summary.total_bought || 0).toLocaleString()}</div></div>
                        <div><span class="text-muted" style="font-size:0.7rem">Total Sold</span><div class="text-red font-bold">$${(summary.total_sold || 0).toLocaleString()}</div></div>
                        <div><span class="text-muted" style="font-size:0.7rem">Net</span><div class="font-bold" style="color:${signalColor}">$${(summary.net || 0).toLocaleString()}</div></div>
                    </div>
                ` : ''}
                <div class="signals-table-wrap" style="max-height:300px;overflow-y:auto">
                    <table class="signals-table" style="font-size:0.78rem">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Insider</th>
                                <th>Title</th>
                                <th>Type</th>
                                <th>Price</th>
                                <th>Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.trades.map(t => `
                                <tr>
                                    <td class="text-mono">${App.escapeHtml(t.trade_date)}</td>
                                    <td>${App.escapeHtml(t.insider)}</td>
                                    <td class="text-muted">${App.escapeHtml(t.title)}</td>
                                    <td><span class="direction-badge ${t.type === 'Buy' ? 'buy' : 'sell'}">${t.type}</span></td>
                                    <td class="text-mono">${App.escapeHtml(t.price)}</td>
                                    <td class="text-mono">${App.escapeHtml(t.value)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    renderNewsFeed(articles) {
        if (!articles || articles.length === 0) {
            return `
                <div class="card mb-4">
                    <div class="card-header"><h3>News Feed</h3></div>
                    <p class="text-muted" style="padding:12px">No recent news articles found</p>
                </div>
            `;
        }

        return `
            <div class="card mb-4">
                <div class="card-header">
                    <h3>News Feed</h3>
                    <span class="text-muted" style="font-size:0.75rem">${articles.length} articles</span>
                </div>
                <div class="news-feed">
                    ${articles.map(a => {
                        const date = a.datetime ? new Date(a.datetime * 1000) : null;
                        const timeStr = date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
                        const sentimentBadge = a.sentiment ?
                            `<span class="sentiment-badge ${a.sentiment.label}">${a.sentiment.label} (${a.sentiment.compound > 0 ? '+' : ''}${a.sentiment.compound.toFixed(2)})</span>` : '';

                        return `
                            <div class="news-article">
                                <div class="news-article-header">
                                    <a href="${App.escapeHtml(a.url)}" target="_blank" rel="noopener noreferrer" class="news-headline">${App.escapeHtml(a.headline)}</a>
                                    ${sentimentBadge}
                                </div>
                                ${a.summary ? `<p class="news-summary">${App.escapeHtml(a.summary).substring(0, 200)}${a.summary.length > 200 ? '...' : ''}</p>` : ''}
                                <div class="news-meta">
                                    <span>${App.escapeHtml(a.source)}</span>
                                    <span>${timeStr}</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    },
};
