import { pgTable, uuid, varchar, timestamp, text, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

/**
 * API Tokens table - For programmatic API access
 *
 * Enterprise considerations:
 * - Token hash stored, never raw token (security)
 * - Prefix format: sa_live_xxx or sa_test_xxx
 * - Scopes for fine-grained permissions (resource:action)
 * - Project-level access control (hybrid: all projects or specific ones)
 * - Usage tracking (last_used_at, use_count)
 * - Expiration support
 * - Multiple tokens per user
 * - Revocation support
 */
export const apiTokens = pgTable(
  'api_tokens',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Owner reference
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Token identification
    name: varchar('name', { length: 255 }).notNull(), // "CI Token", "Local Dev"
    tokenHash: varchar('token_hash', { length: 255 }).notNull(), // SHA-256 hash

    // Token prefix for identification (stored for display: "sa_live_abc...xyz")
    tokenPrefix: varchar('token_prefix', { length: 20 }).notNull(),
    tokenSuffix: varchar('token_suffix', { length: 8 }).notNull(), // Last 4 chars for identification

    // Permissions - JSON array of scopes
    // ["recordings:read", "recordings:write", "runs:execute", "runs:read", "projects:read", ...]
    scopes: text('scopes').notNull().default('[]'),

    // Project access control - JSON array of project UUIDs or ["*"] for all projects
    // ["*"] = all projects (default), ["uuid1", "uuid2"] = specific projects only
    projectIds: text('project_ids').notNull().default('["*"]'),

    // Usage tracking
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    lastUsedIp: varchar('last_used_ip', { length: 45 }),
    useCount: varchar('use_count', { length: 20 }).notNull().default('0'),

    // Expiration (null = never expires)
    expiresAt: timestamp('expires_at', { withTimezone: true }),

    // Revocation
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedReason: varchar('revoked_reason', { length: 255 }),

    // Audit timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Fast token lookup by hash (most common operation)
    uniqueIndex('api_tokens_token_hash_unique_idx').on(table.tokenHash),

    // List tokens by user (dashboard view)
    index('api_tokens_user_id_idx').on(table.userId),

    // Active tokens only (exclude revoked/expired)
    index('api_tokens_active_idx')
      .on(table.userId, table.expiresAt)
      .where(sql`${table.revokedAt} IS NULL`),

    // Cleanup expired tokens
    index('api_tokens_expires_at_idx')
      .on(table.expiresAt)
      .where(sql`${table.expiresAt} IS NOT NULL`),
  ]
);

/**
 * API Token type inference
 */
export type ApiToken = typeof apiTokens.$inferSelect;
export type NewApiToken = typeof apiTokens.$inferInsert;
