# SaveAction Platform - Task Tracker

**Last Updated:** January 26, 2026

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

### ⏳ TODO - Password Reset Flow

- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `feature`, `auth`
- **Description:** Implement forgot password flow. POST /api/auth/forgot-password sends email with reset link (JWT token with 1hr expiry). POST /api/auth/reset-password validates token and updates password. Requires email service integration (nodemailer + SMTP or SendGrid).

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

### ⏳ TODO - Account Lockout (Brute Force Protection)

- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `security`, `auth`
- **Description:** Lock account after 5 failed login attempts. Lockout duration: 15 minutes (exponential backoff on repeated lockouts). Track failed attempts in Redis with TTL for auto-expiry. Auto-unlocks when TTL expires. Log lockout events for monitoring.

### ⏳ TODO - API Token Management

- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `feature`, `auth`
- **Description:** Implement API token generation, listing, revocation. Token format: `sa_live_<random>`. Support scopes for permissions.

### ⏳ TODO - Recordings CRUD API

- **Package:** @saveaction/api
- **Priority:** P0
- **Labels:** `feature`, `api`
- **Description:** Implement recording endpoints: POST /api/recordings (upload), GET /api/recordings (list), GET /api/recordings/:id, PUT /api/recordings/:id, DELETE /api/recordings/:id.

### ⏳ TODO - Recording Export for CLI

- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `feature`, `api`, `ci-cd`
- **Description:** Implement GET /api/recordings/:id/export endpoint to download recording JSON for CLI execution. Add GET /api/recordings?tag=<tag> to filter recordings by tag. Essential for CI/CD integration.

### ⏳ TODO - Runs API

- **Package:** @saveaction/api
- **Priority:** P0
- **Labels:** `feature`, `api`
- **Description:** Implement run endpoints: POST /api/runs (execute), GET /api/runs (list), GET /api/runs/:id (details), GET /api/runs/:id/actions, GET /api/runs/:id/video, DELETE /api/runs/:id.

### ⏳ TODO - Run Cancellation

- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `feature`, `api`
- **Description:** Implement POST /api/runs/:id/cancel to stop running tests. Kill browser process, update status to "cancelled", save partial results. Essential when users trigger wrong test or test gets stuck.

### ⏳ TODO - Soft Deletes

- **Package:** @saveaction/api
- **Priority:** P2
- **Labels:** `feature`, `database`
- **Description:** Add deleted_at column to recordings and runs tables. DELETE endpoints set deleted_at instead of hard delete. Add trash/restore functionality. Background job permanently deletes after 30 days. Allows users to recover accidentally deleted items.

### ⏳ TODO - API Versioning

- **Package:** @saveaction/api
- **Priority:** P2
- **Labels:** `api`, `architecture`
- **Description:** Use /api/v1/ prefix for all endpoints from the start. Allows future breaking changes without affecting existing integrations. Document versioning policy in API docs.

### ⏳ TODO - Runner Service

- **Package:** @saveaction/api
- **Priority:** P0
- **Labels:** `feature`, `service`
- **Description:** Build RunnerService that integrates @saveaction/core. Execute tests, save results to database, store videos/screenshots, handle errors gracefully.

### ⏳ TODO - Schedules API

- **Package:** @saveaction/api
- **Priority:** P2
- **Labels:** `feature`, `api`
- **Description:** Implement schedule endpoints: POST /api/schedules, GET /api/schedules, PUT /api/schedules/:id, DELETE /api/schedules/:id, POST /api/schedules/:id/toggle. Use BullMQ repeatable jobs for cron execution (replaces node-cron). Schedules persist across restarts.

### ⏳ TODO - Webhooks API

- **Package:** @saveaction/api
- **Priority:** P2
- **Labels:** `feature`, `api`
- **Description:** Implement webhook endpoints and delivery. Events: run.completed, run.failed, recording.uploaded. HMAC signature verification.

### ⏳ TODO - Health Check Endpoints

- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `feature`, `api`
- **Description:** Implement GET /api/health with checks for: API server, PostgreSQL connection, Redis connection, BullMQ workers. Return detailed status for each service. Support /api/health/live (liveness) and /api/health/ready (readiness) for Kubernetes.

