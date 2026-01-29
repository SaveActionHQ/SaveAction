/**
 * API Token Repository Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiTokenRepository } from './ApiTokenRepository.js';
import type { Database } from '../db/index.js';

describe('ApiTokenRepository', () => {
  let tokenRepository: ApiTokenRepository;
  let mockDb: Database;

  const mockToken = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    userId: '550e8400-e29b-41d4-a716-446655440000',
    name: 'CI Token',
    tokenHash: 'abc123hash',
    tokenPrefix: 'sa_live_',
    tokenSuffix: 'xyz1',
    scopes: '["recordings:read","runs:execute"]',
    lastUsedAt: new Date('2024-01-15'),
    lastUsedIp: '192.168.1.1',
    useCount: '5',
    expiresAt: null,
    revokedAt: null,
    revokedReason: null,
    createdAt: new Date('2024-01-01'),
  };

  const mockSafeToken = {
    id: mockToken.id,
    userId: mockToken.userId,
    name: mockToken.name,
    tokenPrefix: mockToken.tokenPrefix,
    tokenSuffix: mockToken.tokenSuffix,
    scopes: ['recordings:read', 'runs:execute'],
    lastUsedAt: mockToken.lastUsedAt,
    lastUsedIp: mockToken.lastUsedIp,
    useCount: 5,
    expiresAt: mockToken.expiresAt,
    revokedAt: mockToken.revokedAt,
    revokedReason: mockToken.revokedReason,
    createdAt: mockToken.createdAt,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockToken]),
            orderBy: vi.fn().mockResolvedValue([mockToken]),
          }),
          orderBy: vi.fn().mockResolvedValue([mockToken]),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockToken]),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockToken]),
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockToken]),
        }),
      }),
    } as unknown as Database;

    tokenRepository = new ApiTokenRepository(mockDb);
  });

  describe('create', () => {
    it('should create a new token', async () => {
      const createData = {
        userId: mockToken.userId,
        name: 'New Token',
        tokenHash: 'newhash123',
        tokenPrefix: 'sa_live_',
        tokenSuffix: 'abc1',
        scopes: ['recordings:read'],
        expiresAt: null,
      };

      const result = await tokenRepository.create(createData);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(result.id).toBe(mockToken.id);
      expect(result.name).toBe(mockToken.name);
      expect(Array.isArray(result.scopes)).toBe(true);
    });

    it('should handle expiration date', async () => {
      const futureDate = new Date('2025-01-01');
      const createData = {
        userId: mockToken.userId,
        name: 'Expiring Token',
        tokenHash: 'expiringhash',
        tokenPrefix: 'sa_live_',
        tokenSuffix: 'exp1',
        scopes: ['runs:read'],
        expiresAt: futureDate,
      };

      const result = await tokenRepository.create(createData);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('findById', () => {
    it('should return token when found', async () => {
      const result = await tokenRepository.findById(mockToken.id);

      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result?.id).toBe(mockToken.id);
      expect(result?.scopes).toEqual(['recordings:read', 'runs:execute']);
    });

    it('should return null when not found', async () => {
      vi.mocked(mockDb.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as unknown as ReturnType<typeof mockDb.select>);

      const result = await tokenRepository.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByHash', () => {
    it('should return token with hash when found', async () => {
      const result = await tokenRepository.findByHash('abc123hash');

      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result?.tokenHash).toBe(mockToken.tokenHash);
    });

    it('should return null for non-existent hash', async () => {
      vi.mocked(mockDb.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as unknown as ReturnType<typeof mockDb.select>);

      const result = await tokenRepository.findByHash('invalid-hash');

      expect(result).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('should return all tokens for a user', async () => {
      const secondToken = { ...mockToken, id: 'token-2', name: 'Second Token' };
      vi.mocked(mockDb.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([mockToken, secondToken]),
          }),
        }),
      } as unknown as ReturnType<typeof mockDb.select>);

      const result = await tokenRepository.findByUserId(mockToken.userId);

      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe(mockToken.name);
    });

    it('should return empty array when user has no tokens', async () => {
      vi.mocked(mockDb.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as unknown as ReturnType<typeof mockDb.select>);

      const result = await tokenRepository.findByUserId('user-with-no-tokens');

      expect(result).toEqual([]);
    });
  });

  describe('findActiveByUserId', () => {
    it('should return only active tokens', async () => {
      const result = await tokenRepository.findActiveByUserId(mockToken.userId);

      expect(mockDb.select).toHaveBeenCalled();
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('recordUsage', () => {
    it('should update last used time and IP', async () => {
      await tokenRepository.recordUsage(mockToken.id, '10.0.0.1');

      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should handle null IP', async () => {
      await tokenRepository.recordUsage(mockToken.id, null);

      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('revoke', () => {
    it('should revoke a token', async () => {
      const revokedToken = { ...mockToken, revokedAt: new Date(), revokedReason: 'Security' };
      vi.mocked(mockDb.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([revokedToken]),
          }),
        }),
      } as unknown as ReturnType<typeof mockDb.update>);

      const result = await tokenRepository.revoke(mockToken.id, 'Security');

      expect(mockDb.update).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result?.revokedReason).toBe('Security');
    });

    it('should return null for non-existent token', async () => {
      vi.mocked(mockDb.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as unknown as ReturnType<typeof mockDb.update>);

      const result = await tokenRepository.revoke('non-existent-id');

      expect(result).toBeNull();
    });

    it('should handle revoke without reason', async () => {
      const revokedToken = { ...mockToken, revokedAt: new Date(), revokedReason: null };
      vi.mocked(mockDb.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([revokedToken]),
          }),
        }),
      } as unknown as ReturnType<typeof mockDb.update>);

      const result = await tokenRepository.revoke(mockToken.id);

      expect(result).toBeDefined();
      expect(result?.revokedReason).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a token and return true', async () => {
      const result = await tokenRepository.delete(mockToken.id);

      expect(mockDb.delete).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false for non-existent token', async () => {
      vi.mocked(mockDb.delete).mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      } as unknown as ReturnType<typeof mockDb.delete>);

      const result = await tokenRepository.delete('non-existent-id');

      expect(result).toBe(false);
    });
  });

  describe('deleteAllForUser', () => {
    it('should delete all tokens for a user', async () => {
      const tokens = [mockToken, { ...mockToken, id: 'token-2' }];
      vi.mocked(mockDb.delete).mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue(tokens),
        }),
      } as unknown as ReturnType<typeof mockDb.delete>);

      const result = await tokenRepository.deleteAllForUser(mockToken.userId);

      expect(mockDb.delete).toHaveBeenCalled();
      expect(result).toBe(2);
    });

    it('should return 0 when user has no tokens', async () => {
      vi.mocked(mockDb.delete).mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      } as unknown as ReturnType<typeof mockDb.delete>);

      const result = await tokenRepository.deleteAllForUser('user-with-no-tokens');

      expect(result).toBe(0);
    });
  });

  describe('countActiveByUserId', () => {
    it('should return count of active tokens', async () => {
      vi.mocked(mockDb.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 3 }]),
        }),
      } as unknown as ReturnType<typeof mockDb.select>);

      const result = await tokenRepository.countActiveByUserId(mockToken.userId);

      expect(result).toBe(3);
    });

    it('should return 0 when no active tokens', async () => {
      vi.mocked(mockDb.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      } as unknown as ReturnType<typeof mockDb.select>);

      const result = await tokenRepository.countActiveByUserId('user-with-no-tokens');

      expect(result).toBe(0);
    });
  });

  describe('belongsToUser', () => {
    it('should return true when token belongs to user', async () => {
      vi.mocked(mockDb.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: mockToken.id }]),
          }),
        }),
      } as unknown as ReturnType<typeof mockDb.select>);

      const result = await tokenRepository.belongsToUser(mockToken.id, mockToken.userId);

      expect(result).toBe(true);
    });

    it('should return false when token does not belong to user', async () => {
      vi.mocked(mockDb.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as unknown as ReturnType<typeof mockDb.select>);

      const result = await tokenRepository.belongsToUser(mockToken.id, 'different-user');

      expect(result).toBe(false);
    });
  });
});
