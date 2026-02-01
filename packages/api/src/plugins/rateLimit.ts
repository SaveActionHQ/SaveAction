/**
 * Rate Limiting Plugin
 *
 * Implements rate limiting with Redis store for multi-instance deployments.
 *
 * Rate limits:
 * - Default: 100 requests/minute per IP
 * - Authenticated users: 200 requests/minute
 * - Auth endpoints: 20 requests/minute (stricter to prevent brute force)
 *
 * Uses Redis for distributed rate limiting across multiple API instances.
 */

import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Redis } from 'ioredis';

export interface RateLimitPluginOptions {
  /**
   * Redis client instance for distributed rate limiting.
   * If not provided, uses in-memory store (not suitable for multi-instance).
   */
  redis?: Redis;

  /**
   * Global rate limit (requests per minute) for unauthenticated users.
   * @default 100
   */
  global?: number;

  /**
   * Rate limit for authenticated users (higher than unauthenticated).
   * @default 200
   */
  authenticated?: number;

  /**
   * Rate limit for auth endpoints (login, register, etc.) - stricter.
   * @default 20
   */
  auth?: number;

  /**
   * Time window in milliseconds.
   * @default 60000 (1 minute)
   */
  timeWindow?: number;

  /**
   * Skip rate limiting (useful for tests).
   * @default false
   */
  skip?: boolean;

  /**
   * Route prefixes for auth endpoints (stricter limits).
   * @default ['/api/v1/auth']
   */
  authPrefixes?: string[];

  /**
   * Routes to exclude from rate limiting.
   * @default ['/api/health', '/api/docs']
   */
  excludePrefixes?: string[];
}

/**
 * Get client identifier for rate limiting.
 * Uses X-Forwarded-For if behind a proxy, otherwise uses IP.
 */
function getClientKey(request: FastifyRequest): string {
  // Check for forwarded IP (behind proxy/load balancer)
  const forwarded = request.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return ips.trim();
  }

  // Fall back to direct IP
  return request.ip;
}

/**
 * Check if request is authenticated (has valid user context).
 */
function isAuthenticated(request: FastifyRequest): boolean {
  // Check if user object exists (set by JWT authentication)
  return !!(request as unknown as { user?: unknown }).user;
}

/**
 * Rate limit plugin implementation that applies different limits based on route and auth status.
 *
 * Architecture:
 * 1. Health/docs endpoints: No rate limiting
 * 2. Auth endpoints (/api/v1/auth/*): Strict 20/min
 * 3. Authenticated API calls: 200/min
 * 4. Unauthenticated API calls: 100/min
 */
async function rateLimitPluginImpl(
  app: FastifyInstance,
  options: RateLimitPluginOptions
): Promise<void> {
  const {
    redis,
    global = 100,
    authenticated = 200,
    auth = 20,
    timeWindow = 60000,
    skip = false,
    authPrefixes = ['/api/v1/auth'],
    excludePrefixes = ['/api/health', '/api/docs', '/api/queues'],
  } = options;

  if (skip) {
    app.log.info('Rate limiting skipped');
    return;
  }

  // Build Redis store configuration if Redis is provided
  const storeOptions = redis
    ? {
        redis,
        // Use rate-limit namespace to avoid conflicts
        nameSpace: 'rl:',
      }
    : undefined;

  if (redis) {
    app.log.info('Rate limiting using Redis store');
  } else {
    app.log.warn('Rate limiting using in-memory store (not suitable for multi-instance)');
  }

  // Register global rate limiter
  await app.register(rateLimit, {
    global: true,
    max: (request: FastifyRequest) => {
      const url = request.url;

      // No rate limiting for excluded routes
      for (const prefix of excludePrefixes) {
        if (url.startsWith(prefix)) {
          return Number.MAX_SAFE_INTEGER; // Effectively no limit
        }
      }

      // Stricter rate limiting for auth endpoints
      for (const prefix of authPrefixes) {
        if (url.startsWith(prefix)) {
          return auth;
        }
      }

      // Higher limit for authenticated users
      if (isAuthenticated(request)) {
        return authenticated;
      }

      // Default limit for unauthenticated users
      return global;
    },
    timeWindow,
    keyGenerator: getClientKey,
    // Redis store for distributed rate limiting
    redis: storeOptions?.redis,
    nameSpace: storeOptions?.nameSpace,
    // Standard rate limit headers
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    // Error response when limit exceeded
    errorResponseBuilder: (_request, context) => {
      return {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded. Try again in ${Math.ceil((context.ttl || 0) / 1000)} seconds.`,
          details: {
            limit: context.max,
            remaining: 0,
            resetInSeconds: Math.ceil((context.ttl || 0) / 1000),
          },
        },
      };
    },
    // Hook to run after successful rate limit check
    onExceeding: (request) => {
      app.log.debug(
        { ip: getClientKey(request), url: request.url },
        'Client approaching rate limit'
      );
    },
    onExceeded: (request) => {
      app.log.warn({ ip: getClientKey(request), url: request.url }, 'Client exceeded rate limit');
    },
  });

  app.log.info(
    {
      global,
      authenticated,
      auth,
      timeWindow,
      useRedis: !!redis,
    },
    'Rate limiting plugin registered'
  );
}

export const rateLimitPlugin = fp(rateLimitPluginImpl, {
  name: 'rate-limit-plugin',
  fastify: '4.x',
  dependencies: [], // Redis is optional
});

export default rateLimitPlugin;
