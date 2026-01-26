/**
 * Authentication Types
 *
 * Core types for the authentication system.
 */

import { z } from 'zod';

/**
 * Registration request schema
 */
export const registerSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .max(255, 'Email must be at most 255 characters')
    .transform((val) => val.toLowerCase().trim()),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one lowercase letter, one uppercase letter, and one number'
    ),
  name: z
    .string()
    .max(255, 'Name must be at most 255 characters')
    .optional()
    .transform((val) => val?.trim()),
});

/**
 * Login request schema
 */
export const loginSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .transform((val) => val.toLowerCase().trim()),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Refresh token request schema
 */
export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * Change password request schema
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one lowercase letter, one uppercase letter, and one number'
    ),
});

/**
 * Inferred types from schemas
 */
export type RegisterRequest = z.infer<typeof registerSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type RefreshRequest = z.infer<typeof refreshSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;

/**
 * JWT Payload structure
 */
export interface JwtPayload {
  sub: string; // User ID
  email: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

/**
 * Access token payload (extended)
 */
export interface AccessTokenPayload extends JwtPayload {
  type: 'access';
  name?: string;
}

/**
 * Refresh token payload
 */
export interface RefreshTokenPayload extends JwtPayload {
  type: 'refresh';
  tokenVersion: number; // For token invalidation
}

/**
 * Auth tokens response
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // Access token expiry in seconds
}

/**
 * User response (safe to send to client - no password)
 */
export interface UserResponse {
  id: string;
  email: string;
  name: string | null;
  emailVerifiedAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Login response
 */
export interface LoginResponse {
  user: UserResponse;
  tokens: AuthTokens;
}

/**
 * Register response
 */
export interface RegisterResponse {
  user: UserResponse;
  tokens: AuthTokens;
}

/**
 * Token validation result
 */
export interface TokenValidationResult {
  valid: boolean;
  payload?: JwtPayload;
  error?: string;
}

/**
 * Password validation options
 */
export interface PasswordOptions {
  minLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumbers?: boolean;
  requireSpecialChars?: boolean;
}

/**
 * Auth configuration
 */
export interface AuthConfig {
  jwtSecret: string;
  jwtRefreshSecret: string;
  accessTokenExpiry: string; // e.g., '15m'
  refreshTokenExpiry: string; // e.g., '7d'
  bcryptRounds: number;
  maxLoginAttempts: number;
  lockoutDuration: number; // in seconds
}
