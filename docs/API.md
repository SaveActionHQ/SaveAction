# SaveAction REST API Documentation

> **Status:** Phase 3 - API Development  
> **Last Updated:** January 31, 2026

This document covers the SaveAction REST API (`@saveaction/api`). As features are implemented, this doc will be updated.

## API Versioning

All API endpoints (except health checks) are versioned under `/api/v1/`:

- **Versioned routes:** `/api/v1/auth/*`, `/api/v1/tokens/*`, `/api/v1/recordings/*`, `/api/v1/runs/*`
- **Unversioned routes:** `/api/health/*`, `/api/queues/*` (infrastructure endpoints)

This allows future breaking changes to be introduced in `/api/v2/` without affecting existing integrations.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Infrastructure](#infrastructure)
- [Database Schema](#database-schema)
- [Health Endpoints](#health-endpoints)
- [Queue Status](#queue-status)
- [Authentication](#authentication)
- [API Tokens](#api-tokens)
- [Recordings API](#recordings-api)
- [Runs API](#runs-api) _(planned)_
- [Schedules API](#schedules-api)

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

The SaveAction API uses JWT (JSON Web Tokens) for authentication. Access tokens are short-lived (15 min) and refresh tokens are long-lived (7 days).

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | **Yes** (prod) | - | Secret for signing JWTs (min 32 chars) |
| `JWT_REFRESH_SECRET` | No | `JWT_SECRET` | Separate secret for refresh tokens |

### Endpoints

#### POST /api/v1/auth/register

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "name": "John Doe"
}
```

**Password Requirements:**
- Minimum 8 characters
- Maximum 128 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "name": "John Doe",
      "emailVerifiedAt": null,
      "isActive": true,
      "createdAt": "2026-01-26T12:00:00.000Z",
      "updatedAt": "2026-01-26T12:00:00.000Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 900
    }
  }
}
```

**Error Responses:**

| Code | Error | Description |
|------|-------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid email or password format |
| 409 | `EMAIL_EXISTS` | Email already registered |

---

#### POST /api/v1/auth/login

Authenticate with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "name": "John Doe",
      "emailVerifiedAt": null,
      "isActive": true,
      "createdAt": "2026-01-26T12:00:00.000Z",
      "updatedAt": "2026-01-26T12:00:00.000Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 900
    }
  }
}
```

**Error Responses:**

| Code | Error | Description |
|------|-------|-------------|
| 401 | `INVALID_CREDENTIALS` | Wrong email or password |
| 403 | `USER_INACTIVE` | Account is deactivated |
| 423 | `USER_LOCKED` | Account temporarily locked (too many failed attempts) |

**Account Lockout (Brute Force Protection):**
- After 5 failed login attempts, account is locked for 15 minutes
- **Exponential Backoff:** Repeated lockouts double in duration (15min → 30min → 1hr → 2hr...), capped at 24 hours
- Failed attempts counter expires after 15 minutes of no attempts (TTL auto-expiry)
- Lockout state clears on successful login
- When Redis is available (recommended), lockout state is tracked in Redis for better performance
- Lockout events are logged for monitoring (`failed_attempt`, `lockout`, `unlock`, `manual_unlock`)

---

#### POST /api/v1/auth/logout

Logout and clear refresh token cookie.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

---

#### POST /api/v1/auth/refresh

Refresh the access token using a refresh token.

The refresh token can be provided:
1. Via httpOnly cookie (set automatically on login)
2. In the request body

**Request Body (optional):**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 900
    }
  }
}
```

**Error Responses:**

| Code | Error | Description |
|------|-------|-------------|
| 400 | `MISSING_TOKEN` | No refresh token provided |
| 401 | `INVALID_REFRESH_TOKEN` | Token invalid or expired |
| 403 | `USER_INACTIVE` | Account deactivated |
| 404 | `USER_NOT_FOUND` | User no longer exists |

---

#### GET /api/v1/auth/me

Get the current authenticated user's info.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "name": "John Doe",
      "emailVerifiedAt": null,
      "isActive": true,
      "createdAt": "2026-01-26T12:00:00.000Z",
      "updatedAt": "2026-01-26T12:00:00.000Z"
    }
  }
}
```

**Error Responses:**

| Code | Error | Description |
|------|-------|-------------|
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 404 | `USER_NOT_FOUND` | User no longer exists |

---

#### POST /api/v1/auth/change-password

Change the authenticated user's password.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "currentPassword": "OldPassword123",
  "newPassword": "NewPassword456"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Password changed successfully"
  }
}
```

**Error Responses:**

| Code | Error | Description |
|------|-------|-------------|
| 400 | `VALIDATION_ERROR` | New password doesn't meet requirements |
| 401 | `PASSWORD_MISMATCH` | Current password is incorrect |
| 401 | `UNAUTHORIZED` | Not authenticated |

---

#### POST /api/v1/auth/forgot-password

Request a password reset email. Always returns success to prevent email enumeration.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "If an account with that email exists, a password reset link has been sent"
  }
}
```

**Notes:**
- Always returns success, even if email doesn't exist (security measure)
- Reset token is valid for 1 hour
- Requires SMTP configuration (see environment variables below)
- In development, if SMTP is not configured, logs the reset link to console

**SMTP Environment Variables:**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SMTP_HOST` | No | - | SMTP server hostname |
| `SMTP_PORT` | No | `587` | SMTP server port |
| `SMTP_SECURE` | No | `false` | Use TLS |
| `SMTP_USER` | No | - | SMTP username |
| `SMTP_PASS` | No | - | SMTP password |
| `SMTP_FROM` | No | `noreply@saveaction.dev` | Sender email |
| `SMTP_FROM_NAME` | No | `SaveAction` | Sender name |
| `APP_BASE_URL` | No | `http://localhost:3000` | Base URL for reset links |

