# Getting Started

> Complete guide to setting up SaveAction for development and understanding the project structure.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Project Overview](#project-overview)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Running the Packages](#running-the-packages)
- [Testing](#testing)
- [Common Tasks](#common-tasks)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | >= 18.0.0 | JavaScript runtime |
| **pnpm** | >= 8.0.0 | Package manager (workspace support) |
| **Docker** | Latest | PostgreSQL + Redis for development |
| **Git** | Latest | Version control |

Install pnpm if you don't have it:

```bash
corepack enable
corepack prepare pnpm@8.10.0 --activate
```

---

## Project Overview

SaveAction is a **no-code test automation platform** built as a monorepo with 4 packages:

| Package | Name | Description |
|---------|------|-------------|
| `packages/core` | `@saveaction/core` | Playwright execution engine — parses JSON recordings and replays them in real browsers |
| `packages/cli` | `@saveaction/cli` | Command-line tool — run tests locally or in CI/CD |
| `packages/api` | `@saveaction/api` | REST API + Worker — Fastify server, PostgreSQL database, Redis queues, BullMQ job processing |
| `packages/web` | `@saveaction/web` | Web dashboard — Next.js 15 app for managing projects, tests, runs, and schedules |

**How they connect:**
```
Browser Extension → records JSON → uploads to API
                                        ↓
CLI runs tests locally ←── or ──→ API queues test jobs → Worker runs Playwright
                                        ↓
                                   Web UI shows results (SSE real-time)
```

---

## Development Setup

### 1. Clone and install

```bash
git clone https://github.com/SaveActionHQ/SaveAction.git
cd SaveAction
pnpm install
```

### 2. Start database services

This starts PostgreSQL 16 and Redis 7 in Docker containers (for development only):

```bash
pnpm dev:services
```

This runs `docker-compose.dev.yml` which creates:
- **PostgreSQL** on `localhost:5432` (user: `saveaction`, password: `saveaction_dev`, db: `saveaction`)
- **Redis** on `localhost:6379` (no password)
- **pgAdmin** on `localhost:5050` (optional database browser)

### 3. Set up environment variables

```bash
cd packages/api
cp .env.example .env
```

The defaults work out of the box with the dev Docker services. Required variables for development:

```env
DATABASE_URL=postgresql://saveaction:saveaction_dev@localhost:5432/saveaction
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret-that-is-at-least-32-characters-long
JWT_REFRESH_SECRET=dev-refresh-secret-at-least-32-characters
```

### 4. Run database migrations

```bash
cd packages/api
pnpm db:migrate
```

### 5. Build all packages

```bash
# From the repo root
pnpm build
```

This uses Turborepo to build in dependency order: `core` → `cli` + `api` (parallel).

### 6. Start development

**API + Worker (with hot reload):**
```bash
cd packages/api
pnpm dev
```
This starts both the API server (port 3001) and the Worker process with file watching via `tsx`.

**Web UI (with hot reload):**
```bash
cd packages/web
pnpm dev
```
This starts the Next.js dev server on port 3000.

**Or start everything from root:**
```bash
pnpm dev    # Starts all packages in parallel via Turborepo
```

---

## Project Structure

```
SaveAction/
├── packages/
│   ├── core/                   # Playwright execution engine
│   │   └── src/
│   │       ├── types/          # TypeScript interfaces (Recording, Action, etc.)
│   │       ├── parser/         # JSON recording parser (Zod validation)
│   │       ├── runner/         # PlaywrightRunner + ElementLocator
│   │       ├── reporter/       # Console output formatting
│   │       └── analyzer/       # Recording metadata analysis
│   ├── cli/                    # Command-line tool
│   │   └── src/
│   │       ├── cli.ts          # Commander.js entry point
│   │       ├── commands/       # run, validate, info, list
│   │       ├── ci/             # CI environment detection
│   │       └── platform/       # API client for remote runs
│   ├── api/                    # REST API + Worker
│   │   └── src/
│   │       ├── app.ts          # Fastify app builder
│   │       ├── server.ts       # HTTP server entry point
│   │       ├── worker.ts       # BullMQ worker entry point
│   │       ├── routes/         # API route handlers
│   │       ├── services/       # Business logic (11 services)
│   │       ├── repositories/   # Database access (9 repositories)
│   │       ├── db/schema/      # Drizzle ORM table definitions (12 tables)
│   │       ├── queues/         # Job processors (test, scheduled, cleanup)
│   │       ├── auth/           # JWT + API token authentication
│   │       ├── plugins/        # Fastify plugins (helmet, rateLimit, csrf, swagger)
│   │       └── redis/          # Redis client + pub/sub
│   └── web/                    # Next.js web dashboard
│       └── src/
│           ├── app/            # App Router pages
│           ├── components/     # React components (shadcn/ui)
│           └── lib/            # API client, utilities
├── docker/                     # Docker configurations
│   ├── api/Dockerfile          # API + Worker production image
│   ├── web/Dockerfile          # Web UI production image
│   └── nginx/nginx.conf        # Reverse proxy config
├── docker-compose.dev.yml      # Dev services (PostgreSQL + Redis)
├── docker-compose.yml          # Production deployment (all services)
├── turbo.json                  # Turborepo build pipeline
└── pnpm-workspace.yaml         # pnpm workspace config
```

---

## Running the Packages

### Core (standalone)

The core package can be used independently to run recordings:

```bash
cd packages/core
pnpm build
pnpm test
```

### CLI

```bash
# Build first (TypeScript → JavaScript)
pnpm build

# Run a recorded test
node packages/cli/bin/saveaction.js run recording.json --headless false

# Validate a recording without executing
node packages/cli/bin/saveaction.js validate recording.json

# Show recording details
node packages/cli/bin/saveaction.js info recording.json

# List all recordings in a directory
node packages/cli/bin/saveaction.js list ./recordings
```

**CLI Options:**
| Option | Default | Description |
|--------|---------|-------------|
| `--headless` | `true` | Run browser in headless mode |
| `--browser` | `chromium` | Browser to use (`chromium`, `firefox`, `webkit`) |
| `--timeout` | `30000` | Action timeout in milliseconds |
| `--video` | - | Directory to save video recordings |
| `--timing-mode` | `realistic` | Timing mode (`realistic`, `fast`, `fixed`) |
| `--speed` | `1.0` | Speed multiplier |
| `--output` | `console` | Output format (`console`, `json`) |

### API

```bash
cd packages/api

# Start API server only
pnpm dev:api

# Start Worker only
pnpm dev:worker

# Start both (recommended)
pnpm dev
```

The API server runs on `http://localhost:3001`. Swagger UI is available at `http://localhost:3001/docs`.

### Web

```bash
cd packages/web
pnpm dev
```

The web dashboard runs on `http://localhost:3000`.

---

## Testing

```bash
# Run all tests (from root)
pnpm test

# Run tests for a specific package
cd packages/core && pnpm test
cd packages/cli && pnpm test
cd packages/api && pnpm test

# Watch mode
cd packages/api && pnpm test:watch

# Coverage
cd packages/api && pnpm test:coverage

# Integration tests (requires running DB services)
cd packages/api && pnpm test:integration
cd packages/core && pnpm test:integration
```

**Test counts:**
| Package | Tests | Files |
|---------|-------|-------|
| `@saveaction/core` | 163 | 5 |
| `@saveaction/cli` | 176 | 6 |
| `@saveaction/api` | 1,169 | 40 |
| **Total** | **1,505+** | **51** |

---

## Common Tasks

### Database operations

```bash
cd packages/api

pnpm db:generate    # Generate migration from schema changes
pnpm db:migrate     # Run pending migrations
pnpm db:studio      # Open Drizzle Studio (database browser)
```

### Linting

```bash
pnpm lint           # Check all packages
pnpm lint:fix       # Auto-fix issues
```

### Clean build

```bash
pnpm clean          # Remove dist/ and node_modules
pnpm install
pnpm build
```

---

## Troubleshooting

### "Cannot find module" errors at runtime

TypeScript imports must use `.js` extensions (ES module requirement):

```typescript
// ✅ Correct
import { something } from './module.js';

// ❌ Wrong — fails at runtime
import { something } from './module';
```

### Database connection refused

Make sure dev services are running:

```bash
pnpm dev:services
docker ps   # Should show postgres and redis containers
```

### Playwright browsers not found

```bash
npx playwright install          # Install all browsers
npx playwright install chromium # Install chromium only
```

### Port already in use

Default ports: API = 3001, Web = 3000, PostgreSQL = 5432, Redis = 6379.

```bash
# Check what's using a port (Windows)
netstat -ano | findstr :3001

# Check what's using a port (Linux/macOS)
lsof -i :3001
```

### pnpm install fails

Ensure you're using pnpm 8.x:

```bash
pnpm --version
corepack prepare pnpm@8.10.0 --activate
```
