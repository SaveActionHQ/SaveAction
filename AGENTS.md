# SaveAction AI Agent Instructions

> **Last Updated:** February 2026  
> **Total Tests:** 1,505+ (163 core + 176 CLI + 1,169 API)  
> **Total Test Files:** 51 (5 core + 6 CLI + 40 API)  
> **Test Coverage Target:** 90%+ for critical components

## What This Project Does

SaveAction is an **open-source test automation platform** that:

1. **Records** browser interactions via Chrome extension (produces JSON files)
2. **Replays** those recordings using Playwright for cross-browser testing
3. **Provides REST API** for managing recordings, executing tests, and scheduling runs
4. **Offers CLI tool** for running tests from command line

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SaveAction Platform                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────────────┐ │
│  │ @saveaction/ │   │ @saveaction/ │   │     @saveaction/api          │ │
│  │    core      │   │     cli      │   │                              │ │
│  │              │   │              │   │  ┌────────┐  ┌────────────┐  │ │
│  │ Playwright   │◀──│  Commander   │   │  │ Fastify│  │   Worker   │  │ │
│  │ Runner       │   │  CLI Tool    │   │  │ Server │  │ (BullMQ)   │  │ │
│  │              │   │              │   │  └────┬───┘  └─────┬──────┘  │ │
│  │ - Parser     │   │  Commands:   │   │       │            │         │ │
│  │ - Locator    │   │  - run       │   │       ▼            ▼         │ │
│  │ - Reporter   │   │  - validate  │   │  ┌────────────────────────┐  │ │
│  │              │   │  - info      │   │  │     PostgreSQL         │  │ │
│  └──────────────┘   │  - list      │   │  │  + Redis + BullMQ      │  │ │
│                     └──────────────┘   │  └────────────────────────┘  │ │
│                                        └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### Monorepo Structure (pnpm + Turborepo)

```
SaveAction/
├── packages/
│   ├── core/           # @saveaction/core - Playwright execution engine
│   ├── cli/            # @saveaction/cli - Command-line interface
│   ├── api/            # @saveaction/api - REST API + Worker
│   └── web/            # @saveaction/web - Next.js Web UI
├── docs/               # Technical documentation
├── docker/             # Docker configurations
├── .github/
│   ├── workflows/      # CI/CD pipelines
│   └── instructions/   # Copilot context files
├── turbo.json          # Turborepo build pipeline
├── pnpm-workspace.yaml # Workspace configuration
└── tsconfig.base.json  # Shared TypeScript config
```

## Package Details

### 1. @saveaction/core (Playwright Engine)

**Purpose:** Parse recordings and execute them with Playwright

**Key Components:**
| File | Purpose |
|------|---------|
| `src/parser/RecordingParser.ts` | Parse JSON recordings with Zod validation |
| `src/runner/PlaywrightRunner.ts` | Main execution engine (~2400 lines) |
| `src/runner/ElementLocator.ts` | Multi-strategy element location with retry |
| `src/runner/NavigationHistoryManager.ts` | Track URL changes during execution |
| `src/runner/NavigationAnalyzer.ts` | Preprocess recordings for issues |
| `src/reporter/ConsoleReporter.ts` | Pretty CLI output with emojis |
| `src/analyzer/RecordingAnalyzer.ts` | Analyze recording metadata |
| `src/types/` | TypeScript interfaces for all data types |

**Key Classes:**
```typescript
// Execute a recording
const runner = new PlaywrightRunner(options, reporter);
const result = await runner.execute(recording);

// Parse a recording file
const parser = new RecordingParser();
const recording = await parser.parseFile('test.json');
```

### 2. @saveaction/cli (Command-Line Tool)

**Purpose:** CLI for running tests locally

**Commands:**
| Command | Description |
|---------|-------------|
| `saveaction run <file>` | Execute a recording |
| `saveaction validate <file>` | Validate recording without execution |
| `saveaction info <file>` | Show recording details |
| `saveaction list [dir]` | List recordings in directory |

**Key Options:**
```bash
saveaction run test.json \
  --headless false \
  --browser chromium \
  --timeout 30000 \
  --video ./videos \
  --timing-mode realistic \
  --speed 1.0 \
  --output json \
  --output-file results.json
```

