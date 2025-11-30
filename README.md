<div align="center">
  <img src="SaveActionLogo.png" alt="SaveAction Logo" width="200"/>
  
  # SaveAction Platform
  
  ### 🎬 No-Code QA Test Automation Platform
  
  Automate your testing workflow without writing a single line of code. Record user interactions with our browser extension, then replay them with pixel-perfect precision for cross-browser validation.
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
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
- 🌊 **Human-Like Execution** - Replicates exact scroll speed, typing delays, and hover duration
- 🔄 **Intelligent Navigation** - Auto-correction and optimized back/forward navigation
- 🎨 **Beautiful CLI Output** - Real-time progress with color-coded status and timing
- 🧪 **Test-First Development** - 73 unit tests with 53.8% coverage
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

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+ with ES modules
- **Package Manager**: pnpm + Turborepo monorepo
- **Browser Automation**: Cross-browser support (Chromium, Firefox, WebKit)
- **Validation**: Zod 3.22.4 for runtime type checking
- **Testing**: Vitest 1.0.4 with v8 coverage
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

MIT License - see [LICENSE](./LICENSE) file for details

## 🌟 Star History

If you find this project interesting, please star it to follow development progress!

---

<div align="center">
  <sub>Built with ❤️ by the SaveAction team</sub>
</div>
