/**
 * JWT Plugin for Fastify
 *
 * Configures @fastify/jwt and @fastify/cookie for authentication.
 */

import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import type { JwtPayload } from '../auth/types.js';

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
 * Extend Fastify types
 */
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    optionalAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    jwtPayload?: JwtPayload;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

/**
 * JWT plugin implementation
 */
const jwtPlugin: FastifyPluginAsync<JwtPluginOptions> = async (fastify, options) => {
  const { secret, cookieSecret = secret } = options;

  // Register cookie plugin for refresh token handling
  await fastify.register(cookie, {
    secret: cookieSecret,
    parseOptions: {},
  });

  // Register JWT plugin
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

  /**
   * Authentication decorator - requires valid JWT
   */
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = await request.jwtVerify<JwtPayload>();

      // Verify it's an access token
      if (payload.type !== 'access') {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'INVALID_TOKEN_TYPE',
            message: 'Invalid token type',
          },
        });
      }

      request.jwtPayload = payload;
    } catch (_err) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }
  });

  /**
   * Optional authentication decorator - attaches user if token present
   */
  fastify.decorate('optionalAuth', async (request: FastifyRequest, _reply: FastifyReply) => {
    try {
      const payload = await request.jwtVerify<JwtPayload>();

      if (payload.type === 'access') {
        request.jwtPayload = payload;
      }
    } catch {
      // Token invalid or not present - continue without auth
      request.jwtPayload = undefined;
    }
  });
};

export default fp(jwtPlugin, {
  fastify: '4.x',
  name: 'jwt-plugin',
});

export { jwtPlugin };
