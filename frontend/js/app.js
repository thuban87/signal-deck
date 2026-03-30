/* =====================================================================
   Signal Deck — Core Application
   Router, API client, auth, state management
   ===================================================================== */

const App = {
    token: localStorage.getItem('sd_token'),
    currentPage: null,
    refreshInterval: null,

    // ---------------------------------------------------------------
    // API Client
    // ---------------------------------------------------------------
    async api(endpoint, options = {}) {
        const headers = { 'Content-Type': 'application/json' };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(endpoint, { ...options, headers });

            if (response.status === 401) {
                this.logout();
                return null;
            }

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.detail || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            if (error.message !== 'Failed to fetch') {
                console.error(`API Error [${endpoint}]:`, error);
            }
            throw error;
        }
    },

    async get(endpoint) {
        return this.api(endpoint);
    },

    async post(endpoint, body) {
        return this.api(endpoint, { method: 'POST', body: JSON.stringify(body) });
    },

    async put(endpoint, body) {
        return this.api(endpoint, { method: 'PUT', body: JSON.stringify(body) });
    },

    async del(endpoint) {
        return this.api(endpoint, { method: 'DELETE' });
    },

    // ---------------------------------------------------------------
    // Authentication
    // ---------------------------------------------------------------
    async login(username, password) {
        const data = await this.post('/api/login', { username, password });
        if (data && data.token) {
            this.token = data.token;
            localStorage.setItem('sd_token', data.token);
            return true;
        }
        return false;
    },

    logout() {
        this.token = null;
        localStorage.removeItem('sd_token');
        this.showLogin();
    },

    isAuthenticated() {
        return !!this.token;
    },

    // ---------------------------------------------------------------
    // UI State
    // ---------------------------------------------------------------
    showLogin() {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app').classList.add('hidden');
        document.getElementById('quick-log-fab').classList.add('hidden');
        document.getElementById('quick-log-panel').classList.add('hidden');
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    },

    showApp() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        document.getElementById('quick-log-fab').classList.remove('hidden');
        this.loadConfig();
        this.startAutoRefresh();
    },

    async loadConfig() {
        try {
            const config = await this.get('/api/config');
            const label = document.getElementById('data-source-label');
            const badge = document.getElementById('data-source-badge');
            if (config) {
                label.textContent = config.data_source === 'alpaca' ? 'Alpaca Live' : 'yFinance';
                if (config.data_source !== 'alpaca') {
                    badge.classList.add('offline');
                }
            }
        } catch (e) {
            // Non-critical
        }
    },

    startAutoRefresh() {
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        this.refreshInterval = setInterval(() => {
            if (this.currentPage === 'dashboard' && typeof Dashboard !== 'undefined') {
                Dashboard.refresh();
            }
        }, 5 * 60 * 1000); // 5 minutes
    },

    // ---------------------------------------------------------------
    // Router
    // ---------------------------------------------------------------
    navigate(hash) {
        window.location.hash = hash;
    },

    handleRoute() {
        if (!this.isAuthenticated()) {
            this.showLogin();
            return;
        }
        this.showApp();

        const hash = window.location.hash || '#/dashboard';
        const parts = hash.replace('#/', '').split('/');
        const page = parts[0] || 'dashboard';
        const param = parts[1] || null;

        // Update nav
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.page === page);
        });

        this.currentPage = page;
        const content = document.getElementById('main-content');

        // Clean up previous page state
        if (typeof Discover !== 'undefined' && Discover.destroy) Discover.destroy();

        switch (page) {
            case 'dashboard':
                Dashboard.render(content);
                break;
            case 'signals':
                Signals.render(content);
                break;
            case 'stock':
                if (param) StockDetail.render(content, param.toUpperCase());
                else this.navigate('#/dashboard');
                break;
            case 'backtest':
                Backtest.render(content, param);
                break;
            case 'paper':
                PaperTrading.render(content);
                break;
            case 'investigate':
                Investigator.render(content, param ? param.toUpperCase() : null);
                break;
            case 'discover':
                Discover.render(content, param || null);
                break;
            case 'settings':
                Settings.render(content);
                break;
            case 'performance':
                Performance.render(content);
                break;
            default:
                this.navigate('#/dashboard');
        }
    },

    // ---------------------------------------------------------------
    // Toast notifications
    // ---------------------------------------------------------------
    toast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-exit');
            setTimeout(() => toast.remove(), 200);
        }, 3500);
    },

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------
    formatPrice(price) {
        if (price == null) return '—';
        return '$' + Number(price).toFixed(2);
    },

    formatChange(pct) {
        if (pct == null) return '—';
        const sign = pct >= 0 ? '+' : '';
        return `${sign}${pct.toFixed(2)}%`;
    },

    formatDate(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    },

    rsiClass(rsi) {
        if (rsi == null) return 'neutral';
        if (rsi < 30) return 'oversold';
        if (rsi > 70) return 'overbought';
        return 'neutral';
    },

    directionClass(direction) {
        return direction === 'short' || direction === 'sell' ? 'sell' : 'buy';
    },

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    // ---------------------------------------------------------------
    // Init
    // ---------------------------------------------------------------
    init() {
        // Login form
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;
            const errorEl = document.getElementById('login-error');
            const btn = document.getElementById('login-btn');

            btn.disabled = true;
            btn.textContent = 'Signing in...';
            errorEl.classList.add('hidden');

            try {
                const ok = await this.login(username, password);
                if (ok) {
                    this.handleRoute();
                } else {
                    errorEl.textContent = 'Invalid credentials';
                    errorEl.classList.remove('hidden');
                }
            } catch (err) {
                errorEl.textContent = err.message || 'Connection failed';
                errorEl.classList.remove('hidden');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Sign In';
            }
        });

        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());

        // Hash routing
        window.addEventListener('hashchange', () => this.handleRoute());

        // Add symbol modal
        const modal = document.getElementById('add-symbol-modal');
        document.getElementById('add-symbol-cancel').addEventListener('click', () => {
            modal.classList.add('hidden');
        });
        modal.querySelector('.modal-backdrop').addEventListener('click', () => {
            modal.classList.add('hidden');
        });
        document.getElementById('add-symbol-confirm').addEventListener('click', async () => {
            const input = document.getElementById('add-symbol-input');
            const errorEl = document.getElementById('add-symbol-error');
            const symbol = input.value.trim().toUpperCase();

            if (!symbol) return;

            try {
                await this.post('/api/watchlist', { symbol });
                modal.classList.add('hidden');
                input.value = '';
                errorEl.classList.add('hidden');
                this.toast(`${symbol} added to watchlist`, 'success');
                if (this.currentPage === 'dashboard') Dashboard.refresh();
            } catch (err) {
                errorEl.textContent = err.message;
                errorEl.classList.remove('hidden');
            }
        });
        document.getElementById('add-symbol-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('add-symbol-confirm').click();
        });

        // Quick-Logger FAB
        const fab = document.getElementById('quick-log-fab');
        const panel = document.getElementById('quick-log-panel');
        const qlInput = document.getElementById('quick-log-input');
        const qlFeedback = document.getElementById('quick-log-feedback');

        fab.addEventListener('click', () => {
            panel.classList.toggle('hidden');
            if (!panel.classList.contains('hidden')) {
                qlInput.value = '';
                qlFeedback.classList.add('hidden');
                setTimeout(() => qlInput.focus(), 100);
            }
        });

        document.getElementById('quick-log-close').addEventListener('click', () => {
            panel.classList.add('hidden');
        });

        document.getElementById('quick-log-submit').addEventListener('click', async () => {
            const raw = qlInput.value.trim();
            if (!raw) return;
            try {
                const result = await this.post('/api/quick-log', { input: raw });
                qlInput.value = '';
                qlFeedback.classList.remove('hidden');
                if (result.resolved_ticker) {
                    qlFeedback.className = 'quick-log-feedback success';
                    qlFeedback.textContent = `✓ Logged: ${result.resolved_ticker}${result.resolved_name ? ' — ' + result.resolved_name : ''}`;
                } else {
                    qlFeedback.className = 'quick-log-feedback warning';
                    qlFeedback.textContent = `⚠ Logged "${raw}" — couldn't resolve a ticker`;
                }
                this.toast('Idea logged', 'success');
                // Refresh dashboard if on it
                if (this.currentPage === 'dashboard' && typeof Dashboard !== 'undefined') {
                    Dashboard.refreshQuickLogs();
                }
                setTimeout(() => qlFeedback.classList.add('hidden'), 4000);
            } catch (err) {
                qlFeedback.className = 'quick-log-feedback error';
                qlFeedback.textContent = err.message;
                qlFeedback.classList.remove('hidden');
            }
        });

        qlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('quick-log-submit').click();
        });

        // Mobile sidebar hamburger
        const hamburgerBtn = document.getElementById('hamburger-btn');
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebar-overlay');

        hamburgerBtn.addEventListener('click', () => {
            sidebar.classList.toggle('mobile-open');
            sidebarOverlay.classList.toggle('hidden');
            // trigger opacity transition
            requestAnimationFrame(() => {
                sidebarOverlay.classList.toggle('visible', sidebar.classList.contains('mobile-open'));
            });
        });

        sidebarOverlay.addEventListener('click', () => {
            this.closeMobileSidebar();
        });

        // Close sidebar when a nav link is clicked (mobile)
        document.querySelectorAll('.nav-item').forEach(el => {
            el.addEventListener('click', () => {
                this.closeMobileSidebar();
            });
        });

        // Initial route
        this.handleRoute();
    },

    closeMobileSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        sidebar.classList.remove('mobile-open');
        overlay.classList.remove('visible');
        setTimeout(() => overlay.classList.add('hidden'), 300);
    },

    isMobile() {
        return window.matchMedia('(max-width: 768px)').matches;
    },
};

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
