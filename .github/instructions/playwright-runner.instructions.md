---
applyTo: "packages/core/src/runner/**/*.ts"
---

# Playwright Runner Guidelines

## Core Principles

1. **Element Stability**: Always wait for elements to be attached before interaction
2. **Retry Logic**: Use exponential backoff (500ms → 1000ms → 2000ms)
3. **Navigation Detection**: Check URL changes to handle automatic navigation
4. **Animation Delays**: Add 300ms delay after clicks/inputs for JavaScript animations

## Key Patterns

### Finding Elements

Use `ElementLocator.findElement()` which handles:
- Multi-strategy selector fallback (id → dataTestId → ariaLabel → css → xpath)
- Exponential retry with backoff
- Element stability checks

### Handling Clicks

```typescript
try {
  const element = await this.locator.findElement(page, action.selector);
  
  // Race click against navigation (1s timeout)
  await Promise.race([
    element.click(),
    page.waitForNavigation({ timeout: 1000 }).catch(() => {}),
  ]);
  
  // Delay for animations
  await page.waitForTimeout(300);
  
  // Check for navigation
  if (page.url() !== action.url) {
    // Page navigated, this is expected
    return;
  }
} catch (error) {
  // Handle errors
}
```

### Input Actions

Always clear before typing and add delay after:
```typescript
await element.clear();
await element.type(value, { delay: action.typingDelay || 50 });
await page.waitForTimeout(300); // For autocomplete dropdowns
```

### Error Handling

Handle these common cases:
- Element not found (after retries)
- Navigation during interaction
- Browser/page closed
- Timeout exceeded

## Browser Lifecycle

1. Launch browser with options (headless, video, etc.)
2. Create context with viewport and userAgent from recording
3. Create page and navigate to start URL
4. Execute actions sequentially
5. Close browser (even on error)

## Options

Support these options:
- `headless: boolean` - Show/hide browser
- `browser: 'chromium' | 'firefox' | 'webkit'` - Browser choice
- `timeout: number` - Default timeout in ms
- `video: string` - Video recording path

## Testing

- Mock Playwright objects (Page, Browser, Locator)
- Test behavior, not implementation
- Verify reporter hooks are called correctly
- Test error handling paths
