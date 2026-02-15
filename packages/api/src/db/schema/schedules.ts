import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  index,
  boolean,
  pgEnum,
  jsonb,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { projects } from './projects.js';
import { recordings } from './recordings.js';

/**
 * Schedule status enum
 */
export const scheduleStatusEnum = pgEnum('schedule_status', [
  'active', // Schedule is running on cron
  'paused', // Temporarily paused (user action)
  'disabled', // Permanently disabled
  'expired', // Past end date
]);

/**
 * Schedules table - Cron-scheduled test runs
 *
 * Enterprise considerations:
 * - BullMQ repeatable job integration
 * - Flexible cron expressions (6-field for seconds support)
 * - Timezone-aware scheduling
 * - Run history tracking (last run, next run)
 * - Rate limiting (max concurrent, max daily runs)
 * - Pause/resume capability
 * - Soft delete with audit trail
 * - Multi-browser scheduling
 */
export const schedules = pgTable(
  'schedules',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Ownership
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Project reference (required for organization)
    // Denormalized from recording for direct querying
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    // What to run
    recordingId: uuid('recording_id')
      .notNull()
      .references(() => recordings.id, { onDelete: 'cascade' }),

    // Schedule metadata
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),

    // Cron configuration
    // Format: "* * * * * *" (second minute hour day month weekday)
    // Or standard: "* * * * *" (minute hour day month weekday)
    cronExpression: varchar('cron_expression', { length: 100 }).notNull(),
    timezone: varchar('timezone', { length: 100 }).notNull().default('UTC'),

    // Status
    status: scheduleStatusEnum('status').notNull().default('active'),

    // Time bounds (optional)
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),

    // BullMQ integration
    bullmqJobKey: varchar('bullmq_job_key', { length: 255 }), // Repeatable job key
    bullmqJobPattern: varchar('bullmq_job_pattern', { length: 255 }), // Pattern for removal

    // Execution configuration (stored as JSONB for flexibility)
    runConfig: jsonb('run_config').$type<{
      browser?: 'chromium' | 'firefox' | 'webkit';
      headless?: boolean;
      timeout?: number;
      viewport?: { width: number; height: number };
      retries?: number;
      environment?: Record<string, string>;
      tags?: string[];
      recordVideo?: boolean;
      screenshotMode?: 'on-failure' | 'always' | 'never';
    }>(),

    // Rate limiting
    maxConcurrent: varchar('max_concurrent', { length: 10 }).default('1'),
    maxDailyRuns: varchar('max_daily_runs', { length: 10 }),
    runsToday: varchar('runs_today', { length: 10 }).default('0'),
    runsThisMonth: varchar('runs_this_month', { length: 10 }).default('0'),

    // Run tracking
    lastRunId: uuid('last_run_id'),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    lastRunStatus: varchar('last_run_status', { length: 50 }),
    nextRunAt: timestamp('next_run_at', { withTimezone: true }),
    totalRuns: varchar('total_runs', { length: 20 }).default('0'),
    successfulRuns: varchar('successful_runs', { length: 20 }).default('0'),
    failedRuns: varchar('failed_runs', { length: 20 }).default('0'),

    // Notifications
    notifyOnFailure: boolean('notify_on_failure').default(true),
    notifyOnSuccess: boolean('notify_on_success').default(false),
    notificationEmails: text('notification_emails'), // Comma-separated emails

    // Soft delete
    deletedAt: timestamp('deleted_at', { withTimezone: true }),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // User's schedules (dashboard view)
    index('schedules_user_id_idx')
      .on(table.userId)
      .where(sql`${table.deletedAt} IS NULL`),

    // Project's schedules (required for project filtering)
    index('schedules_project_id_idx')
      .on(table.projectId)
      .where(sql`${table.deletedAt} IS NULL`),

    // Active schedules for cron processing
    index('schedules_active_idx')
      .on(table.status, table.nextRunAt)
      .where(sql`${table.status} = 'active' AND ${table.deletedAt} IS NULL`),

    // Recording's schedules
    index('schedules_recording_id_idx')
      .on(table.recordingId)
      .where(sql`${table.deletedAt} IS NULL`),

    // BullMQ job lookup
    index('schedules_bullmq_job_key_idx')
      .on(table.bullmqJobKey)
      .where(sql`${table.bullmqJobKey} IS NOT NULL`),

    // Due schedules (for cron job runner)
    index('schedules_next_run_idx')
      .on(table.nextRunAt)
      .where(sql`${table.status} = 'active' AND ${table.deletedAt} IS NULL`),
  ]
);

/**
 * Schedule type inference
 */
export type Schedule = typeof schedules.$inferSelect;
export type NewSchedule = typeof schedules.$inferInsert;
export type ScheduleStatus = (typeof scheduleStatusEnum.enumValues)[number];
