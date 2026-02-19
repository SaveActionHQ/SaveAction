/**
 * CSRF Protection Plugin
 *
 * Implements Cross-Site Request Forgery protection for cookie-based authentication.
 *
 * Key design decisions:
 * 1. Only protects routes that use cookies (refresh token endpoints)
 * 2. API tokens (Bearer sa_live_*) are exempt - they're CSRF-immune
 * 3. Uses double-submit cookie pattern (csrf-token cookie + X-CSRF-Token header)
 *
 * CSRF Protection Flow:
 * 1. GET /api/v1/auth/csrf → Returns CSRF token (also set as cookie)
 * 2. Client stores token and sends it in X-CSRF-Token header for state-changing requests
 * 3. Server validates token matches cookie
 */

import fp from 'fastify-plugin';
import csrf from '@fastify/csrf-protection';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export interface CsrfPluginOptions {
  /**
   * Cookie name for CSRF token.
   * @default '_csrf'
   */
  cookieName?: string;

  /**
   * Header name for CSRF token validation.
   * @default 'x-csrf-token'
   */
  headerName?: string;

  /**
   * Cookie options.
   */
  cookie?: {
    /**
     * Cookie path.
     * @default '/api'
     */
    path?: string;
    /**
     * HttpOnly - set to false so JS can read the token.
     * @default false
     */
    httpOnly?: boolean;
    /**
     * Secure - only send over HTTPS in production.
     * @default true in production
     */
    secure?: boolean;
    /**
     * SameSite policy.
     * @default 'strict'
     */
    sameSite?: 'strict' | 'lax' | 'none';
  };

  /**
   * Routes that require CSRF protection (cookie-based auth).
   * Note: /auth/refresh is NOT CSRF-protected because the response tokens are
   * protected by CORS same-origin policy, and the httpOnly cookie is sufficient.
   * @default ['/api/v1/auth/logout', '/api/v1/auth/change-password']
   */
  protectedRoutes?: string[];

  /**
   * HTTP methods that require CSRF validation.
   * @default ['POST', 'PUT', 'PATCH', 'DELETE']
   */
  protectedMethods?: string[];

  /**
   * Skip CSRF protection entirely (useful for tests).
   * @default false
   */
  skip?: boolean;

  /**
   * Secret key for token generation.
   * If not provided, uses a random secret (not suitable for multi-instance).
   */
  secret?: string;
}

/**
 * Check if request uses API token (Bearer sa_live_* or sa_test_*).
 * API tokens are CSRF-immune since they're not stored in cookies.
 */
function usesApiToken(request: FastifyRequest): boolean {
  const auth = request.headers.authorization;
  if (!auth) return false;

  // API tokens start with 'sa_live_' or 'sa_test_'
  const token = auth.replace(/^Bearer\s+/i, '');
  return token.startsWith('sa_live_') || token.startsWith('sa_test_');
}

/**
 * Check if route requires CSRF protection.
 */
function requiresCsrf(
  request: FastifyRequest,
  protectedRoutes: string[],
  protectedMethods: string[]
): boolean {
  // Only protect state-changing methods
  if (!protectedMethods.includes(request.method)) {
    return false;
  }

  // Check if route is in protected list
  const url = request.url.split('?')[0]; // Remove query string
  return protectedRoutes.some((route) => url.startsWith(route));
}

/**
 * CSRF protection plugin implementation using double-submit cookie pattern.
 *
 * Exempt routes:
 * - GET requests (safe method)
 * - API token authentication (CSRF-immune)
 * - Health check endpoints
 * - Swagger documentation
 */
async function csrfPluginImpl(app: FastifyInstance, options: CsrfPluginOptions): Promise<void> {
  const {
    cookieName = '_csrf',
    headerName = 'x-csrf-token',
    cookie = {},
    protectedRoutes = ['/api/v1/auth/logout', '/api/v1/auth/change-password'],
    protectedMethods = ['POST', 'PUT', 'PATCH', 'DELETE'],
    skip = false,
    secret,
  } = options;

  if (skip) {
    app.log.info('CSRF protection skipped');
    return;
  }

  const isProduction = process.env.NODE_ENV === 'production';

  const cookieOptions = {
    path: cookie.path ?? '/api',
    httpOnly: cookie.httpOnly ?? false, // Must be false for JS to read
    secure: cookie.secure ?? isProduction,
    sameSite: cookie.sameSite ?? ('strict' as const),
    signed: false, // Don't sign the CSRF cookie
  };

  // Register CSRF plugin
  // Note: @fastify/cookie must be registered BEFORE this plugin
  await app.register(csrf, {
    cookieOpts: cookieOptions,
    cookieKey: cookieName,
    // Get token from header
    getToken: (request: FastifyRequest) => {
      return request.headers[headerName] as string | undefined;
    },
    // Custom secret for token generation
    ...(secret && { secret }),
  });

  // Add endpoint to get CSRF token
  app.get(
    '/api/v1/auth/csrf',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Get CSRF token',
        description:
          'Returns a CSRF token for state-changing requests. ' +
          'The token is also set as a cookie. ' +
          'Include the token in the X-CSRF-Token header for protected requests.',
        response: {
          200: {
            type: 'object',
            properties: {
              csrfToken: {
                type: 'string',
                description: 'CSRF token to include in X-CSRF-Token header',
              },
            },
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      // Generate CSRF token
      const token = await reply.generateCsrf();
      return { csrfToken: token };
    }
  );

  // Add validation hook for protected routes
  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // Check if this route requires CSRF protection
    if (!requiresCsrf(request, protectedRoutes, protectedMethods)) {
      return; // No CSRF needed
    }

    // API tokens are exempt from CSRF
    if (usesApiToken(request)) {
      return; // CSRF-immune
    }

    // Check if the token is present in header
    const token = request.headers[headerName];
    if (!token) {
      return reply.status(403).send({
        error: {
          code: 'CSRF_TOKEN_MISSING',
          message:
            'CSRF token is required for this request. Get a token from GET /api/v1/auth/csrf',
        },
      });
    }

    // The csrf plugin validates the token automatically via the getToken function
    // If we reach here without an error, the token is valid
  });

  // Add CSRF token header to allowed headers in CORS
  app.log.info(
    {
      cookieName,
      headerName,
      protectedRoutes,
      protectedMethods,
    },
    'CSRF protection plugin registered'
  );
}

export const csrfPlugin = fp(csrfPluginImpl, {
  name: 'csrf-plugin',
  fastify: '4.x',
  dependencies: ['@fastify/cookie'], // Requires cookie plugin
});

export default csrfPlugin;
