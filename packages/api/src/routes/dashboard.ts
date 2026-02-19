/**
 * Dashboard Routes
 *
 * Provides aggregated dashboard data for the web UI.
 * All routes require JWT authentication.
 */

import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { DashboardService } from '../services/DashboardService.js';
import type { Database } from '../db/index.js';

/**
 * Dashboard routes options
 */
interface DashboardRoutesOptions {
  db: Database;
}

/**
 * Handle dashboard errors
 */
function handleError(error: unknown, reply: FastifyReply): FastifyReply {
  console.error('Dashboard error:', error);

  return reply.status(500).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}

/**
 * Dashboard routes plugin
 */
const dashboardRoutes: FastifyPluginAsync<DashboardRoutesOptions> = async (fastify, options) => {
  const { db } = options;
  const dashboardService = new DashboardService(db);

  // All routes require authentication (JWT or API token)
  // Dashboard is read-only; no specific scope required (any authenticated user/token can view)
  fastify.addHook('onRequest', async (request, reply) => {
    await fastify.authenticate(request, reply);
  });

  /**
   * GET / - Get complete dashboard data
   */
  fastify.get(
    '/',
    {
      schema: {
        tags: ['Dashboard'],
        summary: 'Get dashboard data',
        description: 'Returns aggregated dashboard statistics, recent runs, and upcoming schedules',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: {
                type: 'object',
                properties: {
                  stats: {
                    type: 'object',
                    properties: {
                      recordings: {
                        type: 'object',
                        properties: {
                          total: { type: 'integer' },
                        },
                      },
                      runs: {
                        type: 'object',
                        properties: {
                          total: { type: 'integer' },
                          passed: { type: 'integer' },
                          failed: { type: 'integer' },
                          cancelled: { type: 'integer' },
                          queued: { type: 'integer' },
                          running: { type: 'integer' },
                          passRate: { type: 'number' },
                        },
                      },
                      schedules: {
                        type: 'object',
                        properties: {
                          total: { type: 'integer' },
                          active: { type: 'integer' },
                          paused: { type: 'integer' },
                        },
                      },
                    },
                  },
                  recentRuns: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', format: 'uuid' },
                        runType: { type: 'string', nullable: true },
                        testName: { type: 'string', nullable: true },
                        recordingName: { type: 'string', nullable: true },
                        recordingUrl: { type: 'string', nullable: true },
                        status: { type: 'string' },
                        browser: { type: 'string' },
                        parentRunId: { type: 'string', nullable: true },
                        actionsTotal: { type: 'integer', nullable: true },
                        actionsExecuted: { type: 'integer', nullable: true },
                        actionsFailed: { type: 'integer', nullable: true },
                        durationMs: { type: 'integer', nullable: true },
                        triggeredBy: { type: 'string', nullable: true },
                        createdAt: { type: 'string', format: 'date-time' },
                        completedAt: { type: 'string', format: 'date-time', nullable: true },
                      },
                    },
                  },
                  upcomingSchedules: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', format: 'uuid' },
                        name: { type: 'string' },
                        targetType: { type: 'string' },
                        cronExpression: { type: 'string' },
                        nextRunAt: { type: 'string', format: 'date-time', nullable: true },
                        totalRuns: { type: 'integer' },
                        successfulRuns: { type: 'integer' },
                        failedRuns: { type: 'integer' },
                      },
                    },
                  },
                  runTrend: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        date: { type: 'string' },
                        total: { type: 'integer' },
                        passed: { type: 'integer' },
                        failed: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string', example: 'UNAUTHORIZED' },
                  message: { type: 'string', example: 'Authentication required' },
                },
              },
            },
          },
          500: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string', example: 'INTERNAL_ERROR' },
                  message: { type: 'string', example: 'An unexpected error occurred' },
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
        const { projectId } = (request.query as { projectId?: string }) || {};
        const data = await dashboardService.getDashboardData(userId, projectId);

        return reply.send({
          success: true,
          data,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  /**
   * GET /stats - Get dashboard statistics only
   */
  fastify.get(
    '/stats',
    {
      schema: {
        tags: ['Dashboard'],
        summary: 'Get dashboard statistics',
        description: 'Returns aggregated statistics for recordings, runs, and schedules',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: {
                type: 'object',
                properties: {
                  recordings: {
                    type: 'object',
                    properties: {
                      total: { type: 'integer' },
                    },
                  },
                  runs: {
                    type: 'object',
                    properties: {
                      total: { type: 'integer' },
                      passed: { type: 'integer' },
                      failed: { type: 'integer' },
                      cancelled: { type: 'integer' },
                      queued: { type: 'integer' },
                      running: { type: 'integer' },
                      passRate: { type: 'number' },
                    },
                  },
                  schedules: {
                    type: 'object',
                    properties: {
                      total: { type: 'integer' },
                      active: { type: 'integer' },
                      paused: { type: 'integer' },
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
        const userId = (request.user as { sub: string }).sub;
        const { projectId } = (request.query as { projectId?: string }) || {};
        const stats = await dashboardService.getStats(userId, projectId);

        return reply.send({
          success: true,
          data: stats,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );
};

export default dashboardRoutes;
