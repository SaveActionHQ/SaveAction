# SaveAction Platform - Task Tracker

**Last Updated:** February 1, 2026

> This file tracks all development tasks across the SaveAction platform.
> Copy task title and description to create GitHub issues.

---

## Status Legend

| Status         | Meaning                   |
| -------------- | ------------------------- |
| ✅ DONE        | Task completed            |
| 🚧 IN PROGRESS | Currently being worked on |
| ⏳ TODO        | Not started yet           |
| ❌ BLOCKED     | Blocked by dependency     |
| ⏭️ SKIPPED     | Deferred (YAGNI)          |

---

## Phase 1: Core Engine (@saveaction/core)

### ✅ DONE - Setup Monorepo Structure

- **Package:** @saveaction/core
- **Priority:** P0
- **Labels:** `setup`, `infrastructure`
- **Description:** Initialize monorepo with pnpm workspaces, configure Turborepo, setup TypeScript (tsconfig.base.json), configure ESLint + Prettier, setup Vitest for testing.

### ✅ DONE - Copy Types from Recorder

- **Package:** @saveaction/core
- **Priority:** P0
- **Labels:** `types`
- **Description:** Copy types folder from recorder repo. Ensure types are identical (actions.ts, selectors.ts, recording.ts). Export all types from index.ts.

### ✅ DONE - Build Recording Parser

- **Package:** @saveaction/core
- **Priority:** P0
- **Labels:** `feature`, `parser`
- **Description:** Build RecordingParser.ts to parse JSON file into Recording object. Implement Zod schema validation. Support parseFile() and parseString() methods.

### ✅ DONE - Build Playwright Runner

- **Package:** @saveaction/core
- **Priority:** P0
- **Labels:** `feature`, `runner`
- **Description:** Build PlaywrightRunner.ts as main execution engine. Support execute() method that takes Recording and returns RunResult with status, duration, actions executed/failed.

### ✅ DONE - Build Element Locator

- **Package:** @saveaction/core
- **Priority:** P0
- **Labels:** `feature`, `runner`
- **Description:** Build ElementLocator.ts with multi-strategy element location. Try selectors in priority order (id → dataTestId → ariaLabel → name → css → xpath → position). Implement exponential backoff retry (500ms → 1000ms → 2000ms).

### ✅ DONE - Implement Action Executors

- **Package:** @saveaction/core
- **Priority:** P0
- **Labels:** `feature`, `runner`
- **Description:** Implement executors for all action types: click, input, navigation, scroll, select, keypress, submit, hover, modal lifecycle. Handle navigation detection and animation delays.

### ✅ DONE - Build Console Reporter

- **Package:** @saveaction/core
- **Priority:** P1
- **Labels:** `feature`, `reporter`
- **Description:** Build ConsoleReporter.ts for pretty CLI output. Implement onStart, onActionStart, onActionSuccess, onActionError, onComplete hooks with emoji indicators and timing.

### ✅ DONE - Unit Tests for Core

- **Package:** @saveaction/core
- **Priority:** P0
- **Labels:** `testing`
- **Description:** Write unit tests for RecordingParser, ElementLocator, ConsoleReporter, PlaywrightRunner. Target 90%+ coverage on critical components. Currently at 81 tests passing.

### ✅ DONE - Cross-Browser Support

