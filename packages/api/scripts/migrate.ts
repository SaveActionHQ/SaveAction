/**
 * Database Migration Runner
 *
 * Executes all SQL migration files in order against the database.
 * This bypasses drizzle-kit's CLI which has issues with .js extension
 * resolution in TypeScript ES module imports.
 *
 * Usage:
 *   tsx scripts/migrate.ts
 *   node --loader tsx scripts/migrate.ts
 *
 * Requires DATABASE_URL environment variable.
 */

import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const migrationsDir = path.join(__dirname, '..', 'drizzle');

  // Get all SQL files sorted by name (0000_, 0001_, etc.)
  const sqlFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (sqlFiles.length === 0) {
    console.log('ℹ️  No migration files found');
    return;
  }

  console.log(`📦 Found ${sqlFiles.length} migration files`);

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    for (const file of sqlFiles) {
      console.log(`\n🔄 Running: ${file}`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      // Split by drizzle-kit's statement breakpoint marker
      const statements = sql.split('--> statement-breakpoint');

      for (const stmt of statements) {
        const trimmed = stmt.trim();
        if (trimmed) {
          try {
            await client.query(trimmed);
          } catch (err: unknown) {
            const pgErr = err as { message?: string; code?: string };
            // Ignore "already exists" errors for idempotency
            if (
              pgErr.code === '42710' || // duplicate_object (type already exists)
              pgErr.code === '42P07' || // duplicate_table
              pgErr.code === '42701' || // duplicate_column
              pgErr.code === '42P16'    // invalid_table_definition (constraint already exists)
            ) {
              console.log(`   ⏩ Skipped (already exists): ${pgErr.message?.split('\n')[0]}`);
            } else {
              throw err;
            }
          }
        }
      }

      console.log(`   ✅ ${file}`);
    }

    console.log('\n✅ All migrations completed successfully');
  } finally {
    await client.end();
  }
}

runMigrations().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
