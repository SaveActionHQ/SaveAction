# SaveAction Platform - Task Tracker

**Last Updated:** January 18, 2026

> This file tracks all development tasks across the SaveAction platform.
> Copy task title and description to create GitHub issues.

---

## Status Legend

| Status | Meaning |
|--------|---------|
| ✅ DONE | Task completed |
| 🚧 IN PROGRESS | Currently being worked on |
| ⏳ TODO | Not started yet |
| ❌ BLOCKED | Blocked by dependency |

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

### ⏳ TODO - Implement `validate` Command
- **Package:** @saveaction/cli
- **Priority:** P2
- **Labels:** `feature`, `cli`
- **Description:** Implement `saveaction validate <file>` command. Validate JSON structure without running the test. Show validation errors or success message with recording details.

### ✅ DONE - Implement `info` Command
- **Package:** @saveaction/cli
- **Priority:** P2
- **Labels:** `feature`, `cli`
- **Description:** Implement `saveaction info <file>` command. Display recording details: test name, URL, viewport, action count, action types breakdown, estimated duration. Supports `--json` flag for JSON output. Completed with RecordingAnalyzer class (99.14% coverage) and 76 new tests.

### ⏳ TODO - Implement `list` Command
- **Package:** @saveaction/cli
- **Priority:** P3
- **Labels:** `feature`, `cli`
- **Description:** Implement `saveaction list [dir]` command. List all JSON recording files in directory. Show name, URL, action count for each. Default to current directory.

### ⏳ TODO - Implement `init` Command
- **Package:** @saveaction/cli
- **Priority:** P3
- **Labels:** `feature`, `cli`
- **Description:** Implement `saveaction init` command. Create `.saveactionrc.json` config file with default settings (headless, browser, timeout, video, etc.).

### ⏳ TODO - Configuration File Support
- **Package:** @saveaction/cli
- **Priority:** P2
- **Labels:** `feature`, `cli`
- **Description:** Support loading settings from `.saveactionrc.json` or `.saveactionrc.js`. Merge config file settings with CLI arguments (CLI takes precedence).

### ⏳ TODO - JSON Output Format
- **Package:** @saveaction/cli
- **Priority:** P2
- **Labels:** `feature`, `cli`
- **Description:** Add `--output json` option to output results as JSON instead of console. Add `--output-file <path>` to save JSON results to file.

---

## Phase 2.5: CLI Platform Integration (CI/CD Support)

> These features enable companies to use SaveAction in their CI/CD pipelines,
> fetching recordings from the self-hosted platform instead of managing JSON files manually.

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

## Phase 3: REST API (@saveaction/api)

### ⏳ TODO - Setup API Package
- **Package:** @saveaction/api
- **Priority:** P0
- **Labels:** `setup`
- **Description:** Initialize Fastify server package. Configure TypeScript, environment variables, CORS, error handling middleware.

### ⏳ TODO - Database Schema Setup
- **Package:** @saveaction/api
- **Priority:** P0
- **Labels:** `database`
- **Description:** Create PostgreSQL database schema with Drizzle ORM. Tables: users, api_tokens, recordings, runs, run_actions, schedules, webhooks. Write migrations.

### ⏳ TODO - User Authentication
- **Package:** @saveaction/api
- **Priority:** P0
- **Labels:** `feature`, `auth`
- **Description:** Implement user registration, login (JWT), logout. Password hashing with bcrypt. Auth middleware for protected routes.

### ⏳ TODO - Password Reset Flow
- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `feature`, `auth`
- **Description:** Implement forgot password flow. POST /api/auth/forgot-password sends email with reset link (JWT token with 1hr expiry). POST /api/auth/reset-password validates token and updates password. Requires email service integration (nodemailer + SMTP or SendGrid).

### ⏳ TODO - JWT Refresh Token
- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `feature`, `auth`, `security`
- **Description:** Implement refresh token rotation. Access token: 15min expiry. Refresh token: 7 days, stored in httpOnly cookie. POST /api/auth/refresh issues new access token. Prevents users from being logged out during active sessions.

### ⏳ TODO - Change Password
- **Package:** @saveaction/api
- **Priority:** P2
- **Labels:** `feature`, `auth`
- **Description:** Implement PUT /api/auth/password endpoint. Requires current password verification before allowing change. Rate limit to 3 attempts per hour. Invalidate all existing sessions/refresh tokens after password change.