- **Package:** @saveaction/core
- **Priority:** P1
- **Labels:** `feature`, `enhancement`
- **Description:** Support Chromium, Firefox, and WebKit browsers. Use browser-specific launch arguments (Chromium stealth args don't work on Firefox/WebKit). Fixed in PR #8.

### ✅ DONE - Navigation History Manager

- **Package:** @saveaction/core
- **Priority:** P1
- **Labels:** `feature`, `runner`
- **Description:** Build NavigationHistoryManager.ts to track page navigations and detect URL changes during action execution.

### ✅ DONE - Navigation Analyzer

- **Package:** @saveaction/core
- **Priority:** P1
- **Labels:** `feature`, `runner`
- **Description:** Build NavigationAnalyzer.ts to preprocess recordings, detect missing prerequisites, and warn about potential issues.

### ✅ DONE - Core Browser Integration Tests

- **Package:** @saveaction/core
- **Priority:** P2
- **Labels:** `testing`, `integration`
- **Description:** Add real browser integration tests for PlaywrightRunner and ElementLocator. Launch actual Chromium instance, execute actions against local test HTML fixtures. Test: click, input, navigation, scroll actions with real DOM. 43 integration tests covering: click actions (6), input actions (5), select actions (2), scroll actions (2), complex workflows (3), error handling (2), browser options (2), selector strategies (22). Run separately with `pnpm run test:integration` in packages/core.

---

## Phase 2: CLI Tool (@saveaction/cli)

### ✅ DONE - Setup CLI Package

- **Package:** @saveaction/cli
- **Priority:** P0
- **Labels:** `setup`
- **Description:** Initialize CLI package with Commander.js, setup bin entry point (saveaction.js), configure CLI help text and version.

### ✅ DONE - Implement `run` Command

- **Package:** @saveaction/cli
- **Priority:** P0
- **Labels:** `feature`, `cli`
- **Description:** Implement `saveaction run <file>` command. Execute test recording with options for headless, browser, video, timeout, timing mode, speed multiplier.

### ✅ DONE - CLI Run Options

- **Package:** @saveaction/cli
- **Priority:** P1
- **Labels:** `feature`, `cli`
- **Description:** Add CLI options: --headless, --browser (chromium/firefox/webkit), --video, --timeout, --timing, --timing-mode (realistic/fast/instant), --speed, --max-delay.

### ✅ DONE - Implement `validate` Command

- **Package:** @saveaction/cli
- **Priority:** P2
- **Labels:** `feature`, `cli`
- **Description:** Implemented `saveaction validate <file>` command. Validates recording structure without execution. Features: file existence/extension check, file size limits (warning > 10MB, hard limit 50MB), JSON syntax validation, Zod schema compliance, required field verification, semantic validation (empty actions, large recordings, version compatibility). Supports `--verbose` and `--json` flags. Completed with 89.35% test coverage and 25 unit tests.

### ✅ DONE - Implement `info` Command

- **Package:** @saveaction/cli
- **Priority:** P2
- **Labels:** `feature`, `cli`
- **Description:** Implement `saveaction info <file>` command. Display recording details: test name, URL, viewport, action count, action types breakdown, estimated duration. Supports `--json` flag for JSON output. Completed with RecordingAnalyzer class (99.14% coverage) and 76 new tests.

### ✅ DONE - Implement `list` Command

- **Package:** @saveaction/cli
- **Priority:** P3
- **Labels:** `feature`, `cli`
- **Description:** Implemented `saveaction list [dir]` command. Lists all JSON recording files in a directory. Shows test name, URL, and action count for each recording. Defaults to current directory. Supports `--json` flag for JSON output. Skips invalid JSON files and reports them. Completed with 22 unit tests.

### ⏭️ SKIPPED - Implement `init` Command

- **Package:** @saveaction/cli
- **Priority:** P3
- **Labels:** `feature`, `cli`
- **Description:** ~~Implement `saveaction init` command. Create `.saveactionrc.json` config file with default settings.~~ **Skipped:** CLI flags are sufficient for most use cases. CI/CD pipelines prefer explicit options in workflow files. Will implement if users request it.

### ⏭️ SKIPPED - Configuration File Support

- **Package:** @saveaction/cli
- **Priority:** P2
- **Labels:** `feature`, `cli`
- **Description:** ~~Support loading settings from `.saveactionrc.json` or `.saveactionrc.js`.~~ **Skipped:** YAGNI - explicit CLI flags work better for CI/CD. Build only if users request centralized config.

### ✅ DONE - JSON Output Format

- **Package:** @saveaction/cli
- **Priority:** P2
- **Labels:** `feature`, `cli`
- **Description:** Implemented `--output json` option to output run results as JSON instead of console output. Added `--output-file <path>` to save results to a JSON file. JSON output includes: version, status (passed/failed), recording metadata, execution settings, result details (duration, actions, errors), and timestamps. Uses SilentReporter for clean JSON output. Completed with 19 unit tests.

---

## Phase 3: REST API (@saveaction/api)

### ✅ DONE - Development Environment Setup

- **Package:** @saveaction/api
- **Priority:** P0
- **Labels:** `setup`, `dx`
- **Description:** Create docker-compose.dev.yml with PostgreSQL 16 and Redis 7 for local development. Include volume mounts for data persistence, health checks, and default credentials. Developers run `docker compose -f docker-compose.dev.yml up` then `pnpm dev` for API with hot reload. Add scripts to package.json: `dev:services` (start containers), `dev:api` (start API). Added `.env.example` with environment variable template.

### ✅ DONE - Setup API Package

- **Package:** @saveaction/api
- **Priority:** P0
- **Labels:** `setup`
- **Description:** Initialize Fastify server package with TypeScript. Configured environment variables with Zod validation (NODE_ENV, API_PORT, DATABASE_URL, REDIS_URL, JWT secrets). Implemented CORS with configurable origins. Created global error handler using `fastify-plugin` for proper encapsulation breaking - handles ApiError, ZodError, Fastify validation errors, 404s, and generic errors with standardized JSON format `{ error: { code, message, details?, requestId? } }`. Added health check endpoint at `/api/health`. Includes 61 unit tests covering env validation, error handling, and app functionality.

### ✅ DONE - Redis Setup

- **Package:** @saveaction/api
- **Priority:** P0
- **Labels:** `setup`, `infrastructure`
- **Description:** Added Redis support using ioredis client with connection pooling. Implemented `RedisClient` wrapper with: connection management, exponential backoff retry strategy, graceful shutdown, health checks, and convenience methods for common operations (get/set/del, hashes, sets, pub/sub). Created Fastify plugin `redisConnectionPlugin` using `fastify-plugin` for global availability. Added comprehensive health check endpoints: `/api/health/detailed` (service status), `/api/health/live` (Kubernetes liveness), `/api/health/ready` (Kubernetes readiness). Redis already configured in docker-compose.dev.yml. Includes 53 new unit tests (114 total API tests).

### ✅ DONE - BullMQ Job Queue

- **Package:** @saveaction/api
- **Priority:** P0
- **Labels:** `feature`, `infrastructure`
- **Description:** Implemented BullMQ for job queues with three queue types: `test-runs` (concurrency 5), `cleanup` (concurrency 1), `scheduled-tests` (concurrency 3). Features: `JobQueueManager` class for centralized queue management, persistent jobs that survive restart, retry with exponential backoff (1s→2s→4s for test-runs), job prioritization support, concurrency control per queue. Created `bullmqConnectionPlugin` Fastify plugin with separate Redis connection (no keyPrefix for BullMQ compatibility). Queue status exposed via `/api/queues/status` endpoint and included in `/api/health/detailed`. Supports repeatable jobs for scheduled tasks (cron patterns). Graceful shutdown with configurable timeout. Includes 40 new unit tests (154 total API tests).

### ✅ DONE - Database Schema Setup

- **Package:** @saveaction/api
- **Priority:** P0
- **Labels:** `database`
- **Description:** Created PostgreSQL database schema with Drizzle ORM. Tables: users, api_tokens, recordings, runs, run_actions, schedules, webhooks, webhook_deliveries (8 total). Features: UUID primary keys (gen_random_uuid), soft deletes with deleted_at, audit timestamps, PostgreSQL enums (run_status, browser_type, action_status, schedule_status, webhook_event, webhook_status). Indexes: partial indexes for soft delete filtering, GIN indexes on JSONB columns (recordings.data, recordings.tags), case-insensitive email unique constraint. Foreign keys with proper cascade rules. BullMQ integration columns in runs and schedules tables. Auto-migration on server startup via database plugin. Includes 9 unit tests.

### ✅ DONE - User Authentication

- **Package:** @saveaction/api
- **Priority:** P0
- **Labels:** `feature`, `auth`
- **Description:** Implemented complete user authentication system with JWT. Features: user registration (POST /api/auth/register) with email/password validation (min 8 chars, uppercase, lowercase, number), login (POST /api/auth/login) with account lockout (5 attempts → 15 min lock), logout (POST /api/auth/logout), token refresh (POST /api/auth/refresh) with cookie and body support, get current user (GET /api/auth/me), change password (POST /api/auth/change-password). Password hashing with bcrypt (12 rounds). JWT access tokens (15 min expiry), refresh tokens (7 days, httpOnly cookie). Auth middleware with `fastify.authenticate` decorator. Components: AuthService, UserRepository, JWT plugin, Zod validation schemas. 66 new unit tests (AuthService: 23, UserRepository: 21, types: 22).

### ✅ DONE - Password Reset Flow

- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `feature`, `auth`
- **Description:** Implemented forgot password flow with email service integration. POST /api/auth/forgot-password generates JWT reset token (1hr expiry) and sends email via nodemailer/SMTP. Returns generic success to prevent email enumeration. POST /api/auth/reset-password validates token and updates password with bcrypt. EmailService created with HTML email templates, SMTP configuration via environment variables (SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM, APP_BASE_URL). Development mode creates ethereal test accounts. 28 new unit tests (EmailService: 17, AuthService reset methods: 11). API docs updated.

### ✅ DONE - JWT Refresh Token

- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `feature`, `auth`, `security`
- **Description:** Implemented as part of User Authentication. Access token: 15min expiry. Refresh token: 7 days, stored in httpOnly cookie. POST /api/auth/refresh issues new access and refresh tokens (rotation). Cookie options: httpOnly, secure (production), sameSite: strict, path: /api/auth.

### ✅ DONE - Change Password

- **Package:** @saveaction/api
- **Priority:** P2
- **Labels:** `feature`, `auth`
- **Description:** Implemented POST /api/auth/change-password endpoint. Requires valid access token (authenticated). Verifies current password with bcrypt.compare before allowing change. Returns 401 PASSWORD_MISMATCH if current password is wrong. New password validated with same requirements as registration.

### ⏳ TODO - Email Verification (Optional)

- **Package:** @saveaction/api
- **Priority:** P2
- **Labels:** `feature`, `auth`, `security`
- **Description:** Optional email verification on registration. Send verification email with JWT token (24hr expiry). POST /api/auth/verify-email validates token. Resend verification endpoint with rate limiting. Note: Often unnecessary for self-hosted deployments where users are trusted internal employees.

### ✅ DONE - Account Lockout (Brute Force Protection)

- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `security`, `auth`
- **Description:** Implemented Redis-based account lockout with LockoutService. Lock account after 5 failed login attempts. Lockout duration: 15 minutes (exponential backoff on repeated lockouts - doubles each time, max 24 hours). Track failed attempts in Redis with TTL for auto-expiry. Auto-unlocks when TTL expires. Event system for logging lockout events (failed_attempt, lockout, unlock, manual_unlock). Backward compatible - AuthService uses LockoutService if provided, falls back to DB-based tracking. 32 tests added (27 for LockoutService, 5 for AuthService integration).

### ✅ DONE - API Token Management

- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `feature`, `auth`
- **Description:** Implemented API token management with ApiTokenService and ApiTokenRepository. Token format: `sa_live_<64 hex chars>` (SHA-256 hashed for storage). Supports 8 scopes: recordings:read/write, runs:read/execute, schedules:read/write, webhooks:read/write. Features: token creation with configurable expiration, validation with usage tracking, listing (all/active), revocation with reason, scope checking utilities. Limit of 10 active tokens per user. 89 tests added (34 for types, 22 for repository, 33 for service). HTTP routes: POST /api/tokens (create), GET /api/tokens (list), GET /api/tokens/:id, POST /api/tokens/:id/revoke, DELETE /api/tokens/:id.

### ✅ DONE - Recordings CRUD API

- **Package:** @saveaction/api
- **Priority:** P0
- **Labels:** `feature`, `api`
- **Description:** Implemented full recording CRUD with RecordingRepository (Drizzle ORM), RecordingService (Zod validation, business logic), and HTTP routes. Endpoints: POST /api/recordings (upload with 10MB limit, duplicate check), GET /api/recordings (list with pagination, search, tag filtering, sorting), GET /api/recordings/tags (user's tags), GET /api/recordings/:id (full data), GET /api/recordings/:id/export (JSON download for CLI), PUT /api/recordings/:id, DELETE /api/recordings/:id (soft delete), POST /api/recordings/:id/restore, DELETE /api/recordings/:id/permanent. 102 new tests (28 repository, 51 service, 23 routes). Total: 506 tests passing.

### ✅ DONE - Recording Export for CLI

- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `feature`, `api`, `ci-cd`
- **Description:** Implemented GET /api/recordings/:id/export endpoint to download recording JSON for CLI execution. Added tag filtering to GET /api/recordings?tags=smoke,login. Essential for CI/CD integration.

### ✅ DONE - Runs API & Runner Service

- **Package:** @saveaction/api
- **Priority:** P0
- **Labels:** `feature`, `api`, `service`
- **Description:** Implemented complete run execution system with production-scale worker architecture. **Components:** 1) RunRepository - database CRUD for runs and run_actions tables with 44 unit tests, 2) RunnerService - integrates @saveaction/core PlaywrightRunner with 50 unit tests, 3) HTTP Routes - POST /api/runs (queue execution), GET /api/runs (list with pagination/filtering), GET /api/runs/:id (details), GET /api/runs/:id/actions (action results), POST /api/runs/:id/cancel, POST /api/runs/:id/retry, DELETE /api/runs/:id with 35 tests. **Worker Architecture:** Separate worker process (worker.ts) for test execution - API server handles HTTP only, worker processes BullMQ jobs with Playwright. Workers scale independently (WORKER_CONCURRENCY env var, default 3). Single `pnpm dev` command runs both via concurrently. Structured JSON logging with LOG_LEVEL support. Manual testing verified: 3 concurrent runs executed successfully. **Documentation:** docs/RUNS_API.md, docs/WORKER_ARCHITECTURE.md.

