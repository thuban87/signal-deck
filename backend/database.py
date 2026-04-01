"""SQLite database for watchlist, signal history, and paper trades."""

import sqlite3
import json
from datetime import datetime, timezone
from pathlib import Path
from config import DB_PATH


def get_db() -> sqlite3.Connection:
    """Get a database connection with row factory."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Create tables if they don't exist."""
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS watchlist (
            symbol TEXT PRIMARY KEY,
            added_at TEXT NOT NULL DEFAULT (datetime('now')),
            notes TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS signal_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            signal_name TEXT NOT NULL,
            direction TEXT NOT NULL DEFAULT 'long',
            fired_at TEXT NOT NULL,
            price_at_signal REAL NOT NULL,
            indicator_snapshot TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_signal_symbol ON signal_history(symbol);
        CREATE INDEX IF NOT EXISTS idx_signal_fired ON signal_history(fired_at);

        CREATE TABLE IF NOT EXISTS paper_trades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            direction TEXT NOT NULL DEFAULT 'long',
            entry_price REAL NOT NULL,
            entry_date TEXT NOT NULL,
            exit_price REAL,
            exit_date TEXT,
            exit_reason TEXT,
            pnl_pct REAL,
            signal_name TEXT,
            notes TEXT DEFAULT '',
            status TEXT NOT NULL DEFAULT 'open',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_paper_symbol ON paper_trades(symbol);
        CREATE INDEX IF NOT EXISTS idx_paper_status ON paper_trades(status);

        CREATE TABLE IF NOT EXISTS stock_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            content TEXT NOT NULL DEFAULT '',
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_notes_symbol ON stock_notes(symbol);

        CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            color TEXT NOT NULL DEFAULT '#4a9eff',
            is_default INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS watchlist_tags (
            symbol TEXT NOT NULL,
            tag_id INTEGER NOT NULL,
            PRIMARY KEY (symbol, tag_id),
            FOREIGN KEY (symbol) REFERENCES watchlist(symbol) ON DELETE CASCADE,
            FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        );
    """)
    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# Watchlist operations
# ---------------------------------------------------------------------------

def get_watchlist() -> list[str]:
    """Get all symbols in the watchlist."""
    conn = get_db()
    rows = conn.execute("SELECT symbol FROM watchlist ORDER BY added_at").fetchall()
    conn.close()
    return [r["symbol"] for r in rows]


def add_to_watchlist(symbol: str, notes: str = "") -> bool:
    """Add a symbol to the watchlist. Returns False if already exists."""
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO watchlist (symbol, notes) VALUES (?, ?)",
            (symbol.upper(), notes),
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()


def remove_from_watchlist(symbol: str) -> bool:
    """Remove a symbol from the watchlist. Returns False if not found."""
    conn = get_db()
    cursor = conn.execute("DELETE FROM watchlist WHERE symbol = ?", (symbol.upper(),))
    conn.commit()
    deleted = cursor.rowcount > 0
    conn.close()
    return deleted


def seed_default_watchlist(defaults: list[str]):
    """Seed the watchlist with defaults if empty."""
    conn = get_db()
    count = conn.execute("SELECT COUNT(*) FROM watchlist").fetchone()[0]
    if count == 0:
        for symbol in defaults:
            try:
                conn.execute(
                    "INSERT INTO watchlist (symbol) VALUES (?)", (symbol,)
                )
            except sqlite3.IntegrityError:
                pass
        conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# Signal history
# ---------------------------------------------------------------------------

def log_signal(symbol: str, signal_name: str, direction: str,
               price: float, fired_at: str, snapshot: dict | None = None):
    """Log a signal that fired."""
    conn = get_db()
    conn.execute(
        """INSERT INTO signal_history
           (symbol, signal_name, direction, fired_at, price_at_signal, indicator_snapshot)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (symbol.upper(), signal_name, direction, fired_at, price,
         json.dumps(snapshot) if snapshot else None),
    )
    conn.commit()
    conn.close()


