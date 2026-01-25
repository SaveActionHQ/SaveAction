import { pgTable, uuid, varchar, timestamp, text, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

/**
 * Recordings table - Stored test recordings
 *
 * Enterprise considerations:
 * - Full recording JSON stored as JSONB (queryable)
 * - Tags as array for flexible categorization
 * - URL indexed for filtering by domain
 * - GIN index on tags for fast array queries
 * - GIN index on JSONB for deep queries
 * - Soft delete with proper indexing
 * - Version tracking for schema compatibility
 * - File size tracking for storage management
 */
export const recordings = pgTable(
  'recordings',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Owner reference
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Recording metadata (extracted for fast queries)
    name: varchar('name', { length: 255 }).notNull(),
    url: varchar('url', { length: 2048 }).notNull(), // Starting URL
    description: text('description'),

    // Original recording ID from extension (rec_xxx)
    originalId: varchar('original_id', { length: 50 }),

    // Tags for categorization (e.g., ["smoke", "checkout", "critical"])
    tags: text('tags').notNull().default('[]'), // JSON array as text

    // Full recording data as JSONB
    // Allows queries like: WHERE data->>'testName' = 'Login Flow'
    data: jsonb('data').notNull(),

    // Recording stats (extracted for fast listing)
    actionCount: varchar('action_count', { length: 10 }).notNull().default('0'),
    estimatedDurationMs: varchar('estimated_duration_ms', { length: 20 }),

    // Schema version for compatibility
    schemaVersion: varchar('schema_version', { length: 20 }).notNull().default('1.0.0'),

    // Storage tracking
    dataSizeBytes: varchar('data_size_bytes', { length: 20 }),

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
    // User's recordings (most common query)
    index('recordings_user_id_idx')
      .on(table.userId)
      .where(sql`${table.deletedAt} IS NULL`),

    // Search by name
    index('recordings_name_idx')
      .on(table.userId, table.name)
      .where(sql`${table.deletedAt} IS NULL`),

    // Filter by URL domain
    index('recordings_url_idx')
      .on(table.userId, table.url)
      .where(sql`${table.deletedAt} IS NULL`),

    // GIN index for tag array queries (contains, overlap)
    // Enables: WHERE tags @> '["smoke"]' or tags && '["smoke", "critical"]'
    index('recordings_tags_gin_idx').using('gin', sql`(${table.tags}::jsonb)`),

    // GIN index for JSONB deep queries
    // Enables: WHERE data @> '{"testName": "Login"}'
    index('recordings_data_gin_idx').using('gin', table.data),

    // Original ID lookup (for extension sync)
    index('recordings_original_id_idx')
      .on(table.originalId)
      .where(sql`${table.originalId} IS NOT NULL`),

    // Soft delete cleanup
    index('recordings_deleted_at_idx')
      .on(table.deletedAt)
      .where(sql`${table.deletedAt} IS NOT NULL`),

    // Recent recordings (dashboard, sorted by updated)
    index('recordings_updated_at_idx')
      .on(table.userId, table.updatedAt)
      .where(sql`${table.deletedAt} IS NULL`),
  ]
);

/**
 * Recording type inference
 */
export type Recording = typeof recordings.$inferSelect;
export type NewRecording = typeof recordings.$inferInsert;

/**
 * Recording data structure (for JSONB column)
 * This matches the Recording interface from @saveaction/core
 */
export interface RecordingData {
  id: string;
  testName: string;
  url: string;
  startTime: string;
  endTime?: string;
  viewport: { width: number; height: number };
  windowSize?: { width: number; height: number };
  screenSize?: { width: number; height: number };
  devicePixelRatio?: number;
  userAgent: string;
  actions: unknown[]; // Full action array
  version: string;
}
