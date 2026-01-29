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

// API Token types and utilities
export {
  API_TOKEN_SCOPES,
  SCOPE_GROUPS,
  isValidScope,
  validateScopes,
  hasScope,
  hasAllScopes,
  hasAnyScope,
  TOKEN_PREFIX_LIVE,
  TOKEN_PREFIX_TEST,
  createTokenSchema,
  revokeTokenSchema,
  type ApiTokenScope,
  type CreateTokenRequest,
  type RevokeTokenRequest,
  type ApiTokenResponse,
  type ApiTokenCreateResponse,
  type ApiTokenListResponse,
  type ValidatedApiToken,
} from './api-token-types.js';