### ⏳ TODO - Email Verification
- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `feature`, `auth`, `security`
- **Description:** Implement email verification on registration. Send verification email with JWT token (24hr expiry). POST /api/auth/verify-email validates token. Unverified users can login but have limited access (can't create runs). Resend verification endpoint with rate limiting.

### ⏳ TODO - Account Lockout (Brute Force Protection)
- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `security`, `auth`
- **Description:** Lock account after 5 failed login attempts. Lockout duration: 15 minutes (exponential backoff on repeated lockouts). Track failed attempts in Redis or database. Send email notification on lockout. Include unlock via email link.

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
- **Description:** Implement schedule endpoints: POST /api/schedules, GET /api/schedules, PUT /api/schedules/:id, DELETE /api/schedules/:id, POST /api/schedules/:id/toggle. Cron job execution with node-cron.

### ⏳ TODO - Webhooks API
- **Package:** @saveaction/api
- **Priority:** P2
- **Labels:** `feature`, `api`
- **Description:** Implement webhook endpoints and delivery. Events: run.completed, run.failed, recording.uploaded. HMAC signature verification.

### ⏳ TODO - Health Check Endpoints
- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `feature`, `api`
- **Description:** Implement GET /api/health and GET /api/health/db endpoints for monitoring and load balancer health checks.

### ⏳ TODO - API Rate Limiting
- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `security`
- **Description:** Implement rate limiting with @fastify/rate-limit. Default: 100 requests/minute per IP. Higher limits for authenticated users.

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
- **Description:** Limit concurrent runs per server (e.g., max 5). Queue additional runs with status "queued". Process queue when slot available. Prevent server crash from too many simultaneous browser instances.

### ⏳ TODO - Structured Logging
- **Package:** @saveaction/api
- **Priority:** P1
- **Labels:** `observability`, `devops`
- **Description:** Implement structured JSON logging with pino. Add request ID tracing for debugging. Log level configuration (debug/info/warn/error). Include user ID, recording ID, run ID in log context.

### ⏳ TODO - Video/Screenshot Storage & Cleanup
- **Package:** @saveaction/api
- **Priority:** P2
- **Labels:** `storage`, `devops`
- **Description:** Define storage strategy for videos and screenshots. Local filesystem with configurable path. Background job to cleanup old files (e.g., delete after 30 days). Optional S3-compatible storage support for scalability. Track storage usage per user.

### ⏳ TODO - External Run Reports (Future)
- **Package:** @saveaction/api
- **Priority:** P3
- **Labels:** `feature`, `api`, `ci-cd`, `backlog`
- **Description:** Implement POST /api/runs/external to accept run results from external CLI executions. Store CI metadata (commit, branch, workflow). NOT needed for MVP - build when customers request centralized reporting across multiple repos or flaky test analytics.

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

---

## Phase 5: Docker Deployment

### ⏳ TODO - Dockerfiles
- **Package:** deployment
- **Priority:** P1
- **Labels:** `devops`
- **Description:** Create Dockerfile for API and Web packages. Multi-stage builds for optimization. Include Playwright browsers in API image.

### ⏳ TODO - Docker Compose
- **Package:** deployment
- **Priority:** P1
- **Labels:** `devops`
- **Description:** Create docker-compose.yml with PostgreSQL, API, Web, and Nginx reverse proxy. Volume mounts for persistence, health checks.

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

| Phase | Total | Done | In Progress | Todo |
|-------|-------|------|-------------|------|
| Phase 1: Core | 11 | 11 | 0 | 0 |
| Phase 2: CLI | 9 | 3 | 0 | 6 |
| Phase 2.5: CLI Platform (CI/CD) | 5 | 0 | 0 | 5 |
| Phase 3: API | 29 | 0 | 0 | 29 |
| Phase 4: Web | 8 | 0 | 0 | 8 |
| Phase 5: Docker | 5 | 0 | 0 | 5 |
| Phase 6: Extension | 3 | 1 | 0 | 2 |
| Infrastructure | 3 | 2 | 0 | 1 |
| Documentation | 4 | 0 | 0 | 4 |
| Backlog | 6 | 0 | 0 | 6 |
| **TOTAL** | **83** | **17** | **0** | **66** |

---

*To create a GitHub issue, copy the task title and description.*
