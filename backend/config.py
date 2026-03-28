"""Configuration for the trading analysis system.

All settings can be overridden via environment variables.
For local dev, create a .env file in the project root.
"""

import os
from pathlib import Path

# Load .env file if present (for local development)
# Check project root first (parent of backend/), then current dir
_env_file = Path(__file__).parent.parent / ".env"
if not _env_file.exists():
    _env_file = Path(__file__).parent / ".env"
if _env_file.exists():
    for line in _env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())

# ---------------------------------------------------------------------------
# Stocks — default watchlist (can be expanded dynamically via the web UI)
# ---------------------------------------------------------------------------
WATCHLIST = [
    "AAPL",
    "MSFT",
    "NVDA",
    "TSLA",
    "SPY",
]

# ---------------------------------------------------------------------------
# Data settings
# ---------------------------------------------------------------------------
DEFAULT_PERIOD = "6mo"       # How far back to fetch historical data
DEFAULT_INTERVAL = "1d"      # Candle interval: 1d, 1h, 15m, 5m, etc.

# ---------------------------------------------------------------------------
# Ollama settings (optional — LLM analysis is on-demand only)
# ---------------------------------------------------------------------------
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen3:8b")

# ---------------------------------------------------------------------------
# Technical indicator parameters
# ---------------------------------------------------------------------------
RSI_PERIOD = 14
MACD_FAST = 12
MACD_SLOW = 26
MACD_SIGNAL = 9
BB_PERIOD = 20
BB_STD = 2
SMA_SHORT = 20
SMA_LONG = 50

# ---------------------------------------------------------------------------
# Server settings
# ---------------------------------------------------------------------------
SERVER_HOST = os.environ.get("SERVER_HOST", "0.0.0.0")
SERVER_PORT = int(os.environ.get("SERVER_PORT", "8005"))

# ---------------------------------------------------------------------------
# Authentication (basic auth — username + hashed password)
# ---------------------------------------------------------------------------
AUTH_USERNAME = os.environ.get("AUTH_USERNAME", "admin")
AUTH_PASSWORD = os.environ.get("AUTH_PASSWORD", "changeme")  # Plain text in env, hashed at runtime
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = int(os.environ.get("JWT_EXPIRE_HOURS", "72"))

# ---------------------------------------------------------------------------
# Alpaca API (free tier — real-time data + paper trading)
# ---------------------------------------------------------------------------
ALPACA_API_KEY = os.environ.get("ALPACA_API_KEY", "")
ALPACA_SECRET_KEY = os.environ.get("ALPACA_SECRET_KEY", "")
ALPACA_BASE_URL = os.environ.get("ALPACA_BASE_URL", "https://paper-api.alpaca.markets")

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
DB_PATH = os.environ.get("DB_PATH", str(Path(__file__).parent / "trading.db"))

# ---------------------------------------------------------------------------
# Cache settings
# ---------------------------------------------------------------------------
CACHE_TTL_SECONDS = int(os.environ.get("CACHE_TTL_SECONDS", "300"))  # 5 minutes
