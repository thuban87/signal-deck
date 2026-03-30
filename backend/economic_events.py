"""Economic calendar — curated macro events + Alpha Vantage + Finnhub supplements.

Provides upcoming high-impact macro events (FOMC, CPI, Unemployment, GDP, etc.)
with countdown timers and impact levels for the Market Status widget.
"""

import json
import requests
from datetime import datetime, timedelta
from config import ALPHA_VANTAGE_API_KEY, FINNHUB_API_KEY

# ---------------------------------------------------------------------------
# Curated 2025-2026 major economic events (published schedules)
# These are verified dates from the Federal Reserve, BLS, and BEA calendars.
# ---------------------------------------------------------------------------

CURATED_EVENTS = [
    # --- 2025 ---
    # FOMC meetings (statement release dates)
    {"date": "2025-01-29", "event": "FOMC Interest Rate Decision", "impact": "high", "category": "fed"},
    {"date": "2025-03-19", "event": "FOMC Interest Rate Decision", "impact": "high", "category": "fed"},
    {"date": "2025-05-07", "event": "FOMC Interest Rate Decision", "impact": "high", "category": "fed"},
    {"date": "2025-06-18", "event": "FOMC Interest Rate Decision", "impact": "high", "category": "fed"},
    {"date": "2025-07-30", "event": "FOMC Interest Rate Decision", "impact": "high", "category": "fed"},
    {"date": "2025-09-17", "event": "FOMC Interest Rate Decision", "impact": "high", "category": "fed"},
    {"date": "2025-10-29", "event": "FOMC Interest Rate Decision", "impact": "high", "category": "fed"},
    {"date": "2025-12-17", "event": "FOMC Interest Rate Decision", "impact": "high", "category": "fed"},

    # CPI releases (BLS schedule)
    {"date": "2025-01-15", "event": "CPI Report (Dec)", "impact": "high", "category": "inflation"},
    {"date": "2025-02-12", "event": "CPI Report (Jan)", "impact": "high", "category": "inflation"},
    {"date": "2025-03-12", "event": "CPI Report (Feb)", "impact": "high", "category": "inflation"},
    {"date": "2025-04-10", "event": "CPI Report (Mar)", "impact": "high", "category": "inflation"},
    {"date": "2025-05-13", "event": "CPI Report (Apr)", "impact": "high", "category": "inflation"},
    {"date": "2025-06-11", "event": "CPI Report (May)", "impact": "high", "category": "inflation"},
    {"date": "2025-07-15", "event": "CPI Report (Jun)", "impact": "high", "category": "inflation"},
    {"date": "2025-08-12", "event": "CPI Report (Jul)", "impact": "high", "category": "inflation"},
    {"date": "2025-09-10", "event": "CPI Report (Aug)", "impact": "high", "category": "inflation"},
    {"date": "2025-10-14", "event": "CPI Report (Sep)", "impact": "high", "category": "inflation"},
    {"date": "2025-11-12", "event": "CPI Report (Oct)", "impact": "high", "category": "inflation"},
    {"date": "2025-12-10", "event": "CPI Report (Nov)", "impact": "high", "category": "inflation"},

    # Non-Farm Payrolls / Unemployment (BLS schedule)
    {"date": "2025-01-10", "event": "Jobs Report (Dec)", "impact": "high", "category": "employment"},
    {"date": "2025-02-07", "event": "Jobs Report (Jan)", "impact": "high", "category": "employment"},
    {"date": "2025-03-07", "event": "Jobs Report (Feb)", "impact": "high", "category": "employment"},
    {"date": "2025-04-04", "event": "Jobs Report (Mar)", "impact": "high", "category": "employment"},
    {"date": "2025-05-02", "event": "Jobs Report (Apr)", "impact": "high", "category": "employment"},
    {"date": "2025-06-06", "event": "Jobs Report (May)", "impact": "high", "category": "employment"},
    {"date": "2025-07-03", "event": "Jobs Report (Jun)", "impact": "high", "category": "employment"},
    {"date": "2025-08-01", "event": "Jobs Report (Jul)", "impact": "high", "category": "employment"},
    {"date": "2025-09-05", "event": "Jobs Report (Aug)", "impact": "high", "category": "employment"},
    {"date": "2025-10-03", "event": "Jobs Report (Sep)", "impact": "high", "category": "employment"},
    {"date": "2025-11-07", "event": "Jobs Report (Oct)", "impact": "high", "category": "employment"},
    {"date": "2025-12-05", "event": "Jobs Report (Nov)", "impact": "high", "category": "employment"},

    # GDP releases (BEA schedule — advance estimates)
    {"date": "2025-01-30", "event": "GDP Report (Q4 Advance)", "impact": "high", "category": "gdp"},
    {"date": "2025-04-30", "event": "GDP Report (Q1 Advance)", "impact": "high", "category": "gdp"},
    {"date": "2025-07-30", "event": "GDP Report (Q2 Advance)", "impact": "high", "category": "gdp"},
    {"date": "2025-10-29", "event": "GDP Report (Q3 Advance)", "impact": "high", "category": "gdp"},

    # --- 2026 ---
    # FOMC meetings
    {"date": "2026-01-28", "event": "FOMC Interest Rate Decision", "impact": "high", "category": "fed"},
    {"date": "2026-03-18", "event": "FOMC Interest Rate Decision", "impact": "high", "category": "fed"},
    {"date": "2026-05-06", "event": "FOMC Interest Rate Decision", "impact": "high", "category": "fed"},
    {"date": "2026-06-17", "event": "FOMC Interest Rate Decision", "impact": "high", "category": "fed"},
    {"date": "2026-07-29", "event": "FOMC Interest Rate Decision", "impact": "high", "category": "fed"},
    {"date": "2026-09-16", "event": "FOMC Interest Rate Decision", "impact": "high", "category": "fed"},
    {"date": "2026-10-28", "event": "FOMC Interest Rate Decision", "impact": "high", "category": "fed"},
    {"date": "2026-12-16", "event": "FOMC Interest Rate Decision", "impact": "high", "category": "fed"},

    # CPI 2026 (projected based on BLS pattern — typically 2nd or 3rd week)
    {"date": "2026-01-14", "event": "CPI Report (Dec)", "impact": "high", "category": "inflation"},
    {"date": "2026-02-11", "event": "CPI Report (Jan)", "impact": "high", "category": "inflation"},
    {"date": "2026-03-11", "event": "CPI Report (Feb)", "impact": "high", "category": "inflation"},
    {"date": "2026-04-14", "event": "CPI Report (Mar)", "impact": "high", "category": "inflation"},
    {"date": "2026-05-12", "event": "CPI Report (Apr)", "impact": "high", "category": "inflation"},
    {"date": "2026-06-10", "event": "CPI Report (May)", "impact": "high", "category": "inflation"},
    {"date": "2026-07-14", "event": "CPI Report (Jun)", "impact": "high", "category": "inflation"},
    {"date": "2026-08-12", "event": "CPI Report (Jul)", "impact": "high", "category": "inflation"},
    {"date": "2026-09-15", "event": "CPI Report (Aug)", "impact": "high", "category": "inflation"},
    {"date": "2026-10-13", "event": "CPI Report (Sep)", "impact": "high", "category": "inflation"},
    {"date": "2026-11-12", "event": "CPI Report (Oct)", "impact": "high", "category": "inflation"},
    {"date": "2026-12-10", "event": "CPI Report (Nov)", "impact": "high", "category": "inflation"},

    # Jobs Report 2026
    {"date": "2026-01-09", "event": "Jobs Report (Dec)", "impact": "high", "category": "employment"},
    {"date": "2026-02-06", "event": "Jobs Report (Jan)", "impact": "high", "category": "employment"},
    {"date": "2026-03-06", "event": "Jobs Report (Feb)", "impact": "high", "category": "employment"},
    {"date": "2026-04-03", "event": "Jobs Report (Mar)", "impact": "high", "category": "employment"},
    {"date": "2026-05-08", "event": "Jobs Report (Apr)", "impact": "high", "category": "employment"},
    {"date": "2026-06-05", "event": "Jobs Report (May)", "impact": "high", "category": "employment"},
    {"date": "2026-07-02", "event": "Jobs Report (Jun)", "impact": "high", "category": "employment"},
    {"date": "2026-08-07", "event": "Jobs Report (Jul)", "impact": "high", "category": "employment"},
    {"date": "2026-09-04", "event": "Jobs Report (Aug)", "impact": "high", "category": "employment"},
    {"date": "2026-10-02", "event": "Jobs Report (Sep)", "impact": "high", "category": "employment"},
    {"date": "2026-11-06", "event": "Jobs Report (Oct)", "impact": "high", "category": "employment"},
    {"date": "2026-12-04", "event": "Jobs Report (Nov)", "impact": "high", "category": "employment"},

    # GDP 2026
    {"date": "2026-01-29", "event": "GDP Report (Q4 2025 Advance)", "impact": "high", "category": "gdp"},
    {"date": "2026-04-29", "event": "GDP Report (Q1 Advance)", "impact": "high", "category": "gdp"},
    {"date": "2026-07-29", "event": "GDP Report (Q2 Advance)", "impact": "high", "category": "gdp"},
    {"date": "2026-10-28", "event": "GDP Report (Q3 Advance)", "impact": "high", "category": "gdp"},
]