### ✅ DONE - Run Cancellation

- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `feature`, `api`
- **Description:** Implemented POST /api/runs/:id/cancel endpoint. Cancels queued jobs via BullMQ job.remove(), cancels running jobs by setting status to 'cancelled' (browser cleanup via PlaywrightRunner context.close()). Returns 400 INVALID_RUN_STATUS if run already completed. Partial results (actions executed before cancel) are preserved. Tested as part of runs.test.ts (35 tests).

### ✅ DONE - Soft Deletes (Recordings)

- **Package:** @saveaction/api
- **Priority:** P2
- **Labels:** `feature`, `database`
- **Description:** Recordings table has soft deletes with deleted_at column. DELETE /api/v1/recordings/:id sets deleted_at (soft delete). POST /api/v1/recordings/:id/restore restores soft-deleted recordings. DELETE /api/v1/recordings/:id/permanent performs hard delete. Runs table soft deletes will be implemented with Runs API. Background job for permanent deletion after 30 days is a future enhancement.

### ✅ DONE - API Versioning

- **Package:** @saveaction/api
- **Priority:** P2
- **Labels:** `api`, `architecture`
- **Description:** All API endpoints (except health/infrastructure) use `/api/v1/` prefix. Versioned routes: `/api/v1/auth/*`, `/api/v1/tokens/*`, `/api/v1/recordings/*`, `/api/v1/runs/*`. Unversioned routes: `/api/health/*`, `/api/queues/*` (infrastructure). Uses Fastify's nested `register()` with prefix option for clean grouping. Cookie paths updated to `/api/v1/auth`. Documentation updated.

