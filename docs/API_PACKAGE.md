# API Package (@saveaction/api)

> **Status:** Phase 3 - API Development Active  
> **Last Updated:** January 30, 2026

## Overview

The `@saveaction/api` package is a Fastify-based REST API server that serves as the backend for the SaveAction platform. It provides endpoints for managing recordings, executing tests, and user authentication.

## Current State

### ✅ Completed

| Component | Description |
|-----------|-------------|
| Package setup | TypeScript, build scripts, test configuration |
| Environment config | Zod-validated env vars with type safety |
| Error handling | Global error handler with standardized JSON responses |
| CORS | Configurable cross-origin support |
| Health endpoints | `/api/health`, `/api/health/detailed`, `/api/health/live`, `/api/health/ready` |
| Graceful shutdown | Handles SIGTERM/SIGINT for clean container stops |
| Redis integration | ioredis client with connection pooling, health checks |
| Database layer | Drizzle ORM + PostgreSQL with migrations |
| BullMQ job queues | Test-runs, cleanup, scheduled-tests queues |
| Authentication | JWT + refresh tokens, password reset, account lockout |
| API Tokens | Programmatic API access with scopes |
| Recordings API | Full CRUD with filtering, pagination, soft delete |
| Unit tests | 506 tests covering all components |

### ⏳ Not Yet Implemented

- Runs API (test execution and results)
- Webhooks API (event notifications)
- Schedules API (cron-based test runs)

## Architecture

```
packages/api/
├── src/
│   ├── index.ts              # Public exports
│   ├── server.ts             # Entry point (starts server)
│   ├── app.ts                # Fastify app factory
│   ├── config/
│   │   └── env.ts            # Environment validation
│   ├── db/
│   │   ├── index.ts          # Database connection
│   │   └── schema/           # Drizzle schema definitions
│   ├── errors/
│   │   └── ApiError.ts       # Custom error class + factories
│   ├── plugins/
│   │   ├── errorHandler.ts   # Global error handler
│   │   ├── redis.ts          # Redis connection plugin
│   │   └── bullmq.ts         # BullMQ queue plugin
│   ├── queues/
│   │   └── JobQueueManager.ts # Job queue management
│   ├── redis/
│   │   └── RedisClient.ts    # Redis client wrapper
│   ├── repositories/
│   │   ├── UserRepository.ts
│   │   ├── ApiTokenRepository.ts
│   │   └── RecordingRepository.ts
│   ├── services/
│   │   ├── ApiTokenService.ts
│   │   ├── EmailService.ts
│   │   ├── LockoutService.ts
│   │   └── RecordingService.ts
│   ├── auth/
│   │   ├── AuthService.ts    # JWT authentication
│   │   └── types.ts          # Auth types
│   └── routes/
│       ├── auth.ts           # Authentication routes
│       ├── tokens.ts         # API token routes
│       └── recordings.ts     # Recording CRUD routes
├── drizzle/                  # Database migrations
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

## Redis Integration

### RedisClient

A wrapper around `ioredis` that provides:

- **Connection management** with lazy connect
- **Exponential backoff retry** (max 30 seconds)
- **Health checks** with latency measurement
- **Graceful shutdown** (waits for pending commands)
- **Convenience methods** for common operations

```typescript
import { RedisClient } from '@saveaction/api';

const client = new RedisClient({
  url: 'redis://localhost:6379',
  keyPrefix: 'saveaction:',
  connectTimeout: 5000,
  maxRetriesPerRequest: 3,
});

await client.connect();

// Basic operations
await client.set('key', 'value', 3600); // with TTL
const value = await client.get('key');
await client.del('key');

// Hash operations
await client.hset('user:1', 'name', 'John');
await client.hgetall('user:1');

// Health check
const health = await client.healthCheck();
// { status: 'healthy', latencyMs: 1, connectionState: 'connected' }

await client.disconnect();
```

### Fastify Plugin

Redis is available globally via `fastify.redis`:

```typescript
app.get('/example', async (request, reply) => {
  const value = await request.server.redis.get('key');
  return { value };
});
```

### Health Check Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Basic health check |
| `GET /api/health/detailed` | All service statuses with latency |
| `GET /api/health/live` | Kubernetes liveness probe |
| `GET /api/health/ready` | Kubernetes readiness probe |

**Detailed health response:**

```json
{
  "status": "ok",
  "timestamp": "2026-01-25T...",
  "version": "0.1.0",
  "services": {
    "api": { "status": "healthy" },
    "redis": { "status": "healthy", "latencyMs": 1 }
  }
}
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
| ioredis | 5.9.2 | Redis client |
| pino | 9.14.0 | Structured logging |
| pino-pretty | 11.3.0 | Pretty logs in development |
| zod | 3.25.76 | Schema validation |
| tsx | 4.21.0 | TypeScript execution for dev |

## Next Steps

Per TASKS.md, the next tasks for Phase 3 are:

1. **BullMQ Job Queue** - Async test execution
2. **Database Setup** - Drizzle ORM + PostgreSQL schema
3. **Authentication** - JWT registration, login, refresh tokens
4. **API Routes** - Recordings CRUD, run execution, etc.

## File Reference

| File | Purpose |
|------|---------|
| [src/config/env.ts](../packages/api/src/config/env.ts) | Environment validation |
| [src/errors/ApiError.ts](../packages/api/src/errors/ApiError.ts) | Error class and factories |
| [src/plugins/errorHandler.ts](../packages/api/src/plugins/errorHandler.ts) | Global error handler |
| [src/plugins/redis.ts](../packages/api/src/plugins/redis.ts) | Redis Fastify plugin |
| [src/redis/RedisClient.ts](../packages/api/src/redis/RedisClient.ts) | Redis client wrapper |
| [src/app.ts](../packages/api/src/app.ts) | Fastify app factory |
| [src/server.ts](../packages/api/src/server.ts) | Server entry point |

## Test Coverage

```
 ✓ src/errors/ApiError.test.ts      (26 tests)
 ✓ src/config/env.test.ts           (14 tests)
 ✓ src/redis/RedisClient.test.ts    (40 tests)
 ✓ src/plugins/redis.test.ts        (10 tests)
 ✓ src/plugins/errorHandler.test.ts (13 tests)
 ✓ src/app.test.ts                  (11 tests)

 Test Files  6 passed (6)
      Tests  114 passed (114)
```

---

_This document should be updated as more API features are implemented._