def get_signal_history(symbol: str | None = None, days: int = 30,
                       limit: int = 200) -> list[dict]:
    """Get recent signal history."""
    conn = get_db()
    query = "SELECT * FROM signal_history WHERE 1=1"
    params = []

    if symbol:
        query += " AND symbol = ?"
        params.append(symbol.upper())

    query += " AND fired_at >= datetime('now', ?)"
    params.append(f"-{days} days")

    query += " ORDER BY fired_at DESC LIMIT ?"
    params.append(limit)

    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Paper trades
# ---------------------------------------------------------------------------

def create_paper_trade(symbol: str, direction: str, entry_price: float,
                       entry_date: str, signal_name: str = "",
                       notes: str = "") -> int:
    """Create a new paper trade. Returns the trade ID."""
    conn = get_db()
    cursor = conn.execute(
        """INSERT INTO paper_trades
           (symbol, direction, entry_price, entry_date, signal_name, notes)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (symbol.upper(), direction, entry_price, entry_date, signal_name, notes),
    )
    conn.commit()
    trade_id = cursor.lastrowid
    conn.close()
    return trade_id


def close_paper_trade(trade_id: int, exit_price: float, exit_date: str,
                      exit_reason: str = "manual"):
    """Close an open paper trade."""
    conn = get_db()
    trade = conn.execute(
        "SELECT * FROM paper_trades WHERE id = ?", (trade_id,)
    ).fetchone()

    if not trade:
        conn.close()
        return None

    direction = trade["direction"]
    entry_price = trade["entry_price"]

    if direction == "long":
        pnl_pct = ((exit_price - entry_price) / entry_price) * 100
    else:
        pnl_pct = ((entry_price - exit_price) / entry_price) * 100

    conn.execute(
        """UPDATE paper_trades
           SET exit_price = ?, exit_date = ?, exit_reason = ?,
               pnl_pct = ?, status = 'closed'
           WHERE id = ?""",
        (exit_price, exit_date, exit_reason, round(pnl_pct, 2), trade_id),
    )
    conn.commit()
    conn.close()
    return round(pnl_pct, 2)


def get_paper_trades(status: str | None = None, symbol: str | None = None,
                     limit: int = 100) -> list[dict]:
    """Get paper trades, optionally filtered by status and symbol."""
    conn = get_db()
    query = "SELECT * FROM paper_trades WHERE 1=1"
    params = []

    if status:
        query += " AND status = ?"
        params.append(status)
    if symbol:
        query += " AND symbol = ?"
        params.append(symbol.upper())

    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)

    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_paper_equity_curve() -> list[dict]:
    """Get cumulative P&L for closed paper trades, ordered by exit date."""
    conn = get_db()
    rows = conn.execute(
        """SELECT exit_date, pnl_pct, symbol, direction, signal_name
           FROM paper_trades
           WHERE status = 'closed' AND exit_date IS NOT NULL
           ORDER BY exit_date ASC"""
    ).fetchall()
    conn.close()

    curve = []
    cumulative = 0.0
    for r in rows:
        cumulative += r["pnl_pct"]
        curve.append({
            "date": r["exit_date"],
            "pnl": r["pnl_pct"],
            "cumulative": round(cumulative, 2),
            "symbol": r["symbol"],
            "direction": r["direction"],
            "signal": r["signal_name"],
        })
    return curve


# ---------------------------------------------------------------------------
# Stock Notes
# ---------------------------------------------------------------------------

DEFAULT_TAGS = [
    {"name": "Tech Swing", "color": "#4a9eff"},
    {"name": "Long Term Hold", "color": "#00d4aa"},
    {"name": "Day Trade", "color": "#ff4757"},
    {"name": "Dividend Play", "color": "#a78bfa"},
    {"name": "Momentum", "color": "#ffc107"},
    {"name": "Value Pick", "color": "#17a2b8"},
    {"name": "Speculative", "color": "#fd7e14"},
    {"name": "Garbage but Volatile", "color": "#ff6b81"},
]


def seed_default_tags():
    """Seed default tags if none exist."""
    conn = get_db()
    count = conn.execute("SELECT COUNT(*) FROM tags").fetchone()[0]
    if count == 0:
        for tag in DEFAULT_TAGS:
            try:
                conn.execute(
                    "INSERT INTO tags (name, color, is_default) VALUES (?, ?, 1)",
                    (tag["name"], tag["color"]),
                )
            except sqlite3.IntegrityError:
                pass
        conn.commit()
    conn.close()


def get_stock_notes(symbol: str) -> dict | None:
    """Get notes for a symbol."""
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM stock_notes WHERE symbol = ?", (symbol.upper(),)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def save_stock_notes(symbol: str, content: str) -> dict:
    """Save or update notes for a symbol."""
    conn = get_db()
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        """INSERT INTO stock_notes (symbol, content, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(symbol) DO UPDATE SET content = ?, updated_at = ?""",
        (symbol.upper(), content, now, content, now),
    )
    conn.commit()
    conn.close()
    return {"symbol": symbol.upper(), "content": content, "updated_at": now}


# ---------------------------------------------------------------------------
# Tags
# ---------------------------------------------------------------------------

def get_all_tags() -> list[dict]:
    """Get all tags."""
    conn = get_db()
    rows = conn.execute("SELECT * FROM tags ORDER BY is_default DESC, name").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def create_tag(name: str, color: str = "#4a9eff") -> dict:
    """Create a custom tag. Returns the tag dict."""
    conn = get_db()
    try:
        cursor = conn.execute(
            "INSERT INTO tags (name, color, is_default) VALUES (?, ?, 0)",
            (name.strip(), color),
        )
        conn.commit()
        tag_id = cursor.lastrowid
        conn.close()
        return {"id": tag_id, "name": name.strip(), "color": color, "is_default": 0}
    except sqlite3.IntegrityError:
        conn.close()
        return None


def delete_tag(tag_id: int) -> bool:
    """Delete a tag (only non-default)."""
    conn = get_db()
    cursor = conn.execute("DELETE FROM tags WHERE id = ? AND is_default = 0", (tag_id,))
    conn.commit()
    deleted = cursor.rowcount > 0
    conn.close()
    return deleted


def get_symbol_tags(symbol: str) -> list[dict]:
    """Get tags for a symbol."""
    conn = get_db()
    rows = conn.execute(
        """SELECT t.* FROM tags t
           JOIN watchlist_tags wt ON t.id = wt.tag_id
           WHERE wt.symbol = ?
           ORDER BY t.name""",
        (symbol.upper(),),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def add_tag_to_symbol(symbol: str, tag_id: int) -> bool:
    """Assign a tag to a symbol."""
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO watchlist_tags (symbol, tag_id) VALUES (?, ?)",
            (symbol.upper(), tag_id),
        )
        conn.commit()
        conn.close()
        return True
    except sqlite3.IntegrityError:
        conn.close()
        return False


def remove_tag_from_symbol(symbol: str, tag_id: int) -> bool:
    """Remove a tag from a symbol."""
    conn = get_db()
    cursor = conn.execute(
        "DELETE FROM watchlist_tags WHERE symbol = ? AND tag_id = ?",
        (symbol.upper(), tag_id),
    )
    conn.commit()
    deleted = cursor.rowcount > 0
    conn.close()
    return deleted


def get_watchlist_with_tags() -> list[dict]:
    """Get watchlist symbols with their tags."""
    conn = get_db()
    symbols = conn.execute("SELECT symbol FROM watchlist ORDER BY added_at").fetchall()
    result = []
    for s in symbols:
        sym = s["symbol"]
        tags = conn.execute(
            """SELECT t.id, t.name, t.color FROM tags t
               JOIN watchlist_tags wt ON t.id = wt.tag_id
               WHERE wt.symbol = ?""",
            (sym,),
        ).fetchall()
        result.append({"symbol": sym, "tags": [dict(t) for t in tags]})
    conn.close()
    return result


# ---------------------------------------------------------------------------
# Quick-Logger ("Look Into Later")
# ---------------------------------------------------------------------------

def init_quick_log_table():
    """Create the look_into_later table if it doesn't exist."""
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS look_into_later (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            raw_input TEXT NOT NULL,
            resolved_ticker TEXT,
            resolved_name TEXT,
            status TEXT NOT NULL DEFAULT 'new',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_look_into_status ON look_into_later(status);
    """)
    conn.commit()
    conn.close()


def add_quick_log(raw_input: str, resolved_ticker: str | None = None,
                  resolved_name: str | None = None) -> int:
    """Add a quick-log entry. Returns the row ID."""
    conn = get_db()
    cursor = conn.execute(
        """INSERT INTO look_into_later (raw_input, resolved_ticker, resolved_name)
           VALUES (?, ?, ?)""",
        (raw_input.strip(), resolved_ticker, resolved_name),
    )
    conn.commit()
    row_id = cursor.lastrowid
    conn.close()
    return row_id


def get_quick_logs(status: str | None = None) -> list[dict]:
    """Get quick-log entries, optionally filtered by status."""
    conn = get_db()
    query = "SELECT * FROM look_into_later"
    params = []
    if status:
        query += " WHERE status = ?"
        params.append(status)
    query += " ORDER BY created_at DESC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def update_quick_log_status(log_id: int, status: str) -> bool:
    """Update the status of a quick-log entry."""
    conn = get_db()
    cursor = conn.execute(
        "UPDATE look_into_later SET status = ? WHERE id = ?",
        (status, log_id),
    )
    conn.commit()
    updated = cursor.rowcount > 0
    conn.close()
    return updated


def delete_quick_log(log_id: int) -> bool:
    """Delete a quick-log entry."""
    conn = get_db()
    cursor = conn.execute("DELETE FROM look_into_later WHERE id = ?", (log_id,))
    conn.commit()
    deleted = cursor.rowcount > 0
    conn.close()
    return deleted


# ---------------------------------------------------------------------------
# Baskets ("Write What You Know")
# ---------------------------------------------------------------------------

DEFAULT_BASKETS = [
    {
        "name": "Rideshare & Gig Economy",
        "icon": "🚗",
        "tickers": ["UBER", "LYFT", "DASH", "GRAB", "FVRR"],
    },
    {
        "name": "Crohn's & GI Research",
        "icon": "💊",
        "tickers": ["ABBV", "JNJ", "GILD", "PFE", "BMY", "VRTX"],
    },
    {
        "name": "SysAdmin & Infrastructure",
        "icon": "🖥️",
        "tickers": ["MSFT", "NOW", "CRM", "SNOW", "NET", "DDOG"],
    },
    {
        "name": "AI & Machine Learning",
        "icon": "🤖",
        "tickers": ["NVDA", "GOOG", "META", "AMD", "PLTR", "AI"],
    },
]


def init_baskets_tables():
    """Create baskets tables if they don't exist."""
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS baskets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            icon TEXT NOT NULL DEFAULT '📊',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS basket_tickers (
            basket_id INTEGER NOT NULL,
            symbol TEXT NOT NULL,
            PRIMARY KEY (basket_id, symbol),
            FOREIGN KEY (basket_id) REFERENCES baskets(id) ON DELETE CASCADE
        );
    """)
    conn.commit()
    conn.close()


def seed_default_baskets():
    """Seed default baskets if none exist."""
    conn = get_db()
    count = conn.execute("SELECT COUNT(*) FROM baskets").fetchone()[0]
    if count == 0:
        for basket in DEFAULT_BASKETS:
            try:
                cursor = conn.execute(
                    "INSERT INTO baskets (name, icon) VALUES (?, ?)",
                    (basket["name"], basket["icon"]),
                )
                basket_id = cursor.lastrowid
                for ticker in basket["tickers"]:
                    conn.execute(
                        "INSERT INTO basket_tickers (basket_id, symbol) VALUES (?, ?)",
                        (basket_id, ticker),
                    )
            except sqlite3.IntegrityError:
                pass
        conn.commit()
    conn.close()


def get_all_baskets() -> list[dict]:
    """Get all baskets with their tickers."""
    conn = get_db()
    baskets = conn.execute("SELECT * FROM baskets ORDER BY created_at").fetchall()
    result = []
    for b in baskets:
        tickers = conn.execute(
            "SELECT symbol FROM basket_tickers WHERE basket_id = ? ORDER BY symbol",
            (b["id"],),
        ).fetchall()
        result.append({
            **dict(b),
            "tickers": [t["symbol"] for t in tickers],
        })
    conn.close()
    return result


def create_basket(name: str, icon: str = "📊", tickers: list[str] | None = None) -> dict | None:
    """Create a new basket. Returns the basket dict or None if name exists."""
    conn = get_db()
    try:
        cursor = conn.execute(
            "INSERT INTO baskets (name, icon) VALUES (?, ?)",
            (name.strip(), icon),
        )
        basket_id = cursor.lastrowid
        if tickers:
            for ticker in tickers:
                conn.execute(
                    "INSERT INTO basket_tickers (basket_id, symbol) VALUES (?, ?)",
                    (basket_id, ticker.upper().strip()),
                )
        conn.commit()
        conn.close()
        return {"id": basket_id, "name": name.strip(), "icon": icon, "tickers": [t.upper().strip() for t in (tickers or [])]}
    except sqlite3.IntegrityError:
        conn.close()
        return None


def update_basket(basket_id: int, name: str | None = None, icon: str | None = None,
                  tickers: list[str] | None = None) -> bool:
    """Update a basket's name, icon, and/or tickers."""
    conn = get_db()
    basket = conn.execute("SELECT * FROM baskets WHERE id = ?", (basket_id,)).fetchone()
    if not basket:
        conn.close()
        return False

    if name is not None:
        conn.execute("UPDATE baskets SET name = ? WHERE id = ?", (name.strip(), basket_id))
    if icon is not None:
        conn.execute("UPDATE baskets SET icon = ? WHERE id = ?", (icon, basket_id))
    if tickers is not None:
        conn.execute("DELETE FROM basket_tickers WHERE basket_id = ?", (basket_id,))
        for ticker in tickers:
            conn.execute(
                "INSERT OR IGNORE INTO basket_tickers (basket_id, symbol) VALUES (?, ?)",
                (basket_id, ticker.upper().strip()),
            )
    conn.commit()
    conn.close()
    return True


def delete_basket(basket_id: int) -> bool:
    """Delete a basket and its ticker associations."""
    conn = get_db()
    cursor = conn.execute("DELETE FROM baskets WHERE id = ?", (basket_id,))
    conn.commit()
    deleted = cursor.rowcount > 0
    conn.close()
    return deleted


# ---------------------------------------------------------------------------
# Discover — tables for congressional trades, social mentions,
#             options flow, matchmaker state, and settings
# ---------------------------------------------------------------------------

def init_discover_tables():
    """Create tables for the Discover features."""
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS congress_trades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            politician TEXT NOT NULL,
            party TEXT,
            chamber TEXT,
            ticker TEXT NOT NULL,
            trade_type TEXT NOT NULL,
            amount_range TEXT,
            trade_date TEXT,
            disclosure_date TEXT,
            description TEXT,
            source_url TEXT,
            fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_congress_ticker ON congress_trades(ticker);
        CREATE INDEX IF NOT EXISTS idx_congress_date ON congress_trades(trade_date);
        CREATE INDEX IF NOT EXISTS idx_congress_fetched ON congress_trades(fetched_at);

        CREATE TABLE IF NOT EXISTS social_mentions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT NOT NULL,
            source TEXT NOT NULL DEFAULT 'reddit',
            subreddit TEXT,
            mention_count INTEGER NOT NULL DEFAULT 0,
            sentiment_score REAL,
            sentiment_label TEXT,
            sample_posts TEXT,
            scan_date TEXT NOT NULL,
            fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_social_ticker ON social_mentions(ticker);
        CREATE INDEX IF NOT EXISTS idx_social_date ON social_mentions(scan_date);

        CREATE TABLE IF NOT EXISTS options_flow (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT NOT NULL,
            expiration TEXT NOT NULL,
            strike REAL NOT NULL,
            option_type TEXT NOT NULL,
            volume INTEGER NOT NULL,
            open_interest INTEGER NOT NULL,
            vol_oi_ratio REAL,
            implied_volatility REAL,
            premium_volume REAL,
            last_price REAL,
            underlying_price REAL,
            scan_date TEXT NOT NULL,
            fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_options_ticker ON options_flow(ticker);
        CREATE INDEX IF NOT EXISTS idx_options_date ON options_flow(scan_date);

        CREATE TABLE IF NOT EXISTS matchmaker_seen (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT NOT NULL,
            action TEXT NOT NULL DEFAULT 'dismissed',
            seen_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_matchmaker_ticker ON matchmaker_seen(ticker);
        CREATE INDEX IF NOT EXISTS idx_matchmaker_action ON matchmaker_seen(action);

        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
    """)
    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# App Settings
# ---------------------------------------------------------------------------

DEFAULT_SETTINGS = {
    "social_scan_interval_hours": "4",
    "social_mention_threshold": "5",
    "social_spike_ratio": "2.0",
    "social_subreddits": "wallstreetbets,stocks,investing,options",
    "options_flow_vol_oi_threshold": "500",
    "options_flow_premium_threshold": "1000000",
    "options_sp500_scan_enabled": "false",
    "options_sp500_scan_time": "09:45",
    "matchmaker_reset_days": "7",
    "ticker_cycle_speed": "6",
    "ticker_cycle_type": "batch",
    "ticker_visible_count": "3",
    "ticker_default_source": "watchlist",
}


def seed_default_settings():
    """Seed default settings if they don't exist."""
    conn = get_db()
    for key, value in DEFAULT_SETTINGS.items():
        conn.execute(
            "INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)",
            (key, value),
        )
    conn.commit()
    conn.close()


def get_setting(key: str) -> str | None:
    """Get a single setting value."""
    conn = get_db()
    row = conn.execute("SELECT value FROM app_settings WHERE key = ?", (key,)).fetchone()
    conn.close()
    return row["value"] if row else DEFAULT_SETTINGS.get(key)


def get_all_settings() -> dict:
    """Get all settings as a dict."""
    conn = get_db()
    rows = conn.execute("SELECT key, value FROM app_settings").fetchall()
    conn.close()
    settings = {**DEFAULT_SETTINGS}
    for r in rows:
        settings[r["key"]] = r["value"]
    return settings


def update_setting(key: str, value: str):
    """Update a single setting."""
    conn = get_db()
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        """INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?""",
        (key, value, now, value, now),
    )
    conn.commit()
    conn.close()


def update_settings(settings: dict):
    """Update multiple settings at once."""
    conn = get_db()
    now = datetime.now(timezone.utc).isoformat()
    for key, value in settings.items():
        conn.execute(
            """INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
               ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?""",
            (key, str(value), now, str(value), now),
        )
    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# Congress Trades
# ---------------------------------------------------------------------------

def save_congress_trades(trades: list[dict]):
    """Save fetched congressional trades (replaces old data)."""
    conn = get_db()
    conn.execute("DELETE FROM congress_trades")
    for t in trades:
        conn.execute(
            """INSERT INTO congress_trades
               (politician, party, chamber, ticker, trade_type, amount_range,
                trade_date, disclosure_date, description, source_url)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (t.get("politician"), t.get("party"), t.get("chamber"),
             t.get("ticker", "").upper(), t.get("trade_type"), t.get("amount_range"),
             t.get("trade_date"), t.get("disclosure_date"),
             t.get("description"), t.get("source_url")),
        )
    conn.commit()
    conn.close()


def get_congress_trades(ticker: str | None = None, limit: int = 200) -> list[dict]:
    """Get cached congressional trades."""
    conn = get_db()
    query = "SELECT * FROM congress_trades WHERE 1=1"
    params = []
    if ticker:
        query += " AND ticker = ?"
        params.append(ticker.upper())
    query += " ORDER BY trade_date DESC LIMIT ?"
    params.append(limit)
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_congress_last_fetch() -> str | None:
    """Get timestamp of last congressional data fetch."""
    conn = get_db()
    row = conn.execute("SELECT MAX(fetched_at) as last_fetch FROM congress_trades").fetchone()
    conn.close()
    return row["last_fetch"] if row else None


# ---------------------------------------------------------------------------
# Social Mentions
# ---------------------------------------------------------------------------

def save_social_mentions(mentions: list[dict], scan_date: str):
    """Save social mention scan results. Replaces data for the same scan_date."""
    conn = get_db()
    conn.execute("DELETE FROM social_mentions WHERE scan_date = ?", (scan_date,))
    for m in mentions:
        conn.execute(
            """INSERT INTO social_mentions
               (ticker, source, subreddit, mention_count, sentiment_score,
                sentiment_label, sample_posts, scan_date)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (m.get("ticker", "").upper(), m.get("source", "reddit"),
             m.get("subreddit"), m.get("mention_count", 0),
             m.get("sentiment_score"), m.get("sentiment_label"),
             json.dumps(m.get("sample_posts", [])), scan_date),
        )
    conn.commit()
    conn.close()


def get_social_mentions(scan_date: str | None = None, limit: int = 100) -> list[dict]:
    """Get social mentions, optionally for a specific scan date."""
    conn = get_db()
    if scan_date:
        rows = conn.execute(
            """SELECT * FROM social_mentions WHERE scan_date = ?
               ORDER BY mention_count DESC LIMIT ?""",
            (scan_date, limit),
        ).fetchall()
    else:
        rows = conn.execute(
            """SELECT * FROM social_mentions
               WHERE scan_date = (SELECT MAX(scan_date) FROM social_mentions)
               ORDER BY mention_count DESC LIMIT ?""",
            (limit,),
        ).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        try:
            d["sample_posts"] = json.loads(d["sample_posts"]) if d["sample_posts"] else []
        except (json.JSONDecodeError, TypeError):
            d["sample_posts"] = []
        result.append(d)
    return result


def get_social_last_scan() -> str | None:
    """Get timestamp of last social scan."""
    conn = get_db()
    row = conn.execute("SELECT MAX(fetched_at) as last_scan FROM social_mentions").fetchone()
    conn.close()
    return row["last_scan"] if row else None


# ---------------------------------------------------------------------------
# Options Flow
# ---------------------------------------------------------------------------

def save_options_flow(alerts: list[dict], scan_date: str):
    """Save options flow alerts. Replaces data for the same scan_date."""
    conn = get_db()
    conn.execute("DELETE FROM options_flow WHERE scan_date = ?", (scan_date,))
    for a in alerts:
        conn.execute(
            """INSERT INTO options_flow
               (ticker, expiration, strike, option_type, volume, open_interest,
                vol_oi_ratio, implied_volatility, premium_volume, last_price,
                underlying_price, scan_date)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (a.get("ticker", "").upper(), a.get("expiration"), a.get("strike"),
             a.get("option_type"), a.get("volume", 0), a.get("open_interest", 0),
             a.get("vol_oi_ratio"), a.get("implied_volatility"),
             a.get("premium_volume"), a.get("last_price"),
             a.get("underlying_price"), scan_date),
        )
    conn.commit()
    conn.close()


def get_options_flow(ticker: str | None = None, scan_date: str | None = None,
                     limit: int = 100) -> list[dict]:
    """Get cached options flow alerts."""
    conn = get_db()
    query = "SELECT * FROM options_flow WHERE 1=1"
    params = []
    if ticker:
        query += " AND ticker = ?"
        params.append(ticker.upper())
    if scan_date:
        query += " AND scan_date = ?"
        params.append(scan_date)
    else:
        query += " AND scan_date = (SELECT MAX(scan_date) FROM options_flow)"
    query += " ORDER BY vol_oi_ratio DESC LIMIT ?"
    params.append(limit)
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_options_last_scan() -> str | None:
    """Get timestamp of last options scan."""
    conn = get_db()
    row = conn.execute("SELECT MAX(fetched_at) as last_scan FROM options_flow").fetchone()
    conn.close()
    return row["last_scan"] if row else None


# ---------------------------------------------------------------------------
# Matchmaker
# ---------------------------------------------------------------------------

def record_matchmaker_swipe(ticker: str, action: str):
    """Record a matchmaker swipe (watchlisted or dismissed)."""
    conn = get_db()
    conn.execute(
        "INSERT INTO matchmaker_seen (ticker, action) VALUES (?, ?)",
        (ticker.upper(), action),
    )
    conn.commit()
    conn.close()


def get_matchmaker_dismissed(days: int = 7) -> list[str]:
    """Get tickers dismissed in the last N days."""
    conn = get_db()
    rows = conn.execute(
        """SELECT DISTINCT ticker FROM matchmaker_seen
           WHERE action = 'dismissed'
           AND seen_at >= datetime('now', ?)""",
        (f"-{days} days",),
    ).fetchall()
    conn.close()
    return [r["ticker"] for r in rows]


def get_matchmaker_history(limit: int = 100) -> list[dict]:
    """Get recent matchmaker swipe history."""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM matchmaker_seen ORDER BY seen_at DESC LIMIT ?",
        (limit,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
