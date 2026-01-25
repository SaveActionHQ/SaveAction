import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Users table - Core user accounts
 *
 * Enterprise considerations:
 * - UUID v4 for security (non-enumerable)
 * - Email uniqueness with case-insensitive index
 * - Account lockout support for brute-force protection
 * - Email verification tracking
 * - Soft delete support with deleted_at
 * - Audit timestamps (created_at, updated_at)
 */
export const users = pgTable(
  'users',
  {
    // Primary key - UUID for security
    id: uuid('id').primaryKey().defaultRandom(),

    // Identity
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }),

    // Email verification
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),

    // Account lockout (brute-force protection)
    failedLoginAttempts: varchar('failed_login_attempts', { length: 10 }).notNull().default('0'),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    lastLoginIp: varchar('last_login_ip', { length: 45 }), // IPv6 max length

    // Account status
    isActive: boolean('is_active').notNull().default(true),

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
    // Case-insensitive unique email (PostgreSQL LOWER function)
    uniqueIndex('users_email_unique_idx').on(sql`LOWER(${table.email})`),

    // Soft delete filter - most queries exclude deleted users
    index('users_active_idx')
      .on(table.isActive)
      .where(sql`${table.deletedAt} IS NULL`),

    // Login attempt tracking for lockout queries
    index('users_locked_until_idx')
      .on(table.lockedUntil)
      .where(sql`${table.lockedUntil} IS NOT NULL`),
  ]
);

/**
 * User type inference for TypeScript
 */
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