### ✅ DONE - Schedules API

- **Package:** @saveaction/api
- **Priority:** P2
- **Labels:** `feature`, `api`
- **Description:** Implemented schedule endpoints: POST /api/v1/schedules, GET /api/v1/schedules, GET /api/v1/schedules/:id, PUT /api/v1/schedules/:id, DELETE /api/v1/schedules/:id (soft delete), POST /api/v1/schedules/:id/toggle (active/paused), POST /api/v1/schedules/:id/restore, DELETE /api/v1/schedules/:id/permanent. Uses BullMQ repeatable jobs for cron execution. Features: cron validation with cron-parser v5, timezone support, run counters, notification settings, soft delete/restore. ScheduleRepository and ScheduleService with 77 unit tests.

### ⏳ TODO - Webhooks API

- **Package:** @saveaction/api
- **Priority:** P2
- **Labels:** `feature`, `api`
- **Description:** Implement webhook endpoints and delivery. Events: run.completed, run.failed, recording.uploaded. HMAC signature verification.

### ✅ DONE - Health Check Endpoints

- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `feature`, `api`
- **Description:** Implemented comprehensive health check endpoints. GET /api/health (basic), GET /api/health/detailed (API, PostgreSQL, Redis, BullMQ status with latency), GET /api/health/live (Kubernetes liveness probe), GET /api/health/ready (Kubernetes readiness probe - checks DB and Redis). Queue status at GET /api/queues/status. Implemented as part of Redis Setup and BullMQ Job Queue tasks.

### ✅ DONE - OpenAPI Documentation (Swagger)

- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `docs`, `api`, `dx`
- **Completed:** 2026-02-01
- **Description:** Add @fastify/swagger and @fastify/swagger-ui for auto-generated API documentation. Generate OpenAPI 3.0 spec from route schemas (Zod → JSON Schema). Expose interactive docs at /api/docs. Include authentication examples and error response schemas.
- **Implementation:**
  - Installed @fastify/swagger@8 and @fastify/swagger-ui@4 (Fastify 4.x compatible)
  - Created swagger plugin with OpenAPI 3.0.3 spec at `packages/api/src/plugins/swagger.ts`
  - Swagger UI available at `/api/docs`, JSON spec at `/api/docs/json`
  - Configured security schemes: bearerAuth (JWT), apiToken (sa_live_* tokens)
  - Added component schemas: Error, User, Recording, Run, Schedule, Pagination
  - Auto-tags routes based on path (e.g., /api/recordings → "Recordings")
  - Added schema tags to health check endpoints for better organization
  - Tests: skipSwagger option prevents swagger registration during tests

### ✅ DONE - Security Headers

- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `security`
- **Description:** Implemented @fastify/helmet@11.1.1 for comprehensive security headers. Features: Content-Security-Policy (strict default-src 'none' for API, relaxed for Swagger UI with script-src/style-src/img-src), X-Frame-Options: DENY, X-Content-Type-Options: nosniff, X-XSS-Protection: 0 (modern recommendation), Referrer-Policy: strict-origin-when-cross-origin, Cross-Origin-Opener-Policy: same-origin, Cross-Origin-Resource-Policy: same-origin. HSTS enabled only in production. Created helmet.ts plugin with options for isProduction, enableHsts, swaggerPrefix. Integrated in app.ts with skipHelmet test option.

### ✅ DONE - API Rate Limiting

- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `security`
- **Description:** Implemented @fastify/rate-limit@9.1.0 with Redis store for distributed deployments. Rate limits: 100 req/min (unauthenticated global), 200 req/min (authenticated users), 20 req/min (auth endpoints - anti-brute-force). Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset. Excludes health check and documentation endpoints. Falls back to in-memory store when Redis unavailable. Created rateLimit.ts plugin with configurable limits per tier. Integrated in app.ts after Redis connection with skipRateLimit test option.

