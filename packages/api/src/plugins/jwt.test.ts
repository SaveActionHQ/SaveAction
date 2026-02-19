/**
 * JWT Plugin Tests (Dual Auth: JWT + API Tokens)
 *
 * Tests the authentication plugin that supports both:
 * 1. Standard JWT tokens (from login)
 * 2. API tokens (sa_live_ and sa_test_ prefixed)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isApiToken,
  extractBearerToken,
  requireScopes,
  requireProjectAccess,
} from './jwt.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { RequestApiToken } from './jwt.js';

// ─── isApiToken() ───────────────────────────────────────────────────────────

describe('isApiToken', () => {
  it('should return true for sa_live_ prefix', () => {
    expect(isApiToken('sa_live_abc123')).toBe(true);
  });

  it('should return true for sa_test_ prefix', () => {
    expect(isApiToken('sa_test_xyz789')).toBe(true);
  });

  it('should return false for JWT tokens', () => {
    expect(isApiToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isApiToken('')).toBe(false);
  });

  it('should return false for random string', () => {
    expect(isApiToken('not-an-api-token')).toBe(false);
  });

  it('should return false for partial prefix', () => {
    expect(isApiToken('sa_liv')).toBe(false);
    expect(isApiToken('sa_')).toBe(false);
  });
});

// ─── extractBearerToken() ───────────────────────────────────────────────────

describe('extractBearerToken', () => {
  it('should extract token from valid Bearer header', () => {
    const request = {
      headers: { authorization: 'Bearer my-token-123' },
    } as FastifyRequest;
    expect(extractBearerToken(request)).toBe('my-token-123');
  });

  it('should return null if no authorization header', () => {
    const request = { headers: {} } as FastifyRequest;
    expect(extractBearerToken(request)).toBeNull();
  });

  it('should return null if authorization is not Bearer', () => {
    const request = {
      headers: { authorization: 'Basic dXNlcjpwYXNz' },
    } as FastifyRequest;
    expect(extractBearerToken(request)).toBeNull();
  });

  it('should extract API token from Bearer header', () => {
    const request = {
      headers: { authorization: 'Bearer sa_live_abc123def456' },
    } as FastifyRequest;
    expect(extractBearerToken(request)).toBe('sa_live_abc123def456');
  });

  it('should handle Bearer with empty token', () => {
    const request = {
      headers: { authorization: 'Bearer ' },
    } as FastifyRequest;
    expect(extractBearerToken(request)).toBe('');
  });
});

// ─── requireScopes() ───────────────────────────────────────────────────────

describe('requireScopes', () => {
  let mockReply: FastifyReply;
  let sendFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendFn = vi.fn();
    mockReply = {
      status: vi.fn().mockReturnValue({ send: sendFn }),
    } as unknown as FastifyReply;
  });

  it('should allow JWT-authenticated users (no apiToken) regardless of scopes', () => {
    const request = { apiToken: undefined } as FastifyRequest;
    const result = requireScopes(request, mockReply, ['recordings:read', 'recordings:write']);
    expect(result).toBe(true);
    expect(mockReply.status).not.toHaveBeenCalled();
  });

  it('should allow API token with matching scopes', () => {
    const request = {
      apiToken: {
        id: 'token-1',
        scopes: ['recordings:read', 'recordings:write', 'runs:read'],
        projectIds: ['*'],
      } as RequestApiToken,
    } as FastifyRequest;
    const result = requireScopes(request, mockReply, ['recordings:read']);
    expect(result).toBe(true);
    expect(mockReply.status).not.toHaveBeenCalled();
  });

  it('should allow API token with multiple required scopes all present', () => {
    const request = {
      apiToken: {
        id: 'token-1',
        scopes: ['recordings:read', 'recordings:write', 'runs:read'],
        projectIds: ['*'],
      } as RequestApiToken,
    } as FastifyRequest;
    const result = requireScopes(request, mockReply, ['recordings:read', 'recordings:write']);
    expect(result).toBe(true);
  });

  it('should deny API token missing required scope', () => {
    const request = {
      apiToken: {
        id: 'token-1',
        scopes: ['recordings:read'],
        projectIds: ['*'],
      } as RequestApiToken,
    } as FastifyRequest;
    const result = requireScopes(request, mockReply, ['recordings:write']);
    expect(result).toBe(false);
    expect(mockReply.status).toHaveBeenCalledWith(403);
    expect(sendFn).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'INSUFFICIENT_SCOPE',
        }),
      })
    );
  });

  it('should deny API token missing one of multiple required scopes', () => {
    const request = {
      apiToken: {
        id: 'token-1',
        scopes: ['recordings:read'],
        projectIds: ['*'],
      } as RequestApiToken,
    } as FastifyRequest;
    const result = requireScopes(request, mockReply, ['recordings:read', 'recordings:write']);
    expect(result).toBe(false);
  });

  it('should include required scopes in error message', () => {
    const request = {
      apiToken: {
        id: 'token-1',
        scopes: [],
        projectIds: ['*'],
      } as RequestApiToken,
    } as FastifyRequest;
    requireScopes(request, mockReply, ['runs:execute']);
    expect(sendFn).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: expect.stringContaining('runs:execute'),
        }),
      })
    );
  });
});

// ─── requireProjectAccess() ─────────────────────────────────────────────────

describe('requireProjectAccess', () => {
  let mockReply: FastifyReply;
  let sendFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendFn = vi.fn();
    mockReply = {
      status: vi.fn().mockReturnValue({ send: sendFn }),
    } as unknown as FastifyReply;
  });

  it('should allow JWT-authenticated users (no apiToken) for any project', () => {
    const request = { apiToken: undefined } as FastifyRequest;
    const result = requireProjectAccess(request, mockReply, 'project-123');
    expect(result).toBe(true);
    expect(mockReply.status).not.toHaveBeenCalled();
  });

  it('should allow API token with wildcard project access', () => {
    const request = {
      apiToken: {
        id: 'token-1',
        scopes: ['recordings:read'],
        projectIds: ['*'],
      } as RequestApiToken,
    } as FastifyRequest;
    const result = requireProjectAccess(request, mockReply, 'any-project-id');
    expect(result).toBe(true);
    expect(mockReply.status).not.toHaveBeenCalled();
  });

  it('should allow API token with specific project access', () => {
    const request = {
      apiToken: {
        id: 'token-1',
        scopes: ['recordings:read'],
        projectIds: ['project-123', 'project-456'],
      } as RequestApiToken,
    } as FastifyRequest;
    const result = requireProjectAccess(request, mockReply, 'project-123');
    expect(result).toBe(true);
  });

  it('should deny API token without project access', () => {
    const request = {
      apiToken: {
        id: 'token-1',
        scopes: ['recordings:read'],
        projectIds: ['project-123'],
      } as RequestApiToken,
    } as FastifyRequest;
    const result = requireProjectAccess(request, mockReply, 'project-999');
    expect(result).toBe(false);
    expect(mockReply.status).toHaveBeenCalledWith(403);
    expect(sendFn).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'PROJECT_ACCESS_DENIED',
        }),
      })
    );
  });

  it('should deny API token with empty projectIds', () => {
    const request = {
      apiToken: {
        id: 'token-1',
        scopes: ['recordings:read'],
        projectIds: [],
      } as RequestApiToken,
    } as FastifyRequest;
    const result = requireProjectAccess(request, mockReply, 'project-123');
    expect(result).toBe(false);
  });
});
