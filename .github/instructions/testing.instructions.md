---
applyTo: "packages/core/src/**/*.test.ts"
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
- Core logic (locator): 90%+
- Integration (runner): 25%+ (behavior tests)

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

## Assertions

- Use specific matchers: `toBe()`, `toEqual()`, `toContain()`, `toThrow()`
- For async: Always use `await expect(...).rejects.toThrow()`
- Check behavior, not implementation details

## Test Coverage Command

```bash
pnpm exec vitest run --coverage
```

## File Naming

Place test files next to source: `ComponentName.test.ts` alongside `ComponentName.ts`