---

#### POST /api/v1/auth/reset-password

Reset password using the token from the email.

**Request Body:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "newPassword": "NewSecurePass123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Password reset successfully"
  }
}
```

**Error Responses:**

| Code | Error | Description |
|------|-------|-------------|
| 400 | `VALIDATION_ERROR` | Password doesn't meet requirements |
| 400 | `INVALID_RESET_TOKEN` | Token is invalid, expired, or already used |
| 404 | `USER_NOT_FOUND` | User no longer exists |

**Password Reset Flow:**

```
User forgot password
        │
        ▼
POST /api/v1/auth/forgot-password (email)
        │
        ▼
Email with reset link sent
(link contains JWT token valid for 1 hour)
        │
        ▼
User clicks link → Frontend
        │
        ▼
POST /api/v1/auth/reset-password (token + new password)
        │
        ▼
Password updated, can login with new password
```

### Using Access Tokens

Include the access token in the `Authorization` header for protected endpoints:

```http
GET /api/v1/auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Lifecycle

```
Registration/Login → Access Token (15 min) + Refresh Token (7 days)
                              │
                              ▼
              Token expires → POST /api/v1/auth/refresh
                              │
                              ▼
                     New Access Token (15 min)
```

### Security Features

| Feature | Description |
|---------|-------------|
| **Password Hashing** | bcrypt with 12 salt rounds |
| **Account Lockout** | 5 failed attempts → 15 min lockout |
| **Refresh Token Rotation** | New refresh token on each refresh |
| **httpOnly Cookies** | Refresh tokens stored in httpOnly cookies |
| **IP Tracking** | Last login IP stored for audit |
| **Soft Delete** | Users can be deactivated without data loss |

---

## API Tokens

API tokens provide programmatic access to the SaveAction API. They are ideal for CI/CD pipelines and automation scripts.

### Token Format

- **Full Token:** `sa_live_<32-character-random-string>`
- **Display Format:** `sa_live_abc...xyz` (prefix + suffix, full token never shown again)
- **Storage:** SHA-256 hash stored in database (raw token never stored)

### Available Scopes

| Scope | Description |
|-------|-------------|
| `recordings:read` | Read recordings |
| `recordings:write` | Create, update, delete recordings |
| `runs:read` | Read test run results |
| `runs:write` | Execute test runs |
| `*` | All permissions |

### Endpoints

