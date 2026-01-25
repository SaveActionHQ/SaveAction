import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit Configuration
 *
 * Used for:
 * - Generating migrations: pnpm db:generate
 * - Running migrations: pnpm db:migrate
 * - Drizzle Studio: pnpm db:studio
 * - Push schema to DB: pnpm db:push
 */
export default defineConfig({
  // Schema files location - each file must be imported independently
  schema: [
    './src/db/schema/users.ts',
    './src/db/schema/api-tokens.ts',
    './src/db/schema/recordings.ts',
    './src/db/schema/runs.ts',
    './src/db/schema/run-actions.ts',
    './src/db/schema/schedules.ts',
    './src/db/schema/webhooks.ts',
  ],

  // Output directory for migrations
  out: './drizzle',

  // Database dialect
  dialect: 'postgresql',

  // Database connection
  dbCredentials: {
    // Use DATABASE_URL if available, otherwise construct from parts
    url:
      process.env['DATABASE_URL'] ||
      `postgresql://${process.env['DB_USER'] || 'saveaction'}:${process.env['DB_PASSWORD'] || 'saveaction_dev'}@${process.env['DB_HOST'] || 'localhost'}:${process.env['DB_PORT'] || '5432'}/${process.env['DB_NAME'] || 'saveaction'}`,
  },

  // Verbose output during migrations
  verbose: true,

  // Strict mode - fail on warnings
  strict: true,
});
