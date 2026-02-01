# API Integration Tests

This document describes the integration testing infrastructure for the SaveAction API. Integration tests verify the API behavior against real PostgreSQL and Redis instances.

## Overview

Integration tests differ from unit tests in that they:
- Use a **real PostgreSQL database** (not mocked)
- Use a **real Redis instance** (not mocked)
- Test the full request/response cycle through Fastify
- Verify data isolation and security between users
- Run database migrations automatically

## Prerequisites

### Local Development

1. **PostgreSQL** running on `localhost:5432`
2. **Redis** running on `localhost:6379`
3. Environment variables set (or use defaults):

```bash
# Database (defaults to saveaction_test for integration tests)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/saveaction_test

# Redis
REDIS_URL=redis://localhost:6379

# JWT Secret (required)
JWT_SECRET=test-secret-key-for-integration-tests
```

### CI Environment (GitHub Actions)

The CI workflow automatically provisions PostgreSQL and Redis services. See `.github/workflows/ci.yml` for the service configuration.

## Running Integration Tests

### Run All Integration Tests

```bash
cd packages/api
pnpm test:integration
```

### Run Specific Test File

```bash
cd packages/api
pnpm exec vitest run --config vitest.config.integration.ts tests/integration/auth.integration.ts
```

### Run with Verbose Output

```bash
cd packages/api
pnpm exec vitest run --config vitest.config.integration.ts --reporter=verbose
```

## Test Structure

```
packages/api/tests/integration/
├── globalSetup.ts              # Runs once before all tests (migrations, cleanup)
├── setup.ts                    # Runs before each test file (table truncation)
├── helpers/
│   ├── index.ts                # Re-exports all helpers
│   ├── database.ts             # Database connection and cleanup utilities
│   ├── testApp.ts              # Creates Fastify test app instance
│   ├── userFactory.ts          # Creates test users with hashed passwords
│   └── recordingFactory.ts     # Creates test recordings
├── auth.integration.ts         # Authentication flow tests
├── recordings.integration.ts   # Recordings CRUD tests
├── runs.integration.ts         # Test runs management tests
└── permissions.integration.ts  # Data isolation & security tests
```

## Test Lifecycle

### Global Setup (`globalSetup.ts`)

Runs **once** before all integration tests:

1. Validates environment variables
2. Tests database connection
3. **Runs migrations** to ensure tables exist
4. Truncates all tables for clean state

### Per-File Setup (`setup.ts`)

Runs **before each test file**:

1. Creates test app instance with Fastify
2. Sets up `afterEach` hook to truncate tables between tests

### Test Helpers

#### `createTestApp()`

Creates a configured Fastify instance for testing:

```typescript
import { createTestApp } from './helpers/index.js';

const testApp = await createTestApp();
// testApp.app - Fastify instance
// testApp.db - Drizzle database instance
// testApp.close() - Cleanup function
```

#### `createUser()`

Creates a user directly in the database:

```typescript
import { createUser } from './helpers/index.js';

const user = await createUser({
  email: 'test@example.com',
  password: 'Password123!',
});
// user.id - UUID
// user.email - Email address
// user.plainPassword - Original password (for login tests)
```

#### `createRecording()`

Creates a recording directly in the database:

```typescript
import { createRecording } from './helpers/index.js';

const recording = await createRecording({
  userId: user.id,
  name: 'My Test Recording',
  tags: ['smoke', 'login'],
});
```

## Writing New Integration Tests

### 1. Create Test File

Create a new file with `.integration.ts` suffix:

```typescript
// tests/integration/feature.integration.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestApp,
  createUser,
  type TestApp,
  type CreatedUser,
} from './helpers/index.js';

describe('Feature Integration', () => {
  let testApp: TestApp;
  let user: CreatedUser;
  let token: string;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  // If you need fresh user per test (recommended for isolation)
  beforeEach(async () => {
    user = await createUser({ email: 'test@example.com' });
    
    const loginResponse = await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'Content-Type': 'application/json' },
      payload: { email: user.email, password: user.plainPassword },
    });
    token = JSON.parse(loginResponse.payload).data.tokens.accessToken;
  });

  it('should do something', async () => {
    const response = await testApp.app.inject({
      method: 'GET',
      url: '/api/v1/feature',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
  });
});
```

### 2. Use `beforeEach` for User Creation

**Important**: The `afterEach` hook in `setup.ts` truncates all tables after each test. If you create users in `beforeAll`, they will be deleted before subsequent tests run.

