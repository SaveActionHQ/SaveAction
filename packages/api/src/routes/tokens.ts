/**
 * API Token Routes
 *
 * Handles API token generation, listing, and revocation.
 * All routes require JWT authentication.
 */

import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { ApiTokenService, ApiTokenError } from '../services/ApiTokenService.js';
import { ApiTokenRepository } from '../repositories/ApiTokenRepository.js';
import {
  createTokenSchema,
  revokeTokenSchema,
  type CreateTokenRequest,
  type RevokeTokenRequest,
} from '../auth/api-token-types.js';
import type { Database } from '../db/index.js';

/**
 * API Token routes options
 */
interface ApiTokenRoutesOptions {
  db: Database;
  maxTokensPerUser?: number;
}

/**
 * Handle API token errors
 */
function handleApiTokenError(error: unknown, reply: FastifyReply): FastifyReply {
  if (error instanceof ApiTokenError) {
    return reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }

  // Log unexpected errors
  console.error('Unexpected API token error:', error);

  return reply.status(500).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}

/**
 * API Token routes plugin
 */
const apiTokenRoutes: FastifyPluginAsync<ApiTokenRoutesOptions> = async (fastify, options) => {
  const { db, maxTokensPerUser = 10 } = options;

  // Create repository and service
  const tokenRepository = new ApiTokenRepository(db);
  const tokenService = new ApiTokenService(tokenRepository, { maxTokensPerUser });

  // All routes require JWT authentication only
  // API tokens cannot manage other API tokens (prevents token escalation)
  fastify.addHook('onRequest', async (request, reply) => {
    await fastify.authenticate(request, reply);

    // Block API token auth for token management routes
    if (request.apiToken) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'JWT_REQUIRED',
          message: 'API token management requires JWT authentication (login session)',
        },
      });
    }
  });

  /**
   * POST /tokens - Create a new API token
   */
  fastify.post<{ Body: CreateTokenRequest }>(
    '/',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            scopes: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
            },
            projectIds: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
            },
            expiresAt: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  token: { type: 'string' },
                  tokenPrefix: { type: 'string' },
                  tokenSuffix: { type: 'string' },
                  scopes: { type: 'array', items: { type: 'string' } },
                  projectIds: { type: 'array', items: { type: 'string' } },
                  expiresAt: { type: 'string', nullable: true },
                  createdAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const validatedData = createTokenSchema.parse(request.body);
        const userId = (request.user as { sub: string }).sub;

        const result = await tokenService.createToken(userId, validatedData);

        return reply.status(201).send({
          success: true,
          data: result,
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'ZodError') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request data',
              details: error,
            },
          });
        }
        return handleApiTokenError(error, reply);
      }
    }
  );

  /**
   * GET /tokens - List all tokens for the authenticated user
   */
  fastify.get(
    '/',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            active: { type: 'boolean' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  tokens: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        tokenPrefix: { type: 'string' },
                        tokenSuffix: { type: 'string' },
                        scopes: { type: 'array', items: { type: 'string' } },
                        projectIds: { type: 'array', items: { type: 'string' } },
                        lastUsedAt: { type: 'string', nullable: true },
                        useCount: { type: 'number' },
                        expiresAt: { type: 'string', nullable: true },
                        revokedAt: { type: 'string', nullable: true },
                        createdAt: { type: 'string' },
                      },
                    },
                  },
                  total: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        const { active } = request.query as { active?: boolean };

        const result = active
          ? await tokenService.listActiveTokens(userId)
          : await tokenService.listTokens(userId);

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        return handleApiTokenError(error, reply);
      }
    }
  );

  /**
   * GET /tokens/:id - Get a specific token
   */
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  tokenPrefix: { type: 'string' },
                  tokenSuffix: { type: 'string' },
                  scopes: { type: 'array', items: { type: 'string' } },
                  projectIds: { type: 'array', items: { type: 'string' } },
                  lastUsedAt: { type: 'string', nullable: true },
                  useCount: { type: 'number' },
                  expiresAt: { type: 'string', nullable: true },
                  revokedAt: { type: 'string', nullable: true },
                  createdAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        const { id } = request.params;

        const token = await tokenService.getToken(id, userId);

        return reply.send({
          success: true,
          data: token,
        });
      } catch (error) {
        return handleApiTokenError(error, reply);
      }
    }
  );

  /**
   * POST /tokens/:id/revoke - Revoke a token
   */
  fastify.post<{ Params: { id: string }; Body: RevokeTokenRequest }>(
    '/:id/revoke',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            reason: { type: 'string', maxLength: 255 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  revokedAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const validatedData = revokeTokenSchema.parse(request.body || {});
        const userId = (request.user as { sub: string }).sub;
        const { id } = request.params;

        const token = await tokenService.revokeToken(id, userId, validatedData.reason);

        return reply.send({
          success: true,
          data: {
            id: token.id,
            name: token.name,
            revokedAt: token.revokedAt,
          },
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'ZodError') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request data',
              details: error,
            },
          });
        }
        return handleApiTokenError(error, reply);
      }
    }
  );

  /**
   * DELETE /tokens/:id - Delete a token permanently
   */
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        const { id } = request.params;

        await tokenService.deleteToken(id, userId);

        return reply.send({
          success: true,
          data: {
            message: 'Token deleted successfully',
          },
        });
      } catch (error) {
        return handleApiTokenError(error, reply);
      }
    }
  );
};

export default apiTokenRoutes;
