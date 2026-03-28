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
