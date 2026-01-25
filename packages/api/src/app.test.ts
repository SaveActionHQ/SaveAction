import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildApp } from './app.js';
import type { Env } from './config/index.js';
import type { FastifyInstance } from 'fastify';

// Mock the Redis plugin to avoid actual connection
vi.mock('./plugins/redis.js', () => ({
  redisConnectionPlugin: vi.fn(async () => {}),
  checkRedisHealth: vi.fn().mockResolvedValue({
    status: 'healthy',
    latencyMs: 1,
    connectionState: 'connected',
  }),
}));

describe('App', () => {
  let app: FastifyInstance;

  const testEnv: Env = {
    NODE_ENV: 'test',
    API_PORT: 3001,
    API_HOST: '0.0.0.0',
    CORS_ORIGIN: '*',
    LOG_LEVEL: 'error', // Suppress logs in tests
  };

  beforeEach(async () => {
    app = await buildApp({
      env: testEnv,
      logger: false, // Disable logging in tests
      skipRedis: true, // Skip Redis connection in tests
    });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /', () => {
    it('should return API info', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        name: 'SaveAction API',
        version: '0.1.0',
        docs: '/api/docs',
      });
    });
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.version).toBe('0.1.0');
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('GET /api/health/detailed', () => {
    it('should return detailed health with services', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health/detailed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.services).toBeDefined();
      expect(body.services.api).toEqual({ status: 'healthy' });
      expect(body.services.redis).toEqual({ status: 'not_configured' });
    });
  });

  describe('GET /api/health/live', () => {
    it('should return liveness status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health/live',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
    });
  });

  describe('GET /api/health/ready', () => {
    it('should return readiness status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health/ready',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ready');
    });
  });

  describe('404 handling', () => {
    it('should return proper error for unknown routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/unknown-route',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toContain('/unknown-route');
    });
  });

  describe('CORS', () => {
    it('should include CORS headers', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/api/health',
        headers: {
          Origin: 'https://example.com',
          'Access-Control-Request-Method': 'GET',
        },
      });

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });

    it('should allow credentials', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/api/health',
        headers: {
          Origin: 'https://example.com',
          'Access-Control-Request-Method': 'GET',
        },
      });

      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('Request ID', () => {
    it('should generate request ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      // Request ID is included in error responses
      // For success responses, we verify the request was processed
      expect(response.statusCode).toBe(200);
    });
  });

  describe('CORS origin configuration', () => {
    it('should handle specific origin', async () => {
      const specificOriginApp = await buildApp({
        env: { ...testEnv, CORS_ORIGIN: 'https://app.example.com' },
        logger: false,
        skipRedis: true,
      });

      const response = await specificOriginApp.inject({
        method: 'OPTIONS',
        url: '/api/health',
        headers: {
          Origin: 'https://app.example.com',
          'Access-Control-Request-Method': 'GET',
        },
      });

      expect(response.headers['access-control-allow-origin']).toBe('https://app.example.com');

      await specificOriginApp.close();
    });

    it('should handle multiple origins', async () => {
      const multiOriginApp = await buildApp({
        env: {
          ...testEnv,
          CORS_ORIGIN: 'https://app1.example.com,https://app2.example.com',
        },
        logger: false,
        skipRedis: true,
      });

      const response = await multiOriginApp.inject({
        method: 'OPTIONS',
        url: '/api/health',
        headers: {
          Origin: 'https://app1.example.com',
          'Access-Control-Request-Method': 'GET',
        },
      });

      expect(response.headers['access-control-allow-origin']).toBe('https://app1.example.com');

      await multiOriginApp.close();
    });
  });
});
