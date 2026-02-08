/**
 * Schedule Routes
 *
 * Handles scheduled test run operations.
 * All routes require JWT authentication.
 *
 * Endpoints:
 * - POST   /schedules           - Create a new schedule
 * - GET    /schedules           - List schedules
 * - GET    /schedules/:id       - Get schedule details
 * - PUT    /schedules/:id       - Update schedule
 * - POST   /schedules/:id/toggle - Toggle schedule status (active/paused)
 * - DELETE /schedules/:id       - Soft delete schedule
 * - POST   /schedules/:id/restore - Restore deleted schedule
 * - DELETE /schedules/:id/permanent - Permanently delete schedule
 */

import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import {
  ScheduleService,
  ScheduleError,
  createScheduleSchema,
  updateScheduleSchema,
} from '../services/ScheduleService.js';
import { ScheduleRepository } from '../repositories/ScheduleRepository.js';
import { RecordingRepository } from '../repositories/RecordingRepository.js';
import type { Database } from '../db/index.js';
import type { JobQueueManager } from '../queues/JobQueueManager.js';
import { z } from 'zod';

/**
 * Schedule routes options
 */
interface ScheduleRoutesOptions {
  db: Database;
  jobQueueManager?: JobQueueManager;
  maxSchedulesPerUser?: number;
}

/**
 * List schedules query params schema
 */
const listSchedulesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  sortBy: z.enum(['createdAt', 'name', 'nextRunAt', 'status']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  recordingId: z.string().uuid().optional(),
  status: z.enum(['active', 'paused', 'disabled', 'expired']).optional(),
  includeDeleted: z.coerce.boolean().optional(),
});

/**
 * Handle Schedule errors
 */
