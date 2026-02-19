/**
 * RunBrowserResultRepository Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RunBrowserResultRepository } from './RunBrowserResultRepository.js';

// Mock database
const createMockDb = () => {
  const mockResult = {
    id: 'result-123',
    userId: 'user-123',
    runId: 'run-123',
    testId: 'test-123',
    browser: 'chromium',
    status: 'passed' as const,
    durationMs: '1500',
    startedAt: new Date('2026-01-01T00:00:00Z'),
    completedAt: new Date('2026-01-01T00:00:01.5Z'),
    actionsTotal: '10',
    actionsExecuted: '10',
    actionsFailed: '0',
    actionsSkipped: '0',
    errorMessage: null,
    errorStack: null,
    errorActionId: null,
    errorActionIndex: null,
    videoPath: null,
    screenshotPath: null,
    tracePath: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const mockFailedResult = {
    ...mockResult,
    id: 'result-456',
    browser: 'firefox',
    status: 'failed' as const,
    actionsFailed: '2',
    errorMessage: 'Element not found',
    errorStack: 'Error: Element not found\n  at ...',
    errorActionId: 'act_003',
    errorActionIndex: '2',
  };

  return {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockResult]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockResult]),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockResult]),
          }),
        }),
        orderBy: vi.fn().mockResolvedValue([mockResult]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockResult]),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockResult]),
      }),
    }),
    _mockResult: mockResult,
    _mockFailedResult: mockFailedResult,
  };
};

describe('RunBrowserResultRepository', () => {
  let repository: RunBrowserResultRepository;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    repository = new RunBrowserResultRepository(mockDb as any);
  });

  describe('create', () => {
    it('should create a browser result', async () => {
      const result = await repository.create({
        userId: 'user-123',
        runId: 'run-123',
        testId: 'test-123',
        browser: 'chromium',
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('result-123');
      expect(result.browser).toBe('chromium');
      expect(result.status).toBe('passed');
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should default to pending status', async () => {
      await repository.create({
        userId: 'user-123',
        runId: 'run-123',
        testId: 'test-123',
        browser: 'firefox',
      });

      const insertValues = mockDb.insert.mock.results[0].value.values;
      expect(insertValues).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending' })
      );
    });
  });

  describe('createMany', () => {
    it('should create multiple browser results', async () => {
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            mockDb._mockResult,
            { ...mockDb._mockResult, id: 'result-456', browser: 'firefox' },
            { ...mockDb._mockResult, id: 'result-789', browser: 'webkit' },
          ]),
        }),
      });

      const results = await repository.createMany([
        { userId: 'user-123', runId: 'run-123', testId: 'test-123', browser: 'chromium' },
        { userId: 'user-123', runId: 'run-123', testId: 'test-123', browser: 'firefox' },
        { userId: 'user-123', runId: 'run-123', testId: 'test-123', browser: 'webkit' },
      ]);

      expect(results).toHaveLength(3);
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });

    it('should return empty array for empty input', async () => {
      const results = await repository.createMany([]);

      expect(results).toHaveLength(0);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should find a result by ID', async () => {
      const result = await repository.findById('result-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('result-123');
      expect(result?.durationMs).toBe(1500);
    });

    it('should return null when not found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });

    it('should parse numeric string fields correctly', async () => {
      const result = await repository.findById('result-123');

      expect(result?.durationMs).toBe(1500);
      expect(result?.actionsTotal).toBe(10);
      expect(result?.actionsExecuted).toBe(10);
      expect(result?.actionsFailed).toBe(0);
      expect(result?.actionsSkipped).toBe(0);
    });
  });

  describe('findByIdAndUser', () => {
    it('should find a result by ID and verify ownership', async () => {
      const result = await repository.findByIdAndUser('result-123', 'user-123');

      expect(result).toBeDefined();
      expect(result?.userId).toBe('user-123');
    });

    it('should return null when unauthorized', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.findByIdAndUser('result-123', 'other-user');

      expect(result).toBeNull();
    });
  });

  describe('findByRunId', () => {
    it('should return all results for a run', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              mockDb._mockResult,
              { ...mockDb._mockResult, id: 'result-456', browser: 'firefox' },
            ]),
          }),
        }),
      });

      const results = await repository.findByRunId('run-123');

      expect(results).toHaveLength(2);
    });
  });

  describe('findSummariesByRunId', () => {
    it('should return summaries for matrix view', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              {
                id: 'result-123',
                runId: 'run-123',
                testId: 'test-123',
                browser: 'chromium',
                status: 'passed',
                durationMs: '1500',
                actionsTotal: '10',
                actionsFailed: '0',
                errorMessage: null,
              },
            ]),
          }),
        }),
      });

      const summaries = await repository.findSummariesByRunId('run-123');

      expect(summaries).toHaveLength(1);
      expect(summaries[0].browser).toBe('chromium');
      expect(summaries[0].status).toBe('passed');
      expect(summaries[0].durationMs).toBe(1500);
    });
  });

  describe('findByTestId', () => {
    it('should return results history for a test', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockDb._mockResult]),
            }),
          }),
        }),
      });

      const results = await repository.findByTestId('test-123');

      expect(results).toHaveLength(1);
    });

    it('should respect limit parameter', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      await repository.findByTestId('test-123', 10);

      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe('findByRunTestBrowser', () => {
    it('should find specific result by unique combo', async () => {
      const result = await repository.findByRunTestBrowser(
        'run-123',
        'test-123',
        'chromium'
      );

      expect(result).toBeDefined();
      expect(result?.runId).toBe('run-123');
      expect(result?.testId).toBe('test-123');
      expect(result?.browser).toBe('chromium');
    });

    it('should return null when combo not found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.findByRunTestBrowser(
        'run-123',
        'test-123',
        'webkit'
      );

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update browser result fields', async () => {
      const result = await repository.update('result-123', {
        status: 'running',
        startedAt: new Date(),
      });

      expect(result).toBeDefined();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should convert numeric fields to strings', async () => {
      await repository.update('result-123', {
        durationMs: 2000,
        actionsTotal: 10,
        actionsExecuted: 8,
        actionsFailed: 2,
      });

      const setCall = mockDb.update.mock.results[0].value.set;
      expect(setCall).toHaveBeenCalledWith(
        expect.objectContaining({
          durationMs: '2000',
          actionsTotal: '10',
          actionsExecuted: '8',
          actionsFailed: '2',
        })
      );
    });

    it('should return null when result not found', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.update('non-existent', { status: 'running' });

      expect(result).toBeNull();
    });
  });

  describe('markStarted', () => {
    it('should mark a result as started', async () => {
      const result = await repository.markStarted('result-123');

      expect(result).toBeDefined();
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('markPassed', () => {
    it('should mark a result as passed with stats', async () => {
      const result = await repository.markPassed('result-123', {
        durationMs: 1500,
        actionsTotal: 10,
        actionsExecuted: 10,
        videoPath: '/videos/test.webm',
      });

      expect(result).toBeDefined();
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('markFailed', () => {
    it('should mark a result as failed with error details', async () => {
      const result = await repository.markFailed('result-123', {
        durationMs: 800,
        actionsTotal: 10,
        actionsExecuted: 3,
        actionsFailed: 1,
        errorMessage: 'Element not found',
        errorStack: 'Error: ...',
        errorActionId: 'act_003',
        errorActionIndex: 2,
      });

      expect(result).toBeDefined();
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('cancelByRunId', () => {
    it('should cancel pending/running results for a run', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              mockDb._mockResult,
              { ...mockDb._mockResult, id: 'result-456' },
            ]),
          }),
        }),
      });

      const count = await repository.cancelByRunId('run-123');

      expect(count).toBe(2);
    });

    it('should return 0 when no results to cancel', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const count = await repository.cancelByRunId('run-123');

      expect(count).toBe(0);
    });
  });

  describe('deleteByRunId', () => {
    it('should delete all results for a run', async () => {
      const count = await repository.deleteByRunId('run-123');

      expect(count).toBe(1);
      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  describe('getRunStats', () => {
    it('should return aggregate stats for a run', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              total: 3,
              passed: 2,
              failed: 1,
              running: 0,
              pending: 0,
              cancelled: 0,
              skipped: 0,
            },
          ]),
        }),
      });

      const stats = await repository.getRunStats('run-123');

      expect(stats.total).toBe(3);
      expect(stats.passed).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.running).toBe(0);
    });

    it('should return zeros when no results exist', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              total: 0,
              passed: 0,
              failed: 0,
              running: 0,
              pending: 0,
              cancelled: 0,
              skipped: 0,
            },
          ]),
        }),
      });

      const stats = await repository.getRunStats('run-empty');

      expect(stats.total).toBe(0);
      expect(stats.passed).toBe(0);
    });
  });
});
