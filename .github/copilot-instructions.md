# SaveAction Platform - Repository Instructions

## Project Overview

SaveAction is an open-source test automation platform that replays browser interactions recorded by a Chrome extension. The platform uses Playwright for reliable cross-browser test execution with intelligent element location and retry logic.

**Architecture**: Monorepo with pnpm workspaces and Turborepo  
**Primary Language**: TypeScript with ES modules  
**Current Phase**: Phase 4 In Progress (Web UI + Projects/Suites)

## Project Structure

```
SaveAction/
├── .github/
│   ├── workflows/
│   │   └── ci.yml              # GitHub Actions CI pipeline
│   ├── instructions/           # Context-specific Copilot instructions
│   │   ├── api.instructions.md
│   │   ├── cli.instructions.md
│   │   ├── es-modules.instructions.md
│   │   ├── playwright-runner.instructions.md
│   │   ├── testing.instructions.md
│   │   └── types.instructions.md
│   └── copilot-instructions.md # This file (global instructions)
├── .husky/                     # Git hooks
│   ├── pre-commit              # Runs lint-staged
│   ├── commit-msg              # Validates conventional commits
│   └── pre-push                # Runs build + tests
├── packages/
│   ├── core/                   # @saveaction/core - Playwright engine
│   │   └── src/
│   │       ├── types/          # TypeScript interfaces
│   │       ├── parser/         # JSON recording parser (Zod)
│   │       ├── runner/         # Playwright runner + element locator
│   │       ├── reporter/       # Console reporter
│   │       └── analyzer/       # Recording analyzer
│   ├── cli/                    # @saveaction/cli - Command line tool
│   │   └── src/
│   │       ├── commands/       # run, validate, info, list
│   │       ├── ci/             # CI environment detection
│   │       └── platform/       # Platform API client
│   ├── api/                    # @saveaction/api - REST API + Worker
│   │   └── src/
│   │       ├── routes/         # Fastify route handlers
│   │       ├── services/       # Business logic layer (11 services)
│   │       ├── repositories/   # Database access layer (9 repositories)
│   │       ├── db/schema/      # Drizzle ORM table definitions (12 tables)
│   │       ├── queues/         # BullMQ job processors (test, scheduled, cleanup)
│   │       ├── auth/           # JWT authentication
│   │       ├── redis/          # Redis client + pub/sub
│   │       └── plugins/        # Fastify plugins (helmet, rateLimit, csrf, swagger)
│   └── web/                    # @saveaction/web - Next.js Web UI
│       └── src/
│           ├── app/            # Next.js App Router pages
│           ├── components/     # React components (shadcn/ui)
│           └── lib/            # API client, utilities
├── docker/                     # Docker configurations
├── docs/                       # Technical documentation
├── eslint.config.js            # ESLint flat config
├── turbo.json                  # Turborepo build pipeline
├── pnpm-workspace.yaml         # pnpm workspace config
└── tsconfig.base.json          # Shared TypeScript config
```

## Core Technologies

| Category | Technology | Version |
|----------|-----------|---------|
| Runtime | Node.js (ES modules) | 18+ |
| Package Manager | pnpm (workspaces) | 8.x |
| Build System | Turborepo | 1.11.0 |
| Browser Automation | Playwright | 1.40.0 |
| Validation | Zod | 3.22.4 |
| Testing | Vitest | 1.0.4 |
| API Framework | Fastify | 4.x |
| Database | PostgreSQL + Drizzle ORM | 16 / 0.45.x |
| Queue | Redis + BullMQ | 7 / 5.x |
| CLI Framework | Commander.js | 11.1.0 |
| Web Framework | Next.js (App Router) | 15.x |
| UI Components | shadcn/ui + Tailwind CSS | - |
| TypeScript | - | 5.3.3 |

## Development Guidelines

### CRITICAL: ES Module Imports

**Always use `.js` extensions in TypeScript import paths:**

```typescript
// ✅ Correct
import { RecordingParser } from './parser/RecordingParser.js';
import type { Recording } from '../types/index.js';

// ❌ Wrong - will fail at runtime
import { RecordingParser } from './parser/RecordingParser';
```

### TypeScript Configuration

- **Strict Mode**: All code must pass TypeScript strict checks
- **No Implicit Any**: Every variable must have explicit or inferred type
- **Strict Null Checks**: Handle null/undefined explicitly
- **Type-Only Imports**: Use `import type` for type-only imports

### Code Organization

1. **Types First**: Define interfaces before implementation
2. **Single Responsibility**: Each class/module has one clear purpose
3. **Dependency Injection**: Use constructor injection for testability
4. **Service-Repository Pattern**: (API) Routes → Services → Repositories → Database

