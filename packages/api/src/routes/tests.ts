/**
 * Test Routes
 *
 * Handles test CRUD operations within a project.
 * All routes require JWT authentication.
 *
 * Routes are registered under /api/v1/projects/:projectId/tests
 */

import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import {
  TestService,
  TestError,
  createTestSchema,
  updateTestSchema,
  listTestsQuerySchema,
  moveTestsSchema,
  reorderTestsSchema,
} from '../services/TestService.js';
import { TestRepository } from '../repositories/TestRepository.js';
import { TestSuiteRepository } from '../repositories/TestSuiteRepository.js';
import { RecordingRepository } from '../repositories/RecordingRepository.js';
import type { Database } from '../db/index.js';
import { z } from 'zod';

/**
 * Test routes options
 */
interface TestRoutesOptions {
  db: Database;
  maxTestsPerProject?: number;
}

/**
 * Handle Test errors
 */
function handleTestError(error: unknown, reply: FastifyReply): FastifyReply {
  if (error instanceof TestError) {
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

  console.error('Unexpected Test error:', error);

  return reply.status(500).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}

/**
 * Test routes plugin
 */
const testRoutes: FastifyPluginAsync<TestRoutesOptions> = async (fastify, options) => {
  const { db, maxTestsPerProject } = options;

  // Create repositories and service
  const testRepository = new TestRepository(db);
  const testSuiteRepository = new TestSuiteRepository(db);
  const recordingRepository = new RecordingRepository(db);
  const testService = new TestService(testRepository, testSuiteRepository, recordingRepository, {
    maxTestsPerProject,
  });

  // All routes require authentication
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
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
   * POST /projects/:projectId/tests - Create a new test
   */
  fastify.post<{
    Params: { projectId: string };
  }>(
    '/',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name', 'recordingData'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string', maxLength: 2000, nullable: true },
            suiteId: { type: 'string', format: 'uuid' },
            recordingId: { type: 'string', format: 'uuid', nullable: true },
            recordingData: { type: 'object' },
            recordingUrl: { type: 'string', format: 'uri', maxLength: 2048, nullable: true },
            actionCount: { type: 'integer', minimum: 0 },
            browsers: {
              type: 'array',
              items: { type: 'string', enum: ['chromium', 'firefox', 'webkit'] },
              minItems: 1,
              maxItems: 3,
            },
            config: {
              type: 'object',
              properties: {
                headless: { type: 'boolean' },
                video: { type: 'boolean' },
                screenshot: { type: 'string', enum: ['on', 'off', 'only-on-failure'] },
                timeout: { type: 'integer', minimum: 1, maximum: 300000 },
                retries: { type: 'integer', minimum: 0, maximum: 5 },
                slowMo: { type: 'integer', minimum: 0, maximum: 5000 },
                viewport: {
                  type: 'object',
                  properties: {
                    width: { type: 'integer', minimum: 1, maximum: 7680 },
                    height: { type: 'integer', minimum: 1, maximum: 4320 },
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
        const userId = (request.user as { sub: string }).sub;
        const { projectId } = request.params;
        const result = await testService.createTest(
          userId,
          projectId,
          request.body as z.infer<typeof createTestSchema>
        );

        return reply.status(201).send({
          success: true,
          data: result,
        });
      } catch (error) {
        return handleTestError(error, reply);
      }
    }
  );

  /**
   * GET /projects/:projectId/tests - List tests with pagination
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
            suiteId: { type: 'string', format: 'uuid' },
            search: { type: 'string', maxLength: 255 },
            status: { type: 'string' },
            sortBy: {
              type: 'string',
              enum: ['name', 'displayOrder', 'createdAt', 'lastRunAt'],
            },
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
        const query = listTestsQuerySchema.parse(request.query);
        const result = await testService.listTests(userId, projectId, query);

        return reply.send({
          success: true,
          data: result.data,
          pagination: result.pagination,
        });
      } catch (error) {
        return handleTestError(error, reply);
      }
    }
  );

  /**
   * GET /projects/:projectId/tests/:testId - Get a test by ID (full detail)
   */
  fastify.get<{
    Params: { projectId: string; testId: string };
  }>(
    '/:testId',
    {
      schema: {
        params: {
          type: 'object',
          required: ['projectId', 'testId'],
          properties: {
            projectId: { type: 'string', format: 'uuid' },
            testId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        const result = await testService.getTest(userId, request.params.testId);

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        return handleTestError(error, reply);
      }
    }
  );

  /**
   * GET /projects/:projectId/tests/by-slug/:slug - Get a test by slug
   */
  fastify.get<{
    Params: { projectId: string; slug: string };
  }>(
    '/by-slug/:slug',
    {
      schema: {
        params: {
          type: 'object',
          required: ['projectId', 'slug'],
          properties: {
            projectId: { type: 'string', format: 'uuid' },
            slug: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        const { projectId, slug } = request.params;
        const result = await testService.getTestBySlug(userId, projectId, slug);

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        return handleTestError(error, reply);
      }
    }
  );

  /**
   * PUT /projects/:projectId/tests/:testId - Update a test
   */
  fastify.put<{
    Params: { projectId: string; testId: string };
  }>(
    '/:testId',
    {
      schema: {
        params: {
          type: 'object',
          required: ['projectId', 'testId'],
          properties: {
            projectId: { type: 'string', format: 'uuid' },
            testId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string', maxLength: 2000, nullable: true },
            suiteId: { type: 'string', format: 'uuid' },
            recordingData: { type: 'object' },
            recordingUrl: { type: 'string', format: 'uri', maxLength: 2048, nullable: true },
            actionCount: { type: 'integer', minimum: 0 },
            browsers: {
              type: 'array',
              items: { type: 'string', enum: ['chromium', 'firefox', 'webkit'] },
              minItems: 1,
              maxItems: 3,
            },
            config: { type: 'object' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        const result = await testService.updateTest(
          userId,
          request.params.testId,
          request.body as z.infer<typeof updateTestSchema>
        );

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        return handleTestError(error, reply);
      }
    }
  );

  /**
   * PUT /projects/:projectId/tests/move - Move tests between suites
   */
  fastify.put<{
    Params: { projectId: string };
  }>(
    '/move',
    {
      schema: {
        body: {
          type: 'object',
          required: ['testIds', 'targetSuiteId'],
          properties: {
            testIds: {
              type: 'array',
              items: { type: 'string', format: 'uuid' },
              minItems: 1,
            },
            targetSuiteId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        const { projectId } = request.params;
        const result = await testService.moveTests(
          userId,
          projectId,
          request.body as z.infer<typeof moveTestsSchema>
        );

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        return handleTestError(error, reply);
      }
    }
  );

  /**
   * PUT /projects/:projectId/tests/suites/:suiteId/reorder - Reorder tests within a suite
   */
  fastify.put<{
    Params: { projectId: string; suiteId: string };
  }>(
    '/suites/:suiteId/reorder',
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
          required: ['testIds'],
          properties: {
            testIds: {
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
        const { suiteId } = request.params;

        await testService.reorderTests(
          userId,
          suiteId,
          request.body as z.infer<typeof reorderTestsSchema>
        );

        return reply.send({
          success: true,
          message: 'Tests reordered successfully',
        });
      } catch (error) {
        return handleTestError(error, reply);
      }
    }
  );

  /**
   * DELETE /projects/:projectId/tests/:testId - Delete a test (soft delete)
   */
  fastify.delete<{
    Params: { projectId: string; testId: string };
  }>(
    '/:testId',
    {
      schema: {
        params: {
          type: 'object',
          required: ['projectId', 'testId'],
          properties: {
            projectId: { type: 'string', format: 'uuid' },
            testId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        await testService.deleteTest(userId, request.params.testId);

        return reply.status(204).send();
      } catch (error) {
        return handleTestError(error, reply);
      }
    }
  );
};

export default testRoutes;
