# SaveAction Platform - Repository Instructions

## Project Overview

SaveAction is an open-source test automation platform that replays browser interactions recorded by a Chrome extension. The platform uses Playwright for reliable cross-browser test execution with intelligent element location and retry logic.

**Architecture**: Monorepo with pnpm workspaces and Turborepo
**Primary Language**: TypeScript with ES modules
**Target**: CLI-first approach (free tier), with future API/DB and Web UI

## Project Structure

```
SaveAction/
├── .github/
│   ├── workflows/
│   │   └── ci.yml          # GitHub Actions CI pipeline
│   └── copilot-instructions.md
├── .husky/                 # Git hooks
│   ├── pre-commit          # Runs lint-staged
│   ├── commit-msg          # Validates conventional commits
│   └── pre-push            # Runs build + tests
├── packages/
│   ├── core/           # Core engine (@saveaction/core)
│   │   ├── src/
│   │   │   ├── types/      # TypeScript interfaces and type guards
│   │   │   ├── parser/     # JSON recording parser with Zod validation
│   │   │   ├── runner/     # Playwright runner and element locator
│   │   │   └── reporter/   # Console reporter for CLI output
│   │   └── package.json
│   └── cli/            # CLI tool (@saveaction/cli)
│       ├── src/
│       │   └── commands/   # CLI commands (run, etc.)
│       ├── bin/
│       │   └── saveaction.js  # Entry point
│       └── package.json
├── eslint.config.js    # ESLint flat config
├── turbo.json          # Turborepo build pipeline
├── pnpm-workspace.yaml # pnpm workspace config
└── tsconfig.base.json  # Shared TypeScript config
```

## Core Technologies

- **Runtime**: Node.js with ES modules (`"type": "module"`)
- **Package Manager**: pnpm (monorepo with workspaces)
- **Build System**: Turborepo 1.11.0 for caching and parallel builds
- **Automation**: Playwright 1.40.0 (chromium/firefox/webkit)
- **Validation**: Zod 3.22.4 for runtime schema validation
- **Testing**: Vitest 1.0.4 with v8 coverage
- **Linting**: ESLint 9.x with typescript-eslint (flat config)
- **Git Hooks**: Husky 9.x with lint-staged
- **CI/CD**: GitHub Actions
- **CLI Framework**: Commander.js 11.1.0
- **TypeScript**: 5.3.3, strict mode, ES2022 target, ESNext modules

## Development Guidelines

### TypeScript Configuration

1. **ES Module Imports**: Always use `.js` extensions in import paths
   ```typescript
   // ✅ Correct
   import { RecordingParser } from './parser/RecordingParser.js';
   
   // ❌ Wrong
   import { RecordingParser } from './parser/RecordingParser';
   ```

2. **Strict Mode**: All code must pass TypeScript strict checks
   - No implicit any
   - Strict null checks enabled
   - Unused locals/parameters checked

3. **Type Exports**: Use explicit type imports for type-only imports
   ```typescript
   import type { Recording, Action } from '../types/index.js';
   ```

### Code Organization

1. **Types First**: Define interfaces in `types/` directory before implementation
2. **Single Responsibility**: Each class/module has one clear purpose
3. **Dependency Injection**: Use constructor injection for testability
4. **No Overengineering**: Keep solutions simple and focused

### Testing Standards

- **Framework**: Vitest with v8 coverage provider
- **Target**: 90%+ coverage for critical components (parser, locator, reporter)
- **Style**: Test behavior, not implementation details
- **Naming**: Descriptive test names that explain what's being tested
- **Mocking**: Use vi.fn() for mocks, avoid heavy mocking of Playwright

**Test Files**:
- Place `.test.ts` files next to source files
- Use `describe()` blocks to group related tests
- Use `beforeEach()`/`afterEach()` for setup/teardown
- Mock console.log/console.error when testing reporters

### Build and Run Commands

```bash
# Install dependencies
pnpm install

# Build all packages (uses Turborepo cache)
pnpm build

# Run tests
pnpm test

# Run linting
pnpm lint

# Run tests with coverage
pnpm exec vitest run --coverage

# Run CLI (after build)
node packages/cli/bin/saveaction.js run <recording.json> [options]

# CLI options:
# --headless false    # Show browser
# --browser firefox   # Use Firefox instead of Chromium
# --timeout 60000     # Custom timeout
# --video ./videos    # Record video
```

## Key Components

### 1. RecordingParser (`packages/core/src/parser/`)

**Purpose**: Parse and validate JSON recordings from browser extension

**Key Methods**:
- `parseFile(filePath: string)`: Read and parse recording from disk
- `parseString(json: string)`: Parse recording from JSON string
- `validate(data: unknown)`: Private Zod validation (tested through public methods)

**Testing**: 100% coverage, all validation paths tested

### 2. ElementLocator (`packages/core/src/runner/`)

**Purpose**: Find elements using multi-strategy fallback with retry logic

**Key Features**:
- **Selector Priority**: id → dataTestId → ariaLabel → name → css → xpath → position
- **Exponential Backoff**: 3 retries with 500ms → 1000ms → 2000ms delays
- **Element Stability**: Waits for element to be attached before returning
- **Special Fallbacks**: Hardcoded fallbacks for known selectors (e.g., search-submit-text)

**Key Methods**:
- `findElement(page: Page, selector: SelectorStrategy)`: Main entry with retry loop
- `getLocator(page: Page, type: string, value: any)`: Map selector type to Playwright locator

**Testing**: 87.15% coverage

