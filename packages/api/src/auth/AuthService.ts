/**
 * Authentication Service
 *
 * Handles user authentication, registration, and token management.
 * Uses bcrypt for password hashing and JWT for token generation.
 */

import bcrypt from 'bcrypt';
import type { FastifyInstance } from 'fastify';
import type { UserRepository, SafeUser } from '../repositories/UserRepository.js';
import type {
  AuthTokens,
  RegisterRequest,
  LoginRequest,
  UserResponse,
  LoginResponse,
  RegisterResponse,
  JwtPayload,
  AccessTokenPayload,
  RefreshTokenPayload,
  ResetTokenPayload,
  AuthConfig,
} from './types.js';

/**
 * Authentication error types
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Predefined auth errors
 */
export const AuthErrors = {
  INVALID_CREDENTIALS: new AuthError('Invalid email or password', 'INVALID_CREDENTIALS', 401),
  USER_NOT_FOUND: new AuthError('User not found', 'USER_NOT_FOUND', 404),
  USER_LOCKED: new AuthError('Account is temporarily locked', 'USER_LOCKED', 423),
  USER_INACTIVE: new AuthError('Account is inactive', 'USER_INACTIVE', 403),
  EMAIL_EXISTS: new AuthError('Email already registered', 'EMAIL_EXISTS', 409),
  INVALID_TOKEN: new AuthError('Invalid or expired token', 'INVALID_TOKEN', 401),
  TOKEN_EXPIRED: new AuthError('Token has expired', 'TOKEN_EXPIRED', 401),
  INVALID_REFRESH_TOKEN: new AuthError('Invalid refresh token', 'INVALID_REFRESH_TOKEN', 401),
  INVALID_RESET_TOKEN: new AuthError('Invalid or expired reset token', 'INVALID_RESET_TOKEN', 401),
  PASSWORD_MISMATCH: new AuthError('Current password is incorrect', 'PASSWORD_MISMATCH', 401),
  EMAIL_SERVICE_UNAVAILABLE: new AuthError(
    'Email service is unavailable',
    'EMAIL_SERVICE_UNAVAILABLE',
    503
  ),
} as const;

/**
 * Default auth configuration
 */
const DEFAULT_CONFIG: AuthConfig = {
  jwtSecret: '',
  jwtRefreshSecret: '',
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',
  bcryptRounds: 12,
  maxLoginAttempts: 5,
  lockoutDuration: 900, // 15 minutes
};

/**
 * Convert SafeUser to UserResponse
 */
function toUserResponse(user: SafeUser): UserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerifiedAt: user.emailVerifiedAt,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Parse duration string to seconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    case 'd':
      return value * 86400;
    default:
      throw new Error(`Invalid duration unit: ${unit}`);
  }
}

/**
 * Authentication Service
 */
export class AuthService {
  private readonly config: AuthConfig;

  constructor(
    private readonly fastify: FastifyInstance,
    private readonly userRepository: UserRepository,
    config?: Partial<AuthConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register a new user
   */
  async register(data: RegisterRequest, ip?: string | null): Promise<RegisterResponse> {
    // Check if email already exists
    const existingUser = await this.userRepository.emailExists(data.email);
    if (existingUser) {
      throw AuthErrors.EMAIL_EXISTS;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, this.config.bcryptRounds);

    // Create user
    const user = await this.userRepository.create({
      email: data.email,
      passwordHash,
      name: data.name,
    });

    // Update last login
    await this.userRepository.updateLastLogin(user.id, ip || null);

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      user: toUserResponse(user),
      tokens,
    };
  }

  /**
   * Login user
   */
  async login(data: LoginRequest, ip?: string | null): Promise<LoginResponse> {
    // Find user with password
    const user = await this.userRepository.findByEmailWithPassword(data.email);

    if (!user) {
      throw AuthErrors.INVALID_CREDENTIALS;
    }

    // Check if account is active
    if (!user.isActive) {
      throw AuthErrors.USER_INACTIVE;
    }

    // Check if account is locked
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      throw AuthErrors.USER_LOCKED;
    }

    // Verify password
    const validPassword = await bcrypt.compare(data.password, user.passwordHash);

    if (!validPassword) {
      // Increment failed attempts
      const attempts = await this.userRepository.incrementFailedAttempts(user.id);

      // Lock account if max attempts exceeded
      if (attempts >= this.config.maxLoginAttempts) {
        await this.userRepository.lockAccount(user.id, this.config.lockoutDuration);
        throw AuthErrors.USER_LOCKED;
      }

      throw AuthErrors.INVALID_CREDENTIALS;
    }

