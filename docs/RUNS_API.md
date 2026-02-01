# Runs API & Worker Architecture

> **Status:** ✅ Completed (January 31, 2026)

## Overview

The Runs API enables test execution via REST endpoints with a production-scale worker architecture. Tests are queued in BullMQ and processed by separate worker processes for scalability and isolation.

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│   API Server    │────▶│    Redis     │◀────│     Worker      │
│  (HTTP only)    │     │   (BullMQ)   │     │  (Playwright)   │
└─────────────────┘     └──────────────┘     └─────────────────┘
        │                                            │
        │                                            │
        ▼                                            ▼
┌─────────────────┐                         ┌─────────────────┐
│   PostgreSQL    │◀────────────────────────│   @saveaction   │
│   (Runs DB)     │                         │     /core       │
└─────────────────┘                         └─────────────────┘
```

**Benefits of Separate Worker Process:**
- Workers can scale independently (multiple worker instances)
- Worker crash doesn't affect API server
- Logs are isolated per process
- No resource contention between HTTP and test execution
- Enterprise-ready: scale workers based on load

## API Endpoints

### Create Run
```http
POST /api/v1/runs
Authorization: Bearer <token>
Content-Type: application/json

{
  "recordingId": "uuid",
  "options": {
    "browser": "chromium",      // chromium | firefox | webkit
    "headless": true,
    "timeout": 30000,
    "video": false,
    "screenshot": false,
    "timingEnabled": true,
    "timingMode": "realistic",  // realistic | fast | instant
    "speedMultiplier": 1
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "recordingId": "uuid",
    "recordingName": "Test Name",
    "status": "queued",
    "browser": "chromium",
    "headless": true,
    "createdAt": "2026-01-31T07:17:38.112Z"
  }
}
```

### List Runs
```http
GET /api/v1/runs?page=1&limit=20&status=passed&recordingId=uuid
Authorization: Bearer <token>
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20, max: 100) |
| `status` | string | Filter by status (queued/running/passed/failed/cancelled) |
| `recordingId` | uuid | Filter by recording |
| `sortBy` | string | Sort field (createdAt/startedAt/completedAt/status) |
| `sortOrder` | string | asc/desc |

### Get Run Details
```http
GET /api/v1/runs/:id
Authorization: Bearer <token>
```

**Response includes:**
- Run metadata and options
- Execution stats (actionsTotal, actionsExecuted, actionsFailed, actionsSkipped)
- Duration in milliseconds
- Error details if failed
- Video/screenshot paths if enabled

### Get Run Actions
```http
GET /api/v1/runs/:id/actions
Authorization: Bearer <token>
```

Returns detailed results for each action executed.

### Cancel Run
```http
POST /api/v1/runs/:id/cancel
Authorization: Bearer <token>
```

Cancels a queued or running test. Kills browser process, saves partial results.

### Delete Run (Soft Delete)
```http
DELETE /api/v1/runs/:id
Authorization: Bearer <token>
```

### Retry Run
```http
POST /api/v1/runs/:id/retry
Authorization: Bearer <token>
```

Creates a new run with the same recording and options.

## Run Status Flow

```
queued → running → passed
                 ↘ failed
                 ↘ cancelled (via POST /cancel)
```

| Status | Description |
|--------|-------------|
| `queued` | Job added to BullMQ queue, waiting for worker |
| `running` | Worker picked up job, Playwright executing |
| `passed` | All actions completed successfully |
| `failed` | One or more actions failed |
| `cancelled` | User cancelled via API |

## Worker Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKER_CONCURRENCY` | 3 | Number of concurrent test executions (1-10) |
| `WORKER_NAME` | `worker-<pid>` | Worker instance identifier for logs |
| `LOG_LEVEL` | info | Log verbosity (debug/info/warn/error) |
| `VIDEO_STORAGE_PATH` | ./storage/videos | Path for video recordings |
| `SCREENSHOT_STORAGE_PATH` | ./storage/screenshots | Path for screenshots |

### Running Workers

**Development (single command):**
```bash
cd packages/api
pnpm dev  # Starts both API + Worker with concurrently
```

**Development (separate processes):**
```bash
pnpm dev:api     # API server only
pnpm dev:worker  # Worker only
```

**Production:**
```bash
pnpm start         # API server
pnpm start:worker  # Worker (run multiple for scaling)
```

