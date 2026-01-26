/**
 * User Repository Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRepository } from './UserRepository.js';
import type { Database } from '../db/index.js';

describe('UserRepository', () => {
  let userRepository: UserRepository;
  let mockDb: Database;

  const mockUser = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: '$2b$12$hashedpassword',
    emailVerifiedAt: null,
    failedLoginAttempts: '0',
    lockedUntil: null,
    lastLoginAt: null,
    lastLoginIp: null,
    isActive: true,
    deletedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockSafeUser = {
    id: mockUser.id,
    email: mockUser.email,
    name: mockUser.name,
    emailVerifiedAt: mockUser.emailVerifiedAt,
    failedLoginAttempts: mockUser.failedLoginAttempts,
    lockedUntil: mockUser.lockedUntil,
    lastLoginAt: mockUser.lastLoginAt,
    lastLoginIp: mockUser.lastLoginIp,
    isActive: mockUser.isActive,
    deletedAt: mockUser.deletedAt,
    createdAt: mockUser.createdAt,
    updatedAt: mockUser.updatedAt,
  };

  // Mock chain builder
  const createMockQueryChain = (result: unknown[]) => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(result),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue(result),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };
    return chain;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    const mockChain = createMockQueryChain([mockSafeUser]);

    mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockSafeUser]),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockSafeUser]),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockSafeUser]),
          }),
        }),
      }),
    } as unknown as Database;

    userRepository = new UserRepository(mockDb);
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      const result = await userRepository.findById(mockUser.id);

      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result?.id).toBe(mockUser.id);
    });

    it('should return null when not found', async () => {
      vi.mocked(mockDb.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as unknown as ReturnType<typeof mockDb.select>);

      const result = await userRepository.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByIdWithPassword', () => {
    it('should return user with password hash', async () => {
      vi.mocked(mockDb.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      } as unknown as ReturnType<typeof mockDb.select>);

      const result = await userRepository.findByIdWithPassword(mockUser.id);

      expect(result).toBeDefined();
      expect(result?.passwordHash).toBe(mockUser.passwordHash);
    });
  });

  describe('findByEmail', () => {
    it('should return user when found (case-insensitive)', async () => {
      const result = await userRepository.findByEmail('TEST@EXAMPLE.COM');

      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result?.email).toBe(mockUser.email);
    });

    it('should return null when not found', async () => {
      vi.mocked(mockDb.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as unknown as ReturnType<typeof mockDb.select>);

      const result = await userRepository.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('emailExists', () => {
    it('should return true when email exists', async () => {
      vi.mocked(mockDb.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: mockUser.id }]),
          }),
        }),
      } as unknown as ReturnType<typeof mockDb.select>);

      const result = await userRepository.emailExists(mockUser.email);

      expect(result).toBe(true);
    });

    it('should return false when email does not exist', async () => {
      vi.mocked(mockDb.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as unknown as ReturnType<typeof mockDb.select>);

      const result = await userRepository.emailExists('nonexistent@example.com');

      expect(result).toBe(false);
    });
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const createData = {
        email: 'newuser@example.com',
        passwordHash: '$2b$12$newhashedpassword',
        name: 'New User',
      };

      const result = await userRepository.create(createData);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should normalize email to lowercase', async () => {
      const createData = {
        email: 'NEWUSER@EXAMPLE.COM',
        passwordHash: '$2b$12$newhashedpassword',
      };

      await userRepository.create(createData);

      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update user data', async () => {
      const updateData = { name: 'Updated Name' };

      const result = await userRepository.update(mockUser.id, updateData);

      expect(mockDb.update).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should return null when user not found', async () => {
      vi.mocked(mockDb.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as unknown as ReturnType<typeof mockDb.update>);

      const result = await userRepository.update('non-existent-id', { name: 'Test' });

      expect(result).toBeNull();
    });
  });

  describe('updatePassword', () => {
    it('should update password hash', async () => {
      vi.mocked(mockDb.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowCount: 1 }),
        }),
      } as unknown as ReturnType<typeof mockDb.update>);

      const result = await userRepository.updatePassword(mockUser.id, '$2b$12$newpasswordhash');

      expect(mockDb.update).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when user not found', async () => {
      vi.mocked(mockDb.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowCount: 0 }),
        }),
      } as unknown as ReturnType<typeof mockDb.update>);

      const result = await userRepository.updatePassword(
        'non-existent-id',
        '$2b$12$newpasswordhash'
      );

      expect(result).toBe(false);
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login info', async () => {
      vi.mocked(mockDb.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowCount: 1 }),
        }),
      } as unknown as ReturnType<typeof mockDb.update>);

      await userRepository.updateLastLogin(mockUser.id, '192.168.1.1');

      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('incrementFailedAttempts', () => {
    it('should increment and return failed attempts count', async () => {
      vi.mocked(mockDb.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ failedLoginAttempts: '3' }]),
          }),
        }),
      } as unknown as ReturnType<typeof mockDb.update>);

      const result = await userRepository.incrementFailedAttempts(mockUser.id);

      expect(result).toBe(3);
    });
  });

  describe('lockAccount', () => {
    it('should set lock until timestamp', async () => {
      vi.mocked(mockDb.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowCount: 1 }),
        }),
      } as unknown as ReturnType<typeof mockDb.update>);

      await userRepository.lockAccount(mockUser.id, 900);

      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('unlockAccount', () => {
    it('should clear lock and reset failed attempts', async () => {
      vi.mocked(mockDb.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowCount: 1 }),
        }),
      } as unknown as ReturnType<typeof mockDb.update>);

      await userRepository.unlockAccount(mockUser.id);

      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('should mark user as deleted', async () => {
      vi.mocked(mockDb.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowCount: 1 }),
        }),
      } as unknown as ReturnType<typeof mockDb.update>);

      const result = await userRepository.softDelete(mockUser.id);

      expect(result).toBe(true);
    });

    it('should return false when user not found', async () => {
      vi.mocked(mockDb.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowCount: 0 }),
        }),
      } as unknown as ReturnType<typeof mockDb.update>);

      const result = await userRepository.softDelete('non-existent-id');

      expect(result).toBe(false);
    });
  });

  describe('restore', () => {
    it('should restore soft-deleted user', async () => {
      const result = await userRepository.restore(mockUser.id);

      expect(mockDb.update).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('verifyEmail', () => {
    it('should set email verified timestamp', async () => {
      vi.mocked(mockDb.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowCount: 1 }),
        }),
      } as unknown as ReturnType<typeof mockDb.update>);

      await userRepository.verifyEmail(mockUser.id);

      expect(mockDb.update).toHaveBeenCalled();
    });
  });
});
