# SaveAction Platform - MVP Development Plan

**Version:** 1.2.0  
**Date:** January 18, 2026  
**Status:** Phase 2 In Progress  
**Architecture:** Modular Monorepo (Option 1)

> **Progress Summary:**
> - ✅ Phase 1: Core Engine - **COMPLETED** 
> - 🟡 Phase 2: CLI Tool - **PARTIAL** (run command done, others pending)
> - ⏳ Phase 2.5: CLI Platform Integration - Not started (CI/CD support)
> - ⏳ Phase 3: API Server - Not started (includes security & stability)
> - ⏳ Phase 4: Web Dashboard - Not started
> - ⏳ Phase 5: Docker Deployment - Not started (includes TLS & backups)
> - ⏳ Phase 6: Extension Integration - Not started
>
> **Task Count:** 83 total | 17 done | 66 pending

---

## 🎯 Executive Summary

SaveAction is an open-source test automation platform that consumes JSON recordings from the SaveAction Recorder browser extension and replays them using Playwright. The platform consists of modular packages that can be used independently or together, serving different user personas from individual developers to enterprise teams.

### Key Design Principles

1. **Modular First** - Each package is independent and reusable
2. **CLI-Driven Development** - Build core functionality before UI
3. **API-First Architecture** - Web UI is optional, API is core
4. **Database Optional for Core** - CLI works without database, API adds persistence
5. **Open Source with Commercial Cloud** - Free self-hosted, paid SaaS later
6. **TypeScript Everywhere** - Type safety across entire stack
7. **Test-Driven Development** - 90%+ test coverage minimum

---

## 👥 User Personas

### Persona 1: Solo Developer (Target: CLI)
- **Needs:** Quick test replay from JSON file
- **Uses:** `npx @saveaction/cli run test.json`
- **No Database:** Results printed to console
- **No UI:** Command-line only
- **Use Case:** Local development, quick validation

### Persona 2: Small Team (Target: Self-Hosted Platform)
- **Needs:** Dashboard to view recordings, run tests, see history
- **Uses:** Docker deployment on their server
- **Has Database:** PostgreSQL for persistence
- **Has UI:** Next.js dashboard
- **Use Case:** Team collaboration, historical data

### Persona 3: Enterprise (Target: Self-Hosted + CI/CD)
- **Needs:** API integration, scheduled runs, webhooks
- **Uses:** Kubernetes deployment, API tokens
- **Has Database:** PostgreSQL with backups
- **Has UI:** Next.js + custom integrations
- **Use Case:** Production monitoring, automated testing

### Persona 4: Cloud User (Target: SaaS - Future)
- **Needs:** Zero setup, team management, analytics
- **Uses:** cloud.saveaction.com
- **Fully Managed:** Database, infrastructure, updates
- **Premium Features:** Advanced scheduling, SOC2 compliance
- **Use Case:** Non-technical teams, enterprises wanting managed solution

---

## 🏗️ Complete Architecture

### Repository Structure

```
f:/devwork/SaveAction/                       (Monorepo with pnpm workspaces)
├── packages/
│   ├── core/                                🎯 CORE ENGINE
│   ├── cli/                                 🖥️ CLI TOOL
│   ├── api/                                 🚀 REST API
│   └── web/                                 🌐 NEXT.JS UI
│
├── apps/
│   ├── self-hosted/                         🐳 DOCKER DEPLOYMENT
│   └── cloud/                               ☁️ SAAS DEPLOYMENT (future)
│
├── docs/
│   ├── API.md
│   ├── CLI.md
│   ├── SELF_HOSTING.md
│   └── ARCHITECTURE.md
│
├── turbo.json                               (build orchestration)
├── pnpm-workspace.yaml                      (workspace config)
├── package.json                             (root package)
├── tsconfig.base.json                       (shared TypeScript config)
├── .eslintrc.js                             (shared linting)
├── .prettierrc                              (shared formatting)
├── vitest.workspace.ts                      (shared test config)
└── README.md
```

### Package Dependency Graph

```
@saveaction/core (no dependencies on other packages)
    ↑
    ├── @saveaction/cli (depends on: core)
    │
    └── @saveaction/api (depends on: core)
            ↑
            └── @saveaction/web (depends on: api via HTTP)
```

**Key Principle:** Core is completely independent. Everything builds on top of it.

---

## 📦 Package Details

### Package 1: @saveaction/core

**Purpose:** Pure test execution engine. Parses JSON recordings and replays them using Playwright.

**Location:** `packages/core/`

**Structure:**
```
packages/core/
├── src/
│   ├── types/                               (copied from recorder repo)
│   │   ├── actions.ts
│   │   ├── selectors.ts
│   │   ├── recording.ts
│   │   ├── messages.ts
│   │   └── index.ts
│   │
│   ├── parser/
│   │   ├── RecordingParser.ts              (validates & parses JSON)
│   │   ├── ActionParser.ts                 (parses individual actions)
│   │   ├── SelectorParser.ts               (extracts selector strategies)
│   │   └── Validator.ts                    (Zod schema validation)
│   │
│   ├── runner/
│   │   ├── PlaywrightRunner.ts             (main execution engine)
│   │   ├── ActionExecutor.ts               (executes each action type)
│   │   ├── ElementLocator.ts               (multi-strategy element finding)
│   │   ├── WaitStrategy.ts                 (timing & waits logic)
│   │   ├── NavigationHandler.ts            (page transition logic)
│   │   └── VideoRecorder.ts                (optional video capture)
│   │
│   ├── reporter/
│   │   ├── ConsoleReporter.ts              (CLI output)
│   │   ├── JSONReporter.ts                 (structured JSON output)
│   │   └── types.ts                        (result types)
│   │
│   ├── errors/
│   │   ├── ElementNotFoundError.ts
│   │   ├── ActionExecutionError.ts
│   │   ├── NavigationError.ts
│   │   └── index.ts
│   │
│   └── index.ts                            (public API exports)
│
├── tests/
│   ├── unit/
│   │   ├── parser/
│   │   │   ├── RecordingParser.test.ts
│   │   │   ├── ActionParser.test.ts
│   │   │   └── Validator.test.ts
│   │   ├── runner/
│   │   │   ├── ActionExecutor.test.ts
│   │   │   ├── ElementLocator.test.ts
│   │   │   └── WaitStrategy.test.ts
│   │   └── reporter/
│   │       └── ConsoleReporter.test.ts
│   │
│   ├── integration/
│   │   ├── basic-flow.test.ts              (click + input + submit)
│   │   ├── navigation.test.ts              (multi-page recording)
│   │   └── error-handling.test.ts          (element not found, etc)
│   │
│   └── fixtures/
│       ├── test8_1763549638010.json        (real recording)
│       ├── simple-click.json
│       ├── form-submit.json
│       └── multi-page.json
│
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── README.md
└── CHANGELOG.md
```

