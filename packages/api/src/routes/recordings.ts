/**
 * Recording Routes
 *
 * Handles recording CRUD operations.
 * All routes require JWT authentication.
 */

import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import {
  RecordingService,
  RecordingError,
  createRecordingSchema,
  updateRecordingSchema,
  listRecordingsQuerySchema,
} from '../services/RecordingService.js';
import { RecordingRepository } from '../repositories/RecordingRepository.js';
import { ProjectRepository } from '../repositories/ProjectRepository.js';
import type { Database } from '../db/index.js';
import { requireScopes } from '../plugins/jwt.js';
import { z } from 'zod';

/**
 * Recording routes options
 */
interface RecordingRoutesOptions {
  db: Database;
  maxDataSizeBytes?: number;
  maxRecordingsPerUser?: number;
}

/**
 * Handle Recording errors
 */
function handleRecordingError(error: unknown, reply: FastifyReply): FastifyReply {
  if (error instanceof RecordingError) {
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

  // Log unexpected errors
  console.error('Unexpected Recording error:', error);

  return reply.status(500).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}

/**
 * Recording routes plugin
 */
const recordingRoutes: FastifyPluginAsync<RecordingRoutesOptions> = async (fastify, options) => {
  const { db, maxDataSizeBytes, maxRecordingsPerUser } = options;

  // Create repositories and service
  const recordingRepository = new RecordingRepository(db);
  const projectRepository = new ProjectRepository(db);
  const recordingService = new RecordingService(recordingRepository, projectRepository, {
    maxDataSizeBytes,
    maxRecordingsPerUser,
  });

  // All routes require authentication (JWT or API token)
  fastify.addHook('onRequest', async (request, reply) => {
    await fastify.authenticate(request, reply);

    // Scope enforcement for API token users (JWT users have full access)
    if (request.apiToken) {
      const isRead = request.method === 'GET' || request.method === 'HEAD';
      const scope = isRead ? 'recordings:read' : 'recordings:write';
      if (!requireScopes(request, reply, [scope as 'recordings:read' | 'recordings:write'])) return;
    }
  });

  /**
   * POST /recordings - Upload a new recording
   */
  fastify.post(
    '/',
    {
      schema: {
        body: {
          type: 'object',
          required: ['data'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string', maxLength: 2000, nullable: true },
            tags: { type: 'array', items: { type: 'string' }, maxItems: 20 },
            projectId: { type: 'string', format: 'uuid' },
            data: { type: 'object' },
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
                  projectId: { type: 'string', nullable: true },
                  originalId: { type: 'string', nullable: true },
                  name: { type: 'string' },
                  url: { type: 'string' },
                  description: { type: 'string', nullable: true },
                  tags: { type: 'array', items: { type: 'string' } },
                  actionCount: { type: 'number' },
                  estimatedDurationMs: { type: 'number', nullable: true },
                  schemaVersion: { type: 'string' },
                  dataSizeBytes: { type: 'number', nullable: true },
                  data: { type: 'object' },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
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
        const result = await recordingService.createRecording(
          userId,
          request.body as z.infer<typeof createRecordingSchema>
        );

        return reply.status(201).send({
          success: true,
          data: result,
        });
      } catch (error) {
        return handleRecordingError(error, reply);
      }
    }
  );

  /**
   * GET /recordings - List recordings with filtering and pagination
   */
  fastify.get(
    '/',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            projectId: { type: 'string', format: 'uuid' },
            page: { type: 'integer', minimum: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100 },
            search: { type: 'string', maxLength: 255 },
            tags: { type: 'string' },
            url: { type: 'string', maxLength: 2048 },
            sortBy: { type: 'string', enum: ['name', 'createdAt', 'updatedAt', 'actionCount'] },
            sortOrder: { type: 'string', enum: ['asc', 'desc'] },
            includeDeleted: { type: 'boolean' },
          },
          required: ['projectId'],
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        const query = listRecordingsQuerySchema.parse(request.query);
        const result = await recordingService.listRecordings(userId, query);

        return reply.send({
          success: true,
          data: result.data,
          pagination: result.pagination,
        });
      } catch (error) {
        return handleRecordingError(error, reply);
      }
    }
  );

  /**
   * GET /recordings/tags - Get all tags used by the user
   */
  fastify.get(
    '/tags',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        const tags = await recordingService.getTags(userId);

        return reply.send({
          success: true,
          data: tags,
        });
      } catch (error) {
        return handleRecordingError(error, reply);
      }
    }
  );

  /**
   * GET /recordings/:id - Get a specific recording
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
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        const result = await recordingService.getRecording(userId, request.params.id);

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        return handleRecordingError(error, reply);
      }
    }
  );

  /**
   * GET /recordings/:id/export - Download recording as JSON (for CLI)
   */
  fastify.get<{ Params: { id: string } }>(
    '/:id/export',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        const data = await recordingService.exportRecording(userId, request.params.id);

        // Set headers for JSON download
        reply.header('Content-Type', 'application/json');
        reply.header(
          'Content-Disposition',
          `attachment; filename="${data.testName || 'recording'}.json"`
        );

        return reply.send(data);
      } catch (error) {
        return handleRecordingError(error, reply);
      }
    }
  );

  /**
   * PUT /recordings/:id - Update a recording
   */
  fastify.put<{ Params: { id: string } }>(
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
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string', maxLength: 2000, nullable: true },
            tags: { type: 'array', items: { type: 'string' }, maxItems: 20 },
            data: { type: 'object' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        const result = await recordingService.updateRecording(
          userId,
          request.params.id,
          request.body as z.infer<typeof updateRecordingSchema>
        );

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        return handleRecordingError(error, reply);
      }
    }
  );

  /**
   * DELETE /recordings/:id - Soft delete a recording
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
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        await recordingService.deleteRecording(userId, request.params.id);

        return reply.send({
          success: true,
          message: 'Recording deleted successfully',
        });
      } catch (error) {
        return handleRecordingError(error, reply);
      }
    }
  );

  /**
   * POST /recordings/:id/restore - Restore a soft-deleted recording
   */
  fastify.post<{ Params: { id: string } }>(
    '/:id/restore',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        const result = await recordingService.restoreRecording(userId, request.params.id);

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        return handleRecordingError(error, reply);
      }
    }
  );

  /**
   * DELETE /recordings/:id/permanent - Permanently delete a recording
   */
  fastify.delete<{ Params: { id: string } }>(
    '/:id/permanent',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        await recordingService.permanentlyDeleteRecording(userId, request.params.id);

        return reply.send({
          success: true,
          message: 'Recording permanently deleted',
        });
      } catch (error) {
        return handleRecordingError(error, reply);
      }
    }
  );
};

export default recordingRoutes;
