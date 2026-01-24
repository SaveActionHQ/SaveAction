import { describe, it, expect, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { errorHandler } from './errorHandler.js';
import { ApiError, Errors } from '../errors/index.js';

describe('Error Handler Plugin', () => {
  let app: FastifyInstance;

  /**
   * Helper to create a new Fastify app with error handler registered.
   */
  const createApp = async (): Promise<FastifyInstance> => {
    app = Fastify({ logger: false });
    await app.register(errorHandler);
    return app;
  };

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('ApiError handling', () => {
    it('should handle ApiError with correct status and format', async () => {
      await createApp();
      app.get('/test', async () => {
        throw new ApiError('TEST_ERROR', 'Test error message', 418);
      });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(418);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('TEST_ERROR');
      expect(body.error.message).toBe('Test error message');
      expect(body.error.requestId).toBeDefined();
    });

    it('should include details in ApiError response', async () => {
      await createApp();
      app.get('/test', async () => {
        throw Errors.validationError({ email: 'invalid format' });
      });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.details).toEqual({ email: 'invalid format' });
    });
  });

  describe('ZodError handling', () => {
    it('should handle ZodError as validation error', async () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().min(0),
      });

      await createApp();
      app.get('/test', async () => {
        schema.parse({ email: 'invalid', age: -5 });
      });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toBe('Validation failed');
      expect(body.error.details.issues).toBeDefined();
      expect(Array.isArray(body.error.details.issues)).toBe(true);
    });
  });

  describe('404 handling', () => {
    it('should return proper 404 for unknown routes', async () => {
      await createApp();
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/unknown',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toContain('/unknown');
    });

    it('should include method in 404 message', async () => {
      await createApp();
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: '/missing',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.message).toContain('POST');
      expect(body.error.message).toContain('/missing');
    });
  });

  describe('Generic error handling', () => {
    it('should handle generic errors as 500', async () => {
      await createApp();
      app.get('/test', async () => {
        throw new Error('Something went wrong');
      });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    it('should include error message in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      await createApp();
      app.get('/test', async () => {
        throw new Error('Detailed error info');
      });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      const body = JSON.parse(response.body);
      expect(body.error.message).toBe('Detailed error info');

      process.env.NODE_ENV = originalEnv;
    });

    it('should hide error message in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await createApp();
      app.get('/test', async () => {
        throw new Error('Sensitive error info');
      });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      const body = JSON.parse(response.body);
      expect(body.error.message).toBe('Internal server error');
      expect(body.error.message).not.toContain('Sensitive');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Request ID', () => {
    it('should include requestId in error responses', async () => {
      await createApp();
      app.get('/test', async () => {
        throw Errors.badRequest('Test error');
      });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      const body = JSON.parse(response.body);
      expect(body.error.requestId).toBeDefined();
      expect(typeof body.error.requestId).toBe('string');
    });
  });

  describe('Errors factory integration', () => {
    it('should handle unauthorized error', async () => {
      await createApp();
      app.get('/test', async () => {
        throw Errors.unauthorized();
      });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should handle forbidden error', async () => {
      await createApp();
      app.get('/test', async () => {
        throw Errors.forbidden('Not allowed');
      });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('FORBIDDEN');
      expect(body.error.message).toBe('Not allowed');
    });

    it('should handle notFound error', async () => {
      await createApp();
      app.get('/test', async () => {
        throw Errors.notFound('User');
      });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toBe('User not found');
    });

    it('should handle rateLimited error', async () => {
      await createApp();
      app.get('/test', async () => {
        throw Errors.rateLimited(30);
      });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(429);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('RATE_LIMITED');
      expect(body.error.details?.retryAfter).toBe(30);
    });
  });
});