    // Update last login and reset failed attempts
    await this.userRepository.updateLastLogin(user.id, ip || null);

    // Generate tokens
    const safeUser = await this.userRepository.findById(user.id);
    if (!safeUser) {
      throw AuthErrors.USER_NOT_FOUND;
    }

    const tokens = await this.generateTokens(safeUser);

    return {
      user: toUserResponse(safeUser),
      tokens,
    };
  }

  /**
   * Refresh access token
   */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    try {
      // Verify refresh token
      const payload = this.fastify.jwt.verify<RefreshTokenPayload>(refreshToken, {
        // Use the refresh secret if configured differently
      });

      if (payload.type !== 'refresh') {
        throw AuthErrors.INVALID_REFRESH_TOKEN;
      }

      // Get user
      const user = await this.userRepository.findById(payload.sub);

      if (!user) {
        throw AuthErrors.USER_NOT_FOUND;
      }

      if (!user.isActive) {
        throw AuthErrors.USER_INACTIVE;
      }

      // Generate new tokens
      return this.generateTokens(user);
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw AuthErrors.INVALID_REFRESH_TOKEN;
    }
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    // Get user with password
    const user = await this.userRepository.findByIdWithPassword(userId);

    if (!user) {
      throw AuthErrors.USER_NOT_FOUND;
    }

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!validPassword) {
      throw AuthErrors.PASSWORD_MISMATCH;
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, this.config.bcryptRounds);

    // Update password
    await this.userRepository.updatePassword(userId, passwordHash);
  }

  /**
   * Get current user
   */
  async getCurrentUser(userId: string): Promise<UserResponse> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw AuthErrors.USER_NOT_FOUND;
    }

    return toUserResponse(user);
  }

  /**
   * Verify access token
   */
  async verifyToken(token: string): Promise<JwtPayload> {
    try {
      const payload = this.fastify.jwt.verify<AccessTokenPayload>(token);

      if (payload.type !== 'access') {
        throw AuthErrors.INVALID_TOKEN;
      }

      // Verify user still exists and is active
      const user = await this.userRepository.findById(payload.sub);

      if (!user) {
        throw AuthErrors.USER_NOT_FOUND;
      }

      if (!user.isActive) {
        throw AuthErrors.USER_INACTIVE;
      }

      return payload;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw AuthErrors.INVALID_TOKEN;
    }
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(user: SafeUser): Promise<AuthTokens> {
    const accessExpiresIn = parseDuration(this.config.accessTokenExpiry);
    const refreshExpiresIn = parseDuration(this.config.refreshTokenExpiry);

    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      type: 'access',
      name: user.name || undefined,
    };

    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      email: user.email,
      type: 'refresh',
      tokenVersion: 1, // Could be incremented for token invalidation
    };

    const accessToken = this.fastify.jwt.sign(accessPayload, {
      expiresIn: accessExpiresIn,
    });

    const refreshToken = this.fastify.jwt.sign(refreshPayload, {
      expiresIn: refreshExpiresIn,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: accessExpiresIn,
    };
  }

  /**
   * Hash a password (utility method)
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.config.bcryptRounds);
  }

  /**
   * Compare password with hash (utility method)
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate a password reset token
   * Token expires in 1 hour
   */
  async generateResetToken(email: string): Promise<{ token: string; user: SafeUser } | null> {
    // Find user by email
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      // Don't reveal if user exists - return null silently
      return null;
    }

    if (!user.isActive) {
      // Don't reveal account status
      return null;
    }

    // Generate reset token (1 hour expiry)
    const resetPayload: ResetTokenPayload = {
      sub: user.id,
      email: user.email,
      type: 'reset',
    };

    const token = this.fastify.jwt.sign(resetPayload, {
      expiresIn: 3600, // 1 hour in seconds
    });

    return { token, user };
  }

  /**
   * Verify and use a password reset token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      // Verify reset token
      const payload = this.fastify.jwt.verify<ResetTokenPayload>(token);

      if (payload.type !== 'reset') {
        throw AuthErrors.INVALID_RESET_TOKEN;
      }

      // Get user
      const user = await this.userRepository.findById(payload.sub);

      if (!user) {
        throw AuthErrors.INVALID_RESET_TOKEN;
      }

      if (!user.isActive) {
        throw AuthErrors.USER_INACTIVE;
      }

      // Verify email matches (extra security)
      if (user.email !== payload.email) {
        throw AuthErrors.INVALID_RESET_TOKEN;
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, this.config.bcryptRounds);

      // Update password
      await this.userRepository.updatePassword(user.id, passwordHash);
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw AuthErrors.INVALID_RESET_TOKEN;
    }
  }
}