### ✅ DONE - CSRF Protection

- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `security`
- **Description:** Implemented @fastify/csrf-protection@6.4.1 with double-submit cookie pattern. Protects cookie-based auth routes: /api/v1/auth/refresh, /api/v1/auth/logout, /api/v1/auth/change-password. GET /api/v1/auth/csrf endpoint returns token and sets _csrf cookie. Client must include token in X-CSRF-Token header for protected requests. API tokens (Bearer sa_live_*, sa_test_*) are exempt - they're CSRF-immune. Cookie settings: path=/api, httpOnly=false (for JS access), sameSite=strict, secure=true in production. Created csrf.ts plugin. Integrated in app.ts with skipCsrf test option.

### ✅ DONE - Input Sanitization & Validation

- **Package:** @saveaction/api
- **Priority:** P0
- **Labels:** `security`
- **Description:** Implemented Zod validation in RecordingService for all recording uploads. Validates: recording structure (id, testName, url, viewport, actions array), 10MB size limit (TOO_LARGE error), duplicate originalId detection (DUPLICATE_ORIGINAL_ID error), URL format, action structure. Tags validated as string arrays. Name limited to 255 chars. All malformed recordings rejected with VALIDATION_FAILED error. Implemented as part of Recordings CRUD API.

### ✅ DONE - Run Timeout, Cleanup & Concurrency

- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `stability`, `service`
- **Description:** Implemented cleanup infrastructure for orphaned runs and video files. Created `cleanupProcessor.ts` BullMQ processor that handles three cleanup types: orphaned-runs (marks timed-out runs as failed), old-videos (deletes videos older than retention period), and expired-tokens (no-op since JWT tokens are stateless). Added startup cleanup hook in `worker.ts` that immediately cleans orphaned runs on worker restart. Scheduled recurring cleanup jobs: orphaned-runs cleanup hourly (cron: `0 * * * *`), old-videos cleanup daily at 3 AM (cron: `0 3 * * *`). Video cleanup respects retention period (default 30 days), skips active runs, handles both .webm and .mp4 formats. Default run timeout is 10 minutes. Cleanup worker runs with concurrency 1 to avoid conflicts. Added 17 unit tests covering all cleanup scenarios. **Branch:** feat/cleanup-jobs

### ✅ DONE - Structured Logging (Basic)

- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `observability`, `devops`
- **Description:** Fastify uses pino by default. Configured: JSON structured logging in production, pino-pretty in development, LOG_LEVEL environment variable (debug/info/warn/error), request ID tracing via genReqId (crypto.randomUUID), request logging with URL and method in errorHandler. **Future enhancement:** Add user ID, recording ID, run ID to log context for better debugging.

### ✅ DONE - Video/Screenshot Storage & Cleanup

- **Package:** @saveaction/api
- **Priority:** P2
- **Labels:** `storage`, `devops`
- **Description:** Implemented storage strategy for videos and screenshots with local filesystem configurable via VIDEO_STORAGE_PATH and SCREENSHOT_STORAGE_PATH environment variables (defaults: ./storage/videos and ./storage/screenshots). Background cleanup jobs run daily at 3:00 AM (videos) and 3:30 AM (screenshots) with 30-day retention. Cleanup processor skips active runs and handles orphaned files gracefully. S3-compatible storage support deferred to P3 - not needed for MVP.

### ⏳ TODO - External Run Reports (Future)

- **Package:** @saveaction/api
- **Priority:** P3
- **Labels:** `feature`, `api`, `ci-cd`, `backlog`
- **Description:** Implement POST /api/runs/external to accept run results from external CLI executions. Store CI metadata (commit, branch, workflow). NOT needed for MVP - build when customers request centralized reporting across multiple repos or flaky test analytics.

### ✅ DONE - Environment Validation

- **Package:** @saveaction/api
- **Priority:** P0
- **Labels:** `setup`, `dx`
- **Description:** Implemented Zod validation in config/env.ts. parseEnv() validates all environment variables with descriptive errors. validateProductionEnv() checks required production vars (DATABASE_URL, REDIS_URL, JWT_SECRET, JWT_REFRESH_SECRET). Fails fast on startup with clear error messages. Implemented as part of Setup API Package task.

### ✅ DONE - Standardized Error Response Format

- **Package:** @saveaction/api
- **Priority:** P0
- **Labels:** `api`, `dx`
- **Description:** Implemented ApiError class with consistent format: `{ error: { code, message, details?, requestId? } }`. Global error handler (errorHandler plugin) converts all errors (ApiError, ZodError, Fastify validation, 404s) to standard format. Errors factory with common errors (badRequest, unauthorized, notFound, etc.). Request ID included via Fastify genReqId. Implemented as part of Setup API Package task.

### ✅ DONE - Graceful Shutdown

- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `stability`, `devops`
- **Description:** Implemented SIGTERM/SIGINT signal handlers in server.ts. Calls app.close() which triggers Fastify's onClose hooks. Redis client disconnects gracefully. JobQueueManager.shutdown() closes all queues and workers with configurable timeout (default 30s). Database connections closed via Drizzle. Logs shutdown progress. Implemented across server.ts, RedisClient, and JobQueueManager.

### ✅ DONE - API Integration Tests

- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `testing`
- **Completed:** 2026-02-01
- **Description:** Integration tests for all API routes using Vitest + Fastify inject(). Tests cover: auth flows (register, login, logout, refresh, password reset), recordings CRUD (create, read, update, delete, restore, export, tags), runs API (create, list, get, cancel, retry, delete), schedules API (create, list, get, update, toggle, delete), API tokens (create, list, revoke). Uses real PostgreSQL and Redis via docker-compose.dev.yml. Test helpers: createTestApp(), createUser(), createRecording(), truncateTables(). 792 API tests total with 80%+ route coverage.

