/**
 * Test Setup - Runs before each test file
 *
 * Initializes test database connection and provides cleanup utilities.
 */

import { beforeAll, afterAll, afterEach } from 'vitest';
import { getTestDb, closeTestDb } from './helpers/database.js';
import { sql } from 'drizzle-orm';

beforeAll(async () => {
  // Ensure database is connected for all tests
  await getTestDb();
});

afterEach(async () => {
  // Clean up data between tests for isolation
  const db = await getTestDb();
  await db.execute(
    sql`TRUNCATE TABLE users, api_tokens, recordings, runs, run_actions, schedules, webhooks, webhook_deliveries CASCADE`
  );
});

afterAll(async () => {
  // Close database connection after all tests
  await closeTestDb();
});
