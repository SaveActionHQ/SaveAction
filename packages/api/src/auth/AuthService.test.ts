/**
 * Authentication Service Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';
import { AuthService, AuthError, AuthErrors } from './AuthService.js';
import type { UserRepository, SafeUser, UserWithPassword } from '../repositories/UserRepository.js';
import type { FastifyInstance } from 'fastify';

// Mock bcrypt
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2b$12$hashedpassword'),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepository: UserRepository;
  let mockFastify: FastifyInstance;

  const mockUser: SafeUser = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'test@example.com',
    name: 'Test User',
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

  const mockUserWithPassword: UserWithPassword = {
    ...mockUser,
    passwordHash: '$2b$12$validhashedpassword',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockUserRepository = {
      findById: vi.fn().mockResolvedValue(mockUser),
      findByIdWithPassword: vi.fn().mockResolvedValue(mockUserWithPassword),
      findByEmail: vi.fn().mockResolvedValue(mockUser),
      findByEmailWithPassword: vi.fn().mockResolvedValue(mockUserWithPassword),
      emailExists: vi.fn().mockResolvedValue(false),
      create: vi.fn().mockResolvedValue(mockUser),
      update: vi.fn().mockResolvedValue(mockUser),
      updatePassword: vi.fn().mockResolvedValue(true),
      updateLastLogin: vi.fn().mockResolvedValue(undefined),
      incrementFailedAttempts: vi.fn().mockResolvedValue(1),
      lockAccount: vi.fn().mockResolvedValue(undefined),
      unlockAccount: vi.fn().mockResolvedValue(undefined),
      softDelete: vi.fn().mockResolvedValue(true),
      restore: vi.fn().mockResolvedValue(mockUser),
      verifyEmail: vi.fn().mockResolvedValue(undefined),
    } as unknown as UserRepository;

    mockFastify = {
      jwt: {
        sign: vi.fn().mockReturnValue('mock-jwt-token'),
        verify: vi.fn().mockReturnValue({
          sub: mockUser.id,
          email: mockUser.email,
          type: 'access',
        }),
      },
    } as unknown as FastifyInstance;

    authService = new AuthService(mockFastify, mockUserRepository, {
      jwtSecret: 'test-secret-key-32-chars-long!!!!',
      jwtRefreshSecret: 'test-refresh-secret-32-chars!!!!',
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d',
      bcryptRounds: 12,
      maxLoginAttempts: 5,
      lockoutDuration: 900,
    });
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const registerData = {
        email: 'newuser@example.com',
        password: 'Password123!',
        name: 'New User',
      };

      const result = await authService.register(registerData, '127.0.0.1');

      expect(mockUserRepository.emailExists).toHaveBeenCalledWith('newuser@example.com');
      expect(bcrypt.hash).toHaveBeenCalledWith('Password123!', 12);
      expect(mockUserRepository.create).toHaveBeenCalled();
      expect(mockUserRepository.updateLastLogin).toHaveBeenCalled();
      expect(result.user.email).toBe(mockUser.email);
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
    });

    it('should throw EMAIL_EXISTS when email is already registered', async () => {
      vi.mocked(mockUserRepository.emailExists).mockResolvedValue(true);

      const registerData = {
        email: 'existing@example.com',
        password: 'Password123!',
      };

      await expect(authService.register(registerData)).rejects.toMatchObject({
        code: 'EMAIL_EXISTS',
        statusCode: 409,
      });
    });
  });

  describe('login', () => {
    it('should login user successfully with valid credentials', async () => {
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const loginData = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      const result = await authService.login(loginData, '127.0.0.1');

      expect(mockUserRepository.findByEmailWithPassword).toHaveBeenCalledWith('test@example.com');
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'Password123!',
        mockUserWithPassword.passwordHash
      );
      expect(mockUserRepository.updateLastLogin).toHaveBeenCalledWith(mockUser.id, '127.0.0.1');
      expect(result.user.email).toBe(mockUser.email);
      expect(result.tokens.accessToken).toBeDefined();
    });

    it('should throw INVALID_CREDENTIALS for wrong password', async () => {
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      const loginData = {
        email: 'test@example.com',
        password: 'WrongPassword123!',
      };

      await expect(authService.login(loginData)).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
        statusCode: 401,
      });

      expect(mockUserRepository.incrementFailedAttempts).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw INVALID_CREDENTIALS for non-existent user', async () => {
      vi.mocked(mockUserRepository.findByEmailWithPassword).mockResolvedValue(null);

      const loginData = {
        email: 'nonexistent@example.com',
        password: 'Password123!',
      };

      await expect(authService.login(loginData)).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
        statusCode: 401,
      });
    });

    it('should throw USER_INACTIVE for inactive accounts', async () => {
      const inactiveUser = { ...mockUserWithPassword, isActive: false };
      vi.mocked(mockUserRepository.findByEmailWithPassword).mockResolvedValue(inactiveUser);

      const loginData = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      await expect(authService.login(loginData)).rejects.toMatchObject({
        code: 'USER_INACTIVE',
        statusCode: 403,
      });
    });

    it('should throw USER_LOCKED for locked accounts', async () => {
      const lockedUser = {
        ...mockUserWithPassword,
        lockedUntil: new Date(Date.now() + 60000), // Locked for 60 seconds
      };
      vi.mocked(mockUserRepository.findByEmailWithPassword).mockResolvedValue(lockedUser);

      const loginData = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      await expect(authService.login(loginData)).rejects.toMatchObject({
        code: 'USER_LOCKED',
        statusCode: 423,
      });
    });

    it('should lock account after max failed attempts', async () => {
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
      vi.mocked(mockUserRepository.incrementFailedAttempts).mockResolvedValue(5);

      const loginData = {
        email: 'test@example.com',
        password: 'WrongPassword123!',
      };

      await expect(authService.login(loginData)).rejects.toMatchObject({
        code: 'USER_LOCKED',
      });

      expect(mockUserRepository.lockAccount).toHaveBeenCalledWith(mockUser.id, 900);
    });
  });

  describe('refresh', () => {
    it('should refresh tokens with valid refresh token', async () => {
      vi.mocked(mockFastify.jwt.verify).mockReturnValue({
        sub: mockUser.id,
        email: mockUser.email,
        type: 'refresh',
      } as never);

      const result = await authService.refresh('valid-refresh-token');

      expect(mockFastify.jwt.verify).toHaveBeenCalledWith('valid-refresh-token', {});
      expect(mockUserRepository.findById).toHaveBeenCalledWith(mockUser.id);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw INVALID_REFRESH_TOKEN for invalid token', async () => {
      vi.mocked(mockFastify.jwt.verify).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(authService.refresh('invalid-token')).rejects.toMatchObject({
        code: 'INVALID_REFRESH_TOKEN',
        statusCode: 401,
      });
    });

    it('should throw INVALID_REFRESH_TOKEN for access token', async () => {
      vi.mocked(mockFastify.jwt.verify).mockReturnValue({
        sub: mockUser.id,
        email: mockUser.email,
        type: 'access', // Wrong type
      } as never);

      await expect(authService.refresh('access-token')).rejects.toMatchObject({
        code: 'INVALID_REFRESH_TOKEN',
      });
    });

    it('should throw USER_NOT_FOUND for deleted user', async () => {
      vi.mocked(mockFastify.jwt.verify).mockReturnValue({
        sub: mockUser.id,
        email: mockUser.email,
        type: 'refresh',
      } as never);
      vi.mocked(mockUserRepository.findById).mockResolvedValue(null);

      await expect(authService.refresh('valid-token')).rejects.toMatchObject({
        code: 'USER_NOT_FOUND',
      });
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      await authService.changePassword(mockUser.id, 'CurrentPass123!', 'NewPass456!');

      expect(mockUserRepository.findByIdWithPassword).toHaveBeenCalledWith(mockUser.id);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'CurrentPass123!',
        mockUserWithPassword.passwordHash
      );
      expect(bcrypt.hash).toHaveBeenCalledWith('NewPass456!', 12);
      expect(mockUserRepository.updatePassword).toHaveBeenCalled();
    });

    it('should throw PASSWORD_MISMATCH for wrong current password', async () => {
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(
        authService.changePassword(mockUser.id, 'WrongPass123!', 'NewPass456!')
      ).rejects.toMatchObject({
        code: 'PASSWORD_MISMATCH',
        statusCode: 401,
      });
    });

    it('should throw USER_NOT_FOUND for non-existent user', async () => {
      vi.mocked(mockUserRepository.findByIdWithPassword).mockResolvedValue(null);

      await expect(
        authService.changePassword('non-existent-id', 'CurrentPass123!', 'NewPass456!')
      ).rejects.toMatchObject({
        code: 'USER_NOT_FOUND',
      });
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user info', async () => {
      const result = await authService.getCurrentUser(mockUser.id);

      expect(mockUserRepository.findById).toHaveBeenCalledWith(mockUser.id);
      expect(result.id).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw USER_NOT_FOUND for non-existent user', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(null);

      await expect(authService.getCurrentUser('non-existent-id')).rejects.toMatchObject({
        code: 'USER_NOT_FOUND',
      });
    });
  });

  describe('verifyToken', () => {
    it('should verify valid access token', async () => {
      const payload = await authService.verifyToken('valid-access-token');

      expect(mockFastify.jwt.verify).toHaveBeenCalledWith('valid-access-token');
      expect(payload.sub).toBe(mockUser.id);
    });

    it('should throw INVALID_TOKEN for invalid token', async () => {
      vi.mocked(mockFastify.jwt.verify).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(authService.verifyToken('invalid-token')).rejects.toMatchObject({
        code: 'INVALID_TOKEN',
      });
    });

    it('should throw INVALID_TOKEN for refresh token', async () => {
      vi.mocked(mockFastify.jwt.verify).mockReturnValue({
        sub: mockUser.id,
        email: mockUser.email,
        type: 'refresh', // Wrong type
      } as never);

      await expect(authService.verifyToken('refresh-token')).rejects.toMatchObject({
        code: 'INVALID_TOKEN',
      });
    });
  });
});

describe('AuthError', () => {
  it('should create error with correct properties', () => {
    const error = new AuthError('Test message', 'TEST_CODE', 400);

    expect(error.message).toBe('Test message');
    expect(error.code).toBe('TEST_CODE');
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe('AuthError');
  });

  it('should default to 401 status code', () => {
    const error = new AuthError('Test message', 'TEST_CODE');

    expect(error.statusCode).toBe(401);
  });
});

describe('AuthErrors', () => {
  it('should have all predefined errors', () => {
    expect(AuthErrors.INVALID_CREDENTIALS).toBeDefined();
    expect(AuthErrors.USER_NOT_FOUND).toBeDefined();
    expect(AuthErrors.USER_LOCKED).toBeDefined();
    expect(AuthErrors.USER_INACTIVE).toBeDefined();
    expect(AuthErrors.EMAIL_EXISTS).toBeDefined();
    expect(AuthErrors.INVALID_TOKEN).toBeDefined();
    expect(AuthErrors.INVALID_REFRESH_TOKEN).toBeDefined();
    expect(AuthErrors.PASSWORD_MISMATCH).toBeDefined();
  });
});
