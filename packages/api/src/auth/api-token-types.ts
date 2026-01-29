/**
 * API Token Types
 *
 * Types, schemas, and scopes for API token management.
 */

import { z } from 'zod';

/**
 * Available API token scopes
 *
 * Format: resource:action
 * - recordings:read - View recordings
 * - recordings:write - Create/update/delete recordings
 * - runs:read - View run results
 * - runs:execute - Execute test runs
 * - schedules:read - View schedules
 * - schedules:write - Create/update/delete schedules
 * - webhooks:read - View webhooks
 * - webhooks:write - Create/update/delete webhooks
 */
export const API_TOKEN_SCOPES = [
  'recordings:read',
  'recordings:write',
  'runs:read',
  'runs:execute',
  'schedules:read',
  'schedules:write',
  'webhooks:read',
  'webhooks:write',
] as const;

export type ApiTokenScope = (typeof API_TOKEN_SCOPES)[number];

/**
 * Scope groups for convenience
 */
export const SCOPE_GROUPS = {
  /** Read-only access to all resources */
  readonly: ['recordings:read', 'runs:read', 'schedules:read', 'webhooks:read'] as ApiTokenScope[],
  /** Full access to recordings */
  recordings: ['recordings:read', 'recordings:write'] as ApiTokenScope[],
  /** Full access to runs */
  runs: ['runs:read', 'runs:execute'] as ApiTokenScope[],
  /** CI/CD typical needs */
  cicd: ['recordings:read', 'runs:read', 'runs:execute'] as ApiTokenScope[],
  /** All scopes */
  all: [...API_TOKEN_SCOPES] as ApiTokenScope[],
} as const;

/**
 * Check if a scope is valid
 */
export function isValidScope(scope: string): scope is ApiTokenScope {
  return API_TOKEN_SCOPES.includes(scope as ApiTokenScope);
}

/**
 * Validate an array of scopes
 */
export function validateScopes(scopes: string[]): { valid: boolean; invalid: string[] } {
  const invalid = scopes.filter((s) => !isValidScope(s));
  return { valid: invalid.length === 0, invalid };
}

/**
 * Check if a token has a required scope
 */
export function hasScope(tokenScopes: string[], requiredScope: ApiTokenScope): boolean {
  return tokenScopes.includes(requiredScope);
}

/**
 * Check if a token has all required scopes
 */
export function hasAllScopes(tokenScopes: string[], requiredScopes: ApiTokenScope[]): boolean {
  return requiredScopes.every((scope) => tokenScopes.includes(scope));
}

/**
 * Check if a token has any of the required scopes
 */
export function hasAnyScope(tokenScopes: string[], requiredScopes: ApiTokenScope[]): boolean {
  return requiredScopes.some((scope) => tokenScopes.includes(scope));
}

/**
 * Token prefix for live/production tokens
 */
export const TOKEN_PREFIX_LIVE = 'sa_live_';

/**
 * Token prefix for test tokens (future use)
 */
export const TOKEN_PREFIX_TEST = 'sa_test_';

/**
 * Create token request schema
 */
export const createTokenSchema = z.object({
  name: z
    .string()
    .min(1, 'Token name is required')
    .max(255, 'Token name must be at most 255 characters')
    .transform((val) => val.trim()),
  scopes: z
    .array(z.enum(API_TOKEN_SCOPES))
    .min(1, 'At least one scope is required')
    .default(['recordings:read', 'runs:read']),
  expiresAt: z
    .string()
    .datetime()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
});

/**
 * Revoke token request schema
 */
export const revokeTokenSchema = z.object({
  reason: z.string().max(255, 'Reason must be at most 255 characters').optional(),
});

/**
 * Inferred types from schemas
 */
export type CreateTokenRequest = z.infer<typeof createTokenSchema>;
export type RevokeTokenRequest = z.infer<typeof revokeTokenSchema>;

/**
 * API Token response (safe to send to client)
 */
export interface ApiTokenResponse {
  id: string;
  name: string;
  tokenPrefix: string;
  tokenSuffix: string;
  scopes: ApiTokenScope[];
  lastUsedAt: Date | null;
  useCount: number;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

/**
 * API Token creation response (includes full token - only shown once)
 */
export interface ApiTokenCreateResponse extends ApiTokenResponse {
  /** Full token - only returned on creation, never stored */
  token: string;
}

/**
 * API Token list response
 */
export interface ApiTokenListResponse {
  tokens: ApiTokenResponse[];
  total: number;
}

/**
 * Validated token (returned after authentication)
 */
export interface ValidatedApiToken {
  id: string;
  userId: string;
  name: string;
  scopes: ApiTokenScope[];
}
