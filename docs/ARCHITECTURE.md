# SaveAction Architecture

> **Version:** 0.1.0  
> **Last Updated:** February 2026  
> **Status:** Production-ready (self-hosted)

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Package Dependency Graph](#package-dependency-graph)
- [Data Flow](#data-flow)
- [Package Deep Dives](#package-deep-dives)
  - [@saveaction/core](#saveactioncore)
  - [@saveaction/cli](#saveactioncli)
  - [@saveaction/api](#saveactionapi)
  - [@saveaction/web](#saveactionweb)
- [Database Architecture](#database-architecture)
- [Job Queue Architecture](#job-queue-architecture)
- [Real-Time Streaming (SSE)](#real-time-streaming-sse)
- [Authentication Architecture](#authentication-architecture)
- [Security Architecture](#security-architecture)
- [Deployment Architecture](#deployment-architecture)
- [Technology Choices](#technology-choices)
- [Design Principles](#design-principles)
- [Scaling Considerations](#scaling-considerations)

---

## Overview

SaveAction is an open-source test automation platform that records browser interactions via a Chrome extension and replays them using Playwright for cross-browser testing. It follows a monorepo architecture with four packages, each serving a distinct responsibility.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        SaveAction Platform                               │
│                                                                          │
│   Browser Extension                                                      │
│   (Chrome) ─────────── Records interactions → JSON recording files       │
│        │                                                                 │
│        ▼                                                                 │
│   ┌─────────────────────────────────────────────────────────────────┐    │
│   │                       Entry Points                              │    │
│   │                                                                 │    │
│   │   CLI (saveaction run)    Web UI (Next.js)    API (Fastify)     │    │
│   └───────────┬───────────────────┬────────────────────┬────────────┘    │
│               │                   │                    │                 │
│               ▼                   ▼                    ▼                 │
│   ┌───────────────────────────────────────────────────────────────┐      │
│   │                   @saveaction/core                            │      │
│   │                                                               │      │
│   │   RecordingParser → PlaywrightRunner → ElementLocator         │      │
│   │                          │                                    │      │
│   │                     Playwright                                │      │
│   │                  (Chromium/Firefox/WebKit)                     │      │
│   └───────────────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## System Architecture

### High-Level Component Diagram

```
                    ┌──────────────┐
                    │   Browser    │
                    │   (User)     │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │    Nginx     │
                    │ Reverse Proxy│
                    └───┬──────┬───┘
                        │      │
              ┌─────────▼─┐  ┌─▼──────────┐
              │  Next.js   │  │  Fastify   │
              │  Web UI    │  │  API       │
              │  :3000     │  │  :3001     │
              └────────────┘  └──────┬─────┘
                                     │
                              ┌──────▼──────┐
                              │   Redis     │
                              │  :6379      │
                              │             │
                              │ - Job Queue │
                              │ - Rate Limit│
                              │ - Pub/Sub   │
                              │ - Lockout   │
                              └──────┬──────┘
                                     │
         ┌───────────────────────────┼───────────────────────┐
         │                           │                       │
   ┌─────▼──────┐           ┌───────▼───────┐       ┌───────▼───────┐
   │  Worker 1  │           │   Worker 2    │       │   Worker N    │
   │ (BullMQ)   │           │  (BullMQ)     │       │  (BullMQ)     │
   │            │           │               │       │               │
   │ Playwright │           │  Playwright   │       │  Playwright   │
   │ Browsers   │           │  Browsers     │       │  Browsers     │
   └─────┬──────┘           └───────┬───────┘       └───────┬───────┘
         │                          │                       │
         └──────────┬───────────────┘                       │
                    │                                       │
              ┌─────▼───────────────────────────────────────▼─┐
              │              PostgreSQL :5432                   │
              │                                                │
              │  users │ projects │ recordings │ tests │ runs  │
              │  suites │ run_actions │ schedules │ webhooks   │
              └────────────────────────────────────────────────┘
```

### Process Model

SaveAction runs as **three distinct process types** in production:

| Process | Entry Point | Purpose | Stateless? |
|---------|------------|---------|------------|
| **API Server** | `server.ts` | HTTP requests, auth, CRUD, SSE | Yes |
| **Worker** | `worker.ts` | Test execution via Playwright | Yes |
| **Web UI** | Next.js | Dashboard, user interface | Yes |

The API server and workers communicate exclusively through **Redis** (BullMQ job queue + pub/sub). They share no in-process state, enabling independent scaling.

```
                API Server              Worker Process
                ──────────              ──────────────
                                        
  HTTP Request → Route Handler          BullMQ pulls job from queue
       │              │                        │
       ▼              ▼                        ▼
  Validation    Service Layer            testRunProcessor
  (Zod)              │                        │
                     ▼                        ▼
               Repository Layer         PlaywrightRunner
                     │                   (from @saveaction/core)
                     ▼                        │
                 PostgreSQL              Execute actions
                                              │
                                         Publish progress
                                         (Redis pub/sub)
                                              │
                                         Save results
                                         (PostgreSQL)
```

---

## Package Dependency Graph

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│                   @saveaction/web                     │
│                   (Next.js 16)                        │
│                        │                             │
│                 HTTP API calls                        │
│                        │                             │
│                        ▼                             │
│   ┌──────────────────────────────────────────────┐   │
│   │              @saveaction/api                  │   │
│   │              (Fastify 4)                      │   │
│   │                    │                         │   │
│   │           workspace dependency               │   │
│   │                    │                         │   │
│   │                    ▼                         │   │
│   │   ┌────────────────────────────────────┐     │   │
│   │   │        @saveaction/core            │     │   │
│   │   │        (Playwright)                │     │   │
│   │   └────────────────────────────────────┘     │   │
│   └──────────────────────────────────────────────┘   │
│                                                      │
│   ┌──────────────────────────────────────────────┐   │
│   │              @saveaction/cli                  │   │
│   │              (Commander.js)                   │   │
│   │                    │                         │   │
│   │           workspace dependency               │   │
│   │                    │                         │   │
│   │                    ▼                         │   │
│   │   ┌────────────────────────────────────┐     │   │
│   │   │        @saveaction/core            │     │   │
│   │   └────────────────────────────────────┘     │   │
│   └──────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

### Dependency Summary

| Package | Direct Dependencies | Key Libraries |
|---------|-------------------|---------------|
| `@saveaction/core` | 2 | Playwright, Zod |
| `@saveaction/cli` | `@saveaction/core` + 3 | Commander.js, chalk, Zod |
| `@saveaction/api` | `@saveaction/core` + 22 | Fastify, Drizzle ORM, BullMQ, ioredis, bcrypt, nodemailer, pino |
| `@saveaction/web` | 16 | Next.js 16, React 19, TanStack Query, react-hook-form, shadcn/ui |

### Build Order (Turborepo)

```
@saveaction/core  →  @saveaction/cli
                  →  @saveaction/api  →  @saveaction/web (runtime only)
```

The build pipeline is defined in `turbo.json`. Each package's `build` task depends on `^build` (dependencies must build first). Turborepo caches outputs in `dist/**` and `.next/**`.

---

## Data Flow

### 1. Recording Upload Flow

```
Browser Extension                API Server                   Database
─────────────────               ──────────                   ────────

  Record actions         
  in browser      ───────►  POST /api/v1/recordings   
                                    │
                              Zod validation
                              (structure, size ≤ 10MB)
                                    │
                              Check duplicate
                              (originalId)
                                    │
                              RecordingService
                                    │
                              RecordingRepository
                                    │
                                    ▼
                              INSERT into                ───► recordings
                              recordings table                 table
                                    │
                              Return recording ID
```

### 2. Test Execution Flow

```
Web UI / CLI / API                API Server              Redis Queue           Worker Process
──────────────────               ──────────              ───────────           ──────────────

  Trigger run              POST /api/v1/runs
  (browser, headless,              │
   recording, etc.)         Create run record    ──►  runs table (queued)
                                   │
                            Queue BullMQ job      ──►  test-runs queue
                                   │
                            Return run ID
                                                                               Pull job
                                                                                  │
                                                                            Load recording
                                                                            from database
                                                                                  │
                                                                            Update status ──► runs (running)
                                                                                  │
                                                                            Create PlaywrightRunner
                                                                                  │
                                                                            Launch browser
                                                                                  │
                                                                         ┌── Execute action 1
                                                                         │      │
                                                                         │   Save to DB ──────► run_actions
                                                                         │      │
                                                                         │   Publish event ──► Redis pub/sub
                                                                         │      │
                                                                         ├── Execute action 2
                                                                         │      │
                                                                         │   Save to DB ──────► run_actions
                                                                         │      │
                                                                         │   Publish event ──► Redis pub/sub
                                                                         │      ...
                                                                         │
                                                                         └── All actions done
                                                                                  │
                                                                            Close browser
                                                                                  │
                                                                            Update status ──► runs (passed/failed)
                                                                                  │
                                                                            Publish complete ──► Redis pub/sub
```

### 3. Real-Time Progress Flow (SSE)

```
Web Browser                    API Server                    Redis                    Worker
───────────                   ──────────                    ─────                    ──────

  GET /runs/:id/               Subscribe to
  progress/stream    ────►     Redis channel     ────►    SUBSCRIBE
                               (run:{id}:progress)        run:{id}:progress
                                                                                   PUBLISH event
                                                          Message arrives  ◄────   (action:success)
                               
                               Format as SSE    ◄────     Deliver to
                               event                      subscriber
                               
  Receive SSE       ◄────     Send to client
  event: action:success
  data: {...}
  
                              ... repeat for each action ...
  
  Receive SSE       ◄────     run:completed
  event: run:completed        Unsubscribe
  data: {...}                 Close stream
```

### 4. Multi-Browser Test Execution

```
Test Configuration: browsers = [chromium, firefox, webkit]

                            Worker Process
                            ──────────────
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
              ┌─────▼─────┐ ┌────▼─────┐ ┌────▼──────┐
              │ Chromium   │ │ Firefox  │ │ WebKit    │
              │ Run        │ │ Run      │ │ Run       │
              │ (sequential│ │          │ │           │
              │  per test) │ │          │ │           │
              └─────┬──────┘ └────┬─────┘ └────┬──────┘
                    │             │             │
                    ▼             ▼             ▼
              run_browser_  run_browser_  run_browser_
              results       results       results
              (chromium)    (firefox)     (webkit)
                    │             │             │
                    └─────────────┼─────────────┘
                                  │
                            Aggregate into
                            parent run result
```

---

## Package Deep Dives

### @saveaction/core

The core package is the execution engine — zero external dependencies beyond Playwright and Zod.

```
@saveaction/core/src/
├── types/                      # TypeScript interfaces
│   ├── actions.ts              # Action types (click, input, scroll, etc.)
│   ├── selectors.ts            # Selector strategy types
│   ├── recording.ts            # Recording format
│   ├── runner.ts               # RunOptions, RunResult, Reporter
│   └── analyzer.ts             # Analysis result types
├── parser/
│   └── RecordingParser.ts      # JSON → Recording (Zod validation)
├── runner/
│   ├── PlaywrightRunner.ts     # Main execution engine (~2400 lines)
│   ├── ElementLocator.ts       # Multi-strategy element finding
│   ├── NavigationHistoryManager.ts  # URL change tracking
│   └── NavigationAnalyzer.ts   # Pre-execution recording analysis
├── reporter/
│   └── ConsoleReporter.ts      # Pretty CLI output
└── analyzer/
    └── RecordingAnalyzer.ts    # Recording metadata analysis
```

#### Element Location Strategy

The `ElementLocator` supports two modes via method overloading:

**Phase 2 (Multi-Strategy Selectors)** — used when the recording provides `SelectorWithMetadata[]`:

Each selector carries a `strategy`, `priority` number (lower = higher priority), and `confidence` percentage. Selectors are sorted by priority with special boosting rules (e.g., button CSS selectors are boosted over `text-content`). High-confidence selectors (≥80%) require exactly one match; lower-confidence selectors accept the first match. If all selectors fail, a `ContentSignature` fallback uses tag name, text content, and position to locate the element.

```
Strategies: id → aria-label → name → css → css-semantic → text-content → xpath
Retry: 1000ms → 2000ms → 3000ms (3 attempts with networkidle waits)
```

**Legacy Mode** — used when the recording provides a single `SelectorStrategy` object:

Tries selectors from the `priority` array on the selector object. Handles multiple matches via text filtering, autocomplete detection, and position-based fallback.

```
Priority order (from selector.priority array): id → dataTestId → ariaLabel → name → css → xpath
Retry: exponential backoff 500ms → 1000ms → 2000ms
Recovery: scroll into view, wait for network, dismiss overlays
```

#### Action Execution Pipeline

```
For each action in recording:
  1. Navigate if URL changed
  2. Wait for page stable (networkidle)
  3. Find element (ElementLocator with retry)
  4. Execute action (click/input/scroll/etc.)
  5. Wait 300ms (animation delay)
  6. Report result (Reporter interface)
```

### @saveaction/cli

```
@saveaction/cli/src/
├── cli.ts                    # Commander.js setup + command registration
├── commands/
│   ├── run.ts                # Execute recording(s)
│   ├── validate.ts           # Validate without execution
│   ├── info.ts               # Show recording metadata
│   └── list.ts               # List recordings in directory
├── ci/
│   └── CIDetector.ts         # Detect CI environments (8 providers)
└── platform/
    └── PlatformClient.ts     # HTTP client for API integration
```

The CLI can operate in two modes:
1. **Local mode**: Run recordings from local JSON files
2. **Platform mode**: Fetch recordings from API using `--api-url` + `--api-token` or `--recording-id` / `--tag`

### @saveaction/api

The API follows a strict **Routes → Services → Repositories → Database** layered pattern:

```
@saveaction/api/src/
├── app.ts                    # Fastify app builder (plugin registration)
├── server.ts                 # HTTP server entry point
├── worker.ts                 # BullMQ worker entry point (separate process)
├── config/
│   └── env.ts                # Zod-validated environment config
├── db/
│   ├── index.ts              # Database connection (Drizzle + pg)
│   └── schema/               # 12 table definitions
├── auth/
│   ├── AuthService.ts        # Registration, login, password reset
│   └── types.ts              # Auth types + Zod schemas
├── plugins/
│   ├── database.ts           # DB plugin + auto-migration
│   ├── errorHandler.ts       # Global error handler
│   ├── jwt.ts                # JWT + API token dual-auth
│   ├── helmet.ts             # Security headers (CSP, HSTS, etc.)
│   ├── rateLimit.ts          # Rate limiting (Redis-backed)
│   ├── csrf.ts               # CSRF protection (double-submit cookie)
│   ├── swagger.ts            # OpenAPI/Swagger docs
│   ├── bullmq.ts             # BullMQ queue registration
│   └── redis.ts              # Redis connection plugin
├── routes/
│   ├── auth.ts               # /api/v1/auth/*
│   ├── tokens.ts             # /api/v1/tokens/*
│   ├── projects.ts           # /api/v1/projects/*
│   ├── suites.ts             # /api/v1/projects/:projectId/suites/*
│   ├── tests.ts              # /api/v1/projects/:projectId/tests/*
│   ├── recordings.ts         # /api/v1/recordings/*
│   ├── runs.ts               # /api/v1/runs/*
│   ├── schedules.ts          # /api/v1/schedules/*
│   └── dashboard.ts          # /api/v1/dashboard/*
├── services/                 # Business logic (11 services)
│   ├── RecordingService.ts
│   ├── RunnerService.ts
│   ├── RunProgressService.ts
│   ├── ScheduleService.ts
│   ├── ApiTokenService.ts
│   ├── DashboardService.ts
│   ├── EmailService.ts
│   ├── LockoutService.ts
│   ├── ProjectService.ts
│   ├── TestService.ts
│   └── TestSuiteService.ts
├── repositories/             # Database access (9 repositories)
│   ├── RecordingRepository.ts
│   ├── RunRepository.ts
│   ├── RunBrowserResultRepository.ts
│   ├── ScheduleRepository.ts
│   ├── ApiTokenRepository.ts
│   ├── UserRepository.ts
│   ├── ProjectRepository.ts
│   ├── TestRepository.ts
│   └── TestSuiteRepository.ts
├── queues/                   # BullMQ job processors
│   ├── JobQueueManager.ts    # Queue lifecycle management
│   ├── testRunProcessor.ts   # Test execution worker
│   ├── scheduledTestProcessor.ts  # Scheduled run trigger
│   └── cleanupProcessor.ts  # Orphan/video/token cleanup
├── redis/
│   └── RedisClient.ts        # Redis wrapper with health checks
└── errors/
    └── ApiError.ts            # Standardized error class
```

#### Request Lifecycle

```
HTTP Request
     │
     ▼
Fastify Core
     │
     ├── @fastify/cors          (CORS headers)
     ├── @fastify/helmet        (Security headers)
     ├── @fastify/rate-limit    (Rate limiting)
     ├── @fastify/cookie        (Cookie parsing)
     ├── @fastify/csrf          (CSRF validation)
     │
     ▼
Route Handler
     │
     ├── Zod Schema Validation  (Request body/params/query)
     ├── JWT/API Token Auth     (fastify.authenticate decorator)
     │
     ▼
Service Layer
     │
     ├── Business Logic
     ├── Authorization Checks
     │
     ▼
Repository Layer
     │
     ├── Drizzle ORM Queries
     │
     ▼
PostgreSQL
     │
     ▼
Response (JSON)
     │
     ├── Success: { data: { ... } }
     └── Error:   { error: { code, message, details?, requestId? } }
```

### @saveaction/web

```
@saveaction/web/src/
├── app/
│   ├── layout.tsx            # Root layout (providers, fonts)
│   ├── (auth)/               # Route group: login, register
│   │   ├── login/
│   │   └── register/
│   ├── (global)/             # Route group: global pages
│   │   ├── projects/         # Project list
│   │   └── settings/         # User settings
│   └── (project)/            # Route group: project-scoped
│       └── projects/[projectId]/
│           ├── dashboard/    # Project dashboard
│           ├── suites/       # Test suites
│           ├── tests/        # Test management
│           ├── runs/         # Run history + details
│           ├── schedules/    # Scheduled runs
│           ├── library/      # Recording library
│           └── settings/     # Project settings
├── components/
│   ├── ui/                   # shadcn/ui base components
│   ├── layout/               # Sidebar, Header, MobileNav
│   ├── projects/             # ProjectSwitcher
│   ├── suites/               # SuiteCard, SuiteDialog
│   ├── tests/                # TestConfigForm, TestCard
│   ├── runs/                 # RunDetail, ActionsTable, SSE
│   ├── schedules/            # ScheduleDialog, ScheduleCard
│   ├── settings/             # ProfileTab, SecurityTab, TokensTab
│   ├── shared/               # DataTable, Pagination, EmptyState
│   └── providers/            # React context providers
│       ├── AuthProvider
│       ├── ProjectProvider
│       ├── ThemeProvider
│       └── ToastProvider
├── lib/
│   ├── api.ts                # Type-safe API client (~1400 lines)
│   ├── events.ts             # SSE event handling
│   ├── hooks.ts              # Custom React hooks
│   └── utils.ts              # Utility functions
```

The Web UI communicates with the API exclusively over HTTP. There is no shared code or direct imports between `@saveaction/web` and `@saveaction/api` — they are coupled only by the REST API contract.

---

## Database Architecture

### Entity Relationship Diagram

```
┌──────────┐        ┌──────────────┐        ┌───────────────┐
│  users   │───────<│   projects   │───────<│  test_suites  │
│          │  1:N   │              │  1:N   │               │
│ id (PK)  │        │ id (PK)      │        │ id (PK)       │
│ email    │        │ userId (FK)  │        │ projectId(FK) │
│ password │        │ name         │        │ name          │
│ name     │        │ slug         │        │ description   │
└──────┬───┘        └──────┬───────┘        └──────┬────────┘
       │                   │                       │
       │   ┌───────────────┤                       │
       │   │               │                       │
       │   ▼               ▼                       ▼
       │ ┌──────────┐   ┌──────────┐        ┌──────────┐
       │ │api_tokens│   │recordings│        │  tests   │
       │ │          │   │          │        │          │
       │ │ id (PK)  │   │ id (PK)  │        │ id (PK)  │────────┐
       │ │userId(FK)│   │userId(FK)│◄──────┤│recordId  │        │
       │ │ token    │   │projectId │  FK   ││suiteId   │        │
       │ │ scopes   │   │ name     │        ││ config   │        │
       │ └──────────┘   │ data(JSON│)       │└──────────┘        │
       │                └──────────┘        │                    │
       │                                    │                    │
       ▼                                    │                    │
  ┌──────────┐                              │                    │
  │  runs    │◄─────────────────────────────┘                    │
  │          │      FK (testId)                                  │
  │ id (PK)  │                                                   │
  │ userId   │──────────────────────────────────────────────┐    │
  │ recordId │      FK (recordingId)                        │    │
  │ testId   │                                              │    │
  │ parentId │──── self-referential (suite → child runs)    │    │
  │ type     │      (recording|test|suite|project)          │    │
  │ status   │      (queued|running|passed|failed|cancelled)│    │
  │ browser  │                                              │    │
  └────┬─────┘                                              │    │
       │                                                    │    │
       │  1:N                                               │    │
       ▼                                                    │    │
  ┌──────────────┐    ┌────────────────────┐                │    │
  │ run_actions  │    │ run_browser_results│                │    │
  │              │    │                    │                │    │
  │ id (PK)      │    │ id (PK)            │                │    │
  │ runId (FK)   │    │ runId (FK)         │                │    │
  │ actionId     │    │ browser            │                │    │
  │ status       │    │ status             │                │    │
  │ durationMs   │    │ durationMs         │                │    │
  │ errorMessage │    │ totalActions       │                │    │
  │ screenshot   │    │ passedActions      │                │    │
  └──────────────┘    └────────────────────┘                │    │
                                                            │    │
  ┌──────────────┐    ┌──────────────────┐                  │    │
  │  schedules   │    │    webhooks      │◄─────────────────┘    │
  │              │    │                  │                        │
  │ id (PK)      │    │ id (PK)          │                        │
  │ userId (FK)  │    │ userId (FK)      │                        │
  │ targetType   │    │ url              │                        │
  │ targetId     │────│ events           │                        │
  │ cron         │    │ secret           │                        │
  │ timezone     │    └────────┬─────────┘                        │
  └──────────────┘             │                                  │
                               │  1:N                             │
                               ▼                                  │
                    ┌─────────────────────┐                       │
                    │ webhook_deliveries  │                       │
                    │                     │                       │
                    │ id (PK)             │                       │
                    │ webhookId (FK)      │                       │
                    │ event               │                       │
                    │ status              │                       │
                    │ responseCode        │                       │
                    └─────────────────────┘                       │
```

### Table Summary

| Table | Rows (Typical) | Key Indexes | Soft Delete? |
|-------|---------------|-------------|-------------|
| `users` | Hundreds | Email (unique, case-insensitive) | No |
| `projects` | Hundreds | userId, slug (unique per user) | Yes |
| `api_tokens` | Low | tokenHash (unique), userId | No |
| `recordings` | Thousands | userId+projectId, tags (GIN), originalId | Yes |
| `test_suites` | Hundreds | projectId | Yes |
| `tests` | Thousands | suiteId, projectId, recordingId | Yes |
| `runs` | Tens of thousands | userId, recordingId, testId, parentRunId, status | Yes |
| `run_actions` | Hundreds of thousands | runId+actionIndex (unique) | No |
| `run_browser_results` | Tens of thousands | runId+browser (unique) | No |
| `schedules` | Low | userId, targetType+targetId | Yes |
| `webhooks` | Low | userId | Yes |
| `webhook_deliveries` | Thousands | webhookId | No |

### Key Design Decisions

- **UUID primary keys**: `gen_random_uuid()` — no sequential leak, distributed-safe
- **Soft deletes**: `deleted_at` column on recordings, runs, schedules, projects, suites, tests
- **JSONB columns**: `recordings.data` (full recording JSON), `recordings.tags` (tag array), `tests.config` (browser/timeout config)
- **GIN indexes**: On JSONB columns for efficient tag filtering
- **Partial indexes**: Exclude soft-deleted rows from unique constraints
- **PostgreSQL enums**: `run_status`, `browser_type`, `action_status`, `schedule_status`, etc.

### Migration Strategy

- **Drizzle ORM** generates SQL migrations from schema changes
- Migrations run automatically on API server startup (configurable)
- `pnpm db:generate` creates migration files, `pnpm db:migrate` applies them
- Migration files stored in `packages/api/drizzle/`

---

## Job Queue Architecture

### Queue Types

```
┌─────────────────────────────────────────────────────────────┐
│                    BullMQ Queues (Redis)                     │
│                                                             │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────┐ │
│  │  test-runs      │  │ scheduled-tests  │  │  cleanup   │ │
│  │                 │  │                  │  │            │ │
│  │  Concurrency: 3 │  │  Concurrency: 3  │  │ Concur: 1  │ │
│  │                 │  │                  │  │            │ │
│  │  Jobs:          │  │  Jobs:           │  │ Jobs:      │ │
│  │  - Execute test │  │  - Trigger from  │  │ - Orphaned │ │
│  │  - Multi-browser│  │    cron schedule │  │   runs     │ │
│  │  - Video capture│  │                  │  │ - Old video│ │
│  │  - Screenshots  │  │  Repeatable jobs │  │ - Old ss   │ │
│  │                 │  │  (cron patterns) │  │            │ │
│  │  Retry: 3x      │  │                  │  │ Recurring: │ │
│  │  Backoff: exp   │  │                  │  │ Hourly/    │ │
│  │  (1s→2s→4s)     │  │                  │  │ Daily      │ │
│  └─────────────────┘  └──────────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Job Lifecycle

```
Queued → Active → Completed
                → Failed → (Retry) → Active → ...
                → Cancelled (removed from queue)
```

### Key Design: Separate Worker Process

The worker runs as a **separate OS process** from the API server. This was a deliberate architectural decision:

| Concern | API Server | Worker |
|---------|-----------|--------|
| CPU Usage | Low (IO-bound) | High (browser rendering) |
| Memory | ~100MB | ~200-300MB per browser |
| Crash Impact | API unavailable | Single run fails |
| Scaling | Horizontal (stateless) | Horizontal (stateless) |
| Logs | HTTP request logs | Test execution logs |

### BullMQ Redis Requirement

BullMQ requires a Redis connection **without** `keyPrefix`. The worker creates its own dedicated Redis connection:

```typescript
// worker.ts — NO keyPrefix (BullMQ requirement)
redisConnection = new Redis(env.REDIS_URL);

// app.ts — HAS keyPrefix (application data)
keyPrefix: 'saveaction:'
```

---

## Real-Time Streaming (SSE)

### Architecture

Server-Sent Events (SSE) was chosen over WebSocket for run progress streaming:

| Factor | SSE | WebSocket |
|--------|-----|-----------|
| Direction | Server → Client (sufficient) | Bidirectional |
| Complexity | Simple HTTP | Protocol upgrade |
| Firewall | Passes through (HTTP) | May be blocked |
| Reconnect | Built-in | Manual |
| Libraries | None needed | Socket.io etc. |

### Event Flow

```
Client                     API Server               Redis                Worker
──────                    ──────────               ─────                ──────

GET /runs/:id/
progress/stream
     │
     │ Accept: text/event-stream
     │
     ▼
     ├── Check if run exists
     ├── If already completed:
     │   Send: event: run:completed
     │   Close stream
     │
     ├── If running/queued:
     │   Subscribe to Redis channel
     │   Send: event: connected
     │                                                                 Execute action
     │                                              PUBLISH ◄─────── action:success
     │                              Receive  ◄──── message
     │ ◄─── event: action:success
     │       data: {actionId, type, status, durationMs}
     │
     │                                                                 Execute action
     │                                              PUBLISH ◄─────── action:failed
     │ ◄─── event: action:failed
     │       data: {actionId, error}
     │
     │                                                                 Run complete
     │                                              PUBLISH ◄─────── run:completed
     │ ◄─── event: run:completed
     │       data: {status, duration, totalActions}
     │
     Close

Keepalive: comment every 30s (: keepalive\n\n)
Safety timeout: 10 minutes
```

### No Replay Guarantee

Redis pub/sub is fire-and-forget — there is no message persistence. If a client disconnects and reconnects mid-run:

1. Frontend fetches current state from `GET /runs/:id/actions` (database)
2. Reconnects to SSE stream for remaining events
3. Merges DB state with live events (deduplication by actionId)

---

## Authentication Architecture

### Dual Authentication

The platform supports two authentication methods:

```
                     ┌─────────────────────┐
                     │  Incoming Request    │
                     └──────────┬──────────┘
                                │
                     ┌──────────▼──────────┐
                     │ Authorization Header │
                     └──────────┬──────────┘
                                │
                  ┌─────────────┴─────────────┐
                  │                           │
         Bearer eyJhbG...              Bearer sa_live_...
         (JWT Token)                   (API Token)
                  │                           │
         ┌───────▼────────┐          ┌───────▼────────┐
         │ Verify JWT     │          │ Hash + lookup  │
         │ (fastify-jwt)  │          │ in api_tokens  │
         │                │          │ table          │
         │ Check expiry   │          │                │
         │ Extract user   │          │ Check expiry   │
         │ ID from sub    │          │ Check scopes   │
         │                │          │ Extract userId │
         └───────┬────────┘          └───────┬────────┘
                 │                           │
                 └──────────┬────────────────┘
                            │
                   request.user = { sub: userId }
```

### Token Types

| Type | Format | Storage | Expiry | Use Case |
|------|--------|---------|--------|----------|
| Access Token | JWT (`eyJ...`) | Client memory | 15 min | Web UI sessions |
| Refresh Token | JWT | httpOnly cookie | 30 days | Silent token renewal |
| API Token | `sa_live_<64 hex>` | Hashed in DB | Configurable | CI/CD, API clients |

### API Token Scopes

```
recordings:read    recordings:write
runs:read          runs:execute
schedules:read     schedules:write
webhooks:read      webhooks:write
```

---

## Security Architecture

See [CORS_SECURITY.md](./CORS_SECURITY.md) for detailed configuration and examples.

### Security Layers

```
┌──────────────────────────────────────────┐
│            Nginx Reverse Proxy           │
│  - TLS termination                       │
│  - X-Frame-Options: SAMEORIGIN           │
│  - X-Content-Type-Options: nosniff       │
│  - Rate limiting (optional)              │
└──────────────────┬───────────────────────┘
                   │
┌──────────────────▼───────────────────────┐
│            Fastify API Server            │
│                                          │
│  Layer 1: CORS                           │
│  - Origin validation                     │
│  - Credentials: true                     │
│  - Allowed methods/headers               │
│                                          │
│  Layer 2: Helmet (Security Headers)      │
│  - Content-Security-Policy               │
│  - HSTS (production only)                │
│  - X-Frame-Options: DENY                 │
│  - Referrer-Policy                       │
│  - Cross-Origin-*-Policy                 │
│                                          │
│  Layer 3: Rate Limiting                  │
│  - 100/min unauthenticated               │
│  - 200/min authenticated                 │
│  - 20/min auth endpoints                 │
│  - Redis-backed (distributed)            │
│                                          │
│  Layer 4: CSRF Protection                │
│  - Double-submit cookie pattern          │
│  - Protects cookie-based routes          │
│  - API tokens exempt (inherently safe)   │
│                                          │
│  Layer 5: Authentication                 │
│  - JWT verification                      │
│  - API token validation                  │
│  - Account lockout (5 attempts → lock)   │
│                                          │
│  Layer 6: Input Validation               │
│  - Zod schemas on all inputs             │
│  - Size limits (10MB recordings)         │
│  - Type coercion + sanitization          │
│                                          │
│  Layer 7: Authorization                  │
│  - User-scoped data (userId checks)      │
│  - API token scope verification          │
│  - Resource ownership validation         │
└──────────────────────────────────────────┘
```

---

## Deployment Architecture

### Docker Compose (Production)

```
┌───────────────────────────────────────────────────────────┐
│                    Docker Network (bridge)                 │
│                                                           │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐ │
│  │ nginx   │  │  web    │  │  api    │  │   worker    │ │
│  │ :80/:443│  │  :3000  │  │  :3001  │  │ (N replicas)│ │
│  │         │  │         │  │         │  │             │ │
│  │ Reverse │  │ Next.js │  │ Fastify │  │ BullMQ +    │ │
│  │ Proxy   │  │Standalone│  │ Server  │  │ Playwright  │ │
│  └────┬────┘  └─────────┘  └────┬────┘  └──────┬──────┘ │
│       │                         │               │        │
│       │    ┌────────────────────┴───────────────┘        │
│       │    │                                             │
│       │  ┌─▼───────────┐  ┌─────────────┐               │
│       │  │  PostgreSQL │  │   Redis     │               │
│       │  │  :5432      │  │   :6379     │               │
│       │  │             │  │             │               │
│       │  │ 12 tables   │  │ Job queues  │               │
│       │  │ Drizzle ORM │  │ Rate limits │               │
│       │  │             │  │ Pub/sub     │               │
│       │  │ Volume:     │  │ Lockout     │               │
│       │  │ pgdata      │  │             │               │
│       │  └─────────────┘  └─────────────┘               │
│       │                                                  │
│  Volumes: pgdata, redis-data, videos, screenshots        │
└───────────────────────────────────────────────────────────┘
```

### Container Specifications

| Service | Base Image | Size | Memory | CPU |
|---------|-----------|------|--------|-----|
| nginx | nginx:alpine | ~40MB | 64MB | 0.25 |
| web | node:22-slim | ~82MB | 256MB | 0.5 |
| api | node:22-slim | ~200MB | 512MB | 0.5 |
| worker | node:22-slim + Playwright | ~1GB | 2GB | 1.0 |
| postgres | postgres:16-alpine | ~230MB | 512MB | 0.5 |
| redis | redis:7-alpine | ~30MB | 128MB | 0.25 |

---

## Technology Choices

### Why Playwright (not Selenium, Puppeteer, Cypress)?

| Criteria | Playwright | Selenium | Puppeteer | Cypress |
|----------|-----------|----------|-----------|---------|
| Multi-browser | ✅ Chromium, Firefox, WebKit | ✅ All | ❌ Chrome only | ❌ Chrome + Firefox |
| Auto-wait | ✅ Built-in | ❌ Manual | ❌ Manual | ✅ Built-in |
| Speed | Fast | Slow | Fast | Medium |
| API quality | Excellent | Legacy | Good | Proprietary |
| Docker support | ✅ Official images | Complex | ✅ | ❌ |
| Video recording | ✅ Built-in | ❌ Plugin | ❌ Manual | ✅ Built-in |

### Why Fastify (not Express, Nest.js, Hono)?

| Criteria | Fastify | Express | Nest.js | Hono |
|----------|---------|---------|---------|------|
| Performance | ~80K req/s | ~15K req/s | ~15K req/s | ~100K req/s |
| Schema validation | ✅ Native (JSON Schema/Zod) | ❌ Middleware | ✅ Pipes | ❌ Middleware |
| Plugin system | ✅ Encapsulated | ❌ Global middleware | ✅ Modules | ❌ Middleware |
| TypeScript | ✅ First-class | ⚠️ @types | ✅ First-class | ✅ First-class |
| Ecosystem | Good | Excellent | Good | Growing |
| OpenAPI | ✅ @fastify/swagger | Plugin | ✅ Nest/swagger | Plugin |

### Why Drizzle ORM (not Prisma, TypeORM, Knex)?

| Criteria | Drizzle | Prisma | TypeORM | Knex |
|----------|---------|--------|---------|------|
| Type safety | ✅ SQL-level | ✅ Generated | ⚠️ Decorators | ❌ Manual |
| Performance | Near-raw SQL | Slower (Rust engine) | Medium | Fast |
| Bundle size | Small | Large (engine binary) | Large | Small |
| ESM support | ✅ Native | ⚠️ Workarounds | ⚠️ Poor | ✅ |
| Migration | Push + generate | Prisma migrate | Sync/migration | Migration |
| Learning curve | Low (SQL-like) | Medium | High | Medium |

### Why BullMQ (not Agenda, bee-queue, pg-boss)?

| Criteria | BullMQ | Agenda | bee-queue | pg-boss |
|----------|--------|--------|-----------|---------|
| Backend | Redis | MongoDB | Redis | PostgreSQL |
| Repeatable jobs | ✅ Cron support | ✅ | ❌ | ✅ |
| Concurrency | ✅ Per-queue | ✅ | ✅ | ✅ |
| Priority queues | ✅ | ❌ | ✅ | ✅ |
| UI dashboard | ✅ Bull Board | ❌ | ❌ | ❌ |
| TypeScript | ✅ First-class | ⚠️ | ⚠️ | ✅ |
| Maturity | Active, battle-tested | Declining | Unmaintained | Active |

### Why Next.js (not Remix, SvelteKit, Nuxt)?

| Criteria | Next.js | Remix | SvelteKit | Nuxt |
|----------|---------|-------|-----------|------|
| React ecosystem | ✅ Full | ✅ Full | ❌ Svelte | ❌ Vue |
| App Router | ✅ Layouts, loading | ✅ Loaders | ✅ | ✅ |
| Docker standalone | ✅ `output: standalone` | ⚠️ | ✅ | ✅ |
| shadcn/ui | ✅ Official | ✅ Community | ❌ | ❌ |
| Community size | Largest | Growing | Growing | Large |
| Vercel deploy | ✅ Optimal | ✅ | ✅ | ❌ |

### Why pnpm + Turborepo (not npm, yarn, nx)?

| Criteria | pnpm + Turbo | npm workspaces | yarn + nx | yarn workspaces |
|----------|-------------|---------------|-----------|----------------|
| Disk usage | Symlinked (small) | Hoisted (large) | Varies | Hoisted |
| Speed | Fast (cache) | Slow | Fast (cache) | Medium |
| Monorepo | ✅ Native | ⚠️ Basic | ✅ Full | ⚠️ Basic |
| Build cache | ✅ Turborepo | ❌ | ✅ Nx | ❌ |
| Phantom deps | ✅ Prevented | ❌ | ✅ | ❌ |
| Setup complexity | Low | Low | High | Low |

---

## Design Principles

### 1. Separation of Concerns

Each package has a single clear responsibility. The core engine knows nothing about HTTP, databases, or UI. The API knows nothing about browsers.

### 2. Incremental Persistence

Run actions are persisted to the database **as each action completes**, not batched at the end. This means:
- Progress is visible in real-time
- If a worker crashes mid-run, completed actions are preserved
- No data loss on unexpected termination

### 3. Soft Deletes

Recordings, runs, projects, suites, and tests use `deleted_at` column instead of hard deletes. This allows:
- Undeletion (restore endpoint)
- Audit trail
- Referential integrity preservation

### 4. Progressive Complexity

The platform is simple by default but supports complex organization:
- Default project created automatically ("My Tests")
- Suites are optional groupings
- Multi-browser testing is opt-in per test
- Schedules are fully optional

### 5. Stateless Processes

API server, workers, and web UI are all stateless. All shared state lives in PostgreSQL or Redis. This enables:
- Horizontal scaling (add more instances)
- Zero-downtime deployments
- Container orchestration (Docker Compose, Kubernetes)

### 6. Fail-Safe Defaults

- Recording validation before execution
- Element location retry with exponential backoff
- Run timeout (default 10 min, configurable)
- Orphaned run cleanup (hourly)
- Graceful shutdown on SIGTERM/SIGINT

---

## Scaling Considerations

### Current Architecture Limits

| Component | Bottleneck | Mitigation | Scale Ceiling |
|-----------|-----------|------------|---------------|
| API Server | CPU (event loop) | Add instances behind LB | ~10K req/s per instance |
| Workers | RAM (browsers) | Add worker containers | ~3-4 browsers per 8GB |
| PostgreSQL | Connections, IO | Connection pooling, read replicas | ~10K concurrent |
| Redis | Memory, CPU | Redis Cluster | ~100K ops/s |
| Storage | Disk space | S3/object storage (future) | Limited by disk |

### Scaling Playbook

| Load Level | Users | Runs/Day | Recommended Setup |
|-----------|-------|----------|-------------------|
| Small | 1-10 | <100 | Single server, 1 worker |
| Medium | 10-50 | 100-500 | 2 API, 2-4 workers |
| Large | 50-200 | 500-2000 | 3 API, 8+ workers, read replica |
| Enterprise | 200+ | 2000+ | Kubernetes, managed DB/Redis, S3 |

### Future Scaling Improvements

1. **Object Storage (S3)**: Move videos/screenshots from local filesystem to S3-compatible storage
2. **PostgreSQL Read Replicas**: Route read queries to replicas
3. **Redis Cluster**: Shard Redis for high availability
4. **Connection Pooling**: PgBouncer for PostgreSQL connection management
5. **CDN**: Serve Next.js static assets from CDN

---

## Further Reading

| Document | Description |
|----------|-------------|
| [CORS & Security Headers](./CORS_SECURITY.md) | CORS config, cookie settings, CSP, nginx examples |
| [Self-Hosting Guide](./SELF_HOSTING.md) | Production deployment guide |
| [Docker Deployment](./DOCKER_DEPLOYMENT.md) | Docker Compose reference |
| [Worker Architecture](./WORKER_ARCHITECTURE.md) | BullMQ worker details |
| [API Documentation](./API.md) | Full API reference |
| [Getting Started](./GETTING_STARTED.md) | Development setup |
