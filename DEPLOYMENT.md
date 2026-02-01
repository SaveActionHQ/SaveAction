# SaveAction Deployment Guide

> **Status:** Planning document for Phase 5 implementation  
> **Last Updated:** February 2026

This document outlines deployment strategies for SaveAction in production environments.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Deployment Options](#deployment-options)
  - [Option 1: Self-Hosted Docker](#option-1-self-hosted-docker-compose)
  - [Option 2: Managed Cloud Services](#option-2-managed-cloud-services)
  - [Option 3: Kubernetes (Enterprise)](#option-3-kubernetes-enterprise)
- [Environment Variables](#environment-variables)
- [Scaling Considerations](#scaling-considerations)
- [Security Checklist](#security-checklist)
- [Monitoring & Observability](#monitoring--observability)
- [Backup & Recovery](#backup--recovery)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SaveAction Production Architecture                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────────────────┐   │
│   │   Clients    │     │   CI/CD      │     │     Web Dashboard        │   │
│   │   (CLI)      │     │   Pipelines  │     │     (Next.js)            │   │
│   └──────┬───────┘     └──────┬───────┘     └───────────┬──────────────┘   │
│          │                    │                         │                   │
│          └────────────────────┼─────────────────────────┘                   │
│                               │                                              │
│                               ▼                                              │
│                    ┌──────────────────────┐                                 │
│                    │   Load Balancer      │                                 │
│                    │   (nginx/ALB/Traefik)│                                 │
│                    └──────────┬───────────┘                                 │
│                               │                                              │
│              ┌────────────────┼────────────────┐                            │
│              ▼                ▼                ▼                            │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                       │
│   │  API Server  │ │  API Server  │ │  API Server  │  ← Stateless          │
│   │  (Fastify)   │ │  (Fastify)   │ │  (Fastify)   │     Horizontal Scale  │
│   └──────┬───────┘ └──────┬───────┘ └──────┬───────┘                       │
│          │                │                │                                │
│          └────────────────┼────────────────┘                                │
│                           │                                                  │
│              ┌────────────┼────────────────┐                                │
│              ▼            ▼                ▼                                │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                       │
│   │    Worker    │ │    Worker    │ │    Worker    │  ← CPU-Intensive      │
│   │  (Playwright)│ │  (Playwright)│ │  (Playwright)│     Scale by Load     │
│   └──────┬───────┘ └──────┬───────┘ └──────┬───────┘                       │
│          │                │                │                                │
│          └────────────────┼────────────────┘                                │
│                           │                                                  │
│          ┌────────────────┴────────────────┐                                │
│          ▼                                 ▼                                │
│   ┌──────────────┐                 ┌──────────────┐                        │
│   │  PostgreSQL  │                 │    Redis     │                        │
│   │  (Primary +  │                 │  (Cluster)   │                        │
│   │   Replicas)  │                 │              │                        │
│   └──────────────┘                 └──────────────┘                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Purpose | Scaling Strategy |
|-----------|---------|------------------|
| **API Server** | HTTP requests, authentication, CRUD | Horizontal (stateless) |
| **Worker** | Playwright test execution | Horizontal (CPU-bound) |
| **PostgreSQL** | Persistent data storage | Vertical + Read replicas |
| **Redis** | Job queues, caching, sessions | Cluster mode |

---

## Deployment Options

### Option 1: Self-Hosted (docker-compose)

**Best for:** Small teams, on-premise deployments, cost-sensitive setups

```yaml
# docker-compose.production.yml (to be created in Phase 5)
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: saveaction
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    image: saveaction/api:latest
    restart: always
    ports:
      - "3001:3001"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/saveaction
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 512M

  worker:
    image: saveaction/worker:latest
    restart: always
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/saveaction
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      WORKER_CONCURRENCY: 3
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 2G  # Playwright needs more RAM

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - api

volumes:
  postgres_data:
  redis_data:
```

**Deployment Steps:**
```bash
# 1. Clone repository
git clone https://github.com/SaveActionHQ/SaveAction.git
cd SaveAction

# 2. Configure environment
cp .env.example .env.production
# Edit .env.production with secure values

# 3. Build images
docker compose -f docker-compose.production.yml build

# 4. Start services
docker compose -f docker-compose.production.yml up -d

# 5. Run database migrations
docker compose exec api npm run db:migrate
```

---

### Option 2: Managed Cloud Services

**Best for:** Medium teams, AWS/GCP/Azure users, reduced ops burden

Use cloud-managed databases instead of self-hosting:

| Service | AWS | GCP | Azure |
|---------|-----|-----|-------|
| PostgreSQL | RDS | Cloud SQL | Azure Database |
| Redis | ElastiCache | Memorystore | Azure Cache |
| Container | ECS/Fargate | Cloud Run | Container Apps |

**Example AWS Setup:**

```bash
# Environment variables pointing to managed services
DATABASE_URL=postgresql://admin:password@saveaction.abc123.us-east-1.rds.amazonaws.com:5432/saveaction
REDIS_URL=redis://saveaction-redis.abc123.cache.amazonaws.com:6379

# Run API and Worker on ECS/Fargate
# - API: 2 tasks, 0.5 vCPU, 1GB RAM each
# - Worker: 4 tasks, 1 vCPU, 2GB RAM each (Playwright needs more)
```

**Benefits:**
- ✅ Automatic backups
- ✅ High availability built-in
- ✅ Automatic patching
- ✅ Easy scaling
- ✅ Monitoring included

**docker-compose for app only:**
```yaml
# Only run app containers, use managed DB/Redis
services:
  api:
    image: saveaction/api:latest
    environment:
      DATABASE_URL: ${RDS_DATABASE_URL}
      REDIS_URL: ${ELASTICACHE_URL}
    deploy:
      replicas: 2

  worker:
    image: saveaction/worker:latest
    environment:
      DATABASE_URL: ${RDS_DATABASE_URL}
      REDIS_URL: ${ELASTICACHE_URL}
    deploy:
      replicas: 4
```

---

### Option 3: Kubernetes (Enterprise)

**Best for:** Large enterprises, multi-region, high availability requirements

#### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Kubernetes Cluster                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────┐   ┌─────────────────────────────────────┐    │
│   │   Ingress   │   │         Namespace: saveaction        │    │
│   │  Controller │   │                                      │    │
│   │  (nginx/    │──▶│  ┌─────────────────────────────┐    │    │
│   │   traefik)  │   │  │     API Deployment          │    │    │
│   └─────────────┘   │  │     replicas: 3             │    │    │
│                     │  │     resources:              │    │    │
│                     │  │       cpu: 500m             │    │    │
│                     │  │       memory: 512Mi         │    │    │
│                     │  └─────────────────────────────┘    │    │
│                     │                                      │    │
│                     │  ┌─────────────────────────────┐    │    │
│                     │  │     Worker Deployment       │    │    │
│                     │  │     replicas: 5             │    │    │
│                     │  │     resources:              │    │    │
│                     │  │       cpu: 1000m            │    │    │
│                     │  │       memory: 2Gi           │    │    │
│                     │  └─────────────────────────────┘    │    │
│                     │                                      │    │
│                     └─────────────────────────────────────┘    │
│                                                                  │
│   External Services (Managed):                                  │
│   - PostgreSQL: Cloud SQL / RDS / Azure Database               │
│   - Redis: Memorystore / ElastiCache / Azure Cache             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Kubernetes Manifests

**API Deployment (`k8s/api-deployment.yaml`):**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: saveaction-api
  namespace: saveaction
spec:
  replicas: 3
  selector:
    matchLabels:
      app: saveaction-api
  template:
    metadata:
      labels:
        app: saveaction-api
    spec:
      containers:
        - name: api
          image: saveaction/api:latest
          ports:
            - containerPort: 3001
          env:
            - name: NODE_ENV
              value: "production"
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: saveaction-secrets
                  key: database-url
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: saveaction-secrets
                  key: redis-url
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: saveaction-secrets
                  key: jwt-secret
          resources:
            requests:
              cpu: "250m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
          livenessProbe:
            httpGet:
              path: /api/health/live
              port: 3001
            initialDelaySeconds: 10
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /api/health/ready
              port: 3001
            initialDelaySeconds: 5
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: saveaction-api
  namespace: saveaction
spec:
  selector:
    app: saveaction-api
  ports:
    - port: 80
      targetPort: 3001
  type: ClusterIP
```

**Worker Deployment (`k8s/worker-deployment.yaml`):**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: saveaction-worker
  namespace: saveaction
spec:
  replicas: 5
  selector:
    matchLabels:
      app: saveaction-worker
  template:
    metadata:
      labels:
        app: saveaction-worker
    spec:
      containers:
        - name: worker
          image: saveaction/worker:latest
          env:
            - name: NODE_ENV
              value: "production"
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: saveaction-secrets
                  key: database-url
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: saveaction-secrets
                  key: redis-url
            - name: WORKER_CONCURRENCY
              value: "3"
          resources:
            requests:
              cpu: "500m"
              memory: "1Gi"
            limits:
              cpu: "1000m"
              memory: "2Gi"
```

**Horizontal Pod Autoscaler:**
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: saveaction-worker-hpa
  namespace: saveaction
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: saveaction-worker
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

**Ingress:**
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: saveaction-ingress
  namespace: saveaction
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - api.saveaction.example.com
      secretName: saveaction-tls
  rules:
    - host: api.saveaction.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: saveaction-api
                port:
                  number: 80
```

#### Helm Chart (Future)

We plan to provide a Helm chart for easy Kubernetes deployment:

```bash
# Add SaveAction Helm repo
helm repo add saveaction https://charts.saveaction.io

# Install with custom values
helm install saveaction saveaction/saveaction \
  --namespace saveaction \
  --create-namespace \
  --set api.replicas=3 \
  --set worker.replicas=5 \
  --set database.external.url=$DATABASE_URL \
  --set redis.external.url=$REDIS_URL
```

---

## Environment Variables

### Required (Production)

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `DATABASE_URL` | PostgreSQL connection | `postgresql://user:pass@host:5432/db` |
| `REDIS_URL` | Redis connection | `redis://:password@host:6379` |
| `JWT_SECRET` | Access token signing | `64+ character random string` |
| `JWT_REFRESH_SECRET` | Refresh token signing | `64+ character random string` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `API_PORT` | HTTP port | `3001` |
| `LOG_LEVEL` | Logging verbosity | `info` |
| `WORKER_CONCURRENCY` | Parallel test runs per worker | `3` |
| `CORS_ORIGIN` | Allowed origins | `*` |
| `VIDEO_STORAGE_PATH` | Video file storage | `./storage/videos` |
| `VIDEO_RETENTION_DAYS` | Days before cleanup | `30` |

### Generating Secrets

```bash
# Generate secure JWT secrets
openssl rand -base64 64  # JWT_SECRET
openssl rand -base64 64  # JWT_REFRESH_SECRET

# Generate database password
openssl rand -base64 32
```

---

## Scaling Considerations

### API Server Scaling

| Metric | Threshold | Action |
|--------|-----------|--------|
| CPU > 70% | Scale up | Add replicas |
| Memory > 80% | Scale up | Add replicas |
| Response time > 500ms | Scale up | Add replicas |
| CPU < 30% | Scale down | Remove replicas |

**Recommended starting point:**
- 2-3 replicas for small deployments
- 5-10 replicas for medium deployments
- Auto-scale based on load for large deployments

### Worker Scaling

Workers are CPU and memory intensive due to Playwright:

| Test Load | Recommended Workers | Resources per Worker |
|-----------|--------------------|--------------------|
| < 100 runs/day | 2 workers | 1 CPU, 2GB RAM |
| 100-500 runs/day | 5 workers | 1 CPU, 2GB RAM |
| 500-2000 runs/day | 10 workers | 2 CPU, 4GB RAM |
| > 2000 runs/day | Auto-scale | 2 CPU, 4GB RAM |

**Worker concurrency formula:**
```
Total concurrent tests = Workers × WORKER_CONCURRENCY
Example: 5 workers × 3 concurrency = 15 parallel tests
```

### Database Scaling

| Load | PostgreSQL Setup |
|------|------------------|
| Small | Single instance, 2 vCPU, 4GB RAM |
| Medium | Primary + 1 read replica |
| Large | Primary + 2 read replicas + connection pooling (PgBouncer) |

### Redis Scaling

| Load | Redis Setup |
|------|-------------|
| Small | Single instance, 1GB RAM |
| Medium | Cluster mode, 3 nodes |
| Large | Cluster mode, 6 nodes with replicas |

---

## Security Checklist

### Pre-Deployment

- [ ] Generate unique JWT secrets (64+ characters)
- [ ] Generate strong database passwords
- [ ] Enable Redis authentication
- [ ] Configure CORS for specific origins
- [ ] Set up TLS certificates

### Network Security

- [ ] Database not exposed to internet
- [ ] Redis not exposed to internet
- [ ] API behind load balancer with TLS
- [ ] Rate limiting enabled
- [ ] Security headers configured (Helmet)

### Application Security

- [ ] CSRF protection enabled
- [ ] Input validation on all endpoints
- [ ] SQL injection protection (Drizzle ORM)
- [ ] XSS protection (Content-Security-Policy)
- [ ] Account lockout enabled

### Operational Security

- [ ] Secrets stored in vault/secrets manager
- [ ] Audit logging enabled
- [ ] Regular security updates
- [ ] Penetration testing (recommended)

---

## Monitoring & Observability

### Health Endpoints

Our API provides health endpoints for monitoring:

| Endpoint | Purpose | Use For |
|----------|---------|---------|
| `GET /api/health` | Basic health | Uptime monitoring |
| `GET /api/health/live` | Liveness probe | Kubernetes liveness |
| `GET /api/health/ready` | Readiness probe | Kubernetes readiness |
| `GET /api/health/detailed` | Full status | Debugging, dashboards |

### Recommended Monitoring Stack

```
┌─────────────────────────────────────────────────────────┐
│                   Monitoring Stack                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│   ┌─────────────┐    ┌─────────────┐    ┌───────────┐  │
│   │  Prometheus │───▶│   Grafana   │───▶│  Alerts   │  │
│   │  (metrics)  │    │ (dashboards)│    │ (PagerDuty│  │
│   └─────────────┘    └─────────────┘    │  /Slack)  │  │
│                                          └───────────┘  │
│   ┌─────────────┐    ┌─────────────┐                   │
│   │    Loki     │───▶│   Grafana   │                   │
│   │   (logs)    │    │   (logs)    │                   │
│   └─────────────┘    └─────────────┘                   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Key Metrics to Monitor

| Metric | Warning | Critical |
|--------|---------|----------|
| API response time | > 500ms | > 2000ms |
| Error rate | > 1% | > 5% |
| Queue depth | > 100 | > 500 |
| Worker CPU | > 70% | > 90% |
| Database connections | > 80% pool | > 95% pool |

### Future: Prometheus Metrics Endpoint

```bash
# Planned: GET /api/metrics
saveaction_runs_total{status="passed"} 1234
saveaction_runs_total{status="failed"} 56
saveaction_run_duration_seconds_bucket{le="10"} 800
saveaction_queue_depth{queue="test-runs"} 5
```

---

## Backup & Recovery

### Database Backup

**Automated Daily Backups:**
```bash
# Cron job for pg_dump
0 2 * * * pg_dump -h $DB_HOST -U $DB_USER saveaction | gzip > /backups/saveaction_$(date +\%Y\%m\%d).sql.gz

# Retain 30 days of backups
find /backups -name "*.sql.gz" -mtime +30 -delete
```

**Managed Services:** AWS RDS, GCP Cloud SQL, etc. provide automated backups with point-in-time recovery.

### Recovery Procedure

```bash
# 1. Stop API and workers
docker compose stop api worker

# 2. Restore database
gunzip -c backup_20260201.sql.gz | psql -h $DB_HOST -U $DB_USER saveaction

# 3. Clear Redis (optional, for clean state)
redis-cli -h $REDIS_HOST FLUSHALL

# 4. Restart services
docker compose up -d api worker
```

### Disaster Recovery

| Scenario | Recovery Time | Data Loss |
|----------|--------------|-----------|
| Single container failure | < 1 min (auto-restart) | None |
| Database failure (replica) | < 5 min (failover) | None |
| Database failure (no replica) | 30-60 min (restore) | Up to 24 hours |
| Full region failure | 1-4 hours | Depends on replication |

---

## Implementation Checklist (Phase 5)

- [ ] Create `Dockerfile.api`
- [ ] Create `Dockerfile.worker`
- [ ] Create `docker-compose.production.yml`
- [ ] Create nginx configuration
- [ ] Write `SELF_HOSTING.md` guide
- [ ] Add database backup scripts
- [ ] Create Kubernetes manifests (optional)
- [ ] Create Helm chart (optional, future)
- [ ] Add Prometheus metrics endpoint (optional, future)

---

## Quick Reference

### Minimum Production Requirements

| Resource | Specification |
|----------|--------------|
| **API** | 2 instances, 0.5 CPU, 512MB RAM each |
| **Worker** | 2 instances, 1 CPU, 2GB RAM each |
| **PostgreSQL** | 2 vCPU, 4GB RAM, 20GB SSD |
| **Redis** | 1 vCPU, 1GB RAM |

### Recommended Production Setup

| Resource | Specification |
|----------|--------------|
| **API** | 3 instances, 1 CPU, 1GB RAM each |
| **Worker** | 5 instances, 2 CPU, 4GB RAM each |
| **PostgreSQL** | 4 vCPU, 8GB RAM, 100GB SSD, 1 replica |
| **Redis** | 2 vCPU, 2GB RAM, cluster mode |

---

*This document will be updated as Phase 5 (Docker Deployment) is implemented.*
