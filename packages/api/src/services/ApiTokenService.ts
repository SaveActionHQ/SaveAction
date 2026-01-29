/**
 * API Token Service
 *
 * Business logic for API token management.
 * Handles token generation, validation, listing, and revocation.
 */

import { createHash, randomBytes } from 'crypto';
import type { ApiTokenRepository, SafeApiToken } from '../repositories/ApiTokenRepository.js';
import {
  TOKEN_PREFIX_LIVE,
  type ApiTokenScope,
  type ApiTokenResponse,
  type ApiTokenCreateResponse,
  type ApiTokenListResponse,
  type ValidatedApiToken,
  type CreateTokenRequest,
} from '../auth/api-token-types.js';

/**
 * API Token Service Error
 */
export class ApiTokenError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'ApiTokenError';
  }
}

/**
 * Predefined API token errors
 */
export const ApiTokenErrors = {
  TOKEN_NOT_FOUND: new ApiTokenError('API token not found', 'TOKEN_NOT_FOUND', 404),
  TOKEN_INVALID: new ApiTokenError('Invalid API token', 'TOKEN_INVALID', 401),
  TOKEN_EXPIRED: new ApiTokenError('API token has expired', 'TOKEN_EXPIRED', 401),
  TOKEN_REVOKED: new ApiTokenError('API token has been revoked', 'TOKEN_REVOKED', 401),
  TOKEN_LIMIT_REACHED: new ApiTokenError(
    'Maximum number of active tokens reached',
    'TOKEN_LIMIT_REACHED',
    400
  ),
  INSUFFICIENT_SCOPE: new ApiTokenError('Insufficient token scope', 'INSUFFICIENT_SCOPE', 403),
  NOT_AUTHORIZED: new ApiTokenError('Not authorized to manage this token', 'NOT_AUTHORIZED', 403),
} as const;

/**
 * Service configuration
 */
export interface ApiTokenServiceConfig {
  /** Maximum active tokens per user (default: 10) */
  maxTokensPerUser: number;
  /** Token random bytes length (default: 32) */
  tokenLength: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ApiTokenServiceConfig = {
  maxTokensPerUser: 10,
  tokenLength: 32,
};

/**
 * Convert SafeApiToken to ApiTokenResponse
 */
function toResponse(token: SafeApiToken): ApiTokenResponse {
  return {
    id: token.id,
    name: token.name,
    tokenPrefix: token.tokenPrefix,
    tokenSuffix: token.tokenSuffix,
    scopes: token.scopes as ApiTokenScope[],
    lastUsedAt: token.lastUsedAt,
    useCount: token.useCount,
    expiresAt: token.expiresAt,
    revokedAt: token.revokedAt,
    createdAt: token.createdAt,
  };
}

/**
 * API Token Service class
 */
export class ApiTokenService {
  private readonly config: ApiTokenServiceConfig;

