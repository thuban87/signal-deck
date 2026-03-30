"""Discovery engine — congressional trades, social momentum, options flow, insider scan."""

import re
import json
from datetime import datetime, timedelta
from typing import Optional

import requests as req
from bs4 import BeautifulSoup
import math


def _is_nan(val) -> bool:
    """Check if a value is NaN (handles float NaN from pandas)."""
    try:
        return val is None or (isinstance(val, float) and math.isnan(val))
    except (TypeError, ValueError):
        return val is None


# ---------------------------------------------------------------------------
# S&P 500 ticker list (cached in-memory)
# ---------------------------------------------------------------------------

_SP500_CACHE: list[str] | None = None


def get_sp500_tickers() -> list[str]:
    """Fetch the current S&P 500 component tickers from Wikipedia."""
    global _SP500_CACHE
    if _SP500_CACHE:
        return _SP500_CACHE
    try:
        resp = req.get(
            "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies",
            timeout=15,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        soup = BeautifulSoup(resp.text, "lxml")
        table = soup.find("table", {"id": "constituents"})
        if not table:
            return _SP500_FALLBACK
        rows = table.find_all("tr")[1:]
        tickers = []
        for row in rows:
            cols = row.find_all("td")
            if cols:
                ticker = cols[0].text.strip().replace(".", "-")
                tickers.append(ticker)
        _SP500_CACHE = tickers if tickers else _SP500_FALLBACK
        return _SP500_CACHE
    except Exception:
        return _SP500_FALLBACK


# Minimal fallback if Wikipedia is unreachable
_SP500_FALLBACK = [
    "AAPL", "MSFT", "AMZN", "NVDA", "GOOGL", "META", "TSLA", "BRK-B",
    "UNH", "JNJ", "JPM", "V", "XOM", "PG", "MA", "HD", "CVX", "MRK",
    "ABBV", "PEP", "KO", "COST", "AVGO", "LLY", "WMT", "MCD", "CSCO",
    "TMO", "ACN", "DHR", "ABT", "CRM", "ADBE", "AMD", "NFLX", "INTC",
    "NKE", "CMCSA", "TXN", "PM", "NEE", "HON", "UNP", "QCOM", "ORCL",
]


# ---------------------------------------------------------------------------
# Congressional Trades — Capitol Trades scraping
# ---------------------------------------------------------------------------

def fetch_congress_trades(pages: int = 3) -> list[dict]:
    """Scrape recent congressional stock trades from Capitol Trades."""
    all_trades = []
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
    }

    for page in range(1, pages + 1):
        try:
            url = f"https://www.capitoltrades.com/trades?page={page}"
            resp = req.get(url, timeout=15, headers=headers)
            if resp.status_code != 200:
                print(f"[Congress] Page {page} returned {resp.status_code}")
                continue

            soup = BeautifulSoup(resp.text, "lxml")

            # Capitol Trades uses a table with class "trades-table" or similar
            rows = soup.select("table tbody tr")
            if not rows:
                # Try alternate selector
                rows = soup.select(".trade-row, .q-tr")

            for row in rows:
                try:
                    trade = _parse_capitol_trade_row(row)
                    if trade and trade.get("ticker"):
                        all_trades.append(trade)
                except Exception:
                    continue
        except Exception as e:
            print(f"[Congress] Error fetching page {page}: {e}")

    # If Capitol Trades didn't work, try Senate EFDS
    if not all_trades:
        all_trades = _fetch_senate_efds()

    return all_trades