All API token endpoints require JWT authentication.

---

#### POST /api/v1/tokens

Create a new API token.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "name": "CI/CD Pipeline Token",
  "scopes": ["recordings:read", "runs:write"],
  "expiresAt": "2027-01-01T00:00:00.000Z"
}
```

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `name` | Yes | string | Token name (1-255 chars) |
| `scopes` | No | string[] | Permissions (default: all) |
| `expiresAt` | No | ISO 8601 | Expiration date (null = never) |

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "CI/CD Pipeline Token",
    "token": "sa_live_abc123def456ghi789jkl012mno345pq",
    "tokenPrefix": "sa_live_abc",
    "tokenSuffix": "345pq",
    "scopes": ["recordings:read", "runs:write"],
    "expiresAt": "2027-01-01T00:00:00.000Z",
    "createdAt": "2026-01-30T12:00:00.000Z"
  }
}
```

> ⚠️ **Important:** The full `token` value is only shown once. Store it securely!

**Error Responses:**

| Code | Error | Description |
|------|-------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid request data |
| 401 | `UNAUTHORIZED` | Not authenticated |
| 409 | `TOKEN_LIMIT_REACHED` | Maximum tokens per user (10) |

---

#### GET /api/v1/tokens

List all tokens for the authenticated user.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `active` | boolean | false | Only return active (non-revoked, non-expired) tokens |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "tokens": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "CI/CD Pipeline Token",
        "tokenPrefix": "sa_live_abc",
        "tokenSuffix": "345pq",
        "scopes": ["recordings:read", "runs:write"],
        "lastUsedAt": "2026-01-30T10:00:00.000Z",
        "useCount": 42,
        "expiresAt": "2027-01-01T00:00:00.000Z",
        "revokedAt": null,
        "createdAt": "2026-01-30T12:00:00.000Z"
      }
    ],
    "total": 1
  }
}
```

---

#### GET /api/v1/tokens/:id

Get details of a specific token.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "CI/CD Pipeline Token",
    "tokenPrefix": "sa_live_abc",
    "tokenSuffix": "345pq",
    "scopes": ["recordings:read", "runs:write"],
    "lastUsedAt": "2026-01-30T10:00:00.000Z",
    "useCount": 42,
    "expiresAt": "2027-01-01T00:00:00.000Z",
    "revokedAt": null,
    "createdAt": "2026-01-30T12:00:00.000Z"
  }
}
```

**Error Responses:**

| Code | Error | Description |
|------|-------|-------------|
| 401 | `UNAUTHORIZED` | Not authenticated |
| 404 | `TOKEN_NOT_FOUND` | Token does not exist or not owned by user |

---

#### POST /api/v1/tokens/:id/revoke

Revoke a token (soft delete - can be viewed but not used).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body (optional):**
```json
{
  "reason": "Compromised token"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "CI/CD Pipeline Token",
    "revokedAt": "2026-01-30T14:00:00.000Z"
  }
}
```

**Error Responses:**

| Code | Error | Description |
|------|-------|-------------|
| 400 | `TOKEN_ALREADY_REVOKED` | Token was already revoked |
| 404 | `TOKEN_NOT_FOUND` | Token does not exist |

---

#### DELETE /api/v1/tokens/:id

