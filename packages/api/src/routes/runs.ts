/**
 * Run Routes
 *
 * Handles test run operations including execution, listing, and management.
 * All routes require JWT authentication.
 */

import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import {
  RunnerService,
  RunError,
  createRunSchema,
  listRunsQuerySchema,
} from '../services/RunnerService.js';
import { RunRepository } from '../repositories/RunRepository.js';
import { RecordingRepository } from '../repositories/RecordingRepository.js';
import type { Database } from '../db/index.js';
import type { JobQueueManager } from '../queues/JobQueueManager.js';
import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Run routes options
 */
interface RunRoutesOptions {
  db: Database;
  jobQueueManager?: JobQueueManager;
  videoStoragePath?: string;
  screenshotStoragePath?: string;
}

/**
 * Handle Run errors
 */
function handleRunError(error: unknown, reply: FastifyReply): FastifyReply {
  if (error instanceof RunError) {
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
  console.error('Unexpected Run error:', error);

  return reply.status(500).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}

/**
 * Run routes plugin
 */
const runRoutes: FastifyPluginAsync<RunRoutesOptions> = async (fastify, options) => {
  const { db, jobQueueManager, videoStoragePath, screenshotStoragePath } = options;

  // Create repositories and service
  const runRepository = new RunRepository(db);
  const recordingRepository = new RecordingRepository(db);
  const runnerService = new RunnerService(runRepository, recordingRepository, jobQueueManager, {
    videoStoragePath,
    screenshotStoragePath,
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
   * POST /runs - Queue a new test run
   */
  fastify.post(
    '/',
    {
      schema: {
        body: {
          type: 'object',
          required: ['recordingId'],
          properties: {
            recordingId: { type: 'string', format: 'uuid' },
            browser: { type: 'string', enum: ['chromium', 'firefox', 'webkit'] },
            headless: { type: 'boolean' },
            videoEnabled: { type: 'boolean' },
            screenshotEnabled: { type: 'boolean' },
            timeout: { type: 'number', minimum: 1000, maximum: 600000 },
            timingEnabled: { type: 'boolean' },
            timingMode: { type: 'string', enum: ['realistic', 'fast', 'instant'] },
            speedMultiplier: { type: 'number', minimum: 0.1, maximum: 10 },
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
                  recordingId: { type: 'string' },
                  recordingName: { type: 'string' },
                  status: { type: 'string' },
                  browser: { type: 'string' },
                  headless: { type: 'boolean' },
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
        const validated = createRunSchema.parse(request.body);
        const run = await runnerService.queueRun(userId, validated);

        return reply.status(201).send({
          success: true,
          data: {
            id: run.id,
            recordingId: run.recordingId,
            recordingName: run.recordingName,
            status: run.status,
            browser: run.browser,
            headless: run.headless,
            jobId: run.jobId,
            createdAt: run.createdAt.toISOString(),
          },
        });
      } catch (error) {
        return handleRunError(error, reply);
      }
    }
  );

  /**
   * GET /runs - List user's runs
   */
  fastify.get(
    '/',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'number', minimum: 1 },
            limit: { type: 'number', minimum: 1, maximum: 100 },
            recordingId: { type: 'string', format: 'uuid' },
            status: { type: 'string' }, // Validated by Zod instead
            triggeredBy: { type: 'string' },
            sortBy: { type: 'string', enum: ['createdAt', 'startedAt', 'completedAt', 'status'] },
            sortOrder: { type: 'string', enum: ['asc', 'desc'] },
            includeDeleted: { type: 'boolean' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    recordingId: { type: 'string', nullable: true },
                    recordingName: { type: 'string' },
                    status: { type: 'string' },
                    browser: { type: 'string' },
                    actionsTotal: { type: 'number', nullable: true },
                    actionsExecuted: { type: 'number', nullable: true },
                    actionsFailed: { type: 'number', nullable: true },
                    durationMs: { type: 'number', nullable: true },
                    createdAt: { type: 'string' },
                  },
                },
              },
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'number' },
                  limit: { type: 'number' },
                  total: { type: 'number' },
                  totalPages: { type: 'number' },
                  hasNext: { type: 'boolean' },
                  hasPrevious: { type: 'boolean' },
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
        const query = listRunsQuerySchema.parse(request.query);
        const result = await runnerService.listRuns(userId, query);

        return reply.send({
          success: true,
          data: result.data.map((run) => ({
            id: run.id,
            recordingId: run.recordingId,
            recordingName: run.recordingName,
            recordingUrl: run.recordingUrl,
            status: run.status,
            browser: run.browser,
            actionsTotal: run.actionsTotal,
            actionsExecuted: run.actionsExecuted,
            actionsFailed: run.actionsFailed,
            durationMs: run.durationMs,
            startedAt: run.startedAt?.toISOString() ?? null,
            completedAt: run.completedAt?.toISOString() ?? null,
            triggeredBy: run.triggeredBy,
            createdAt: run.createdAt.toISOString(),
          })),
          pagination: result.pagination,
        });
      } catch (error) {
        return handleRunError(error, reply);
      }
    }
  );

  /**
   * GET /runs/:id - Get run details
   */
  fastify.get<{ Params: { id: string }; Querystring: { includeDeleted?: boolean } }>(
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
        querystring: {
          type: 'object',
          properties: {
            includeDeleted: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        const { id } = request.params;
        const includeDeleted = request.query.includeDeleted === true;

        const run = await runnerService.getRunById(userId, id, includeDeleted);

        return reply.send({
          success: true,
          data: {
            id: run.id,
            recordingId: run.recordingId,
            recordingName: run.recordingName,
            recordingUrl: run.recordingUrl,
            status: run.status,
            jobId: run.jobId,
            queueName: run.queueName,
            browser: run.browser,
            headless: run.headless,
            videoEnabled: run.videoEnabled,
            screenshotEnabled: run.screenshotEnabled,
            timeout: run.timeout,
            timingEnabled: run.timingEnabled,
            timingMode: run.timingMode,
            speedMultiplier: run.speedMultiplier,
            actionsTotal: run.actionsTotal,
            actionsExecuted: run.actionsExecuted,
            actionsFailed: run.actionsFailed,
            actionsSkipped: run.actionsSkipped,
            durationMs: run.durationMs,
            startedAt: run.startedAt?.toISOString() ?? null,
            completedAt: run.completedAt?.toISOString() ?? null,
            videoPath: run.videoPath,
            screenshotPaths: run.screenshotPaths,
            errorMessage: run.errorMessage,
            errorActionId: run.errorActionId,
            triggeredBy: run.triggeredBy,
            scheduleId: run.scheduleId,
            ciMetadata: run.ciMetadata,
            deletedAt: run.deletedAt?.toISOString() ?? null,
            createdAt: run.createdAt.toISOString(),
            updatedAt: run.updatedAt.toISOString(),
          },
        });
      } catch (error) {
        return handleRunError(error, reply);
      }
    }
  );

  /**
   * GET /runs/:id/actions - Get run's action results
   */
  fastify.get<{ Params: { id: string } }>(
    '/:id/actions',
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
        const { id } = request.params;

        const actions = await runnerService.getRunActions(userId, id);

        return reply.send({
          success: true,
          data: actions.map((action) => ({
            id: action.id,
            actionId: action.actionId,
            actionType: action.actionType,
            actionIndex: action.actionIndex,
            status: action.status,
            durationMs: action.durationMs,
            startedAt: action.startedAt?.toISOString() ?? null,
            completedAt: action.completedAt?.toISOString() ?? null,
            selectorUsed: action.selectorUsed,
            selectorValue: action.selectorValue,
            retryCount: action.retryCount,
            errorMessage: action.errorMessage,
            screenshotPath: action.screenshotPath,
            elementFound: action.elementFound,
            elementTagName: action.elementTagName,
            pageUrl: action.pageUrl,
            pageTitle: action.pageTitle,
          })),
        });
      } catch (error) {
        return handleRunError(error, reply);
      }
    }
  );

  /**
   * GET /runs/:id/video - Stream run video
   */
  fastify.get<{ Params: { id: string } }>(
    '/:id/video',
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
        const { id } = request.params;

        const run = await runnerService.getRunById(userId, id);

        if (!run.videoPath) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'VIDEO_NOT_FOUND',
              message: 'No video available for this run',
            },
          });
        }

        // Check if file exists
        const videoPath = run.videoPath;
        if (!fs.existsSync(videoPath)) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'VIDEO_FILE_NOT_FOUND',
              message: 'Video file not found on server',
            },
          });
        }

        // Get file stats for Content-Length
        const stat = fs.statSync(videoPath);
        const filename = path.basename(videoPath);

        // Set appropriate headers
        reply.header('Content-Type', 'video/webm');
        reply.header('Content-Length', stat.size);
        reply.header('Content-Disposition', `inline; filename="${filename}"`);

        // Stream the file
        const stream = fs.createReadStream(videoPath);
        return reply.send(stream);
      } catch (error) {
        return handleRunError(error, reply);
      }
    }
  );

  /**
   * POST /runs/:id/cancel - Cancel a running test
   */
  fastify.post<{ Params: { id: string } }>(
    '/:id/cancel',
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
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        const { id } = request.params;

        const run = await runnerService.cancelRun(userId, id);

        return reply.send({
          success: true,
          data: {
            id: run.id,
            status: run.status,
            completedAt: run.completedAt?.toISOString() ?? null,
          },
        });
      } catch (error) {
        return handleRunError(error, reply);
      }
    }
  );

  /**
   * DELETE /runs/:id - Soft delete a run
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
        const { id } = request.params;

        await runnerService.deleteRun(userId, id);

        return reply.status(204).send();
      } catch (error) {
        return handleRunError(error, reply);
      }
    }
  );

  /**
   * POST /runs/:id/restore - Restore a soft-deleted run
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
        const { id } = request.params;

        const run = await runnerService.restoreRun(userId, id);

        return reply.send({
          success: true,
          data: {
            id: run.id,
            status: run.status,
            deletedAt: null,
          },
        });
      } catch (error) {
        return handleRunError(error, reply);
      }
    }
  );

  /**
   * DELETE /runs/:id/permanent - Permanently delete a run
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
        const { id } = request.params;

        await runnerService.permanentlyDeleteRun(userId, id);

        return reply.status(204).send();
      } catch (error) {
        return handleRunError(error, reply);
      }
    }
  );
};

export default runRoutes;