# Sector ↔ category mapping for stock-specific relevance
SECTOR_EVENT_RELEVANCE = {
    # Financial sector cares most about Fed decisions
    "Financial Services": ["fed", "gdp"],
    "Financials": ["fed", "gdp"],
    # Consumer sectors care about CPI/inflation
    "Consumer Cyclical": ["inflation", "employment", "gdp"],
    "Consumer Defensive": ["inflation", "employment"],
    "Consumer Discretionary": ["inflation", "employment", "gdp"],
    "Consumer Staples": ["inflation", "employment"],
    # Real estate cares about rates
    "Real Estate": ["fed", "inflation"],
    # Everything cares about FOMC and CPI at some level
    "Technology": ["fed", "inflation", "gdp"],
    "Healthcare": ["fed", "gdp"],
    "Industrials": ["employment", "gdp"],
    "Energy": ["inflation", "gdp"],
    "Materials": ["inflation", "gdp"],
    "Basic Materials": ["inflation", "gdp"],
    "Utilities": ["fed"],
    "Communication Services": ["fed", "gdp"],
}

# SPY / major indices are affected by everything
INDEX_TICKERS = {"SPY", "QQQ", "DIA", "IWM", "VOO", "VTI", "SPXL", "TQQQ"}


# ---------------------------------------------------------------------------
# Cache for API results (simple in-memory TTL cache)
# ---------------------------------------------------------------------------
_cache = {}
_CACHE_TTL = 3600  # 1 hour