**Additional Modules:**
- `CIDetector` (`src/ci/CIDetector.ts`) - Detects CI environments (GitHub Actions, GitLab CI, Jenkins, etc.)
- `PlatformClient` (`src/platform/PlatformClient.ts`) - HTTP client for SaveAction API integration

### 3. @saveaction/web (Next.js Web UI)

**Purpose:** Web dashboard for managing projects, tests, and runs

**Technology:** Next.js 15 (App Router) + Tailwind CSS + shadcn/ui

**Key Features:**
| Feature | Description |
|---------|-------------|
| Projects | Create/manage test projects |
| Test Suites | Group tests into suites |
| Tests | Configure tests with multi-browser, headless, timeout |
| Runs | View live run progress with SSE streaming |
| Recording Library | Upload and manage recordings |
| Schedules | Configure cron-scheduled test runs |
| Dashboard | Aggregated statistics per project |
| Settings | Profile, security, API tokens |

**Route Groups:**
- `(auth)` - Login/register pages
- `(global)` - Project list, global settings
- `(project)` - Project-scoped pages (dashboard, suites, tests, runs, schedules, library, settings)

### 4. @saveaction/api (REST API + Worker)

**Purpose:** Enterprise API for managing recordings and runs

**Architecture:**
- **API Server** (`server.ts`): Fastify HTTP server with JWT auth + Helmet + Rate Limiting + CSRF + Swagger
- **Worker Process** (`worker.ts`): BullMQ job processor with 3 workers (test runs, scheduled tests, cleanup)
- **Database**: PostgreSQL with Drizzle ORM (12 tables)
- **Cache/Queue**: Redis with BullMQ
- **Real-Time**: SSE via Redis pub/sub for live run progress

**Database Schema (12 tables):**
| Table | Purpose |
|-------|---------|
| `users` | User accounts |
| `projects` | Project organization (default: "My Tests") |
| `api_tokens` | API authentication tokens |
| `recordings` | Recording library storage |
| `test_suites` | Test suite grouping within projects |
| `tests` | Individual test definitions with config (multi-browser, headless, timeout) |
| `runs` | Test execution history (types: test, suite, project, recording) |
| `run_actions` | Per-action results (incrementally persisted during execution) |
| `run_browser_results` | Per-browser results for multi-browser runs |
| `schedules` | Cron-scheduled runs (targets: test, suite, project) |
| `webhooks` | Event notification config |
| `webhook_deliveries` | Webhook delivery log |

**API Routes:**
| Route | Purpose |
|-------|---------|
| `/api/v1/auth/*` | Authentication (register, login, refresh, password reset) |
| `/api/v1/tokens/*` | API token management |
| `/api/v1/projects/*` | Project CRUD (max 100/user) |
| `/api/v1/projects/:projectId/suites/*` | Suite management (nested under projects) |
| `/api/v1/projects/:projectId/tests/*` | Test management (nested under projects) |
| `/api/v1/recordings/*` | Recording library |
| `/api/v1/runs/*` | Test run management + SSE progress stream |
| `/api/v1/schedules/*` | Scheduled test configuration |
| `/api/v1/dashboard/*` | Aggregated statistics |
| `/api/health/*` | Health checks (basic, detailed, live, ready) |
| `/api/queues/*` | Queue status |

**Service Layer Pattern:**
```
Routes → Services → Repositories → Database
           ↓
       Validation (Zod)
           ↓
       Error Handling (ApiError)
```

## Critical Rules

### 1. ES Module Imports (MOST IMPORTANT)

**Always use `.js` extensions in TypeScript imports:**

```typescript
// ✅ Correct
import { RecordingParser } from './parser/RecordingParser.js';
import type { Recording } from '../types/index.js';

// ❌ Wrong - will fail at runtime
import { RecordingParser } from './parser/RecordingParser';
```

### 2. Testing Patterns

