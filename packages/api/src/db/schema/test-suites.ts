import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { projects } from './projects.js';

/**
 * Test Suites table - Logical grouping of tests within a project
 *
 * Hierarchy: Project → Test Suite → Tests
 *
 * Design principles:
 * - Each project has a default "Unorganized" suite
 * - Suites can be reordered via displayOrder
 * - Soft delete with cascade consideration for tests
 *
 * Use cases:
 * - Group tests by feature (Checkout Flow, User Auth)
 * - Group tests by test type (Smoke, Regression)
 * - Group tests by page/module
 */
export const testSuites = pgTable(
  'test_suites',
  {
    // Primary key - UUID for consistency with other tables
    id: uuid('id').primaryKey().defaultRandom(),

    // Owner reference (denormalized for authorization)
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Project reference
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    // Suite metadata
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),

    // Display ordering within project
    displayOrder: integer('display_order').notNull().default(0),

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
    // Project's suites (most common query)
    index('test_suites_project_id_idx')
      .on(table.projectId, table.displayOrder)
      .where(sql`${table.deletedAt} IS NULL`),

    // User's suites (authorization check)
    index('test_suites_user_id_idx')
      .on(table.userId)
      .where(sql`${table.deletedAt} IS NULL`),

    // Unique suite name per project (case-insensitive)
    uniqueIndex('test_suites_project_name_unique_idx')
      .on(table.projectId, sql`LOWER(${table.name})`)
      .where(sql`${table.deletedAt} IS NULL`),
  ]
);

// Type exports
export type TestSuite = typeof testSuites.$inferSelect;
export type NewTestSuite = typeof testSuites.$inferInsert;