def _parse_capitol_trade_row(row) -> dict | None:
    """Parse a single trade row from Capitol Trades.

    Capitol Trades table structure (10 columns):
      td[0] = Politician (name + party + chamber embedded in text/child elements)
      td[1] = Traded Issuer (company name + ticker like "GEHC:US")
      td[2] = Published date
      td[3] = Traded date
      td[4] = Filed After (e.g. "days31")
      td[5] = Owner (e.g. "Undisclosed", "Spouse", "Joint")
      td[6] = Type (buy/sell)
      td[7] = Size range (e.g. "1K–15K")
      td[8] = Price
      td[9] = Link to detail page
    """
    cells = row.find_all("td")
    if len(cells) < 9:
        return None

    # --- Politician (td[0]) ---
    politician_link = cells[0].find("a")
    politician = politician_link.text.strip() if politician_link else ""
    if not politician:
        politician = cells[0].get_text(strip=True)

    # Party + chamber from the full cell text
    cell0_text = cells[0].get_text()
    party = ""
    if "Republican" in cell0_text:
        party = "R"
    elif "Democrat" in cell0_text:
        party = "D"
    elif "Independent" in cell0_text:
        party = "I"

    chamber = ""
    if "Senate" in cell0_text:
        chamber = "Senate"
    elif "House" in cell0_text:
        chamber = "House"

    # Clean politician name — remove party/chamber text that got concatenated
    for remove_word in ["Republican", "Democrat", "Independent", "House", "Senate"]:
        politician = politician.replace(remove_word, "")
    # Clean state codes (2 uppercase letters at the end)
    politician = re.sub(r'[A-Z]{2}$', '', politician).strip()

    # --- Traded Issuer (td[1]) — extract ticker ---
    issuer_link = cells[1].find("a")
    issuer_text = cells[1].get_text(strip=True)
    ticker = ""
    description = ""

    if ":US" in issuer_text:
        # Format: "Company NameTICKER:US" — extract ticker before :US
        before_suffix = issuer_text.split(":US")[0]
        # Walk backwards to find where the ticker starts (uppercase letters)
        i = len(before_suffix)
        while i > 0 and before_suffix[i - 1].isupper():
            i -= 1
        raw_ticker = before_suffix[i:]
        # Strip common company suffixes from the front (e.g. "INCGEHC" -> "GEHC")
        for suffix in ("INC", "CORP", "LTD", "LLC", "CO", "PLC", "LP", "NV", "SA", "SE", "AG"):
            if raw_ticker.startswith(suffix) and len(raw_ticker) > len(suffix):
                raw_ticker = raw_ticker[len(suffix):]
                break
        ticker = raw_ticker
        description = before_suffix[:len(before_suffix) - len(before_suffix[i:])].strip()
    else:
        # Fallback: standalone ticker at end after a lowercase char/space
        ticker_match = re.search(r'(?<=[a-z. ])([A-Z]{1,5})$', issuer_text)
        if ticker_match:
            ticker = ticker_match.group(1)
            description = issuer_text[:ticker_match.start()].strip()
    if not ticker:
        # Last resort: check href
        if issuer_link:
            href = issuer_link.get("href", "")
            href_match = re.search(r'/issuers/.*?([A-Z]{1,5})', href)
            if href_match:
                ticker = href_match.group(1)

    if not ticker or ticker in ("N", "NA"):
        return None

    # Skip treasury bills and similar non-stock instruments
    if "TREASURY" in issuer_text.upper() or "BOND" in issuer_text.upper():
        return None

    # --- Dates (td[2] published, td[3] traded) ---
    def _parse_capitol_date(text):
        """Parse dates like '27 Mar2026' or '27 Mar 2026'."""
        text = text.strip()
        # Insert space before 4-digit year if missing
        text = re.sub(r'(\w{3})(\d{4})', r'\1 \2', text)
        for fmt in ("%d %b %Y", "%d %B %Y", "%Y-%m-%d", "%m/%d/%Y"):
            try:
                return datetime.strptime(text, fmt).strftime("%Y-%m-%d")
            except ValueError:
                continue
        return ""

    disclosure_date = _parse_capitol_date(cells[2].get_text(strip=True))
    trade_date = _parse_capitol_date(cells[3].get_text(strip=True))

    # --- Trade type (td[6]) ---
    trade_type_text = cells[6].get_text(strip=True).lower()
    if "buy" in trade_type_text or "purchase" in trade_type_text:
        trade_type = "Buy"
    elif "sell" in trade_type_text or "sale" in trade_type_text:
        trade_type = "Sell"
    else:
        trade_type = trade_type_text.capitalize() or "Unknown"

    # --- Size / amount range (td[7]) ---
    amount_range = cells[7].get_text(strip=True)

    return {
        "politician": politician,
        "party": party,
        "chamber": chamber,
        "ticker": ticker,
        "trade_type": trade_type,
        "amount_range": amount_range,
        "trade_date": trade_date,
        "disclosure_date": disclosure_date,
        "description": description,
        "source_url": "https://www.capitoltrades.com/trades",
    }