**Key APIs:**

```typescript
// packages/core/src/index.ts

export { PlaywrightRunner } from './runner/PlaywrightRunner';
export { RecordingParser } from './parser/RecordingParser';
export { ConsoleReporter, JSONReporter } from './reporter';
export type { Recording, Action, RunResult, RunOptions } from './types';

// Main usage
import { PlaywrightRunner, RecordingParser } from '@saveaction/core';

const parser = new RecordingParser();
const recording = await parser.parseFile('./test.json');

const runner = new PlaywrightRunner({
  headless: false,
  video: true,
  browser: 'chromium'
});

const result = await runner.execute(recording);
console.log(result);
// {
//   status: 'success' | 'failed' | 'partial',
//   duration: 15234,
//   actionsTotal: 11,
//   actionsExecuted: 11,
//   actionsFailed: 0,
//   errors: [],
//   video: './videos/recording-123.webm'
// }
```

**Dependencies:**
```json
{
  "dependencies": {
    "playwright": "^1.40.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.3.3",
    "vitest": "^1.0.4",
    "@vitest/coverage-v8": "^1.0.4"
  }
}
```

---

### Package 2: @saveaction/cli

**Purpose:** Command-line interface for running tests locally without database or UI.

**Location:** `packages/cli/`

**Structure:**
```
packages/cli/
├── src/
│   ├── commands/
│   │   ├── run.ts                          (run test.json)
│   │   ├── validate.ts                     (validate JSON structure)
│   │   ├── list.ts                         (list recordings in dir)
│   │   ├── info.ts                         (show recording details)
│   │   └── init.ts                         (create config file)
│   │
│   ├── utils/
│   │   ├── config.ts                       (load .saveactionrc)
│   │   ├── file-finder.ts                  (find JSON files)
│   │   ├── logger.ts                       (colored CLI output)
│   │   └── spinner.ts                      (loading animations)
│   │
│   ├── cli.ts                              (main CLI entry)
│   └── types.ts                            (CLI-specific types)
│
├── bin/
│   └── saveaction.js                       (executable entry point)
│
├── tests/
│   ├── commands/
│   │   ├── run.test.ts
│   │   └── validate.test.ts
│   └── integration/
│       └── cli-e2e.test.ts
│
├── package.json
├── tsconfig.json
├── README.md
└── CHANGELOG.md
```

**CLI Commands:**

```bash
# Run a test
saveaction run test.json
saveaction run test.json --headless
saveaction run test.json --browser firefox --video

# Validate JSON structure
saveaction validate test.json

# List recordings in directory
saveaction list ./recordings/

# Show recording details
saveaction info test.json

# Initialize config file
saveaction init

# Version
saveaction --version

# Help
saveaction --help
saveaction run --help
```

**CLI Options:**

```typescript
// packages/cli/src/commands/run.ts

interface RunOptions {
  headless?: boolean;           // Default: true
  browser?: 'chromium' | 'firefox' | 'webkit'; // Default: chromium
  video?: boolean;              // Default: false
  screenshot?: boolean;         // Default: false
  timeout?: number;             // Default: 30000ms
  outputFormat?: 'console' | 'json'; // Default: console
  outputFile?: string;          // For JSON output
}
```

**Configuration File (`.saveactionrc.json`):**

```json
{
  "headless": false,
  "browser": "chromium",
  "video": true,
  "timeout": 60000,
  "recordingsDir": "./recordings",
  "outputDir": "./results"
}
```

**Dependencies:**
```json
{
  "dependencies": {
    "@saveaction/core": "workspace:*",
    "commander": "^11.1.0",
    "chalk": "^5.3.0",
    "ora": "^7.0.1"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.3.3",
    "vitest": "^1.0.4"
  }
}
```

---

### Package 3: @saveaction/api

**Purpose:** REST API for managing recordings, running tests, and storing results in PostgreSQL.

**Location:** `packages/api/`

