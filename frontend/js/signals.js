/* =====================================================================
   Signal Deck — Signals Page
   Chronological signal feed with filters
   ===================================================================== */

const Signals = {
    data: [],
    filters: { direction: 'all', days: 7 },

    async render(container) {
        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h2>Signal Feed</h2>
                    <p>Technical signals across your watchlist</p>
                </div>
            </div>
            <div class="filter-bar">
                <select id="signal-filter-direction">
                    <option value="all">All Directions</option>
                    <option value="long">Bullish Only</option>
                    <option value="short">Bearish Only</option>
                </select>
                <select id="signal-filter-days">
                    <option value="1">Today</option>
                    <option value="3">Last 3 Days</option>
                    <option value="7" selected>Last 7 Days</option>
                    <option value="14">Last 14 Days</option>
                    <option value="30">Last 30 Days</option>
                </select>
                <button class="btn btn-ghost btn-sm" id="signal-refresh-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                    </svg>
                    Scan
                </button>
            </div>
            <div class="card">
                <div class="signals-table-wrap">
                    <div id="signals-table-container">
                        <div class="loading-spinner"><div class="spinner"></div>Scanning for signals...</div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('signal-filter-direction').addEventListener('change', (e) => {
            this.filters.direction = e.target.value;
            this.renderTable();
        });

        document.getElementById('signal-filter-days').addEventListener('change', (e) => {
            this.filters.days = parseInt(e.target.value);
            this.loadData();
        });

        document.getElementById('signal-refresh-btn').addEventListener('click', () => this.loadData());

        await this.loadData();
    },

    async loadData() {
        try {
            this.data = await App.get(`/api/signals/scan?days=${this.filters.days}`);
            this.renderTable();
        } catch (err) {
            document.getElementById('signals-table-container').innerHTML = `
                <div class="empty-state">
                    <h3>Failed to load signals</h3>
                    <p>${App.escapeHtml(err.message)}</p>
                </div>
            `;
        }
    },

    renderTable() {
        const container = document.getElementById('signals-table-container');
        let signals = this.data || [];

        if (this.filters.direction !== 'all') {
            signals = signals.filter(s => s.direction === this.filters.direction);
        }

        if (signals.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
                    </svg>
                    <h3>No signals found</h3>
                    <p>No signals fired in the selected timeframe. Try expanding the range.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table class="signals-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Symbol</th>
                        <th>Direction</th>
                        <th>Signal</th>
                        <th>Price</th>
                        <th>Age</th>
                    </tr>
                </thead>
                <tbody>
                    ${signals.map(s => {
                        const isBullish = s.direction !== 'short';
                        const rowClass = isBullish ? 'bullish-row' : 'bearish-row';
                        const dirLabel = isBullish ? 'BUY' : 'SELL';
                        const dirClass = isBullish ? 'buy' : 'sell';
                        const ageText = s.days_ago === 0 ? 'Today' : s.days_ago === 1 ? '1 day' : `${s.days_ago} days`;

                        return `
                            <tr class="${rowClass}" style="cursor:pointer" data-symbol="${App.escapeHtml(s.symbol)}">
                                <td class="text-mono">${App.escapeHtml(s.date)}</td>
                                <td><strong>${App.escapeHtml(s.symbol)}</strong></td>
                                <td><span class="direction-badge ${dirClass}">${dirLabel}</span></td>
                                <td>${App.escapeHtml(s.signal)}</td>
                                <td class="text-mono">${App.formatPrice(s.price)}</td>
                                <td class="text-muted">${ageText}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;

        // Click rows to navigate to stock detail
        container.querySelectorAll('tbody tr').forEach(row => {
            row.addEventListener('click', () => {
                App.navigate(`#/stock/${row.dataset.symbol}`);
            });
        });
    },
};