def _fetch_senate_efds() -> list[dict]:
    """Fallback: Scrape from Senate Electronic Financial Disclosures."""
    trades = []
    try:
        # The Senate periodic transaction reports
        today = datetime.now()
        from_date = (today - timedelta(days=90)).strftime("%m/%d/%Y")
        to_date = today.strftime("%m/%d/%Y")

        resp = req.get(
            "https://efts.sec.gov/LATEST/search-index?q=*&dateRange=custom"
            f"&startdt={from_date}&enddt={to_date}&forms=4",
            timeout=15,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        # This is a simplified attempt — Senate EFDS is complex
        # If it fails, we return empty and rely on the caching mechanism
    except Exception as e:
        print(f"[Congress] Senate EFDS fallback failed: {e}")

    return trades


def aggregate_congress_trades(trades: list[dict]) -> dict:
    """Aggregate congressional trade data for summary stats."""
    ticker_counts: dict[str, dict] = {}

    for t in trades:
        ticker = t.get("ticker", "")
        if ticker not in ticker_counts:
            ticker_counts[ticker] = {
                "ticker": ticker,
                "buy_count": 0,
                "sell_count": 0,
                "politicians": set(),
                "parties": set(),
                "latest_date": "",
            }

        if t.get("trade_type") == "Buy":
            ticker_counts[ticker]["buy_count"] += 1
        else:
            ticker_counts[ticker]["sell_count"] += 1

        ticker_counts[ticker]["politicians"].add(t.get("politician", ""))
        if t.get("party"):
            ticker_counts[ticker]["parties"].add(t["party"])
        if t.get("trade_date", "") > ticker_counts[ticker]["latest_date"]:
            ticker_counts[ticker]["latest_date"] = t["trade_date"]

    # Convert sets to lists for JSON serialization
    popular = []
    for ticker, data in ticker_counts.items():
        data["politicians"] = list(data["politicians"])
        data["parties"] = list(data["parties"])
        data["total_trades"] = data["buy_count"] + data["sell_count"]
        data["politician_count"] = len(data["politicians"])
        popular.append(data)

    popular.sort(key=lambda x: x["total_trades"], reverse=True)

    return {
        "total_trades": len(trades),
        "unique_tickers": len(ticker_counts),
        "popular_tickers": popular[:20],
    }


# ---------------------------------------------------------------------------
# Social Momentum — Reddit via PRAW
# ---------------------------------------------------------------------------

def scan_reddit_mentions(
    subreddits: list[str] | None = None,
    mention_threshold: int = 5,
    post_limit: int = 100,
    client_id: str = "",
    client_secret: str = "",
    user_agent: str = "SignalDeck/1.0",
) -> list[dict]:
    """Scan Reddit for ticker mentions and sentiment."""
    if not client_id or not client_secret:
        print("[Social] PRAW credentials not configured, skipping Reddit scan")
        return []

    try:
        import praw
    except ImportError:
        print("[Social] praw not installed, skipping Reddit scan")
        return []

    if subreddits is None:
        subreddits = ["wallstreetbets", "stocks", "investing", "options"]

    try:
        reddit = praw.Reddit(
            client_id=client_id,
            client_secret=client_secret,
            user_agent=user_agent,
        )
    except Exception as e:
        print(f"[Social] Failed to initialize PRAW: {e}")
        return []

    # Ticker mention regex — $TICKER or standalone uppercase 1-5 letter words
    ticker_pattern = re.compile(r'\$([A-Z]{1,5})\b')
    # Common words to exclude
    NOISE_WORDS = {
        "I", "A", "AT", "BY", "DO", "GO", "IF", "IN", "IS", "IT", "MY", "NO",
        "OF", "ON", "OR", "SO", "TO", "UP", "US", "WE", "AN", "AM", "BE",
        "DD", "FD", "EPS", "CEO", "CFO", "CTO", "COO", "IMO", "YOLO", "WSB",
        "SEC", "FDA", "FED", "GDP", "ETF", "IPO", "OTC", "PE", "EPS", "ATH",
        "ATL", "EOD", "PM", "AH", "ALL", "ANY", "ARE", "BUT", "CAN", "DID",
        "FOR", "GET", "GOT", "HAS", "HAD", "HIS", "HER", "HOW", "ITS", "LET",
        "MAY", "NEW", "NOT", "NOW", "OLD", "ONE", "OUR", "OUT", "OWN", "PUT",
        "RUN", "SAY", "SHE", "THE", "TOO", "TRY", "TWO", "WAY", "WHO", "WHY",
        "WIN", "WON", "YES", "YET", "YOU", "BIG", "LOW", "RED", "TOP", "HIGH",
        "VERY", "JUST", "SOME", "WHAT", "WHEN", "WILL", "BEEN", "CALL", "LONG",
        "NEXT", "ONLY", "OVER", "SAME", "THAN", "THEM", "THEN", "THIS", "WANT",
        "WELL", "WITH", "LMAO", "EDIT", "LINK", "POST", "FREE",
    }

    ticker_mentions: dict[str, dict] = {}
    sentiment_analyzer = None
    try:
        from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
        sentiment_analyzer = SentimentIntensityAnalyzer()
    except ImportError:
        pass

    for sub_name in subreddits:
        try:
            subreddit = reddit.subreddit(sub_name)
            for post in subreddit.hot(limit=post_limit):
                text = f"{post.title} {post.selftext}"
                found_tickers = set(ticker_pattern.findall(text))

                for ticker in found_tickers:
                    if ticker in NOISE_WORDS:
                        continue
                    if ticker not in ticker_mentions:
                        ticker_mentions[ticker] = {
                            "ticker": ticker,
                            "mention_count": 0,
                            "subreddits": {},
                            "sentiments": [],
                            "sample_posts": [],
                        }

                    ticker_mentions[ticker]["mention_count"] += 1
                    sub_key = sub_name.lower()
                    ticker_mentions[ticker]["subreddits"][sub_key] = \
                        ticker_mentions[ticker]["subreddits"].get(sub_key, 0) + 1

                    # Sentiment on post title
                    if sentiment_analyzer and len(ticker_mentions[ticker]["sentiments"]) < 50:
                        scores = sentiment_analyzer.polarity_scores(post.title)
                        ticker_mentions[ticker]["sentiments"].append(scores["compound"])

                    # Sample posts (max 5)
                    if len(ticker_mentions[ticker]["sample_posts"]) < 5:
                        ticker_mentions[ticker]["sample_posts"].append({
                            "title": post.title[:200],
                            "subreddit": sub_name,
                            "score": post.score,
                            "url": f"https://reddit.com{post.permalink}",
                        })
        except Exception as e:
            print(f"[Social] Error scanning r/{sub_name}: {e}")

    # Convert to result list, filter by threshold
    results = []
    for ticker, data in ticker_mentions.items():
        if data["mention_count"] < mention_threshold:
            continue

        avg_sentiment = (
            round(sum(data["sentiments"]) / len(data["sentiments"]), 3)
            if data["sentiments"] else 0
        )
        sentiment_label = (
            "bullish" if avg_sentiment > 0.1
            else "bearish" if avg_sentiment < -0.1
            else "neutral"
        )

        results.append({
            "ticker": ticker,
            "source": "reddit",
            "subreddit": ", ".join(data["subreddits"].keys()),
            "mention_count": data["mention_count"],
            "sentiment_score": avg_sentiment,
            "sentiment_label": sentiment_label,
            "sample_posts": data["sample_posts"],
            "subreddit_breakdown": data["subreddits"],
        })

    results.sort(key=lambda x: x["mention_count"], reverse=True)
    return results


# ---------------------------------------------------------------------------
# Unusual Options Activity — via yfinance
# ---------------------------------------------------------------------------

def scan_options_flow(
    symbols: list[str],
    vol_oi_threshold: float = 500.0,
    premium_threshold: float = 1_000_000,
) -> list[dict]:
    """Scan options chains for unusual volume/OI ratios and high-dollar activity."""
    import yfinance as yf

    today = datetime.now().strftime("%Y-%m-%d")
    alerts = []

    for symbol in symbols:
        try:
            ticker = yf.Ticker(symbol)
            expirations = ticker.options
            if not expirations:
                continue

            # Get current price
            hist = ticker.history(period="1d")
            if hist.empty:
                continue
            underlying_price = float(hist.iloc[-1]["Close"])

            # Check first 3 expiration dates (nearest-term = most significant)
            for exp in expirations[:3]:
                try:
                    chain = ticker.option_chain(exp)
                except Exception:
                    continue

                for opt_type, df in [("call", chain.calls), ("put", chain.puts)]:
                    if df is None or df.empty:
                        continue

                    for _, row in df.iterrows():
                        try:
                            volume = int(row.get("volume", 0) or 0) if not _is_nan(row.get("volume")) else 0
                            oi = int(row.get("openInterest", 0) or 0) if not _is_nan(row.get("openInterest")) else 0
                            last_price = float(row.get("lastPrice", 0) or 0) if not _is_nan(row.get("lastPrice")) else 0.0
                            strike = float(row.get("strike", 0) or 0) if not _is_nan(row.get("strike")) else 0.0
                            iv = float(row.get("impliedVolatility", 0) or 0) if not _is_nan(row.get("impliedVolatility")) else 0.0
                        except (ValueError, TypeError):
                            continue

                        if oi == 0 or volume < 100:
                            continue

                        vol_oi_ratio = (volume / oi) * 100
                        premium_vol = volume * last_price * 100  # Each contract = 100 shares

                        is_unusual_ratio = vol_oi_ratio >= vol_oi_threshold
                        is_whale = premium_vol >= premium_threshold

                        if is_unusual_ratio or is_whale:
                            alerts.append({
                                "ticker": symbol,
                                "expiration": exp,
                                "strike": strike,
                                "option_type": opt_type,
                                "volume": volume,
                                "open_interest": oi,
                                "vol_oi_ratio": round(vol_oi_ratio, 1),
                                "implied_volatility": round(iv * 100, 1),
                                "premium_volume": round(premium_vol, 0),
                                "last_price": last_price,
                                "underlying_price": round(underlying_price, 2),
                                "scan_date": today,
                                "flags": [],
                            })

                            # Add flags
                            if is_unusual_ratio:
                                alerts[-1]["flags"].append(
                                    f"Vol/OI {vol_oi_ratio:.0f}%"
                                )
                            if is_whale:
                                alerts[-1]["flags"].append(
                                    f"${premium_vol:,.0f} premium"
                                )
        except Exception as e:
            print(f"[Options] Error scanning {symbol}: {e}")

    alerts.sort(key=lambda x: x.get("vol_oi_ratio", 0), reverse=True)
    return alerts


# ---------------------------------------------------------------------------
# Market-wide Insider Scan (extends existing OpenInsider scraper)
# ---------------------------------------------------------------------------

def scan_insider_market_wide(days: int = 7, min_value: float = 100_000) -> list[dict]:
    """Scan OpenInsider for notable insider buys across the whole market."""
    trades = []
    try:
        # Use OpenInsider's latest cluster buys page for significant insider activity
        urls = [
            "http://openinsider.com/screener?s=&o=&pl=&ph=&st=1&tdlt=&tdr="
            f"&tdfd=&tdfm=&tdfy=&tdt=&tdtm=&tdty=&f=&cnt=100",
        ]

        headers = {"User-Agent": "Mozilla/5.0"}

        for url in urls:
            resp = req.get(url, timeout=15, headers=headers)
            soup = BeautifulSoup(resp.text, "lxml")
            table = soup.find("table", {"class": "tinytable"})

            if not table:
                continue

            rows = table.find_all("tr")[1:]
            for row in rows:
                cols = row.find_all("td")
                if len(cols) < 13:
                    continue
                try:
                    # OpenInsider table has 17 columns; col[0] is an empty "X" link
                    # col[1]=filing_date  col[2]=trade_date  col[3]=ticker
                    # col[4]=company  col[5]=insider  col[6]=title
                    # col[7]=trade_type  col[8]=price  col[9]=qty
                    # col[10]=owned  col[11]=delta_own  col[12]=value
                    filing_date = cols[1].text.strip()
                    trade_date = cols[2].text.strip()
                    ticker = cols[3].text.strip().upper()
                    insider_name = cols[5].text.strip()
                    title = cols[6].text.strip()
                    trade_type_raw = cols[7].text.strip()
                    price = cols[8].text.strip()
                    qty = cols[9].text.strip()
                    owned = cols[10].text.strip()
                    delta_own = cols[11].text.strip()
                    value = cols[12].text.strip()

                    is_buy = "P" in trade_type_raw.upper()

                    # Parse value
                    val_clean = value.replace("$", "").replace(",", "").replace("+", "")
                    try:
                        val_num = float(val_clean)
                    except ValueError:
                        val_num = 0

                    if val_num < min_value:
                        continue

                    trades.append({
                        "ticker": ticker,
                        "insider": insider_name,
                        "title": title,
                        "type": "Buy" if is_buy else "Sell",
                        "price": price,
                        "qty": qty,
                        "value": value,
                        "value_numeric": val_num,
                        "trade_date": trade_date,
                        "filing_date": filing_date,
                    })
                except (IndexError, ValueError):
                    continue
    except Exception as e:
        print(f"[Insider] Market scan error: {e}")

    return trades


def aggregate_insider_scan(trades: list[dict]) -> dict:
    """Aggregate insider trades by ticker for the scan summary."""
    ticker_data: dict[str, dict] = {}

    for t in trades:
        ticker = t.get("ticker", "")
        if ticker not in ticker_data:
            ticker_data[ticker] = {
                "ticker": ticker,
                "buy_count": 0,
                "sell_count": 0,
                "total_buy_value": 0,
                "total_sell_value": 0,
                "insiders": [],
                "latest_date": "",
            }

        val = t.get("value_numeric", 0)
        if t.get("type") == "Buy":
            ticker_data[ticker]["buy_count"] += 1
            ticker_data[ticker]["total_buy_value"] += val
        else:
            ticker_data[ticker]["sell_count"] += 1
            ticker_data[ticker]["total_sell_value"] += val

        ticker_data[ticker]["insiders"].append({
            "name": t.get("insider"),
            "title": t.get("title"),
            "type": t.get("type"),
            "value": t.get("value"),
            "date": t.get("trade_date"),
        })

        if t.get("trade_date", "") > ticker_data[ticker]["latest_date"]:
            ticker_data[ticker]["latest_date"] = t["trade_date"]

    results = list(ticker_data.values())
    for r in results:
        r["net_value"] = r["total_buy_value"] - r["total_sell_value"]
        r["signal"] = "bullish" if r["net_value"] > 0 else "bearish" if r["net_value"] < 0 else "neutral"
        r["insider_count"] = len(set(i["name"] for i in r["insiders"]))

    results.sort(key=lambda x: x["total_buy_value"], reverse=True)
    return {
        "total_trades": len(trades),
        "unique_tickers": len(ticker_data),
        "tickers": results,
    }
