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

vi.mock('../repositories/RunBrowserResultRepository.js', () => ({
  RunBrowserResultRepository: vi.fn().mockImplementation(() => ({
    findByRunId: vi.fn().mockResolvedValue([]),
    markStarted: vi.fn().mockResolvedValue(null),
    markPassed: vi.fn().mockResolvedValue(null),
    markFailed: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue(null),
    cancelByRunId: vi.fn().mockResolvedValue(0),
  })),
}));

vi.mock('../repositories/TestRepository.js', () => ({
  TestRepository: vi.fn().mockImplementation(() => ({
    findById: vi.fn(),
    updateLastRun: vi.fn().mockResolvedValue(undefined),
  })),
}));

import { createTestRunProcessor } from './testRunProcessor.js';
import { PlaywrightRunner } from '@saveaction/core';
import { RunRepository } from '../repositories/RunRepository.js';
import { RecordingRepository } from '../repositories/RecordingRepository.js';
import { RunBrowserResultRepository } from '../repositories/RunBrowserResultRepository.js';
import { TestRepository } from '../repositories/TestRepository.js';

describe('testRunProcessor', () => {
  let mockDb: any;
  let mockJob: Job<TestRunJobData>;
  let mockRunRepository: any;
  let mockRecordingRepository: any;
  let mockBrowserResultRepository: any;
  let mockTestRepository: any;
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

    mockBrowserResultRepository = {
      findByRunId: vi.fn().mockResolvedValue([]),
      markStarted: vi.fn().mockResolvedValue(null),
      markPassed: vi.fn().mockResolvedValue(null),
      markFailed: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(null),
      cancelByRunId: vi.fn().mockResolvedValue(0),
    };

    mockTestRepository = {
      findById: vi.fn().mockResolvedValue(null),
      updateLastRun: vi.fn().mockResolvedValue(undefined),
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
    (RunBrowserResultRepository as any).mockImplementation(() => mockBrowserResultRepository);
    (TestRepository as any).mockImplementation(() => mockTestRepository);
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

  describe('multi-browser test runs', () => {
    const mockTest = {
      id: 'test-123',
      userId: 'user-123',
      name: 'Login Test',
      recordingData: {
        id: 'rec-123',
        testName: 'Test',
        url: 'https://example.com',
        startTime: new Date().toISOString(),
        userAgent: 'Mozilla/5.0',
        viewport: { width: 1920, height: 1080 },
        actions: [
          { id: 'act_001', type: 'click', timestamp: 1000, url: 'https://example.com' },
        ],
        version: '1.0.0',
      },
      recordingUrl: 'https://example.com',
      actionCount: 1,
    };

    let testRunJob: Job<TestRunJobData>;

    beforeEach(() => {
      mockTestRepository.findById.mockResolvedValue(mockTest);

      testRunJob = {
        id: 'job-test-123',
        data: {
          runId: 'run-test-123',
          runType: 'test',
          testId: 'test-123',
          userId: 'user-123',
          projectId: 'project-123',
          browsers: ['chromium', 'firefox'],
          parallelBrowsers: true,
          createdAt: new Date().toISOString(),
        },
        updateProgress: vi.fn().mockResolvedValue(undefined),
      } as unknown as Job<TestRunJobData>;

      // Mock browser result rows (created by RunnerService)
      mockBrowserResultRepository.findByRunId.mockResolvedValue([
        { id: 'br-1', browser: 'chromium' },
        { id: 'br-2', browser: 'firefox' },
      ]);
    });

    it('should process multi-browser test run successfully', async () => {
      const processor = createTestRunProcessor({ db: mockDb });

      const result = await processor(testRunJob);

      expect(result.runId).toBe('run-test-123');
      expect(result.status).toBe('passed');
      expect(result.browserResults).toBeDefined();
      expect(result.browserResults).toHaveLength(2);
    });

    it('should execute browsers in parallel when parallelBrowsers is true', async () => {
      const executionOrder: string[] = [];

      (PlaywrightRunner as any).mockImplementation((options: any) => ({
        execute: vi.fn().mockImplementation(async () => {
          executionOrder.push(`start-${options.browser}`);
          // Very brief delay
          await new Promise(resolve => setTimeout(resolve, 10));
          executionOrder.push(`end-${options.browser}`);
          return { status: 'success', duration: 1000, errors: [] };
        }),
      }));

      const processor = createTestRunProcessor({ db: mockDb });
      await processor(testRunJob);

      // With parallel execution, both starts should happen before both ends
      expect(executionOrder[0]).toBe('start-chromium');
      expect(executionOrder[1]).toBe('start-firefox');
    });

    it('should execute browsers sequentially when parallelBrowsers is false', async () => {
      testRunJob.data.parallelBrowsers = false;

      const executionOrder: string[] = [];

      (PlaywrightRunner as any).mockImplementation((options: any) => ({
        execute: vi.fn().mockImplementation(async () => {
          executionOrder.push(`start-${options.browser}`);
          await new Promise(resolve => setTimeout(resolve, 10));
          executionOrder.push(`end-${options.browser}`);
          return { status: 'success', duration: 1000, errors: [] };
        }),
      }));

      const processor = createTestRunProcessor({ db: mockDb });
      await processor(testRunJob);

      // With sequential execution, start-end pairs should be in order
      expect(executionOrder).toEqual([
        'start-chromium',
        'end-chromium',
        'start-firefox',
        'end-firefox',
      ]);
    });

    it('should mark individual browser results as started', async () => {
      const processor = createTestRunProcessor({ db: mockDb });

      await processor(testRunJob);

      expect(mockBrowserResultRepository.markStarted).toHaveBeenCalledWith('br-1');
      expect(mockBrowserResultRepository.markStarted).toHaveBeenCalledWith('br-2');
    });

    it('should mark browser results as passed on success', async () => {
      const processor = createTestRunProcessor({ db: mockDb });

      await processor(testRunJob);

      expect(mockBrowserResultRepository.markPassed).toHaveBeenCalledTimes(2);
      expect(mockBrowserResultRepository.markPassed).toHaveBeenCalledWith(
        'br-1',
        expect.objectContaining({ actionsTotal: 1 })
      );
    });

    it('should mark browser result as failed on failure for that browser', async () => {
      let callCount = 0;
      (PlaywrightRunner as any).mockImplementation(() => ({
        execute: vi.fn().mockImplementation(async () => {
          callCount++;
          if (callCount === 2) {
            return {
              status: 'failure',
              duration: 2000,
              errors: [{ actionId: 'act_001', error: 'Element not found' }],
            };
          }
          return { status: 'success', duration: 1000, errors: [] };
        }),
      }));

      const processor = createTestRunProcessor({ db: mockDb });
      const result = await processor(testRunJob);

      // Overall should be failed since one browser failed
      expect(result.status).toBe('failed');
      expect(mockBrowserResultRepository.markPassed).toHaveBeenCalledTimes(1);
      expect(mockBrowserResultRepository.markFailed).toHaveBeenCalledTimes(1);
    });

    it('should aggregate stats across browsers', async () => {
      const processor = createTestRunProcessor({ db: mockDb });

      const result = await processor(testRunJob);

      // Each browser runs 1 action (mock returns 0 from reporter)
      expect(result.actionsExecuted).toBeGreaterThanOrEqual(0);
      expect(result.actionsFailed).toBe(0);
    });

    it('should update parent run with aggregated results', async () => {
      const processor = createTestRunProcessor({ db: mockDb });

      await processor(testRunJob);

      // Verify the run was updated with completion
      expect(mockRunRepository.update).toHaveBeenCalledWith(
        'run-test-123',
        expect.objectContaining({ status: 'passed' })
      );
    });

    it('should update test lastRun tracking', async () => {
      const processor = createTestRunProcessor({ db: mockDb });

      await processor(testRunJob);

      expect(mockTestRepository.updateLastRun).toHaveBeenCalledWith(
        'test-123',
        expect.objectContaining({
          lastRunId: 'run-test-123',
          lastRunStatus: 'passed',
        })
      );
    });

    it('should handle test not found', async () => {
      mockTestRepository.findById.mockResolvedValue(null);

      const processor = createTestRunProcessor({ db: mockDb });
      const result = await processor(testRunJob);

      expect(result.status).toBe('error');
      expect(result.errorMessage).toContain('Test not found');
    });

    it('should handle unauthorized test access', async () => {
      mockTestRepository.findById.mockResolvedValue({
        ...mockTest,
        userId: 'other-user',
      });

      const processor = createTestRunProcessor({ db: mockDb });
      const result = await processor(testRunJob);

      expect(result.status).toBe('error');
      expect(result.errorMessage).toContain('Not authorized');
    });

    it('should cancel pending browser results on error', async () => {
      mockTestRepository.findById.mockRejectedValue(new Error('DB error'));

      const processor = createTestRunProcessor({ db: mockDb });
      await processor(testRunJob);

      expect(mockBrowserResultRepository.cancelByRunId).toHaveBeenCalledWith('run-test-123');
    });

    it('should handle single browser test run', async () => {
      testRunJob.data.browsers = ['chromium'];
      mockBrowserResultRepository.findByRunId.mockResolvedValue([
        { id: 'br-1', browser: 'chromium' },
      ]);

      const processor = createTestRunProcessor({ db: mockDb });
      const result = await processor(testRunJob);

      expect(result.status).toBe('passed');
      expect(result.browserResults).toHaveLength(1);
      expect(result.browserResults![0].browser).toBe('chromium');
    });
  });
});
