/**
 * API Token Repository
 *
 * Data access layer for API token operations.
 * Uses Drizzle ORM for type-safe queries.
 */

import { eq, and, isNull, sql, desc } from 'drizzle-orm';
import { apiTokens, type ApiToken } from '../db/schema/api-tokens.js';
import type { Database } from '../db/index.js';

/**
 * API Token creation data
 */
export interface ApiTokenCreateData {
  userId: string;
  name: string;
  tokenHash: string;
  tokenPrefix: string;
  tokenSuffix: string;
  scopes: string[];
  expiresAt?: Date | null;
}

/**
 * API Token response (without hash)
 */
export interface SafeApiToken {
  id: string;
  userId: string;
  name: string;
  tokenPrefix: string;
  tokenSuffix: string;
  scopes: string[];
  lastUsedAt: Date | null;
  lastUsedIp: string | null;
  useCount: number;
  expiresAt: Date | null;
  revokedAt: Date | null;
  revokedReason: string | null;
  createdAt: Date;
}

/**
 * API Token with hash (for internal validation)
 */
export interface ApiTokenWithHash extends SafeApiToken {
  tokenHash: string;
}

/**
 * Convert raw DB result to SafeApiToken
 */
function toSafeToken(token: ApiToken): SafeApiToken {
  return {
    id: token.id,
    userId: token.userId,
    name: token.name,
    tokenPrefix: token.tokenPrefix,
    tokenSuffix: token.tokenSuffix,
    scopes: JSON.parse(token.scopes) as string[],
    lastUsedAt: token.lastUsedAt,
    lastUsedIp: token.lastUsedIp,
    useCount: parseInt(token.useCount, 10),
    expiresAt: token.expiresAt,
    revokedAt: token.revokedAt,
    revokedReason: token.revokedReason,
    createdAt: token.createdAt,
  };
}

/**
 * Convert raw DB result to ApiTokenWithHash
 */
function toTokenWithHash(token: ApiToken): ApiTokenWithHash {
  return {
    ...toSafeToken(token),
    tokenHash: token.tokenHash,
  };
}

/**
 * API Token Repository class
 */
export class ApiTokenRepository {
  constructor(private readonly db: Database) {}

  /**
   * Create a new API token
   */
  async create(data: ApiTokenCreateData): Promise<SafeApiToken> {
    const result = await this.db
      .insert(apiTokens)
      .values({
        userId: data.userId,
        name: data.name,
        tokenHash: data.tokenHash,
        tokenPrefix: data.tokenPrefix,
        tokenSuffix: data.tokenSuffix,
        scopes: JSON.stringify(data.scopes),
        expiresAt: data.expiresAt || null,
      })
      .returning();

    return toSafeToken(result[0]);
  }

  /**
   * Find a token by ID (active tokens only)
   */
  async findById(id: string): Promise<SafeApiToken | null> {
    const result = await this.db.select().from(apiTokens).where(eq(apiTokens.id, id)).limit(1);

    return result[0] ? toSafeToken(result[0]) : null;
  }

  /**
   * Find a token by hash (for authentication)
   * Returns active, non-revoked, non-expired tokens only
   */
  async findByHash(tokenHash: string): Promise<ApiTokenWithHash | null> {
    const now = new Date();

    const result = await this.db
      .select()
      .from(apiTokens)
      .where(
        and(
          eq(apiTokens.tokenHash, tokenHash),
          isNull(apiTokens.revokedAt),
          // Either no expiration or not yet expired
          sql`(${apiTokens.expiresAt} IS NULL OR ${apiTokens.expiresAt} > ${now})`
        )
      )
      .limit(1);

    return result[0] ? toTokenWithHash(result[0]) : null;
  }

  /**
   * List all tokens for a user (including revoked)
   */
  async findByUserId(userId: string): Promise<SafeApiToken[]> {
    const result = await this.db
      .select()
      .from(apiTokens)
      .where(eq(apiTokens.userId, userId))
      .orderBy(desc(apiTokens.createdAt));

    return result.map(toSafeToken);
  }

  /**
   * List active tokens for a user (non-revoked, non-expired)
   */
  async findActiveByUserId(userId: string): Promise<SafeApiToken[]> {
    const now = new Date();

    const result = await this.db
      .select()
      .from(apiTokens)
      .where(
        and(
          eq(apiTokens.userId, userId),
          isNull(apiTokens.revokedAt),
          sql`(${apiTokens.expiresAt} IS NULL OR ${apiTokens.expiresAt} > ${now})`
        )
      )
      .orderBy(desc(apiTokens.createdAt));

    return result.map(toSafeToken);
  }

  /**
   * Update token usage (last used time, IP, increment count)
   */
  async recordUsage(id: string, ip?: string | null): Promise<void> {
    await this.db
      .update(apiTokens)
      .set({
        lastUsedAt: new Date(),
        lastUsedIp: ip || null,
        useCount: sql`CAST(${apiTokens.useCount} AS INTEGER) + 1`,
      })
      .where(eq(apiTokens.id, id));
  }

  /**
   * Revoke a token
   */
  async revoke(id: string, reason?: string | null): Promise<SafeApiToken | null> {
    const result = await this.db
      .update(apiTokens)
      .set({
        revokedAt: new Date(),
        revokedReason: reason || null,
      })
      .where(and(eq(apiTokens.id, id), isNull(apiTokens.revokedAt)))
      .returning();

    return result[0] ? toSafeToken(result[0]) : null;
  }

  /**
   * Hard delete a token (for cleanup)
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.db.delete(apiTokens).where(eq(apiTokens.id, id)).returning();

    return result.length > 0;
  }

  /**
   * Delete all tokens for a user (for account deletion)
   */
  async deleteAllForUser(userId: string): Promise<number> {
    const result = await this.db.delete(apiTokens).where(eq(apiTokens.userId, userId)).returning();

    return result.length;
  }

  /**
   * Count active tokens for a user
   */
  async countActiveByUserId(userId: string): Promise<number> {
    const now = new Date();

    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(apiTokens)
      .where(
        and(
          eq(apiTokens.userId, userId),
          isNull(apiTokens.revokedAt),
          sql`(${apiTokens.expiresAt} IS NULL OR ${apiTokens.expiresAt} > ${now})`
        )
      );

    return result[0]?.count || 0;
  }

  /**
   * Check if a token belongs to a user
   */
  async belongsToUser(tokenId: string, userId: string): Promise<boolean> {
    const result = await this.db
      .select({ id: apiTokens.id })
      .from(apiTokens)
      .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, userId)))
      .limit(1);

    return result.length > 0;
  }
}
