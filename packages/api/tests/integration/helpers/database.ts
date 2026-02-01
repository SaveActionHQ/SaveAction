/**
 * Database Test Helper
 *
 * Provides utilities for connecting to test PostgreSQL database.
 */

import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../../../src/db/schema/index.js';

export type TestDatabase = NodePgDatabase<typeof schema>;

let pool: Pool | null = null;
let db: TestDatabase | null = null;

export interface TestConfig {
  databaseUrl: string | undefined;
  redisUrl: string | undefined;
  jwtSecret: string;
  jwtRefreshSecret: string;
}

/**
 * Get test configuration from environment variables.
 * Uses sensible defaults for local development.
 *
 * Local: Uses 'saveaction' database from docker-compose.dev.yml
 * CI: Uses 'saveaction_test' database from GitHub Actions service
 */
export function getTestConfig(): TestConfig {
  // CI sets DATABASE_URL, local development uses docker-compose defaults
  const defaultDbUrl = process.env['CI']
    ? 'postgresql://saveaction:saveaction_test@localhost:5432/saveaction_test'
    : 'postgresql://saveaction:saveaction_dev@localhost:5432/saveaction';

  return {
    databaseUrl: process.env['DATABASE_URL'] || defaultDbUrl,
    redisUrl: process.env['REDIS_URL'] || 'redis://localhost:6379',
    jwtSecret: process.env['JWT_SECRET'] || 'test-jwt-secret-at-least-32-characters-long',
    jwtRefreshSecret: process.env['JWT_REFRESH_SECRET'] || 'test-jwt-refresh-secret-at-least-32-chars',
  };
}

/**
 * Get or create test database connection.
 */
export async function getTestDb(): Promise<TestDatabase> {
  if (db) {
    return db;
  }

  const config = getTestConfig();

  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required for integration tests');
  }

  pool = new Pool({
    connectionString: config.databaseUrl,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  // Test connection
  const client = await pool.connect();
  client.release();

  db = drizzle(pool, { schema });
  return db;
}

/**
 * Close test database connection.
 */
export async function closeTestDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}

/**
 * Get the raw PostgreSQL pool for direct queries if needed.
 */
export function getTestPool(): Pool | null {
  return pool;
}