def _get_cached(key: str):
    if key in _cache:
        entry = _cache[key]
        if datetime.now() < entry["expires"]:
            return entry["data"]
        del _cache[key]
    return None


def _set_cache(key: str, data, ttl: int = _CACHE_TTL):
    _cache[key] = {"data": data, "expires": datetime.now() + timedelta(seconds=ttl)}


# ---------------------------------------------------------------------------
# Core: get upcoming events (curated + API supplements)
# ---------------------------------------------------------------------------

def get_upcoming_events(days_ahead: int = 30) -> list[dict]:
    """Return upcoming economic events within the next N days.

    Combines curated events with Alpha Vantage data when available.
    """
    cached = _get_cached(f"upcoming_events_{days_ahead}")
    if cached is not None:
        return cached

    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    lookback = today - timedelta(days=7)  # Include past 7 days
    cutoff = today + timedelta(days=days_ahead)

    events = []

    # 1. Curated events
    for e in CURATED_EVENTS:
        event_date = datetime.strptime(e["date"], "%Y-%m-%d")
        if lookback <= event_date <= cutoff:
            days_until = (event_date - today).days
            events.append({
                "date": e["date"],
                "event": e["event"],
                "impact": e["impact"],
                "category": e["category"],
                "source": "curated",
                "days_until": days_until,
                "passed": days_until < 0,
            })

    # 2. Supplement with Finnhub economic calendar
    finnhub_events = _fetch_finnhub_economic_calendar(lookback, cutoff)
    for fe in finnhub_events:
        # Deduplicate — skip if we already have a curated event on the same date with similar name
        is_dup = any(
            e["date"] == fe["date"] and _events_similar(e["event"], fe["event"])
            for e in events
        )
        if not is_dup:
            events.append(fe)

    # 3. Supplement with Alpha Vantage if key is available
    if ALPHA_VANTAGE_API_KEY:
        av_events = _fetch_alpha_vantage_events()
        for ae in av_events:
            event_date = datetime.strptime(ae["date"], "%Y-%m-%d")
            if lookback <= event_date <= cutoff:
                is_dup = any(
                    e["date"] == ae["date"] and _events_similar(e["event"], ae["event"])
                    for e in events
                )
                if not is_dup:
                    ae["days_until"] = (event_date - today).days
                    ae["passed"] = ae["days_until"] < 0
                    events.append(ae)

    # Sort by date
    events.sort(key=lambda e: e["date"])

    _set_cache(f"upcoming_events_{days_ahead}", events)
    return events


