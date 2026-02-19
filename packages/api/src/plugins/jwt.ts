/**
 * JWT Plugin for Fastify
 *
 * Configures @fastify/jwt for authentication with dual-auth support:
 * 1. JWT tokens (from login) - validated via @fastify/jwt
 * 2. API tokens (sa_live_ and sa_test_ prefixed) - validated via ApiTokenService
 *
 * Note: @fastify/cookie should be registered BEFORE this plugin.
 */

import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import type { JwtPayload } from '../auth/types.js';
import {
  TOKEN_PREFIX_LIVE,
  TOKEN_PREFIX_TEST,
  type ApiTokenScope,
  type ValidatedApiToken,
} from '../auth/api-token-types.js';
import type { ApiTokenService } from '../services/ApiTokenService.js';

/**
 * JWT plugin options
 */
interface JwtPluginOptions {
  secret: string;
  cookieSecret?: string;
  accessTokenExpiry?: string;
  refreshTokenExpiry?: string;
}

/**
 * API token metadata attached to request after API token auth
 */
export interface RequestApiToken {
  /** Token ID */
  id: string;
  /** Granted scopes */
  scopes: ApiTokenScope[];
  /** Accessible project IDs ("*" means all) */
  projectIds: string[];
}

/**
 * Extend Fastify types
 */
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    optionalAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    apiTokenService?: ApiTokenService;
  }

  interface FastifyRequest {
    jwtPayload?: JwtPayload;
    /** Set when request is authenticated via API token (not JWT) */
    apiToken?: RequestApiToken;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

/**
 * Check if a Bearer token is an API token (sa_live_* or sa_test_*)
 */
function isApiToken(token: string): boolean {
  return token.startsWith(TOKEN_PREFIX_LIVE) || token.startsWith(TOKEN_PREFIX_TEST);
}

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * JWT plugin implementation with dual-auth support
 */
const jwtPlugin: FastifyPluginAsync<JwtPluginOptions> = async (fastify, options) => {
  const { secret } = options;

  // Register JWT plugin
  // Note: @fastify/cookie must be registered before this plugin
  await fastify.register(jwt, {
    secret,
    sign: {
      algorithm: 'HS256',
    },
    verify: {
      algorithms: ['HS256'],
    },
    cookie: {
      cookieName: 'refreshToken',
      signed: true,
    },
  });

  // Decorate apiTokenService as null (set later in app.ts after DB init)
  fastify.decorate('apiTokenService', undefined);

  /**
   * Authentication decorator - supports both JWT and API tokens
   *
   * Flow:
   * 1. Extract Bearer token from Authorization header
   * 2. If token starts with sa_live_/sa_test_ → validate as API token
   * 3. Otherwise → validate as JWT
   * 4. On success, sets request.user, request.jwtPayload, and optionally request.apiToken
   */
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = extractBearerToken(request);

    // Check if it's an API token
    if (token && isApiToken(token)) {
      return authenticateApiToken(fastify, request, reply, token);
    }

    // Fall back to JWT authentication
    return authenticateJwt(request, reply);
  });

  /**
   * Optional authentication decorator - attaches user if token present (supports both auth types)
   */
  fastify.decorate('optionalAuth', async (request: FastifyRequest, _reply: FastifyReply) => {
    try {
      const token = extractBearerToken(request);

      if (token && isApiToken(token)) {
        // Try API token auth
        if (fastify.apiTokenService) {
          const validated = await fastify.apiTokenService.validateToken(token, request.ip);
          const payload: JwtPayload = {
            sub: validated.userId,
            email: '',
            type: 'access',
          };
          (request as unknown as Record<string, unknown>).user = payload;
          request.jwtPayload = payload;
          request.apiToken = {
            id: validated.id,
            scopes: validated.scopes,
            projectIds: validated.projectIds,
          };
        }
        return;
      }

      // Try JWT auth
      const payload = await request.jwtVerify<JwtPayload>();
      if (payload.type === 'access') {
        request.jwtPayload = payload;
      }
    } catch {
      // Token invalid or not present - continue without auth
      request.jwtPayload = undefined;
      request.apiToken = undefined;
    }
  });
};

