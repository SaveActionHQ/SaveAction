---
applyTo: "packages/**/*.ts,packages/**/*.js"
excludeAgent: ["code-review"]
---

# ES Module Import Guidelines

## Critical Rule: Always Use .js Extensions

TypeScript compiles to JavaScript ES modules. The `.js` extension is **required** at runtime, even though you're importing `.ts` files.

### ✅ Correct

```typescript
import { RecordingParser } from './parser/RecordingParser.js';
import type { Recording } from '../types/index.js';
import { PlaywrightRunner } from './runner/PlaywrightRunner.js';
```

### ❌ Wrong (Will cause runtime errors)

```typescript
import { RecordingParser } from './parser/RecordingParser';
import type { Recording } from '../types/index';
import { PlaywrightRunner } from './runner/PlaywrightRunner.ts';
```

## Import Order

1. Node.js built-ins
2. External dependencies
3. Type-only imports from external
4. Internal imports with `.js`
5. Type-only imports from internal with `.js`

Example:
```typescript
import { readFile } from 'fs/promises';
import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import { ElementLocator } from './ElementLocator.js';
import type { Recording, Action } from '../types/index.js';
```

## Package.json Configuration

Every package must have:
```json
{
  "type": "module"
}
```

## Common Errors

**Error**: `ERR_MODULE_NOT_FOUND`
**Cause**: Missing `.js` extension in import
**Fix**: Add `.js` to the import path

**Error**: `Cannot find module`
**Cause**: Trying to import `.ts` file directly
**Fix**: Use `.js` extension, TypeScript handles the resolution

## Verification

Before committing, always:
1. Run `pnpm build` - should compile without errors
2. Run `pnpm test` - should pass all tests
3. Check that all imports have `.js` extensions