### ⏳ TODO - Real-time Run Progress (SSE)

- **Package:** @saveaction/api
- **Priority:** P2
- **Labels:** `feature`, `api`
- **Description:** Implement Server-Sent Events (SSE) endpoint to stream run progress in real-time. GET /api/runs/:id/progress/stream returns event stream with action start/success/error events during test execution. SSE chosen over WebSocket: simpler, one-direction (server→client), no library needed, firewall-friendly. Required for Phase 4 Web UI live progress display.

---

## Phase 3.5: CLI Platform Integration (CI/CD Support)

> These features enable companies to use SaveAction in their CI/CD pipelines,
> fetching recordings from the self-hosted platform instead of managing JSON files manually.
> **Requires Phase 3 API to be completed first.**

### ✅ DONE - API Connection Support

- **Package:** @saveaction/cli
- **Priority:** P1
- **Labels:** `feature`, `cli`, `ci-cd`
- **Completed:** 2026-02-01
- **Description:** Add `--api-url` and `--api-token` options to connect CLI to SaveAction platform. Support environment variables: `SAVEACTION_API_URL`, `SAVEACTION_API_TOKEN`. Validate connection on startup.
- **Implementation:** Created PlatformClient service class with testConnection(), fetchRecording(), listRecordings(), fetchRecordingsByTags() methods. Environment variable fallback for API URL and token. 29 unit tests for PlatformClient.

### ✅ DONE - Fetch Recordings from Platform

- **Package:** @saveaction/cli
- **Priority:** P1
- **Labels:** `feature`, `cli`, `ci-cd`
- **Completed:** 2026-02-01
- **Description:** Add `--recording-id <id>` to run specific recording from platform. Support `--tag <tag>` to run all recordings with a tag (e.g., `--tag smoke`). Multiple tags supported with comma separation.
- **Implementation:** Updated run command to support `--recording-id` and `--tag` options. Fetches from GET /api/v1/recordings/:id/export and GET /api/v1/recordings?tags=. Supports running multiple recordings sequentially when using --tag. File argument now optional when using platform options.

### ✅ DONE - Base URL Override

- **Package:** @saveaction/cli
- **Priority:** P1
- **Labels:** `feature`, `cli`, `ci-cd`
- **Completed:** 2026-02-01
- **Description:** Add `--base-url <url>` option to override the starting URL in recordings. Essential for testing different environments (staging, production) with same recording. Example: `saveaction run --tag smoke --base-url https://staging.myapp.com`
- **Implementation:** Replaces base URL in recording.url and all action URLs while preserving paths and query strings. Works with both local files and platform recordings.

### ✅ DONE - CI Environment Detection

- **Package:** @saveaction/cli
- **Priority:** P2
- **Labels:** `feature`, `cli`, `ci-cd`
- **Completed:** 2026-02-01
- **Description:** Auto-detect CI environment (GitHub Actions, GitLab CI, Jenkins). Capture metadata: commit SHA, branch name, workflow name, PR number. Include in run results for traceability.
- **Implementation:** Created CIDetector class supporting 8 CI providers (GitHub Actions, GitLab CI, Jenkins, CircleCI, Azure Pipelines, Travis CI, Bitbucket Pipelines, TeamCity) plus generic CI detection. Captures 11 metadata fields (commit, branch, pr, workflow, buildNumber, buildUrl, repository, actor, event). Integrated into run command with automatic console output and JSON `ci` field.

### ⏳ TODO - Report Results to Platform (Future)

- **Package:** @saveaction/cli
- **Priority:** P3
- **Labels:** `feature`, `cli`, `ci-cd`, `backlog`
- **Description:** Add `--report` flag to send run results back to SaveAction API. Store CI metadata with results. NOT needed for MVP - GitHub Actions provides pass/fail, logs, artifacts. Build when customers request centralized dashboard or flaky test detection.

---

## Phase 4: Web Dashboard (@saveaction/web)

### ✅ DONE - Setup Next.js App

- **Package:** @saveaction/web
- **Priority:** P0
- **Labels:** `setup`
- **Completed:** 2026-02-01
- **Description:** Initialize Next.js 15 with App Router. Setup Tailwind CSS, install shadcn/ui components, configure environment variables.
- **Implementation:** Initialized Next.js 16.1.6 with App Router, TypeScript, Tailwind CSS v4, brand color #5D5FEF. Created UI components (Button, Input, Label, Card, Badge, Avatar, Skeleton, ThemeToggle). Created layout components (Logo, Sidebar, Header, MobileNav). Setup light/dark theme with next-themes (GitHub-inspired dark mode). Environment variables configured via .env.local.

### ✅ DONE - Auth Pages

- **Package:** @saveaction/web
- **Priority:** P0
- **Labels:** `feature`, `ui`
- **Completed:** 2026-02-01
- **Description:** Build login and register pages. JWT handling, protected routes, auth context/hooks.
- **Implementation:** Created login and register pages with form validation, password strength indicator. Built AuthProvider context with JWT token management, automatic token refresh, protected route handling. Created API client service (lib/api.ts) with type-safe methods for all endpoints. Auth state persists in localStorage with httpOnly refresh token cookie support.

### ✅ DONE - Dashboard Layout

- **Package:** @saveaction/web
- **Priority:** P0
- **Labels:** `feature`, `ui`
- **Completed:** 2026-02-01
- **Description:** Build dashboard layout with sidebar navigation, header, and responsive design. Navigation: Recordings, Runs, Schedules, Settings.
- **Implementation:** Created dashboard layout with collapsible sidebar, header with user menu and logout. Mobile-responsive with slide-out navigation. User info displayed from auth context. Loading skeleton during auth check. Theme toggle in header.

### ⏳ TODO - Recording Upload UI