### ⏳ TODO - OpenAPI Documentation (Swagger)

- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `docs`, `api`, `dx`
- **Description:** Add @fastify/swagger and @fastify/swagger-ui for auto-generated API documentation. Generate OpenAPI 3.0 spec from route schemas (Zod → JSON Schema). Expose interactive docs at /api/docs. Include authentication examples and error response schemas.

### ⏳ TODO - Security Headers

- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `security`
- **Description:** Add @fastify/helmet for security headers: Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security. Configure CSP for API (strict) and adjust for swagger-ui. Document header configuration for nginx reverse proxy.

### ⏳ TODO - API Rate Limiting

- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `security`
- **Description:** Implement rate limiting with @fastify/rate-limit using Redis store (required for multi-instance deployments). Default: 100 requests/minute per IP. Higher limits for authenticated users. Separate limits for auth endpoints (stricter) vs general API.

### ⏳ TODO - CSRF Protection

- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `security`
- **Description:** Implement CSRF protection for cookie-based authentication (refresh tokens). Use @fastify/csrf-protection or double-submit cookie pattern. Exempt API token authentication (Bearer tokens are CSRF-immune). Required because refresh tokens use httpOnly cookies.

### ⏳ TODO - Input Sanitization & Validation

- **Package:** @saveaction/api
- **Priority:** P0
- **Labels:** `security`
- **Description:** Sanitize all recording JSON before storing/executing. Validate recording name, tags, URL fields against XSS/injection. Whitelist allowed action types. Limit file upload size (e.g., 10MB max). Reject malformed recordings.

### ⏳ TODO - Run Timeout & Cleanup

- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `stability`, `service`
- **Description:** Implement run timeout (kill after 10 minutes). Background job to mark orphaned "running" runs as "failed" on API restart. Cleanup orphaned video files. Ensure browser processes are killed on timeout/crash.

### ⏳ TODO - Concurrent Run Limit & Queue

- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `stability`, `service`
- **Description:** Use BullMQ for run queue with concurrency limit (e.g., max 5 concurrent runs). Additional runs queued automatically with status "queued". BullMQ handles job distribution across workers. Prevents server crash from too many simultaneous browser instances.

### ⏳ TODO - Structured Logging

- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `observability`, `devops`
- **Description:** Implement structured JSON logging with pino. Add request ID tracing for debugging. Log level configuration (debug/info/warn/error). Include user ID, recording ID, run ID in log context.

### ⏳ TODO - Video/Screenshot Storage & Cleanup

- **Package:** @saveaction/api
- **Priority:** P2
- **Labels:** `storage`, `devops`
- **Description:** Define storage strategy for videos and screenshots. Local filesystem with configurable path (Docker volume in production). Background job to cleanup old files (e.g., delete after 30 days). Optional S3-compatible storage support for scalability.

### ⏳ TODO - External Run Reports (Future)

- **Package:** @saveaction/api
- **Priority:** P3
- **Labels:** `feature`, `api`, `ci-cd`, `backlog`
- **Description:** Implement POST /api/runs/external to accept run results from external CLI executions. Store CI metadata (commit, branch, workflow). NOT needed for MVP - build when customers request centralized reporting across multiple repos or flaky test analytics.

### ⏳ TODO - Environment Validation

- **Package:** @saveaction/api
- **Priority:** P0
- **Labels:** `setup`, `dx`
- **Description:** Validate required environment variables on startup using Zod. Required: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, etc. Fail fast with clear error messages if missing or invalid.

### ⏳ TODO - Standardized Error Response Format

- **Package:** @saveaction/api
- **Priority:** P0
- **Labels:** `api`, `dx`
- **Description:** Define consistent error response format across all endpoints: `{ error: { code: string, message: string, details?: object } }`. Implement via Fastify error handler. Include request ID for debugging.

### ⏳ TODO - Graceful Shutdown

- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `stability`, `devops`
- **Description:** Handle SIGTERM/SIGINT signals for zero-downtime deployments. Stop accepting new requests, wait for running tests to complete (with timeout), close database connections, then exit cleanly.

### ⏳ TODO - API Integration Tests

- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `testing`
- **Description:** Write integration tests for all API routes using Vitest + supertest or Fastify inject(). Test auth flows, CRUD operations, permissions, error cases. Target 80%+ route coverage.

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

### ⏳ TODO - API Connection Support

- **Package:** @saveaction/cli
- **Priority:** P1
- **Labels:** `feature`, `cli`, `ci-cd`
- **Description:** Add `--api-url` and `--api-token` options to connect CLI to SaveAction platform. Support environment variables: `SAVEACTION_API_URL`, `SAVEACTION_API_TOKEN`. Validate connection on startup.

### ⏳ TODO - Fetch Recordings from Platform

- **Package:** @saveaction/cli
- **Priority:** P1
- **Labels:** `feature`, `cli`, `ci-cd`
- **Description:** Add `--from-platform` flag to fetch recordings from API instead of local file. Support `--recording-id <id>` to run specific recording. Support `--tag <tag>` to run all recordings with a tag (e.g., `--tag smoke`).

### ⏳ TODO - Base URL Override

- **Package:** @saveaction/cli
- **Priority:** P1
- **Labels:** `feature`, `cli`, `ci-cd`
- **Description:** Add `--base-url <url>` option to override the starting URL in recordings. Essential for testing different environments (staging, production) with same recording. Example: `saveaction run --from-platform --tag smoke --base-url https://staging.myapp.com`

### ⏳ TODO - CI Environment Detection

- **Package:** @saveaction/cli
- **Priority:** P2
- **Labels:** `feature`, `cli`, `ci-cd`
- **Description:** Auto-detect CI environment (GitHub Actions, GitLab CI, Jenkins). Capture metadata: commit SHA, branch name, workflow name, PR number. Include in run results for traceability.

### ⏳ TODO - Report Results to Platform (Future)

- **Package:** @saveaction/cli
- **Priority:** P3
- **Labels:** `feature`, `cli`, `ci-cd`, `backlog`
- **Description:** Add `--report` flag to send run results back to SaveAction API. Store CI metadata with results. NOT needed for MVP - GitHub Actions provides pass/fail, logs, artifacts. Build when customers request centralized dashboard or flaky test detection.

---

## Phase 4: Web Dashboard (@saveaction/web)

### ⏳ TODO - Setup Next.js App

- **Package:** @saveaction/web
- **Priority:** P0
- **Labels:** `setup`
- **Description:** Initialize Next.js 15 with App Router. Setup Tailwind CSS, install shadcn/ui components, configure environment variables.

### ⏳ TODO - Auth Pages

- **Package:** @saveaction/web
- **Priority:** P0
- **Labels:** `feature`, `ui`
- **Description:** Build login and register pages. JWT handling, protected routes, auth context/hooks.

### ⏳ TODO - Dashboard Layout

- **Package:** @saveaction/web
- **Priority:** P0
- **Labels:** `feature`, `ui`
- **Description:** Build dashboard layout with sidebar navigation, header, and responsive design. Navigation: Recordings, Runs, Schedules, Settings.

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

### ⏳ TODO - CLI Documentation

- **Package:** docs
- **Priority:** P1
- **Labels:** `docs`
- **Description:** Write CLI.md with all commands, options, examples, and configuration file reference.

### ⏳ TODO - API Documentation

- **Package:** docs
- **Priority:** P1
- **Labels:** `docs`
- **Description:** Write API.md with OpenAPI/Swagger spec, authentication guide, all endpoints, code examples (curl, JavaScript, Python).

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
| Phase 3: API                     | 41     | 4      | 0       | 37     |
| Phase 3.5: CLI Platform (CI/CD)  | 5      | 0      | 0       | 5      |
| Phase 4: Web                     | 9      | 0      | 0       | 9      |
| Phase 5: Docker                  | 5      | 0      | 0       | 5      |
| Phase 6: Extension               | 3      | 1      | 0       | 2      |
| Infrastructure                   | 3      | 2      | 0       | 1      |
| Documentation                    | 4      | 0      | 0       | 4      |
| Backlog                          | 6      | 0      | 0       | 6      |
| **TOTAL**                        | **97** | **24** | **2**   | **71** |

---

_To create a GitHub issue, copy the task title and description._
