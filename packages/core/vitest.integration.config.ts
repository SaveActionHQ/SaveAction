import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for browser integration tests
 * These tests launch real Chromium browsers and execute actions against HTML fixtures
 *
 * Run with: pnpm run test:integration
 * Or: pnpm exec vitest run --config vitest.integration.config.ts
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Only run integration test files
    include: ['src/**/*.integration.test.ts'],
    // Integration tests are slower - increase timeout
    testTimeout: 30000,
    hookTimeout: 30000,
    // Run tests sequentially to avoid browser conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Separate coverage for integration tests
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage-integration',
      include: ['src/runner/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.integration.test.ts', '**/types/**', 'dist/**'],
    },
  },
});
