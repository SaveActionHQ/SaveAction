import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { runs } from './runs.js';
import { tests } from './tests.js';

/**
 * Browser result status enum
 */
export const browserResultStatusEnum = pgEnum('browser_result_status', [
  'pending', // Waiting to start
  'running', // Currently executing
  'passed', // All actions successful
  'failed', // One or more actions failed
  'cancelled', // Manually cancelled
  'skipped', // Skipped (e.g., browser not available)
]);

/**
 * Run Browser Results table - Per-browser execution results
 *
 * When a test runs on multiple browsers, each browser execution
 * gets its own row in this table. This enables the matrix view:
 *
 *                  Chrome  Firefox  Safari
 * Add to Cart         ✅      ✅       ✅
 * Apply Coupon        ✅      ❌       ✅
 *
 * Design principles:
 * - One row per (run, test, browser) combination
 * - Links back to parent run for aggregate queries
 * - Stores browser-specific artifacts (video, screenshot)
 * - Duration tracked per browser for performance analysis
 */
export const runBrowserResults = pgTable(
  'run_browser_results',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Owner reference (denormalized for authorization)
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Parent run reference
    runId: uuid('run_id')
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),

    // Test reference (for test-level queries)
    testId: uuid('test_id')
      .notNull()
      .references(() => tests.id, { onDelete: 'cascade' }),

    // Browser for this result
    browser: varchar('browser', { length: 50 }).notNull(), // chromium, firefox, webkit

    // Execution status
    status: browserResultStatusEnum('status').notNull().default('pending'),

    // Timing
    durationMs: varchar('duration_ms', { length: 20 }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),

    // Action results summary
    actionsTotal: varchar('actions_total', { length: 10 }),
    actionsExecuted: varchar('actions_executed', { length: 10 }),
    actionsFailed: varchar('actions_failed', { length: 10 }),
    actionsSkipped: varchar('actions_skipped', { length: 10 }),

    // Error details (if failed)
    errorMessage: text('error_message'),
    errorStack: text('error_stack'),
    errorActionId: varchar('error_action_id', { length: 50 }),
    errorActionIndex: varchar('error_action_index', { length: 10 }),

    // Artifacts
    videoPath: varchar('video_path', { length: 500 }),
    screenshotPath: varchar('screenshot_path', { length: 500 }),
    tracePath: varchar('trace_path', { length: 500 }), // Playwright trace

    // Audit timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Run's browser results (get all browsers for a run)
    index('run_browser_results_run_id_idx').on(table.runId),

    // Test's browser results (test detail page history)
    index('run_browser_results_test_id_idx').on(table.testId, table.createdAt),

    // User's results (authorization)
    index('run_browser_results_user_id_idx').on(table.userId),

    // Find failed results (dashboard alerts)
    index('run_browser_results_status_idx')
      .on(table.runId, table.status)
      .where(sql`${table.status} = 'failed'`),

    // Unique constraint: one result per run+test+browser
    index('run_browser_results_unique_idx').on(table.runId, table.testId, table.browser),
  ]
);

// Type exports
export type RunBrowserResult = typeof runBrowserResults.$inferSelect;
export type NewRunBrowserResult = typeof runBrowserResults.$inferInsert;
export type BrowserResultStatus = (typeof browserResultStatusEnum.enumValues)[number];
