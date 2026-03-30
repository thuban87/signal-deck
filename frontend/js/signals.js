/* =====================================================================
   Signal Deck — Signals Page
   Chronological signal feed with filters
   ===================================================================== */

const Signals = {
    data: [],
    filters: { direction: 'all', days: 7 },
    sortColumn: 'date',
    sortDirection: 'desc',
    symbolFilter: '',
    signalFilter: '',

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
                <input type="text" id="signal-filter-symbol" placeholder="Filter symbol..." style="width:120px">
                <input type="text" id="signal-filter-signal" placeholder="Filter signal..." style="width:160px">
                <div style="margin-left:auto;display:flex;gap:6px;align-items:center">
                    <label style="font-size:0.75rem;color:var(--text-muted);white-space:nowrap">Account $</label>
                    <input type="number" id="signal-account-size" value="200" min="1" step="any" style="width:80px">
                    <label style="font-size:0.75rem;color:var(--text-muted);white-space:nowrap">Risk %</label>
                    <input type="number" id="signal-risk-pct" value="2" min="0.1" max="100" step="0.1" style="width:60px">
                </div>
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

        document.getElementById('signal-filter-symbol').addEventListener('input', (e) => {
            this.symbolFilter = e.target.value.trim().toUpperCase();
            this.renderTable();
        });

        document.getElementById('signal-filter-signal').addEventListener('input', (e) => {
            this.signalFilter = e.target.value.trim().toLowerCase();
            this.renderTable();
        });

        document.getElementById('signal-refresh-btn').addEventListener('click', () => this.loadData());

        document.getElementById('signal-account-size').addEventListener('change', () => this.renderTable());
        document.getElementById('signal-risk-pct').addEventListener('change', () => this.renderTable());

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
        let signals = [...(this.data || [])];

        // Direction filter
        if (this.filters.direction !== 'all') {
            signals = signals.filter(s => s.direction === this.filters.direction);
        }
        // Symbol filter
        if (this.symbolFilter) {
            signals = signals.filter(s => s.symbol.toUpperCase().includes(this.symbolFilter));
        }
        // Signal name filter
        if (this.signalFilter) {
            signals = signals.filter(s => s.signal.toLowerCase().includes(this.signalFilter));
        }

        // Sort
        const col = this.sortColumn;
        const dir = this.sortDirection;
        signals.sort((a, b) => {
            let valA = a[col], valB = b[col];
            if (col === 'price' || col === 'days_ago') {
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

        const arrow = (col) => {
            if (this.sortColumn !== col) return '<span class="sort-arrow">\u2195</span>';
            return `<span class="sort-arrow">${this.sortDirection === 'asc' ? '\u25B2' : '\u25BC'}</span>`;
        };
        const activeClass = (col) => this.sortColumn === col ? 'active' : '';

        container.innerHTML = `
            <table class="signals-table">
                <thead>
                    <tr>
                        <th class="sortable ${activeClass('date')}" data-sort="date">Date ${arrow('date')}</th>
                        <th class="sortable ${activeClass('symbol')}" data-sort="symbol">Symbol ${arrow('symbol')}</th>
                        <th class="sortable ${activeClass('direction')}" data-sort="direction">Direction ${arrow('direction')}</th>
                        <th class="sortable ${activeClass('signal')}" data-sort="signal">Signal ${arrow('signal')}</th>
                        <th class="sortable ${activeClass('price')}" data-sort="price">Price ${arrow('price')}</th>
                        <th>Shares</th>
                        <th>Stop Loss</th>
                        <th class="sortable ${activeClass('days_ago')}" data-sort="days_ago">Age ${arrow('days_ago')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${signals.map(s => {
                        const isBullish = s.direction !== 'short';
                        const rowClass = isBullish ? 'bullish-row' : 'bearish-row';
                        const dirLabel = isBullish ? 'BUY' : 'SELL';
                        const dirClass = isBullish ? 'buy' : 'sell';
                        const ageText = s.days_ago === 0 ? 'Today' : s.days_ago === 1 ? '1 day' : `${s.days_ago} days`;

                        // Position sizing calculation
                        const accountSize = parseFloat(document.getElementById('signal-account-size')?.value) || 200;
                        const riskPct = parseFloat(document.getElementById('signal-risk-pct')?.value) || 2;
                        const riskDollars = accountSize * (riskPct / 100);
                        // Use a rough ATR estimate: ~2% of price for a default if we don't have ATR
                        const atrEstimate = s.price * 0.02;
                        const stopDistance = atrEstimate * 1.5;
                        const shares = stopDistance > 0 ? Math.floor(riskDollars / stopDistance) : 0;
                        const stopLoss = isBullish ? (s.price - stopDistance) : (s.price + stopDistance);

                        return `
                            <tr class="${rowClass}" style="cursor:pointer" data-symbol="${App.escapeHtml(s.symbol)}">
                                <td class="text-mono">${App.escapeHtml(s.date)}</td>
                                <td><strong>${App.escapeHtml(s.symbol)}</strong></td>
                                <td><span class="direction-badge ${dirClass}">${dirLabel}</span></td>
                                <td>${App.escapeHtml(s.signal)}</td>
                                <td class="text-mono">${App.formatPrice(s.price)}</td>
                                <td class="text-mono" style="color:var(--green)">${shares}</td>
                                <td class="text-mono" style="color:var(--red)">${App.formatPrice(stopLoss)}</td>
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

        // Sortable column headers
        container.querySelectorAll('th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sort;
                if (this.sortColumn === col) {
                    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    this.sortColumn = col;
                    this.sortDirection = col === 'date' ? 'desc' : 'asc';
                }
                this.renderTable();
            });
        });
    },
};
