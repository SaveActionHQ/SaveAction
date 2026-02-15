/**
 * Global Setup for Integration Tests
 *
 * This runs once before all integration tests.
 * Sets up test database and verifies connections.
 */

import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getTestDb, closeTestDb, getTestConfig } from './helpers/database.js';

export default async function globalSetup() {
  console.log('\n🔧 Setting up integration test environment...\n');

  const config = getTestConfig();

  // Validate environment
  if (!config.databaseUrl) {
    throw new Error(
      'DATABASE_URL environment variable is required for integration tests.\n' +
        'Make sure PostgreSQL is running and DATABASE_URL is set.'
    );
  }

  if (!config.redisUrl) {
    throw new Error(
      'REDIS_URL environment variable is required for integration tests.\n' +
        'Make sure Redis is running and REDIS_URL is set.'
    );
  }

  try {
    // Test database connection
    const db = await getTestDb();
    await db.execute(sql`SELECT 1`);
    console.log('✅ PostgreSQL connection successful');

    // Clean up test database BEFORE running migrations
    // This prevents migration failures when adding NOT NULL columns to tables with existing data
    console.log('🧹 Cleaning up test database...');
    try {
      // Try full truncate with all tables including projects
      await db.execute(sql`TRUNCATE TABLE users, api_tokens, projects, recordings, runs, run_actions, schedules, webhooks, webhook_deliveries CASCADE`);
    } catch {
      // Projects table might not exist yet on first run
      try {
        await db.execute(sql`TRUNCATE TABLE users, api_tokens, recordings, runs, run_actions, schedules, webhooks, webhook_deliveries CASCADE`);
      } catch {
        // Tables might not exist yet, that's OK
        console.log('ℹ️ Tables do not exist yet, skipping truncation');
      }
    }
    console.log('✅ Test database cleaned');

    // Run migrations to ensure tables exist
    console.log('🔄 Running database migrations...');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const migrationsFolder = path.resolve(__dirname, '../../drizzle');
    await migrate(db, { migrationsFolder });
    console.log('✅ Migrations completed');

    await closeTestDb();
  } catch (error) {
    console.error('❌ Failed to setup test database:', error);
    throw error;
  }

  console.log('\n✨ Integration test environment ready!\n');
}
