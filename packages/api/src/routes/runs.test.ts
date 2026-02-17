/**
 * Run Routes Tests
 *
 * Tests the HTTP endpoints for run operations.
 * Uses service-level mocking for cleaner, more maintainable tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';

// Mock run data (SafeRun type)
const mockSafeRun = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  userId: 'user-123',
  recordingId: '550e8400-e29b-41d4-a716-446655440001',
  recordingName: 'Test Recording',
  recordingUrl: 'https://example.com',
  status: 'queued' as const,
  jobId: 'job-123',
  queueName: 'test-runs',
  browser: 'chromium' as const,
  headless: true,
  videoEnabled: false,
  screenshotEnabled: false,
  timeout: 30000,
  timingEnabled: true,
  timingMode: 'realistic' as const,
  speedMultiplier: 1.0,
  actionsTotal: null,
  actionsExecuted: null,
  actionsFailed: null,
  actionsSkipped: null,
  durationMs: null,
  startedAt: null,
  completedAt: null,
  videoPath: null,
  screenshotPaths: null,
  errorMessage: null,
  errorStack: null,
  errorActionId: null,
  triggeredBy: 'manual' as const,
  scheduleId: null,
  ciMetadata: null,
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  runType: null as string | null,
  testId: null as string | null,
  suiteId: null as string | null,
  testName: null as string | null,
  testSlug: null as string | null,
};

// Mock test run data (for POST /runs/test)
const TEST_UUID = '00000000-0000-0000-0000-000000000010';
const SUITE_UUID = '00000000-0000-0000-0000-000000000020';
const PROJECT_UUID = '00000000-0000-0000-0000-000000000030';

const mockTestRun = {
  ...mockSafeRun,
  id: '550e8400-e29b-41d4-a716-446655440010',
  runType: 'test',
  testId: TEST_UUID,
  testName: 'Login Flow Test',
  testSlug: 'login-flow-test',
  recordingId: null,
  recordingName: null,
  recordingUrl: null,
};

const mockSuiteRun = {
  ...mockSafeRun,
  id: '550e8400-e29b-41d4-a716-446655440020',
  runType: 'suite',
  suiteId: SUITE_UUID,
  testId: null,
  testName: null,
  testSlug: null,
  recordingId: null,
  recordingName: null,
  recordingUrl: null,
};

// Mock browser result data
const mockBrowserResult = {
  id: '550e8400-e29b-41d4-a716-446655440030',
  runId: mockTestRun.id,
  browser: 'chromium',
  status: 'passed' as const,
  durationMs: 5000,
  actionsTotal: 10,
  actionsExecuted: 10,
  actionsFailed: 0,
  actionsSkipped: 0,
  errorMessage: null,
  errorStack: null,
  videoPath: null,
  screenshotPaths: null,
  startedAt: new Date('2026-01-01T00:00:00Z'),
  completedAt: new Date('2026-01-01T00:00:05Z'),
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

// Mock run action data (SafeRunAction type)
const mockSafeRunAction = {
  id: '550e8400-e29b-41d4-a716-446655440002',
  runId: mockSafeRun.id,
  actionId: 'act_001',
  actionType: 'click',
  actionIndex: 0,
  status: 'success' as const,
  durationMs: 100,
  startedAt: new Date('2026-01-01T00:00:00Z'),
  completedAt: new Date('2026-01-01T00:00:01Z'),
  selectorUsed: 'css',
  selectorValue: '#button',
  retryCount: 0,
  retriedSelectors: null,
  errorMessage: null,
  errorStack: null,
  screenshotPath: null,
  screenshotBefore: null,
  screenshotAfter: null,
  elementFound: true,
  elementVisible: true,
  elementTagName: 'button',
  pageUrl: 'https://example.com',
  pageTitle: 'Test Page',
  createdAt: new Date('2026-01-01'),
};

// Mock run action data with screenshot (SafeRunAction type)
const mockSafeRunActionWithScreenshot = {
  ...mockSafeRunAction,
  screenshotPath: '/storage/screenshots/run-123-001-act_001.png',
};

// Create mock runner service
const createMockRunnerService = () => ({
  queueRun: vi.fn().mockResolvedValue(mockSafeRun),
  listRuns: vi.fn().mockResolvedValue({
    data: [mockSafeRun],
    pagination: {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    },
  }),
  getRunById: vi.fn().mockResolvedValue(mockSafeRun),
  getRunActions: vi.fn().mockResolvedValue([mockSafeRunAction]),
  cancelRun: vi.fn().mockResolvedValue({ ...mockSafeRun, status: 'cancelled' as const }),
  deleteRun: vi.fn().mockResolvedValue(undefined),
  restoreRun: vi.fn().mockResolvedValue({ ...mockSafeRun, deletedAt: null }),
  permanentlyDeleteRun: vi.fn().mockResolvedValue(undefined),
  queueTestRun: vi.fn().mockResolvedValue(mockTestRun),
  queueSuiteRun: vi.fn().mockResolvedValue({
    suiteRun: mockSuiteRun,
    testRuns: [mockTestRun],
  }),
  getBrowserResults: vi.fn().mockResolvedValue([mockBrowserResult]),
});

// Create mock run repository
const createMockRunRepository = () => ({
  findById: vi.fn().mockResolvedValue(mockSafeRun),
  findActionByRunIdAndActionId: vi.fn().mockResolvedValue(mockSafeRunAction),
  findActionsByRunId: vi.fn().mockResolvedValue([mockSafeRunAction]),
  create: vi.fn().mockResolvedValue(mockSafeRun),
  update: vi.fn().mockResolvedValue(mockSafeRun),
  delete: vi.fn().mockResolvedValue(undefined),
  createActions: vi.fn().mockResolvedValue([mockSafeRunAction]),
});

// Mock the entire module
vi.mock('../services/RunnerService.js', () => {
  return {
    RunnerService: vi.fn().mockImplementation(() => createMockRunnerService()),
    RunError: class RunError extends Error {
      constructor(
        public code: string,
        message: string,
        public statusCode: number
      ) {
        super(message);
        this.name = 'RunError';
      }
    },
    createRunSchema: {
      parse: vi.fn((data: unknown) => data),
    },
    listRunsQuerySchema: {
      parse: vi.fn((data: unknown) => data),
    },
    queueTestRunSchema: {
      parse: vi.fn((data: unknown) => data),
    },
    queueSuiteRunSchema: {
      parse: vi.fn((data: unknown) => data),
    },
  };
});

// Mock the run repository
vi.mock('../repositories/RunRepository.js', () => {
  return {
    RunRepository: vi.fn().mockImplementation(() => createMockRunRepository()),
  };
});

// Mock additional repositories used by runs routes for test/suite runs
vi.mock('../repositories/TestRepository.js', () => {
  return {
    TestRepository: vi.fn().mockImplementation(() => ({})),
  };
});

vi.mock('../repositories/TestSuiteRepository.js', () => {
  return {
    TestSuiteRepository: vi.fn().mockImplementation(() => ({})),
  };
});

vi.mock('../repositories/RunBrowserResultRepository.js', () => {
  return {
    RunBrowserResultRepository: vi.fn().mockImplementation(() => ({
      getBrowsersByRunIds: vi.fn().mockResolvedValue(new Map()),
    })),
  };
});

// Import after mocking
import runRoutes from './runs.js';
import { RunnerService, RunError } from '../services/RunnerService.js';
import { RunRepository } from '../repositories/RunRepository.js';

describe('Run Routes', () => {
  let app: FastifyInstance;
  let mockService: ReturnType<typeof createMockRunnerService>;
  let mockRepository: ReturnType<typeof createMockRunRepository>;

  beforeEach(async () => {
    // Create fresh mocks for each test
    mockService = createMockRunnerService();
    mockRepository = createMockRunRepository();
    (RunnerService as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => mockService);
    (RunRepository as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => mockRepository);

    app = Fastify();

    // Mock JWT verification
    app.decorate('jwt', {} as any);
    app.decorateRequest('jwtVerify', async function () {
      (this as any).user = { sub: 'user-123', email: 'test@example.com' };
    });

    // Register routes with mock db (not used since service is mocked)
    await app.register(runRoutes, {
      prefix: '/api/runs',
      db: {} as any,
      jobQueueManager: {} as any,
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  describe('POST /api/runs', () => {
    it('should create a run successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/runs',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          recordingId: '550e8400-e29b-41d4-a716-446655440001',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(mockSafeRun.id);
      expect(body.data.status).toBe('queued');
    });

    it('should create a run with custom options', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/runs',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          recordingId: '550e8400-e29b-41d4-a716-446655440001',
          browser: 'firefox',
          headless: false,
          videoEnabled: true,
          timeout: 60000,
        },
      });

      expect(response.statusCode).toBe(201);
      expect(mockService.queueRun).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          recordingId: '550e8400-e29b-41d4-a716-446655440001',
          browser: 'firefox',
          headless: false,
          videoEnabled: true,
          timeout: 60000,
        })
      );
    });

    it('should return 404 when recording not found', async () => {
      mockService.queueRun.mockRejectedValue(
        new RunError('RECORDING_NOT_FOUND', 'Recording not found', 404)
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/runs',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          recordingId: '550e8400-e29b-41d4-a716-446655440001',
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('RECORDING_NOT_FOUND');
    });

    it('should return 403 when user does not own recording', async () => {
      mockService.queueRun.mockRejectedValue(new RunError('NOT_AUTHORIZED', 'Not authorized', 403));

      const response = await app.inject({
        method: 'POST',
        url: '/api/runs',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          recordingId: '550e8400-e29b-41d4-a716-446655440001',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('NOT_AUTHORIZED');
    });

    it('should return 400 for invalid request body', async () => {
      // Fastify schema validation catches this before the service is called
      const response = await app.inject({
        method: 'POST',
        url: '/api/runs',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          recordingId: 'not-a-uuid', // Invalid UUID format
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      // Fastify's built-in validation returns different error format
      expect(body.message || body.error).toBeDefined();
    });
  });

  describe('GET /api/runs', () => {
    it('should list runs', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/runs?projectId=00000000-0000-0000-0000-000000000001',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe(mockSafeRun.id);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.total).toBe(1);
    });

    it('should filter runs by status', async () => {
      mockService.listRuns.mockResolvedValue({
        data: [{ ...mockSafeRun, status: 'running' as const }],
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
        url: '/api/runs?projectId=00000000-0000-0000-0000-000000000001&status=running',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data[0].status).toBe('running');
    });

    it('should filter runs by recording ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/runs?projectId=00000000-0000-0000-0000-000000000001&recordingId=${mockSafeRun.recordingId}`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      expect(mockService.listRuns).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          recordingId: mockSafeRun.recordingId,
        })
      );
    });

    it('should paginate runs', async () => {
      mockService.listRuns.mockResolvedValue({
        data: [mockSafeRun],
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
        url: '/api/runs?projectId=00000000-0000-0000-0000-000000000001&page=2&limit=10',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.pagination.page).toBe(2);
      expect(body.pagination.limit).toBe(10);
      expect(body.pagination.total).toBe(50);
    });

    it('should return empty list when no runs', async () => {
      mockService.listRuns.mockResolvedValue({
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
        url: '/api/runs?projectId=00000000-0000-0000-0000-000000000001',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data).toHaveLength(0);
    });
  });

  describe('GET /api/runs/:id', () => {
    it('should get run details', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/runs/${mockSafeRun.id}`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(mockSafeRun.id);
      expect(body.data.status).toBe('queued');
      expect(body.data.recordingName).toBe('Test Recording');
    });

    it('should return 404 when run not found', async () => {
      mockService.getRunById.mockRejectedValue(new RunError('RUN_NOT_FOUND', 'Run not found', 404));

      const response = await app.inject({
        method: 'GET',
        url: `/api/runs/${mockSafeRun.id}`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('RUN_NOT_FOUND');
    });

    it('should return 403 when user does not own run', async () => {
      mockService.getRunById.mockRejectedValue(
        new RunError('NOT_AUTHORIZED', 'Not authorized', 403)
      );

      const response = await app.inject({
        method: 'GET',
        url: `/api/runs/${mockSafeRun.id}`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('NOT_AUTHORIZED');
    });
  });

  describe('GET /api/runs/:id/actions', () => {
    it('should get run actions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/runs/${mockSafeRun.id}/actions`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].actionId).toBe('act_001');
      expect(body.data[0].status).toBe('success');
    });

    it('should return empty array when no actions', async () => {
      mockService.getRunActions.mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: `/api/runs/${mockSafeRun.id}/actions`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data).toHaveLength(0);
    });

    it('should return 404 when run not found', async () => {
      mockService.getRunActions.mockRejectedValue(
        new RunError('RUN_NOT_FOUND', 'Run not found', 404)
      );

      const response = await app.inject({
        method: 'GET',
        url: `/api/runs/${mockSafeRun.id}/actions`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/runs/:id/cancel', () => {
    it('should cancel a queued run', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/runs/${mockSafeRun.id}/cancel`,
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        payload: '{}',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('cancelled');
    });

    it('should return 400 when run is already completed', async () => {
      mockService.cancelRun.mockRejectedValue(
        new RunError('CANNOT_CANCEL', 'Cannot cancel completed run', 400)
      );

      const response = await app.inject({
        method: 'POST',
        url: `/api/runs/${mockSafeRun.id}/cancel`,
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        payload: '{}',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('CANNOT_CANCEL');
    });

    it('should return 404 when run not found', async () => {
      mockService.cancelRun.mockRejectedValue(new RunError('RUN_NOT_FOUND', 'Run not found', 404));

      const response = await app.inject({
        method: 'POST',
        url: `/api/runs/${mockSafeRun.id}/cancel`,
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        payload: '{}',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/runs/:id', () => {
    it('should soft delete a run', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/runs/${mockSafeRun.id}`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(204);
      expect(mockService.deleteRun).toHaveBeenCalledWith('user-123', mockSafeRun.id);
    });

    it('should return 400 when run is already deleted', async () => {
      mockService.deleteRun.mockRejectedValue(
        new RunError('ALREADY_DELETED', 'Run already deleted', 400)
      );

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/runs/${mockSafeRun.id}`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 when run is running', async () => {
      mockService.deleteRun.mockRejectedValue(
        new RunError('CANNOT_DELETE_RUNNING', 'Cannot delete running', 400)
      );

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/runs/${mockSafeRun.id}`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 when run not found', async () => {
      mockService.deleteRun.mockRejectedValue(new RunError('RUN_NOT_FOUND', 'Run not found', 404));

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/runs/${mockSafeRun.id}`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/runs/:id/restore', () => {
    it('should restore a soft-deleted run', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/runs/${mockSafeRun.id}/restore`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.deletedAt).toBeNull();
    });

    it('should return 400 when run is not deleted', async () => {
      mockService.restoreRun.mockRejectedValue(
        new RunError('NOT_DELETED', 'Run is not deleted', 400)
      );

      const response = await app.inject({
        method: 'POST',
        url: `/api/runs/${mockSafeRun.id}/restore`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 when run not found', async () => {
      mockService.restoreRun.mockRejectedValue(new RunError('RUN_NOT_FOUND', 'Run not found', 404));

      const response = await app.inject({
        method: 'POST',
        url: `/api/runs/${mockSafeRun.id}/restore`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/runs/:id/permanent', () => {
    it('should permanently delete a run', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/runs/${mockSafeRun.id}/permanent`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(204);
      expect(mockService.permanentlyDeleteRun).toHaveBeenCalledWith('user-123', mockSafeRun.id);
    });

    it('should return 400 when run is not soft-deleted', async () => {
      mockService.permanentlyDeleteRun.mockRejectedValue(
        new RunError('NOT_SOFT_DELETED', 'Run must be soft-deleted first', 400)
      );

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/runs/${mockSafeRun.id}/permanent`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 when run not found', async () => {
      mockService.permanentlyDeleteRun.mockRejectedValue(
        new RunError('RUN_NOT_FOUND', 'Run not found', 404)
      );

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/runs/${mockSafeRun.id}/permanent`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/runs/:id/video', () => {
    it('should return 404 when no video available', async () => {
      mockService.getRunById.mockResolvedValue({ ...mockSafeRun, videoPath: null });

      const response = await app.inject({
        method: 'GET',
        url: `/api/runs/${mockSafeRun.id}/video`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('VIDEO_NOT_FOUND');
    });

    it('should return 404 when video file does not exist', async () => {
      mockService.getRunById.mockResolvedValue({
        ...mockSafeRun,
        videoPath: '/non/existent/video.webm',
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/runs/${mockSafeRun.id}/video`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('VIDEO_FILE_NOT_FOUND');
    });

    it('should return 404 when run not found', async () => {
      mockService.getRunById.mockRejectedValue(new RunError('RUN_NOT_FOUND', 'Run not found', 404));

      const response = await app.inject({
        method: 'GET',
        url: `/api/runs/${mockSafeRun.id}/video`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/runs/:id/actions/:actionId/screenshot', () => {
    it('should return 404 when no screenshot available', async () => {
      mockRepository.findActionByRunIdAndActionId.mockResolvedValue(mockSafeRunAction);

      const response = await app.inject({
        method: 'GET',
        url: `/api/runs/${mockSafeRun.id}/actions/act_001/screenshot`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('SCREENSHOT_NOT_FOUND');
    });

    it('should return 404 when screenshot file does not exist', async () => {
      mockRepository.findActionByRunIdAndActionId.mockResolvedValue({
        ...mockSafeRunAction,
        screenshotPath: '/non/existent/screenshot.png',
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/runs/${mockSafeRun.id}/actions/act_001/screenshot`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('SCREENSHOT_FILE_NOT_FOUND');
    });

    it('should return 404 when action not found', async () => {
      mockRepository.findActionByRunIdAndActionId.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: `/api/runs/${mockSafeRun.id}/actions/act_999/screenshot`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('ACTION_NOT_FOUND');
    });

    it('should return 404 when run not found', async () => {
      mockService.getRunById.mockRejectedValue(new RunError('RUN_NOT_FOUND', 'Run not found', 404));

      const response = await app.inject({
        method: 'GET',
        url: `/api/runs/${mockSafeRun.id}/actions/act_001/screenshot`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should accept token via query parameter', async () => {
      // Even with invalid file path, should get past auth check to file not found
      mockRepository.findActionByRunIdAndActionId.mockResolvedValue({
        ...mockSafeRunAction,
        screenshotPath: '/fake/path.png',
      });

      // Close current app and create one that verifies tokens via query param
      await app.close();

      app = Fastify();
      app.decorate('jwt', {
        verify: vi.fn().mockReturnValue({ sub: 'user-123', email: 'test@example.com' }),
      } as any);
      app.decorateRequest('jwtVerify', async function () {
        (this as any).user = { sub: 'user-123', email: 'test@example.com' };
      });

      // Recreate mocks for new app
      (RunnerService as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => mockService);
      (RunRepository as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => mockRepository
      );

      await app.register(runRoutes, {
        prefix: '/api/runs',
        db: {} as any,
      });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: `/api/runs/${mockSafeRun.id}/actions/act_001/screenshot?token=valid-token`,
      });

      // Should reach file check (404) rather than auth check (401)
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('SCREENSHOT_FILE_NOT_FOUND');
    });

    it('should return 401 with invalid token via query parameter', async () => {
      await app.close();

      app = Fastify();
      app.decorate('jwt', {
        verify: vi.fn().mockImplementation(() => {
          throw new Error('Invalid token');
        }),
      } as any);
      app.decorateRequest('jwtVerify', async function () {
        throw new Error('Missing auth');
      });

      await app.register(runRoutes, {
        prefix: '/api/runs',
        db: {} as any,
      });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: `/api/runs/${mockSafeRun.id}/actions/act_001/screenshot?token=invalid-token`,
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('Authentication', () => {
    it('should return 401 when not authenticated', async () => {
      await app.close();

      app = Fastify();
      app.decorate('jwt', {} as any);
      app.decorateRequest('jwtVerify', async function () {
        throw new Error('Invalid token');
      });
      await app.register(runRoutes, {
        prefix: '/api/runs',
        db: {} as any,
      });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/api/runs?projectId=00000000-0000-0000-0000-000000000001',
        headers: { authorization: 'Bearer invalid-token' },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 when no authorization header', async () => {
      await app.close();

      app = Fastify();
      app.decorate('jwt', {} as any);
      app.decorateRequest('jwtVerify', async function () {
        throw new Error('Missing authorization');
      });
      await app.register(runRoutes, {
        prefix: '/api/runs',
        db: {} as any,
      });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/api/runs?projectId=00000000-0000-0000-0000-000000000001',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/runs/test', () => {
    it('should queue a test run successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/runs/test',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          testId: TEST_UUID,
          projectId: PROJECT_UUID,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(mockTestRun.id);
      expect(body.data.testId).toBe(TEST_UUID);
      expect(body.data.testName).toBe('Login Flow Test');
      expect(body.data.status).toBe('queued');
    });

    it('should queue a test run with custom browsers', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/runs/test',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          testId: TEST_UUID,
          projectId: PROJECT_UUID,
          browsers: ['chromium', 'firefox'],
          parallelBrowsers: false,
          headless: false,
          timeout: 60000,
          triggeredBy: 'api',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(mockService.queueTestRun).toHaveBeenCalledWith(
        'user-123',
        PROJECT_UUID,
        expect.objectContaining({
          testId: TEST_UUID,
          browsers: ['chromium', 'firefox'],
          parallelBrowsers: false,
          headless: false,
          timeout: 60000,
          triggeredBy: 'api',
        })
      );
    });

    it('should return 400 when projectId is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/runs/test',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          testId: TEST_UUID,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 when testId is invalid', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/runs/test',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          testId: 'not-a-uuid',
          projectId: PROJECT_UUID,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 when test not found', async () => {
      mockService.queueTestRun.mockRejectedValue(
        new RunError('TEST_NOT_FOUND', 'Test not found', 404)
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/runs/test',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          testId: TEST_UUID,
          projectId: PROJECT_UUID,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('TEST_NOT_FOUND');
    });

    it('should return 403 when user is not authorized', async () => {
      mockService.queueTestRun.mockRejectedValue(
        new RunError('NOT_AUTHORIZED', 'Not authorized', 403)
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/runs/test',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          testId: TEST_UUID,
          projectId: PROJECT_UUID,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('NOT_AUTHORIZED');
    });

    it('should return 500 on unexpected error', async () => {
      mockService.queueTestRun.mockRejectedValue(new Error('Queue unavailable'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/runs/test',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          testId: TEST_UUID,
          projectId: PROJECT_UUID,
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('POST /api/runs/suite', () => {
    it('should queue suite runs successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/runs/suite',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          suiteId: SUITE_UUID,
          projectId: PROJECT_UUID,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.suiteRun.id).toBe(mockSuiteRun.id);
      expect(body.data.suiteRun.suiteId).toBe(SUITE_UUID);
      expect(body.data.suiteRun.status).toBe('queued');
      expect(body.data.testRuns).toHaveLength(1);
      expect(body.data.testRuns[0].id).toBe(mockTestRun.id);
      expect(body.data.testRuns[0].testName).toBe('Login Flow Test');
    });

    it('should queue suite runs with custom options', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/runs/suite',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          suiteId: SUITE_UUID,
          projectId: PROJECT_UUID,
          browsers: ['webkit'],
          parallelBrowsers: true,
          headless: true,
          timeout: 120000,
          triggeredBy: 'schedule',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(mockService.queueSuiteRun).toHaveBeenCalledWith(
        'user-123',
        PROJECT_UUID,
        expect.objectContaining({
          suiteId: SUITE_UUID,
          browsers: ['webkit'],
          parallelBrowsers: true,
          headless: true,
          timeout: 120000,
          triggeredBy: 'schedule',
        })
      );
    });

    it('should return 400 when projectId is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/runs/suite',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          suiteId: SUITE_UUID,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 when suiteId is invalid', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/runs/suite',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          suiteId: 'not-a-uuid',
          projectId: PROJECT_UUID,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 when suite not found', async () => {
      mockService.queueSuiteRun.mockRejectedValue(
        new RunError('SUITE_NOT_FOUND', 'Suite not found', 404)
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/runs/suite',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          suiteId: SUITE_UUID,
          projectId: PROJECT_UUID,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('SUITE_NOT_FOUND');
    });

    it('should return 400 when suite has no tests', async () => {
      mockService.queueSuiteRun.mockRejectedValue(
        new RunError('SUITE_EMPTY', 'Suite has no tests', 400)
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/runs/suite',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          suiteId: SUITE_UUID,
          projectId: PROJECT_UUID,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('SUITE_EMPTY');
    });

    it('should return 403 when user is not authorized', async () => {
      mockService.queueSuiteRun.mockRejectedValue(
        new RunError('NOT_AUTHORIZED', 'Not authorized', 403)
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/runs/suite',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          suiteId: SUITE_UUID,
          projectId: PROJECT_UUID,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('NOT_AUTHORIZED');
    });
  });

  describe('GET /api/runs/:id/browsers', () => {
    it('should return browser results successfully', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/runs/${mockTestRun.id}/browsers`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].browser).toBe('chromium');
      expect(body.data[0].status).toBe('passed');
      expect(body.data[0].runId).toBe(mockTestRun.id);
    });

    it('should return empty array when no browser results', async () => {
      mockService.getBrowserResults.mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: `/api/runs/${mockTestRun.id}/browsers`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data).toHaveLength(0);
    });

    it('should return multiple browser results', async () => {
      const firefoxResult = {
        ...mockBrowserResult,
        id: '550e8400-e29b-41d4-a716-446655440031',
        browser: 'firefox',
        status: 'failed' as const,
        actionsFailed: 2,
        errorMessage: 'Element not found',
      };
      mockService.getBrowserResults.mockResolvedValue([mockBrowserResult, firefoxResult]);

      const response = await app.inject({
        method: 'GET',
        url: `/api/runs/${mockTestRun.id}/browsers`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data).toHaveLength(2);
      expect(body.data[0].browser).toBe('chromium');
      expect(body.data[1].browser).toBe('firefox');
      expect(body.data[1].status).toBe('failed');
    });

    it('should return 404 when run not found', async () => {
      mockService.getBrowserResults.mockRejectedValue(
        new RunError('RUN_NOT_FOUND', 'Run not found', 404)
      );

      const response = await app.inject({
        method: 'GET',
        url: `/api/runs/${mockTestRun.id}/browsers`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('RUN_NOT_FOUND');
    });

    it('should return 403 when user is not authorized', async () => {
      mockService.getBrowserResults.mockRejectedValue(
        new RunError('NOT_AUTHORIZED', 'Not authorized', 403)
      );

      const response = await app.inject({
        method: 'GET',
        url: `/api/runs/${mockTestRun.id}/browsers`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('NOT_AUTHORIZED');
    });

    it('should return 400 for invalid run id', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/runs/not-a-uuid/browsers',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      mockService.listRuns.mockRejectedValue(new Error('Database connection failed'));

      const response = await app.inject({
        method: 'GET',
        url: '/api/runs?projectId=00000000-0000-0000-0000-000000000001',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });
});