**Framework:** Vitest with `describe`/`it` structure

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ServiceName', () => {
  describe('methodName', () => {
    it('should handle normal case', () => {
      // Arrange → Act → Assert
    });
  });
});
```

**Test File Location:**
- Unit tests: `ComponentName.test.ts` next to source file
- Integration tests: `tests/integration/*.integration.ts`

**Coverage Targets:**
- Critical components (parser, reporter): 100%
- Core logic (locator, services): 90%+
- Runner behavior tests: 25%+

### 3. API Error Handling

```typescript
// Define errors in service
export const RecordingErrors = {
  NOT_FOUND: new RecordingError('Recording not found', 'RECORDING_NOT_FOUND', 404),
  NOT_AUTHORIZED: new RecordingError('Not authorized', 'NOT_AUTHORIZED', 403),
};

// Throw in service
if (!recording) throw RecordingErrors.NOT_FOUND;

// Caught by global error handler → standardized JSON response
```

### 4. Database Operations

**Use Drizzle ORM with repositories:**

```typescript
// Repository pattern
const recording = await recordingRepository.findById(userId, id);
const recordings = await recordingRepository.list(userId, filters, pagination);
await recordingRepository.create(data);
await recordingRepository.update(userId, id, data);
await recordingRepository.softDelete(userId, id);
```

### 5. Element Location Strategy

**Priority order:** id → dataTestId → ariaLabel → name → css → xpath → position

**Retry logic:** Exponential backoff (500ms → 1000ms → 2000ms)

```typescript
const element = await elementLocator.findElement(page, selector);
// Automatically tries all strategies with retry
```

### 6. Navigation & Animation Handling

```typescript
// Always add delay after clicks/inputs for animations
await element.click();
await page.waitForTimeout(300);

// Detect URL changes (navigation)
if (page.url() !== action.url) {
  // Page navigated, handle accordingly
}
```

## Development Workflow

### Setup

```bash
# 1. Start database services
pnpm dev:services  # Starts PostgreSQL + Redis via Docker

# 2. Install dependencies
pnpm install

# 3. Build all packages
pnpm build

# 4. Start development
cd packages/api && pnpm dev  # API + Worker with hot reload
```

### Common Commands

```bash
# Build
pnpm build              # Build all packages (Turborepo cached)

# Test
pnpm test               # Run all unit tests
cd packages/api && pnpm test:integration  # API integration tests
cd packages/core && pnpm test:integration # Core browser integration tests

# Lint
pnpm lint               # ESLint all packages
pnpm lint:fix           # Auto-fix issues

# Database
cd packages/api
pnpm db:generate        # Generate migrations from schema changes
pnpm db:migrate         # Run migrations
pnpm db:studio          # Open Drizzle Studio (DB browser)

# Run CLI
node packages/cli/bin/saveaction.js run test.json --headless false
```

### Environment Variables

Create `packages/api/.env` from `.env.example`:

```bash
# Required
DATABASE_URL=postgresql://saveaction:saveaction_dev@localhost:5432/saveaction
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

# Optional
NODE_ENV=development
API_PORT=3001
LOG_LEVEL=info
```

## How to Work With This Codebase

### Adding New Action Types (Core)

1. Define interface in `packages/core/src/types/actions.ts`
2. Add type guard function (e.g., `isNewAction()`)
3. Update `Action` union type
4. Implement executor in `PlaywrightRunner.executeAction()`
5. Add tests in `PlaywrightRunner.test.ts`

### Adding New API Endpoints

1. Create route file in `packages/api/src/routes/`
2. Create service in `packages/api/src/services/`
3. Create repository if new table needed
4. Add Zod schemas for validation
5. Register route in `app.ts`
6. Add unit tests (`*.test.ts`)
7. Add integration tests (`tests/integration/*.integration.ts`)

### Adding CLI Commands

1. Create file in `packages/cli/src/commands/`
2. Export async function accepting `(params, options)`
3. Register in `cli.ts` using Commander.js
4. Parse boolean/number options correctly
5. Add tests

### Modifying Database Schema

1. Edit schema in `packages/api/src/db/schema/`
2. Run `pnpm db:generate` to create migration
3. Run `pnpm db:migrate` to apply
4. Update repository if needed
5. Update service and routes

## Testing Guide

### Unit Tests

```typescript
// Mock dependencies
vi.mock('./SomeService.js', () => ({
  SomeService: vi.fn().mockImplementation(() => ({
    method: vi.fn().mockResolvedValue(result),
  })),
}));

// Mock database
const mockDb = {
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([mockData]),
    }),
  }),
};

// Mock Fastify app
const app = Fastify();
app.decorate('jwt', {});
app.decorateRequest('jwtVerify', async function () {
  (this as any).user = { sub: 'user-123' };
});
```

### Integration Tests (API)

```typescript
import { createTestApp, createUser, createRecording } from './helpers/index.js';

describe('Feature Integration', () => {
  let testApp: TestApp;
  
  beforeAll(async () => {
    testApp = await createTestApp();
  });
  
  afterAll(async () => {
    await testApp.close();
  });
  
  beforeEach(async () => {
    // Create fresh user per test (tables truncated after each test)
    const user = await createUser({ email: 'test@example.com' });
    // Get token, make requests...
  });
});
```

### Integration Tests (Core - Browser)

```typescript
// Uses real Playwright browser
import { PlaywrightRunner } from '../PlaywrightRunner.js';

describe('Browser Integration', () => {
  it('should click button', async () => {
    const recording = createTestRecording([clickAction]);
    const runner = new PlaywrightRunner({ headless: true });
    const result = await runner.execute(recording);
    expect(result.status).toBe('success');
  });
});
```

## CI/CD Pipeline

**GitHub Actions workflow (`.github/workflows/ci.yml`):**

| Job | Description |
|-----|-------------|
| `lint` | ESLint with 0 warnings tolerance |
| `typecheck` | TypeScript build (strict mode) |
| `test` | Unit tests for all packages |
| `test-integration` | Core browser integration tests |
| `test-coverage` | Coverage reports (main branch only) |

**Git Hooks (Husky):**

| Hook | Action |
|------|--------|
| `pre-commit` | lint-staged (ESLint + Prettier) |
| `commit-msg` | Conventional commit format validation |
| `pre-push` | Build + test (blocks broken code) |

**Commit Message Format:**
```
<type>(<scope>): <subject>

# Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
# Examples:
feat(api): add recording search endpoint
fix(core): handle navigation timeout
test(cli): add validate command tests
```

## Project Status

### Completed ✅

- Core Playwright runner with all action types
- Multi-strategy element locator with retry
- CLI with run, validate, info, list commands + CI detection + platform client
- JSON output support
- REST API with Fastify + Helmet + Rate Limiting + CSRF + Swagger
- PostgreSQL + Drizzle ORM (12 tables)
- Redis + BullMQ job queues (3 workers: test runs, scheduled tests, cleanup)
- JWT + API token authentication + account lockout + password reset (email)
- Project/Suite/Test management with multi-browser support
- Recording library (upload, manage, link to tests)
- Run management with parent/child runs (suite → test runs)
- SSE real-time progress streaming via Redis pub/sub
- Incremental action persistence (actions saved to DB as they execute, not batched)
- Schedule management (targets: test, suite, project)
- Dashboard with aggregated statistics
- Worker process for test execution (configurable concurrency)
- Web UI with Next.js 15 (App Router) + Tailwind CSS + shadcn/ui
- 1,505+ unit tests across 51 test files
- Integration tests (API + Core browser)
- CI/CD pipeline

### In Progress 🚧

- Web UI refinements and additional pages
- API integration tests in CI (PostgreSQL + Redis services)

### Planned 📋

- Webhook notifications
- Run comparison/history
- Team/organization support

## File Organization Reference

```
packages/
├── core/
│   └── src/
│       ├── types/           # TypeScript interfaces
│       │   ├── actions.ts   # Action types (click, input, etc.)
│       │   ├── selectors.ts # Selector strategies
│       │   ├── recording.ts # Recording format
│       │   └── runner.ts    # Runner options/results
│       ├── parser/          # JSON parsing + validation
│       ├── runner/          # Playwright execution
│       ├── reporter/        # Output formatting
│       └── analyzer/        # Recording analysis
├── cli/
│   └── src/
│       ├── cli.ts           # Commander.js setup
│       ├── ci/              # CI environment detection
│       ├── platform/        # Platform API client
│       └── commands/        # Command implementations
├── api/
│   └── src/
│       ├── app.ts           # Fastify app builder
│       ├── server.ts        # HTTP server entry
│       ├── worker.ts        # BullMQ worker entry (3 workers, concurrency=3)
│       ├── config/          # Environment config
│       ├── db/
│       │   ├── schema/      # Drizzle table definitions (12 tables)
│       │   └── index.ts     # Database connection
│       ├── auth/            # Authentication service
│       ├── routes/          # API route handlers
│       ├── services/        # Business logic (11 services)
│       ├── repositories/    # Database access (9 repositories)
│       ├── queues/          # Job processors (test, scheduled, cleanup)
│       ├── plugins/         # Fastify plugins (helmet, rateLimit, csrf, swagger)
│       ├── redis/           # Redis client + pub/sub
│       └── errors/          # Error classes
└── web/
    └── src/
        ├── app/             # Next.js App Router
        │   ├── (auth)/      # Login, register pages
        │   ├── (global)/    # Project list, global settings
        │   └── (project)/   # Project-scoped pages
        ├── components/      # React components (shadcn/ui)
        │   ├── ui/          # Base UI components
        │   ├── layout/      # Sidebar, header, navigation
        │   ├── projects/    # Project switcher
        │   ├── suites/      # Suite cards, dialogs
        │   ├── tests/       # Test config forms
        │   ├── runs/        # Run detail, actions table, SSE
        │   ├── schedules/   # Schedule management
        │   ├── settings/    # Profile, security, tokens
        │   └── shared/      # Data tables, pagination, empty states
        ├── lib/             # API client, utilities
        └── providers/       # Auth, theme, toast providers
```

## Important Notes

1. **Never remove `.js` extensions** - breaks ES module resolution
2. **Keep 300ms delays** - required for animation stability in runner
3. **Use `beforeEach` for test data** - `afterEach` truncates tables
4. **Run build before CLI** - TypeScript must compile first
5. **Worker is separate process** - scales independently from API (3 concurrent jobs default)
6. **Soft delete by default** - recordings/runs use `deletedAt` column
7. **Actions persist incrementally** - saved to DB as each action completes, not batched at end
8. **SSE has no replay** - Redis pub/sub; frontend merges DB data with SSE on reconnect
9. **Parent run tracking** - suite runs create child test runs with `parentRunId`
10. **Multi-browser runs** - tests can configure multiple browsers; results stored in `run_browser_results`

## Copilot Instruction Files

The `.github/instructions/` folder contains context-specific guidelines that are automatically applied based on file paths:

| File | Applies To | Purpose |
|------|-----------|---------|
| `api.instructions.md` | `packages/api/**/*.ts` | API architecture, service-repository pattern |
| `cli.instructions.md` | `packages/cli/**/*.ts` | Commander.js patterns, option parsing |
| `es-modules.instructions.md` | `packages/**/*.ts` | ES module import rules (`.js` extensions) |
| `playwright-runner.instructions.md` | `packages/core/src/runner/**/*.ts` | Element location, retry logic, navigation |
| `testing.instructions.md` | `**/*.test.ts`, `tests/**/*.ts` | Vitest patterns, mocking, integration tests |
| `types.instructions.md` | `packages/core/src/types/**/*.ts` | Type definition conventions || `web-ui.instructions.md` | `packages/web/**/*.ts`, `packages/web/**/*.tsx` | Web UI design system, component guidelines |
These files help AI agents understand package-specific patterns and conventions.

## Getting Help

- **Playwright docs:** https://playwright.dev/
- **Fastify docs:** https://fastify.dev/
- **Drizzle docs:** https://orm.drizzle.team/
- **BullMQ docs:** https://docs.bullmq.io/
- **Zod docs:** https://zod.dev/

## Quick Reference: Test Recordings

Test recordings are JSON files with this structure:

```typescript
interface Recording {
  id: string;           // "rec_<timestamp>"
  testName: string;     // User-provided name
  url: string;          // Starting URL
  startTime: string;    // ISO 8601
  viewport: { width: number; height: number };
  userAgent: string;
  actions: Action[];    // Array of recorded actions
  version: string;      // Schema version
}

interface Action {
  id: string;           // "act_001", "act_002", etc.
  type: 'click' | 'input' | 'scroll' | 'navigation' | 'select' | 'keypress' | 'submit' | 'hover';
  timestamp: number;    // Unix timestamp
  url: string;          // Current page URL
  selector: SelectorStrategy;  // Multi-strategy selector
  // ... type-specific fields
}
```

**Example Run:**
```bash
node packages/cli/bin/saveaction.js run test.json --headless false --browser chromium
```
