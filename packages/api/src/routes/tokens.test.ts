/**
 * API Token Routes Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { ApiTokenError } from '../services/ApiTokenService.js';

// Setup mocks before importing routes
const mockCreateToken = vi.fn();
const mockListTokens = vi.fn();
const mockListActiveTokens = vi.fn();
const mockGetToken = vi.fn();
const mockRevokeToken = vi.fn();
const mockDeleteToken = vi.fn();

vi.mock('../services/ApiTokenService.js', () => ({
  ApiTokenService: vi.fn().mockImplementation(() => ({
    createToken: mockCreateToken,
    validateToken: vi.fn(),
    listTokens: mockListTokens,
    listActiveTokens: mockListActiveTokens,
    getToken: mockGetToken,
    revokeToken: mockRevokeToken,
    deleteToken: mockDeleteToken,
  })),
  ApiTokenError: class extends Error {
    code: string;
    statusCode: number;
    constructor(code: string, message: string, statusCode: number = 400) {
      super(message);
      this.name = 'ApiTokenError';
      this.code = code;
      this.statusCode = statusCode;
    }
  },
}));

vi.mock('../repositories/ApiTokenRepository.js', () => ({
  ApiTokenRepository: vi.fn().mockImplementation(() => ({})),
}));

describe('API Token Routes', () => {
  let app: FastifyInstance;
  const mockUser = { sub: 'user-123', email: 'test@example.com' };

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    app = Fastify();

    // Mock JWT verification
    app.decorate('jwt', {} as any);
    app.decorateRequest('jwtVerify', async function () {
      (this as any).user = mockUser;
    });
    app.decorateRequest('user', null);

    // Import routes dynamically after mocks are set up
    const { default: apiTokenRoutes } = await import('./tokens.js');

    // Register routes with mock db
    await app.register(apiTokenRoutes, {
      db: {} as any,
      maxTokensPerUser: 10,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /tokens', () => {
    it('should create a new token', async () => {
      mockCreateToken.mockResolvedValue({
        id: 'token-123',
        name: 'My API Token',
        token: 'sa_live_abc123',
        tokenPrefix: 'sa_live_',
        tokenSuffix: 'c123',
        scopes: ['recordings:read'],
        expiresAt: null,
        createdAt: new Date().toISOString(),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: {
          name: 'My API Token',
          scopes: ['recordings:read'],
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('My API Token');
      expect(mockCreateToken).toHaveBeenCalledWith('user-123', expect.any(Object));
    });

    it('should return 400 for invalid request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: {
          // Missing required 'name' field
          scopes: ['recordings:read'],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle service errors', async () => {
      mockCreateToken.mockRejectedValue(
        new ApiTokenError('TOKEN_LIMIT_EXCEEDED', 'Maximum number of tokens reached', 400)
      );

      const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: {
          name: 'My API Token',
          scopes: ['recordings:read'],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('TOKEN_LIMIT_EXCEEDED');
    });
  });

  describe('GET /tokens', () => {
    it('should list all tokens', async () => {
      mockListTokens.mockResolvedValue({
        tokens: [
          {
            id: 'token-123',
            name: 'Token 1',
            tokenPrefix: 'sa_live_',
            tokenSuffix: 'c123',
            scopes: ['recordings:read'],
            lastUsedAt: null,
            useCount: 0,
            expiresAt: null,
            revokedAt: null,
            createdAt: new Date().toISOString(),
          },
        ],
        total: 1,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.tokens).toHaveLength(1);
      expect(body.data.total).toBe(1);
      expect(mockListTokens).toHaveBeenCalledWith('user-123');
    });

    it('should list only active tokens when active=true', async () => {
      mockListActiveTokens.mockResolvedValue({
        tokens: [],
        total: 0,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/?active=true',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(mockListActiveTokens).toHaveBeenCalledWith('user-123');
    });
  });

  describe('GET /tokens/:id', () => {
    it('should get a specific token', async () => {
      mockGetToken.mockResolvedValue({
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        name: 'My Token',
        tokenPrefix: 'sa_live_',
        tokenSuffix: 'c123',
        scopes: ['recordings:read'],
        lastUsedAt: null,
        useCount: 5,
        expiresAt: null,
        revokedAt: null,
        createdAt: new Date().toISOString(),
      });

      const response = await app.inject({
        method: 'GET',
        url: '/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('My Token');
      expect(mockGetToken).toHaveBeenCalledWith('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'user-123');
    });

    it('should return 404 for non-existent token', async () => {
      mockGetToken.mockRejectedValue(new ApiTokenError('TOKEN_NOT_FOUND', 'Token not found', 404));

      const response = await app.inject({
        method: 'GET',
        url: '/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('TOKEN_NOT_FOUND');
    });
  });

  describe('POST /tokens/:id/revoke', () => {
    it('should revoke a token', async () => {
      mockRevokeToken.mockResolvedValue({
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        name: 'My Token',
        revokedAt: new Date().toISOString(),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/a1b2c3d4-e5f6-7890-abcd-ef1234567890/revoke',
        payload: {
          reason: 'No longer needed',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.revokedAt).toBeDefined();
      expect(mockRevokeToken).toHaveBeenCalledWith(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'user-123',
        'No longer needed'
      );
    });

    it('should revoke a token without reason', async () => {
      mockRevokeToken.mockResolvedValue({
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        name: 'My Token',
        revokedAt: new Date().toISOString(),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/a1b2c3d4-e5f6-7890-abcd-ef1234567890/revoke',
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(mockRevokeToken).toHaveBeenCalledWith(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'user-123',
        undefined
      );
    });

    it('should return error for already revoked token', async () => {
      mockRevokeToken.mockRejectedValue(
        new ApiTokenError('TOKEN_ALREADY_REVOKED', 'Token is already revoked', 400)
      );

      const response = await app.inject({
        method: 'POST',
        url: '/a1b2c3d4-e5f6-7890-abcd-ef1234567890/revoke',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('TOKEN_ALREADY_REVOKED');
    });
  });

  describe('DELETE /tokens/:id', () => {
    it('should delete a token', async () => {
      mockDeleteToken.mockResolvedValue(true);

      const response = await app.inject({
        method: 'DELETE',
        url: '/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.message).toBe('Token deleted successfully');
      expect(mockDeleteToken).toHaveBeenCalledWith(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'user-123'
      );
    });

    it('should return 404 for non-existent token', async () => {
      mockDeleteToken.mockRejectedValue(
        new ApiTokenError('TOKEN_NOT_FOUND', 'Token not found', 404)
      );

      const response = await app.inject({
        method: 'DELETE',
        url: '/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('TOKEN_NOT_FOUND');
    });
  });

  describe('Authentication', () => {
    it('should require authentication', async () => {
      const unauthApp = Fastify();

      // Mock JWT verification that fails
      unauthApp.decorate('jwt', {} as any);
      unauthApp.decorateRequest('jwtVerify', async function () {
        throw new Error('Unauthorized');
      });
      unauthApp.decorateRequest('user', null);

      const { default: apiTokenRoutes } = await import('./tokens.js');
      await unauthApp.register(apiTokenRoutes, {
        db: {} as any,
        maxTokensPerUser: 10,
      });

      const response = await unauthApp.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');

      await unauthApp.close();
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors', async () => {
      mockListTokens.mockRejectedValue(new Error('Unexpected database error'));

      const response = await app.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });
});
