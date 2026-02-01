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
> This project is currently under active development and is **NOT yet complete**. Core features are being built and tested. APIs and interfaces may change significantly.
>
> **Please wait for the official v1.0.0 release before using in production environments.**
>
> ⭐ **Star this repo** to stay updated on releases!

---

## ✨ Features

- 🎯 **Zero Code Testing** - No programming knowledge required, just record and replay
- 🎭 **Pixel-Perfect Replay** - Matches exact window size, viewport, and device pixel ratio
- ⚡ **Smart Element Location** - Multi-strategy selector with exponential backoff retry
- 📊 **Recording Analysis** - Analyze recordings without running (metadata, statistics, timing insights)
- ✅ **Schema Validation** - Validate recording structure and integrity before running tests
- 🎠 **Carousel Support (Beta)** - Intelligent detection for Swiper, Slick, and Bootstrap carousels
- 🌊 **Human-Like Execution** - Replicates exact scroll speed, typing delays, and hover duration
- 🔄 **Intelligent Navigation** - Auto-correction and optimized back/forward navigation
- 🎨 **Beautiful CLI Output** - Real-time progress with color-coded status and timing
- 🧪 **Test-First Development** - 148 unit tests with comprehensive coverage
- 🔧 **TypeScript + Strict Mode** - Type-safe with ES2022 modules

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run a recorded test
node packages/cli/bin/saveaction.js run recording.json --headless false
```

## 📦 Architecture

```
SaveAction/
├── packages/
│   ├── core/           # @saveaction/core - Execution engine
│   │   ├── parser/     # JSON recording parser + Zod validation
│   │   ├── runner/     # Test runner + element locator
│   │   ├── reporter/   # Console reporter
│   │   └── types/      # TypeScript interfaces
│   └── cli/            # @saveaction/cli - Command-line tool
└── browser-extension/  # Chrome extension (separate repo)
```

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
```

### Run from Platform (CI/CD Integration)

Fetch and run recordings directly from the SaveAction Platform API:

```bash
# Run a single recording by ID
saveaction run --recording-id rec_abc123 \
  --api-url https://api.saveaction.io \
  --api-token $SAVEACTION_API_TOKEN

# Run all recordings with a tag (e.g., smoke tests)
saveaction run --tag smoke \
  --api-url https://api.saveaction.io \
  --api-token $SAVEACTION_API_TOKEN

# Override base URL for different environments
saveaction run --recording-id rec_abc123 \
  --api-url https://api.saveaction.io \
  --api-token $SAVEACTION_API_TOKEN \
  --base-url https://staging.myapp.com

# Using environment variables (recommended for CI/CD)
export SAVEACTION_API_URL=https://api.saveaction.io
export SAVEACTION_API_TOKEN=your-token
saveaction run --tag smoke --base-url https://staging.myapp.com
```

See [CLI Platform Integration](docs/CLI_PLATFORM_INTEGRATION.md) for detailed documentation.

### Analyze Recordings

Get detailed information about a recording without running it:

```bash
# Display recording analysis in console
saveaction info test.json

# Output in JSON format
saveaction info test.json --json
```

### Validate Recordings

Validate recording file structure and schema without running the test:

```bash
# Basic validation
saveaction validate test.json

# Show detailed field validation
saveaction validate test.json --verbose

# Output validation result as JSON
saveaction validate test.json --json
```

The validate command checks:

- ✅ File existence and extension (.json)
- ✅ File size limits (warning > 10MB, hard limit at 50MB)
- ✅ JSON syntax
- ✅ Schema compliance (Zod validation)
- ✅ Required fields (id, testName, url, version, actions)
- ✅ Field types and formats
- ✅ Semantic validation (action counts, version compatibility)

**Sample Output:**

```
📊 Recording Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📁 File
  Name:         test.json

📝 Metadata
  Test Name:    User Login Flow
  Recording ID: rec_1768467712498
  Start URL:    https://example.com
  Recorded:     1/15/2026, 11:01:52 AM
  Schema:       v1.0

📱 Viewport
  Category:     Desktop
  Dimensions:   1920x1080

📊 Actions
  Total:        16

  By Type:
    click          7 █████████████░░░░░░░░░░░░░░░░░ 43.8%
    input          7 █████████████░░░░░░░░░░░░░░░░░ 43.8%
    submit         1 ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 6.3%

⏱️  Timing
  Recording:    16.32s
  Action Span:  15.53s
  Gaps:         Min: 0ms | Max: 3.22s | Avg: 1.04s

🗺️  Navigation
  Flow Type:    MPA (Multi-Page Application)
  Unique Pages: 2
  Transitions:  1
```

**JSON Output Example:**

```json
{
  "version": "1.0",
  "file": "test.json",
  "metadata": {
    "testName": "User Login Flow",
    "recordingId": "rec_1768467712498",
    "schemaVersion": "1.0"
  },
  "statistics": {
    "total": 16,
    "byType": { "click": 7, "input": 7, "submit": 1 },
    "percentages": { "click": 43.75, "input": 43.75, "submit": 6.25 }
  },
  "navigation": {
    "flowType": "MPA",
    "uniquePages": 2
  }
}
```

