/**
 * Schedule Routes Tests
 *
 * Tests the HTTP endpoints for schedule operations.
 * Uses service-level mocking for cleaner, more maintainable tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import type { SafeSchedule, ScheduleSummary } from '../repositories/ScheduleRepository.js';
import type { ScheduleStatus } from '../db/schema/schedules.js';

// Mock schedule data (SafeSchedule type)
const mockSafeSchedule: SafeSchedule = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  userId: 'user-123',
  recordingId: '550e8400-e29b-41d4-a716-446655440001',
  targetType: 'suite',
  testId: null,
  suiteId: '550e8400-e29b-41d4-a716-446655440010',
  name: 'Daily Test Run',
  description: 'Runs tests every day at 9 AM',
  cronExpression: '0 9 * * *',
  timezone: 'UTC',
  status: 'active' as ScheduleStatus,
  startsAt: null,
  endsAt: null,
  bullmqJobKey: 'schedule:550e8400',
  bullmqJobPattern: '0 9 * * *',
  runConfig: { browsers: ['chromium'], headless: true },
  maxConcurrent: 1,
  maxDailyRuns: null,
  runsToday: 0,
  runsThisMonth: 5,
  lastRunId: 'run-456',
  lastRunAt: new Date('2026-01-15T09:00:00Z'),
  lastRunStatus: 'passed',
  nextRunAt: new Date('2026-01-16T09:00:00Z'),
  totalRuns: 10,
  successfulRuns: 8,
  failedRuns: 2,
  notifyOnFailure: true,
  notifyOnSuccess: false,
  notificationEmails: 'test@example.com',
  deletedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-15T09:00:00Z'),
};

// Mock schedule summary data
const mockScheduleSummary: ScheduleSummary = {
  id: mockSafeSchedule.id,
  userId: mockSafeSchedule.userId,
  projectId: mockSafeSchedule.projectId,
  recordingId: mockSafeSchedule.recordingId,
  targetType: 'suite',
  testId: null,
  suiteId: '550e8400-e29b-41d4-a716-446655440010',
  name: mockSafeSchedule.name,
  cronExpression: mockSafeSchedule.cronExpression,
  timezone: mockSafeSchedule.timezone,
  status: mockSafeSchedule.status,
  runConfig: mockSafeSchedule.runConfig,
  nextRunAt: mockSafeSchedule.nextRunAt,
  lastRunAt: mockSafeSchedule.lastRunAt,
  lastRunStatus: mockSafeSchedule.lastRunStatus,
  totalRuns: mockSafeSchedule.totalRuns,
  successfulRuns: mockSafeSchedule.successfulRuns,
  failedRuns: mockSafeSchedule.failedRuns,
  createdAt: mockSafeSchedule.createdAt,
};

// Create mock schedule service factory (will be instantiated per test)
const createMockScheduleService = () => ({
  createSchedule: vi.fn(),
  getSchedule: vi.fn(),
  listSchedules: vi.fn(),
  updateSchedule: vi.fn(),
  toggleSchedule: vi.fn(),
  deleteSchedule: vi.fn(),
  restoreSchedule: vi.fn(),
  permanentDeleteSchedule: vi.fn(),
  syncSchedulesOnStartup: vi.fn(),
  updateAfterRun: vi.fn(),
});

// Mock the entire module - ScheduleError defined inline to avoid hoisting issues
vi.mock('../services/ScheduleService.js', () => {
  // Define ScheduleError class inside the mock factory
  class ScheduleError extends Error {
    constructor(
      message: string,
      public code: string,
      public statusCode: number = 400
    ) {
      super(message);
      this.name = 'ScheduleError';
    }
  }

  return {
    ScheduleService: vi.fn(),
    ScheduleError,
    createScheduleSchema: {
      parse: (data: unknown) => data,
    },
    updateScheduleSchema: {
      parse: (data: unknown) => data,
    },
  };
});

// Mock RunRepository to provide getRunStatsForSchedule
const mockGetRunStatsForSchedule = vi.fn().mockResolvedValue({ total: 10, passed: 8, failed: 2 });
vi.mock('../repositories/RunRepository.js', () => ({
  RunRepository: vi.fn().mockImplementation(() => ({
    getRunStatsForSchedule: mockGetRunStatsForSchedule,
  })),
}));

// Import after mocking
import scheduleRoutes from './schedules.js';
import { ScheduleService, ScheduleError } from '../services/ScheduleService.js';

describe('Schedule Routes', () => {
  let app: FastifyInstance;
  let mockService: ReturnType<typeof createMockScheduleService>;

  beforeEach(async () => {
    // Create fresh mock for each test
    mockService = createMockScheduleService();

    // Set up default mock implementations
    mockService.createSchedule.mockResolvedValue(mockSafeSchedule);
    mockService.getSchedule.mockResolvedValue(mockSafeSchedule);
    mockService.listSchedules.mockResolvedValue({
      data: [mockScheduleSummary],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      },
    });
    mockService.updateSchedule.mockResolvedValue(mockSafeSchedule);
    mockService.toggleSchedule.mockResolvedValue({
      ...mockSafeSchedule,
      status: 'paused' as ScheduleStatus,
    });
    mockService.deleteSchedule.mockResolvedValue(undefined);
    mockService.restoreSchedule.mockResolvedValue({
      ...mockSafeSchedule,
      deletedAt: null,
      status: 'paused' as ScheduleStatus,
    });
    mockService.permanentDeleteSchedule.mockResolvedValue(undefined);

    (ScheduleService as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => mockService);

    app = Fastify();

    // Mock JWT verification
    app.decorate('jwt', {} as any);
    app.decorateRequest('jwtVerify', async function () {
      (this as any).user = { sub: 'user-123', email: 'test@example.com' };
    });

    // Mock authenticate decorator (dual-auth: JWT + API tokens)
    app.decorate('authenticate', async function (request: any, reply: any) {
      try {
        await request.jwtVerify();
        request.jwtPayload = request.user;
      } catch {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }
    });

    // Register routes with mock db (not used since service is mocked)
    await app.register(scheduleRoutes, {
      prefix: '/api/schedules',
      db: {} as any,
      jobQueueManager: {} as any,
      maxSchedulesPerUser: 50,
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  // ============================================================
  // POST /api/schedules - Create Schedule
  // ============================================================
  describe('POST /api/schedules', () => {
    it('should create a schedule successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/schedules',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          targetType: 'suite',
          suiteId: '550e8400-e29b-41d4-a716-446655440010',
          projectId: '00000000-0000-0000-0000-000000000001',
          name: 'Daily Test Run',
          cronExpression: '0 9 * * *',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(mockSafeSchedule.id);
      expect(body.data.name).toBe('Daily Test Run');
      expect(body.data.cronExpression).toBe('0 9 * * *');
      expect(body.data.status).toBe('active');
    });

    it('should create a schedule with all optional fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/schedules',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          targetType: 'suite',
          suiteId: '550e8400-e29b-41d4-a716-446655440010',
          projectId: '00000000-0000-0000-0000-000000000001',
          name: 'Full Schedule',
          description: 'A fully configured schedule',
          cronExpression: '0 10 * * 1-5',
          timezone: 'America/New_York',
          runConfig: {
            browsers: ['firefox'],
            headless: false,
            timeout: 60000,
            retries: 2,
          },
          startsAt: '2026-02-01T00:00:00Z',
          endsAt: '2026-12-31T23:59:59Z',
          notifyOnFailure: true,
          notifyOnSuccess: true,
          notificationEmails: 'alerts@example.com',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(mockService.createSchedule).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          targetType: 'suite',
          suiteId: '550e8400-e29b-41d4-a716-446655440010',
          name: 'Full Schedule',
          cronExpression: '0 10 * * 1-5',
          timezone: 'America/New_York',
        })
      );
    });

    it('should return 404 when recording not found', async () => {
      mockService.createSchedule.mockRejectedValue(
        new ScheduleError('Suite not found', 'SUITE_NOT_FOUND', 404)
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/schedules',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          targetType: 'suite',
          suiteId: '550e8400-e29b-41d4-a716-446655440099',
          projectId: '00000000-0000-0000-0000-000000000001',
          name: 'Test',
          cronExpression: '0 9 * * *',
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('SUITE_NOT_FOUND');
    });

    it('should return 400 for invalid cron expression', async () => {
      mockService.createSchedule.mockRejectedValue(
        new ScheduleError('Invalid cron expression', 'INVALID_CRON', 400)
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/schedules',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          targetType: 'suite',
          suiteId: '550e8400-e29b-41d4-a716-446655440010',
          projectId: '00000000-0000-0000-0000-000000000001',
          name: 'Test',
          cronExpression: 'invalid cron',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('INVALID_CRON');
    });

    it('should return 400 for invalid timezone', async () => {
      mockService.createSchedule.mockRejectedValue(
        new ScheduleError('Invalid timezone', 'INVALID_TIMEZONE', 400)
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/schedules',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          targetType: 'suite',
          suiteId: '550e8400-e29b-41d4-a716-446655440010',
          projectId: '00000000-0000-0000-0000-000000000001',
          name: 'Test',
          cronExpression: '0 9 * * *',
          timezone: 'Invalid/Timezone',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('INVALID_TIMEZONE');
    });

    it('should return 400 when max schedules reached', async () => {
      mockService.createSchedule.mockRejectedValue(
        new ScheduleError('Maximum number of schedules reached', 'MAX_SCHEDULES_REACHED', 400)
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/schedules',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          targetType: 'suite',
          suiteId: '550e8400-e29b-41d4-a716-446655440010',
          projectId: '00000000-0000-0000-0000-000000000001',
          name: 'Test',
          cronExpression: '0 9 * * *',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('MAX_SCHEDULES_REACHED');
    });

    it('should return 401 without authentication', async () => {
      // Create app without JWT decoration
      const unauthApp = Fastify();
      unauthApp.decorateRequest('jwtVerify', async function () {
        throw new Error('Unauthorized');
      });

      // Mock authenticate decorator
      unauthApp.decorate('authenticate', async function (request: any, reply: any) {
        try {
          await request.jwtVerify();
          request.jwtPayload = request.user;
        } catch {
          return reply.status(401).send({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
          });
        }
      });

      await unauthApp.register(scheduleRoutes, {
        prefix: '/api/schedules',
        db: {} as any,
      });
      await unauthApp.ready();

      const response = await unauthApp.inject({
        method: 'POST',
        url: '/api/schedules',
        payload: {
          targetType: 'suite',
          suiteId: '550e8400-e29b-41d4-a716-446655440010',
          projectId: '00000000-0000-0000-0000-000000000001',
          name: 'Test',
          cronExpression: '0 9 * * *',
        },
      });

      expect(response.statusCode).toBe(401);
      await unauthApp.close();
    });
  });

  // ============================================================
  // GET /api/schedules - List Schedules
  // ============================================================
  describe('GET /api/schedules', () => {
    it('should list schedules', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/schedules?projectId=00000000-0000-0000-0000-000000000001',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe(mockSafeSchedule.id);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.total).toBe(1);
    });

    it('should filter schedules by status', async () => {
      mockService.listSchedules.mockResolvedValue({
        data: [{ ...mockScheduleSummary, status: 'paused' as ScheduleStatus }],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/schedules?projectId=00000000-0000-0000-0000-000000000001&status=paused',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data[0].status).toBe('paused');
    });

    it('should filter schedules by recording ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/schedules?projectId=00000000-0000-0000-0000-000000000001&recordingId=${mockSafeSchedule.recordingId}`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      expect(mockService.listSchedules).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          recordingId: mockSafeSchedule.recordingId,
        }),
        expect.anything()
      );
    });

    it('should paginate schedules', async () => {
      mockService.listSchedules.mockResolvedValue({
        data: [mockScheduleSummary],
        pagination: {
          page: 2,
          limit: 10,
          total: 50,
          totalPages: 5,
          hasNext: true,
          hasPrevious: true,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/schedules?projectId=00000000-0000-0000-0000-000000000001&page=2&limit=10',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.pagination.page).toBe(2);
      expect(body.pagination.limit).toBe(10);
      expect(body.pagination.total).toBe(50);
    });

    it('should sort schedules', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/schedules?projectId=00000000-0000-0000-0000-000000000001&sortBy=name&sortOrder=asc',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      expect(mockService.listSchedules).toHaveBeenCalledWith(
        'user-123',
        expect.anything(),
        expect.objectContaining({
          sortBy: 'name',
          sortOrder: 'asc',
        })
      );
    });

    it('should return empty list when no schedules', async () => {
      mockService.listSchedules.mockResolvedValue({
        data: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrevious: false,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/schedules?projectId=00000000-0000-0000-0000-000000000001',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data).toHaveLength(0);
      expect(body.pagination.total).toBe(0);
    });
  });

  // ============================================================
  // GET /api/schedules/:id - Get Schedule
  // ============================================================
  describe('GET /api/schedules/:id', () => {
    it('should get schedule by ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/schedules/${mockSafeSchedule.id}`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(mockSafeSchedule.id);
      expect(body.data.name).toBe(mockSafeSchedule.name);
      expect(body.data.cronExpression).toBe(mockSafeSchedule.cronExpression);
      expect(body.data.totalRuns).toBe(mockSafeSchedule.totalRuns);
    });

    it('should return 404 when schedule not found', async () => {
      mockService.getSchedule.mockRejectedValue(
        new ScheduleError('Schedule not found', 'SCHEDULE_NOT_FOUND', 404)
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/schedules/550e8400-e29b-41d4-a716-446655440099',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('SCHEDULE_NOT_FOUND');
    });

    it('should return 403 when not authorized', async () => {
      mockService.getSchedule.mockRejectedValue(
        new ScheduleError('Not authorized', 'NOT_AUTHORIZED', 403)
      );

      const response = await app.inject({
        method: 'GET',
        url: `/api/schedules/${mockSafeSchedule.id}`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('NOT_AUTHORIZED');
    });
  });

  // ============================================================
  // PUT /api/schedules/:id - Update Schedule
  // ============================================================
  describe('PUT /api/schedules/:id', () => {
    it('should update schedule successfully', async () => {
      const updatedSchedule = { ...mockSafeSchedule, name: 'Updated Name' };
      mockService.updateSchedule.mockResolvedValue(updatedSchedule);

      const response = await app.inject({
        method: 'PUT',
        url: `/api/schedules/${mockSafeSchedule.id}`,
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          name: 'Updated Name',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Updated Name');
    });

    it('should update cron expression', async () => {
      const updatedSchedule = { ...mockSafeSchedule, cronExpression: '0 10 * * *' };
      mockService.updateSchedule.mockResolvedValue(updatedSchedule);

      const response = await app.inject({
        method: 'PUT',
        url: `/api/schedules/${mockSafeSchedule.id}`,
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          cronExpression: '0 10 * * *',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockService.updateSchedule).toHaveBeenCalledWith(
        'user-123',
        mockSafeSchedule.id,
        expect.objectContaining({ cronExpression: '0 10 * * *' })
      );
    });

    it('should update timezone', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/schedules/${mockSafeSchedule.id}`,
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          timezone: 'Europe/London',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockService.updateSchedule).toHaveBeenCalledWith(
        'user-123',
        mockSafeSchedule.id,
        expect.objectContaining({ timezone: 'Europe/London' })
      );
    });

    it('should return 404 when schedule not found', async () => {
      mockService.updateSchedule.mockRejectedValue(
        new ScheduleError('Schedule not found', 'SCHEDULE_NOT_FOUND', 404)
      );

      const response = await app.inject({
        method: 'PUT',
        url: '/api/schedules/550e8400-e29b-41d4-a716-446655440099',
        headers: { authorization: 'Bearer valid-token' },
        payload: { name: 'Updated' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 400 for invalid cron expression', async () => {
      mockService.updateSchedule.mockRejectedValue(
        new ScheduleError('Invalid cron expression', 'INVALID_CRON', 400)
      );

      const response = await app.inject({
        method: 'PUT',
        url: `/api/schedules/${mockSafeSchedule.id}`,
        headers: { authorization: 'Bearer valid-token' },
        payload: { cronExpression: 'not-a-valid-cron' }, // 16 chars, passes schema but invalid cron
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('INVALID_CRON');
    });
  });

  // ============================================================
  // POST /api/schedules/:id/toggle - Toggle Schedule
  // ============================================================
  describe('POST /api/schedules/:id/toggle', () => {
    it('should toggle schedule from active to paused', async () => {
      mockService.toggleSchedule.mockResolvedValue({
        ...mockSafeSchedule,
        status: 'paused' as ScheduleStatus,
        nextRunAt: null,
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/schedules/${mockSafeSchedule.id}/toggle`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('paused');
    });

    it('should toggle schedule from paused to active', async () => {
      mockService.toggleSchedule.mockResolvedValue({
        ...mockSafeSchedule,
        status: 'active' as ScheduleStatus,
        nextRunAt: new Date('2026-01-16T09:00:00Z'),
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/schedules/${mockSafeSchedule.id}/toggle`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data.status).toBe('active');
      expect(body.data.nextRunAt).toBeDefined();
    });

    it('should return 404 when schedule not found', async () => {
      mockService.toggleSchedule.mockRejectedValue(
        new ScheduleError('Schedule not found', 'SCHEDULE_NOT_FOUND', 404)
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/schedules/550e8400-e29b-41d4-a716-446655440099/toggle',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 400 for invalid status transition', async () => {
      mockService.toggleSchedule.mockRejectedValue(
        new ScheduleError('Invalid status transition', 'INVALID_STATUS_TRANSITION', 400)
      );

      const response = await app.inject({
        method: 'POST',
        url: `/api/schedules/${mockSafeSchedule.id}/toggle`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });
  });

  // ============================================================
  // DELETE /api/schedules/:id - Soft Delete Schedule
  // ============================================================
  describe('DELETE /api/schedules/:id', () => {
    it('should soft delete schedule successfully', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/schedules/${mockSafeSchedule.id}`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Schedule deleted successfully');
      expect(mockService.deleteSchedule).toHaveBeenCalledWith('user-123', mockSafeSchedule.id);
    });

    it('should return 404 when schedule not found', async () => {
      mockService.deleteSchedule.mockRejectedValue(
        new ScheduleError('Schedule not found', 'SCHEDULE_NOT_FOUND', 404)
      );

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/schedules/550e8400-e29b-41d4-a716-446655440099',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 when not authorized', async () => {
      mockService.deleteSchedule.mockRejectedValue(
        new ScheduleError('Not authorized', 'NOT_AUTHORIZED', 403)
      );

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/schedules/${mockSafeSchedule.id}`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  // ============================================================
  // POST /api/schedules/:id/restore - Restore Schedule
  // ============================================================
  describe('POST /api/schedules/:id/restore', () => {
    it('should restore deleted schedule successfully', async () => {
      mockService.restoreSchedule.mockResolvedValue({
        ...mockSafeSchedule,
        deletedAt: null,
        status: 'paused' as ScheduleStatus,
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/schedules/${mockSafeSchedule.id}/restore`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('paused');
      expect(mockService.restoreSchedule).toHaveBeenCalledWith('user-123', mockSafeSchedule.id);
    });

    it('should return 404 when schedule not found', async () => {
      mockService.restoreSchedule.mockRejectedValue(
        new ScheduleError('Schedule not found', 'SCHEDULE_NOT_FOUND', 404)
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/schedules/550e8400-e29b-41d4-a716-446655440099/restore',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 400 when schedule is not deleted', async () => {
      mockService.restoreSchedule.mockRejectedValue(
        new ScheduleError('Schedule is not deleted', 'NOT_DELETED', 400)
      );

      const response = await app.inject({
        method: 'POST',
        url: `/api/schedules/${mockSafeSchedule.id}/restore`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('NOT_DELETED');
    });
  });

  // ============================================================
  // DELETE /api/schedules/:id/permanent - Permanent Delete
  // ============================================================
  describe('DELETE /api/schedules/:id/permanent', () => {
    it('should permanently delete schedule successfully', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/schedules/${mockSafeSchedule.id}/permanent`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Schedule permanently deleted');
      expect(mockService.permanentDeleteSchedule).toHaveBeenCalledWith(
        'user-123',
        mockSafeSchedule.id
      );
    });

    it('should return 404 when schedule not found', async () => {
      mockService.permanentDeleteSchedule.mockRejectedValue(
        new ScheduleError('Schedule not found', 'SCHEDULE_NOT_FOUND', 404)
      );

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/schedules/550e8400-e29b-41d4-a716-446655440099/permanent',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 when not authorized', async () => {
      mockService.permanentDeleteSchedule.mockRejectedValue(
        new ScheduleError('Not authorized', 'NOT_AUTHORIZED', 403)
      );

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/schedules/${mockSafeSchedule.id}/permanent`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  // ============================================================
  // Error Handling
  // ============================================================
  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      mockService.getSchedule.mockRejectedValue(new Error('Database connection failed'));

      const response = await app.inject({
        method: 'GET',
        url: `/api/schedules/${mockSafeSchedule.id}`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    it('should return proper error format for all error types', async () => {
      mockService.createSchedule.mockRejectedValue(
        new ScheduleError('Custom error', 'CUSTOM_ERROR', 422)
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/schedules',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          targetType: 'suite',
          suiteId: '550e8400-e29b-41d4-a716-446655440010',
          projectId: '00000000-0000-0000-0000-000000000001',
          name: 'Test',
          cronExpression: '0 9 * * *',
        },
      });

      expect(response.statusCode).toBe(422);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('CUSTOM_ERROR');
      expect(body.error.message).toBe('Custom error');
    });
  });

  // ============================================================
  // Response Format Verification
  // ============================================================
  describe('Response Format', () => {
    it('should return ISO date strings for date fields', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/schedules/${mockSafeSchedule.id}`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);

      // Verify date fields are ISO strings
      expect(body.data.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(body.data.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      if (body.data.nextRunAt) {
        expect(body.data.nextRunAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      }
    });

    it('should include all expected fields in schedule response', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/schedules/${mockSafeSchedule.id}`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);

      // Verify all expected fields are present
      expect(body.data).toHaveProperty('id');
      expect(body.data).toHaveProperty('targetType');
      expect(body.data).toHaveProperty('name');
      expect(body.data).toHaveProperty('cronExpression');
      expect(body.data).toHaveProperty('timezone');
      expect(body.data).toHaveProperty('status');
      expect(body.data).toHaveProperty('totalRuns');
      expect(body.data).toHaveProperty('successfulRuns');
      expect(body.data).toHaveProperty('failedRuns');
      expect(body.data).toHaveProperty('runsToday');
      expect(body.data).toHaveProperty('runsThisMonth');
      expect(body.data).toHaveProperty('notifyOnFailure');
      expect(body.data).toHaveProperty('notifyOnSuccess');
    });

    it('should include pagination in list response', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/schedules?projectId=00000000-0000-0000-0000-000000000001',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);

      expect(body.pagination).toHaveProperty('page');
      expect(body.pagination).toHaveProperty('limit');
      expect(body.pagination).toHaveProperty('total');
      expect(body.pagination).toHaveProperty('totalPages');
      expect(body.pagination).toHaveProperty('hasNext');
      expect(body.pagination).toHaveProperty('hasPrevious');
    });
  });
});
