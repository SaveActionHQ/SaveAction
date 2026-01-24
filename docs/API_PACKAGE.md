# API Package (@saveaction/api)

> **Status:** Phase 3 - Foundation Complete  
> **Last Updated:** January 24, 2026

## Overview

The `@saveaction/api` package is a Fastify-based REST API server that will serve as the backend for the SaveAction platform. It provides endpoints for managing recordings, executing tests, and user authentication.

## Current State

### ✅ Completed

| Component | Description |
|-----------|-------------|
| Package setup | TypeScript, build scripts, test configuration |
| Environment config | Zod-validated env vars with type safety |
| Error handling | Global error handler with standardized JSON responses |
| CORS | Configurable cross-origin support |
| Health endpoint | `/api/health` for container orchestration |
| Graceful shutdown | Handles SIGTERM/SIGINT for clean container stops |
| Unit tests | 61 tests covering all components |

### ⏳ Not Yet Implemented

- Database layer (Drizzle ORM + PostgreSQL)
- Redis integration (rate limiting, sessions, job queues)
- Authentication (JWT + refresh tokens)
- API routes (recordings, runs, users)
- BullMQ job queue for async test execution

## Architecture

```
packages/api/
├── src/
│   ├── index.ts              # Public exports
│   ├── server.ts             # Entry point (starts server)
│   ├── app.ts                # Fastify app factory
│   ├── config/
│   │   └── env.ts            # Environment validation
│   ├── errors/
│   │   ├── index.ts          # Exports
│   │   └── ApiError.ts       # Custom error class + factories
│   └── plugins/
│       └── errorHandler.ts   # Global error handler
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Key Design Decisions

### 1. Fastify Plugin with `fastify-plugin`

We use `fastify-plugin` to break Fastify's encapsulation for the error handler. This is the **official pattern** for global middleware.

**Why?** Fastify isolates plugins by default. Without `fastify-plugin`, an error handler only applies to routes registered inside that plugin's scope.

```typescript
// ❌ Without fastify-plugin - error handler is scoped
export async function errorHandler(fastify) {
  fastify.setErrorHandler(...); // Only applies to routes inside this plugin
}

// ✅ With fastify-plugin - error handler is global
export const errorHandler = fp(errorHandlerPlugin, { name: 'errorHandler' });
```

### 2. Duck Typing for Error Detection

We use `isApiError()` duck typing instead of `instanceof` for cross-module compatibility:

```typescript
export function isApiError(error: unknown): error is ApiError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'name' in error &&
    error.name === 'ApiError' &&
    'code' in error &&
    'statusCode' in error &&
    'toResponse' in error
  );
}
```

**Why?** In test environments and bundlers, `instanceof` can fail across module boundaries due to separate class instances.

### 3. Standardized Error Response Format

All errors return this structure:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": { "field": "validation info" },
    "requestId": "req-1"
  }
}
```

### 4. Environment Validation with Zod

Environment variables are validated at startup with strict schemas:

```typescript
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  JWT_SECRET: z.string().min(32).optional(),
  JWT_REFRESH_SECRET: z.string().min(32).optional(),
});
```

Production mode enforces all secrets are present.

## Error Handling

The error handler processes errors in this order:

1. **ApiError** → Custom application errors with status codes
2. **ZodError** → Validation errors from Zod schemas
3. **Fastify validation** → JSON schema validation errors
4. **404 errors** → Unmatched routes
5. **Generic errors** → Falls back to 500 (hides details in production)

### Error Factory Functions

```typescript
import { Errors } from '@saveaction/api';

throw Errors.badRequest('Invalid input', { field: 'email' });
throw Errors.unauthorized('Token expired');
throw Errors.forbidden('Admin access required');
throw Errors.notFound('Recording');
throw Errors.conflict('Email already exists');
throw Errors.validationError({ email: 'Invalid format' });
throw Errors.rateLimited(60); // retry after 60 seconds
throw Errors.internal('Database connection failed');
```

## Running the API

### Development

```bash
# Start PostgreSQL and Redis
docker compose -f docker-compose.dev.yml up -d

# Start API with hot reload
cd packages/api
pnpm dev
```

### Production

```bash
cd packages/api
pnpm build
pnpm start
```

### Testing

```bash
cd packages/api
pnpm test           # Run tests
pnpm test:coverage  # With coverage report
```

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| fastify | 4.29.1 | Web framework |
| @fastify/cors | 9.0.1 | CORS middleware |
| @fastify/sensible | 5.6.0 | Utilities (httpErrors, etc.) |
| fastify-plugin | 5.1.0 | Plugin encapsulation control |
| pino | 9.14.0 | Structured logging |
| pino-pretty | 11.3.0 | Pretty logs in development |
| zod | 3.25.76 | Schema validation |
| tsx | 4.21.0 | TypeScript execution for dev |

## Next Steps

Per TASKS.md, the next tasks for Phase 3 are:

1. **Redis Setup** - Rate limiting, sessions, job queues
2. **BullMQ Job Queue** - Async test execution
3. **Database Setup** - Drizzle ORM + PostgreSQL schema
4. **Authentication** - JWT registration, login, refresh tokens
5. **API Routes** - Recordings CRUD, run execution, etc.

## File Reference

| File | Purpose |
|------|---------|
| [src/config/env.ts](../packages/api/src/config/env.ts) | Environment validation |
| [src/errors/ApiError.ts](../packages/api/src/errors/ApiError.ts) | Error class and factories |
| [src/plugins/errorHandler.ts](../packages/api/src/plugins/errorHandler.ts) | Global error handler |
| [src/app.ts](../packages/api/src/app.ts) | Fastify app factory |
| [src/server.ts](../packages/api/src/server.ts) | Server entry point |

## Test Coverage

```
 ✓ src/errors/ApiError.test.ts      (26 tests)
 ✓ src/config/env.test.ts           (14 tests)
 ✓ src/plugins/errorHandler.test.ts (13 tests)
 ✓ src/app.test.ts                  (8 tests)

 Test Files  4 passed (4)
      Tests  61 passed (61)
```

---

_This document should be updated as more API features are implemented._
