import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

/**
 * Projects table - Top-level container for grouping recordings
 *
 * Design principles:
 * - Every user gets a default project ("My Tests") on signup
 * - Default project is hidden in UI if user has only one project
 * - Recordings belong to exactly one project
 * - Soft delete with cascade to child entities
 * - Slug is unique per user, used in URLs (like GitHub org slugs)
 *
 * Use cases:
 * - Enterprise: Separate project per product (E-commerce, Mobile App)
 * - Agency: Separate project per client
 * - Personal: Use default project, ignore the feature
 */
export const projects = pgTable(
  'projects',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Owner reference
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Project metadata
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    description: text('description'),

    // UI customization
    color: varchar('color', { length: 7 }), // Hex color for UI (#FF5733)

    // Default project flag
    // Each user has exactly one default project (created on signup)
    // Default project cannot be deleted
    isDefault: boolean('is_default').notNull().default(false),

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
    // User's projects (most common query)
    index('projects_user_id_idx')
      .on(table.userId)
      .where(sql`${table.deletedAt} IS NULL`),

    // Unique project name per user (case-insensitive)
    uniqueIndex('projects_user_name_unique_idx').on(table.userId, sql`LOWER(${table.name})`),

    // Unique slug per user (case-insensitive, used in URLs)
    uniqueIndex('projects_user_slug_unique_idx').on(table.userId, sql`LOWER(${table.slug})`),

    // Find default project for user
    index('projects_user_default_idx')
      .on(table.userId, table.isDefault)
      .where(sql`${table.isDefault} = true AND ${table.deletedAt} IS NULL`),

    // Soft delete cleanup
    index('projects_deleted_at_idx')
      .on(table.deletedAt)
      .where(sql`${table.deletedAt} IS NOT NULL`),
  ]
);

/**
 * Project type inference
 */
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

/**
 * Default project name constant
 */
export const DEFAULT_PROJECT_NAME = 'My Tests';

/**
 * Default project slug constant
 */
export const DEFAULT_PROJECT_SLUG = 'my-tests';

/**
 * Generate a URL-safe slug from a string.
 * Converts to lowercase, replaces non-alphanumeric chars with hyphens,
 * collapses multiple hyphens, and trims leading/trailing hyphens.
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Slug validation regex: lowercase letters, numbers, hyphens only.
 * Must start and end with letter/number. 1-255 chars.
 */
export const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