**Structure:**
```
packages/api/
├── src/
│   ├── routes/
│   │   ├── recordings.ts                   (CRUD recordings)
│   │   ├── runs.ts                         (execute & view runs)
│   │   ├── schedules.ts                    (cron job management)
│   │   ├── auth.ts                         (login, register, tokens)
│   │   ├── webhooks.ts                     (webhook management)
│   │   └── health.ts                       (health check)
│   │
│   ├── db/
│   │   ├── schema.ts                       (Drizzle ORM schema)
│   │   ├── migrations/                     (SQL migrations)
│   │   │   ├── 0001_initial.sql
│   │   │   ├── 0002_add_schedules.sql
│   │   │   └── meta/
│   │   ├── client.ts                       (database connection)
│   │   └── seed.ts                         (dev data seeding)
│   │
│   ├── services/
│   │   ├── RecordingService.ts             (business logic)
│   │   ├── RunnerService.ts                (calls @saveaction/core)
│   │   ├── ScheduleService.ts              (cron job logic)
│   │   ├── StorageService.ts               (file storage)
│   │   ├── AuthService.ts                  (JWT, bcrypt)
│   │   └── WebhookService.ts               (HTTP notifications)
│   │
│   ├── middleware/
│   │   ├── auth.ts                         (JWT verification)
│   │   ├── error-handler.ts                (global error handling)
│   │   ├── rate-limiter.ts                 (API rate limiting)
│   │   └── cors.ts                         (CORS configuration)
│   │
│   ├── types/
│   │   ├── api.ts                          (API request/response types)
│   │   └── db.ts                           (database types)
│   │
│   ├── utils/
│   │   ├── jwt.ts                          (token generation)
│   │   ├── password.ts                     (bcrypt utilities)
│   │   └── validation.ts                   (Zod schemas)
│   │
│   ├── server.ts                           (Express/Fastify app)
│   └── index.ts                            (entry point)
│
├── tests/
│   ├── routes/
│   │   ├── recordings.test.ts
│   │   ├── runs.test.ts
│   │   └── auth.test.ts
│   ├── services/
│   │   ├── RunnerService.test.ts
│   │   └── ScheduleService.test.ts
│   └── integration/
│       └── api-e2e.test.ts
│
├── drizzle.config.ts                       (Drizzle ORM config)
├── package.json
├── tsconfig.json
├── README.md
└── CHANGELOG.md
```

**Database Schema (PostgreSQL):**

```sql
-- users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user', -- 'user', 'admin'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- api_tokens table
CREATE TABLE api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  scope VARCHAR(100)[] DEFAULT '{}', -- ['recordings:write', 'runs:execute']
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- recordings table
CREATE TABLE recordings (
  id VARCHAR(50) PRIMARY KEY, -- rec_1763549638010
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  url VARCHAR(500) NOT NULL,
  json_data JSONB NOT NULL, -- full recording JSON
  uploaded_from VARCHAR(50), -- 'browser-extension', 'cli', 'api'
  tags VARCHAR(100)[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- runs table
CREATE TABLE runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id VARCHAR(50) REFERENCES recordings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL, -- 'running', 'success', 'failed', 'partial'
  duration INTEGER, -- milliseconds
  actions_total INTEGER NOT NULL,
  actions_executed INTEGER NOT NULL,
  actions_failed INTEGER NOT NULL,
  error_message TEXT,
  video_path VARCHAR(500),
  screenshots TEXT[], -- array of file paths
  browser VARCHAR(50), -- 'chromium', 'firefox', 'webkit'
  headless BOOLEAN DEFAULT true,
  trigger VARCHAR(50), -- 'manual', 'scheduled', 'api', 'webhook'
  metadata JSONB, -- additional run metadata
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- run_actions table (detailed action results)
CREATE TABLE run_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
  action_id VARCHAR(20) NOT NULL, -- act_001, act_002
  action_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL, -- 'success', 'failed', 'skipped'
  duration INTEGER, -- milliseconds
  error_message TEXT,
  screenshot_path VARCHAR(500),
  executed_at TIMESTAMP
);

-- schedules table
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id VARCHAR(50) REFERENCES recordings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  cron_expression VARCHAR(100) NOT NULL, -- '0 0 * * *' (daily at midnight)
  enabled BOOLEAN DEFAULT true,
  browser VARCHAR(50) DEFAULT 'chromium',
  headless BOOLEAN DEFAULT true,
  last_run_id UUID REFERENCES runs(id),
  last_run_at TIMESTAMP,
  next_run_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- webhooks table
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  url VARCHAR(500) NOT NULL,
  events VARCHAR(50)[], -- ['run.completed', 'run.failed']
  secret VARCHAR(255), -- for HMAC signature
  enabled BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- indexes for performance
CREATE INDEX idx_recordings_user_id ON recordings(user_id);
CREATE INDEX idx_recordings_created_at ON recordings(created_at DESC);
CREATE INDEX idx_runs_recording_id ON runs(recording_id);
CREATE INDEX idx_runs_user_id ON runs(user_id);
CREATE INDEX idx_runs_status ON runs(status);
CREATE INDEX idx_runs_created_at ON runs(created_at DESC);
CREATE INDEX idx_run_actions_run_id ON run_actions(run_id);
CREATE INDEX idx_schedules_user_id ON schedules(user_id);
CREATE INDEX idx_schedules_next_run_at ON schedules(next_run_at) WHERE enabled = true;
```

**API Endpoints:**

> **Versioning:** All endpoints use `/api/v1/` prefix (e.g., `/api/v1/auth/login`). This allows future breaking changes without affecting existing integrations.

```typescript
// Authentication
POST   /api/v1/auth/register          // Register new user
POST   /api/v1/auth/login             // Login (returns JWT)
POST   /api/v1/auth/logout            // Logout
POST   /api/v1/auth/refresh           // Refresh access token (using refresh token cookie)
POST   /api/v1/auth/forgot-password   // Send password reset email
POST   /api/v1/auth/reset-password    // Reset password with token
GET    /api/auth/me                // Get current user
POST   /api/auth/tokens            // Generate API token
GET    /api/auth/tokens            // List API tokens
DELETE /api/auth/tokens/:id        // Revoke API token

// Recordings
GET    /api/recordings             // List all recordings (paginated)
POST   /api/recordings             // Upload new recording
GET    /api/recordings/:id         // Get recording details
PUT    /api/recordings/:id         // Update recording (name, tags)
DELETE /api/recordings/:id         // Delete recording
GET    /api/recordings/:id/runs    // Get runs for recording

// Runs
GET    /api/runs                   // List all runs (paginated)
POST   /api/runs                   // Execute a test
GET    /api/runs/:id               // Get run details
POST   /api/runs/:id/cancel        // Cancel a running test
GET    /api/runs/:id/actions       // Get detailed action results
GET    /api/runs/:id/video         // Download video
DELETE /api/runs/:id               // Delete run

// Schedules
GET    /api/schedules              // List all schedules
POST   /api/schedules              // Create schedule
GET    /api/schedules/:id          // Get schedule details
PUT    /api/schedules/:id          // Update schedule
DELETE /api/schedules/:id          // Delete schedule
POST   /api/schedules/:id/toggle   // Enable/disable schedule

// Webhooks
GET    /api/webhooks               // List webhooks
POST   /api/webhooks               // Create webhook
PUT    /api/webhooks/:id           // Update webhook
DELETE /api/webhooks/:id           // Delete webhook

// Health
GET    /api/health                 // Health check
GET    /api/health/db              // Database health
```

