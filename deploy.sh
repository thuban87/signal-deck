#!/bin/bash
# Signal Deck — deployment script (runs on the server)
set -e

APP_DIR="/opt/signal-deck"
VENV="$APP_DIR/venv"
SERVICE="signal-deck"

echo "=== Signal Deck Deploy ==="

cd "$APP_DIR"

echo "[1/5] Pulling latest from main..."
git pull origin main

if [ ! -d "$VENV" ]; then
    echo "[2/5] Creating venv + installing dependencies..."
    python3 -m venv "$VENV"
else
    echo "[2/5] Installing/updating dependencies..."
fi
source "$VENV/bin/activate"
pip install -q -r requirements.txt

echo "[3/5] Building React frontend..."
cd "$APP_DIR/frontend-react"
npm ci --silent
npm run build
cd "$APP_DIR"

echo "[4/5] Restarting service..."
sudo systemctl restart "$SERVICE"

echo "[5/5] Checking status..."
sleep 2
sudo systemctl status "$SERVICE" --no-pager -l

echo ""
echo "=== Deploy complete ==="