### Testing Standards

- **Framework**: Vitest with v8 coverage
- **Total Tests**: 1,505+ (163 core + 176 CLI + 1,169 API)
- **Total Test Files**: 51 (5 core + 6 CLI + 40 API)
- **Coverage Target**: 90%+ for critical components
- **Test Files**: Place `.test.ts` next to source files
- **Integration Tests**: `tests/integration/*.integration.ts`

### Build and Run Commands

```bash
# Install dependencies
pnpm install

# Start database services (PostgreSQL + Redis)
pnpm dev:services

# Build all packages
pnpm build

# Run all tests
pnpm test

# Run specific package tests
cd packages/api && pnpm test
cd packages/core && pnpm test:integration

# Run linting
pnpm lint

# Start API development
cd packages/api && pnpm dev

# Run CLI
node packages/cli/bin/saveaction.js run <recording.json> [options]
```

## Package Overview

### @saveaction/core (Playwright Engine)

**Purpose**: Parse and execute browser recordings

| Component | File | Purpose |
|-----------|------|---------|
| Parser | `RecordingParser.ts` | Parse JSON with Zod validation |
| Runner | `PlaywrightRunner.ts` | Execute actions with Playwright |
| Locator | `ElementLocator.ts` | Multi-strategy element finding |
| Reporter | `ConsoleReporter.ts` | Pretty CLI output |

**Key Features**:
- Selector priority: id → dataTestId → ariaLabel → name → css → xpath
- Exponential backoff retry (500ms → 1000ms → 2000ms)
- 300ms animation delays after clicks/inputs
- URL change detection for navigation handling

### @saveaction/cli (Command Line)

**Purpose**: Run tests from command line

| Command | Description |
|---------|-------------|
| `run <file>` | Execute a recording |
| `validate <file>` | Validate without execution |
| `info <file>` | Show recording details |
| `list [dir]` | List recordings |

**Options**: `--headless`, `--browser`, `--timeout`, `--video`, `--timing-mode`

**Additional Modules**:
- `CIDetector` - Detects CI environments (GitHub Actions, GitLab CI, etc.)
- `PlatformClient` - HTTP client for SaveAction API integration

### @saveaction/web (Web UI)

**Purpose**: Web dashboard for managing projects, tests, and runs

**Technology**: Next.js 15 (App Router) + Tailwind CSS + shadcn/ui

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

**Route Groups**: `(auth)` for login/register, `(global)` for project list, `(project)` for project-scoped pages

### @saveaction/api (REST API + Worker)

**Purpose**: Enterprise API for managing recordings and runs

**Architecture**:
- **API Server**: Fastify HTTP server with JWT auth + Helmet + Rate Limiting + CSRF + Swagger
- **Worker Process**: BullMQ job processor with 3 workers (test runs, scheduled tests, cleanup)
- **Database**: PostgreSQL with Drizzle ORM (12 tables)
- **Cache/Queue**: Redis with BullMQ
- **Real-Time**: SSE via Redis pub/sub for live run progress

**Database Tables (12)**:
| Table | Purpose |
|-------|---------|
| `users` | User accounts |
| `projects` | Project organization (default: "My Tests") |
| `api_tokens` | API authentication |
| `recordings` | Recording library storage |
| `test_suites` | Test suite grouping within projects |
| `tests` | Individual test definitions with config (multi-browser, headless, timeout) |
| `runs` | Test execution history (types: test, suite, project, recording) |
| `run_actions` | Per-action results (incrementally persisted during execution) |
| `run_browser_results` | Per-browser results for multi-browser runs |
| `schedules` | Cron-scheduled runs (targets: test, suite, project) |
| `webhooks` | Event notifications |
| `webhook_deliveries` | Delivery log |

**API Routes**:
- `/api/v1/auth/*` - Authentication (register, login, refresh, password reset)
- `/api/v1/tokens/*` - API tokens
- `/api/v1/projects/*` - Project CRUD
- `/api/v1/projects/:projectId/suites/*` - Suite management (nested under projects)
- `/api/v1/projects/:projectId/tests/*` - Test management (nested under projects)
- `/api/v1/recordings/*` - Recording library
- `/api/v1/runs/*` - Test runs + SSE progress stream (`GET /runs/:id/progress/stream`)
- `/api/v1/schedules/*` - Scheduled tests
- `/api/v1/dashboard/*` - Aggregated statistics
- `/api/health/*` - Health checks (basic, detailed, live, ready)

## Recording Format