Permanently delete a token.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Token deleted successfully"
  }
}
```

**Error Responses:**

| Code | Error | Description |
|------|-------|-------------|
| 404 | `TOKEN_NOT_FOUND` | Token does not exist |

---

## Recordings API

Recordings are test scripts captured by the SaveAction browser extension. They contain a sequence of user actions (clicks, inputs, navigation) that can be replayed for automated testing.

### Recording Data Structure

A recording contains:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Original recording ID from extension (rec_*) |
| `testName` | string | Name of the test |
| `url` | string | Starting URL |
| `startTime` | ISO 8601 | When recording started |
| `endTime` | ISO 8601 | When recording ended |
| `viewport` | object | Browser viewport size |
| `userAgent` | string | Browser user agent |
| `actions` | array | Array of recorded actions |
| `version` | string | Recording schema version |

### Endpoints

All recording endpoints require JWT authentication.

---

#### POST /api/v1/recordings

Upload a new recording.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Login Test",
  "description": "Tests the login flow",
  "tags": ["smoke", "auth"],
  "data": {
    "id": "rec_1234567890",
    "testName": "Login Test",
    "url": "https://example.com/login",
    "startTime": "2026-01-30T10:00:00.000Z",
    "endTime": "2026-01-30T10:01:00.000Z",
    "viewport": { "width": 1920, "height": 1080 },
    "userAgent": "Mozilla/5.0...",
    "actions": [
      { "id": "act_001", "type": "click", "timestamp": 1000, "url": "https://example.com" },
      { "id": "act_002", "type": "input", "timestamp": 2000, "url": "https://example.com" }
    ],
    "version": "1.0.0"
  }
}
```

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `data` | Yes | object | Recording JSON from browser extension |
| `name` | No | string | Custom name (defaults to data.testName) |
| `description` | No | string | Description (max 2000 chars) |
| `tags` | No | string[] | Tags for organization (max 20) |

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Login Test",
    "url": "https://example.com/login",
    "description": "Tests the login flow",
    "tags": ["smoke", "auth"],
    "actionCount": 2,
    "createdAt": "2026-01-30T12:00:00.000Z"
  }
}
```

**Error Responses:**

| Code | Error | Description |
|------|-------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid recording data |
| 400 | `INVALID_DATA` | Recording fails validation |
| 409 | `DUPLICATE_ORIGINAL_ID` | Recording with this original ID already exists |
| 413 | `TOO_LARGE` | Recording exceeds 10MB limit |

---

#### GET /api/v1/recordings

List recordings with filtering and pagination.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | 1 | Page number (1-based) |
| `limit` | integer | 20 | Items per page (max 100) |
| `search` | string | - | Search in name and description |
| `tags` | string | - | Filter by tags (comma-separated) |
| `url` | string | - | Filter by starting URL |
| `sortBy` | string | `updatedAt` | Sort field: `name`, `createdAt`, `updatedAt`, `actionCount` |
| `sortOrder` | string | `desc` | Sort order: `asc`, `desc` |
| `includeDeleted` | boolean | false | Include soft-deleted recordings |

**Example:**
```
GET /api/v1/recordings?page=1&limit=10&tags=smoke,auth&sortBy=name&sortOrder=asc
```

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Login Test",
      "url": "https://example.com/login",
      "description": "Tests the login flow",
      "originalId": "rec_1234567890",
      "tags": ["smoke", "auth"],
      "actionCount": 2,
      "estimatedDurationMs": 60000,
      "schemaVersion": "1.0.0",
      "dataSizeBytes": 1500,
      "createdAt": "2026-01-30T12:00:00.000Z",
      "updatedAt": "2026-01-30T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1,
    "hasNext": false,
    "hasPrevious": false
  }
}
```

---

#### GET /api/v1/recordings/tags

Get all tags used by the current user.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": ["smoke", "auth", "checkout", "regression"]
}
```

---

#### GET /api/v1/recordings/:id

Get a specific recording with full data.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Login Test",
    "url": "https://example.com/login",
    "description": "Tests the login flow",
    "originalId": "rec_1234567890",
    "tags": ["smoke", "auth"],
    "data": {
      "id": "rec_1234567890",
      "testName": "Login Test",
      "url": "https://example.com/login",
      "actions": [...],
      "version": "1.0.0"
    },
    "actionCount": 2,
    "estimatedDurationMs": 60000,
    "schemaVersion": "1.0.0",
    "dataSizeBytes": 1500,
    "deletedAt": null,
    "createdAt": "2026-01-30T12:00:00.000Z",
    "updatedAt": "2026-01-30T12:00:00.000Z"
  }
}
```

**Error Responses:**

| Code | Error | Description |
|------|-------|-------------|
| 403 | `NOT_AUTHORIZED` | Recording belongs to another user |
| 404 | `RECORDING_NOT_FOUND` | Recording does not exist |

---

#### GET /api/v1/recordings/:id/export

