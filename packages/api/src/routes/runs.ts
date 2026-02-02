/**
 * Run Routes
 *
 * Handles test run operations including execution, listing, and management.
 * All routes require JWT authentication.
 *
 * SSE Endpoint:
 * GET /runs/:id/progress/stream - Real-time progress updates via Server-Sent Events
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
import { subscribeToRunProgress, type RunProgressEvent } from '../services/RunProgressService.js';
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
  /** Redis URL for SSE progress streaming */
  redisUrl?: string;
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
  const { db, jobQueueManager, videoStoragePath, screenshotStoragePath, redisUrl } = options;

  // Create repositories and service
  const runRepository = new RunRepository(db);
  const recordingRepository = new RecordingRepository(db);
  const runnerService = new RunnerService(runRepository, recordingRepository, jobQueueManager, {
    videoStoragePath,
    screenshotStoragePath,
  });

  // All routes require authentication (except video/screenshot which handle their own auth)
  fastify.addHook('onRequest', async (request, reply) => {
    // Skip auth for video and screenshot endpoints - they handle auth via query param
    if (request.url.includes('/video') || request.url.includes('/screenshot')) {
      return;
    }

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
   * Supports token via query param for <video> element (can't set headers)
   */
  fastify.get<{ Params: { id: string }; Querystring: { token?: string } }>(
    '/:id/video',
    {
      // Skip normal preHandler auth - we'll handle it manually
      preHandler: async (request, reply) => {
        // Try to get token from query param (for video element)
        const queryToken = (request.query as { token?: string }).token;

        if (queryToken) {
          // Manually verify JWT from query param
          try {
            const decoded = fastify.jwt.verify(queryToken);
            (request as any).user = decoded;
          } catch {
            return reply.status(401).send({
              success: false,
              error: {
                code: 'INVALID_TOKEN',
                message: 'Invalid or expired token',
              },
            });
          }
        } else {
          // Fall back to standard auth header
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
        }
      },
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
            token: { type: 'string' },
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

        // Get origin for CORS
        const origin = request.headers.origin || 'http://localhost:3000';

        // Set CORS headers for cross-origin video streaming
        reply.header('Access-Control-Allow-Origin', origin);
        reply.header('Access-Control-Allow-Credentials', 'true');
        reply.header('Cross-Origin-Resource-Policy', 'cross-origin');

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
   * GET /runs/:id/actions/:actionId/screenshot - Serve action screenshot
   * Supports token via query param for <img> element (can't set headers)
   */
  fastify.get<{
    Params: { id: string; actionId: string };
    Querystring: { token?: string };
  }>(
    '/:id/actions/:actionId/screenshot',
    {
      // Skip normal preHandler auth - we'll handle it manually
      preHandler: async (request, reply) => {
        // Try to get token from query param (for img element)
        const queryToken = (request.query as { token?: string }).token;

        if (queryToken) {
          // Manually verify JWT from query param
          try {
            const decoded = fastify.jwt.verify(queryToken);
            (request as any).user = decoded;
          } catch {
            return reply.status(401).send({
              success: false,
              error: {
                code: 'INVALID_TOKEN',
                message: 'Invalid or expired token',
              },
            });
          }
        } else {
          // Fall back to standard auth header
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
        }
      },
      schema: {
        params: {
          type: 'object',
          required: ['id', 'actionId'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            actionId: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            token: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        const { id, actionId } = request.params;

        // Verify run belongs to user
        const run = await runnerService.getRunById(userId, id);
        if (!run) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'RUN_NOT_FOUND',
              message: 'Run not found',
            },
          });
        }

        // Get the specific action
        const action = await runRepository.findActionByRunIdAndActionId(id, actionId);
        if (!action) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'ACTION_NOT_FOUND',
              message: 'Action not found',
            },
          });
        }

        if (!action.screenshotPath) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'SCREENSHOT_NOT_FOUND',
              message: 'No screenshot available for this action',
            },
          });
        }

        // Check if file exists
        const screenshotPath = action.screenshotPath;
        if (!fs.existsSync(screenshotPath)) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'SCREENSHOT_FILE_NOT_FOUND',
              message: 'Screenshot file not found on server',
            },
          });
        }

        // Get file stats for Content-Length
        const stat = fs.statSync(screenshotPath);
        const filename = path.basename(screenshotPath);

        // Get origin for CORS
        const origin = request.headers.origin || 'http://localhost:3000';

        // Set CORS headers for cross-origin image loading
        reply.header('Access-Control-Allow-Origin', origin);
        reply.header('Access-Control-Allow-Credentials', 'true');
        reply.header('Cross-Origin-Resource-Policy', 'cross-origin');

        // Set appropriate headers for PNG image
        reply.header('Content-Type', 'image/png');
        reply.header('Content-Length', stat.size);
        reply.header('Content-Disposition', `inline; filename="${filename}"`);
        // Cache for 1 hour (screenshots are immutable)
        reply.header('Cache-Control', 'private, max-age=3600');

        // Stream the file
        const stream = fs.createReadStream(screenshotPath);
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

  /**
   * GET /runs/:id/progress/stream - Stream run progress via Server-Sent Events
   *
   * Returns a text/event-stream with real-time progress updates.
   * Events:
   * - run:started - Run has started
   * - action:started - Action is starting
   * - action:success - Action completed successfully
   * - action:failed - Action failed
   * - action:skipped - Action was skipped
   * - run:completed - Run finished
   * - run:error - Run encountered an error
   *
   * The stream closes automatically when run:completed or run:error is received.
   */
  fastify.get<{ Params: { id: string } }>(
    '/:id/progress/stream',
    {
      schema: {
        tags: ['Runs'],
        summary: 'Stream run progress via SSE',
        description:
          'Subscribe to real-time progress updates for a test run using Server-Sent Events (SSE). The stream automatically closes when the run completes or errors.',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'string',
            description: 'text/event-stream with progress events',
          },
          404: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
          503: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;
      const { id } = request.params;

      // Check if Redis is available for SSE
      if (!redisUrl) {
        return reply.status(503).send({
          success: false,
          error: {
            code: 'SSE_UNAVAILABLE',
            message: 'Real-time progress streaming is not available (Redis not configured)',
          },
        });
      }

      // Verify the run exists and belongs to the user
      const run = await runRepository.findById(id);
      if (!run) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'RUN_NOT_FOUND',
            message: 'Run not found',
          },
        });
      }

      if (run.userId !== userId) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'NOT_AUTHORIZED',
            message: 'Not authorized to access this run',
          },
        });
      }

      // Get origin from request for CORS
      const origin = request.headers.origin || '*';

      // If run is already completed, send a single completed event
      if (['passed', 'failed', 'cancelled'].includes(run.status)) {
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no', // Disable nginx buffering
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Credentials': 'true',
        });

        const completedEvent: RunProgressEvent = {
          type: 'run:completed',
          runId: id,
          timestamp: new Date().toISOString(),
          status: run.status as 'passed' | 'failed' | 'cancelled',
          durationMs: run.durationMs ?? 0,
          actionsExecuted: run.actionsExecuted ?? 0,
          actionsFailed: run.actionsFailed ?? 0,
          actionsSkipped: run.actionsSkipped ?? 0,
          videoPath: run.videoPath ?? undefined,
        };

        reply.raw.write(`event: ${completedEvent.type}\n`);
        reply.raw.write(`data: ${JSON.stringify(completedEvent)}\n\n`);
        reply.raw.end();
        return;
      }

      // Set SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
      });

      // Send initial comment to establish connection
      reply.raw.write(':ok\n\n');

      // Track if the stream should close
      let shouldClose = false;
      let unsubscribe: (() => Promise<void>) | null = null;

      // Handle client disconnect
      request.raw.on('close', async () => {
        shouldClose = true;
        if (unsubscribe) {
          await unsubscribe();
        }
      });

      try {
        // Subscribe to progress events
        unsubscribe = await subscribeToRunProgress(redisUrl, id, {
          onEvent: (event) => {
            if (shouldClose) return;

            // Write SSE event
            reply.raw.write(`event: ${event.type}\n`);
            reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);

            // Close stream on terminal events
            if (event.type === 'run:completed' || event.type === 'run:error') {
              shouldClose = true;
              reply.raw.end();
              unsubscribe?.();
            }
          },
          onError: (error) => {
            if (shouldClose) return;

            // Send error event
            const errorEvent: RunProgressEvent = {
              type: 'run:error',
              runId: id,
              timestamp: new Date().toISOString(),
              errorMessage: error.message,
            };
            reply.raw.write(`event: ${errorEvent.type}\n`);
            reply.raw.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
            reply.raw.end();
            shouldClose = true;
          },
          onClose: () => {
            if (!shouldClose) {
              reply.raw.end();
            }
          },
        });

        // Send keepalive comments every 30 seconds
        const keepaliveInterval = setInterval(() => {
          if (shouldClose) {
            clearInterval(keepaliveInterval);
            return;
          }
          try {
            reply.raw.write(':keepalive\n\n');
          } catch {
            // Client disconnected
            clearInterval(keepaliveInterval);
            shouldClose = true;
            unsubscribe?.();
          }
        }, 30000);

        // Wait for stream to complete (blocking)
        // The stream will end when shouldClose is set to true
        await new Promise<void>((resolve) => {
          const checkClosed = setInterval(() => {
            if (shouldClose) {
              clearInterval(checkClosed);
              clearInterval(keepaliveInterval);
              resolve();
            }
          }, 100);

          // Safety timeout after 10 minutes
          setTimeout(() => {
            if (!shouldClose) {
              shouldClose = true;
              clearInterval(checkClosed);
              clearInterval(keepaliveInterval);
              reply.raw.end();
              resolve();
            }
          }, 600000);
        });
      } catch (error) {
        // Subscription error
        fastify.log.error({ error, runId: id }, 'SSE subscription error');
        if (!shouldClose) {
          const errorEvent: RunProgressEvent = {
            type: 'run:error',
            runId: id,
            timestamp: new Date().toISOString(),
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          };
          reply.raw.write(`event: ${errorEvent.type}\n`);
          reply.raw.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
          reply.raw.end();
        }
      }
    }
  );
};

export default runRoutes;
