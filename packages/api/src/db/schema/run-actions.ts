import { pgTable, uuid, varchar, timestamp, text, index, pgEnum } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { runs } from './runs.js';

/**
 * Action result status enum
 */
export const actionStatusEnum = pgEnum('action_status', [
  'success', // Action completed successfully
  'failed', // Action failed with error
  'skipped', // Action skipped (optional action not found)
  'timeout', // Action timed out
]);

/**
 * Run Actions table - Per-action execution results
 *
 * Enterprise considerations:
 * - Detailed per-action tracking
 * - Screenshot per action (optional)
 * - Timing metrics for performance analysis
 * - Retry count tracking
 * - Selector used tracking (for debugging)
 * - High-volume table - optimized for bulk inserts
 * - Partitioning-ready (by run_id)
 */
export const runActions = pgTable(
  'run_actions',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Run reference (cascade delete when run is deleted)
    runId: uuid('run_id')
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),

    // Action identification (from recording)
    actionId: varchar('action_id', { length: 50 }).notNull(), // act_001, act_002
    actionType: varchar('action_type', { length: 50 }).notNull(), // click, input, etc.
    actionIndex: varchar('action_index', { length: 10 }).notNull(), // Execution order

    // Execution result
    status: actionStatusEnum('status').notNull(),

    // Timing metrics
    durationMs: varchar('duration_ms', { length: 20 }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),

    // Selector tracking (which strategy succeeded)
    selectorUsed: varchar('selector_used', { length: 50 }), // css, xpath, text, etc.
    selectorValue: text('selector_value'), // Actual selector that worked

    // Retry tracking
    retryCount: varchar('retry_count', { length: 10 }).default('0'),
    retriedSelectors: text('retried_selectors'), // JSON array of attempted selectors

    // Error details (if failed)
    errorMessage: text('error_message'),
    errorStack: text('error_stack'),

    // Artifact paths
    screenshotPath: varchar('screenshot_path', { length: 500 }),
    screenshotBefore: varchar('screenshot_before', { length: 500 }), // Before action
    screenshotAfter: varchar('screenshot_after', { length: 500 }), // After action

    // Element details (for debugging)
    elementFound: varchar('element_found', { length: 10 }).default('true'),
    elementVisible: varchar('element_visible', { length: 10 }),
    elementTagName: varchar('element_tag_name', { length: 50 }),

    // Page state
    pageUrl: varchar('page_url', { length: 2048 }),
    pageTitle: varchar('page_title', { length: 500 }),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // All actions for a run (main query)
    index('run_actions_run_id_idx').on(table.runId, table.actionIndex),

    // Failed actions (debugging view)
    index('run_actions_failed_idx')
      .on(table.runId, table.status)
      .where(sql`${table.status} = 'failed'`),

    // Action type analytics
    index('run_actions_type_idx').on(table.actionType),

    // Performance analysis (slow actions)
    index('run_actions_duration_idx')
      .on(table.durationMs)
      .where(sql`${table.durationMs} IS NOT NULL`),
  ]
);

/**
 * Run Action type inference
 */
export type RunAction = typeof runActions.$inferSelect;
export type NewRunAction = typeof runActions.$inferInsert;
export type ActionStatus = (typeof actionStatusEnum.enumValues)[number];
