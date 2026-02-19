/**
 * Test Suite Routes
 *
 * Handles test suite CRUD operations within a project.
 * All routes require JWT authentication.
 *
 * Routes are registered under /api/v1/projects/:projectId/suites
 */

import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import {
  TestSuiteService,
  TestSuiteError,
  createTestSuiteSchema,
  updateTestSuiteSchema,
  listTestSuitesQuerySchema,
  reorderTestSuitesSchema,
} from '../services/TestSuiteService.js';
import { TestSuiteRepository } from '../repositories/TestSuiteRepository.js';
import { TestRepository } from '../repositories/TestRepository.js';
import type { Database } from '../db/index.js';
import { requireScopes, requireProjectAccess } from '../plugins/jwt.js';
import { z } from 'zod';

/**
 * Suite routes options
 */
interface SuiteRoutesOptions {
  db: Database;
  maxSuitesPerProject?: number;
}

/**
 * Handle TestSuite errors
 */
function handleSuiteError(error: unknown, reply: FastifyReply): FastifyReply {
  if (error instanceof TestSuiteError) {
    return reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }

  if (error instanceof z.ZodError) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: error.errors,
      },
    });
  }

  console.error('Unexpected Suite error:', error);

  return reply.status(500).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}

/**
 * Suite routes plugin
 */
const suiteRoutes: FastifyPluginAsync<SuiteRoutesOptions> = async (fastify, options) => {
  const { db, maxSuitesPerProject } = options;

  // Create repositories and service
  const testSuiteRepository = new TestSuiteRepository(db);
  const testRepository = new TestRepository(db);
  const testSuiteService = new TestSuiteService(testSuiteRepository, {
    maxSuitesPerProject,
  });

  // All routes require authentication (JWT or API token)
  fastify.addHook('onRequest', async (request, reply) => {
    await fastify.authenticate(request, reply);

    // Scope enforcement for API token users
    if (request.apiToken) {
      const isRead = request.method === 'GET' || request.method === 'HEAD';
      const scope = isRead ? 'suites:read' : 'suites:write';
      if (!requireScopes(request, reply, [scope as 'suites:read' | 'suites:write'])) return;

      // Project access check for API tokens
      const projectId = (request.params as { projectId?: string })?.projectId;
      if (projectId && !requireProjectAccess(request, reply, projectId)) return;
    }
  });

  /**
   * POST /projects/:projectId/suites - Create a new test suite
   */
  fastify.post<{
    Params: { projectId: string };
  }>(
    '/',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string', maxLength: 2000, nullable: true },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        const { projectId } = request.params;
        const result = await testSuiteService.createTestSuite(
          userId,
          projectId,
          request.body as z.infer<typeof createTestSuiteSchema>
        );

        return reply.status(201).send({
          success: true,
          data: result,
        });
      } catch (error) {
        return handleSuiteError(error, reply);
      }
    }
  );

  /**
   * GET /projects/:projectId/suites - List suites with pagination
   */
  fastify.get<{
    Params: { projectId: string };
  }>(
    '/',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100 },
            search: { type: 'string', maxLength: 255 },
            sortBy: { type: 'string', enum: ['name', 'displayOrder', 'createdAt'] },
            sortOrder: { type: 'string', enum: ['asc', 'desc'] },
            includeDeleted: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        const { projectId } = request.params;
        const query = listTestSuitesQuerySchema.parse(request.query);
        const result = await testSuiteService.listTestSuites(userId, projectId, query);

        return reply.send({
          success: true,
          data: result.data,
          pagination: result.pagination,
        });
      } catch (error) {
        return handleSuiteError(error, reply);
      }
    }
  );

  /**
   * GET /projects/:projectId/suites/all - List all suites with stats (no pagination)
   */
  fastify.get<{
    Params: { projectId: string };
  }>(
    '/all',
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        const { projectId } = request.params;
        const result = await testSuiteService.listAllWithStats(userId, projectId);

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        return handleSuiteError(error, reply);
      }
    }
  );

  /**
   * GET /projects/:projectId/suites/:suiteId - Get a suite by ID
   */
  fastify.get<{
    Params: { projectId: string; suiteId: string };
  }>(
    '/:suiteId',
    {
      schema: {
        params: {
          type: 'object',
          required: ['projectId', 'suiteId'],
          properties: {
            projectId: { type: 'string', format: 'uuid' },
            suiteId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        const result = await testSuiteService.getTestSuite(userId, request.params.suiteId);

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        return handleSuiteError(error, reply);
      }
    }
  );

  /**
   * PUT /projects/:projectId/suites/:suiteId - Update a suite
   */
  fastify.put<{
    Params: { projectId: string; suiteId: string };
  }>(
    '/:suiteId',
    {
      schema: {
        params: {
          type: 'object',
          required: ['projectId', 'suiteId'],
          properties: {
            projectId: { type: 'string', format: 'uuid' },
            suiteId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string', maxLength: 2000, nullable: true },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        const result = await testSuiteService.updateTestSuite(
          userId,
          request.params.suiteId,
          request.body as z.infer<typeof updateTestSuiteSchema>
        );

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        return handleSuiteError(error, reply);
      }
    }
  );

  /**
   * PUT /projects/:projectId/suites/reorder - Reorder suites
   */
  fastify.put<{
    Params: { projectId: string };
  }>(
    '/reorder',
    {
      schema: {
        body: {
          type: 'object',
          required: ['suiteIds'],
          properties: {
            suiteIds: {
              type: 'array',
              items: { type: 'string', format: 'uuid' },
              minItems: 1,
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        const { projectId } = request.params;

        await testSuiteService.reorderTestSuites(
          userId,
          projectId,
          request.body as z.infer<typeof reorderTestSuitesSchema>
        );

        return reply.send({
          success: true,
          message: 'Suites reordered successfully',
        });
      } catch (error) {
        return handleSuiteError(error, reply);
      }
    }
  );

  /**
   * DELETE /projects/:projectId/suites/:suiteId - Delete a suite (soft delete)
   * Tests in the suite are moved to the default suite
   */
  fastify.delete<{
    Params: { projectId: string; suiteId: string };
  }>(
    '/:suiteId',
    {
      schema: {
        params: {
          type: 'object',
          required: ['projectId', 'suiteId'],
          properties: {
            projectId: { type: 'string', format: 'uuid' },
            suiteId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        const { projectId, suiteId } = request.params;

        // Move tests to default suite before deleting
        const testsInSuite = await testRepository.findAllBySuite(userId, suiteId);
        if (testsInSuite.length > 0) {
          const defaultSuite = await testSuiteRepository.getOrCreateDefaultSuite(
            userId,
            projectId
          );
          const testIds = testsInSuite.map((t) => t.id);
          await testRepository.moveToSuite(testIds, userId, defaultSuite.id);
        }

        await testSuiteService.deleteTestSuite(userId, projectId, suiteId);

        return reply.status(204).send();
      } catch (error) {
        return handleSuiteError(error, reply);
      }
    }
  );
};

export default suiteRoutes;
