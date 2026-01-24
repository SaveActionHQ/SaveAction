import type { FastifyInstance, FastifyError } from 'fastify';
import fp from 'fastify-plugin';
import { ZodError } from 'zod';
import { isApiError } from '../errors/index.js';
import type { ApiErrorResponse } from '../errors/index.js';

/**
 * Global error handler plugin for Fastify.
 * Converts all errors to standardized API response format.
 *
 * Uses fastify-plugin to break encapsulation so the error handler
 * applies to all routes registered after this plugin.
 */
async function errorHandlerPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.setErrorHandler((error: FastifyError, request, reply) => {
    const requestId = request.id;

    // Log error with context
    request.log.error(
      {
        err: error,
        requestId,
        url: request.url,
        method: request.method,
      },
      'Request error'
    );

    // Handle ApiError (our custom errors) - use duck typing for cross-module compatibility
    if (isApiError(error)) {
      const response = error.toResponse(requestId);
      return reply.code(error.statusCode).type('application/json').send(response);
    }

    // Handle Zod validation errors - use duck typing for cross-module compatibility
    // ZodError has a `errors` array and `name === 'ZodError'`
    const isZodError = (err: unknown): err is ZodError => {
      return (
        err !== null &&
        typeof err === 'object' &&
        'name' in err &&
        (err as Error).name === 'ZodError' &&
        'errors' in err &&
        Array.isArray((err as ZodError).errors)
      );
    };

    if (isZodError(error)) {
      const response: ApiErrorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: {
            issues: error.errors.map((e) => ({
              path: e.path.join('.'),
              message: e.message,
            })),
          },
          requestId,
        },
      };
      return reply.code(400).type('application/json').send(response);
    }

    // Handle Fastify validation errors (from schema validation)
    if (error.validation) {
      const response: ApiErrorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: {
            issues: error.validation.map((v) => ({
              path: v.instancePath || v.schemaPath,
              message: v.message || 'Invalid value',
            })),
          },
          requestId,
        },
      };
      return reply.code(400).type('application/json').send(response);
    }

    // Handle 404 Not Found
    if (error.statusCode === 404) {
      const response: ApiErrorResponse = {
        error: {
          code: 'NOT_FOUND',
          message: 'Resource not found',
          requestId,
        },
      };
      return reply.code(404).type('application/json').send(response);
    }

    // Handle other HTTP errors from Fastify
    if (error.statusCode && error.statusCode < 500) {
      const response: ApiErrorResponse = {
        error: {
          code: error.code || 'CLIENT_ERROR',
          message: error.message,
          requestId,
        },
      };
      return reply.code(error.statusCode).type('application/json').send(response);
    }

    // Default: Internal server error
    // Don't expose internal error details in production
    const isProduction = process.env.NODE_ENV === 'production';
    const response: ApiErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: isProduction ? 'Internal server error' : error.message,
        requestId,
      },
    };

    return reply.code(500).type('application/json').send(response);
  });

  // Handle 404 for unmatched routes
  fastify.setNotFoundHandler((request, reply) => {
    const response: ApiErrorResponse = {
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
        requestId: request.id,
      },
    };
    return reply.code(404).type('application/json').send(response);
  });
}

// Export with fastify-plugin to break encapsulation
export const errorHandler = fp(errorHandlerPlugin, {
  name: 'errorHandler',
});