  constructor(
    private readonly tokenRepository: ApiTokenRepository,
    config?: Partial<ApiTokenServiceConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate a new API token
   *
   * Token format: sa_live_<32 random hex chars>
   * Total length: 8 (prefix) + 64 (hex) = 72 characters
   */
  async createToken(userId: string, data: CreateTokenRequest): Promise<ApiTokenCreateResponse> {
    // Check token limit
    const activeCount = await this.tokenRepository.countActiveByUserId(userId);
    if (activeCount >= this.config.maxTokensPerUser) {
      throw ApiTokenErrors.TOKEN_LIMIT_REACHED;
    }

    // Generate random token
    const randomPart = randomBytes(this.config.tokenLength).toString('hex');
    const fullToken = `${TOKEN_PREFIX_LIVE}${randomPart}`;

    // Hash for storage (SHA-256)
    const tokenHash = this.hashToken(fullToken);

    // Extract suffix for display (last 4 chars of random part)
    const tokenSuffix = randomPart.slice(-4);

    // Create token in database
    const token = await this.tokenRepository.create({
      userId,
      name: data.name,
      tokenHash,
      tokenPrefix: TOKEN_PREFIX_LIVE,
      tokenSuffix,
      scopes: data.scopes,
      expiresAt: data.expiresAt || null,
    });

    return {
      ...toResponse(token),
      token: fullToken, // Only returned on creation
    };
  }

  /**
   * Validate an API token and return its details
   * Also records usage
   */
  async validateToken(token: string, ip?: string): Promise<ValidatedApiToken> {
    // Check format
    if (!token.startsWith(TOKEN_PREFIX_LIVE)) {
      throw ApiTokenErrors.TOKEN_INVALID;
    }

    // Hash and lookup
    const tokenHash = this.hashToken(token);
    const dbToken = await this.tokenRepository.findByHash(tokenHash);

    if (!dbToken) {
      throw ApiTokenErrors.TOKEN_INVALID;
    }

    // Record usage asynchronously (don't await)
    this.tokenRepository.recordUsage(dbToken.id, ip).catch(() => {
      // Ignore usage recording errors
    });

    return {
      id: dbToken.id,
      userId: dbToken.userId,
      name: dbToken.name,
      scopes: dbToken.scopes as ApiTokenScope[],
    };
  }

  /**
   * List all tokens for a user
   */
  async listTokens(userId: string): Promise<ApiTokenListResponse> {
    const tokens = await this.tokenRepository.findByUserId(userId);

    return {
      tokens: tokens.map(toResponse),
      total: tokens.length,
    };
  }

  /**
   * List active tokens for a user
   */
  async listActiveTokens(userId: string): Promise<ApiTokenListResponse> {
    const tokens = await this.tokenRepository.findActiveByUserId(userId);

    return {
      tokens: tokens.map(toResponse),
      total: tokens.length,
    };
  }

  /**
   * Get a specific token by ID
   * User must own the token
   */
  async getToken(tokenId: string, userId: string): Promise<ApiTokenResponse> {
    const token = await this.tokenRepository.findById(tokenId);

    if (!token) {
      throw ApiTokenErrors.TOKEN_NOT_FOUND;
    }

    if (token.userId !== userId) {
      throw ApiTokenErrors.NOT_AUTHORIZED;
    }

    return toResponse(token);
  }

  /**
   * Revoke a token
   * User must own the token
   */
  async revokeToken(tokenId: string, userId: string, reason?: string): Promise<ApiTokenResponse> {
    // Check ownership
    const belongs = await this.tokenRepository.belongsToUser(tokenId, userId);
    if (!belongs) {
      throw ApiTokenErrors.NOT_AUTHORIZED;
    }

    const token = await this.tokenRepository.revoke(tokenId, reason);

    if (!token) {
      throw ApiTokenErrors.TOKEN_NOT_FOUND;
    }

    return toResponse(token);
  }

  /**
   * Delete a token permanently
   * User must own the token
   */
  async deleteToken(tokenId: string, userId: string): Promise<void> {
    // Check ownership
    const belongs = await this.tokenRepository.belongsToUser(tokenId, userId);
    if (!belongs) {
      throw ApiTokenErrors.NOT_AUTHORIZED;
    }

    const deleted = await this.tokenRepository.delete(tokenId);

    if (!deleted) {
      throw ApiTokenErrors.TOKEN_NOT_FOUND;
    }
  }

  /**
   * Delete all tokens for a user (for account deletion)
   */
  async deleteAllTokens(userId: string): Promise<number> {
    return this.tokenRepository.deleteAllForUser(userId);
  }

  /**
   * Check if a token has a specific scope
   */
  hasScope(tokenScopes: ApiTokenScope[], requiredScope: ApiTokenScope): boolean {
    return tokenScopes.includes(requiredScope);
  }

  /**
   * Check if a token has all required scopes
   */
  hasAllScopes(tokenScopes: ApiTokenScope[], requiredScopes: ApiTokenScope[]): boolean {
    return requiredScopes.every((scope) => tokenScopes.includes(scope));
  }

  /**
   * Get service configuration
   */
  getConfig(): Readonly<ApiTokenServiceConfig> {
    return { ...this.config };
  }

  /**
   * Hash a token using SHA-256
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