**Docker Production (future):**
```yaml
services:
  api:
    command: node dist/server.js
    replicas: 2
  
  worker:
    command: node dist/worker.js
    replicas: 4  # Scale based on load
```

## Concurrency & Scaling

### Default Configuration
- `WORKER_CONCURRENCY=3`: Each worker process runs 3 tests in parallel
- BullMQ handles job distribution across multiple workers

### Scaling Examples

| Setup | Workers | Concurrency | Parallel Tests |
|-------|---------|-------------|----------------|
| Small | 1 | 3 | 3 |
| Medium | 2 | 3 | 6 |
| Large | 4 | 3 | 12 |
| Enterprise | 10 | 5 | 50 |

### Resource Considerations
- Each Playwright browser uses ~100-300MB RAM
- Set concurrency based on available memory
- Video recording increases disk I/O

## Database Schema

### runs table
```sql
id              UUID PRIMARY KEY
user_id         UUID REFERENCES users(id)
recording_id    UUID REFERENCES recordings(id)
status          run_status (queued/running/passed/failed/cancelled)
job_id          VARCHAR -- BullMQ job ID
queue_name      VARCHAR -- 'test-runs'
browser         browser_type (chromium/firefox/webkit)
headless        BOOLEAN
video_enabled   BOOLEAN
screenshot_enabled BOOLEAN
timeout         INTEGER
timing_enabled  BOOLEAN
timing_mode     VARCHAR
speed_multiplier DECIMAL
actions_total   INTEGER
actions_executed INTEGER
actions_failed  INTEGER
actions_skipped INTEGER
duration_ms     INTEGER
started_at      TIMESTAMP
completed_at    TIMESTAMP
video_path      VARCHAR
screenshot_paths JSONB
error_message   TEXT
error_action_id VARCHAR
triggered_by    VARCHAR (manual/schedule/api)
ci_metadata     JSONB
created_at      TIMESTAMP
updated_at      TIMESTAMP
deleted_at      TIMESTAMP -- soft delete
```

### run_actions table
```sql
id              UUID PRIMARY KEY
run_id          UUID REFERENCES runs(id)
action_id       VARCHAR -- act_001, act_002
action_index    INTEGER
action_type     VARCHAR
status          action_status (success/failed/skipped/timeout)
started_at      TIMESTAMP
completed_at    TIMESTAMP
duration_ms     INTEGER
error_message   TEXT
screenshot_path VARCHAR
metadata        JSONB
```

## Error Handling

### Common Errors

| Code | Status | Description |
|------|--------|-------------|
| `RECORDING_NOT_FOUND` | 404 | Recording doesn't exist |
| `RUN_NOT_FOUND` | 404 | Run doesn't exist |
| `INVALID_RUN_STATUS` | 400 | Can't cancel completed run |
| `QUEUE_UNAVAILABLE` | 503 | Redis/BullMQ not connected |

### Run Failure Reasons

1. **Element not found**: Selector didn't match any element
2. **Timeout**: Action exceeded timeout (default 30s)
3. **Navigation error**: Page failed to load
4. **Browser crash**: Playwright process died

Error details are stored in `error_message` and `error_action_id` fields.

## Logging

### API Server Logs
```
[API] [07:28:40] INFO: Server listening at http://0.0.0.0:3001
```

### Worker Logs (Structured JSON)
```json
{
  "level": "info",
  "worker": "worker-16104",
  "timestamp": "2026-01-31T07:17:43.270Z",
  "message": "Job started",
  "jobId": "ec42b3d5",
  "runId": "ec42b3d5-50b1-459c-8b77-593e2bd1f99a"
}
```

Set `LOG_LEVEL=debug` for verbose output during development.

---

## Future Enhancements

### Run Cancellation (In Progress)
- POST /api/v1/runs/:id/cancel endpoint exists
- Browser process killing needs testing
- Partial result saving

### Real-time Progress (Phase 4)
- SSE endpoint for live action updates
- Web UI integration

### Video Streaming
- GET /api/v1/runs/:id/video endpoint
- Stream video without full download

### Cleanup Jobs
✅ **Implemented** - See [STORAGE.md](STORAGE.md) for full documentation:
- Old video cleanup (30-day retention, daily at 3:00 AM)
- Old screenshot cleanup (30-day retention, daily at 3:30 AM)
- Orphaned run cleanup (hourly)