/**
 * Authenticate using API token (sa_live_ or sa_test_ prefixed)
 */
async function authenticateApiToken(
  fastify: { apiTokenService?: ApiTokenService },
  request: FastifyRequest,
  reply: FastifyReply,
  token: string
): Promise<void> {
  // Ensure ApiTokenService is available (set after DB init in app.ts)
  if (!fastify.apiTokenService) {
    return reply.status(501).send({
      success: false,
      error: {
        code: 'API_TOKEN_AUTH_UNAVAILABLE',
        message: 'API token authentication is not configured',
      },
    }) as unknown as void;
  }

  try {
    const validated: ValidatedApiToken = await fastify.apiTokenService.validateToken(
      token,
      request.ip
    );

    // Create a JWT-compatible payload so downstream code works unchanged
    const payload: JwtPayload = {
      sub: validated.userId,
      email: '', // Not available from API token
      type: 'access',
    };

    // Set request.user (used by routes as: request.user.sub)
    (request as unknown as Record<string, unknown>).user = payload;
    request.jwtPayload = payload;

    // Attach API token metadata for scope/project checking
    request.apiToken = {
      id: validated.id,
      scopes: validated.scopes,
      projectIds: validated.projectIds,
    };
  } catch (err) {
    // Map ApiTokenError to HTTP response
    if (err && typeof err === 'object' && 'name' in err && err.name === 'ApiTokenError') {
      const apiErr = err as unknown as { message: string; code: string; statusCode: number };
      return reply.status(apiErr.statusCode).send({
        success: false,
        error: {
          code: apiErr.code,
          message: apiErr.message,
        },
      }) as unknown as void;
    }

    return reply.status(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired API token',
      },
    }) as unknown as void;
  }
}

/**
 * Authenticate using JWT (standard @fastify/jwt flow)
 */
async function authenticateJwt(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const payload = await request.jwtVerify<JwtPayload>();

    // Verify it's an access token (not refresh/reset)
    if (payload.type !== 'access') {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'INVALID_TOKEN_TYPE',
          message: 'Invalid token type',
        },
      }) as unknown as void;
    }

    request.jwtPayload = payload;
  } catch {
    return reply.status(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    }) as unknown as void;
  }
}

/**
 * Check if the current request has the required API token scopes.
 * JWT-authenticated users have full access (no scope restrictions).
 *
 * @returns true if authorized, false if reply was sent with 403
 */
export function requireScopes(
  request: FastifyRequest,
  reply: FastifyReply,
  requiredScopes: ApiTokenScope[]
): boolean {
  // JWT users have full access - no scope restrictions
  if (!request.apiToken) {
    return true;
  }

  // API token users must have all required scopes
  const hasAll = requiredScopes.every((scope) => request.apiToken!.scopes.includes(scope));

  if (!hasAll) {
    reply.status(403).send({
      success: false,
      error: {
        code: 'INSUFFICIENT_SCOPE',
        message: `API token requires scope(s): ${requiredScopes.join(', ')}`,
      },
    });
    return false;
  }

  return true;
}

/**
 * Check if the current API token has access to a specific project.
 * JWT-authenticated users have full access (no project restrictions).
 *
 * @returns true if authorized, false if reply was sent with 403
 */
export function requireProjectAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  projectId: string
): boolean {
  // JWT users have full access - no project restrictions
  if (!request.apiToken) {
    return true;
  }

  // Check if token has access to this project
  const { projectIds } = request.apiToken;
  const hasAccess = projectIds.includes('*') || projectIds.includes(projectId);

  if (!hasAccess) {
    reply.status(403).send({
      success: false,
      error: {
        code: 'PROJECT_ACCESS_DENIED',
        message: 'API token does not have access to this project',
      },
    });
    return false;
  }

  return true;
}

export default fp(jwtPlugin, {
  fastify: '4.x',
  name: 'jwt-plugin',
});

export { jwtPlugin, isApiToken, extractBearerToken };
