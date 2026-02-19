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
    // Drop both schemas to ensure a completely clean state:
    // - "public" holds all application tables and enum types
    // - "drizzle" holds the __drizzle_migrations tracking table
    // Without dropping "drizzle", migrate() thinks all migrations are applied and skips them.
    console.log('🧹 Cleaning up test database...');
    await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
    await db.execute(sql`DROP SCHEMA public CASCADE`);
    await db.execute(sql`CREATE SCHEMA public`);
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