**Example API Usage:**

```bash
# Upload recording
curl -X POST http://localhost:4000/api/recordings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @test8_1763549638010.json

# Run test
curl -X POST http://localhost:4000/api/runs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recordingId": "rec_1763549638010",
    "browser": "chromium",
    "headless": true,
    "video": true
  }'

# Get run status
curl http://localhost:4000/api/runs/abc-123 \
  -H "Authorization: Bearer $TOKEN"
```

**Dependencies:**
```json
{
  "dependencies": {
    "@saveaction/core": "workspace:*",
    "fastify": "^4.25.0",
    "@fastify/cors": "^8.4.2",
    "@fastify/jwt": "^7.2.3",
    "@fastify/rate-limit": "^9.1.0",
    "drizzle-orm": "^0.29.0",
    "postgres": "^3.4.3",
    "bcrypt": "^5.1.1",
    "zod": "^3.22.4",
    "node-cron": "^3.0.3"
  },
  "devDependencies": {
    "drizzle-kit": "^0.20.7",
    "@types/bcrypt": "^5.0.2",
    "@types/node": "^20.10.0",
    "@types/node-cron": "^3.0.11",
    "typescript": "^5.3.3",
    "vitest": "^1.0.4"
  }
}
```

---

### Package 4: @saveaction/web

**Purpose:** Next.js 15 web dashboard for managing recordings and viewing test results.

**Location:** `packages/web/`

**Structure:**
```
packages/web/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── register/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   │
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx                  (sidebar, nav)
│   │   │   ├── page.tsx                    (dashboard home)
│   │   │   │
│   │   │   ├── recordings/
│   │   │   │   ├── page.tsx                (list recordings)
│   │   │   │   ├── upload/
│   │   │   │   │   └── page.tsx            (upload new)
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx            (view recording)
│   │   │   │       └── run/
│   │   │   │           └── page.tsx        (trigger run)
│   │   │   │
│   │   │   ├── runs/
│   │   │   │   ├── page.tsx                (list runs)
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx            (view run details)
│   │   │   │
│   │   │   ├── schedules/
│   │   │   │   ├── page.tsx                (list schedules)
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx            (create schedule)
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx            (edit schedule)
│   │   │   │
│   │   │   └── settings/
│   │   │       ├── page.tsx                (account settings)
│   │   │       ├── api-tokens/
│   │   │       │   └── page.tsx            (manage tokens)
│   │   │       └── webhooks/
│   │   │           └── page.tsx            (manage webhooks)
│   │   │
│   │   ├── api/                            (Next.js API routes)
│   │   │   └── proxy/
│   │   │       └── [...path]/
│   │   │           └── route.ts            (proxy to @saveaction/api)
│   │   │
│   │   ├── layout.tsx                      (root layout)
│   │   └── globals.css                     (Tailwind CSS)
│   │
│   ├── components/
│   │   ├── ui/                             (shadcn/ui components)
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── card.tsx
│   │   │   ├── table.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── badge.tsx
│   │   │   └── ...
│   │   │
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── Footer.tsx
│   │   │
│   │   ├── recordings/
│   │   │   ├── RecordingUploader.tsx       (drag-drop upload)
│   │   │   ├── RecordingList.tsx
│   │   │   ├── RecordingCard.tsx
│   │   │   └── RecordingViewer.tsx
│   │   │
│   │   ├── runs/
│   │   │   ├── RunList.tsx
│   │   │   ├── RunCard.tsx
│   │   │   ├── RunDetails.tsx
│   │   │   ├── RunControls.tsx             (start run form)
│   │   │   ├── ExecutionLog.tsx            (real-time action log)
│   │   │   └── VideoPlayer.tsx             (playback video)
│   │   │
│   │   ├── schedules/
│   │   │   ├── ScheduleList.tsx
│   │   │   ├── ScheduleForm.tsx
│   │   │   └── CronBuilder.tsx             (visual cron editor)
│   │   │
│   │   └── auth/
│   │       ├── LoginForm.tsx
│   │       └── RegisterForm.tsx
│   │
│   ├── lib/
│   │   ├── api-client.ts                   (fetch wrapper)
│   │   ├── auth.ts                         (JWT handling)
│   │   ├── utils.ts                        (helper functions)
│   │   └── hooks/
│   │       ├── useRecordings.ts
│   │       ├── useRuns.ts
│   │       └── useAuth.ts
│   │
│   └── types/
│       └── index.ts                        (frontend types)
│
├── public/
│   ├── favicon.ico
│   └── logo.svg
│
├── tests/
│   ├── components/
│   │   └── RecordingUploader.test.tsx
│   └── e2e/
│       └── upload-and-run.spec.ts          (Playwright E2E)
│
├── .env.example
├── next.config.js
├── tailwind.config.ts
├── postcss.config.js
├── components.json                         (shadcn/ui config)
├── package.json
├── tsconfig.json
├── README.md
└── CHANGELOG.md
```

