# Production Deployment Guide

> How to deploy SaveAction to production using Docker.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Services](#services)
- [Scaling](#scaling)
- [Database Migrations](#database-migrations)
- [Storage](#storage)
- [SSL / HTTPS](#ssl--https)
- [Monitoring](#monitoring)
- [Backup](#backup)
- [Updating](#updating)
- [Troubleshooting](#troubleshooting)

---

## Overview

Production deployment uses Docker Compose with 6 services:

| Service | Image | Purpose |
|---------|-------|---------|
| **postgres** | `postgres:16-alpine` | Database |
| **redis** | `redis:7-alpine` | Job queue + cache |
| **api** | Built from `docker/api/Dockerfile` | REST API server (Fastify) |
| **worker** | Same image as api | Test executor (BullMQ + Playwright) |
| **web** | Built from `docker/web/Dockerfile` | Web dashboard (Next.js) |
| **nginx** | `nginx:alpine` | Reverse proxy |

**What users access:** `http://your-server` → Nginx routes `/api/*` to API, everything else to Web.

---

## Architecture

```
                    ┌──────────────┐
                    │    Nginx     │ :80
                    │  (reverse    │
                    │   proxy)     │
                    └──────┬───────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
       ┌──────────┐             ┌──────────┐
       │   API    │ :3001       │   Web    │ :3000
       │ (Fastify)│             │(Next.js) │
       └────┬─────┘             └──────────┘
            │
       ┌────┴─────┐
       ▼          ▼
┌──────────┐ ┌──────────┐
│PostgreSQL│ │  Redis   │
│  :5432   │ │  :6379   │
└──────────┘ └────┬─────┘
                  │
                  ▼
            ┌──────────┐
            │  Worker  │ ×N
            │(Playwright│
            │ browsers) │
            └──────────┘
```

---

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/SaveActionHQ/SaveAction.git
cd SaveAction
```

### 2. Configure environment

```bash
cp .env.production.example .env
```

Edit `.env` with secure values:

```env
# REQUIRED — change these
DB_PASSWORD=your-strong-database-password
REDIS_PASSWORD=your-strong-redis-password
JWT_SECRET=generate-with-openssl-rand-base64-64
JWT_REFRESH_SECRET=generate-a-different-random-secret

# OPTIONAL — adjust as needed
CORS_ORIGIN=https://your-domain.com
APP_BASE_URL=https://your-domain.com
WORKER_CONCURRENCY=3
LOG_LEVEL=info
PORT=80
```

Generate secure secrets:

```bash
# Linux/macOS
openssl rand -base64 64

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

### 3. Build and start

```bash
# Build all images
docker compose build

# Start all services
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

### 4. Verify

```bash
# Health check
curl http://localhost/health/live
# → {"status":"ok"}

# Detailed health (includes DB + Redis status)
curl http://localhost/health/detailed
```

Open `http://your-server` in a browser to access the web dashboard.

---

## Configuration

All configuration is done through the `.env` file. See `.env.production.example` for the full list.

### Required Variables

| Variable | Description |
|----------|-------------|
| `DB_PASSWORD` | PostgreSQL password |
| `JWT_SECRET` | JWT signing key (min 32 chars) |
| `JWT_REFRESH_SECRET` | Refresh token signing key (min 32 chars) |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_USER` | `saveaction` | PostgreSQL username |
| `DB_NAME` | `saveaction` | PostgreSQL database name |
| `REDIS_PASSWORD` | _(empty)_ | Redis password |
| `CORS_ORIGIN` | `*` | Allowed CORS origins |
| `LOG_LEVEL` | `info` | Log level: `debug`, `info`, `warn`, `error` |
| `APP_BASE_URL` | `http://localhost` | Public URL (used in emails) |
| `WORKER_CONCURRENCY` | `3` | Concurrent test executions per worker |
| `PORT` | `80` | External port for Nginx |
| `NEXT_PUBLIC_API_URL` | `/api` | API URL as seen by browser |

### Email (SMTP) — Optional

Required for password reset emails:

| Variable | Default | Description |
|----------|---------|-------------|
| `SMTP_HOST` | - | SMTP server hostname |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_SECURE` | `false` | Use TLS (`true`/`false`) |
| `SMTP_USER` | - | SMTP username |
| `SMTP_PASS` | - | SMTP password |
| `SMTP_FROM` | - | Sender email address |
| `SMTP_FROM_NAME` | `SaveAction` | Sender display name |

---

## Services

### API Server

The Fastify REST API handles all HTTP requests: authentication, CRUD operations, SSE streaming.

- **Port:** 3001 (internal, not exposed to host)
- **Health check:** `GET /health/live`
- **Swagger docs:** `GET /docs` (accessible via `http://your-server/api/docs` through Nginx)
- **Memory limit:** 512MB

### Worker

Processes test execution jobs from the Redis queue using Playwright. Same Docker image as API, different start command.

- **Command:** `node packages/api/dist/worker.js`
- **Memory limit:** 2GB (Chromium browsers need significant RAM)
- **Shared memory:** 1GB (`shm_size`) for Chromium
- **Concurrency:** Configurable via `WORKER_CONCURRENCY` (default: 3 jobs per worker)

### Web Dashboard

Next.js standalone server serving the web UI.

- **Port:** 3000 (internal)
- **Memory limit:** 256MB

### Nginx

Reverse proxy routing traffic to API and Web. Handles:
- Route splitting (`/api/*` → API, `/*` → Web)
- SSE (Server-Sent Events) with disabled buffering for real-time run progress
- Gzip compression
- Static asset caching
- File upload limits (50MB for recording uploads)
- Security headers

### PostgreSQL

- **Version:** 16-alpine
- **Data:** Persisted in `postgres-data` Docker volume
- **Memory limit:** 512MB

### Redis

- **Version:** 7-alpine
- **Persistence:** AOF (append-only file)
- **Memory limit:** 256MB (LRU eviction)
- **Data:** Persisted in `redis-data` Docker volume

---

## Scaling

### Scale workers

Workers are the most likely bottleneck — each runs Playwright browsers which are CPU and RAM intensive.

```bash
# Run 4 worker instances
docker compose up -d --scale worker=4

# Check worker status
docker compose ps worker
```

Each worker processes `WORKER_CONCURRENCY` jobs (default 3), so 4 workers = 12 concurrent test executions.

**Resource planning per worker:**
- CPU: 2+ cores recommended
- RAM: 2GB limit (Chromium uses ~500MB per tab)
- Disk: Minimal (browsers are in the image)

### Scale API

The API server is stateless — scale horizontally if you have high HTTP traffic:

```bash
docker compose up -d --scale api=2
```

> **Note:** When scaling API, update the Nginx config to load balance across API instances, or use Docker Compose's built-in DNS-based load balancing (default behavior with the `api` service name).

---

## Database Migrations

Migrations run automatically when the API container starts (via Drizzle ORM). To run manually:

```bash
# Run migrations inside the API container
docker compose exec api node -e "
  import('drizzle-orm/pg-core').then(() => console.log('Migrations applied'));
"

# Or restart the API to trigger auto-migration
docker compose restart api
```

For the initial deployment, the database tables are created by the first migration.

---

## Storage

Test execution produces videos and screenshots, stored in a shared Docker volume:

| Path (inside container) | Purpose |
|------------------------|---------|
| `/app/storage/videos` | Video recordings of test runs |
| `/app/storage/screenshots` | Screenshots from test failures |

The `storage-data` volume is shared between `api` and `worker` containers.

To access files from the host:

```bash
# List stored videos
docker compose exec api ls /app/storage/videos

# Copy a file to host
docker cp $(docker compose ps -q api):/app/storage/videos/file.webm ./
```

---

## SSL / HTTPS

The default setup uses HTTP on port 80. For production, you should add HTTPS.

### Option 1: Reverse proxy with Certbot (Let's Encrypt)

Add a certbot sidecar or use an external Nginx/Caddy with SSL:

```bash
# Example: use Caddy as an external reverse proxy
# Caddy auto-provisions Let's Encrypt certificates
caddy reverse-proxy --from your-domain.com --to localhost:80
```

### Option 2: Cloud load balancer

If deploying on AWS, GCP, or Azure, use their load balancer for SSL termination and remove the Nginx container:

```yaml
# In docker-compose.yml, expose API and Web ports directly:
api:
  ports:
    - "3001:3001"
web:
  ports:
    - "3000:3000"
```

Then configure the cloud load balancer to route:
- `your-domain.com/api/*` → `:3001`
- `your-domain.com/*` → `:3000`

### Option 3: Modify Nginx config

Add SSL certificates to the Nginx config:

```nginx
server {
    listen 443 ssl;
    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;
    # ... rest of config
}

server {
    listen 80;
    return 301 https://$host$request_uri;
}
```

Mount certificates in `docker-compose.yml`:

```yaml
nginx:
  volumes:
    - ./docker/nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    - /etc/letsencrypt/live/your-domain.com:/etc/nginx/certs:ro
  ports:
    - "80:80"
    - "443:443"
```

---

## Monitoring

### Health checks

All services have Docker health checks configured. Check status:

```bash
docker compose ps
```

API health endpoints:

| Endpoint | Description |
|----------|-------------|
| `GET /health/live` | Basic liveness (is the process running?) |
| `GET /health/ready` | Readiness (can it serve requests? DB + Redis connected?) |
| `GET /health/detailed` | Full status of all dependencies |

### Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f worker

# Last 100 lines
docker compose logs --tail 100 worker
```

### Queue status

```bash
# Check BullMQ queue status
curl http://localhost/api/queues
```

### Resource usage

```bash
docker stats
```

---

## Backup

### PostgreSQL backup

```bash
# Create a backup
docker compose exec postgres pg_dump -U saveaction saveaction > backup_$(date +%Y%m%d).sql

# Restore from backup
docker compose exec -T postgres psql -U saveaction saveaction < backup_20260220.sql
```

### Automated daily backups

Add a cron job on the host:

```bash
# crontab -e
0 2 * * * cd /path/to/SaveAction && docker compose exec -T postgres pg_dump -U saveaction saveaction | gzip > /backups/saveaction_$(date +\%Y\%m\%d).sql.gz
```

### Volume backup

```bash
# Stop services first for consistent backup
docker compose stop

# Backup volumes
docker run --rm -v saveaction_postgres-data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-data.tar.gz /data
docker run --rm -v saveaction_redis-data:/data -v $(pwd):/backup alpine tar czf /backup/redis-data.tar.gz /data
docker run --rm -v saveaction_storage-data:/data -v $(pwd):/backup alpine tar czf /backup/storage-data.tar.gz /data

# Restart
docker compose up -d
```

---

## Updating

### Pull latest code and rebuild

```bash
cd SaveAction

# Pull latest changes
git pull

# Rebuild images
docker compose build

# Restart with new images (minimal downtime)
docker compose up -d
```

### Zero-downtime update (with scale)

```bash
# Build new images
docker compose build

# Scale up new workers while old ones finish
docker compose up -d --scale worker=4 --no-recreate
docker compose up -d  # Recreate with new image

# Or rolling restart
docker compose up -d --force-recreate --no-deps worker
docker compose up -d --force-recreate --no-deps api
docker compose up -d --force-recreate --no-deps web
docker compose up -d --force-recreate --no-deps nginx
```

---

## Troubleshooting

### Container won't start

```bash
# Check logs for errors
docker compose logs api
docker compose logs worker

# Common: missing env vars
# Error: "JWT_SECRET is required"
# Fix: Ensure .env has all required variables
```

### Database connection refused

```bash
# Check if postgres is running and healthy
docker compose ps postgres

# Check postgres logs
docker compose logs postgres

# Restart postgres
docker compose restart postgres

# Wait for health check, then restart dependents
docker compose restart api worker
```

### Worker out of memory

```bash
# Check memory usage
docker stats

# Increase worker memory limit in docker-compose.yml:
# deploy.resources.limits.memory: 4G

# Or reduce worker concurrency:
# WORKER_CONCURRENCY=1 in .env
```

### Redis connection issues

```bash
# Check redis health
docker compose exec redis redis-cli ping

# If password is set:
docker compose exec redis redis-cli -a your-password ping
```

### Nginx 502 Bad Gateway

The upstream service (API or Web) isn't ready yet:

```bash
# Check if api and web are healthy
docker compose ps

# Restart nginx after dependents are healthy
docker compose restart nginx
```

### Rebuilding from scratch

```bash
# Stop everything
docker compose down

# Remove volumes (DELETES ALL DATA)
docker compose down -v

# Rebuild and start fresh
docker compose build --no-cache
docker compose up -d
```

---

## File Reference

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Production compose definition |
| `docker-compose.dev.yml` | Development services only (PostgreSQL + Redis) |
| `docker/api/Dockerfile` | API + Worker multi-stage build |
| `docker/web/Dockerfile` | Web UI multi-stage build |
| `docker/nginx/nginx.conf` | Nginx reverse proxy config |
| `.env.production.example` | Environment variable template |
| `.dockerignore` | Files excluded from Docker build context |