- **Package:** @saveaction/web
- **Priority:** P0
- **Labels:** `feature`, `ui`
- **Description:** Build drag-and-drop upload component with react-dropzone. Validate JSON client-side, show preview before upload, tag management.

### ⏳ TODO - Recordings List Page

- **Package:** @saveaction/web
- **Priority:** P0
- **Labels:** `feature`, `ui`
- **Description:** Build recordings list with paginated table. Search by name, filter by tags, sort by date. Quick actions: run, delete, duplicate.

### ⏳ TODO - Run Execution UI

- **Package:** @saveaction/web
- **Priority:** P0
- **Labels:** `feature`, `ui`
- **Description:** Build run trigger form: browser selection, headless toggle, video recording option. Real-time progress updates with action-by-action log.

### ⏳ TODO - Run Results Page

- **Package:** @saveaction/web
- **Priority:** P0
- **Labels:** `feature`, `ui`
- **Description:** Build run details page: status, duration, action results table, error details, video playback, screenshots gallery.

### ⏳ TODO - Settings Pages

- **Package:** @saveaction/web
- **Priority:** P1
- **Labels:** `feature`, `ui`
- **Description:** Build settings pages: API token management (generate, list, revoke), webhook configuration, user profile.

### ⏳ TODO - Platform E2E Tests

- **Package:** @saveaction/web
- **Priority:** P2
- **Labels:** `testing`, `e2e`
- **Description:** End-to-end tests for the full platform using Playwright Test. Test user flows: login → upload recording → trigger run → view results. Test against real API and Web UI (docker-compose test environment). Cover critical paths: auth flow, recording CRUD, run execution, real-time progress. Run in CI on main branch merges (slower, full stack required).

---

## Phase 5: Docker Deployment

### ⏳ TODO - Dockerfiles

- **Package:** deployment
- **Priority:** P1
- **Labels:** `devops`
- **Description:** Create Dockerfile for API and Web packages. Multi-stage builds for optimization. Include Playwright browsers in API image.

### ⏳ TODO - Production Docker Compose

- **Package:** deployment
- **Priority:** P1
- **Labels:** `devops`
- **Description:** Create docker-compose.yml for production deployment with: PostgreSQL 16, Redis 7, API server (built from Dockerfile), Web app (built from Dockerfile), Nginx reverse proxy. All services containerized (unlike dev setup). Configure resource limits, restart policies, and production environment variables.

### ⏳ TODO - Self-Hosting Documentation

- **Package:** docs
- **Priority:** P1
- **Labels:** `docs`
- **Description:** Write SELF_HOSTING.md guide with deployment instructions, environment configuration, backup procedures, troubleshooting.

### ⏳ TODO - TLS/HTTPS Configuration

- **Package:** deployment
- **Priority:** P1
- **Labels:** `security`, `devops`
- **Description:** Document and configure TLS termination. Options: Let's Encrypt with Certbot auto-renewal, or nginx reverse proxy with custom certificates. Ensure API tokens are never transmitted over plaintext HTTP.

### ⏳ TODO - Database Backup Strategy

- **Package:** deployment
- **Priority:** P1
- **Labels:** `devops`, `data`
- **Description:** Add pg_dump backup script to docker-compose (daily cron). Configure backup retention (e.g., 7 days). Document restore procedure. Optional: backup to S3/external storage.

---

## Phase 6: Browser Extension Integration

### ⏳ TODO - Extension Settings Page

- **Package:** @saveaction/extension
- **Priority:** P2
- **Labels:** `feature`, `extension`
- **Description:** Add settings page in extension popup: platform URL input, API token input, auto-upload toggle, connection test button.

### ⏳ TODO - Auto-Upload to Platform

- **Package:** @saveaction/extension
- **Priority:** P2
- **Labels:** `feature`, `extension`
- **Description:** Implement upload logic after recording stops. Upload to configured platform URL with API token. Show success/failure notification. Retry on failure, fallback to local download.

### ✅ DONE - Filter Extension UI Actions

- **Package:** @saveaction/extension
- **Priority:** P1
- **Labels:** `bug`, `extension`
- **Description:** Don't record clicks on SaveAction extension UI (#saveaction-recording-indicator). These elements don't exist during replay and cause failures.

---

## Infrastructure & CI/CD

### ✅ DONE - GitHub Actions CI

- **Package:** infrastructure
- **Priority:** P0
- **Labels:** `ci`
- **Description:** Setup CI pipeline with lint, typecheck, and test jobs. Run on every PR and push to main. Upload coverage to Codecov.

### ✅ DONE - Husky Git Hooks

- **Package:** infrastructure
- **Priority:** P1
- **Labels:** `dx`
- **Description:** Setup Husky with pre-commit (lint-staged), commit-msg (conventional commits validation), and pre-push (build + test) hooks.

### ⏳ TODO - Publish to npm

- **Package:** @saveaction/core, @saveaction/cli
- **Priority:** P1
- **Labels:** `release`
- **Description:** Configure packages for npm publishing. Add proper package.json metadata (repository, keywords, license). Publish @saveaction/core and @saveaction/cli to npm registry.

---

## Documentation

### ✅ DONE - CLI Documentation

- **Package:** docs
- **Priority:** P1
- **Labels:** `docs`
- **Description:** CLI documentation spread across multiple files: README.md (quick start, all commands with examples), docs/INFO_COMMAND.md (384 lines - detailed info command docs), docs/VALIDATE_COMMAND.md (344 lines - validation docs), docs/JSON_OUTPUT.md (267 lines - JSON output format). Covers all commands, options, and examples.

### ✅ DONE - API Documentation

