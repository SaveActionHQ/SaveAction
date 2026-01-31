/**
 * RunnerService Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RunnerService,
  RunError,
  RunErrors,
  createRunSchema,
  listRunsQuerySchema,
  type CreateRunRequest,
  type ListRunsQuery,
  type ExecutionResult,
} from './RunnerService.js';
import type { RunRepository, SafeRun, RunSummary } from '../repositories/RunRepository.js';
import type { RecordingRepository, SafeRecording } from '../repositories/RecordingRepository.js';
import type { JobQueueManager } from '../queues/JobQueueManager.js';
import type { RecordingData } from '../db/schema/recordings.js';

// Sample recording data
const sampleRecordingData: RecordingData = {
  id: 'rec_1234567890',
  testName: 'Test Recording',
  url: 'https://example.com',
  startTime: '2026-01-01T00:00:00Z',
  endTime: '2026-01-01T00:01:00Z',
  viewport: { width: 1920, height: 1080 },
  userAgent: 'Mozilla/5.0',
  actions: [
    { id: 'act_001', type: 'click', timestamp: 1000, url: 'https://example.com' },
    { id: 'act_002', type: 'input', timestamp: 2000, url: 'https://example.com' },
  ],
  version: '1.0.0',
};

const sampleRecording: SafeRecording = {
  id: 'recording-123',
  userId: 'user-123',
  name: 'Test Recording',
  url: 'https://example.com',
  description: 'Test description',
  originalId: 'rec_1234567890',
  tags: ['smoke', 'login'],
  data: sampleRecordingData,
  actionCount: 2,
  estimatedDurationMs: 60000,
  schemaVersion: '1.0.0',
  dataSizeBytes: 500,
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const sampleRun: SafeRun = {
  id: 'run-123',
  userId: 'user-123',
  recordingId: 'recording-123',
  recordingName: 'Test Recording',
  recordingUrl: 'https://example.com',
  status: 'queued',
  jobId: 'job-123',
  queueName: 'test-runs',
  browser: 'chromium',
  headless: true,
  videoEnabled: false,
  screenshotEnabled: false,
  timeout: 30000,
  timingEnabled: true,
  timingMode: 'realistic',
  speedMultiplier: 1.0,
  actionsTotal: null,
  actionsExecuted: null,
  actionsFailed: null,
  actionsSkipped: null,
  durationMs: null,
  startedAt: null,
  completedAt: null,
  videoPath: null,
  screenshotPaths: [],
  errorMessage: null,
  errorStack: null,
  errorActionId: null,
  triggeredBy: 'manual',
  scheduleId: null,
  ciMetadata: null,
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const sampleRunSummary: RunSummary = {
  id: 'run-123',
  userId: 'user-123',
  recordingId: 'recording-123',
  recordingName: 'Test Recording',
  recordingUrl: 'https://example.com',
  status: 'queued',
  browser: 'chromium',
  actionsTotal: null,
  actionsExecuted: null,
  actionsFailed: null,
  durationMs: null,
  startedAt: null,
  completedAt: null,
  triggeredBy: 'manual',
  createdAt: new Date('2026-01-01'),
};

// Mock repository types
type MockedRunRepository = {
  create: ReturnType<typeof vi.fn>;
  findById: ReturnType<typeof vi.fn>;
  findByJobId: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  softDelete: ReturnType<typeof vi.fn>;
  restore: ReturnType<typeof vi.fn>;
  hardDelete: ReturnType<typeof vi.fn>;
  isOwner: ReturnType<typeof vi.fn>;
  findOrphanedRuns: ReturnType<typeof vi.fn>;
  countByUserId: ReturnType<typeof vi.fn>;
  findRecentByRecordingId: ReturnType<typeof vi.fn>;
  createActions: ReturnType<typeof vi.fn>;
  findActionsByRunId: ReturnType<typeof vi.fn>;
  deleteActionsByRunId: ReturnType<typeof vi.fn>;
};

type MockedRecordingRepository = {
  findById: ReturnType<typeof vi.fn>;
};

type MockedJobQueueManager = {
  addJob: ReturnType<typeof vi.fn>;
  getQueue: ReturnType<typeof vi.fn>;
};

const createMockRunRepository = (): MockedRunRepository => ({
  create: vi.fn().mockResolvedValue(sampleRun),
  findById: vi.fn().mockResolvedValue(sampleRun),
  findByJobId: vi.fn().mockResolvedValue(sampleRun),
  findMany: vi.fn().mockResolvedValue({
    data: [sampleRunSummary],
    pagination: {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    },
  }),
  update: vi.fn().mockResolvedValue(sampleRun),
  softDelete: vi.fn().mockResolvedValue(true),
  restore: vi.fn().mockResolvedValue(sampleRun),
  hardDelete: vi.fn().mockResolvedValue(true),
  isOwner: vi.fn().mockResolvedValue(true),
  findOrphanedRuns: vi.fn().mockResolvedValue([]),
  countByUserId: vi.fn().mockResolvedValue(10),
  findRecentByRecordingId: vi.fn().mockResolvedValue([sampleRunSummary]),
  createActions: vi.fn().mockResolvedValue([]),
  findActionsByRunId: vi.fn().mockResolvedValue([]),
  deleteActionsByRunId: vi.fn().mockResolvedValue(0),
});

const createMockRecordingRepository = (): MockedRecordingRepository => ({
  findById: vi.fn().mockResolvedValue(sampleRecording),
});

const createMockJobQueueManager = (): MockedJobQueueManager => ({
  addJob: vi.fn().mockResolvedValue({ id: 'job-123' }),
  getQueue: vi.fn().mockReturnValue({
    getJob: vi.fn().mockResolvedValue({
      remove: vi.fn().mockResolvedValue(undefined),
    }),
  }),
});

describe('RunnerService', () => {
  let service: RunnerService;
  let mockRunRepository: MockedRunRepository;
  let mockRecordingRepository: MockedRecordingRepository;
  let mockJobQueueManager: MockedJobQueueManager;

  beforeEach(() => {
    mockRunRepository = createMockRunRepository();
    mockRecordingRepository = createMockRecordingRepository();
    mockJobQueueManager = createMockJobQueueManager();
    service = new RunnerService(
      mockRunRepository as unknown as RunRepository,
      mockRecordingRepository as unknown as RecordingRepository,
      mockJobQueueManager as unknown as JobQueueManager
    );
  });

  describe('Schema Validation', () => {
    describe('createRunSchema', () => {
      it('should validate minimal request', () => {
        const result = createRunSchema.safeParse({
          recordingId: '12345678-1234-1234-1234-123456789012',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.browser).toBe('chromium');
          expect(result.data.headless).toBe(true);
          expect(result.data.timeout).toBe(30000);
        }
      });

      it('should validate full request', () => {
        const result = createRunSchema.safeParse({
          recordingId: '12345678-1234-1234-1234-123456789012',
          browser: 'firefox',
          headless: false,
          videoEnabled: true,
          timeout: 60000,
          timingMode: 'fast',
          speedMultiplier: 2.0,
        });
        expect(result.success).toBe(true);
      });

      it('should reject invalid UUID', () => {
        const result = createRunSchema.safeParse({
          recordingId: 'not-a-uuid',
        });
        expect(result.success).toBe(false);
      });

      it('should reject invalid browser', () => {
        const result = createRunSchema.safeParse({
          recordingId: '12345678-1234-1234-1234-123456789012',
          browser: 'ie11',
        });
        expect(result.success).toBe(false);
      });

      it('should reject timeout over 10 minutes', () => {
        const result = createRunSchema.safeParse({
          recordingId: '12345678-1234-1234-1234-123456789012',
          timeout: 700000, // Over 10 minutes
        });
        expect(result.success).toBe(false);
      });

      it('should reject invalid speed multiplier', () => {
        const result = createRunSchema.safeParse({
          recordingId: '12345678-1234-1234-1234-123456789012',
          speedMultiplier: 100, // Max is 10
        });
        expect(result.success).toBe(false);
      });
    });

    describe('listRunsQuerySchema', () => {
      it('should validate empty query with defaults', () => {
        const result = listRunsQuerySchema.safeParse({});
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.page).toBe(1);
          expect(result.data.limit).toBe(20);
          expect(result.data.sortBy).toBe('createdAt');
        }
      });

      it('should validate status filter', () => {
        const result = listRunsQuerySchema.safeParse({
          status: 'running',
        });
        expect(result.success).toBe(true);
      });

      it('should validate multiple status filter', () => {
        const result = listRunsQuerySchema.safeParse({
          status: ['running', 'queued'],
        });
        expect(result.success).toBe(true);
      });

      it('should reject invalid status', () => {
        const result = listRunsQuerySchema.safeParse({
          status: 'invalid-status',
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe('queueRun', () => {
    const validRequest: CreateRunRequest = {
      recordingId: '12345678-1234-1234-1234-123456789012',
      browser: 'chromium',
      headless: true,
      videoEnabled: false,
      screenshotEnabled: false,
      timeout: 30000,
      timingEnabled: true,
      timingMode: 'realistic',
      speedMultiplier: 1.0,
    };

    it('should create and queue a run', async () => {
      mockRecordingRepository.findById.mockResolvedValue({
        ...sampleRecording,
        id: validRequest.recordingId,
      });

      const result = await service.queueRun('user-123', validRequest);

      expect(result).toBeDefined();
      expect(mockRecordingRepository.findById).toHaveBeenCalledWith(validRequest.recordingId);
      expect(mockRunRepository.create).toHaveBeenCalled();
      expect(mockJobQueueManager.addJob).toHaveBeenCalled();
    });

    it('should throw if recording not found', async () => {
      mockRecordingRepository.findById.mockResolvedValue(null);

      await expect(service.queueRun('user-123', validRequest)).rejects.toEqual(
        RunErrors.RECORDING_NOT_FOUND
      );
    });

    it('should throw if user does not own recording', async () => {
      mockRecordingRepository.findById.mockResolvedValue({
        ...sampleRecording,
        userId: 'other-user',
      });

      await expect(service.queueRun('user-123', validRequest)).rejects.toEqual(
        RunErrors.NOT_AUTHORIZED
      );
    });

    it('should work without job queue manager', async () => {
      const serviceWithoutQueue = new RunnerService(
        mockRunRepository as unknown as RunRepository,
        mockRecordingRepository as unknown as RecordingRepository,
        undefined
      );

      mockRecordingRepository.findById.mockResolvedValue({
        ...sampleRecording,
        id: validRequest.recordingId,
      });

      const result = await serviceWithoutQueue.queueRun('user-123', validRequest);

      expect(result).toBeDefined();
      expect(mockJobQueueManager.addJob).not.toHaveBeenCalled();
    });

    it('should mark run as failed if queueing fails', async () => {
      mockRecordingRepository.findById.mockResolvedValue({
        ...sampleRecording,
        id: validRequest.recordingId,
      });
      mockJobQueueManager.addJob.mockRejectedValue(new Error('Queue error'));

      await expect(service.queueRun('user-123', validRequest)).rejects.toEqual(
        RunErrors.QUEUE_ERROR
      );
      expect(mockRunRepository.update).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ status: 'failed' })
      );
    });
  });

  describe('getRunById', () => {
    it('should return run for owner', async () => {
      const result = await service.getRunById('user-123', 'run-123');

      expect(result).toEqual(sampleRun);
      expect(mockRunRepository.findById).toHaveBeenCalledWith('run-123', false);
    });

    it('should throw if run not found', async () => {
      mockRunRepository.findById.mockResolvedValue(null);

      await expect(service.getRunById('user-123', 'non-existent')).rejects.toEqual(
        RunErrors.NOT_FOUND
      );
    });

    it('should throw if user does not own run', async () => {
      mockRunRepository.findById.mockResolvedValue({
        ...sampleRun,
        userId: 'other-user',
      });

      await expect(service.getRunById('user-123', 'run-123')).rejects.toEqual(
        RunErrors.NOT_AUTHORIZED
      );
    });

    it('should include deleted runs when requested', async () => {
      await service.getRunById('user-123', 'run-123', true);

      expect(mockRunRepository.findById).toHaveBeenCalledWith('run-123', true);
    });
  });

  describe('listRuns', () => {
    const defaultQuery = {
      page: 1,
      limit: 20,
      sortBy: 'createdAt' as const,
      sortOrder: 'desc' as const,
      includeDeleted: false,
    };

    it('should list runs with default options', async () => {
      const result = await service.listRuns('user-123', defaultQuery);

      expect(result.data).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
      expect(mockRunRepository.findMany).toHaveBeenCalled();
    });

    it('should filter by recording ID', async () => {
      await service.listRuns('user-123', {
        ...defaultQuery,
        recordingId: '12345678-1234-1234-1234-123456789012',
      });

      expect(mockRunRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ recordingId: '12345678-1234-1234-1234-123456789012' }),
        expect.any(Object)
      );
    });

    it('should filter by status', async () => {
      await service.listRuns('user-123', {
        ...defaultQuery,
        status: 'running',
      });

      expect(mockRunRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'running' }),
        expect.any(Object)
      );
    });
  });

  describe('getRunActions', () => {
    it('should return actions for run', async () => {
      mockRunRepository.findActionsByRunId.mockResolvedValue([
        { id: 'action-1', actionId: 'act_001', status: 'success' },
        { id: 'action-2', actionId: 'act_002', status: 'failed' },
      ]);

      const result = await service.getRunActions('user-123', 'run-123');

      expect(result).toHaveLength(2);
      expect(mockRunRepository.findActionsByRunId).toHaveBeenCalledWith('run-123');
    });

    it('should throw if run not found', async () => {
      mockRunRepository.findById.mockResolvedValue(null);

      await expect(service.getRunActions('user-123', 'run-123')).rejects.toEqual(
        RunErrors.NOT_FOUND
      );
    });
  });

  describe('deleteRun', () => {
    it('should soft delete a run', async () => {
      await service.deleteRun('user-123', 'run-123');

      expect(mockRunRepository.softDelete).toHaveBeenCalledWith('run-123');
    });

    it('should throw if run is already deleted', async () => {
      mockRunRepository.findById.mockResolvedValue({
        ...sampleRun,
        deletedAt: new Date(),
      });

      await expect(service.deleteRun('user-123', 'run-123')).rejects.toEqual(
        RunErrors.ALREADY_DELETED
      );
    });

    it('should throw if run is running', async () => {
      mockRunRepository.findById.mockResolvedValue({
        ...sampleRun,
        status: 'running',
      });

      await expect(service.deleteRun('user-123', 'run-123')).rejects.toThrow(
        'Cannot delete a running run'
      );
    });
  });

  describe('restoreRun', () => {
    it('should restore a soft-deleted run', async () => {
      mockRunRepository.findById.mockResolvedValue({
        ...sampleRun,
        deletedAt: new Date(),
      });

      const result = await service.restoreRun('user-123', 'run-123');

      expect(result).toBeDefined();
      expect(mockRunRepository.restore).toHaveBeenCalledWith('run-123');
    });

    it('should throw if run not deleted', async () => {
      await expect(service.restoreRun('user-123', 'run-123')).rejects.toThrow('Run is not deleted');
    });
  });

  describe('permanentlyDeleteRun', () => {
    it('should permanently delete a run', async () => {
      mockRunRepository.findById.mockResolvedValue({
        ...sampleRun,
        deletedAt: new Date(),
      });

      await service.permanentlyDeleteRun('user-123', 'run-123');

      expect(mockRunRepository.deleteActionsByRunId).toHaveBeenCalledWith('run-123');
      expect(mockRunRepository.hardDelete).toHaveBeenCalledWith('run-123');
    });
  });

  describe('cancelRun', () => {
    it('should cancel a queued run', async () => {
      mockRunRepository.update.mockResolvedValue({
        ...sampleRun,
        status: 'cancelled',
      });

      const result = await service.cancelRun('user-123', 'run-123');

      expect(result.status).toBe('cancelled');
      expect(mockJobQueueManager.getQueue).toHaveBeenCalledWith('test-runs');
    });

    it('should cancel a running run', async () => {
      mockRunRepository.findById.mockResolvedValue({
        ...sampleRun,
        status: 'running',
      });
      mockRunRepository.update.mockResolvedValue({
        ...sampleRun,
        status: 'cancelled',
      });

      const result = await service.cancelRun('user-123', 'run-123');

      expect(result.status).toBe('cancelled');
    });

    it('should throw if run is already completed', async () => {
      mockRunRepository.findById.mockResolvedValue({
        ...sampleRun,
        status: 'passed',
      });

      await expect(service.cancelRun('user-123', 'run-123')).rejects.toEqual(
        RunErrors.CANNOT_CANCEL
      );
    });

    it('should throw if run is already failed', async () => {
      mockRunRepository.findById.mockResolvedValue({
        ...sampleRun,
        status: 'failed',
      });

      await expect(service.cancelRun('user-123', 'run-123')).rejects.toEqual(
        RunErrors.CANNOT_CANCEL
      );
    });
  });

  describe('markRunStarted', () => {
    it('should mark run as running', async () => {
      mockRunRepository.update.mockResolvedValue({
        ...sampleRun,
        status: 'running',
        startedAt: new Date(),
      });

      const result = await service.markRunStarted('run-123');

      expect(result.status).toBe('running');
      expect(mockRunRepository.update).toHaveBeenCalledWith(
        'run-123',
        expect.objectContaining({ status: 'running' })
      );
    });

    it('should throw if run not found', async () => {
      mockRunRepository.update.mockResolvedValue(null);

      await expect(service.markRunStarted('non-existent')).rejects.toEqual(RunErrors.NOT_FOUND);
    });
  });

  describe('markRunCompleted', () => {
    it('should mark successful run as passed', async () => {
      const executionResult: ExecutionResult = {
        status: 'success',
        duration: 5000,
        actionsTotal: 10,
        actionsExecuted: 10,
        actionsFailed: 0,
        errors: [],
      };

      mockRunRepository.update.mockResolvedValue({
        ...sampleRun,
        status: 'passed',
      });

      const result = await service.markRunCompleted('run-123', executionResult);

      expect(result.status).toBe('passed');
      expect(mockRunRepository.update).toHaveBeenCalledWith(
        'run-123',
        expect.objectContaining({
          status: 'passed',
          actionsTotal: 10,
          actionsExecuted: 10,
          actionsFailed: 0,
        })
      );
    });

    it('should mark failed run with error details', async () => {
      const executionResult: ExecutionResult = {
        status: 'failed',
        duration: 3000,
        actionsTotal: 10,
        actionsExecuted: 5,
        actionsFailed: 1,
        errors: [
          {
            actionId: 'act_005',
            actionType: 'click',
            error: 'Element not found',
            timestamp: 3000,
          },
        ],
      };

      mockRunRepository.update.mockResolvedValue({
        ...sampleRun,
        status: 'failed',
      });

      const result = await service.markRunCompleted('run-123', executionResult);

      expect(result.status).toBe('failed');
      expect(mockRunRepository.update).toHaveBeenCalledWith(
        'run-123',
        expect.objectContaining({
          status: 'failed',
          errorMessage: 'Element not found',
          errorActionId: 'act_005',
        })
      );
    });

    it('should include video path when provided', async () => {
      const executionResult: ExecutionResult = {
        status: 'success',
        duration: 5000,
        actionsTotal: 10,
        actionsExecuted: 10,
        actionsFailed: 0,
        errors: [],
        video: '/videos/run-123.webm',
      };

      await service.markRunCompleted('run-123', executionResult, '/videos/run-123.webm');

      expect(mockRunRepository.update).toHaveBeenCalledWith(
        'run-123',
        expect.objectContaining({ videoPath: '/videos/run-123.webm' })
      );
    });
  });

  describe('markRunFailed', () => {
    it('should mark run as failed with error', async () => {
      const error = new Error('Browser crashed');
      error.stack = 'Error: Browser crashed\n  at ...\n  at ...';

      mockRunRepository.update.mockResolvedValue({
        ...sampleRun,
        status: 'failed',
        errorMessage: error.message,
      });

      const result = await service.markRunFailed('run-123', error);

      expect(result.status).toBe('failed');
      expect(mockRunRepository.update).toHaveBeenCalledWith(
        'run-123',
        expect.objectContaining({
          status: 'failed',
          errorMessage: 'Browser crashed',
          errorStack: expect.stringContaining('Browser crashed'),
        })
      );
    });
  });

  describe('saveActionResults', () => {
    it('should save action results', async () => {
      const results = [
        {
          actionId: 'act_001',
          actionType: 'click',
          actionIndex: 0,
          status: 'success' as const,
          durationMs: 100,
        },
        {
          actionId: 'act_002',
          actionType: 'input',
          actionIndex: 1,
          status: 'failed' as const,
          durationMs: 200,
          errorMessage: 'Element not found',
        },
      ];

      await service.saveActionResults('run-123', results);

      expect(mockRunRepository.createActions).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ runId: 'run-123', actionId: 'act_001' }),
          expect.objectContaining({ runId: 'run-123', actionId: 'act_002' }),
        ])
      );
    });
  });

  describe('getRecentRunsForRecording', () => {
    it('should return recent runs', async () => {
      const result = await service.getRecentRunsForRecording('user-123', 'recording-123');

      expect(result).toHaveLength(1);
      expect(mockRunRepository.findRecentByRecordingId).toHaveBeenCalledWith('recording-123', 10);
    });

    it('should throw if recording not found', async () => {
      mockRecordingRepository.findById.mockResolvedValue(null);

      await expect(service.getRecentRunsForRecording('user-123', 'recording-123')).rejects.toEqual(
        RunErrors.RECORDING_NOT_FOUND
      );
    });

    it('should throw if user does not own recording', async () => {
      mockRecordingRepository.findById.mockResolvedValue({
        ...sampleRecording,
        userId: 'other-user',
      });

      await expect(service.getRecentRunsForRecording('user-123', 'recording-123')).rejects.toEqual(
        RunErrors.NOT_AUTHORIZED
      );
    });
  });

  describe('getRunCount', () => {
    it('should return run count for user', async () => {
      const result = await service.getRunCount('user-123');

      expect(result).toBe(10);
      expect(mockRunRepository.countByUserId).toHaveBeenCalledWith('user-123');
    });
  });

  describe('findOrphanedRuns', () => {
    it('should find orphaned runs', async () => {
      mockRunRepository.findOrphanedRuns.mockResolvedValue([{ ...sampleRun, status: 'running' }]);

      const result = await service.findOrphanedRuns(600000);

      expect(result).toHaveLength(1);
      expect(mockRunRepository.findOrphanedRuns).toHaveBeenCalledWith(600000);
    });
  });

  describe('cleanupOrphanedRuns', () => {
    it('should mark orphaned runs as failed', async () => {
      mockRunRepository.findOrphanedRuns.mockResolvedValue([
        { ...sampleRun, id: 'run-1', status: 'running' },
        { ...sampleRun, id: 'run-2', status: 'running' },
      ]);

      const cleaned = await service.cleanupOrphanedRuns(600000);

      expect(cleaned).toBe(2);
      expect(mockRunRepository.update).toHaveBeenCalledTimes(2);
      expect(mockRunRepository.update).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({ status: 'failed' })
      );
    });

    it('should return 0 if no orphaned runs', async () => {
      mockRunRepository.findOrphanedRuns.mockResolvedValue([]);

      const cleaned = await service.cleanupOrphanedRuns(600000);

      expect(cleaned).toBe(0);
    });
  });

  describe('RunError', () => {
    it('should create error with correct properties', () => {
      const error = new RunError('Test error', 'TEST_CODE', 404);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe('RunError');
    });

    it('should default to 400 status code', () => {
      const error = new RunError('Test error', 'TEST_CODE');

      expect(error.statusCode).toBe(400);
    });
  });
});