### 3. PlaywrightRunner (`packages/core/src/runner/`)

**Purpose**: Execute recorded actions using Playwright

**Key Features**:
- **Browser Lifecycle**: Launch → Context → Page → Actions → Close
- **Action Types**: click, input, scroll, navigation, select, keypress, submit
- **Navigation Detection**: URL change detection prevents false failures
- **Animation Delays**: 300ms delays after clicks/inputs for JS animations
- **Error Handling**: Graceful handling of navigation, closed browser, timeouts

**Key Methods**:
- `execute(recording: Recording, options?: RunOptions)`: Main entry point
- `executeAction(page: Page, action: Action)`: Route to specific handlers
- `executeClick()`, `executeInput()`, `executeScroll()`: Action executors

**Testing**: 25.2% coverage (behavior tests, not full integration)

### 4. ConsoleReporter (`packages/core/src/reporter/`)

**Purpose**: Pretty console output for CLI

**Reporter Hooks**:
- `onStart(recording)`: Show test name and action count
- `onActionStart(action, index)`: Show action being executed
- `onActionSuccess(action, index, duration)`: Show success with timing
- `onActionError(action, index, error)`: Show error message
- `onComplete(result)`: Show final summary with stats

**Testing**: 100% coverage

## Recording Format

Recordings are JSON files produced by the SaveAction Chrome extension with this structure:

```typescript
interface Recording {
  id: string;                    // rec_<timestamp>
  testName: string;              // User-provided test name
  url: string;                   // Starting URL
  startTime: string;             // ISO 8601
  endTime?: string;
  viewport: { width, height };
  userAgent: string;
  actions: Action[];             // Array of recorded actions
  version: string;               // Schema version
}

interface Action {
  id: string;                    // act_001, act_002, etc.
  type: 'click' | 'input' | 'scroll' | 'navigation' | 'select' | 'keypress' | 'submit';
  timestamp: number;
  url: string;
  selector: SelectorStrategy;    // Multi-strategy selector
  // ... type-specific fields
}
```

## Common Patterns

### Adding New Action Types

1. Define interface in `packages/core/src/types/actions.ts`
2. Add type guard function (e.g., `isScrollAction()`)
3. Update `Action` union type
4. Implement executor in `PlaywrightRunner.executeAction()`
5. Add tests in `PlaywrightRunner.test.ts`

### Adding New Selector Types

1. Update `SelectorStrategy` in `packages/core/src/types/selectors.ts`
2. Update `SelectorType` union
3. Implement in `ElementLocator.getLocator()`
4. Add to priority array in recordings
5. Add tests in `ElementLocator.test.ts`

### Debugging Test Failures

1. **Element Not Found**: Check selector priority and specificity
2. **Navigation Issues**: Look for URL changes, use navigation detection
3. **Timing Issues**: Ensure proper delays after clicks/inputs (300ms)
4. **Strict Mode Violations**: Multiple elements matched, need more specific selector

## Known Issues and Solutions

### Issue: Element Hiding After Click
**Cause**: Missing back navigation in recording
**Solution**: Ensure browser extension captures all navigation actions

### Issue: Autocomplete Blocking Submit
**Cause**: Dropdown animation not complete
**Solution**: 300ms delay after input actions

### Issue: Form Auto-Submit
**Cause**: Page navigating while trying to click submit
**Solution**: URL change detection treats navigation as success

### Issue: ES Module Resolution
**Cause**: Missing `.js` extensions in imports
**Solution**: Always add `.js` to relative imports in TypeScript

## Git Workflow

- **main** branch: Stable, working code
- **Commit Messages**: Use conventional commits (enforced by husky commit-msg hook)
- **Testing**: All tests must pass before committing
- **Build**: Code must build without errors

### Commit Message Format

Commit messages are validated by the `commit-msg` hook and must follow the Conventional Commits format:

```
<type>(<scope>): <subject>
```

**Allowed types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

**Examples**:
```bash
feat: add recording pause functionality
fix(runner): resolve element location issue
docs: update README with new features
test(parser): add validation edge cases
```

### Git Hooks (Husky)

| Hook | Action | Description |
|------|--------|-------------|
| `pre-commit` | `lint-staged` | Runs ESLint + Prettier on staged files |
| `commit-msg` | Validates format | Ensures conventional commit format |
| `pre-push` | `build + test` | Prevents pushing broken code |

### CI Pipeline (GitHub Actions)

The CI runs on every PR and push to `main`:

| Job | Description |
|-----|-------------|
| `lint` | Runs ESLint with 0 warnings tolerance |
| `typecheck` | Builds all packages (TypeScript strict mode) |
| `test` | Runs all unit tests |
| `test-coverage` | Uploads coverage to Codecov (main branch only) |

## Future Phases

### Phase 3: API + Database (Planned)
- REST API with Express/Fastify
- PostgreSQL for recording storage
- Authentication and user management

### Phase 4: Web UI (Planned)
- React/Next.js dashboard
- Recording manager
- Test results viewer
- Scheduled runs

## Contact and Resources

- **Test Recordings**: `test8_1763549638010.json` (13 actions, 100% pass rate)
- **Example Run**: `node packages/cli/bin/saveaction.js run test8_1763549638010.json --headless false`
- **Playwright Docs**: https://playwright.dev/
- **Zod Docs**: https://zod.dev/

## Important Notes

- Never remove `.js` extensions from imports (ES module requirement)
- Always run tests after making changes
- Keep retry logic exponential (don't change backoff strategy)
- Preserve 300ms delays for animation stability
- Test with real recordings, not just unit tests