**Key Features:**

1. **Recording Upload**
   - Drag & drop JSON file
   - Validate on client-side
   - Show preview before upload
   - Tag management

2. **Recording List**
   - Paginated table
   - Search by name
   - Filter by tags
   - Sort by date
   - Quick actions (run, delete, duplicate)

3. **Run Execution**
   - Browser selection (Chromium, Firefox, WebKit)
   - Headless toggle
   - Video recording option
   - Real-time progress updates
   - Action-by-action execution log

4. **Run Details**
   - Status (running, success, failed)
   - Duration, timestamps
   - Action results table
   - Error details
   - Video playback
   - Screenshots gallery

5. **Schedule Management**
   - Visual cron builder
   - Enable/disable schedules
   - View next run time
   - Run history

6. **Settings**
   - API token management
   - Webhook configuration
   - User profile

**Dependencies:**
```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-select": "^2.0.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.1.0",
    "lucide-react": "^0.294.0",
    "zustand": "^4.4.7",
    "react-dropzone": "^14.2.3",
    "date-fns": "^2.30.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/react": "^18.2.45",
    "@types/react-dom": "^18.2.18",
    "typescript": "^5.3.3",
    "tailwindcss": "^3.3.6",
    "postcss": "^8.4.32",
    "autoprefixer": "^10.4.16",
    "eslint": "^8.56.0",
    "eslint-config-next": "^15.0.0",
    "@playwright/test": "^1.40.0"
  }
}
```

---

## 🚀 MVP Implementation Phases

### Phase 1: Core Engine (Week 1) ⭐ **START HERE** ✅ COMPLETED

**Goal:** Build the fundamental test execution engine that can parse JSON and replay tests.

**Status:** ✅ COMPLETED (January 2026)

#### Tasks:

1. ✅ **Setup Project Structure**
   - Initialize monorepo with pnpm workspaces
   - Configure TypeScript (tsconfig.base.json)
   - Setup Turborepo for build orchestration
   - Configure ESLint + Prettier
   - Setup Vitest for testing

2. ✅ **Copy Types from Recorder**
   - Copy `types/` folder from recorder repo
   - Ensure types are identical (no modifications)
   - Export all types from index.ts

3. ✅ **Build Parser Module**
   - `RecordingParser.ts`: Parse JSON file into Recording object
   - Zod schema validation
   - Unit tests for parser (100% coverage)

4. ✅ **Build Runner Module**
   - `PlaywrightRunner.ts`: Main execution engine
   - All action types implemented:
     - Click action
     - Input action
     - Navigation action
     - Scroll action
     - Select action
     - Keypress action
     - Submit action
     - Hover action
   - `ElementLocator.ts`: Multi-strategy element location
     - Try selectors in priority order (id → dataTestId → ariaLabel → name → css → xpath → position)
     - Exponential backoff retry (500ms → 1000ms → 2000ms)
   - `NavigationHistoryManager.ts`: Track page navigations
   - `NavigationAnalyzer.ts`: Detect missing prerequisites
   - Cross-browser support (Chromium, Firefox, WebKit)

5. ✅ **Build Reporter Module**
   - `ConsoleReporter.ts`: Pretty CLI output with emojis

6. ✅ **Integration Tests**
   - Test with real recordings (22 actions, 100% pass rate)
   - Test multi-page navigation
   - Test error handling (element not found)
   - Test all 3 browsers (Chromium, Firefox, WebKit)

**Deliverables:**
- ✅ `@saveaction/core` package functional
- ✅ Can parse JSON recordings
- ✅ Can execute all action types
- ✅ 81 unit tests passing
- ✅ Works with real recording files
- ✅ Cross-browser support (Chromium, Firefox, WebKit)

**Success Criteria:**
```typescript
import { PlaywrightRunner, RecordingParser } from '@saveaction/core';

const parser = new RecordingParser();
const recording = await parser.parseFile('./test8_1763549638010.json');

const runner = new PlaywrightRunner({ headless: false });
const result = await runner.execute(recording);

console.log(result.status); // 'success'
console.log(result.actionsExecuted); // 11
```

---

### Phase 2: CLI Tool (Week 1) ⭐ **SECOND PRIORITY** 🟡 PARTIAL

**Goal:** Create command-line interface for developers to run tests locally.

**Status:** 🟡 PARTIAL - `run` command complete, other commands pending

#### Tasks:

1. ✅ **Setup CLI Package**
   - Initialize package with Commander.js
   - Setup bin entry point
   - Configure CLI help text

2. **Implement Commands**
   - ✅ `saveaction run <file>`: Execute test
   - ⏳ `saveaction validate <file>`: Validate JSON
   - ⏳ `saveaction info <file>`: Show recording details
   - ✅ `saveaction --version`: Show version
   - ✅ `saveaction --help`: Show help

3. ✅ **Add CLI Options** (for run command)
   - `--headless`: Run in headless mode
   - `--browser <name>`: Select browser (chromium/firefox/webkit)
   - `--video`: Record video
   - `--timeout`: Custom timeout
   - `--timing-mode`: realistic/fast/instant
   - `--speed`: Speed multiplier
   - `--max-delay`: Maximum delay between actions

4. ⏳ **Configuration File Support**
   - Support `.saveactionrc.json`
   - Support `.saveactionrc.js`
   - Load config from file or CLI args

5. ✅ **Pretty CLI Output**
   - Emoji indicators (✅ ❌ 🎯)
   - Progress display
   - Error formatting
   - Duration and summary

6. ⏳ **Testing**
   - Unit tests for commands
   - Integration tests (CLI E2E)

