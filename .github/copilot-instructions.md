# SaveAction Platform - Repository Instructions

## Project Overview

SaveAction is an open-source test automation platform that replays browser interactions recorded by a Chrome extension. The platform uses Playwright for reliable cross-browser test execution with intelligent element location and retry logic.

**Architecture**: Monorepo with pnpm workspaces and Turborepo  
**Primary Language**: TypeScript with ES modules  
**Current Phase**: Phase 3 Complete (API + Database + Worker)

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
│   │       └── commands/       # run, validate, info, list
│   └── api/                    # @saveaction/api - REST API + Worker
│       └── src/
│           ├── routes/         # Fastify route handlers
│           ├── services/       # Business logic layer
│           ├── repositories/   # Database access layer
│           ├── db/schema/      # Drizzle ORM table definitions
│           ├── queues/         # BullMQ job processors
│           ├── auth/           # JWT authentication
│           └── plugins/        # Fastify plugins
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
- **Total Tests**: 1,019+ (140 core + 90 CLI + 792 API)
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

### @saveaction/api (REST API + Worker)

**Purpose**: Enterprise API for managing recordings and runs

**Architecture**:
- **API Server**: Fastify HTTP server with JWT auth
- **Worker Process**: BullMQ job processor for test execution
- **Database**: PostgreSQL with Drizzle ORM (8 tables)
- **Cache/Queue**: Redis with BullMQ

**Database Tables**:
| Table | Purpose |
|-------|---------|
| `users` | User accounts |
| `api_tokens` | API authentication |
| `recordings` | Test recording storage |
| `runs` | Test execution history |
| `run_actions` | Per-action results |
| `schedules` | Cron-scheduled runs |
| `webhooks` | Event notifications |
| `webhook_deliveries` | Delivery log |

**API Routes**:
- `/api/v1/auth/*` - Authentication
- `/api/v1/tokens/*` - API tokens
- `/api/v1/recordings/*` - Recording CRUD
- `/api/v1/runs/*` - Test runs
- `/api/v1/schedules/*` - Scheduled tests
- `/api/health/*` - Health checks

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
| `types.instructions.md` | `packages/core/src/types/**/*.ts` |

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
- CLI with run, validate, info, list commands
- REST API with Fastify
- PostgreSQL + Drizzle ORM (8 tables)
- Redis + BullMQ job queues
- JWT + API token authentication
- Recording/Run/Schedule management
- Worker process for test execution
- 1,019+ unit tests
- Integration tests (API + browser)
- CI/CD pipeline

### Planned 📋
- Phase 4: Web UI (React/Next.js)
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
- **Worker is separate process** - scales independently from API
- **Soft delete by default** - recordings/runs use `deletedAt` column
