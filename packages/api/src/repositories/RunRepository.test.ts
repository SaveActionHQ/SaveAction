/**
 * RunRepository Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RunRepository } from './RunRepository.js';

// Mock database response for runs
const createMockRunResult = (overrides: Record<string, unknown> = {}) => ({
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
  timeout: '30000',
  timingEnabled: true,
  timingMode: 'realistic',
  speedMultiplier: '1.0',
  actionsTotal: '10',
  actionsExecuted: '5',
  actionsFailed: '1',
  actionsSkipped: '0',
  durationMs: '5000',
  startedAt: new Date('2026-01-01T00:00:00Z'),
  completedAt: new Date('2026-01-01T00:01:00Z'),
  videoPath: '/videos/run-123.webm',
  screenshotPaths: '["screenshot1.png", "screenshot2.png"]',
  errorMessage: null,
  errorStack: null,
  errorActionId: null,
  triggeredBy: 'manual',
  scheduleId: null,
  ciMetadata: null,
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

// Mock database response for run actions
const createMockRunActionResult = (overrides: Record<string, unknown> = {}) => ({
  id: 'action-123',
  runId: 'run-123',
  actionId: 'act_001',
  actionType: 'click',
  actionIndex: '0',
  status: 'success',
  durationMs: '100',
  startedAt: new Date('2026-01-01T00:00:00Z'),
  completedAt: new Date('2026-01-01T00:00:01Z'),
  selectorUsed: 'css',
  selectorValue: '#button',
  retryCount: '0',
  retriedSelectors: null,
  errorMessage: null,
  errorStack: null,
  screenshotPath: null,
  screenshotBefore: null,
  screenshotAfter: null,
  elementFound: 'true',
  elementVisible: 'true',
  elementTagName: 'button',
  pageUrl: 'https://example.com',
  pageTitle: 'Test Page',
  createdAt: new Date('2026-01-01'),
  ...overrides,
});

// Create mock database
const createMockDb = () => {
  const mockRunResult = createMockRunResult();
  const mockRunActionResult = createMockRunActionResult();

  return {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockRunResult]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockRunResult]),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([mockRunResult]),
            }),
          }),
        }),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockRunResult]),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockRunResult]),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'run-123' }]),
      }),
    }),
  };
};

describe('RunRepository', () => {
  let repository: RunRepository;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    repository = new RunRepository(mockDb as any);
  });

  describe('create', () => {
    it('should create a run with default values', async () => {
      const createData = {
        userId: 'user-123',
        recordingId: 'recording-123',
        recordingName: 'Test Recording',
        recordingUrl: 'https://example.com',
      };

      const result = await repository.create(createData);

      expect(result).toBeDefined();
      expect(result.id).toBe('run-123');
      expect(result.userId).toBe('user-123');
      expect(result.recordingId).toBe('recording-123');
      expect(result.recordingName).toBe('Test Recording');
      expect(result.browser).toBe('chromium');
      expect(result.headless).toBe(true);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should create a run with custom options', async () => {
      const createData = {
        userId: 'user-123',
        recordingId: 'recording-123',
        recordingName: 'Test Recording',
        recordingUrl: 'https://example.com',
        browser: 'firefox' as const,
        headless: false,
        videoEnabled: true,
        timeout: 60000,
        triggeredBy: 'schedule',
        scheduleId: 'schedule-123',
      };

      const result = await repository.create(createData);

      expect(result).toBeDefined();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should create a run with CI metadata', async () => {
      const createData = {
        userId: 'user-123',
        recordingId: 'recording-123',
        recordingName: 'Test Recording',
        recordingUrl: 'https://example.com',
        ciMetadata: {
          provider: 'github',
          commit: 'abc123',
          branch: 'main',
        },
      };

      await repository.create(createData);

      const insertCall = mockDb.insert.mock.results[0].value.values;
      expect(insertCall).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should find a run by ID', async () => {
      const result = await repository.findById('run-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('run-123');
      expect(result?.status).toBe('queued');
      expect(result?.timeout).toBe(30000);
      expect(result?.speedMultiplier).toBe(1.0);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return null when run not found', async () => {
      // Mock empty result
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

    it('should include deleted runs when includeDeleted is true', async () => {
      await repository.findById('run-123', true);

      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe('findByJobId', () => {
    it('should find a run by job ID', async () => {
      const result = await repository.findByJobId('job-123');

      expect(result).toBeDefined();
      expect(result?.jobId).toBe('job-123');
    });

    it('should return null when job not found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.findByJobId('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findMany', () => {
    it('should list runs with default pagination', async () => {
      // Mock count query
      const mockWithCount = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([createMockRunResult()]),
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([createMockRunResult()]),
              }),
            }),
          }),
        }),
      };

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 1 }]),
          }),
        })
        .mockReturnValueOnce(mockWithCount);

      const result = await repository.findMany({ userId: 'user-123' });

      expect(result.data).toBeDefined();
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
    });

    it('should filter by status', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 5 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([createMockRunResult()]),
                }),
              }),
            }),
          }),
        });

      const result = await repository.findMany({
        userId: 'user-123',
        status: 'running',
      });

      expect(result.data).toBeDefined();
    });

    it('should filter by multiple statuses', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 5 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([createMockRunResult()]),
                }),
              }),
            }),
          }),
        });

      const result = await repository.findMany({
        userId: 'user-123',
        status: ['running', 'queued'],
      });

      expect(result.data).toBeDefined();
    });

    it('should filter by recording ID', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 3 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([createMockRunResult()]),
                }),
              }),
            }),
          }),
        });

      const result = await repository.findMany({
        userId: 'user-123',
        recordingId: 'recording-123',
      });

      expect(result.data).toBeDefined();
    });

    it('should sort by startedAt ascending', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 1 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([createMockRunResult()]),
                }),
              }),
            }),
          }),
        });

      await repository.findMany({ userId: 'user-123' }, { sortBy: 'startedAt', sortOrder: 'asc' });

      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update run status', async () => {
      const result = await repository.update('run-123', { status: 'running' });

      expect(result).toBeDefined();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should update run results', async () => {
      const result = await repository.update('run-123', {
        status: 'passed',
        actionsTotal: 10,
        actionsExecuted: 10,
        actionsFailed: 0,
        durationMs: 5000,
        completedAt: new Date(),
      });

      expect(result).toBeDefined();
    });

    it('should update error details', async () => {
      const result = await repository.update('run-123', {
        status: 'failed',
        errorMessage: 'Element not found',
        errorStack: 'Error: Element not found\n  at ...',
        errorActionId: 'act_003',
      });

      expect(result).toBeDefined();
    });

    it('should update video path', async () => {
      await repository.update('run-123', {
        videoPath: '/videos/run-123.webm',
      });

      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should return null when run not found', async () => {
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

  describe('softDelete', () => {
    it('should soft delete a run', async () => {
      const result = await repository.softDelete('run-123');

      expect(result).toBe(true);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should return false when run not found', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.softDelete('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('restore', () => {
    it('should restore a soft-deleted run', async () => {
      const result = await repository.restore('run-123');

      expect(result).toBeDefined();
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('hardDelete', () => {
    it('should permanently delete a run', async () => {
      const result = await repository.hardDelete('run-123');

      expect(result).toBe(true);
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('should return false when run not found', async () => {
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await repository.hardDelete('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('isOwner', () => {
    it('should return true when user owns the run', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'run-123' }]),
          }),
        }),
      });

      const result = await repository.isOwner('run-123', 'user-123');

      expect(result).toBe(true);
    });

    it('should return false when user does not own the run', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.isOwner('run-123', 'other-user');

      expect(result).toBe(false);
    });
  });

  describe('findOrphanedRuns', () => {
    it('should find runs that are running past timeout', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([createMockRunResult({ status: 'running' })]),
        }),
      });

      const result = await repository.findOrphanedRuns(600000); // 10 minutes

      expect(result).toHaveLength(1);
      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe('countByUserId', () => {
    it('should count runs for a user', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 42 }]),
        }),
      });

      const result = await repository.countByUserId('user-123');

      expect(result).toBe(42);
    });

    it('should return 0 when no runs', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await repository.countByUserId('user-123');

      expect(result).toBe(0);
    });
  });

  describe('findRecentByRecordingId', () => {
    it('should find recent runs for a recording', async () => {
      const mockRunData = createMockRunResult();
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockRunData]),
            }),
          }),
        }),
      });

      const result = await repository.findRecentByRecordingId('recording-123');

      expect(result).toHaveLength(1);
      expect(result[0].recordingId).toBe('recording-123');
    });
  });

  describe('Run Actions', () => {
    beforeEach(() => {
      // Reset mocks for action tests
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createMockRunActionResult()]),
        }),
      });
    });

    describe('createActions', () => {
      it('should create multiple actions in bulk', async () => {
        mockDb.insert.mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi
              .fn()
              .mockResolvedValue([
                createMockRunActionResult({ actionIndex: '0' }),
                createMockRunActionResult({ actionIndex: '1', actionId: 'act_002' }),
              ]),
          }),
        });

        const actions = [
          {
            runId: 'run-123',
            actionId: 'act_001',
            actionType: 'click',
            actionIndex: 0,
            status: 'success' as const,
          },
          {
            runId: 'run-123',
            actionId: 'act_002',
            actionType: 'input',
            actionIndex: 1,
            status: 'success' as const,
          },
        ];

        const result = await repository.createActions(actions);

        expect(result).toHaveLength(2);
        expect(mockDb.insert).toHaveBeenCalled();
      });

      it('should return empty array for empty input', async () => {
        const result = await repository.createActions([]);

        expect(result).toEqual([]);
        expect(mockDb.insert).not.toHaveBeenCalled();
      });

      it('should handle action with error details', async () => {
        mockDb.insert.mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              createMockRunActionResult({
                status: 'failed',
                errorMessage: 'Element not found',
              }),
            ]),
          }),
        });

        const actions = [
          {
            runId: 'run-123',
            actionId: 'act_001',
            actionType: 'click',
            actionIndex: 0,
            status: 'failed' as const,
            errorMessage: 'Element not found',
            errorStack: 'Error: Element not found\n  at ...',
          },
        ];

        const result = await repository.createActions(actions);

        expect(result[0].status).toBe('failed');
      });

      it('should handle action with retried selectors', async () => {
        const actions = [
          {
            runId: 'run-123',
            actionId: 'act_001',
            actionType: 'click',
            actionIndex: 0,
            status: 'success' as const,
            retryCount: 2,
            retriedSelectors: ['#btn-1', '.button-class'],
            selectorUsed: 'xpath',
            selectorValue: '//button[@id="submit"]',
          },
        ];

        await repository.createActions(actions);

        expect(mockDb.insert).toHaveBeenCalled();
      });
    });

    describe('createAction', () => {
      it('should create a single action', async () => {
        const action = {
          runId: 'run-123',
          actionId: 'act_001',
          actionType: 'click',
          actionIndex: 0,
          status: 'success' as const,
          durationMs: 100,
          pageUrl: 'https://example.com',
        };

        const result = await repository.createAction(action);

        expect(result).toBeDefined();
        expect(result.actionId).toBe('act_001');
      });
    });

    describe('findActionsByRunId', () => {
      it('should find all actions for a run', async () => {
        mockDb.select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi
                .fn()
                .mockResolvedValue([
                  createMockRunActionResult({ actionIndex: '0' }),
                  createMockRunActionResult({ actionIndex: '1', actionId: 'act_002' }),
                ]),
            }),
          }),
        });

        const result = await repository.findActionsByRunId('run-123');

        expect(result).toHaveLength(2);
        expect(result[0].actionIndex).toBe(0);
      });
    });

    describe('findFailedActionsByRunId', () => {
      it('should find only failed actions', async () => {
        mockDb.select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi
                .fn()
                .mockResolvedValue([
                  createMockRunActionResult({ status: 'failed', errorMessage: 'Error' }),
                ]),
            }),
          }),
        });

        const result = await repository.findFailedActionsByRunId('run-123');

        expect(result).toHaveLength(1);
        expect(result[0].status).toBe('failed');
      });
    });

    describe('deleteActionsByRunId', () => {
      it('should delete all actions for a run', async () => {
        mockDb.delete.mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi
              .fn()
              .mockResolvedValue([{ id: 'action-1' }, { id: 'action-2' }, { id: 'action-3' }]),
          }),
        });

        const result = await repository.deleteActionsByRunId('run-123');

        expect(result).toBe(3);
        expect(mockDb.delete).toHaveBeenCalled();
      });
    });
  });

  describe('SafeRun conversion', () => {
    it('should parse screenshotPaths JSON', async () => {
      const result = await repository.findById('run-123');

      expect(result?.screenshotPaths).toEqual(['screenshot1.png', 'screenshot2.png']);
    });

    it('should handle null screenshotPaths', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([createMockRunResult({ screenshotPaths: null })]),
          }),
        }),
      });

      const result = await repository.findById('run-123');

      expect(result?.screenshotPaths).toEqual([]);
    });

    it('should parse ciMetadata JSON', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              createMockRunResult({
                ciMetadata: '{"provider":"github","commit":"abc123"}',
              }),
            ]),
          }),
        }),
      });

      const result = await repository.findById('run-123');

      expect(result?.ciMetadata).toEqual({ provider: 'github', commit: 'abc123' });
    });

    it('should handle null numeric fields', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              createMockRunResult({
                actionsTotal: null,
                actionsExecuted: null,
                durationMs: null,
                speedMultiplier: null,
              }),
            ]),
          }),
        }),
      });

      const result = await repository.findById('run-123');

      expect(result?.actionsTotal).toBeNull();
      expect(result?.actionsExecuted).toBeNull();
      expect(result?.durationMs).toBeNull();
      expect(result?.speedMultiplier).toBeNull();
    });
  });

  describe('SafeRunAction conversion', () => {
    it('should parse boolean fields correctly', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              createMockRunActionResult({
                elementFound: 'true',
                elementVisible: 'false',
              }),
            ]),
          }),
        }),
      });

      const result = await repository.findActionsByRunId('run-123');

      expect(result[0].elementFound).toBe(true);
      expect(result[0].elementVisible).toBe(false);
    });

    it('should handle null elementVisible', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi
              .fn()
              .mockResolvedValue([createMockRunActionResult({ elementVisible: null })]),
          }),
        }),
      });

      const result = await repository.findActionsByRunId('run-123');

      expect(result[0].elementVisible).toBeNull();
    });

    it('should parse retriedSelectors JSON', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              createMockRunActionResult({
                retriedSelectors: '["#btn-1", ".btn-class"]',
              }),
            ]),
          }),
        }),
      });

      const result = await repository.findActionsByRunId('run-123');

      expect(result[0].retriedSelectors).toEqual(['#btn-1', '.btn-class']);
    });
  });
});