def get_events_for_stock(symbol: str, sector: str = None, days_ahead: int = 30) -> list[dict]:
    """Return economic events relevant to a specific stock.

    Relevance is determined by:
    - Index tickers (SPY, QQQ, etc.) → all events
    - Sector mapping → events matching sector's relevant categories
    - All stocks → FOMC (affects everything)
    """
    all_events = get_upcoming_events(days_ahead)

    # Index ETFs get everything
    if symbol.upper() in INDEX_TICKERS:
        return all_events

    # Determine relevant categories for this stock's sector
    relevant_cats = set()
    if sector:
        relevant_cats = set(SECTOR_EVENT_RELEVANCE.get(sector, []))

    # Every stock cares about FOMC and employment (market-wide impact)
    relevant_cats.add("fed")
    relevant_cats.add("employment")

    filtered = [e for e in all_events if e.get("category") in relevant_cats]
    return filtered


# ---------------------------------------------------------------------------
# Finnhub economic calendar
# ---------------------------------------------------------------------------

def _fetch_finnhub_economic_calendar(start: datetime, end: datetime) -> list[dict]:
    """Fetch economic calendar events from Finnhub."""
    if not FINNHUB_API_KEY:
        return []

    cached = _get_cached("finnhub_economic")
    if cached is not None:
        return cached

    try:
        resp = requests.get(
            "https://finnhub.io/api/v1/calendar/economic",
            params={
                "token": FINNHUB_API_KEY,
                "from": start.strftime("%Y-%m-%d"),
                "to": end.strftime("%Y-%m-%d"),
            },
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()

        events = []
        for item in data.get("economicCalendar", []):
            impact = _map_finnhub_impact(item.get("impact", 0))
            if impact in ("high", "medium"):
                today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
                event_date = datetime.strptime(item["date"], "%Y-%m-%d") if "date" in item else None
                days_until = (event_date - today).days if event_date else None
                events.append({
                    "date": item.get("date", ""),
                    "event": item.get("event", "Unknown Event"),
                    "impact": impact,
                    "category": _categorize_finnhub_event(item.get("event", "")),
                    "source": "finnhub",
                    "country": item.get("country", ""),
                    "actual": item.get("actual"),
                    "estimate": item.get("estimate"),
                    "prev": item.get("prev"),
                    "days_until": days_until,
                    "passed": days_until is not None and days_until < 0,
                })

        _set_cache("finnhub_economic", events, ttl=1800)  # 30 min cache
        return events
    except Exception as e:
        print(f"[EconCal] Finnhub economic calendar error: {e}")
        return []


def _map_finnhub_impact(impact_val) -> str:
    """Map Finnhub impact value (1-3) to our impact level."""
    if isinstance(impact_val, (int, float)):
        if impact_val >= 3:
            return "high"
        if impact_val >= 2:
            return "medium"
        return "low"
    return "medium"


def _categorize_finnhub_event(event_name: str) -> str:
    """Categorize a Finnhub event into our categories."""
    name = event_name.lower()
    if any(w in name for w in ["fomc", "interest rate", "federal reserve", "fed"]):
        return "fed"
    if any(w in name for w in ["cpi", "inflation", "pce", "consumer price"]):
        return "inflation"
    if any(w in name for w in ["nonfarm", "payroll", "unemployment", "jobless", "employment", "jobs"]):
        return "employment"
    if any(w in name for w in ["gdp", "gross domestic"]):
        return "gdp"
    if any(w in name for w in ["retail", "consumer"]):
        return "consumer"
    if any(w in name for w in ["housing", "home", "building"]):
        return "housing"
    return "other"


def _events_similar(name1: str, name2: str) -> bool:
    """Check if two event names are similar enough to be duplicates."""
    n1 = name1.lower()
    n2 = name2.lower()
    # Check for common keywords
    keywords = ["fomc", "cpi", "jobs report", "nonfarm", "gdp", "unemployment"]
    for kw in keywords:
        if kw in n1 and kw in n2:
            return True
    return False


# ---------------------------------------------------------------------------
# Alpha Vantage economic indicators
# ---------------------------------------------------------------------------

def _fetch_alpha_vantage_events() -> list[dict]:
    """Fetch upcoming Treasury Yield and economic indicator data from Alpha Vantage.

    Alpha Vantage doesn't have a traditional 'calendar' endpoint,
    but we can fetch the latest economic indicator values to supplement context.
    """
    if not ALPHA_VANTAGE_API_KEY:
        return []

    cached = _get_cached("alpha_vantage_events")
    if cached is not None:
        return cached

    events = []
    indicators = [
        ("FEDERAL_FUNDS_RATE", "Federal Funds Rate Update", "fed"),
        ("CPI", "CPI Data Release", "inflation"),
        ("UNEMPLOYMENT", "Unemployment Rate Update", "employment"),
        ("TREASURY_YIELD", "Treasury Yield Update", "fed"),
    ]

    for func, label, category in indicators:
        try:
            params = {"function": func, "apikey": ALPHA_VANTAGE_API_KEY}
            if func == "TREASURY_YIELD":
                params["maturity"] = "10year"
                params["interval"] = "monthly"
            elif func in ("CPI", "UNEMPLOYMENT"):
                params["interval"] = "monthly"

            resp = requests.get(
                "https://www.alphavantage.co/query",
                params=params,
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()

            # Alpha Vantage returns historical data — we extract the latest data point
            data_key = "data"
            if data_key in data and len(data[data_key]) > 0:
                latest = data[data_key][0]
                events.append({
                    "date": latest.get("date", ""),
                    "event": f"{label}: {latest.get('value', 'N/A')}",
                    "impact": "medium",
                    "category": category,
                    "source": "alpha_vantage",
                    "value": latest.get("value"),
                })
        except Exception as e:
            print(f"[EconCal] Alpha Vantage {func} error: {e}")

    _set_cache("alpha_vantage_events", events, ttl=3600)
    return events