- **Package:** docs
- **Priority:** P1
- **Labels:** `docs`
- **Description:** Comprehensive API documentation in docs/API.md (1201 lines). Covers: getting started, environment variables, infrastructure (tech stack, architecture), database schema (all 8 tables), health endpoints, queue status, authentication (register, login, logout, refresh, change password, forgot/reset password), API tokens (CRUD, scopes, validation), Recordings API (all endpoints with examples). docs/API_PACKAGE.md (259 lines) provides package overview. OpenAPI/Swagger auto-generation is separate task.

### ⏳ TODO - Architecture Documentation

- **Package:** docs
- **Priority:** P2
- **Labels:** `docs`
- **Description:** Write ARCHITECTURE.md with system design, data flow diagrams, package dependency graph, technology choices rationale.

### ⏳ TODO - CORS & Security Headers Documentation

- **Package:** docs
- **Priority:** P1
- **Labels:** `docs`, `security`
- **Description:** Document CORS configuration for production (allowed origins, credentials). Document cookie settings for refresh tokens (SameSite=Strict, Secure=true, HttpOnly=true). Document Content-Security-Policy headers for web app. Include examples for nginx and Fastify configuration.

---

## Backlog / Future Enhancements

### ⏳ TODO - Visual Regression Testing

- **Package:** @saveaction/core
- **Priority:** P3
- **Labels:** `feature`, `enhancement`
- **Description:** Add screenshot comparison for visual regression testing. Compare screenshots between runs, highlight differences.

### ⏳ TODO - Parallel Test Execution

- **Package:** @saveaction/core
- **Priority:** P3
- **Labels:** `feature`, `enhancement`
- **Description:** Support running multiple recordings in parallel. Configurable concurrency limit.

### ⏳ TODO - Mobile Device Emulation

- **Package:** @saveaction/core
- **Priority:** P3
- **Labels:** `feature`, `enhancement`
- **Description:** Support Playwright device emulation for mobile testing. Use device profiles from recordings.

### ⏳ TODO - Network Throttling

- **Package:** @saveaction/core
- **Priority:** P3
- **Labels:** `feature`, `enhancement`
- **Description:** Support network throttling (slow 3G, fast 3G, offline) for testing under different network conditions.

### ⏳ TODO - Email Notifications

- **Package:** @saveaction/api
- **Priority:** P3
- **Labels:** `feature`, `enhancement`
- **Description:** Optional email notifications for important events (scheduled run failed, etc.). SMTP configuration in settings. Configurable per-user notification preferences. Use nodemailer or similar.

### ⏳ TODO - Metrics & Monitoring Endpoint

- **Package:** @saveaction/api
- **Priority:** P3
- **Labels:** `observability`, `enhancement`
- **Description:** Add /api/metrics endpoint with basic stats: total runs, success rate, average duration, runs per day. Optional Prometheus format for Grafana integration.

---

## Summary

| Phase                            | Total  | Done   | Skipped | Todo   |
| -------------------------------- | ------ | ------ | ------- | ------ |
| Phase 1: Core                    | 12     | 12     | 0       | 0      |
| Phase 2: CLI                     | 9      | 7      | 2       | 0      |
| Phase 3: API                     | 32     | 28     | 0       | 4      |
| Phase 3.5: CLI Platform (CI/CD)  | 5      | 3      | 0       | 2      |
| Phase 4: Web                     | 9      | 3      | 0       | 6      |
| Phase 5: Docker                  | 5      | 0      | 0       | 5      |
| Phase 6: Extension               | 3      | 1      | 0       | 2      |
| Infrastructure                   | 3      | 2      | 0       | 1      |
| Documentation                    | 4      | 2      | 0       | 2      |
| Backlog                          | 6      | 0      | 0       | 6      |
| **TOTAL**                        | **88** | **58** | **2**   | **28** |

### Test Summary

| Package | Tests |
|---------|-------|
| @saveaction/core | 140 |
| @saveaction/cli | 131 (3 skipped) |
| @saveaction/api | 792 |
| **TOTAL** | **1,063 tests** |

---

## Implementation Notes & Future Hints

### Worker Architecture (January 2026)

**Why separate worker process?**
- Originally worker was embedded in API server
- Problem: Playwright logs polluted API logs, couldn't scale workers independently
- Solution: `worker.ts` as separate entry point, communicates via BullMQ/Redis

**Key files:**
- `packages/api/src/worker.ts` - Worker entry point
- `packages/api/src/queues/testRunProcessor.ts` - BullMQ processor
- `packages/api/src/services/RunnerService.ts` - Business logic

**For Docker production:**
```yaml
services:
  api:
    command: node dist/server.js
    replicas: 2
  worker:
    command: node dist/worker.js
    replicas: 4  # Scale based on load
```

### BullMQ Redis Connection

**Important:** BullMQ requires Redis connection WITHOUT `keyPrefix`. The worker creates a separate Redis connection:
```typescript
// worker.ts - NO keyPrefix for BullMQ
redisConnection = new Redis(env.REDIS_URL!);

// app.ts - has keyPrefix for other Redis usage
keyPrefix: 'saveaction:'
```

### Concurrency Testing Notes

**Tested:** 3 concurrent runs on same recording
- All 3 started simultaneously ✅
- All 3 completed (22/22 actions) ✅
- Element failures were due to website behavior with 3 browsers, not platform issue

**Resource usage per browser:** ~200-300MB RAM

### Future Enhancements Hints

1. **Video Streaming:** Add GET /api/runs/:id/video endpoint with Range headers
2. **Real-time Progress:** SSE at GET /api/runs/:id/progress for Web UI
3. **Run Cancellation:** Currently sets status, need to actually kill browser via shared state
4. **Cleanup Jobs:** Background job to delete runs older than X days
5. **Priority Queue:** VIP recordings skip queue

### Known Limitations

1. **No browser kill on cancel:** Cancel sets status but doesn't kill active Playwright
2. **No retry with backoff:** Failed runs don't auto-retry
3. **Video storage:** Local filesystem only, no S3 support yet

---

_To create a GitHub issue, copy the task title and description._
