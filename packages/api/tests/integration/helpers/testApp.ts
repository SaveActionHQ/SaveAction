/**
 * Test App Builder
 *
 * Creates a properly configured Fastify application for integration testing.
 * Uses real database connection but skips Redis/queues for faster tests.
 */

import { FastifyInstance } from 'fastify';
import { buildApp, type AppOptions } from '../../../src/app.js';
import { getTestConfig, getTestDb, type TestDatabase } from './database.js';
import type { Env } from '../../../src/config/index.js';

export interface TestAppOptions {
  /** Include Redis (slower, needed for rate limiting tests) */
  withRedis?: boolean;
  /** Include BullMQ queues (needed for run execution tests) */
  withQueues?: boolean;
  /** Custom JWT secret */
  jwtSecret?: string;
  /** Custom refresh token secret */
  jwtRefreshSecret?: string;
}

export interface TestApp {
  app: FastifyInstance;
  db: TestDatabase;
  close: () => Promise<void>;
}

/**
 * Create a Fastify application configured for integration testing.
 *
 * By default:
 * - Uses real PostgreSQL database
 * - Skips Redis/BullMQ (faster tests)
 * - Skips rate limiting (no flaky tests)
 * - Skips Swagger (not needed)
 * - Skips Helmet (not needed)
 * - Uses JWT for authentication
 */
export async function createTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  const config = getTestConfig();
  const db = await getTestDb();

  // Build test environment
  const testEnv: Env = {
    NODE_ENV: 'test',
    API_PORT: 0, // Random port
    API_HOST: '127.0.0.1',
    DATABASE_URL: config.databaseUrl,
    REDIS_URL: options.withRedis ? config.redisUrl : undefined,
    JWT_SECRET: options.jwtSecret || config.jwtSecret,
    JWT_REFRESH_SECRET: options.jwtRefreshSecret || config.jwtRefreshSecret,
    CORS_ORIGIN: '*',
    LOG_LEVEL: 'error', // Quiet logs during tests
    SMTP_PORT: 587,
    SMTP_SECURE: false,
    SMTP_FROM_NAME: 'SaveAction',
    APP_BASE_URL: 'http://localhost:3000',
    WORKER_CONCURRENCY: 1,
    VIDEO_STORAGE_PATH: './test-storage/videos',
    SCREENSHOT_STORAGE_PATH: './test-storage/screenshots',
  };

  const appOptions: AppOptions = {
    env: testEnv,
    logger: false, // Disable logging in tests
    skipRedis: !options.withRedis,
    skipQueues: !options.withQueues,
    skipDatabase: false, // We need real database for integration tests
    skipMigrations: true, // Migrations run in globalSetup
    skipAuth: false, // We need auth for testing
    skipSwagger: true, // Not needed in tests
    skipHelmet: true, // Not needed in tests
    skipRateLimit: true, // Avoid flaky tests
    skipCsrf: true, // Simpler testing
  };

  const app = await buildApp(appOptions);

  // Wait for app to be ready
  await app.ready();

  return {
    app,
    db,
    close: async () => {
      await app.close();
    },
  };
}

/**
 * Helper to inject a request with JSON body
 */
export async function injectJson(
  app: FastifyInstance,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  options: {
    payload?: unknown;
    headers?: Record<string, string>;
  } = {}
) {
  return app.inject({
    method,
    url,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    payload: options.payload ? JSON.stringify(options.payload) : undefined,
  });
}

/**
 * Helper to inject an authenticated request
 */
export async function injectAuthenticated(
  app: FastifyInstance,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  accessToken: string,
  options: {
    payload?: unknown;
    headers?: Record<string, string>;
  } = {}
) {
  return app.inject({
    method,
    url,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      ...options.headers,
    },
    payload: options.payload ? JSON.stringify(options.payload) : undefined,
  });
}
