# Worker Architecture

> **Production-Scale Test Execution**

## Overview

SaveAction uses a **separate worker process** architecture for test execution. This design ensures:

- **Scalability**: Workers scale independently from API
- **Isolation**: Worker crash doesn't affect API server
- **Performance**: No resource contention between HTTP and Playwright
- **Enterprise-ready**: Multiple worker instances for high throughput

## Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                         Production Setup                            │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐                        ┌─────────────────────┐    │
│  │  API Server │                        │   Worker Pool       │    │
│  │  (Node.js)  │                        │                     │    │
│  │             │      ┌────────┐        │  ┌───────────────┐  │    │
│  │ POST /runs  │─────▶│ Redis  │◀───────│  │   Worker 1    │  │    │
│  │ GET /runs   │      │ BullMQ │        │  │ (Playwright)  │  │    │
│  │ /cancel     │      │ Queue  │        │  └───────────────┘  │    │
│  │             │      └────────┘        │  ┌───────────────┐  │    │
│  └──────┬──────┘                        │  │   Worker 2    │  │    │
│         │                               │  │ (Playwright)  │  │    │
│         │                               │  └───────────────┘  │    │
│         ▼                               │  ┌───────────────┐  │    │
│  ┌─────────────┐                        │  │   Worker N    │  │    │
│  │ PostgreSQL  │◀───────────────────────│  │ (Playwright)  │  │    │
│  │ (Runs DB)   │                        │  └───────────────┘  │    │
│  └─────────────┘                        └─────────────────────┘    │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

## Files

| File | Purpose |
|------|---------|
| `src/server.ts` | API server entry point (HTTP only) |
| `src/worker.ts` | Worker process entry point (test execution) |
| `src/queues/testRunProcessor.ts` | BullMQ job processor using PlaywrightRunner |

## Environment Variables

```bash
# Worker Configuration
WORKER_CONCURRENCY=3      # Concurrent tests per worker (1-10)
WORKER_NAME=worker-1      # Instance name for logs
LOG_LEVEL=info            # debug | info | warn | error

# Storage Paths
VIDEO_STORAGE_PATH=./storage/videos
SCREENSHOT_STORAGE_PATH=./storage/screenshots

# Required (same as API)
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
```

## Running Workers

### Development

Single command starts both API and Worker:
```bash
cd packages/api
pnpm dev
```

Output shows both processes with prefixes:
```
[API]    [07:28:40] INFO: Server listening at http://0.0.0.0:3001
[WORKER] {"level":"info","worker":"worker-16104","message":"Worker is ready"}
```

Separate processes (for debugging):
```bash
pnpm dev:api     # Terminal 1: API only
pnpm dev:worker  # Terminal 2: Worker only
```

### Production

```bash
# Start API server
NODE_ENV=production pnpm start

# Start workers (run multiple for scaling)
NODE_ENV=production WORKER_NAME=worker-1 pnpm start:worker
NODE_ENV=production WORKER_NAME=worker-2 pnpm start:worker
NODE_ENV=production WORKER_NAME=worker-3 pnpm start:worker
```

### Docker Compose (Production)

```yaml
# docker-compose.prod.yml (future)
services:
  api:
    build: .
    command: node dist/server.js
    environment:
      - NODE_ENV=production
    deploy:
      replicas: 2
    depends_on:
      - postgres
      - redis

  worker:
    build: .
    command: node dist/worker.js
    environment:
      - NODE_ENV=production
      - WORKER_CONCURRENCY=3
    deploy:
      replicas: 4  # Scale based on test volume
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
```

## Scaling Guide

### Concurrency Math

```
Total Parallel Tests = Number of Workers × WORKER_CONCURRENCY
```

| Scenario | Workers | Concurrency | Parallel Tests | RAM (approx) |
|----------|---------|-------------|----------------|--------------|
| Development | 1 | 3 | 3 | 1 GB |
| Small Team | 2 | 3 | 6 | 2 GB |
| Medium | 4 | 3 | 12 | 4 GB |
| Large | 8 | 4 | 32 | 10 GB |
| Enterprise | 20 | 5 | 100 | 30 GB |

### Resource Guidelines

- **RAM**: ~200-300 MB per browser instance
- **CPU**: 0.5-1 core per concurrent test
- **Disk**: Video recording uses ~10 MB/minute

### Auto-scaling (Kubernetes)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: saveaction-worker
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: saveaction-worker
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: External
      external:
        metric:
          name: bullmq_queue_waiting
          selector:
            matchLabels:
              queue: test-runs
        target:
          type: AverageValue
          averageValue: "5"  # Scale when >5 jobs waiting
```

## Logging

### Log Levels

| Level | Description | When to Use |
|-------|-------------|-------------|
| `debug` | Everything including action details | Development debugging |
| `info` | Job start/complete, connections | Default for production |
| `warn` | Stalled jobs, retries | Alerts worth investigating |
| `error` | Failures, crashes | Immediate attention needed |

### Worker Log Format (JSON)

```json
{
  "level": "info",
  "worker": "worker-16104",
  "timestamp": "2026-01-31T07:17:43.270Z",
  "message": "Job completed",
  "jobId": "ec42b3d5",
  "runId": "ec42b3d5-50b1-459c-8b77-593e2bd1f99a",
  "status": "passed",
  "actionsExecuted": 22,
  "duration": 30796
}
```

### Docker Log Aggregation

```yaml
# docker-compose.prod.yml
services:
  worker:
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "3"
```

For enterprise: Forward to ELK Stack, Datadog, Grafana Loki via Docker log drivers.

## Graceful Shutdown

Worker handles signals properly:

```
SIGTERM → Wait for active jobs → Close Redis → Close DB → Exit 0
```

- Active jobs complete before shutdown
- BullMQ marks incomplete jobs as "stalled" for retry
- No data loss on deployment/restart

## BullMQ Job Flow

```
1. API receives POST /api/runs
2. Create run record (status: 'queued')
3. Add job to 'test-runs' queue
4. Return run ID to client

5. Worker picks up job
6. Update run status: 'running'
7. Execute PlaywrightRunner
8. Save action results to DB
9. Update run status: 'passed' or 'failed'
10. Job complete
```

## Health Monitoring

### Worker Health Check

Workers report to BullMQ automatically. Check via API:

```http
GET /api/health/detailed
```

Response includes queue status:
```json
{
  "queues": {
    "test-runs": {
      "waiting": 5,
      "active": 3,
      "completed": 150,
      "failed": 2
    }
  }
}
```

### Stalled Job Detection

BullMQ detects stalled jobs (worker died mid-execution):
- Default stall interval: 30 seconds
- Jobs automatically retried
- Configure in worker.ts: `stalledInterval: 30000`

## Troubleshooting

### Jobs Not Processing

1. Check Redis connection: `redis-cli ping`
2. Check worker is running: Look for worker logs
3. Check queue status: `GET /api/health/detailed`

### High Memory Usage

1. Reduce `WORKER_CONCURRENCY`
2. Disable video recording if not needed
3. Scale horizontally (more workers, less concurrency each)

### Jobs Failing Immediately

1. Check `LOG_LEVEL=debug` for details
2. Verify Playwright browsers installed: `npx playwright install`
3. Check storage paths exist and are writable

---

## Future Enhancements

- **Priority Queues**: VIP recordings execute first
- **Retry with Backoff**: Auto-retry failed runs with exponential delay
- **Dead Letter Queue**: Capture permanently failed jobs for analysis
- **Metrics Export**: Prometheus metrics for Grafana dashboards
