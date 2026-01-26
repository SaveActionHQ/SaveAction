/**
 * User Repository
 *
 * Data access layer for user-related database operations.
 * Uses Drizzle ORM for type-safe queries.
 */

import { eq, sql, and, isNull } from 'drizzle-orm';
import { users, type User } from '../db/schema/users.js';
import type { Database } from '../db/index.js';

/**
 * User update data (partial, excludes password)
 */
export interface UserUpdateData {
  name?: string | null;
  emailVerifiedAt?: Date | null;
  failedLoginAttempts?: string;
  lockedUntil?: Date | null;
  lastLoginAt?: Date | null;
  lastLoginIp?: string | null;
  isActive?: boolean;
  deletedAt?: Date | null;
}

/**
 * User creation data
 */
export interface UserCreateData {
  email: string;
  passwordHash: string;
  name?: string | null;
}

/**
 * User with password hash (for internal use only)
 */
export type UserWithPassword = User;

/**
 * Safe user (without password hash)
 */
export type SafeUser = Omit<User, 'passwordHash'>;

/**
 * User Repository class
 */
export class UserRepository {
  constructor(private readonly db: Database) {}

  /**
   * Find a user by ID (active users only)
   */
  async findById(id: string): Promise<SafeUser | null> {
    const result = await this.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        emailVerifiedAt: users.emailVerifiedAt,
        failedLoginAttempts: users.failedLoginAttempts,
        lockedUntil: users.lockedUntil,
        lastLoginAt: users.lastLoginAt,
        lastLoginIp: users.lastLoginIp,
        isActive: users.isActive,
        deletedAt: users.deletedAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Find a user by ID including password hash (for authentication)
   */
  async findByIdWithPassword(id: string): Promise<UserWithPassword | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Find a user by email (case-insensitive, active users only)
   */
  async findByEmail(email: string): Promise<SafeUser | null> {
    const normalizedEmail = email.toLowerCase().trim();

    const result = await this.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        emailVerifiedAt: users.emailVerifiedAt,
        failedLoginAttempts: users.failedLoginAttempts,
        lockedUntil: users.lockedUntil,
        lastLoginAt: users.lastLoginAt,
        lastLoginIp: users.lastLoginIp,
        isActive: users.isActive,
        deletedAt: users.deletedAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(and(eq(sql`LOWER(${users.email})`, normalizedEmail), isNull(users.deletedAt)))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Find a user by email including password hash (for authentication)
   */
  async findByEmailWithPassword(email: string): Promise<UserWithPassword | null> {
    const normalizedEmail = email.toLowerCase().trim();

    const result = await this.db
      .select()
      .from(users)
      .where(and(eq(sql`LOWER(${users.email})`, normalizedEmail), isNull(users.deletedAt)))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Check if email exists (for registration validation)
   */
  async emailExists(email: string): Promise<boolean> {
    const normalizedEmail = email.toLowerCase().trim();

    const result = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(sql`LOWER(${users.email})`, normalizedEmail))
      .limit(1);

    return result.length > 0;
  }

  /**
   * Create a new user
   */
  async create(data: UserCreateData): Promise<SafeUser> {
    const result = await this.db
      .insert(users)
      .values({
        email: data.email.toLowerCase().trim(),
        passwordHash: data.passwordHash,
        name: data.name || null,
      })
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        emailVerifiedAt: users.emailVerifiedAt,
        failedLoginAttempts: users.failedLoginAttempts,
        lockedUntil: users.lockedUntil,
        lastLoginAt: users.lastLoginAt,
        lastLoginIp: users.lastLoginIp,
        isActive: users.isActive,
        deletedAt: users.deletedAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    return result[0];
  }

  /**
   * Update user data
   */
  async update(id: string, data: UserUpdateData): Promise<SafeUser | null> {
    const result = await this.db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        emailVerifiedAt: users.emailVerifiedAt,
        failedLoginAttempts: users.failedLoginAttempts,
        lockedUntil: users.lockedUntil,
        lastLoginAt: users.lastLoginAt,
        lastLoginIp: users.lastLoginIp,
        isActive: users.isActive,
        deletedAt: users.deletedAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    return result[0] || null;
  }

  /**
   * Update password hash
   */
  async updatePassword(id: string, passwordHash: string): Promise<boolean> {
    const result = await this.db
      .update(users)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, id), isNull(users.deletedAt)));

    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Update last login info
   */
  async updateLastLogin(id: string, ip: string | null): Promise<void> {
    await this.db
      .update(users)
      .set({
        lastLoginAt: new Date(),
        lastLoginIp: ip,
        failedLoginAttempts: '0',
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
  }

  /**
   * Increment failed login attempts
   */
  async incrementFailedAttempts(id: string): Promise<number> {
    const result = await this.db
      .update(users)
      .set({
        failedLoginAttempts: sql`CAST(CAST(${users.failedLoginAttempts} AS INTEGER) + 1 AS VARCHAR)`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning({ failedLoginAttempts: users.failedLoginAttempts });

    return parseInt(result[0]?.failedLoginAttempts || '0', 10);
  }

  /**
   * Lock user account
   */
  async lockAccount(id: string, lockDuration: number): Promise<void> {
    const lockedUntil = new Date(Date.now() + lockDuration * 1000);

    await this.db
      .update(users)
      .set({
        lockedUntil,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
  }

  /**
   * Unlock user account
   */
  async unlockAccount(id: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        lockedUntil: null,
        failedLoginAttempts: '0',
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
  }

  /**
   * Soft delete user
   */
  async softDelete(id: string): Promise<boolean> {
    const result = await this.db
      .update(users)
      .set({
        deletedAt: new Date(),
        isActive: false,
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, id), isNull(users.deletedAt)));

    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Restore soft-deleted user
   */
  async restore(id: string): Promise<SafeUser | null> {
    const result = await this.db
      .update(users)
      .set({
        deletedAt: null,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        emailVerifiedAt: users.emailVerifiedAt,
        failedLoginAttempts: users.failedLoginAttempts,
        lockedUntil: users.lockedUntil,
        lastLoginAt: users.lastLoginAt,
        lastLoginIp: users.lastLoginIp,
        isActive: users.isActive,
        deletedAt: users.deletedAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    return result[0] || null;
  }

  /**
   * Verify email
   */
  async verifyEmail(id: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        emailVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, id), isNull(users.emailVerifiedAt)));
  }
}
