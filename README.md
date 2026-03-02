<div align="center">
  <img src="SaveActionLogo.png" alt="SaveAction Logo" width="200"/>
  
  # SaveAction Platform
  
  ### 🎬 No-Code QA Test Automation Platform
  
  Automate your testing workflow without writing a single line of code. Record user interactions with our browser extension, then replay them with pixel-perfect precision for cross-browser validation.
  
  [![License: BSL 1.1](https://img.shields.io/badge/License-BSL%201.1-blue.svg)](LICENSE)
  [![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.3.3-blue)](https://www.typescriptlang.org/)
  
</div>

---

## ⚠️ **PROJECT STATUS: IN ACTIVE DEVELOPMENT**

> **🚧 NOT READY FOR PRODUCTION USE 🚧**
>
> This project is currently under active development. APIs and interfaces may change.
>
> **Please wait for the official v1.0.0 release before using in production environments.**
>
> ⭐ **Star this repo** to stay updated on releases!

---

## ✨ Features

- 🎯 **Zero Code Testing** — No programming knowledge required. Record browser interactions and replay them automatically
- 🎭 **Pixel-Perfect Replay** — Matches exact window size, viewport, and device pixel ratio
- ⚡ **Smart Element Location** — 10+ selector strategies with exponential backoff retry and content signature fallback
- 🌐 **Cross-Browser Testing** — Run tests on Chromium, Firefox, and WebKit simultaneously
- 🖥️ **Web Dashboard** — Full-featured Next.js UI for managing projects, tests, runs, and schedules
- 🔌 **REST API** — Fastify API with JWT auth, API tokens, Swagger docs, and real-time SSE streaming
- ⏰ **Scheduled Runs** — Cron-based scheduling for automated regression testing
- 🎬 **Video & Screenshots** — Record test execution videos and capture screenshots on failure
- 🛠️ **CLI Tool** — Run tests from the command line with CI/CD platform integration
- 🐳 **Docker Ready** — Production Docker Compose with Nginx, PostgreSQL, Redis, and scalable workers
- 🌊 **Human-Like Execution** — Replicates exact scroll speed, typing delays, and hover duration
- 🔄 **Intelligent Navigation** — Auto-correction and optimized back/forward navigation
- 🔒 **Enterprise Security** — Helmet, CSRF protection, rate limiting, account lockout
- 🧪 **1,500+ Unit Tests** — Comprehensive test coverage across all packages

## 🎥 Browser Extension (Recorder)

The SaveAction recorder is a browser extension that captures your interactions and exports them as JSON recordings.

👉 **[SaveAction Recorder Browser Extension](https://github.com/SaveActionHQ/SaveAction-recorder-browser-extenstion)**

Install the extension, record your test flow, export the JSON, and upload it to the SaveAction platform.

## 📦 Architecture

```
SaveAction/
├── packages/
│   ├── core/           # @saveaction/core - Playwright execution engine
│   │   ├── parser/     # JSON recording parser + Zod validation
│   │   ├── runner/     # Test runner + element locator (2,400+ lines)
│   │   ├── reporter/   # Console reporter
│   │   ├── analyzer/   # Recording analyzer
│   │   └── types/      # TypeScript interfaces (10 action types)
│   ├── cli/            # @saveaction/cli - Command-line tool
│   │   ├── commands/   # run, validate, info, list
│   │   ├── ci/         # CI environment detection
│   │   └── platform/   # Platform API client
│   ├── api/            # @saveaction/api - REST API + Worker
│   │   ├── routes/     # 9 route files (auth, projects, suites, tests, runs, etc.)
│   │   ├── services/   # 11 business logic services
│   │   ├── repositories/ # 9 database repositories
│   │   ├── db/schema/  # 12 Drizzle ORM tables
│   │   ├── queues/     # BullMQ job processors (test runs, scheduled, cleanup)
│   │   ├── auth/       # JWT + API token authentication
│   │   ├── redis/      # Redis client + pub/sub (SSE)
│   │   └── plugins/    # Helmet, rate limiting, CSRF, Swagger
│   └── web/            # @saveaction/web - Next.js Web UI
│       ├── app/        # App Router pages (auth, projects, suites, tests, runs, schedules)
│       ├── components/ # 43+ React components (shadcn/ui)
│       └── lib/        # Type-safe API client (1,400+ lines)
├── docker/             # Docker configurations (API, Web, Nginx)
└── docs/               # Technical documentation
```

## 🚀 Quick Start

### Option 1: Docker (Recommended)

The fastest way to get the full platform running:

```bash
# 1. Clone the repository
git clone https://github.com/SaveActionHQ/SaveAction.git
cd SaveAction

# 2. Create environment file
cp .env.production.example .env
# Edit .env with your values (DB_PASSWORD, JWT_SECRET, etc.)

# 3. Build and start all services
docker compose -f docker-compose.yml --env-file .env up --build -d

# 4. Open the dashboard
# http://localhost (or your configured PORT)
```

This starts 6 services:
| Service | Purpose |
|---------|---------|
| **postgres** | PostgreSQL 16 database |
| **redis** | Redis 7 cache + job queue |
| **api** | Fastify REST API server |
| **worker** | BullMQ job processor (Playwright test executor) |
| **web** | Next.js web dashboard |
| **nginx** | Reverse proxy (port 80) |

Scale workers for more parallel test execution:

```bash
docker compose -f docker-compose.yml up -d --scale worker=4
```

### Option 2: Local Development

```bash
# 1. Clone and install
git clone https://github.com/SaveActionHQ/SaveAction.git
cd SaveAction
pnpm install

# 2. Start database services (PostgreSQL + Redis)
pnpm dev:services

# 3. Set up environment
cp packages/api/.env.example packages/api/.env
# Edit packages/api/.env with your database credentials

# 4. Build all packages
pnpm build

# 5. Run database migrations
cd packages/api && pnpm db:migrate

# 6. Start the API server
cd packages/api && pnpm dev

# 7. Start the web UI (in another terminal)
cd packages/web && pnpm dev
```

### Option 3: CLI Only

Run tests directly from the command line without the web UI:

```bash
# Install and build
pnpm install && pnpm build

# Run a recorded test
node packages/cli/bin/saveaction.js run recording.json --headless false
```

## 🔄 How It Works

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  1. RECORD       │────▶│  2. UPLOAD        │────▶│  3. CONFIGURE    │
│                  │     │                   │     │                  │
│  Use the browser │     │  Upload JSON to   │     │  Create tests,   │
│  extension to    │     │  the recording    │     │  choose browsers,│
│  capture actions │     │  library via UI   │     │  set timeout     │
└─────────────────┘     └──────────────────┘     └──────────────────┘
                                                           │
┌─────────────────┐     ┌──────────────────┐               ▼
│  6. SCHEDULE     │◀────│  5. ANALYZE       │◀────┌──────────────────┐
│                  │     │                   │     │  4. RUN           │
│  Set up cron     │     │  Review results,  │     │                  │
│  schedules for   │     │  videos, and      │     │  Execute via UI, │
│  automated runs  │     │  screenshots      │     │  CLI, or API     │
└─────────────────┘     └──────────────────┘     └──────────────────┘
```

## 🖥️ Web Dashboard

The web dashboard provides a full-featured interface for managing your test automation:

| Feature | Description |
|---------|-------------|
| **Projects** | Organize tests into projects with custom colors and slugs |
| **Test Suites** | Group related tests into suites for batch execution |
| **Tests** | Create tests from recordings with multi-browser configuration |
| **Runs** | Execute tests and watch real-time progress via SSE streaming |
| **Run Details** | Per-action results, video playback, screenshot gallery, browser matrix |
| **Recording Library** | Upload, search, tag, and manage JSON recordings |
| **Schedules** | Configure cron-scheduled recurring test runs |
| **Dashboard** | Aggregated stats, recent runs, trends, upcoming schedules |
| **Settings** | Profile, security, API tokens, project configuration |

## 🎮 CLI Commands

### Run Tests

```bash
# Run recording with visible browser
saveaction run test.json --headless false

# Run with Firefox instead of Chromium
saveaction run test.json --browser firefox

# Adjust speed (0.5 = half speed, 2.0 = double speed)
saveaction run test.json --speed 0.5

# Record video of test execution
saveaction run test.json --video

# Custom timeout (milliseconds)
saveaction run test.json --timeout 60000

# Realistic timing mode (replays original delays)
saveaction run test.json --timing-mode realistic

# JSON output for CI/CD pipelines
saveaction run test.json --output json --output-file results.json
```

### Run from Platform (CI/CD Integration)

Fetch and run recordings directly from the SaveAction API:

```bash
# Run a single recording by ID
saveaction run --recording-id rec_abc123 \
  --api-url https://your-server.com/api \
  --api-token $SAVEACTION_API_TOKEN

# Run all recordings with a tag
saveaction run --tag smoke \
  --api-url https://your-server.com/api \
  --api-token $SAVEACTION_API_TOKEN

# Override base URL for staging
saveaction run --recording-id rec_abc123 \
  --api-url https://your-server.com/api \
  --api-token $SAVEACTION_API_TOKEN \
  --base-url https://staging.myapp.com

# Using environment variables (recommended for CI/CD)
export SAVEACTION_API_URL=https://your-server.com/api
export SAVEACTION_API_TOKEN=your-token
saveaction run --tag smoke --base-url https://staging.myapp.com
```

See [CLI Platform Integration](docs/CLI_PLATFORM_INTEGRATION.md) for detailed documentation.

### Analyze Recordings

```bash
# Display recording analysis in console
saveaction info test.json

# Output in JSON format
saveaction info test.json --json
```

### Validate Recordings

```bash
# Basic validation
saveaction validate test.json

# Show detailed field validation
saveaction validate test.json --verbose

# Output validation result as JSON
saveaction validate test.json --json
```

### List Recordings

```bash
# List recordings in current directory
saveaction list

# List recordings in a specific directory
saveaction list ./recordings
```

## 🔌 REST API

Full REST API with Swagger documentation available at `/api/docs`.

| Route | Purpose |
|-------|---------|
| `/api/v1/auth/*` | Register, login, refresh, password reset |
| `/api/v1/tokens/*` | API token management |
| `/api/v1/projects/*` | Project CRUD (max 100/user) |
| `/api/v1/projects/:id/suites/*` | Test suite management |
| `/api/v1/projects/:id/tests/*` | Test CRUD + run |
| `/api/v1/recordings/*` | Recording library (upload, manage) |
| `/api/v1/runs/*` | Run management + SSE live progress stream |
| `/api/v1/schedules/*` | Cron schedule management |
| `/api/v1/dashboard/*` | Aggregated statistics |
| `/api/health/*` | Health checks (basic, detailed, live, ready) |

## 📊 Recording Format

Recordings are JSON files captured by the [SaveAction Recorder extension](https://github.com/SaveActionHQ/SaveAction-recorder-browser-extenstion):

```json
{
  "id": "rec_1234567890",
  "testName": "User Login Flow",
  "url": "https://example.com",
  "viewport": { "width": 1920, "height": 1080 },
  "windowSize": { "width": 1920, "height": 1188 },
  "devicePixelRatio": 1,
  "actions": [
    {
      "type": "click",
      "timestamp": 1234,
      "completedAt": 1284,
      "selector": { "id": "login-button" },
      "coordinates": { "x": 120, "y": 45 }
    }
  ]
}
```

**Supported Action Types:** `click`, `input`, `select`, `navigation`, `hover`, `scroll`, `keypress`, `submit`, `checkpoint`, `modal-lifecycle`

## 🛠️ Tech Stack

| Category | Technology |
|----------|-----------|
| **Runtime** | Node.js 18+ (ES modules) |
| **Language** | TypeScript 5.3 (strict mode) |
| **Monorepo** | pnpm workspaces + Turborepo |
| **Browser Automation** | Playwright 1.40 (Chromium, Firefox, WebKit) |
| **API Framework** | Fastify 4 |
| **Database** | PostgreSQL 16 + Drizzle ORM |
| **Queue** | Redis 7 + BullMQ |
| **Web Framework** | Next.js 15 (App Router) |
| **UI Components** | shadcn/ui + Tailwind CSS |
| **Validation** | Zod |
| **CLI** | Commander.js |
| **Testing** | Vitest (1,500+ tests) |

## 🧪 Running Tests

```bash
# Run all tests across all packages
pnpm test

# Run specific package tests
cd packages/core && pnpm test
cd packages/cli && pnpm test
cd packages/api && pnpm test

# Lint all packages
pnpm lint
```

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](docs/GETTING_STARTED.md) | Setup and first test run |
| [API Documentation](docs/API.md) | REST API reference |
| [CLI Platform Integration](docs/CLI_PLATFORM_INTEGRATION.md) | CI/CD integration guide |
| [Docker Deployment](docs/DOCKER_DEPLOYMENT.md) | Production deployment guide |
| [Worker Architecture](docs/WORKER_ARCHITECTURE.md) | BullMQ worker internals |
| [Self Hosting](docs/SELF_HOSTING.md) | Self-hosting guide |
| [Architecture Plan](STARTING_MVP_SAVEACTION_PLAN.md) | Implementation roadmap |

**Browser Extension:** [SaveAction Recorder](https://github.com/SaveActionHQ/SaveAction-recorder-browser-extenstion)

## 🤝 Contributing

Contributions are welcome once the project reaches v1.0.0! This project follows:

- **Conventional Commits** (`feat:`, `fix:`, `test:`, `docs:`)
- **TypeScript Strict Mode** with ES module `.js` extensions
- **Test-First Development** — Add tests for new features
- **No Overengineering** — Keep solutions simple and focused

## 📄 License

SaveAction is licensed under the **Business Source License 1.1 (BSL 1.1)**, which converts to **Apache 2.0** on **January 14, 2031**.

### What This Means for You

✅ **Allowed:**

- Self-host SaveAction for your organization (production use allowed)
- Use SaveAction for internal/commercial testing
- Modify and customize the source code
- Integrate SaveAction into your CI/CD pipelines

❌ **Not Allowed:**

- Offer SaveAction as a hosted/managed SaaS service to third parties
- Provide SaveAction testing as your primary commercial offering

**Full license:** [LICENSE](./LICENSE) | **Questions?** [LICENSE-FAQ.md](./LICENSE-FAQ.md)

## 🌟 Star History

If you find this project interesting, please star it to follow development progress!

---

<div align="center">
  <sub>Built with ❤️ by the SaveAction team</sub>
</div>
