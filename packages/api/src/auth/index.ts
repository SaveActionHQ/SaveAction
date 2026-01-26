/**
 * Authentication module exports
 */

export { AuthService, AuthError, AuthErrors } from './AuthService.js';
export {
  registerSchema,
  loginSchema,
  refreshSchema,
  changePasswordSchema,
  type RegisterRequest,
  type LoginRequest,
  type RefreshRequest,
  type ChangePasswordRequest,
  type JwtPayload,
  type AccessTokenPayload,
  type RefreshTokenPayload,
  type AuthTokens,
  type UserResponse,
  type LoginResponse,
  type RegisterResponse,
  type TokenValidationResult,
  type PasswordOptions,
  type AuthConfig,
} from './types.js';
