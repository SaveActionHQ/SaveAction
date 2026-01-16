# SaveAction AI Agent Instructions

## What This Project Does

SaveAction is a test automation platform that:
1. Records browser interactions via Chrome extension (produces JSON files)
2. Replays those recordings using Playwright for cross-browser testing
3. Provides CLI tool for running tests with detailed reporting

## Architecture Overview

**Monorepo Structure** (pnpm + Turborepo):
- `packages/core` - Core automation engine with Playwright
- `packages/cli` - Command-line interface tool

**Key Technologies**:
- TypeScript with ES modules (strict mode)
- Playwright 1.40.0 for browser automation
- Zod 3.22.4 for JSON validation
- Vitest 1.0.4 for testing
- ESLint 9.x with typescript-eslint
- Husky 9.x with lint-staged (git hooks)
- GitHub Actions CI
- Commander.js 11.1.0 for CLI

## Critical Rules

### 1. ES Module Imports (MOST IMPORTANT)
**Always use `.js` extensions in TypeScript imports**:
```typescript
// ✅ Correct
import { Parser } from './Parser.js';

// ❌ Wrong - will fail at runtime
import { Parser } from './Parser';
```

### 2. Element Location Strategy
- Use multi-strategy selectors (id → dataTestId → ariaLabel → css → xpath)
- Implement exponential backoff retry (500ms → 1000ms → 2000ms)
- Wait for element stability before interaction
- Add 300ms delay after clicks/inputs for animations

### 3. Navigation Handling
- Detect URL changes during actions
- Treat navigation as success (not failure) when expected
- Handle race conditions between click and navigation

### 4. Testing Requirements
- Place `.test.ts` files next to source files
- Use Vitest with `describe`/`it` structure
- Target 90%+ coverage for critical components
- Mock console output and Playwright objects

## How to Work With This Codebase

### Adding New Action Types
1. Define interface in `packages/core/src/types/actions.ts`
2. Add type guard function
3. Update `Action` union type
4. Implement in `PlaywrightRunner.executeAction()`
5. Add tests

### Modifying Element Location
- All changes go through `ElementLocator` class
- Maintain selector priority order
- Keep exponential backoff logic
- Test with real recordings

### Adding CLI Commands
1. Create file in `packages/cli/src/commands/`
2. Export async function accepting `(params, options)`
3. Register in `cli.ts` using Commander.js
4. Parse boolean/number options correctly

### Debugging Test Failures
1. Check selector specificity (may match multiple elements)
2. Verify navigation detection logic
3. Ensure 300ms delays after interactions
4. Run with `--headless false` to observe browser

## Common Tasks

### Build Everything
```bash
pnpm build
```

### Run Tests
```bash
pnpm test
```

### Run Linting
```bash
pnpm lint
```

### Run CLI
```bash
node packages/cli/bin/saveaction.js run test8_1763549638010.json --headless false
```

### Check Coverage
```bash
pnpm exec vitest run --coverage
```

## Project Status

**Completed**:
- ✅ Core engine with Playwright runner
- ✅ Multi-strategy element locator with retry
- ✅ CLI with run command
- ✅ JSON parser with Zod validation
- ✅ Console reporter with emoji output
- ✅ Unit tests (81 tests)
- ✅ Working with test recordings (100% pass rate)
- ✅ ESLint + Prettier configuration
- ✅ Husky git hooks (pre-commit, commit-msg, pre-push)
- ✅ GitHub Actions CI pipeline

**Next Phases**:
- Phase 3: REST API + PostgreSQL database
- Phase 4: React/Next.js web UI

## File Organization

```
Types          → packages/core/src/types/
Parser         → packages/core/src/parser/
Element Locator→ packages/core/src/runner/ElementLocator.ts
Runner         → packages/core/src/runner/PlaywrightRunner.ts
Reporter       → packages/core/src/reporter/
CLI Commands   → packages/cli/src/commands/
Tests          → *.test.ts files next to source
```

## Special Notes

1. **Never remove `.js` extensions** - breaks ES module resolution
2. **Keep 300ms delays** - required for animation stability
3. **Preserve retry logic** - exponential backoff is tested and working
4. **Test with real recordings** - `test8_1763549638010.json` is the reference
5. **Run build before CLI** - TypeScript must compile first

## Getting Help

- Playwright docs: https://playwright.dev/
- Zod validation: https://zod.dev/
- Test recordings available in workspace root
- Example run shows 13 actions passing in ~12 seconds

## Commit Conventions

Commit messages are **enforced by Husky** `commit-msg` hook.

Use conventional commits format: `<type>(<scope>): <subject>`

**Allowed types**:
- `feat:` - New features
- `fix:` - Bug fixes
- `test:` - Test additions/changes
- `docs:` - Documentation
- `refactor:` - Code restructuring
- `ci:` - CI/CD changes
- `chore:` - Maintenance tasks

**Git Hooks**:
| Hook | Action |
|------|--------|
| `pre-commit` | Runs lint-staged (ESLint + Prettier) |
| `commit-msg` | Validates conventional commit format |
| `pre-push` | Runs `pnpm build && pnpm test` |

Broken code cannot be committed or pushed.