function handleScheduleError(error: unknown, reply: FastifyReply): FastifyReply {
  if (error instanceof ScheduleError) {
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
  console.error('Unexpected Schedule error:', error);

  return reply.status(500).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}

/**
 * Schedule routes plugin
 */
const scheduleRoutes: FastifyPluginAsync<ScheduleRoutesOptions> = async (fastify, options) => {
  const { db, jobQueueManager, maxSchedulesPerUser } = options;

  // Create repositories and service
  const scheduleRepository = new ScheduleRepository(db);
  const recordingRepository = new RecordingRepository(db);
  const scheduleService = new ScheduleService(
    scheduleRepository,
    recordingRepository,
    jobQueueManager,
    { maxSchedulesPerUser }
  );

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
   * POST /schedules - Create a new schedule
   */
  fastify.post(
    '/',
    {
      schema: {
        body: {
          type: 'object',
          required: ['recordingId', 'name', 'cronExpression'],
          properties: {
            recordingId: { type: 'string', format: 'uuid' },
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string', maxLength: 1000 },
            cronExpression: { type: 'string', minLength: 9, maxLength: 100 },
            timezone: { type: 'string', maxLength: 100 },
            runConfig: {
              type: 'object',
              properties: {
                browser: { type: 'string', enum: ['chromium', 'firefox', 'webkit'] },
                headless: { type: 'boolean' },
                timeout: { type: 'number', minimum: 1000, maximum: 600000 },
                viewport: {
                  type: 'object',
                  properties: {
                    width: { type: 'number', minimum: 100, maximum: 4096 },
                    height: { type: 'number', minimum: 100, maximum: 4096 },
                  },
                },
                retries: { type: 'number', minimum: 0, maximum: 5 },
                recordVideo: { type: 'boolean' },
                screenshotMode: { type: 'string', enum: ['on-failure', 'always', 'never'] },
              },
            },
            startsAt: { type: 'string', format: 'date-time' },
            endsAt: { type: 'string', format: 'date-time' },
            notifyOnFailure: { type: 'boolean' },
            notifyOnSuccess: { type: 'boolean' },
            notificationEmails: { type: 'string', maxLength: 500 },
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
                  cronExpression: { type: 'string' },
                  timezone: { type: 'string' },
                  status: { type: 'string' },
                  nextRunAt: { type: 'string', nullable: true },
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
        const validated = createScheduleSchema.parse(request.body);
        const schedule = await scheduleService.createSchedule(userId, validated);

        return reply.status(201).send({
          success: true,
          data: {
            id: schedule.id,
            name: schedule.name,
            recordingId: schedule.recordingId,
            cronExpression: schedule.cronExpression,
            timezone: schedule.timezone,
            status: schedule.status,
            nextRunAt: schedule.nextRunAt?.toISOString() ?? null,
            createdAt: schedule.createdAt.toISOString(),
          },
        });
      } catch (error) {
        return handleScheduleError(error, reply);
      }
    }
  );

  /**
   * GET /schedules - List schedules
   */
  fastify.get(
    '/',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            sortBy: { type: 'string', enum: ['createdAt', 'name', 'nextRunAt', 'status'] },
            sortOrder: { type: 'string', enum: ['asc', 'desc'] },
            recordingId: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['active', 'paused', 'disabled', 'expired'] },
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
                    name: { type: 'string' },
                    recordingId: { type: 'string' },
                    cronExpression: { type: 'string' },
                    timezone: { type: 'string' },
                    status: { type: 'string' },
                    browser: { type: 'string' },
                    headless: { type: 'boolean' },
                    recordVideo: { type: 'boolean' },
                    screenshotMode: { type: 'string' },
                    nextRunAt: { type: 'string', nullable: true },
                    lastRunAt: { type: 'string', nullable: true },
                    lastRunStatus: { type: 'string', nullable: true },
                    totalRuns: { type: 'number' },
                    successfulRuns: { type: 'number' },
                    failedRuns: { type: 'number' },
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
        const query = listSchedulesQuerySchema.parse(request.query);

        const result = await scheduleService.listSchedules(
          userId,
          {
            recordingId: query.recordingId,
            status: query.status,
            includeDeleted: query.includeDeleted,
          },
          {
            page: query.page,
            limit: query.limit,
            sortBy: query.sortBy,
            sortOrder: query.sortOrder,
          }
        );

        return reply.status(200).send({
          success: true,
          data: result.data.map((s) => ({
            id: s.id,
            name: s.name,
            recordingId: s.recordingId,
            cronExpression: s.cronExpression,
            timezone: s.timezone,
            status: s.status,
            // Flatten runConfig fields for frontend convenience
            browser: s.runConfig?.browser ?? 'chromium',
            headless: s.runConfig?.headless ?? true,
            recordVideo: s.runConfig?.recordVideo ?? false,
            screenshotMode: s.runConfig?.screenshotMode ?? 'on-failure',
            nextRunAt: s.nextRunAt?.toISOString() ?? null,
            lastRunAt: s.lastRunAt?.toISOString() ?? null,
            lastRunStatus: s.lastRunStatus,
            totalRuns: s.totalRuns,
            successfulRuns: s.successfulRuns,
            failedRuns: s.failedRuns,
            createdAt: s.createdAt.toISOString(),
          })),
          pagination: result.pagination,
        });
      } catch (error) {
        return handleScheduleError(error, reply);
      }
    }
  );

  /**
   * GET /schedules/:id - Get schedule details
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
                  recordingId: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string', nullable: true },
                  cronExpression: { type: 'string' },
                  timezone: { type: 'string' },
                  status: { type: 'string' },
                  runConfig: { type: 'object', nullable: true },
                  browser: { type: 'string' },
                  headless: { type: 'boolean' },
                  recordVideo: { type: 'boolean' },
                  screenshotMode: { type: 'string' },
                  startsAt: { type: 'string', nullable: true },
                  endsAt: { type: 'string', nullable: true },
                  nextRunAt: { type: 'string', nullable: true },
                  lastRunId: { type: 'string', nullable: true },
                  lastRunAt: { type: 'string', nullable: true },
                  lastRunStatus: { type: 'string', nullable: true },
                  totalRuns: { type: 'number' },
                  successfulRuns: { type: 'number' },
                  failedRuns: { type: 'number' },
                  runsToday: { type: 'number' },
                  runsThisMonth: { type: 'number' },
                  notifyOnFailure: { type: 'boolean' },
                  notifyOnSuccess: { type: 'boolean' },
                  notificationEmails: { type: 'string', nullable: true },
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
        const schedule = await scheduleService.getSchedule(userId, request.params.id);

        return reply.status(200).send({
          success: true,
          data: {
            id: schedule.id,
            recordingId: schedule.recordingId,
            name: schedule.name,
            description: schedule.description,
            cronExpression: schedule.cronExpression,
            timezone: schedule.timezone,
            status: schedule.status,
            runConfig: schedule.runConfig,
            // Flatten runConfig fields for frontend convenience
            browser: schedule.runConfig?.browser ?? 'chromium',
            headless: schedule.runConfig?.headless ?? true,
            recordVideo: schedule.runConfig?.recordVideo ?? false,
            screenshotMode: schedule.runConfig?.screenshotMode ?? 'on-failure',
            startsAt: schedule.startsAt?.toISOString() ?? null,
            endsAt: schedule.endsAt?.toISOString() ?? null,
            nextRunAt: schedule.nextRunAt?.toISOString() ?? null,
            lastRunId: schedule.lastRunId,
            lastRunAt: schedule.lastRunAt?.toISOString() ?? null,
            lastRunStatus: schedule.lastRunStatus,
            totalRuns: schedule.totalRuns,
            successfulRuns: schedule.successfulRuns,
            failedRuns: schedule.failedRuns,
            runsToday: schedule.runsToday,
            runsThisMonth: schedule.runsThisMonth,
            notifyOnFailure: schedule.notifyOnFailure,
            notifyOnSuccess: schedule.notifyOnSuccess,
            notificationEmails: schedule.notificationEmails,
            createdAt: schedule.createdAt.toISOString(),
            updatedAt: schedule.updatedAt.toISOString(),
          },
        });
      } catch (error) {
        return handleScheduleError(error, reply);
      }
    }
  );

  /**
   * PUT /schedules/:id - Update schedule
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
            description: { type: ['string', 'null'], maxLength: 1000 },
            cronExpression: { type: 'string', minLength: 9, maxLength: 100 },
            timezone: { type: 'string', maxLength: 100 },
            runConfig: {
              type: 'object',
              properties: {
                browser: { type: 'string', enum: ['chromium', 'firefox', 'webkit'] },
                headless: { type: 'boolean' },
                timeout: { type: 'number', minimum: 1000, maximum: 600000 },
                viewport: {
                  type: 'object',
                  properties: {
                    width: { type: 'number', minimum: 100, maximum: 4096 },
                    height: { type: 'number', minimum: 100, maximum: 4096 },
                  },
                },
                retries: { type: 'number', minimum: 0, maximum: 5 },
                recordVideo: { type: 'boolean' },
                screenshotMode: { type: 'string', enum: ['on-failure', 'always', 'never'] },
              },
            },
            startsAt: { type: ['string', 'null'], format: 'date-time' },
            endsAt: { type: ['string', 'null'], format: 'date-time' },
            notifyOnFailure: { type: 'boolean' },
            notifyOnSuccess: { type: 'boolean' },
            notificationEmails: { type: ['string', 'null'], maxLength: 500 },
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
                  cronExpression: { type: 'string' },
                  timezone: { type: 'string' },
                  status: { type: 'string' },
                  nextRunAt: { type: 'string', nullable: true },
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
        const validated = updateScheduleSchema.parse(request.body);
        const schedule = await scheduleService.updateSchedule(userId, request.params.id, validated);

        return reply.status(200).send({
          success: true,
          data: {
            id: schedule.id,
            name: schedule.name,
            cronExpression: schedule.cronExpression,
            timezone: schedule.timezone,
            status: schedule.status,
            nextRunAt: schedule.nextRunAt?.toISOString() ?? null,
            updatedAt: schedule.updatedAt.toISOString(),
          },
        });
      } catch (error) {
        return handleScheduleError(error, reply);
      }
    }
  );

  /**
   * POST /schedules/:id/toggle - Toggle schedule status
   */
  fastify.post<{ Params: { id: string } }>(
    '/:id/toggle',
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
                  status: { type: 'string' },
                  nextRunAt: { type: 'string', nullable: true },
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
        const schedule = await scheduleService.toggleSchedule(userId, request.params.id);

        return reply.status(200).send({
          success: true,
          data: {
            id: schedule.id,
            status: schedule.status,
            nextRunAt: schedule.nextRunAt?.toISOString() ?? null,
          },
        });
      } catch (error) {
        return handleScheduleError(error, reply);
      }
    }
  );

  /**
   * DELETE /schedules/:id - Soft delete schedule
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
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        await scheduleService.deleteSchedule(userId, request.params.id);

        return reply.status(200).send({
          success: true,
          message: 'Schedule deleted successfully',
        });
      } catch (error) {
        return handleScheduleError(error, reply);
      }
    }
  );

  /**
   * POST /schedules/:id/restore - Restore deleted schedule
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
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  status: { type: 'string' },
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
        const schedule = await scheduleService.restoreSchedule(userId, request.params.id);

        return reply.status(200).send({
          success: true,
          data: {
            id: schedule.id,
            status: schedule.status,
          },
        });
      } catch (error) {
        return handleScheduleError(error, reply);
      }
    }
  );

  /**
   * DELETE /schedules/:id/permanent - Permanently delete schedule
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
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        await scheduleService.permanentDeleteSchedule(userId, request.params.id);

        return reply.status(200).send({
          success: true,
          message: 'Schedule permanently deleted',
        });
      } catch (error) {
        return handleScheduleError(error, reply);
      }
    }
  );
};

export default scheduleRoutes;
