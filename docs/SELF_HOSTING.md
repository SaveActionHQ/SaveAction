# Self-Hosting Guide

> Complete guide for deploying and operating SaveAction on your own infrastructure.

## Table of Contents

- [Overview](#overview)
- [System Requirements](#system-requirements)
- [Deployment Options](#deployment-options)
- [Quick Start (Docker Compose)](#quick-start-docker-compose)
- [Environment Configuration](#environment-configuration)
- [TLS / HTTPS Setup](#tls--https-setup)
- [Database Management](#database-management)
- [Backup & Restore](#backup--restore)
- [Scaling](#scaling)
- [Monitoring & Observability](#monitoring--observability)
- [Security Hardening](#security-hardening)
- [Upgrading](#upgrading)
- [Disaster Recovery](#disaster-recovery)
- [Resource Planning](#resource-planning)
- [FAQ](#faq)
- [Troubleshooting](#troubleshooting)

---

## Overview

SaveAction is designed for self-hosted deployment. You own your data and infrastructure — no SaaS dependency. The platform runs as 6 Docker containers:

| Service | Purpose | Resource Profile |
|---------|---------|-----------------|
| **PostgreSQL 16** | Primary database | Low–Medium |
| **Redis 7** | Job queue + cache | Low |
| **API** (Fastify) | REST API server | Low |
| **Worker** (Playwright) | Test executor | **High** (browsers) |
| **Web** (Next.js) | Dashboard UI | Low |
| **Nginx** | Reverse proxy | Minimal |

The **Worker** is the most resource-intensive service — it launches real browsers (Chromium, Firefox, WebKit) to execute test recordings.

---

## System Requirements

### Minimum (small team, 1–5 users)

| Resource | Specification |
|----------|--------------|
| **CPU** | 2 cores |
| **RAM** | 4 GB |
| **Disk** | 20 GB SSD |
| **OS** | Linux (Ubuntu 22.04+, Debian 12+), or any Docker-compatible OS |
| **Docker** | 24.0+ with Compose v2 |

### Recommended (medium team, 5–20 users)

| Resource | Specification |
|----------|--------------|
| **CPU** | 4+ cores |
| **RAM** | 8 GB |
| **Disk** | 50 GB SSD |
| **OS** | Ubuntu 22.04 LTS / Debian 12 |
| **Docker** | 24.0+ with Compose v2 |

### Production (large team, 20+ users, heavy test load)

| Resource | Specification |
|----------|--------------|
| **CPU** | 8+ cores |
| **RAM** | 16+ GB |
| **Disk** | 100+ GB SSD (videos/screenshots accumulate) |
| **OS** | Ubuntu 22.04 LTS |
| **Docker** | 24.0+ with Compose v2 |

> **Rule of thumb:** Each concurrent browser test uses ~500 MB RAM. With default `WORKER_CONCURRENCY=3` and 1 worker container, plan for 2 GB just for Playwright browsers.

---

## Deployment Options

### Option 1: Docker Compose (Recommended)

Best for: Single-server deployments, VPS, bare metal.

Everything runs on one machine via `docker compose`. This is the officially supported method and what this guide covers in detail.

### Option 2: Manual (without Docker)

Best for: When Docker isn't available or you want to manage services individually.

You'll need to install and manage separately:
- Node.js 22+
- PostgreSQL 16+
- Redis 7+
- Playwright system dependencies
- A reverse proxy (Nginx, Caddy, etc.)

See [Manual Installation](#manual-installation-without-docker) at the end of this guide.

### Option 3: Kubernetes

The architecture is Kubernetes-ready (stateless services, Redis coordination, health probes). However, official Helm charts are not available yet. Key considerations:

- API and Web are stateless — scale freely with Deployments
- Workers are stateless — scale with Deployments (each pod needs 2 GB+ RAM and `shm_size: 1G`)
- PostgreSQL and Redis should use managed services (RDS, ElastiCache) or StatefulSets
- Videos/screenshots need a shared volume (PVC with ReadWriteMany) or object storage (S3)
- Run database migrations via an init-container or Job, not on API startup

---

## Quick Start (Docker Compose)

### Prerequisites

Install Docker and Docker Compose v2:

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in for group change

# Verify
docker --version    # 24.0+
docker compose version  # v2.x
```

### Step 1: Get the code

```bash
git clone https://github.com/SaveActionHQ/SaveAction.git
cd SaveAction
```

### Step 2: Configure environment

```bash
cp .env.production.example .env
```

Edit `.env` and set secure values:

```bash
# Generate secure secrets
openssl rand -base64 48   # Use output for JWT_SECRET
openssl rand -base64 48   # Use output for JWT_REFRESH_SECRET
openssl rand -base64 32   # Use output for DB_PASSWORD
openssl rand -base64 32   # Use output for REDIS_PASSWORD
```

**Minimum required changes in `.env`:**

```env
DB_PASSWORD=<generated-strong-password>
REDIS_PASSWORD=<generated-strong-password>
JWT_SECRET=<generated-string-at-least-32-chars>
JWT_REFRESH_SECRET=<generated-different-string-at-least-32-chars>
APP_BASE_URL=https://saveaction.yourcompany.com
```

### Step 3: Build and start

```bash
# Build all Docker images (first time takes 5–10 minutes)
docker compose build

# Start all services in background
docker compose up -d

# Watch startup progress
docker compose logs -f
```

### Step 4: Verify deployment

```bash
# Check all services are healthy
docker compose ps

# Test API health
curl http://localhost/health/live
# → {"status":"ok"}

# Detailed health check
curl http://localhost/health/detailed
# → Shows status of API, PostgreSQL, Redis, BullMQ
```

Open `http://your-server` in a browser. You should see the SaveAction login page. Register your first account to get started.

---

## Environment Configuration

All configuration is done through the `.env` file. The complete reference:

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_PASSWORD` | PostgreSQL password | `xK9mQ2...` |
| `JWT_SECRET` | JWT signing key (≥32 chars) | `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | Refresh token key (≥32 chars) | `openssl rand -base64 48` |

### Application Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_USER` | `saveaction` | PostgreSQL username |
| `DB_NAME` | `saveaction` | PostgreSQL database name |
| `REDIS_PASSWORD` | _(none)_ | Redis password (strongly recommended) |
| `CORS_ORIGIN` | `*` | Allowed origins. Set to your domain in production: `https://saveaction.example.com` |
| `LOG_LEVEL` | `info` | Logging verbosity: `debug`, `info`, `warn`, `error` |
| `APP_BASE_URL` | `http://localhost` | Public URL of your instance (used in password reset emails) |
| `WORKER_CONCURRENCY` | `3` | Concurrent test executions per worker container |
| `PORT` | `80` | External port exposed by Nginx |
| `NEXT_PUBLIC_API_URL` | `/api` | API URL as seen by the browser (leave as `/api` when using Nginx) |

### Email (SMTP) — Optional

Required only for password reset functionality:

| Variable | Default | Description |
|----------|---------|-------------|
| `SMTP_HOST` | — | SMTP server hostname (e.g., `smtp.gmail.com`) |
| `SMTP_PORT` | `587` | SMTP port (`587` for STARTTLS, `465` for SSL) |
| `SMTP_SECURE` | `false` | `true` for port 465 (SSL), `false` for 587 (STARTTLS) |
| `SMTP_USER` | — | SMTP authentication username |
| `SMTP_PASS` | — | SMTP authentication password |
| `SMTP_FROM` | — | Sender email address |
| `SMTP_FROM_NAME` | `SaveAction` | Sender display name |

**Common SMTP providers:**

| Provider | Host | Port | Notes |
|----------|------|------|-------|
| Gmail | `smtp.gmail.com` | 587 | Requires [App Password](https://support.google.com/accounts/answer/185833) |
| Outlook | `smtp.office365.com` | 587 | |
| AWS SES | `email-smtp.us-east-1.amazonaws.com` | 587 | Requires SES credentials |
| Mailgun | `smtp.mailgun.org` | 587 | |
| SendGrid | `smtp.sendgrid.net` | 587 | Username is `apikey` |

---

## TLS / HTTPS Setup

**Production deployments must use HTTPS.** API tokens and passwords are transmitted over the wire — plaintext HTTP is not acceptable.

### Option A: Caddy (Simplest — automatic HTTPS)

[Caddy](https://caddyserver.com/) automatically provisions and renews Let's Encrypt certificates.

1. Install Caddy on the host:
```bash
sudo apt install -y caddy
```

2. Set `PORT=8080` in `.env` (Nginx listens internally, Caddy handles external traffic):
```env
PORT=8080
```

3. Create `/etc/caddy/Caddyfile`:
```caddy
saveaction.yourcompany.com {
    reverse_proxy localhost:8080
}
```

4. Restart Caddy:
```bash
sudo systemctl restart caddy
```

5. Update `.env`:
```env
APP_BASE_URL=https://saveaction.yourcompany.com
```

6. Rebuild and restart:
```bash
docker compose up -d
```

That's it. Caddy handles certificate provisioning, renewal, and HTTP→HTTPS redirect automatically.

### Option B: Let's Encrypt with Certbot + Nginx

1. Install Certbot on the host:
```bash
sudo apt install -y certbot
```

2. Stop Nginx container temporarily (Certbot needs port 80):
```bash
docker compose stop nginx
```

3. Get certificate:
```bash
sudo certbot certonly --standalone -d saveaction.yourcompany.com
```

4. Create an SSL-enabled Nginx config. Replace `docker/nginx/nginx.conf`:

```nginx
upstream api {
    server api:3001;
}

upstream web {
    server web:3000;
}

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name saveaction.yourcompany.com;
    return 301 https://$host$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name saveaction.yourcompany.com;

    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # HSTS (enable after confirming HTTPS works)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml image/svg+xml;

    client_max_body_size 50m;

    # API
    location /api/ {
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 300s;
    }

    # SSE (run progress streaming)
    location ~ ^/api/v1/runs/.*/progress/stream$ {
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # Health checks
    location /health/ {
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # Static assets
    location /_next/static/ {
        proxy_pass http://web;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }

    # Web UI
    location / {
        proxy_pass http://web;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

5. Mount certificates in `docker-compose.yml` (add to nginx service):
```yaml
nginx:
  volumes:
    - ./docker/nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    - /etc/letsencrypt/live/saveaction.yourcompany.com/fullchain.pem:/etc/nginx/certs/fullchain.pem:ro
    - /etc/letsencrypt/live/saveaction.yourcompany.com/privkey.pem:/etc/nginx/certs/privkey.pem:ro
  ports:
    - "80:80"
    - "443:443"
```

6. Set up auto-renewal (crontab):
```bash
# crontab -e
0 3 * * * certbot renew --quiet --deploy-hook "docker compose -f /path/to/SaveAction/docker-compose.yml restart nginx"
```

### Option C: Cloud Load Balancer

If running on AWS/GCP/Azure, use the cloud provider's load balancer for TLS termination. Remove the Nginx container and expose API/Web directly:

```yaml
# Modified docker-compose.yml services
api:
  ports:
    - "3001:3001"
web:
  ports:
    - "3000:3000"
```

Configure the load balancer to route:
- `/api/*` → port 3001
- `/*` → port 3000

---

## Database Management

### Automatic Migrations

Database migrations run automatically when the API container starts. Drizzle ORM detects pending migrations from the `packages/api/drizzle/` folder and applies them.

No manual migration steps needed for normal operation.

### Manual Migration

If you need to run migrations manually:

```bash
# Run migrations inside the API container
docker compose exec api node -e "
  import('./packages/api/dist/db/index.js')
    .then(m => m.runMigrations?.())
    .then(() => console.log('Done'))
    .catch(e => console.error(e))
"

# Or simply restart the API (migrations run on startup)
docker compose restart api
```

### Database Shell

```bash
# Connect to PostgreSQL
docker compose exec postgres psql -U saveaction -d saveaction

# Common queries
SELECT count(*) FROM users;
SELECT count(*) FROM recordings;
SELECT id, status, browser, duration FROM runs ORDER BY created_at DESC LIMIT 10;
```

### Schema Inspection

```bash
# List all tables
docker compose exec postgres psql -U saveaction -d saveaction -c "\dt"

# Describe a table
docker compose exec postgres psql -U saveaction -d saveaction -c "\d runs"
```

---

## Backup & Restore

### PostgreSQL Backup

**Manual backup:**
```bash
# Create a compressed backup
docker compose exec -T postgres pg_dump -U saveaction saveaction | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Backup specific tables
docker compose exec -T postgres pg_dump -U saveaction -t recordings -t runs saveaction > partial_backup.sql
```

**Automated daily backups (recommended):**

Create a backup script at `/opt/saveaction/backup.sh`:

```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/opt/saveaction/backups"
RETENTION_DAYS=7
COMPOSE_DIR="/path/to/SaveAction"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Database backup
cd "$COMPOSE_DIR"
docker compose exec -T postgres pg_dump -U saveaction saveaction \
  | gzip > "$BACKUP_DIR/db_${TIMESTAMP}.sql.gz"

# Storage backup (videos + screenshots)
docker run --rm \
  -v saveaction_storage-data:/data:ro \
  -v "$BACKUP_DIR":/backup \
  alpine tar czf "/backup/storage_${TIMESTAMP}.tar.gz" /data

# Clean old backups
find "$BACKUP_DIR" -name "db_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
find "$BACKUP_DIR" -name "storage_*.tar.gz" -mtime +${RETENTION_DAYS} -delete

echo "[$(date)] Backup completed: db_${TIMESTAMP}.sql.gz"
```

Add to crontab:
```bash
chmod +x /opt/saveaction/backup.sh

# Run daily at 2:00 AM
crontab -e
0 2 * * * /opt/saveaction/backup.sh >> /var/log/saveaction-backup.log 2>&1
```

### Restore from Backup

**Database restore:**
```bash
# Stop API and worker (prevent writes during restore)
docker compose stop api worker

# Restore from backup
gunzip -c backup_20260221_020000.sql.gz | docker compose exec -T postgres psql -U saveaction saveaction

# Restart services
docker compose up -d
```

**Storage restore (videos/screenshots):**
```bash
docker compose stop api worker

docker run --rm \
  -v saveaction_storage-data:/data \
  -v /opt/saveaction/backups:/backup \
  alpine sh -c "cd / && tar xzf /backup/storage_20260221_020000.tar.gz"

docker compose up -d
```

### Backup Verification

Periodically test your backups:

```bash
# Restore to a temporary database
docker run --rm -d --name pg-test \
  -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test \
  postgres:16-alpine

# Wait for startup
sleep 5

# Restore
gunzip -c backup_20260221_020000.sql.gz | docker exec -i pg-test psql -U test test

# Verify
docker exec pg-test psql -U test test -c "SELECT count(*) FROM users;"
docker exec pg-test psql -U test test -c "SELECT count(*) FROM recordings;"

# Cleanup
docker stop pg-test
```

---

## Scaling

### Scaling Workers

Workers are the primary scalability lever. Each worker runs Playwright browsers — which are CPU and RAM intensive.

```bash
# Scale to 4 worker containers
docker compose up -d --scale worker=4

# Check status
docker compose ps worker
```

**Capacity planning:**

| Workers | Concurrency | Total Parallel Tests | RAM Needed |
|---------|-------------|---------------------|------------|
| 1 | 3 | 3 | ~4 GB |
| 2 | 3 | 6 | ~6 GB |
| 4 | 3 | 12 | ~10 GB |
| 4 | 5 | 20 | ~14 GB |

> Formula: RAM ≈ 2 GB (base) + (workers × concurrency × 500 MB)

Adjust concurrency per worker:
```env
# In .env
WORKER_CONCURRENCY=5  # More tests per worker (needs more RAM per worker)
```

### Scaling the API

The API is stateless and lightweight. Scale only if you have very high HTTP request volume:

```bash
docker compose up -d --scale api=2
```

Docker Compose's built-in DNS resolves `api` to all instances, so Nginx automatically load-balances.

### When to Scale Vertically vs. Horizontally

| Symptom | Action |
|---------|--------|
| Tests queuing up, workers busy | Add more worker containers |
| Workers OOM-killed | Increase memory limit or reduce `WORKER_CONCURRENCY` |
| API slow under load | Scale API containers |
| Database queries slow | Add PostgreSQL read replicas or upgrade hardware |
| Redis memory full | Increase Redis `maxmemory` or upgrade instance |

---

## Monitoring & Observability

### Health Endpoints

| Endpoint | Purpose | Use For |
|----------|---------|---------|
| `GET /health/live` | Is the process alive? | Kubernetes liveness probe, uptime monitors |
| `GET /health/ready` | Can it serve requests? (DB + Redis connected) | Kubernetes readiness probe |
| `GET /health/detailed` | Full dependency status with latency | Dashboards, debugging |
| `GET /api/queues/status` | Job queue sizes and worker status | Queue monitoring |

### External Monitoring

Set up a simple uptime check:

```bash
# UptimeRobot, Pingdom, or similar
# Monitor: https://saveaction.yourcompany.com/health/live
# Expected: HTTP 200 with {"status":"ok"}
# Check interval: 60 seconds
```

### Log Aggregation

Logs are written to stdout/stderr in JSON format (production mode). Use Docker log drivers to ship to your preferred logging backend:

```yaml
# docker-compose.yml - add to any service
services:
  api:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

Or use a sidecar/log forwarder (Fluentd, Filebeat, Vector) for centralized logging.

### Key Metrics to Watch

| Metric | How to Check | Warning Threshold |
|--------|-------------|-------------------|
| Container health | `docker compose ps` | Any unhealthy |
| Memory usage | `docker stats` | >80% of limit |
| Disk usage | `df -h` | >80% |
| Queue depth | `curl /api/queues/status` | >50 waiting jobs |
| Failed runs | Database query | Unusual spike |
| API response time | `/health/detailed` | >500ms DB latency |

### Monitoring Script

Create a simple health check script at `/opt/saveaction/healthcheck.sh`:

```bash
#!/bin/bash
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health/ready)

if [ "$HEALTH" != "200" ]; then
    echo "[$(date)] ALERT: SaveAction health check failed (HTTP $HEALTH)" | \
        mail -s "SaveAction Down" admin@yourcompany.com
fi
```

Run it periodically:
```bash
# crontab -e
*/5 * * * * /opt/saveaction/healthcheck.sh
```

---

## Security Hardening

### 1. Network Isolation

By default, all services communicate on a Docker bridge network. Only Nginx is exposed to the host.

```bash
# Verify: only port 80 (or 443) is exposed
docker compose ps --format "table {{.Name}}\t{{.Ports}}"
# Only nginx should show 0.0.0.0:80->80/tcp
```

Do NOT expose PostgreSQL (5432) or Redis (6379) ports to the host unless you specifically need external access.

### 2. Strong Passwords

Use generated passwords for all secrets:

```bash
# For each secret in .env
openssl rand -base64 48
```

Never use default or weak passwords in production.

### 3. CORS Configuration

Restrict CORS to your domain:

```env
CORS_ORIGIN=https://saveaction.yourcompany.com
```

Do not use `CORS_ORIGIN=*` in production unless you have a specific reason.

### 4. Rate Limiting

Rate limiting is enabled by default:
- **100 req/min** for unauthenticated requests
- **200 req/min** for authenticated requests
- **20 req/min** for auth endpoints (login, register)

These are reasonable defaults. Adjust in API source code if needed.

### 5. Firewall

Configure your server firewall to allow only necessary ports:

```bash
# UFW (Ubuntu)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp     # HTTP (redirect to HTTPS)
sudo ufw allow 443/tcp    # HTTPS
sudo ufw enable
```

### 6. Keep Images Updated

Regularly update base images:

```bash
docker compose pull postgres redis
docker compose build --pull
docker compose up -d
```

### 7. Non-Root Containers

The API/Worker containers run as a non-root `saveaction` user (UID 1001). The Web container uses the Next.js default non-root user. This is already configured in the Dockerfiles.

---

## Upgrading

### Standard Upgrade

```bash
cd /path/to/SaveAction

# Pull latest code
git fetch origin
git pull origin main

# Rebuild images
docker compose build

# Apply update (containers recreated with new images)
docker compose up -d

# Verify
docker compose ps
curl http://localhost/health/detailed
```

Database migrations run automatically on API startup — schema changes are applied during the upgrade.

### Rolling Upgrade (Minimal Downtime)

```bash
# Build new images
docker compose build

# Restart services one at a time
docker compose up -d --force-recreate --no-deps worker    # Workers first (finish running tests)
docker compose up -d --force-recreate --no-deps api       # Then API
docker compose up -d --force-recreate --no-deps web       # Then Web
docker compose up -d --force-recreate --no-deps nginx     # Then Nginx
```

### Rollback

If an upgrade causes issues:

```bash
# Revert code
git checkout <previous-tag-or-commit>

# Rebuild and restart
docker compose build
docker compose up -d
```

> **Note:** Database rollback is not automatic. If a migration created new tables/columns, they remain in the database (forward-compatible). If a migration is destructive, restore from backup.

---

## Disaster Recovery

### Complete Data Loss

If you lose the server but have backups:

1. Provision a new server with Docker installed
2. Clone the repo and copy your `.env` file
3. Build and start services
4. Restore the database backup
5. Restore the storage volume backup

```bash
# 1-2. Setup
git clone https://github.com/SaveActionHQ/SaveAction.git
cd SaveAction
cp /path/to/saved/.env .env
docker compose build

# 3. Start infrastructure only
docker compose up -d postgres redis
sleep 10  # Wait for healthy

# 4. Restore database
gunzip -c /path/to/backup/db_latest.sql.gz | docker compose exec -T postgres psql -U saveaction saveaction

# 5. Start remaining services
docker compose up -d

# 6. Restore storage (optional — only if you need old videos/screenshots)
docker run --rm \
  -v saveaction_storage-data:/data \
  -v /path/to/backup:/backup \
  alpine sh -c "cd / && tar xzf /backup/storage_latest.tar.gz"
```

### Volume Data Loss (Containers Fine)

If a Docker volume is corrupted but containers are running:

```bash
docker compose stop
docker volume rm saveaction_postgres-data  # Only if corrupted

docker compose up -d postgres
sleep 10

# Restore from backup
gunzip -c backup_latest.sql.gz | docker compose exec -T postgres psql -U saveaction saveaction

docker compose up -d
```

---

## Resource Planning

### Disk Space

| Source | Growth Rate | Notes |
|--------|-------------|-------|
| PostgreSQL | ~1 MB/1000 runs | Metadata, action results |
| Videos | ~5 MB per test run | WebM format, auto-cleanup after 30 days |
| Screenshots | ~200 KB per action | PNG format, auto-cleanup after 30 days |
| Docker images | ~8 GB (API), ~100 MB (Web) | One-time |
| Redis | ~50 MB | In-memory, bounded by `maxmemory` |

**Automatic cleanup:** The worker runs daily cleanup jobs:
- Videos older than 30 days are deleted (daily at 3:00 AM)
- Screenshots older than 30 days are deleted (daily at 3:30 AM)
- Orphaned runs are marked as failed (hourly)

### Memory Breakdown

| Service | Limit | Typical Usage |
|---------|-------|---------------|
| PostgreSQL | 512 MB | 100–300 MB |
| Redis | 300 MB | 50–100 MB |
| API | 512 MB | 150–300 MB |
| Worker | 2 GB | 500 MB–1.8 GB (depends on test load) |
| Web | 256 MB | 80–150 MB |
| Nginx | 128 MB | 10–30 MB |
| **Total** | **~3.7 GB** | **~1–3 GB** |

---

## Manual Installation (Without Docker)

If Docker is not available, you can run SaveAction directly on the host.

### Prerequisites

```bash
# Node.js 22+ (via nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 22
nvm use 22

# pnpm
corepack enable
corepack prepare pnpm@8.10.0 --activate

# PostgreSQL 16
sudo apt install -y postgresql-16

# Redis 7
sudo apt install -y redis-server

# Playwright system dependencies
npx playwright install-deps
```

### Build

```bash
git clone https://github.com/SaveActionHQ/SaveAction.git
cd SaveAction
pnpm install
pnpm build
```

### Configure

```bash
cd packages/api
cp .env.example .env
# Edit .env with your PostgreSQL and Redis connection details
```

### Run Database Migrations

```bash
cd packages/api
pnpm db:migrate
```

### Start Services

Use a process manager like [PM2](https://pm2.keymetrics.io/):

```bash
npm install -g pm2

# API
pm2 start packages/api/dist/server.js --name saveaction-api

# Worker
pm2 start packages/api/dist/worker.js --name saveaction-worker

# Web
cd packages/web
pm2 start node_modules/.bin/next --name saveaction-web -- start -p 3000

# Save process list for auto-restart on reboot
pm2 save
pm2 startup
```

### Reverse Proxy

Install Nginx or Caddy and configure routing as described in the [TLS/HTTPS section](#tls--https-setup).

---

## FAQ

### Can I run SaveAction behind a corporate proxy?

Yes. Set `HTTP_PROXY` and `HTTPS_PROXY` environment variables on the worker container if tests need to access sites through a proxy:

```yaml
worker:
  environment:
    HTTP_PROXY: http://proxy.corp.com:8080
    HTTPS_PROXY: http://proxy.corp.com:8080
    NO_PROXY: localhost,postgres,redis,api
```

### Can I use an external PostgreSQL / Redis?

Yes. Set `DATABASE_URL` and `REDIS_URL` directly in the API and worker environment, and remove the `postgres`/`redis` services from `docker-compose.yml`.

```env
DATABASE_URL=postgresql://user:pass@your-rds-instance.amazonaws.com:5432/saveaction
REDIS_URL=redis://:pass@your-elasticache.amazonaws.com:6379
```

### Can I disable registration (invite-only)?

There is no built-in invite-only mode yet. For now, register your users and then block the registration endpoint at the Nginx level:

```nginx
location = /api/v1/auth/register {
    return 403;
}
```

### How do I change the port?

Set `PORT` in `.env`:

```env
PORT=8443
```

### Can the web UI run on a different domain than the API?

Yes, but you'll need to configure `CORS_ORIGIN` and `NEXT_PUBLIC_API_URL` accordingly:

```env
CORS_ORIGIN=https://dashboard.example.com
NEXT_PUBLIC_API_URL=https://api.example.com/api
```

And update Nginx (or remove it) to handle the split routing.

### Where are videos and screenshots stored?

In the `storage-data` Docker volume, mounted at `/app/storage/` inside API and worker containers. Videos are at `/app/storage/videos/`, screenshots at `/app/storage/screenshots/`. They're automatically cleaned up after 30 days.

### How do I reset everything?

```bash
docker compose down -v   # Removes all containers AND volumes (all data deleted)
docker compose build
docker compose up -d
```

---

## Troubleshooting

### Container won't start / keeps restarting

```bash
# Check logs for the failing service
docker compose logs api
docker compose logs worker

# Common causes:
# - "JWT_SECRET is required" → .env file missing or variables not set
# - "ECONNREFUSED" → PostgreSQL or Redis not ready yet (check health)
# - "Cannot find module" → Image needs rebuilding: docker compose build
```

### Database connection refused

```bash
docker compose ps postgres    # Should show "healthy"
docker compose logs postgres  # Check for errors

# If unhealthy, restart:
docker compose restart postgres
sleep 10
docker compose restart api worker
```

### Worker out of memory (OOM killed)

```bash
# Check current usage
docker stats --no-stream

# Solutions (pick one):
# 1. Reduce concurrency
WORKER_CONCURRENCY=1  # In .env

# 2. Increase memory limit (edit docker-compose.yml)
# deploy.resources.limits.memory: 4G

# 3. Scale out instead of up
docker compose up -d --scale worker=2
# With WORKER_CONCURRENCY=1 per worker
```

### Tests fail with "browser closed" or timeout

- Ensure `shm_size: '1gb'` is set on the worker (it is by default)
- Check if the target website is accessible from within the container:
```bash
docker compose exec worker node -e "fetch('https://example.com').then(r => console.log(r.status))"
```

### Nginx returns 502 Bad Gateway

The upstream service isn't ready:

```bash
docker compose ps   # Check if api and web are healthy
docker compose restart nginx
```

### Disk space running out

```bash
# Check usage
df -h
docker system df

# Clean old Docker resources
docker system prune -f

# Videos/screenshots auto-cleanup (already configured for 30 days)
# Force manual cleanup of old storage files:
docker compose exec api find /app/storage/videos -mtime +7 -delete
docker compose exec api find /app/storage/screenshots -mtime +7 -delete
```

### Redis "LOADING" error

Redis is loading data from disk (AOF). Wait a few seconds and retry. If it persists:

```bash
docker compose restart redis
sleep 10
docker compose restart api worker
```

### Need to completely start over

```bash
docker compose down -v          # Stop and remove everything including data
docker system prune -af         # Clean all Docker cache
docker compose build --no-cache # Full rebuild
docker compose up -d            # Fresh start
```

---

## Further Reading

| Document | Description |
|----------|-------------|
| [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md) | Technical Docker Compose reference |
| [GETTING_STARTED.md](./GETTING_STARTED.md) | Development setup guide |
| [API.md](./API.md) | API endpoint documentation |
| [WORKER_ARCHITECTURE.md](./WORKER_ARCHITECTURE.md) | Worker process design |

---

_Last updated: February 2026_