Download recording as JSON file (for CLI import).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response Headers:**
```
Content-Type: application/json
Content-Disposition: attachment; filename="Login Test.json"
```

**Response Body:**
Returns the raw recording JSON data, suitable for use with the SaveAction CLI:

```bash
# Download and run
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/v1/recordings/550e8400.../export" \
  -o recording.json

saveaction run recording.json
```

---

#### PUT /api/v1/recordings/:id

Update a recording's metadata or data.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Updated Login Test",
  "description": "Updated description",
  "tags": ["smoke", "auth", "critical"],
  "data": { ... }
}
```

All fields are optional. Only provided fields are updated.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Updated Login Test",
    "url": "https://example.com/login",
    "description": "Updated description",
    "tags": ["smoke", "auth", "critical"],
    "actionCount": 2,
    "updatedAt": "2026-01-30T14:00:00.000Z"
  }
}
```

**Error Responses:**

| Code | Error | Description |
|------|-------|-------------|
| 403 | `NOT_AUTHORIZED` | Recording belongs to another user |
| 404 | `RECORDING_NOT_FOUND` | Recording does not exist |
| 413 | `TOO_LARGE` | Updated data exceeds 10MB limit |

---

#### DELETE /api/v1/recordings/:id

Soft delete a recording (can be restored).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Recording deleted successfully"
}
```

**Error Responses:**

| Code | Error | Description |
|------|-------|-------------|
| 403 | `NOT_AUTHORIZED` | Recording belongs to another user |
| 404 | `RECORDING_NOT_FOUND` | Recording does not exist |

---

#### POST /api/v1/recordings/:id/restore

Restore a soft-deleted recording.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Login Test",
    "deletedAt": null,
    "updatedAt": "2026-01-30T15:00:00.000Z"
  }
}
```

**Error Responses:**

| Code | Error | Description |
|------|-------|-------------|
| 400 | `NOT_DELETED` | Recording is not deleted |
| 403 | `NOT_AUTHORIZED` | Recording belongs to another user |
| 404 | `RECORDING_NOT_FOUND` | Recording does not exist |

---

#### DELETE /api/v1/recordings/:id/permanent

Permanently delete a recording (cannot be undone).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Recording permanently deleted"
}
```

**Error Responses:**

| Code | Error | Description |
|------|-------|-------------|
| 403 | `NOT_AUTHORIZED` | Recording belongs to another user |
| 404 | `RECORDING_NOT_FOUND` | Recording does not exist |

---

## Runs API

> 🚧 **Coming Soon** - Test execution and results

---

## Schedules API

The Schedules API allows you to create and manage scheduled test runs. Schedules use cron expressions to define when tests should run and integrate with BullMQ for reliable job execution.

### Base URL

```
/api/v1/schedules
```

---

#### POST /api/v1/schedules

Create a new schedule for a recording.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "recordingId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Daily Smoke Tests",
  "description": "Run smoke tests every morning",
  "cronExpression": "0 9 * * *",
  "timezone": "America/New_York",
  "runConfig": {
    "browser": "chromium",
    "headless": true,
    "timeout": 30000,
    "retries": 2
  },
  "startsAt": "2026-02-01T00:00:00Z",
  "endsAt": "2026-12-31T23:59:59Z",
  "notifyOnFailure": true,
  "notifyOnSuccess": false,
  "notificationEmails": "alerts@example.com"
}
```

**Required Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `recordingId` | UUID | Recording to execute |
| `name` | string | Schedule name (1-255 chars) |
| `cronExpression` | string | Cron pattern (e.g., `0 9 * * *`) |

**Optional Fields:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `description` | string | null | Schedule description |
| `timezone` | string | UTC | IANA timezone name |
| `runConfig` | object | null | Execution configuration |
| `runConfig.browser` | string | chromium | Browser: chromium, firefox, webkit |
| `runConfig.headless` | boolean | true | Headless mode |
| `runConfig.timeout` | number | 30000 | Timeout in ms (1000-600000) |
| `runConfig.retries` | number | 0 | Retry count (0-5) |
| `startsAt` | ISO 8601 | null | Schedule start date |
| `endsAt` | ISO 8601 | null | Schedule end date |
| `notifyOnFailure` | boolean | true | Email on test failure |
| `notifyOnSuccess` | boolean | false | Email on test success |
| `notificationEmails` | string | null | Comma-separated emails |