```typescript
// ❌ Wrong - users deleted after first test
beforeAll(async () => {
  user = await createUser({ email: 'test@example.com' });
});

// ✅ Correct - fresh user for each test
beforeEach(async () => {
  user = await createUser({ email: 'test@example.com' });
});
```

### 3. Test Data Isolation

Always verify that users cannot access each other's data:

```typescript
it('should NOT allow User B to access User A data', async () => {
  const userA = await createUser({ email: 'a@example.com' });
  const userB = await createUser({ email: 'b@example.com' });
  
  const recordingA = await createRecording({ userId: userA.id });
  
  // Get token for User B
  const loginB = await testApp.app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: userB.email, password: userB.plainPassword },
  });
  const tokenB = JSON.parse(loginB.payload).data.tokens.accessToken;
  
  // Try to access User A's recording as User B
  const response = await testApp.app.inject({
    method: 'GET',
    url: `/api/v1/recordings/${recordingA.id}`,
    headers: { 'Authorization': `Bearer ${tokenB}` },
  });
  
  expect([403, 404]).toContain(response.statusCode);
});
```

## Test Categories

### Auth Tests (`auth.integration.ts`)

- User registration with validation
- Login with correct/incorrect credentials
- Token refresh flow
- Get current user (`/me`)
- Logout and token invalidation
- Inactive user rejection

### Recordings Tests (`recordings.integration.ts`)

- Create recording with validation
- List recordings with pagination
- Filter recordings by tags
- Get single recording
- Update recording (PUT)
- Delete recording (soft delete)

### Runs Tests (`runs.integration.ts`)

- Create run from recording
- List runs with pagination
- Get run details
- Delete completed runs
- Prevent deletion of running tests

### Permissions Tests (`permissions.integration.ts`)

- User A cannot read User B's recordings
- User A cannot update User B's recordings
- User A cannot delete User B's recordings
- User A cannot access User B's runs
- Token security (invalid, expired, modified tokens)

## Configuration

### Vitest Config (`vitest.config.integration.ts`)

```typescript
export default defineConfig({
  test: {
    include: ['tests/**/*.integration.ts'],
    globalSetup: ['./tests/integration/globalSetup.ts'],
    setupFiles: ['./tests/integration/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Run tests sequentially for DB consistency
      },
    },
  },
});
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `REDIS_URL` | Yes | - | Redis connection string |
| `JWT_SECRET` | Yes | - | Secret for JWT signing |
| `JWT_ACCESS_EXPIRES_IN` | No | `15m` | Access token expiry |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Refresh token expiry |

## Troubleshooting

### "relation does not exist"

The migrations haven't run. The `globalSetup.ts` should handle this automatically, but if you see this error:

```bash
# Manually run migrations
cd packages/api
pnpm db:migrate
```

### Tests Timeout

Integration tests have a 30-second timeout. If tests are timing out:

1. Check database connection
2. Check Redis connection
3. Increase timeout in `vitest.config.integration.ts`

### Data Leaking Between Tests

Ensure you're using `beforeEach` (not `beforeAll`) for creating test data that tests depend on. The `afterEach` hook truncates all tables.

### Port Already in Use

The test app uses dynamic ports. If you see port conflicts, ensure previous test runs have completed:

```bash
# Kill any orphaned processes
taskkill /F /IM node.exe  # Windows
pkill -f node             # Linux/Mac
```

## CI/CD Integration

Integration tests run in GitHub Actions with:

- PostgreSQL 15 service container
- Redis 7 service container
- Automatic migration execution
- Test results in PR checks

See `.github/workflows/ci.yml` for the full configuration.

## Best Practices

1. **One assertion focus per test** - Each test should verify one specific behavior
2. **Use descriptive test names** - `should NOT allow User B to access User A recording`
3. **Create fresh data per test** - Use `beforeEach` for test isolation
4. **Test both success and failure paths** - Verify error codes and messages
5. **Test security boundaries** - Always verify data isolation between users
6. **Clean up resources** - The framework handles this, but be mindful of external resources

## Contributing

When adding new API endpoints:

1. Add unit tests in `src/routes/<endpoint>.test.ts`
2. Add integration tests in `tests/integration/<feature>.integration.ts`
3. Test both happy path and error cases
4. Verify data isolation if the endpoint accesses user data
5. Update this documentation if adding new test patterns
