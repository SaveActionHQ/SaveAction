---
applyTo: "packages/core/src/types/**/*.ts"
---

# Type Definitions Guidelines

## Principles

- Define all interfaces before implementation
- Use strict TypeScript types (no `any` unless absolutely necessary)
- Export types explicitly using `export type` for type-only exports
- Include JSDoc comments for complex types

## Naming Conventions

- Interfaces: PascalCase (e.g., `Recording`, `Action`, `SelectorStrategy`)
- Type aliases: PascalCase (e.g., `ActionType`, `SelectorType`)
- Enums: PascalCase with UPPER_CASE values
- Type guards: `isSomething()` pattern (e.g., `isClickAction()`)

## Structure

1. **Import statements**: Type imports first, then value imports
2. **Interfaces**: Group related interfaces together
3. **Type unions**: Define after related interfaces
4. **Type guards**: Include for discriminated unions
5. **Constants**: Define type-related constants (like default configs)

## Type Guards

Always provide type guard functions for discriminated unions:

```typescript
export function isClickAction(action: Action): action is ClickAction {
  return action.type === 'click';
}
```

## Documentation

Include JSDoc for:
- Complex interfaces (especially those with many optional fields)
- Union types that represent different states
- Type guards to explain their purpose

## Examples

See existing files:
- `actions.ts` - Action type definitions with discriminated unions
- `selectors.ts` - Selector strategy with priority system
- `recording.ts` - Recording format and metadata
- `runner.ts` - Runner options and result types
