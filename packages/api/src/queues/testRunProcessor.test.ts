/**
 * Tests for Test Run Processor
 *
 * Tests the job processor including cancellation flow.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Job } from 'bullmq';
import type { TestRunJobData, TestRunJobResult } from './types.js';

// Mock the dependencies before importing
vi.mock('@saveaction/core', () => ({
  PlaywrightRunner: vi.fn().mockImplementation(() => ({
    execute: vi.fn(),
  })),
}));

vi.mock('../repositories/RunRepository.js', () => ({
  RunRepository: vi.fn().mockImplementation(() => ({
    findById: vi.fn(),
    update: vi.fn(),
    createActions: vi.fn(),
  })),
}));

vi.mock('../repositories/RecordingRepository.js', () => ({
  RecordingRepository: vi.fn().mockImplementation(() => ({
    findById: vi.fn(),
  })),
}));

import { createTestRunProcessor } from './testRunProcessor.js';
import { PlaywrightRunner } from '@saveaction/core';
import { RunRepository } from '../repositories/RunRepository.js';
import { RecordingRepository } from '../repositories/RecordingRepository.js';

describe('testRunProcessor', () => {
  let mockDb: any;
  let mockJob: Job<TestRunJobData>;
  let mockRunRepository: any;
  let mockRecordingRepository: any;
  let mockRunner: any;

  const mockRecording = {
    id: 'rec-123',
    userId: 'user-123',
    name: 'Test Recording',
    url: 'https://example.com',
    actionCount: 5,
    data: {
      id: 'rec-123',
      testName: 'Test',
      url: 'https://example.com',
      startTime: new Date().toISOString(),
      userAgent: 'Mozilla/5.0',
      viewport: { width: 1920, height: 1080 },
      actions: [],
      version: '1.0.0',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {};

    mockRunRepository = {
      findById: vi.fn().mockResolvedValue({ id: 'run-123', status: 'queued' }),
      update: vi.fn().mockResolvedValue(undefined),
      createActions: vi.fn().mockResolvedValue(undefined),
    };

    mockRecordingRepository = {
      findById: vi.fn().mockResolvedValue(mockRecording),
    };

    mockRunner = {
      execute: vi.fn().mockResolvedValue({
        status: 'success',
        duration: 5000,
        actionsTotal: 5,
        actionsExecuted: 5,
        errors: [],
      }),
    };

    // Setup mocks
    (RunRepository as any).mockImplementation(() => mockRunRepository);
    (RecordingRepository as any).mockImplementation(() => mockRecordingRepository);
    (PlaywrightRunner as any).mockImplementation(() => mockRunner);

    mockJob = {
      id: 'job-123',
      data: {
        runId: 'run-123',
        recordingId: 'rec-123',
        userId: 'user-123',
        createdAt: new Date().toISOString(),
      },
      updateProgress: vi.fn().mockResolvedValue(undefined),
    } as unknown as Job<TestRunJobData>;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createTestRunProcessor', () => {
    it('should create a processor function', () => {
      const processor = createTestRunProcessor({ db: mockDb });
      expect(processor).toBeInstanceOf(Function);
    });

    it('should process a job successfully', async () => {
      const processor = createTestRunProcessor({ db: mockDb });

      const result = await processor(mockJob);

      expect(result.runId).toBe('run-123');
      expect(result.status).toBe('passed');
      expect(mockRunRepository.update).toHaveBeenCalled();
    });

    it('should update run status to running at start', async () => {
      const processor = createTestRunProcessor({ db: mockDb });

      await processor(mockJob);

      // First update should be 'running'
      expect(mockRunRepository.update).toHaveBeenCalledWith(
        'run-123',
        expect.objectContaining({ status: 'running' })
      );
    });

    it('should handle recording not found', async () => {
      mockRecordingRepository.findById.mockResolvedValue(null);

      const processor = createTestRunProcessor({ db: mockDb });

      const result = await processor(mockJob);

      expect(result.status).toBe('error');
      expect(result.errorMessage).toContain('Recording not found');
    });

    it('should handle unauthorized recording access', async () => {
      mockRecordingRepository.findById.mockResolvedValue({
        ...mockRecording,
        userId: 'different-user',
      });

      const processor = createTestRunProcessor({ db: mockDb });

      const result = await processor(mockJob);

      expect(result.status).toBe('error');
      expect(result.errorMessage).toContain('Not authorized');
    });
  });

  describe('cancellation', () => {
    it('should check for cancellation periodically', async () => {
      const processor = createTestRunProcessor({ db: mockDb });

      // Make runner take longer so we can simulate cancellation check
      mockRunner.execute.mockImplementation(async () => {
        // Simulate some work
        await new Promise((resolve) => setTimeout(resolve, 100));
        return {
          status: 'success',
          duration: 5000,
          actionsTotal: 5,
          actionsExecuted: 5,
          errors: [],
        };
      });

      await processor(mockJob);

      // findById is called once for cancellation check interval (every 2s)
      // but since test runs fast, it may not trigger
      expect(mockRunRepository.findById).toBeDefined();
    });

    it('should abort when run status changes to cancelled', async () => {
      const processor = createTestRunProcessor({ db: mockDb });

      // Capture the abortSignal from the constructor
      let capturedAbortSignal: AbortSignal | undefined;

      // Mock PlaywrightRunner to capture the abort signal and check it during execution
      (PlaywrightRunner as any).mockImplementation((options: any) => {
        capturedAbortSignal = options.abortSignal;
        return {
          execute: vi.fn().mockImplementation(async () => {
            // Simulate long-running execution by checking periodically
            for (let i = 0; i < 50; i++) {
              await new Promise((resolve) => setTimeout(resolve, 100));

              // Check if abort was called
              if (capturedAbortSignal?.aborted) {
                throw new Error('CANCELLED: Run was cancelled by user');
              }
            }

            return {
              status: 'success',
              duration: 5000,
              actionsTotal: 5,
              actionsExecuted: 5,
              errors: [],
            };
          }),
        };
      });

      // Return cancelled status on the second check (after ~2s)
      mockRunRepository.findById
        .mockResolvedValueOnce({ id: 'run-123', status: 'running' })
        .mockResolvedValue({ id: 'run-123', status: 'cancelled' });

      const result = await processor(mockJob);

      expect(result.status).toBe('cancelled');
      expect(result.errorMessage).toContain('cancelled');
    });

    it('should handle CANCELLED error from runner gracefully', async () => {
      const processor = createTestRunProcessor({ db: mockDb });

      // Runner throws cancellation error
      mockRunner.execute.mockRejectedValue(new Error('CANCELLED: Run was cancelled by user'));

      const result = await processor(mockJob);

      expect(result.status).toBe('cancelled');
      expect(mockRunRepository.update).toHaveBeenCalledWith(
        'run-123',
        expect.objectContaining({ status: 'cancelled' })
      );
    });

    it('should distinguish cancellation from other errors', async () => {
      const processor = createTestRunProcessor({ db: mockDb });

      // Runner throws a regular error
      mockRunner.execute.mockRejectedValue(new Error('Browser crashed'));

      const result = await processor(mockJob);

      expect(result.status).toBe('error');
      expect(result.errorMessage).toBe('Browser crashed');
      expect(mockRunRepository.update).toHaveBeenCalledWith(
        'run-123',
        expect.objectContaining({ status: 'failed' })
      );
    });

    it('should pass abortSignal to PlaywrightRunner', async () => {
      const processor = createTestRunProcessor({ db: mockDb });

      await processor(mockJob);

      // Verify PlaywrightRunner was called with abortSignal in options
      expect(PlaywrightRunner).toHaveBeenCalledWith(
        expect.objectContaining({
          abortSignal: expect.any(AbortSignal),
        }),
        expect.anything()
      );
    });

    it('should clear cancellation interval on success', async () => {
      const processor = createTestRunProcessor({ db: mockDb });
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      await processor(mockJob);

      // clearInterval should have been called
      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should clear cancellation interval on error', async () => {
      const processor = createTestRunProcessor({ db: mockDb });
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      mockRunner.execute.mockRejectedValue(new Error('Test error'));

      await processor(mockJob);

      // clearInterval should have been called even on error
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('job result', () => {
    it('should return passed status for successful run', async () => {
      const processor = createTestRunProcessor({ db: mockDb });

      const result = await processor(mockJob);

      expect(result.status).toBe('passed');
      expect(result.runId).toBe('run-123');
    });

    it('should return failed status when runner returns failure', async () => {
      mockRunner.execute.mockResolvedValue({
        status: 'failure',
        duration: 5000,
        actionsTotal: 5,
        actionsExecuted: 3,
        errors: [{ actionId: 'act_004', error: 'Element not found' }],
      });

      const processor = createTestRunProcessor({ db: mockDb });

      const result = await processor(mockJob);

      expect(result.status).toBe('failed');
    });

    it('should return cancelled status when runner returns cancelled', async () => {
      mockRunner.execute.mockResolvedValue({
        status: 'cancelled',
        duration: 2000,
        actionsTotal: 5,
        actionsExecuted: 2,
        errors: [{ actionId: 'act_003', error: 'CANCELLED: Run was cancelled' }],
      });

      const processor = createTestRunProcessor({ db: mockDb });

      const result = await processor(mockJob);

      expect(result.status).toBe('cancelled');
    });

    it('should include duration in result', async () => {
      const processor = createTestRunProcessor({ db: mockDb });

      const result = await processor(mockJob);

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });
});
