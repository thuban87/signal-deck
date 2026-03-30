# Signal Deck — Deployment Guide

## Architecture

```
Internet → Cloudflare (DNS proxy + SSL) → Your server :443
  → Nginx (terminates SSL with Cloudflare origin cert)
    → reverse proxy → uvicorn :8005
```

Domain: `signal-deck.bradwales.com` (A record → external IP, proxied by Cloudflare)

---

## Local Development (Windows)

```bash
pip install -r requirements.txt
cp .env.example .env   # edit with your credentials
cd backend && python server.py
# Opens at http://localhost:8005
```

---

## Production Setup (Linux + Nginx + Cloudflare)

### 1. Clone the repo

```bash
cd /opt
git clone <your-repo-url> signal-deck
cd signal-deck
```

### 2. Python environment

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Production `.env`

```bash
cp .env.example .env
nano .env
```

#### Generate a hashed password

Use the helper script so the password is never stored in plaintext:

```bash
source /opt/signal-deck/venv/bin/activate
python backend/hash_password.py
# Enter your password at the prompt
# Copy the output into .env
```

#### Generate a JWT secret

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

#### Key `.env` settings

```
AUTH_USERNAME=your_username
AUTH_PASSWORD=$2b$12$...the-bcrypt-hash-from-above...
JWT_SECRET=<64-char-random-hex>
SERVER_HOST=127.0.0.1
SERVER_PORT=8005
ALPACA_API_KEY=your_key
ALPACA_SECRET_KEY=your_secret
FINNHUB_API_KEY=your_key
```

> The login endpoint supports both bcrypt-hashed and plaintext passwords.
> Always use a hashed password in production.

### 4. systemd service

```bash
sudo nano /etc/systemd/system/signal-deck.service
```

```ini
[Unit]
Description=Signal Deck Trading Dashboard
After=network.target

[Service]
Type=simple
User=bwales
WorkingDirectory=/opt/signal-deck/backend
Environment=PATH=/opt/signal-deck/venv/bin
ExecStart=/opt/signal-deck/venv/bin/uvicorn server:app --host 127.0.0.1 --port 8005
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

### 5. Cloudflare origin certificate (HTTPS)

You should already have your Cloudflare origin cert files. Copy them to the server:

```bash
sudo mkdir -p /etc/ssl/cloudflare
sudo cp origin.pem /etc/ssl/cloudflare/signal-deck.pem
sudo cp origin.key /etc/ssl/cloudflare/signal-deck.key
sudo chmod 600 /etc/ssl/cloudflare/signal-deck.key
```

### 6. Nginx configuration

```bash
sudo nano /etc/nginx/sites-available/signal-deck
```

```nginx
server {
    listen 443 ssl;
    server_name signal-deck.bradwales.com;

    ssl_certificate     /etc/ssl/cloudflare/signal-deck.pem;
    ssl_certificate_key /etc/ssl/cloudflare/signal-deck.key;

    location / {
        proxy_pass http://127.0.0.1:8005;
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

# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name signal-deck.bradwales.com;
    return 301 https://$host$request_uri;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/signal-deck /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

> **Cloudflare SSL mode:** Set to **Full (strict)** in the Cloudflare dashboard
> (SSL/TLS → Overview) since you're using a valid origin certificate.

---

## Deploying Updates

### From your Windows machine

```
deploy.bat
```

This SSHs into the server and runs `deploy.sh`, which:
1. Pulls latest from `main`
2. Installs/updates pip dependencies
3. Restarts the `signal-deck` systemd service
4. Prints service status

### Manually on the server

```bash
cd /opt/signal-deck
git pull origin main
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart signal-deck
```
