import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  boolean,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { projects } from './projects.js';
import { recordings } from './recordings.js';
import { tests } from './tests.js';
import { testSuites } from './test-suites.js';

/**
 * Run status enum - PostgreSQL native enum for type safety and performance
 */
export const runStatusEnum = pgEnum('run_status', [
  'queued', // Waiting in BullMQ queue
  'running', // Currently executing
  'passed', // All actions successful
  'failed', // One or more actions failed
  'cancelled', // Manually cancelled or timeout
  'skipped', // Skipped (e.g., dependency failed)
]);

/**
 * Browser enum - Supported browsers
 */
export const browserEnum = pgEnum('browser_type', ['chromium', 'firefox', 'webkit']);

/**
 * Run type enum - What kind of run this is
 */
export const runTypeEnum = pgEnum('run_type', [
  'test', // Single test run
  'suite', // All tests in a suite
  'project', // All tests in a project
  'recording', // Legacy: single recording run
]);

/**
 * Runs table - Test execution history
 *
 * Enterprise considerations:
 * - Support for test/suite/project runs
 * - Browser results stored in run_browser_results table
 * - Legacy recording support maintained
 * - Status enum for type safety
 * - BullMQ job tracking (job_id, queue_name)
 * - Full execution configuration stored
 * - Video/screenshot path tracking
 * - Error details with stack trace
 * - Timing metrics for analytics
 * - Partitioning-ready (by created_at)
 * - Soft delete support
 */
export const runs = pgTable(
  'runs',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Owner reference
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Project reference (required for organization)
    // Denormalized from recording for direct querying
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    // Recording reference (nullable for deleted recordings - LEGACY)
    recordingId: uuid('recording_id').references(() => recordings.id, {
      onDelete: 'set null',
    }),

    // Recording snapshot (name at time of run, for deleted recordings)
    recordingName: varchar('recording_name', { length: 255 }),
    recordingUrl: varchar('recording_url', { length: 2048 }),

    // NEW: Test/Suite references for new architecture
    runType: runTypeEnum('run_type').default('recording'),

    // Test reference (for single test runs)
    testId: uuid('test_id').references(() => tests.id, {
      onDelete: 'set null',
    }),

    // Suite reference (for suite-level runs)
    suiteId: uuid('suite_id').references(() => testSuites.id, {
      onDelete: 'set null',
    }),

    // Parent run reference (for child runs of a suite run)
    parentRunId: uuid('parent_run_id'),

    // Test snapshot (name at time of run, for deleted tests)
    testName: varchar('test_name', { length: 255 }),
    testSlug: varchar('test_slug', { length: 255 }),

    // Execution status
    status: runStatusEnum('status').notNull().default('queued'),

    // BullMQ integration
    jobId: varchar('job_id', { length: 100 }), // BullMQ job ID
    queueName: varchar('queue_name', { length: 50 }).default('test-runs'),

    // Execution configuration
    browser: browserEnum('browser').notNull().default('chromium'),
    headless: boolean('headless').notNull().default(true),
    videoEnabled: boolean('video_enabled').notNull().default(false),
    screenshotEnabled: boolean('screenshot_enabled').notNull().default(false),
    timeout: varchar('timeout', { length: 20 }).notNull().default('30000'),

    // Timing configuration
    timingEnabled: boolean('timing_enabled').notNull().default(true),
    timingMode: varchar('timing_mode', { length: 20 }).default('realistic'),
    speedMultiplier: varchar('speed_multiplier', { length: 10 }).default('1.0'),

    // Execution results
    actionsTotal: varchar('actions_total', { length: 10 }),
    actionsExecuted: varchar('actions_executed', { length: 10 }),
    actionsFailed: varchar('actions_failed', { length: 10 }),
    actionsSkipped: varchar('actions_skipped', { length: 10 }),

    // Duration tracking
    durationMs: varchar('duration_ms', { length: 20 }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),

    // Artifacts
    videoPath: varchar('video_path', { length: 500 }),
    screenshotPaths: text('screenshot_paths'), // JSON array

    // Error details
    errorMessage: text('error_message'),
    errorStack: text('error_stack'),
    errorActionId: varchar('error_action_id', { length: 50 }),

    // Trigger source
    triggeredBy: varchar('triggered_by', { length: 50 }).notNull().default('manual'),
    // 'manual' | 'schedule' | 'api' | 'webhook' | 'ci'
    scheduleId: uuid('schedule_id'), // If triggered by schedule

    // CI/CD metadata (for external runs)
    ciMetadata: text('ci_metadata'), // JSON: { provider, commit, branch, pr, workflow }

    // Soft delete
    deletedAt: timestamp('deleted_at', { withTimezone: true }),

    // Audit timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // User's runs (dashboard view)
    index('runs_user_id_idx')
      .on(table.userId, table.createdAt)
      .where(sql`${table.deletedAt} IS NULL`),

    // Project's runs (required for project filtering)
    index('runs_project_id_idx')
      .on(table.projectId, table.createdAt)
      .where(sql`${table.deletedAt} IS NULL`),

    // Recording's runs (recording detail view) - LEGACY
    index('runs_recording_id_idx')
      .on(table.recordingId, table.createdAt)
      .where(sql`${table.deletedAt} IS NULL`),

    // Test's runs (test detail view) - NEW
    index('runs_test_id_idx')
      .on(table.testId, table.createdAt)
      .where(sql`${table.deletedAt} IS NULL`),

    // Suite's runs (suite runs history) - NEW
    index('runs_suite_id_idx')
      .on(table.suiteId, table.createdAt)
      .where(sql`${table.deletedAt} IS NULL`),

    // Parent run's children (suite run detail view)
    index('runs_parent_run_id_idx')
      .on(table.parentRunId, table.createdAt)
      .where(sql`${table.deletedAt} IS NULL`),

    // Run type filtering - NEW
    index('runs_run_type_idx')
      .on(table.projectId, table.runType)
      .where(sql`${table.deletedAt} IS NULL`),

    // Status filtering (find running/failed)
    index('runs_status_idx')
      .on(table.userId, table.status)
      .where(sql`${table.deletedAt} IS NULL`),

    // BullMQ job lookup
    index('runs_job_id_idx')
      .on(table.jobId)
      .where(sql`${table.jobId} IS NOT NULL`),

    // Running runs (for cleanup on restart)
    index('runs_running_idx')
      .on(table.status, table.startedAt)
      .where(sql`${table.status} = 'running'`),

    // Recent runs (analytics, sorted)
    index('runs_created_at_idx').on(table.createdAt),

    // Schedule runs tracking
    index('runs_schedule_id_idx')
      .on(table.scheduleId)
      .where(sql`${table.scheduleId} IS NOT NULL`),

    // Soft delete cleanup
    index('runs_deleted_at_idx')
      .on(table.deletedAt)
      .where(sql`${table.deletedAt} IS NOT NULL`),
  ]
);

/**
 * Run type inference
 */
export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;
export type RunStatus = (typeof runStatusEnum.enumValues)[number];
export type BrowserType = (typeof browserEnum.enumValues)[number];
export type RunType = (typeof runTypeEnum.enumValues)[number];