**Cron Expression Format:**
```
┌───────────── minute (0-59)
│ ┌───────────── hour (0-23)
│ │ ┌───────────── day of month (1-31)
│ │ │ ┌───────────── month (1-12)
│ │ │ │ ┌───────────── day of week (0-7, 0=Sunday)
│ │ │ │ │
* * * * *
```

**Common Cron Examples:**
| Expression | Description |
|------------|-------------|
| `* * * * *` | Every minute |
| `0 9 * * *` | Daily at 9:00 AM |
| `0 9 * * 1-5` | Weekdays at 9:00 AM |
| `0 0 * * 0` | Weekly on Sunday at midnight |
| `0 0 1 * *` | Monthly on 1st at midnight |

**Success Response (201):**
```json
{
  "schedule": {
    "id": "sched-550e8400-e29b-41d4-a716-446655440000",
    "userId": "user-123",
    "recordingId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Daily Smoke Tests",
    "description": "Run smoke tests every morning",
    "cronExpression": "0 9 * * *",
    "timezone": "America/New_York",
    "status": "active",
    "runConfig": {
      "browser": "chromium",
      "headless": true,
      "timeout": 30000,
      "retries": 2
    },
    "nextRunAt": "2026-02-01T14:00:00.000Z",
    "totalRuns": 0,
    "successfulRuns": 0,
    "failedRuns": 0,
    "createdAt": "2026-01-31T12:00:00.000Z",
    "updatedAt": "2026-01-31T12:00:00.000Z"
  }
}
```

**Error Responses:**

| Code | Error | Description |
|------|-------|-------------|
| 400 | `INVALID_CRON` | Invalid cron expression |
| 400 | `INVALID_TIMEZONE` | Invalid timezone |
| 400 | `MAX_SCHEDULES_REACHED` | User has too many schedules |
| 404 | `RECORDING_NOT_FOUND` | Recording does not exist |

---

#### GET /api/v1/schedules

List schedules for the authenticated user.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max 100) |
| `recordingId` | UUID | - | Filter by recording |
| `status` | string | - | Filter by status: active, paused, disabled |
| `sortBy` | string | createdAt | Sort field: createdAt, name, nextRunAt, status |
| `sortOrder` | string | desc | Sort direction: asc, desc |
| `includeDeleted` | boolean | false | Include soft-deleted schedules |

**Success Response (200):**
```json
{
  "schedules": [
    {
      "id": "sched-550e8400-e29b-41d4-a716-446655440000",
      "recordingId": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Daily Smoke Tests",
      "cronExpression": "0 9 * * *",
      "timezone": "America/New_York",
      "status": "active",
      "nextRunAt": "2026-02-01T14:00:00.000Z",
      "lastRunAt": "2026-01-31T14:00:00.000Z",
      "lastRunStatus": "passed",
      "totalRuns": 10,
      "successfulRuns": 9,
      "failedRuns": 1,
      "createdAt": "2026-01-15T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1,
    "hasNext": false,
    "hasPrevious": false
  }
}
```

---

#### GET /api/v1/schedules/:id

Get a specific schedule by ID.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Success Response (200):**
```json
{
  "schedule": {
    "id": "sched-550e8400-e29b-41d4-a716-446655440000",
    "userId": "user-123",
    "recordingId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Daily Smoke Tests",
    "description": "Run smoke tests every morning",
    "cronExpression": "0 9 * * *",
    "timezone": "America/New_York",
    "status": "active",
    "startsAt": "2026-02-01T00:00:00.000Z",
    "endsAt": "2026-12-31T23:59:59.000Z",
    "bullmqJobKey": "schedule:sched-550e8400",
    "bullmqJobPattern": "0 9 * * *",
    "runConfig": {
      "browser": "chromium",
      "headless": true,
      "timeout": 30000,
      "retries": 2
    },
    "maxConcurrent": 1,
    "maxDailyRuns": null,
    "runsToday": 1,
    "runsThisMonth": 15,
    "lastRunId": "run-123",
    "lastRunAt": "2026-01-31T14:00:00.000Z",
    "lastRunStatus": "passed",
    "nextRunAt": "2026-02-01T14:00:00.000Z",
    "totalRuns": 15,
    "successfulRuns": 14,
    "failedRuns": 1,
    "notifyOnFailure": true,
    "notifyOnSuccess": false,
    "notificationEmails": "alerts@example.com",
    "deletedAt": null,
    "createdAt": "2026-01-15T12:00:00.000Z",
    "updatedAt": "2026-01-31T14:00:00.000Z"
  }
}
```

