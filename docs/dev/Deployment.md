# Signal Deck — Deployment Guide

## Local Development (Windows)

```bash
# From project root
pip install -r requirements.txt

# Copy and edit env file
cp .env.example .env
# Edit .env with your credentials

# Run the server
cd backend
python server.py
# Opens at http://localhost:8000
```

## Production Deployment (Linux + Nginx)

### 1. Clone the repo on your server

```bash
cd /opt
git clone <your-repo-url> trading-dashboard
cd trading-dashboard
```

### 2. Set up Python environment

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Create production .env

```bash
cp .env.example .env
nano .env
```

**Important settings for production:**
```
AUTH_USERNAME=your_username
AUTH_PASSWORD=a_strong_password_here
JWT_SECRET=generate-a-random-64-char-string
SERVER_HOST=127.0.0.1
SERVER_PORT=8000
ALPACA_API_KEY=your_key
ALPACA_SECRET_KEY=your_secret
```

Generate a secure JWT secret:
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### 4. Create systemd service

```bash
sudo nano /etc/systemd/system/signal-deck.service
```

```ini
[Unit]
Description=Signal Deck Trading Dashboard
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/trading-dashboard/backend
Environment=PATH=/opt/trading-dashboard/venv/bin
ExecStart=/opt/trading-dashboard/venv/bin/uvicorn server:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable signal-deck
sudo systemctl start signal-deck
sudo systemctl status signal-deck
```

### 5. Nginx configuration

```bash
sudo nano /etc/nginx/sites-available/signal-deck
```

```nginx
server {
    listen 80;
    server_name your-domain.com;  # or your server IP

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support (for future real-time features)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/signal-deck /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. HTTPS (recommended for remote access)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 7. Updating

```bash
cd /opt/trading-dashboard
git pull
sudo systemctl restart signal-deck
```
