/**
 * Vitest Configuration for Integration Tests
 *
 * Integration tests run against real PostgreSQL and Redis instances.
 * Use `pnpm test:integration` to run these tests.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.integration.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '*.config.*'],
    // Integration tests may take longer due to real DB operations
    testTimeout: 30000,
    hookTimeout: 30000,
    // Run integration tests sequentially to avoid DB conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Setup file for database and redis connections
    setupFiles: ['./tests/integration/setup.ts'],
    // Global teardown
    globalSetup: ['./tests/integration/globalSetup.ts'],
  },
});