**Deliverables:**
- ✅ `@saveaction/cli` package functional
- ✅ `run` command works with all options
- ⏳ Additional commands (`validate`, `info`, `list`, `init`)
- ⏳ Configuration file support

**Success Criteria:**
```bash
# Install
npm install -g @saveaction/cli

# Run test
saveaction run test8_1763549638010.json --headless

# Output:
# ✓ Recording parsed successfully
# ✓ Action 1/11: Click on input#sector-input
# ✓ Action 2/11: Input "Resturant" into input#sector-input
# ✓ Action 3/11: Click on input#location-input
# ...
# ✅ Test completed successfully (11/11 actions)
# Duration: 15.2s
```

---

### Phase 3: API Server (Week 2) ⏳ NOT STARTED

**Goal:** Build REST API with PostgreSQL for persistence and multi-user support.

**Status:** ⏳ NOT STARTED

#### Tasks:

1. **Setup API Package**
   - Initialize Fastify server
   - Configure TypeScript
   - Setup environment variables

2. **Database Setup**
   - Create Drizzle ORM schema
   - Write migrations
   - Setup connection pool
   - Create seed script for dev data

3. **Implement Auth**
   - User registration
   - Login (JWT)
   - API token generation
   - Auth middleware

4. **Implement Recording Routes**
   - POST /api/recordings (upload)
   - GET /api/recordings (list)
   - GET /api/recordings/:id (details)
   - DELETE /api/recordings/:id (delete)

5. **Implement Run Routes**
   - POST /api/runs (execute test)
   - GET /api/runs (list)
   - GET /api/runs/:id (details)
   - GET /api/runs/:id/video (download)

6. **Implement Runner Service**
   - Integrate @saveaction/core
   - Save results to database
   - Store videos/screenshots
   - Handle errors gracefully

7. **Security & Stability (CRITICAL)**
   - Input sanitization (XSS/injection prevention)
   - Run timeout (kill after 10 minutes)
   - Concurrent run limit (max 5 simultaneous)
   - Run queue for overflow
   - Orphan cleanup on restart
   - Rate limiting (100 req/min)

8. **Observability**
   - Structured JSON logging (pino)
   - Request ID tracing
   - Health check endpoints

9. **Testing**
   - Unit tests for services
   - Integration tests for API routes
   - Database transaction tests

**Deliverables:**
- ✅ `@saveaction/api` package functional
- ✅ PostgreSQL database schema
- ✅ Authentication working
- ✅ Can upload recordings via API
- ✅ Can trigger runs via API
- ✅ Results stored in database
- ✅ Security hardening complete
- ✅ Stable under concurrent load

**Success Criteria:**
```bash
# Start API server
cd packages/api
npm run dev

# Register user
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret"}'

# Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret"}'
# Response: { "token": "eyJhbGc..." }

# Upload recording
curl -X POST http://localhost:4000/api/recordings \
  -H "Authorization: Bearer eyJhbGc..." \
  -d @test8_1763549638010.json

# Run test
curl -X POST http://localhost:4000/api/runs \
  -H "Authorization: Bearer eyJhbGc..." \
  -d '{"recordingId":"rec_1763549638010","headless":true}'
```

---

### Phase 4: Web Dashboard (Week 2-3) ⏳ NOT STARTED

**Goal:** Build Next.js UI for managing recordings and viewing results.

**Status:** ⏳ NOT STARTED

#### Tasks:

1. **Setup Next.js App**
   - Initialize Next.js 15 with App Router
   - Setup Tailwind CSS
   - Install shadcn/ui
   - Configure environment variables

2. **Implement Auth Pages**
   - Login page
   - Register page
   - Protected routes
   - JWT handling

3. **Implement Dashboard**
   - Sidebar navigation
   - Home page (overview)
   - Settings page

4. **Implement Recordings**
   - Upload page (drag & drop)
   - List page (table with pagination)
   - Details page (view JSON, actions)
   - Run trigger page

5. **Implement Runs**
   - List page (filter by status)
   - Details page (action results, video)
   - Real-time updates (polling or WebSocket)

6. **UI Polish**
   - Loading states
   - Error handling
   - Toast notifications
   - Responsive design

7. **Testing**
   - Component tests (React Testing Library)
   - E2E tests (Playwright)

**Deliverables:**
- ✅ `@saveaction/web` package functional
- ✅ Can upload recordings via UI
- ✅ Can trigger runs via UI
- ✅ Can view run results
- ✅ Professional UI/UX

**Success Criteria:**
- User can register and login
- User can upload test8 JSON file
- User can click "Run Test" and see it execute
- User can view results and video

---

### Phase 5: Docker Deployment (Week 3) ⏳ NOT STARTED

**Goal:** Package everything for easy self-hosting.

**Status:** ⏳ NOT STARTED

#### Tasks:

1. **Create Docker Images**
   - Dockerfile for API
   - Dockerfile for Web (Next.js)
   - Multi-stage builds for optimization

2. **Docker Compose**
   - PostgreSQL service
   - API service
   - Web service
   - Nginx reverse proxy
   - Volume mounts for persistence

