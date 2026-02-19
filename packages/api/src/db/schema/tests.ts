import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { projects } from './projects.js';
import { testSuites } from './test-suites.js';
import { recordings } from './recordings.js';

/**
 * Test configuration type - Saved run settings
 */
export interface TestConfig {
  headless: boolean;
  video: boolean;
  screenshot: 'on' | 'off' | 'only-on-failure';
  timeout: number; // ms
  retries: number;
  slowMo: number; // ms delay between actions
  viewport?: { width: number; height: number };
  /** Run browsers in parallel (true) or sequentially (false). Default: true */
  parallelBrowsers: boolean;
}

/**
 * Browser type - Playwright supported browsers
 */
export type BrowserType = 'chromium' | 'firefox' | 'webkit';

/**
 * Default test configuration
 */
export const DEFAULT_TEST_CONFIG: TestConfig = {
  headless: true,
  video: false,
  screenshot: 'only-on-failure',
  timeout: 30000,
  retries: 0,
  slowMo: 0,
  parallelBrowsers: true,
};

/**
 * Tests table - Recording + Configuration + Browser Selection
 *
 * Core concept: Test = Recording Data + Saved Config + Browser List
 * This enables one-click runs without reconfiguration.
 *
 * Design principles:
 * - Recording data is COPIED into test (not referenced)
 * - Browsers array allows multi-browser testing
 * - Config is JSONB for future extensibility
 * - Slug is human-readable, unique within project
 *
 * Use cases:
 * - One-click test execution with saved settings
 * - Multi-browser matrix testing (Chrome + Firefox + Safari)
 * - Re-record without losing configuration
 */
export const tests = pgTable(
  'tests',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Owner reference (denormalized for authorization)
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Project reference (denormalized for queries)
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    // Suite reference
    suiteId: uuid('suite_id')
      .notNull()
      .references(() => testSuites.id, { onDelete: 'cascade' }),

    // Library recording reference (nullable - for traceability back to library)
    // When a test is created, the recording is also stored in the recordings table.
    // recording_data is a frozen snapshot for execution; recordingId links to the library entry.
    recordingId: uuid('recording_id').references(() => recordings.id, { onDelete: 'set null' }),

    // Test metadata
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),

    // URL-friendly identifier (unique within project)
    // Auto-generated from name: "Add to Cart Test" → "add-to-cart-test"
    slug: varchar('slug', { length: 255 }).notNull(),

    // Recording data (JSONB - full copy of recording)
    // Contains: id, testName, url, actions, viewport, userAgent, etc.
    recordingData: jsonb('recording_data').notNull(),

    // Recording metadata (extracted for fast queries)
    recordingUrl: varchar('recording_url', { length: 2048 }), // Starting URL
    actionCount: integer('action_count').default(0),

    // Multi-browser configuration
    // Array of browsers to run: ['chromium', 'firefox', 'webkit']
    browsers: jsonb('browsers').$type<BrowserType[]>().notNull().default(['chromium']),

    // Saved test configuration (JSONB for extensibility)
    config: jsonb('config').$type<TestConfig>().notNull().default(DEFAULT_TEST_CONFIG),

    // Display ordering within suite
    displayOrder: integer('display_order').notNull().default(0),

    // Last run tracking (for quick display in UI)
    lastRunId: uuid('last_run_id'),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    lastRunStatus: varchar('last_run_status', { length: 50 }),

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
    // Suite's tests (most common query)
    index('tests_suite_id_idx')
      .on(table.suiteId, table.displayOrder)
      .where(sql`${table.deletedAt} IS NULL`),

    // Project's tests (for project-level queries)
    index('tests_project_id_idx')
      .on(table.projectId)
      .where(sql`${table.deletedAt} IS NULL`),

    // User's tests (authorization check)
    index('tests_user_id_idx')
      .on(table.userId)
      .where(sql`${table.deletedAt} IS NULL`),

    // Unique slug per project
    uniqueIndex('tests_project_slug_unique_idx')
      .on(table.projectId, table.slug)
      .where(sql`${table.deletedAt} IS NULL`),

    // Search by name (within project)
    index('tests_project_name_idx')
      .on(table.projectId, table.name)
      .where(sql`${table.deletedAt} IS NULL`),

    // Find tests by last run status (dashboard)
    index('tests_last_run_status_idx')
      .on(table.projectId, table.lastRunStatus)
      .where(sql`${table.deletedAt} IS NULL`),
  ]
);

// Type exports
export type Test = typeof tests.$inferSelect;
export type NewTest = typeof tests.$inferInsert;