## 📊 Recording Format

Recordings are JSON files captured by the [SaveAction Recorder extension](https://github.com/rezwanahmedsami/SaveAction-recorder-browser-extenstion):

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

## 🎠 Carousel/Swiper Support (Beta)

SaveAction intelligently detects and handles carousel navigation to execute repeated clicks correctly.

### Supported Libraries

- ✅ **Swiper.js** - Detects `.swiper-button-next/prev` and `aria-label="Next slide"`
- ✅ **Bootstrap Carousel** - Detects `.carousel-control-next/prev`
- ✅ **Slick Carousel** - Detects `.slick-next/prev`

### How It Works

- **Timing-based detection**: Clicks >500ms apart are considered intentional navigation
- **Duplicate prevention**: Clicks <200ms apart are skipped as recording errors
- **Safety limits**: Maximum 5 consecutive carousel clicks to prevent infinite loops

### Example Output

```
🎠 Intentional carousel navigation click (767ms apart)
✅ [24] click completed (432ms)
🎠 Intentional carousel navigation click (696ms apart)
✅ [25] click completed (427ms)
```

### Known Limitations

- Custom carousel implementations may not be auto-detected
- International sites with non-English `aria-label` may need updates

**Feedback Welcome!** If your carousel isn't detected, please [open an issue](https://github.com/SaveActionHQ/SaveAction/issues) with your recording JSON.

---

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+ with ES modules
- **Package Manager**: pnpm + Turborepo monorepo
- **Browser Automation**: Playwright 1.40.0 (Chromium, Firefox, WebKit)
- **Validation**: Zod 3.22.4 for runtime type checking
- **Testing**: Vitest 1.0.4 with v8 coverage (81 tests passing)
- **CLI**: Commander.js 11.1.0
- **TypeScript**: 5.3.3 (strict mode, ES2022 target)

## 📈 Current Progress

**Phase 1: Core Engine + CLI** ✅ **COMPLETE**

- JSON recording parser with Zod validation
- Multi-browser test runner
- Element locator with retry logic
- CLI tool with run command

**Phase 2: Unit Testing** ✅ **COMPLETE**

- 73 unit tests passing
- 53.8% code coverage
- RecordingParser: 100% coverage
- ConsoleReporter: 100% coverage

**Phase 3: Perfect Timing Replication** ✅ **COMPLETE**

- Hover duration simulation
- Smooth scroll animations (ease-out cubic)
- Exact coordinate clicks
- Typing delay enforcement
- `completedAt` timing system
- Window size matching for pixel-perfect layout

**Phase 4: REST API** 🚧 **PLANNED**

- Express/Fastify server
- Recording upload endpoints
- Test execution API
- WebSocket live progress

**Phase 5: Web UI** 🚧 **PLANNED**

- React/Next.js dashboard
- Recording manager
- Test results viewer
- Scheduled runs

## 🎯 Timing Accuracy

Latest test results show **98.3% timing accuracy**:

- Recording duration: 17.615 seconds
- Replay duration: 17.320 seconds
- Back navigation: 22ms (optimized)
- All 17 actions: 100% success rate

## 🧪 Running Tests

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm exec vitest run --coverage

# Watch mode
pnpm exec vitest watch
```

## 📖 Documentation

- [Architecture Plan](./STARTING_MVP_SAVEACTION_PLAN.md) - Complete implementation roadmap
- [AI Agent Instructions](./AGENTS.md) - Guidelines for AI-assisted development
- [GitHub Copilot Instructions](./.github/copilot-instructions.md) - Coding standards
- [Browser Extension Repository](https://github.com/rezwanahmedsami/SaveAction-recorder-browser-extenstion) - Recording tool

## 🤝 Contributing

Contributions are welcome once the project reaches v1.0.0! This project follows:

- **Conventional Commits** (`feat:`, `fix:`, `test:`, `docs:`)
- **TypeScript Strict Mode** with ES module `.js` extensions
- **Test-First Development** - Add tests for new features
- **No Overengineering** - Keep solutions simple and focused

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

**Full license:** [LICENSE](./LICENSE)  
**Questions?** See [LICENSE-FAQ.md](./LICENSE-FAQ.md) for detailed scenarios

### Why BSL 1.1?

We chose BSL 1.1 to:

1. Enable free self-hosting and internal use for everyone
2. Protect our ability to build a sustainable SaaS business
3. Guarantee an open-source future (Apache 2.0 conversion in 5 years)

This is the same license used by HashiCorp (Terraform), CockroachDB, and Sentry.

## 🌟 Star History

If you find this project interesting, please star it to follow development progress!

---

<div align="center">
  <sub>Built with ❤️ by the SaveAction team</sub>
</div>