3. **Security Configuration**
   - TLS/HTTPS termination (Let's Encrypt or custom certs)
   - Secure headers configuration
   - API tokens never transmitted over plaintext

4. **Database Operations**
   - Automated daily backups (pg_dump cron)
   - Backup retention policy (7 days)
   - Document restore procedure
   - Optional: backup to S3/external storage

5. **Environment Configuration**
   - .env.example file
   - Documentation for setup
   - Health checks

6. **Documentation**
   - SELF_HOSTING.md guide
   - Backup and restore instructions
   - Troubleshooting guide
   - Security best practices

**Deliverables:**
- ✅ `docker-compose.yml` works out of the box
- ✅ One command deployment
- ✅ Production-ready setup
- ✅ HTTPS enabled by default
- ✅ Automated backups configured

**Success Criteria:**
```bash
# Clone repo
git clone https://github.com/saveaction/saveaction
cd saveaction/apps/self-hosted

# Configure
cp .env.example .env
# Edit .env with your settings

# Deploy
docker-compose up -d

# Access
# Web: http://localhost:3000
# API: http://localhost:4000
```

---

### Phase 6: Extension Integration (Week 4) ⏳ NOT STARTED

**Goal:** Allow browser extension to auto-upload recordings to platform.

**Status:** ⏳ NOT STARTED (one bug fix completed: filter extension UI actions)

#### Tasks (Extension Repo):

1. ⏳ **Add Settings Page**
   - Platform URL input
   - API token input
   - Auto-upload toggle
   - Connection test button

2. ⏳ **Implement Upload Logic**
   - Upload after recording stops
   - Show success/failure notification
   - Retry logic on failure
   - Fallback to local download

3. ✅ **Bug Fix: Filter Extension UI Actions**
   - Don't record clicks on SaveAction extension UI (#saveaction-recording-indicator)
   - These elements don't exist during replay

4. ⏳ **Testing**
   - Test with self-hosted platform
   - Test with invalid token
   - Test network failures

#### Tasks (Platform Repo):

1. **API Token UI**
   - Generate token page
   - List tokens
   - Revoke tokens
   - Show last used

2. **Webhook Support (Optional)**
   - Notify on upload
   - Notify on run completion

**Deliverables:**
- ✅ Extension can connect to platform
- ✅ Recordings auto-upload
- ✅ Users can manage API tokens in UI

---

## 🛠️ Tech Stack Summary

| Component | Technology | Reasoning |
|-----------|------------|-----------|
| **Language** | TypeScript | Type safety, better DX, matches recorder |
| **Test Runner** | Playwright | Best for browser automation, multi-browser |
| **CLI Framework** | Commander.js | Standard, mature, excellent docs |
| **API Framework** | Fastify | Fast, excellent TypeScript support, plugins |
| **Database** | PostgreSQL | Production-ready, JSONB support, reliable |
| **ORM** | Drizzle ORM | Type-safe, SQL-like, excellent migrations |
| **Auth** | JWT + bcrypt | Stateless, scalable, standard |
| **Web Framework** | Next.js 15 | React 19, App Router, API routes, SSR/SSG |
| **UI Library** | shadcn/ui | Accessible, customizable, Radix UI based |
| **Styling** | Tailwind CSS | Rapid development, consistent design |
| **Testing** | Vitest | Fast, Vite-native, Jest-compatible |
| **E2E Testing** | Playwright Test | Same as runner, consistent |
| **Monorepo** | pnpm + Turborepo | Fast, efficient, caching |
| **Deployment** | Docker | Standard, easy self-hosting |

---

## 📊 File Storage Strategy

### Local Storage (Development)
```
~/.saveaction/
├── recordings/
│   ├── rec_1763549638010.json
│   └── rec_1763549638011.json
├── runs/
│   ├── run_abc123/
│   │   ├── result.json
│   │   ├── video.webm
│   │   └── screenshots/
│   │       ├── act_001.png
│   │       └── act_002.png
│   └── run_def456/
└── config.json
```

### Production Storage (Self-Hosted)
```
/var/lib/saveaction/
├── recordings/         (stored in PostgreSQL, files optional)
├── runs/
│   └── <user_id>/
│       └── <run_id>/
│           ├── video.webm
│           └── screenshots/
└── backups/
```

### Cloud Storage (SaaS - Future)
- AWS S3 / DigitalOcean Spaces
- Signed URLs for downloads
- Automatic cleanup after 30 days

### Storage Cleanup Policy
- **Videos:** Auto-delete after 30 days (configurable)
- **Screenshots:** Auto-delete after 30 days (configurable)
- **Background job:** Cron task runs daily to cleanup expired files
- **User quotas:** Track storage per user, enforce limits
- **Manual cleanup:** API endpoint to delete old runs
- **Environment variable:** `STORAGE_RETENTION_DAYS=30`

---

## 🧪 Testing Strategy

### Unit Tests (Vitest)
- **Core Parser:** Test JSON parsing, validation
- **Core Runner:** Mock Playwright, test action execution logic
- **API Services:** Test business logic with mock database
- **CLI Commands:** Test command parsing, options

**Target:** 90%+ coverage

### Integration Tests (Vitest + Playwright Test)
- **Core:** Test with real Playwright browser
- **API:** Test routes with real database (test container)
- **CLI:** Test full command execution

### E2E Tests (Playwright Test)
- **Web UI:** Full user flows
  - Upload recording → Run test → View results
  - Register → Login → Create schedule

**Target:** Critical paths covered

### Test Data
- Use test8_1763549638010.json as primary fixture
- Create simplified fixtures for specific scenarios
- Mock recordings for edge cases

---

## 📈 Performance Targets

### CLI
- Parse JSON: < 100ms
- Execute 10-action test: < 30s (non-headless)
- Memory usage: < 500MB

### API
- Response time: < 200ms (95th percentile)
- Concurrent runs: 10+ (depends on hardware)
- Database queries: < 50ms

### Web UI
- First Contentful Paint: < 1s
- Time to Interactive: < 2s
- Bundle size: < 500KB (gzipped)

---

## 🚀 Distribution & Deployment

### CLI (npm)
```bash
# Publish to npm
npm login
npm publish --access public

# Users install
npm install -g @saveaction/cli
```

### Self-Hosted (Docker)
```bash
# Build images
docker-compose build

# Push to registry (optional)
docker push saveaction/api:latest
docker push saveaction/web:latest

# Deploy
docker-compose up -d
```

### GitHub Actions Example
```yaml
name: SaveAction Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install SaveAction CLI
        run: npm install -g @saveaction/cli
      
      - name: Run Tests
        run: |
          saveaction run ./tests/checkout-flow.json --headless
          saveaction run ./tests/login-flow.json --headless
```

---

## 🔒 Security Considerations

### Authentication
- JWT access token with short expiry (15 minutes)
- Refresh tokens stored in httpOnly cookies (7 days), rotation on use
- Password hashing with bcrypt (cost factor: 12)
- Password reset flow via email (1hr token expiry)
- Email verification on registration (24hr token expiry)
- Account lockout after 5 failed attempts (15min lockout)
- CSRF protection for cookie-based auth
- API token format: `sa_live_<random>`

### Authorization
- Row-level security (users can only access their data)
- API rate limiting (100 req/min per IP)
- CORS configuration

### Data Privacy
- Extension already masks sensitive data
- Additional server-side validation
- No sensitive data in logs
- HTTPS only in production

### Database
- Parameterized queries (SQL injection prevention)
- Connection pooling
- Regular backups
- Encrypted at rest (production)

---

## 📚 Documentation Plan

### User Documentation
- **README.md** - Project overview, quick start
- **CLI.md** - CLI usage, all commands, examples
- **API.md** - API reference, authentication, examples
- **SELF_HOSTING.md** - Deployment guide, configuration

### Developer Documentation
- **ARCHITECTURE.md** - System design, data flow
- **CONTRIBUTING.md** - How to contribute
- **DEVELOPMENT.md** - Local setup, testing
- **CHANGELOG.md** - Version history

### API Documentation
- OpenAPI/Swagger spec
- Postman collection
- Code examples (curl, JavaScript, Python)

---

## 🎯 Success Metrics (MVP)

### Technical Metrics
- ✅ CLI executes test8 JSON successfully
- ✅ Core package has 90%+ test coverage
- ✅ API handles 100 requests/minute
- ✅ Web UI loads in < 2 seconds
- ✅ Docker deployment works in < 5 minutes

### User Metrics (Post-Launch)
- GitHub stars: 100+ in first month
- npm downloads: 500+ per month
- Self-hosted deployments: 10+ teams
- GitHub issues: < 10 open bugs
- Documentation views: 1000+ per month

---

## 🔮 Post-MVP Roadmap

### Phase 7: Advanced Features (Month 2)
- Schedule management (cron jobs)
- Webhook notifications
- Video comparison (visual regression)
- Screenshot comparison
- Parallel test execution
- Browser profiles (cookies, localStorage)

### Phase 8: CI/CD Integrations (Month 3)
- GitHub App
- GitLab integration
- Bitbucket integration
- Jenkins plugin
- CircleCI orb

### Phase 9: Cloud SaaS (Month 4)
- Multi-tenancy
- Team management
- Usage analytics
- Billing integration (Stripe)
- SOC2 compliance

### Phase 10: Advanced Testing (Month 5)
- Shadow DOM support
- iFrame support
- File upload testing
- Drag & drop testing
- Mobile device emulation
- Network throttling

---

## 💰 Monetization Strategy (Future)

### Free Tier (Open Source)
- ✅ CLI (unlimited)
- ✅ Self-hosted platform (unlimited)
- ✅ Community support
- ✅ All core features

### Cloud SaaS (Paid)
- **Starter:** $29/month
  - 100 test runs/month
  - 1 team member
  - 30-day history
  - Email support

- **Pro:** $99/month
  - 1000 test runs/month
  - 5 team members
  - 90-day history
  - Priority support
  - Advanced scheduling

- **Enterprise:** Custom pricing
  - Unlimited runs
  - Unlimited team members
  - Unlimited history
  - Dedicated support
  - SLA guarantee
  - Custom integrations

---

## 🤝 Open Source Strategy

### License
- **MIT License** (most permissive)
- Allows commercial use
- No copyleft requirements

### Community Building
- Welcoming CONTRIBUTING.md
- Code of Conduct
- Issue templates
- PR templates
- Good first issues
- Hacktoberfest participation

### Governance
- Clear roadmap
- Public decision making
- Transparent development
- Regular releases
- Changelog maintenance

---

## 📋 Next Steps (Week 1 Checklist)

### Day 1-2: Project Setup
- [ ] Initialize monorepo with pnpm
- [ ] Configure Turborepo
- [ ] Setup TypeScript config
- [ ] Setup ESLint + Prettier
- [ ] Setup Vitest
- [ ] Create package.json files
- [ ] Copy types from recorder repo

### Day 3-4: Core Parser
- [ ] Build RecordingParser
- [ ] Build ActionParser
- [ ] Build Validator (Zod schemas)
- [ ] Write unit tests
- [ ] Test with test8 JSON

### Day 5-7: Core Runner
- [ ] Build PlaywrightRunner skeleton
- [ ] Implement ClickAction executor
- [ ] Implement InputAction executor
- [ ] Implement NavigationAction executor
- [ ] Implement ScrollAction executor
- [ ] Build ElementLocator
- [ ] Build WaitStrategy
- [ ] Write integration tests
- [ ] Test with test8 JSON end-to-end

---

## 🎉 Conclusion

This MVP plan provides a clear, phased approach to building SaveAction from the ground up. Starting with the CLI and core engine ensures a solid foundation before adding the complexity of APIs, databases, and web UIs.

**Key Takeaways:**
1. **Start Simple:** CLI + Core first (Week 1)
2. **Modular Design:** Each package is independent
3. **Test-Driven:** 90%+ coverage from day one
4. **Scalable:** Architecture supports growth from 1 to 1M users
5. **Open Source:** Free self-hosted, paid cloud SaaS later

**Remember:** The goal of MVP is to validate the core concept (JSON → Playwright execution) works reliably. Everything else is enhancement.

---

**Ready to start building? Let's do this! 🚀**
