# SaveAction REST API Documentation

> **Status:** Work in Progress  
> **Last Updated:** January 26, 2026

This document covers the SaveAction REST API (`@saveaction/api`). As features are implemented, this doc will be updated.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Infrastructure](#infrastructure)
- [Database Schema](#database-schema)
- [Health Endpoints](#health-endpoints)
- [Queue Status](#queue-status)
- [Authentication](#authentication) _(planned)_
- [Recordings API](#recordings-api) _(planned)_
- [Runs API](#runs-api) _(planned)_

---

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (for PostgreSQL and Redis)
- pnpm

### Local Development Setup

```bash
# 1. Start database services
docker compose -f docker-compose.dev.yml up -d

# 2. Install dependencies
pnpm install

# 3. Build packages
pnpm build

# 4. Start API server (with hot reload)
cd packages/api
pnpm dev
```

### Environment Variables

Create a `.env` file in `packages/api/` (see `.env.example`):

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Environment mode |
| `API_PORT` | No | `3000` | Server port |
| `API_HOST` | No | `0.0.0.0` | Server host |
| `CORS_ORIGIN` | No | `*` | Allowed origins (comma-separated) |
| `LOG_LEVEL` | No | `info` | Pino log level |
| `DATABASE_URL` | No | - | Full PostgreSQL connection string |
| `DB_HOST` | No | `localhost` | PostgreSQL host |
| `DB_PORT` | No | `5432` | PostgreSQL port |
| `DB_NAME` | No | `saveaction` | Database name |
| `DB_USER` | No | `saveaction` | Database user |
| `DB_PASSWORD` | No | `saveaction_dev` | Database password |
| `DB_SSL` | No | `false` | Enable SSL |
| `DB_POOL_MIN` | No | `2` | Minimum pool connections |
| `DB_POOL_MAX` | No | `10` | Maximum pool connections |
| `REDIS_URL` | No | - | Redis connection URL |

---

## Infrastructure

### Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Framework | Fastify | 4.x |
| Database | PostgreSQL | 16 |
| ORM | Drizzle ORM | 0.45.x |
| Cache/Queue | Redis | 7 |
| Job Queue | BullMQ | 5.x |
| Validation | Zod | 3.22.x |

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Fastify Server                          │
├─────────────────────────────────────────────────────────────┤
│  Plugins:                                                    │
│  ├── @fastify/cors        (CORS handling)                   │
│  ├── @fastify/sensible    (Error utilities)                 │
│  ├── errorHandler         (Custom error handling)           │
│  ├── databasePlugin       (PostgreSQL + Drizzle)            │
│  ├── redisConnectionPlugin (Redis client)                   │
│  └── bullmqConnectionPlugin (Job queues)                    │
├─────────────────────────────────────────────────────────────┤
│  Services:                                                   │
│  ├── PostgreSQL (Drizzle ORM)                               │
│  ├── Redis (ioredis)                                        │
│  └── BullMQ (Job Queues)                                    │
└─────────────────────────────────────────────────────────────┘
```

### Job Queues

Three BullMQ queues are configured:

| Queue | Concurrency | Purpose |
|-------|-------------|---------|
| `test-runs` | 5 | Execute test recordings |
| `cleanup` | 1 | Cleanup old files/data |
| `scheduled-tests` | 3 | Scheduled test execution |

Features:
- Persistent jobs (survive restart)
- Retry with exponential backoff
- Job prioritization
- Repeatable jobs (cron schedules)

---

## Database Schema

### Overview

8 tables with PostgreSQL-native features:

| Table | Purpose |
|-------|---------|
| `users` | User accounts |
| `api_tokens` | API authentication tokens |
| `recordings` | Test recording storage |
| `runs` | Test execution history |
| `run_actions` | Per-action execution results |
| `schedules` | Cron-scheduled test runs |
| `webhooks` | Event notification config |
| `webhook_deliveries` | Webhook delivery log |

### Entity Relationship Diagram

```
┌─────────────┐       ┌──────────────┐       ┌─────────────┐
│   users     │──1:N──│  api_tokens  │       │  webhooks   │
│             │       └──────────────┘       │             │
│             │                              │             │
│             │──1:N──┌──────────────┐       └──────┬──────┘
│             │       │  recordings  │              │
│             │       └──────┬───────┘              │1:N
│             │              │1:N                   │
│             │              ▼                      ▼
│             │──1:N──┌──────────────┐       ┌─────────────────────┐
│             │       │    runs      │       │ webhook_deliveries  │
│             │       └──────┬───────┘       └─────────────────────┘
│             │              │1:N
│             │              ▼
│             │       ┌──────────────┐
│             │       │ run_actions  │
│             │       └──────────────┘
│             │
│             │──1:N──┌──────────────┐
└─────────────┘       │  schedules   │
                      └──────────────┘
```

### Tables Detail

#### users

Core user accounts with enterprise security features.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (gen_random_uuid) |
| `email` | VARCHAR(255) | Unique, case-insensitive |
| `password_hash` | VARCHAR(255) | bcrypt hash |
| `name` | VARCHAR(255) | Display name |
| `email_verified_at` | TIMESTAMPTZ | Verification timestamp |
| `failed_login_attempts` | VARCHAR(10) | Brute-force counter |
| `locked_until` | TIMESTAMPTZ | Account lockout time |
| `last_login_at` | TIMESTAMPTZ | Last login timestamp |
| `last_login_ip` | VARCHAR(45) | IPv4/IPv6 address |
| `is_active` | BOOLEAN | Account active status |
| `deleted_at` | TIMESTAMPTZ | Soft delete timestamp |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

**Indexes:**
- `users_email_unique_idx` - Unique on LOWER(email)
- `users_active_idx` - Partial index (non-deleted, active)
- `users_locked_until_idx` - Partial index (locked accounts)

#### api_tokens

API authentication tokens for programmatic access.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK → users.id (CASCADE) |
| `name` | VARCHAR(255) | Token name/description |
| `token_hash` | VARCHAR(255) | SHA-256 hash (never store raw) |
| `token_prefix` | VARCHAR(20) | Display prefix (sa_live_) |
| `token_suffix` | VARCHAR(8) | Display suffix (...xyz) |
| `scopes` | TEXT | JSON array of permissions |
| `last_used_at` | TIMESTAMPTZ | Last usage timestamp |
| `last_used_ip` | VARCHAR(45) | Last usage IP |
| `use_count` | VARCHAR(20) | Usage counter |
| `expires_at` | TIMESTAMPTZ | Expiration time |
| `revoked_at` | TIMESTAMPTZ | Revocation time |
| `revoked_reason` | VARCHAR(255) | Revocation reason |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

**Token Format:** `sa_live_<32-char-random>`  
**Display Format:** `sa_live_abc...xyz` (prefix + suffix only)

#### recordings

Test recordings with full JSON data stored as JSONB.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK → users.id (CASCADE) |
| `name` | VARCHAR(255) | Test name |
| `url` | VARCHAR(2048) | Starting URL |
| `description` | TEXT | Optional description |
| `original_id` | VARCHAR(50) | Extension recording ID |
| `tags` | TEXT | JSON array of tags |
| `data` | JSONB | Full recording JSON |
| `action_count` | VARCHAR(10) | Number of actions |
| `estimated_duration_ms` | VARCHAR(20) | Estimated run time |
| `schema_version` | VARCHAR(20) | Recording schema version |
| `data_size_bytes` | VARCHAR(20) | Recording size |
| `deleted_at` | TIMESTAMPTZ | Soft delete |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

**Indexes:**
- `recordings_tags_gin_idx` - GIN index on tags (JSONB)
- `recordings_data_gin_idx` - GIN index on data (deep queries)

#### runs

Test execution history with BullMQ job tracking.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK → users.id (CASCADE) |
| `recording_id` | UUID | FK → recordings.id (SET NULL) |
| `recording_name` | VARCHAR(255) | Snapshot of name |
| `recording_url` | VARCHAR(2048) | Snapshot of URL |
| `status` | ENUM | queued/running/passed/failed/cancelled/skipped |
| `job_id` | VARCHAR(100) | BullMQ job ID |
| `queue_name` | VARCHAR(50) | BullMQ queue name |
| `browser` | ENUM | chromium/firefox/webkit |
| `headless` | BOOLEAN | Headless mode |
| `video_enabled` | BOOLEAN | Video recording |
| `screenshot_enabled` | BOOLEAN | Screenshot capture |
| `timeout` | VARCHAR(20) | Timeout in ms |
| `actions_total` | VARCHAR(10) | Total actions |
| `actions_executed` | VARCHAR(10) | Executed count |
| `actions_failed` | VARCHAR(10) | Failed count |
| `duration_ms` | VARCHAR(20) | Total duration |
| `started_at` | TIMESTAMPTZ | Execution start |
| `completed_at` | TIMESTAMPTZ | Execution end |
| `video_path` | VARCHAR(500) | Video file path |
| `error_message` | TEXT | Error message |
| `error_stack` | TEXT | Error stack trace |
| `triggered_by` | VARCHAR(50) | manual/schedule/api |
| `schedule_id` | UUID | Related schedule |
| `ci_metadata` | TEXT | JSON CI context |
| `deleted_at` | TIMESTAMPTZ | Soft delete |

**Status Enum Values:**
- `queued` - Waiting in BullMQ queue
- `running` - Currently executing
- `passed` - All actions successful
- `failed` - One or more actions failed
- `cancelled` - Manually cancelled or timeout
- `skipped` - Skipped (dependency failed)

#### run_actions

Per-action execution results for detailed reporting.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `run_id` | UUID | FK → runs.id (CASCADE) |
| `action_id` | VARCHAR(50) | Action ID (act_001) |
| `action_type` | VARCHAR(50) | click/input/etc |
| `action_index` | VARCHAR(10) | Execution order |
| `status` | ENUM | success/failed/skipped/timeout |
| `duration_ms` | VARCHAR(20) | Action duration |
| `selector_used` | VARCHAR(50) | Selector strategy that worked |
| `selector_value` | TEXT | Actual selector value |
| `retry_count` | VARCHAR(10) | Number of retries |
| `error_message` | TEXT | Error if failed |
| `screenshot_path` | VARCHAR(500) | Screenshot path |
| `page_url` | VARCHAR(2048) | Page URL at action |

#### schedules

Cron-scheduled test runs with BullMQ repeatable jobs.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK → users.id (CASCADE) |
| `recording_id` | UUID | FK → recordings.id (CASCADE) |
| `name` | VARCHAR(255) | Schedule name |
| `cron_expression` | VARCHAR(100) | Cron pattern |
| `timezone` | VARCHAR(100) | Timezone (default: UTC) |
| `status` | ENUM | active/paused/disabled/expired |
| `bullmq_job_key` | VARCHAR(255) | BullMQ repeatable key |
| `run_config` | JSONB | Execution configuration |
| `next_run_at` | TIMESTAMPTZ | Next scheduled run |
| `last_run_at` | TIMESTAMPTZ | Last run timestamp |
| `total_runs` | VARCHAR(20) | Total run count |
| `successful_runs` | VARCHAR(20) | Success count |
| `failed_runs` | VARCHAR(20) | Failure count |

#### webhooks

Event notification configuration with HMAC secrets.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK → users.id (CASCADE) |
| `name` | VARCHAR(255) | Webhook name |
| `url` | VARCHAR(2048) | Delivery URL |
| `secret` | VARCHAR(255) | HMAC-SHA256 secret |
| `status` | ENUM | active/paused/disabled/suspended |
| `events` | JSONB | Subscribed event types |
| `consecutive_failures` | VARCHAR(10) | Failure counter |
| `suspend_after_failures` | VARCHAR(10) | Auto-suspend threshold |

**Webhook Events:**
- `run.started`, `run.completed`, `run.passed`, `run.failed`, `run.cancelled`
- `recording.created`, `recording.updated`, `recording.deleted`
- `schedule.triggered`, `schedule.failed`, `schedule.paused`
- `api_token.created`, `api_token.expired`

#### webhook_deliveries

Audit log for all webhook delivery attempts.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `webhook_id` | UUID | FK → webhooks.id (CASCADE) |
| `event_type` | VARCHAR(100) | Event that triggered |
| `payload` | JSONB | Sent payload |
| `success` | BOOLEAN | Delivery success |
| `response_code` | VARCHAR(10) | HTTP response code |
| `response_time_ms` | VARCHAR(10) | Response time |
| `error_message` | TEXT | Error if failed |
| `delivered_at` | TIMESTAMPTZ | Delivery timestamp |

### Database Commands

```bash
# Generate migration from schema changes
pnpm db:generate

# Push schema to database (dev only)
pnpm db:push

# Run migrations
pnpm db:migrate

# Open Drizzle Studio (database GUI)
pnpm db:studio
```

---

## Health Endpoints

### GET /api/health

Basic health check.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-26T00:00:00.000Z",
  "version": "0.1.0"
}
```

### GET /api/health/detailed

Detailed health with all service statuses.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-26T00:00:00.000Z",
  "version": "0.1.0",
  "services": {
    "api": { "status": "healthy" },
    "database": {
      "status": "healthy",
      "latencyMs": 2
    },
    "redis": {
      "status": "healthy",
      "latencyMs": 1
    },
    "queues": {
      "status": "healthy"
    }
  }
}
```

**Status Values:**
- `healthy` - Service is operational
- `unhealthy` - Service is down
- `not_configured` - Service not enabled

### GET /api/health/live

Kubernetes liveness probe.

**Response:** `{ "status": "ok" }`

### GET /api/health/ready

Kubernetes readiness probe. Returns 503 if critical services are down.

**Response (ready):** `{ "status": "ready" }`  
**Response (not ready):** `{ "status": "not_ready", "reason": "..." }`

---

## Queue Status

### GET /api/queues/status

Get status of all job queues.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-26T00:00:00.000Z",
  "queues": {
    "test-runs": {
      "waiting": 0,
      "active": 0,
      "completed": 150,
      "failed": 3,
      "delayed": 0,
      "paused": false
    },
    "cleanup": { ... },
    "scheduled-tests": { ... }
  },
  "workers": {
    "test-runs": { "running": true, "concurrency": 5 },
    "cleanup": { "running": true, "concurrency": 1 },
    "scheduled-tests": { "running": true, "concurrency": 3 }
  }
}
```

---

## Error Response Format

All errors follow a consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": { ... },
    "requestId": "uuid"
  }
}
```

**Common Error Codes:**

| Code | HTTP | Description |
|------|------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Authentication

> 🚧 **Coming Soon** - JWT + API Token authentication

---

## Recordings API

> 🚧 **Coming Soon** - CRUD operations for recordings

---

## Runs API

> 🚧 **Coming Soon** - Test execution and results

---

## Changelog

| Date | Changes |
|------|---------|
| 2026-01-26 | Initial documentation with infrastructure, database schema, health endpoints |
