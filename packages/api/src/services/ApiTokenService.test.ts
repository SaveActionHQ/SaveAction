/**
 * API Token Service Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiTokenService, ApiTokenError, ApiTokenErrors } from './ApiTokenService.js';
import type {
  ApiTokenRepository,
  SafeApiToken,
  ApiTokenWithHash,
} from '../repositories/ApiTokenRepository.js';
import type { ApiTokenScope } from '../auth/api-token-types.js';

describe('ApiTokenService', () => {
  let tokenService: ApiTokenService;
  let mockRepository: ApiTokenRepository;

  const mockUserId = '550e8400-e29b-41d4-a716-446655440000';
  const mockTokenId = '550e8400-e29b-41d4-a716-446655440001';

  const mockSafeToken: SafeApiToken = {
    id: mockTokenId,
    userId: mockUserId,
    name: 'CI Token',
    tokenPrefix: 'sa_live_',
    tokenSuffix: 'xyz1',
    scopes: ['recordings:read', 'runs:execute'],
    projectIds: ['*'],
    lastUsedAt: new Date('2024-01-15'),
    lastUsedIp: '192.168.1.1',
    useCount: 5,
    expiresAt: null,
    revokedAt: null,
    revokedReason: null,
    createdAt: new Date('2024-01-01'),
  };

  const mockTokenWithHash: ApiTokenWithHash = {
    ...mockSafeToken,
    tokenHash: 'abc123hash',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockRepository = {
      create: vi.fn().mockResolvedValue(mockSafeToken),
      findById: vi.fn().mockResolvedValue(mockSafeToken),
      findByHash: vi.fn().mockResolvedValue(mockTokenWithHash),
      findByUserId: vi.fn().mockResolvedValue([mockSafeToken]),
      findActiveByUserId: vi.fn().mockResolvedValue([mockSafeToken]),
      recordUsage: vi.fn().mockResolvedValue(undefined),
      revoke: vi.fn().mockResolvedValue({ ...mockSafeToken, revokedAt: new Date() }),
      delete: vi.fn().mockResolvedValue(true),
      deleteAllForUser: vi.fn().mockResolvedValue(2),
      countActiveByUserId: vi.fn().mockResolvedValue(3),
      belongsToUser: vi.fn().mockResolvedValue(true),
    } as unknown as ApiTokenRepository;

    tokenService = new ApiTokenService(mockRepository);
  });

  describe('constructor', () => {
    it('should use default configuration', () => {
      const service = new ApiTokenService(mockRepository);
      const config = service.getConfig();

      expect(config.maxTokensPerUser).toBe(10);
      expect(config.tokenLength).toBe(32);
    });

    it('should accept custom configuration', () => {
      const service = new ApiTokenService(mockRepository, {
        maxTokensPerUser: 5,
        tokenLength: 16,
      });
      const config = service.getConfig();

      expect(config.maxTokensPerUser).toBe(5);
      expect(config.tokenLength).toBe(16);
    });
  });

  describe('createToken', () => {
    it('should create a new token successfully', async () => {
      const result = await tokenService.createToken(mockUserId, {
        name: 'New Token',
        scopes: ['recordings:read'] as ApiTokenScope[],
      });

      expect(mockRepository.countActiveByUserId).toHaveBeenCalledWith(mockUserId);
      expect(mockRepository.create).toHaveBeenCalled();
      expect(result.id).toBe(mockTokenId);
      expect(result.name).toBe(mockSafeToken.name);
      expect(result.token).toMatch(/^sa_live_[a-f0-9]{64}$/);
    });

    it('should throw error when token limit reached', async () => {
      vi.mocked(mockRepository.countActiveByUserId).mockResolvedValue(10);

      await expect(
        tokenService.createToken(mockUserId, {
          name: 'New Token',
          scopes: ['recordings:read'] as ApiTokenScope[],
        })
      ).rejects.toMatchObject({
        code: 'TOKEN_LIMIT_REACHED',
        statusCode: 400,
      });
    });

    it('should handle expiration date', async () => {
      const expiresAt = new Date('2025-01-01');

      await tokenService.createToken(mockUserId, {
        name: 'Expiring Token',
        scopes: ['runs:read'] as ApiTokenScope[],
        expiresAt,
      });

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt,
        })
      );
    });

    it('should generate token with correct format', async () => {
      const result = await tokenService.createToken(mockUserId, {
        name: 'Test Token',
        scopes: ['recordings:read'] as ApiTokenScope[],
      });

      expect(result.token).toMatch(/^sa_live_[a-f0-9]{64}$/);
      expect(result.token.length).toBe(72); // 8 (prefix) + 64 (hex)
    });
  });

  describe('validateToken', () => {
    it('should validate a valid token', async () => {
      // Generate a properly formatted token for testing
      const validToken = 'sa_live_' + 'a'.repeat(64);

      const result = await tokenService.validateToken(validToken, '10.0.0.1');

      expect(mockRepository.findByHash).toHaveBeenCalled();
      expect(result.id).toBe(mockTokenId);
      expect(result.userId).toBe(mockUserId);
      expect(result.scopes).toEqual(['recordings:read', 'runs:execute']);
    });

    it('should throw error for invalid token format', async () => {
      await expect(tokenService.validateToken('invalid_token')).rejects.toMatchObject({
        code: 'TOKEN_INVALID',
        statusCode: 401,
      });
    });

    it('should throw error for non-existent token', async () => {
      vi.mocked(mockRepository.findByHash).mockResolvedValue(null);
      const validToken = 'sa_live_' + 'b'.repeat(64);

      await expect(tokenService.validateToken(validToken)).rejects.toMatchObject({
        code: 'TOKEN_INVALID',
        statusCode: 401,
      });
    });

    it('should record usage asynchronously', async () => {
      const validToken = 'sa_live_' + 'c'.repeat(64);

      await tokenService.validateToken(validToken, '192.168.1.1');

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockRepository.recordUsage).toHaveBeenCalledWith(mockTokenId, '192.168.1.1');
    });

    it('should handle usage recording errors gracefully', async () => {
      vi.mocked(mockRepository.recordUsage).mockRejectedValue(new Error('DB Error'));
      const validToken = 'sa_live_' + 'd'.repeat(64);

      // Should not throw
      const result = await tokenService.validateToken(validToken);

      expect(result).toBeDefined();
    });
  });

  describe('listTokens', () => {
    it('should return all tokens for a user', async () => {
      const result = await tokenService.listTokens(mockUserId);

      expect(mockRepository.findByUserId).toHaveBeenCalledWith(mockUserId);
      expect(result.tokens).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should return empty list when user has no tokens', async () => {
      vi.mocked(mockRepository.findByUserId).mockResolvedValue([]);

      const result = await tokenService.listTokens(mockUserId);

      expect(result.tokens).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('listActiveTokens', () => {
    it('should return only active tokens', async () => {
      const result = await tokenService.listActiveTokens(mockUserId);

      expect(mockRepository.findActiveByUserId).toHaveBeenCalledWith(mockUserId);
      expect(result.tokens).toHaveLength(1);
    });
  });

  describe('getToken', () => {
    it('should return token when found and owned by user', async () => {
      const result = await tokenService.getToken(mockTokenId, mockUserId);

      expect(mockRepository.findById).toHaveBeenCalledWith(mockTokenId);
      expect(result.id).toBe(mockTokenId);
    });

    it('should throw error when token not found', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(null);

      await expect(tokenService.getToken('non-existent', mockUserId)).rejects.toMatchObject({
        code: 'TOKEN_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('should throw error when token owned by different user', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue({
        ...mockSafeToken,
        userId: 'different-user',
      });

      await expect(tokenService.getToken(mockTokenId, mockUserId)).rejects.toMatchObject({
        code: 'NOT_AUTHORIZED',
        statusCode: 403,
      });
    });
  });

  describe('revokeToken', () => {
    it('should revoke a token owned by user', async () => {
      const result = await tokenService.revokeToken(mockTokenId, mockUserId, 'Security concern');

      expect(mockRepository.belongsToUser).toHaveBeenCalledWith(mockTokenId, mockUserId);
      expect(mockRepository.revoke).toHaveBeenCalledWith(mockTokenId, 'Security concern');
      expect(result.revokedAt).toBeDefined();
    });

    it('should throw error when not authorized', async () => {
      vi.mocked(mockRepository.belongsToUser).mockResolvedValue(false);

      await expect(tokenService.revokeToken(mockTokenId, 'different-user')).rejects.toMatchObject({
        code: 'NOT_AUTHORIZED',
        statusCode: 403,
      });
    });

    it('should throw error when token not found', async () => {
      vi.mocked(mockRepository.revoke).mockResolvedValue(null);

      await expect(tokenService.revokeToken(mockTokenId, mockUserId)).rejects.toMatchObject({
        code: 'TOKEN_NOT_FOUND',
        statusCode: 404,
      });
    });
  });

  describe('deleteToken', () => {
    it('should delete a token owned by user', async () => {
      await tokenService.deleteToken(mockTokenId, mockUserId);

      expect(mockRepository.belongsToUser).toHaveBeenCalledWith(mockTokenId, mockUserId);
      expect(mockRepository.delete).toHaveBeenCalledWith(mockTokenId);
    });

    it('should throw error when not authorized', async () => {
      vi.mocked(mockRepository.belongsToUser).mockResolvedValue(false);

      await expect(tokenService.deleteToken(mockTokenId, 'different-user')).rejects.toMatchObject({
        code: 'NOT_AUTHORIZED',
        statusCode: 403,
      });
    });

    it('should throw error when token not found', async () => {
      vi.mocked(mockRepository.delete).mockResolvedValue(false);

      await expect(tokenService.deleteToken(mockTokenId, mockUserId)).rejects.toMatchObject({
        code: 'TOKEN_NOT_FOUND',
        statusCode: 404,
      });
    });
  });

  describe('deleteAllTokens', () => {
    it('should delete all tokens for a user', async () => {
      const result = await tokenService.deleteAllTokens(mockUserId);

      expect(mockRepository.deleteAllForUser).toHaveBeenCalledWith(mockUserId);
      expect(result).toBe(2);
    });
  });

  describe('hasScope', () => {
    it('should return true when scope exists', () => {
      const scopes: ApiTokenScope[] = ['recordings:read', 'runs:execute'];

      expect(tokenService.hasScope(scopes, 'recordings:read')).toBe(true);
    });

    it('should return false when scope does not exist', () => {
      const scopes: ApiTokenScope[] = ['recordings:read'];

      expect(tokenService.hasScope(scopes, 'runs:execute')).toBe(false);
    });
  });

  describe('hasAllScopes', () => {
    it('should return true when all scopes exist', () => {
      const scopes: ApiTokenScope[] = ['recordings:read', 'runs:execute', 'runs:read'];

      expect(tokenService.hasAllScopes(scopes, ['recordings:read', 'runs:execute'])).toBe(true);
    });

    it('should return false when some scopes missing', () => {
      const scopes: ApiTokenScope[] = ['recordings:read'];

      expect(tokenService.hasAllScopes(scopes, ['recordings:read', 'runs:execute'])).toBe(false);
    });

    it('should return true for empty required scopes', () => {
      const scopes: ApiTokenScope[] = ['recordings:read'];

      expect(tokenService.hasAllScopes(scopes, [])).toBe(true);
    });
  });

  describe('getConfig', () => {
    it('should return a copy of config', () => {
      const config1 = tokenService.getConfig();
      const config2 = tokenService.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });
  });
});

describe('ApiTokenError', () => {
  it('should create error with correct properties', () => {
    const error = new ApiTokenError('Test message', 'TEST_CODE', 400);

    expect(error.message).toBe('Test message');
    expect(error.code).toBe('TEST_CODE');
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe('ApiTokenError');
  });

  it('should default to 400 status code', () => {
    const error = new ApiTokenError('Test message', 'TEST_CODE');

    expect(error.statusCode).toBe(400);
  });
});

describe('ApiTokenErrors', () => {
  it('should have all predefined errors', () => {
    expect(ApiTokenErrors.TOKEN_NOT_FOUND).toBeDefined();
    expect(ApiTokenErrors.TOKEN_NOT_FOUND.statusCode).toBe(404);

    expect(ApiTokenErrors.TOKEN_INVALID).toBeDefined();
    expect(ApiTokenErrors.TOKEN_INVALID.statusCode).toBe(401);

    expect(ApiTokenErrors.TOKEN_EXPIRED).toBeDefined();
    expect(ApiTokenErrors.TOKEN_EXPIRED.statusCode).toBe(401);

    expect(ApiTokenErrors.TOKEN_REVOKED).toBeDefined();
    expect(ApiTokenErrors.TOKEN_REVOKED.statusCode).toBe(401);

    expect(ApiTokenErrors.TOKEN_LIMIT_REACHED).toBeDefined();
    expect(ApiTokenErrors.TOKEN_LIMIT_REACHED.statusCode).toBe(400);

    expect(ApiTokenErrors.INSUFFICIENT_SCOPE).toBeDefined();
    expect(ApiTokenErrors.INSUFFICIENT_SCOPE.statusCode).toBe(403);

    expect(ApiTokenErrors.NOT_AUTHORIZED).toBeDefined();
    expect(ApiTokenErrors.NOT_AUTHORIZED.statusCode).toBe(403);
  });
});