```typescript
interface Recording {
  id: string;           // rec_<timestamp>
  testName: string;     // User-provided name
  url: string;          // Starting URL
  startTime: string;    // ISO 8601
  viewport: { width: number; height: number };
  userAgent: string;
  actions: Action[];    // Recorded actions
  version: string;      // Schema version
}

interface Action {
  id: string;           // act_001, act_002, etc.
  type: 'click' | 'input' | 'scroll' | 'navigation' | 'select' | 'keypress' | 'submit' | 'hover';
  timestamp: number;
  url: string;
  selector: SelectorStrategy;
  // ... type-specific fields
}
```

## Common Patterns

### Adding New Action Types (Core)

1. Define interface in `packages/core/src/types/actions.ts`
2. Add type guard function (e.g., `isNewAction()`)
3. Update `Action` union type
4. Implement executor in `PlaywrightRunner.executeAction()`
5. Add tests

### Adding New API Endpoints

1. Create route in `packages/api/src/routes/`
2. Create service in `packages/api/src/services/`
3. Create repository if new table needed
4. Add Zod schemas for validation
5. Register route in `app.ts`
6. Add unit + integration tests

### Adding CLI Commands

1. Create file in `packages/cli/src/commands/`
2. Export async function `(params, options)`
3. Register in `cli.ts` with Commander.js
4. Add tests

## Git Workflow

### Commit Message Format

```
<type>(<scope>): <subject>
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

**Examples**:
```bash
feat(api): add recording search endpoint
fix(core): handle navigation timeout
test(cli): add validate command tests
```

### Git Hooks (Husky)

| Hook | Action |
|------|--------|
| `pre-commit` | lint-staged (ESLint + Prettier) |
| `commit-msg` | Conventional commit validation |
| `pre-push` | Build + test |

### CI Pipeline (GitHub Actions)

| Job | Description |
|-----|-------------|
| `lint` | ESLint with 0 warnings |
| `typecheck` | TypeScript build |
| `test` | All unit tests |
| `test-integration` | Browser integration tests |
| `test-coverage` | Coverage reports (main only) |

## Context-Specific Instructions

The `.github/instructions/` folder contains context-specific rules that are automatically applied based on file paths:

| File | Applies To |
|------|-----------|
| `api.instructions.md` | `packages/api/**/*.ts` |
| `cli.instructions.md` | `packages/cli/**/*.ts` |
| `es-modules.instructions.md` | `packages/**/*.ts` |
| `playwright-runner.instructions.md` | `packages/core/src/runner/**/*.ts` |
| `testing.instructions.md` | `**/*.test.ts`, `tests/**/*.ts` |
| `types.instructions.md` | `packages/core/src/types/**/*.ts` || `web-ui.instructions.md` | `packages/web/**/*.ts`, `packages/web/**/*.tsx` |
## Known Issues and Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Element not found | Selector specificity | Check priority order, add fallbacks |
| Navigation timeout | Page navigating during action | URL change detection |
| Animation blocking | JS animations not complete | 300ms delay after actions |
| ES module error | Missing `.js` extension | Always add `.js` to imports |
| Strict mode error | Multiple elements matched | More specific selector |

## Project Status

### Completed ✅
- Core Playwright runner with all action types
- Multi-strategy element locator with retry
- CLI with run, validate, info, list commands + CI detection + platform client
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
- Integration tests (API + browser)
- CI/CD pipeline

### In Progress 🚧
- Web UI refinements and additional pages
- API integration tests in CI (PostgreSQL + Redis services)

### Planned 📋
- Webhook notifications
- Run comparison/history
- Team/organization support

## Resources

- **Playwright**: https://playwright.dev/
- **Fastify**: https://fastify.dev/
- **Drizzle ORM**: https://orm.drizzle.team/
- **BullMQ**: https://docs.bullmq.io/
- **Zod**: https://zod.dev/

## Important Notes

- **Never remove `.js` extensions** from imports (ES module requirement)
- **Keep 300ms delays** for animation stability in runner
- **Use `beforeEach` for test data** - `afterEach` truncates tables (API)
- **Run build before CLI** - TypeScript must compile first
- **Worker is separate process** - scales independently from API (3 concurrent jobs default)
- **Soft delete by default** - recordings/runs use `deletedAt` column
- **Actions persist incrementally** - saved to DB as each action completes, not batched at end
- **SSE has no replay** - Redis pub/sub; frontend merges DB data with SSE on reconnect
- **Parent run tracking** - suite runs create child test runs with `parentRunId`
- **Multi-browser runs** - tests can configure multiple browsers; results stored in `run_browser_results`
