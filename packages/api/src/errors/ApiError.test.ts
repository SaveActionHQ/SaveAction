import { describe, it, expect } from 'vitest';
import { ApiError, Errors, isApiError } from './ApiError.js';

describe('ApiError', () => {
  describe('constructor', () => {
    it('should create error with code and message', () => {
      const error = new ApiError('TEST_ERROR', 'Test message');

      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Test message');
      expect(error.statusCode).toBe(500); // default
      expect(error.details).toBeUndefined();
      expect(error.name).toBe('ApiError');
    });

    it('should create error with custom status code', () => {
      const error = new ApiError('NOT_FOUND', 'Not found', 404);

      expect(error.statusCode).toBe(404);
    });

    it('should create error with details', () => {
      const details = { field: 'email', reason: 'invalid format' };
      const error = new ApiError('VALIDATION_ERROR', 'Validation failed', 400, details);

      expect(error.details).toEqual(details);
    });

    it('should have proper stack trace', () => {
      const error = new ApiError('TEST', 'Test');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ApiError');
    });
  });

  describe('toResponse', () => {
    it('should return API response format', () => {
      const error = new ApiError('TEST_ERROR', 'Test message', 400);
      const response = error.toResponse();

      expect(response).toEqual({
        error: {
          code: 'TEST_ERROR',
          message: 'Test message',
        },
      });
    });

    it('should include details when present', () => {
      const error = new ApiError('VALIDATION_ERROR', 'Invalid', 400, { field: 'email' });
      const response = error.toResponse();

      expect(response.error.details).toEqual({ field: 'email' });
    });

    it('should include requestId when provided', () => {
      const error = new ApiError('TEST', 'Test', 500);
      const response = error.toResponse('req-123');

      expect(response.error.requestId).toBe('req-123');
    });

    it('should include both details and requestId', () => {
      const error = new ApiError('TEST', 'Test', 400, { foo: 'bar' });
      const response = error.toResponse('req-456');

      expect(response).toEqual({
        error: {
          code: 'TEST',
          message: 'Test',
          details: { foo: 'bar' },
          requestId: 'req-456',
        },
      });
    });
  });
});

describe('Errors factory functions', () => {
  it('should create badRequest error', () => {
    const error = Errors.badRequest('Invalid input');

    expect(error.code).toBe('BAD_REQUEST');
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('Invalid input');
  });

  it('should create badRequest error with details', () => {
    const error = Errors.badRequest('Invalid', { field: 'name' });

    expect(error.details).toEqual({ field: 'name' });
  });

  it('should create unauthorized error', () => {
    const error = Errors.unauthorized();

    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe('Authentication required');
  });

  it('should create unauthorized error with custom message', () => {
    const error = Errors.unauthorized('Token expired');

    expect(error.message).toBe('Token expired');
  });

  it('should create forbidden error', () => {
    const error = Errors.forbidden();

    expect(error.code).toBe('FORBIDDEN');
    expect(error.statusCode).toBe(403);
    expect(error.message).toBe('Access denied');
  });

  it('should create notFound error', () => {
    const error = Errors.notFound('Recording');

    expect(error.code).toBe('NOT_FOUND');
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe('Recording not found');
  });

  it('should create conflict error', () => {
    const error = Errors.conflict('Email already exists');

    expect(error.code).toBe('CONFLICT');
    expect(error.statusCode).toBe(409);
    expect(error.message).toBe('Email already exists');
  });

  it('should create validationError', () => {
    const details = { email: 'invalid format' };
    const error = Errors.validationError(details);

    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.statusCode).toBe(400);
    expect(error.details).toEqual(details);
  });

  it('should create rateLimited error', () => {
    const error = Errors.rateLimited(60);

    expect(error.code).toBe('RATE_LIMITED');
    expect(error.statusCode).toBe(429);
    expect(error.details).toEqual({ retryAfter: 60 });
  });

  it('should create rateLimited error without retryAfter', () => {
    const error = Errors.rateLimited();

    expect(error.details).toEqual({ retryAfter: undefined });
  });

  it('should create internal error', () => {
    const error = Errors.internal();

    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.statusCode).toBe(500);
    expect(error.message).toBe('Internal server error');
  });

  it('should create internal error with custom message', () => {
    const error = Errors.internal('Database connection failed');

    expect(error.message).toBe('Database connection failed');
  });
});

describe('isApiError', () => {
  it('should return true for ApiError instances', () => {
    const error = new ApiError('TEST', 'Test message');
    expect(isApiError(error)).toBe(true);
  });

  it('should return true for Errors factory results', () => {
    expect(isApiError(Errors.badRequest('test'))).toBe(true);
    expect(isApiError(Errors.unauthorized())).toBe(true);
    expect(isApiError(Errors.notFound('User'))).toBe(true);
  });

  it('should return false for regular Error', () => {
    const error = new Error('Regular error');
    expect(isApiError(error)).toBe(false);
  });

  it('should return false for null/undefined', () => {
    expect(isApiError(null)).toBe(false);
    expect(isApiError(undefined)).toBe(false);
  });

  it('should return false for plain objects', () => {
    const obj = { code: 'TEST', statusCode: 400, message: 'test' };
    expect(isApiError(obj)).toBe(false);
  });

  it('should return false for objects with wrong name', () => {
    const obj = {
      name: 'CustomError',
      code: 'TEST',
      statusCode: 400,
      toResponse: () => ({}),
    };
    expect(isApiError(obj)).toBe(false);
  });
});
