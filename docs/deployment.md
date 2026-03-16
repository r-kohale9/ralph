# Ralph Pipeline — Deployment Runbook

## Prerequisites

- Ubuntu 22.04+ or Debian 12+ VPS (Hetzner CX22 recommended, ~4 EUR/month)
- Node.js >= 20 (via NodeSource or nvm)
- Redis 7+
- Docker (for CLIProxyAPI)
- jq, curl, bash
- Playwright system dependencies

## First Deploy

### 1. System setup

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Redis
sudo apt-get install -y redis-server
sudo systemctl enable redis-server

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install system deps for Playwright
sudo npx playwright install-deps chromium

# Install jq
sudo apt-get install -y jq
```

### 2. Application setup

```bash
# Create ralph user
sudo useradd -m -s /bin/bash ralph
sudo su - ralph

# Clone repo
git clone <repo-url> /opt/ralph
cd /opt/ralph

# Install dependencies
npm ci --production

# Install Playwright browsers
npx playwright install chromium

# Create data directory
mkdir -p data

# Configure environment
cp .env.example .env
# Edit .env with your values:
#   GITHUB_WEBHOOK_SECRET=<from GitHub webhook settings>
#   SLACK_WEBHOOK_URL=<from Slack app>
#   PROXY_KEY=<your proxy API key>
#   NODE_ENV=production
```

### 3. CLIProxyAPI + Redis

```bash
# Configure proxy
cp config.yaml.example config.yaml
# Edit config.yaml with provider credentials

# Start services
docker compose up -d
```

### 4. systemd services

```bash
sudo cp systemd/ralph-server.service /etc/systemd/system/
sudo cp systemd/ralph-worker.service /etc/systemd/system/
sudo cp systemd/ralph-logrotate.conf /etc/logrotate.d/ralph

sudo systemctl daemon-reload
sudo systemctl enable ralph-server ralph-worker
sudo systemctl start ralph-server ralph-worker
```

### 5. Nginx reverse proxy (optional)

```nginx
server {
    listen 80;
    server_name ralph.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
    }
}
```

### 6. GitHub webhook

1. Go to your repo Settings → Webhooks → Add webhook
2. Payload URL: `https://ralph.yourdomain.com/webhook/github`
3. Content type: `application/json`
4. Secret: same value as `GITHUB_WEBHOOK_SECRET` in `.env`
5. Events: select "Just the push event"

### 7. Verify

```bash
# Health check
curl http://localhost:3000/health

# View logs
sudo journalctl -u ralph-server -f
sudo journalctl -u ralph-worker -f

# Trigger manual build
curl -X POST http://localhost:3000/api/build \
  -H 'Content-Type: application/json' \
  -d '{"gameId": "doubles"}'
```

## Updates

```bash
cd /opt/ralph
git pull origin main
npm ci --production
sudo systemctl restart ralph-server ralph-worker
```

## Troubleshooting

### Server won't start

```bash
# Check logs
sudo journalctl -u ralph-server --since "5 min ago"

# Common: missing GITHUB_WEBHOOK_SECRET in production
# Fix: set NODE_ENV=production and GITHUB_WEBHOOK_SECRET in .env

# Common: Redis not running
redis-cli ping
sudo systemctl start redis-server
```

### Builds stuck in queue

```bash
# Check worker logs
sudo journalctl -u ralph-worker --since "30 min ago"

# Check queue depth
curl http://localhost:3000/health | jq '.queue'

# Restart worker
sudo systemctl restart ralph-worker
```

### LLM calls failing

```bash
# Test proxy connectivity
curl -s http://localhost:8080/health

# Check proxy logs
docker compose logs cliproxyapi --tail=50

# Test LLM call
curl -X POST http://localhost:8080/v1/messages \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: your-key' \
  -d '{"model":"claude-sonnet-4-6","max_tokens":100,"messages":[{"role":"user","content":"Hi"}]}'
```

### Database issues

```bash
# Check DB size
ls -lh data/builds.db

# Query recent builds
sqlite3 data/builds.db "SELECT id, game_id, status, completed_at FROM builds ORDER BY id DESC LIMIT 10;"

# Check WAL file size (should be small, auto-checkpointed)
ls -lh data/builds.db-wal
```

### Disk space

```bash
# Check usage
df -h /opt/ralph

# Clean old logs
sudo journalctl --vacuum-time=7d

# Clean old Playwright artifacts
rm -rf /opt/ralph/repo/game-spec/templates/*/game/test-results/
```
