---
applyTo: "packages/**/src/**/*.test.ts,packages/**/tests/**/*.ts"
---

# Testing Guidelines

## Framework: Vitest

Use Vitest with the following patterns:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
```

## Test Structure

1. **describe blocks**: Group related tests
2. **beforeEach/afterEach**: Setup and teardown
3. **Test names**: Use descriptive "should" statements

Example:
```typescript
describe('ComponentName', () => {
  describe('methodName', () => {
    it('should handle normal case', () => {
      // Arrange
      // Act
      // Assert
    });
    
    it('should throw error for invalid input', () => {
      // Test
    });
  });
});
```

## Coverage Target

- Critical components (parser, reporter): 100%
- Core logic (locator, services): 90%+
- Integration (runner, routes): 25%+ (behavior tests)
- API services: 90%+
- API repositories: 90%+

## Mocking

### Console Output
```typescript
let consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
// Remember to restore in afterEach
consoleLogSpy.mockRestore();
```

### Playwright Objects
Mock only what you need:
```typescript
const mockPage: Page = {
  locator: vi.fn().mockReturnValue(mockLocator),
  getByTestId: vi.fn().mockReturnValue(mockLocator),
  waitForTimeout: vi.fn().mockResolvedValue(undefined),
} as unknown as Page;
```

### Database Mocking (API)
```typescript
const mockDb = {
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([mockData]),
    }),
  }),
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([mockData]),
    }),
  }),
};
```

### Fastify App Mocking (API)
```typescript
const app = Fastify();
app.decorate('jwt', {});
app.decorateRequest('jwtVerify', async function () {
  (this as any).user = { sub: 'user-123' };
});
```

## API Integration Tests

Integration tests use real PostgreSQL and Redis:

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
  
  // Use beforeEach for user creation (tables truncated after each test)
  beforeEach(async () => {
    const user = await createUser({ email: 'test@example.com' });
  });
});
```

**Important**: Use `beforeEach` (not `beforeAll`) for test data since `afterEach` truncates tables.

## Assertions

- Use specific matchers: `toBe()`, `toEqual()`, `toContain()`, `toThrow()`
- For async: Always use `await expect(...).rejects.toThrow()`
- Check behavior, not implementation details
- For HTTP responses: Check `statusCode` and parsed `payload`

## Test Commands

```bash
# Unit tests
pnpm test

# With coverage
pnpm exec vitest run --coverage

# API integration tests
cd packages/api && pnpm test:integration

# Core browser integration tests
cd packages/core && pnpm test:integration
```

## File Naming

- Unit tests: `ComponentName.test.ts` alongside `ComponentName.ts`
- Integration tests: `feature.integration.ts` in `tests/integration/`
