/**
 * Authentication Routes
 *
 * Handles user registration, login, logout, and token refresh.
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { AuthService, AuthError } from '../auth/AuthService.js';
import { UserRepository } from '../repositories/UserRepository.js';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  changePasswordSchema,
  type RegisterRequest,
  type LoginRequest,
  type RefreshRequest,
  type ChangePasswordRequest,
} from '../auth/types.js';
import type { Database } from '../db/index.js';

/**
 * Auth routes options
 */
interface AuthRoutesOptions {
  db: Database;
  jwtSecret: string;
  jwtRefreshSecret?: string;
  accessTokenExpiry?: string;
  refreshTokenExpiry?: string;
  bcryptRounds?: number;
  maxLoginAttempts?: number;
  lockoutDuration?: number;
}

/**
 * Get client IP from request
 */
function getClientIp(request: FastifyRequest): string | null {
  const forwarded = request.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return ips.trim();
  }
  return request.ip || null;
}

/**
 * Handle auth errors
 */
function handleAuthError(error: unknown, reply: FastifyReply): FastifyReply {
  if (error instanceof AuthError) {
    return reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }

  // Log unexpected errors
  console.error('Unexpected auth error:', error);

  return reply.status(500).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}

/**
 * Auth routes plugin
 */
const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (fastify, options) => {
  const {
    db,
    jwtSecret,
    jwtRefreshSecret = jwtSecret,
    accessTokenExpiry = '15m',
    refreshTokenExpiry = '7d',
    bcryptRounds = 12,
    maxLoginAttempts = 5,
    lockoutDuration = 900,
  } = options;

  // Create repository and service
  const userRepository = new UserRepository(db);
  const authService = new AuthService(fastify, userRepository, {
    jwtSecret,
    jwtRefreshSecret,
    accessTokenExpiry,
    refreshTokenExpiry,
    bcryptRounds,
    maxLoginAttempts,
    lockoutDuration,
  });

  /**
   * POST /auth/register - Register a new user
   */
  fastify.post<{ Body: RegisterRequest }>(
    '/register',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            name: { type: 'string' },
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
                  user: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      email: { type: 'string' },
                      name: { type: 'string', nullable: true },
                      emailVerifiedAt: { type: 'string', nullable: true },
                      isActive: { type: 'boolean' },
                      createdAt: { type: 'string' },
                      updatedAt: { type: 'string' },
                    },
                  },
                  tokens: {
                    type: 'object',
                    properties: {
                      accessToken: { type: 'string' },
                      refreshToken: { type: 'string' },
                      expiresIn: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        // Validate request body
        const validatedData = registerSchema.parse(request.body);
        const ip = getClientIp(request);

        const result = await authService.register(validatedData, ip);

        // Set refresh token as httpOnly cookie
        reply.setCookie('refreshToken', result.tokens.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/api/auth',
          maxAge: 7 * 24 * 60 * 60, // 7 days
        });

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
        return handleAuthError(error, reply);
      }
    }
  );

  /**
   * POST /auth/login - Login user
   */
  fastify.post<{ Body: LoginRequest }>(
    '/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
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
                  user: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      email: { type: 'string' },
                      name: { type: 'string', nullable: true },
                      emailVerifiedAt: { type: 'string', nullable: true },
                      isActive: { type: 'boolean' },
                      createdAt: { type: 'string' },
                      updatedAt: { type: 'string' },
                    },
                  },
                  tokens: {
                    type: 'object',
                    properties: {
                      accessToken: { type: 'string' },
                      refreshToken: { type: 'string' },
                      expiresIn: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        // Validate request body
        const validatedData = loginSchema.parse(request.body);
        const ip = getClientIp(request);

        const result = await authService.login(validatedData, ip);

        // Set refresh token as httpOnly cookie
        reply.setCookie('refreshToken', result.tokens.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/api/auth',
          maxAge: 7 * 24 * 60 * 60, // 7 days
        });

        return reply.status(200).send({
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
        return handleAuthError(error, reply);
      }
    }
  );

  /**
   * POST /auth/logout - Logout user
   */
  fastify.post('/logout', async (_request, reply) => {
    // Clear refresh token cookie
    reply.clearCookie('refreshToken', {
      path: '/api/auth',
    });

    return reply.status(200).send({
      success: true,
      data: {
        message: 'Logged out successfully',
      },
    });
  });

  /**
   * POST /auth/refresh - Refresh access token
   */
  fastify.post<{ Body: RefreshRequest }>(
    '/refresh',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            refreshToken: { type: 'string' },
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
                    type: 'object',
                    properties: {
                      accessToken: { type: 'string' },
                      refreshToken: { type: 'string' },
                      expiresIn: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        // Try to get refresh token from cookie first, then body
        let refreshToken = request.cookies?.refreshToken;

        if (!refreshToken && request.body?.refreshToken) {
          const validatedData = refreshSchema.parse(request.body);
          refreshToken = validatedData.refreshToken;
        }

        if (!refreshToken) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'MISSING_TOKEN',
              message: 'Refresh token is required',
            },
          });
        }

        const tokens = await authService.refresh(refreshToken);

        // Set new refresh token as httpOnly cookie
        reply.setCookie('refreshToken', tokens.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/api/auth',
          maxAge: 7 * 24 * 60 * 60, // 7 days
        });

        return reply.status(200).send({
          success: true,
          data: {
            tokens,
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
        return handleAuthError(error, reply);
      }
    }
  );

  /**
   * GET /auth/me - Get current user
   */
  fastify.get(
    '/me',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const userId = request.jwtPayload?.sub;

        if (!userId) {
          return reply.status(401).send({
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication required',
            },
          });
        }

        const user = await authService.getCurrentUser(userId);

        return reply.status(200).send({
          success: true,
          data: {
            user,
          },
        });
      } catch (error) {
        return handleAuthError(error, reply);
      }
    }
  );

  /**
   * POST /auth/change-password - Change password
   */
  fastify.post<{ Body: ChangePasswordRequest }>(
    '/change-password',
    {
      onRequest: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: { type: 'string' },
            newPassword: { type: 'string', minLength: 8 },
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
        const userId = request.jwtPayload?.sub;

        if (!userId) {
          return reply.status(401).send({
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication required',
            },
          });
        }

        // Validate request body
        const validatedData = changePasswordSchema.parse(request.body);

        await authService.changePassword(
          userId,
          validatedData.currentPassword,
          validatedData.newPassword
        );

        return reply.status(200).send({
          success: true,
          data: {
            message: 'Password changed successfully',
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
        return handleAuthError(error, reply);
      }
    }
  );
};

export default authRoutes;
export { authRoutes };