**Error Responses:**

| Code | Error | Description |
|------|-------|-------------|
| 403 | `NOT_AUTHORIZED` | Schedule belongs to another user |
| 404 | `SCHEDULE_NOT_FOUND` | Schedule does not exist |

---

#### PUT /api/v1/schedules/:id

Update a schedule.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Updated Schedule Name",
  "cronExpression": "0 10 * * *",
  "timezone": "Europe/London"
}
```

All fields are optional. Only include fields you want to update.

**Success Response (200):**
```json
{
  "schedule": {
    "id": "sched-550e8400-e29b-41d4-a716-446655440000",
    "name": "Updated Schedule Name",
    "cronExpression": "0 10 * * *",
    "timezone": "Europe/London",
    "nextRunAt": "2026-02-01T10:00:00.000Z",
    ...
  }
}
```

**Error Responses:**

| Code | Error | Description |
|------|-------|-------------|
| 400 | `INVALID_CRON` | Invalid cron expression |
| 400 | `INVALID_TIMEZONE` | Invalid timezone |
| 403 | `NOT_AUTHORIZED` | Schedule belongs to another user |
| 404 | `SCHEDULE_NOT_FOUND` | Schedule does not exist |

---

#### POST /api/v1/schedules/:id/toggle

Toggle schedule status between active and paused.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Success Response (200):**
```json
{
  "schedule": {
    "id": "sched-550e8400-e29b-41d4-a716-446655440000",
    "status": "paused",
    ...
  },
  "message": "Schedule paused"
}
```

When pausing, the BullMQ repeatable job is removed. When activating, a new repeatable job is created.

---

#### DELETE /api/v1/schedules/:id

Soft delete a schedule.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Schedule deleted"
}
```

**Error Responses:**

| Code | Error | Description |
|------|-------|-------------|
| 403 | `NOT_AUTHORIZED` | Schedule belongs to another user |
| 404 | `SCHEDULE_NOT_FOUND` | Schedule does not exist |

---

#### POST /api/v1/schedules/:id/restore

Restore a soft-deleted schedule.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Success Response (200):**
```json
{
  "schedule": {
    "id": "sched-550e8400-e29b-41d4-a716-446655440000",
    "status": "paused",
    "deletedAt": null,
    ...
  },
  "message": "Schedule restored"
}
```

**Note:** Restored schedules are set to `paused` status. Use toggle to reactivate.

---

#### DELETE /api/v1/schedules/:id/permanent

Permanently delete a schedule (cannot be undone).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Requirement:** Schedule must be soft-deleted first.

**Success Response (200):**
```json
{
  "success": true,
  "message": "Schedule permanently deleted"
}
```

---

### Schedule Status Values

| Status | Description |
|--------|-------------|
| `active` | Schedule is running on cron pattern |
| `paused` | Schedule is paused, no runs triggered |
| `disabled` | Schedule was soft-deleted |

---

## Changelog

| Date | Changes |
|------|---------|
| 2026-01-30 | Added Recordings CRUD API (upload, list, get, update, delete, restore, export) |
| 2026-01-30 | Added API Tokens management (create, list, get, revoke, delete) |
| 2026-01-27 | Added password reset flow (forgot-password, reset-password) |
| 2026-01-26 | Added user authentication (register, login, logout, refresh, me, change-password) |
| 2026-01-26 | Initial documentation with infrastructure, database schema, health endpoints |
