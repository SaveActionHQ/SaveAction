/**
 * ScheduleRepository Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScheduleRepository } from './ScheduleRepository.js';
import type { ScheduleStatus } from '../db/schema/schedules.js';

// Mock schedule result
const createMockScheduleResult = (overrides = {}) => ({
  id: 'sched-123',
  userId: 'user-123',
  recordingId: 'rec-123',
  name: 'Daily Test Run',
  description: 'Runs tests every day',
  cronExpression: '0 9 * * *',
  timezone: 'UTC',
  status: 'active' as ScheduleStatus,
  startsAt: null,
  endsAt: null,
  bullmqJobKey: 'schedule:sched-123',
  bullmqJobPattern: '0 9 * * *',
  runConfig: { browser: 'chromium', headless: true },
  maxConcurrent: '1',
  maxDailyRuns: null,
  runsToday: '0',
  runsThisMonth: '5',
  lastRunId: 'run-456',
  lastRunAt: new Date('2026-01-15T09:00:00Z'),
  lastRunStatus: 'passed',
  nextRunAt: new Date('2026-01-16T09:00:00Z'),
  totalRuns: '10',
  successfulRuns: '8',
  failedRuns: '2',
  notifyOnFailure: true,
  notifyOnSuccess: false,
  notificationEmails: 'test@example.com',
  deletedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-15T09:00:00Z'),
  ...overrides,
});

// Mock database
const createMockDb = () => {
  const mockResult = createMockScheduleResult();

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
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([mockResult]),
            }),
          }),
        }),
        orderBy: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockResult]),
          }),
        }),
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
        returning: vi.fn().mockResolvedValue([{ id: 'sched-123' }]),
      }),
    }),
  };
};

describe('ScheduleRepository', () => {
  let repository: ScheduleRepository;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    repository = new ScheduleRepository(mockDb as any);
  });

  describe('create', () => {
    it('should create a schedule successfully', async () => {
      const createData = {
        userId: 'user-123',
        recordingId: 'rec-123',
        name: 'Daily Test Run',
        cronExpression: '0 9 * * *',
      };

      const result = await repository.create(createData);

      expect(result).toBeDefined();
      expect(result.id).toBe('sched-123');
      expect(result.name).toBe('Daily Test Run');
      expect(result.cronExpression).toBe('0 9 * * *');
      expect(result.timezone).toBe('UTC');
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should create a schedule with all optional fields', async () => {
      const createData = {
        userId: 'user-123',
        recordingId: 'rec-123',
        name: 'Full Schedule',
        description: 'Full schedule with all options',
        cronExpression: '0 0 * * 1',
        timezone: 'America/New_York',
        runConfig: {
          browser: 'firefox' as const,
          headless: false,
          timeout: 60000,
          retries: 2,
        },
        startsAt: new Date('2026-02-01'),
        endsAt: new Date('2026-12-31'),
        notifyOnFailure: true,
        notifyOnSuccess: true,
        notificationEmails: 'alert@example.com',
      };

      const result = await repository.create(createData);

      expect(result).toBeDefined();
      expect(result.id).toBe('sched-123');
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should use default timezone when not specified', async () => {
      const createData = {
        userId: 'user-123',
        recordingId: 'rec-123',
        name: 'Test',
        cronExpression: '* * * * *',
      };

      await repository.create(createData);

      const insertCall = mockDb.insert.mock.results[0].value.values;
      expect(insertCall).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should find schedule by ID', async () => {
      const result = await repository.findById('sched-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('sched-123');
      expect(result?.name).toBe('Daily Test Run');
    });

    it('should return null when schedule not found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should include deleted schedules when requested', async () => {
      const deletedSchedule = createMockScheduleResult({
        deletedAt: new Date('2026-01-15'),
      });
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([deletedSchedule]),
          }),
        }),
      });

      const result = await repository.findById('sched-123', { includeDeleted: true });

      expect(result).toBeDefined();
      expect(result?.deletedAt).toBeDefined();
    });

    it('should parse numeric string fields correctly', async () => {
      const result = await repository.findById('sched-123');

      expect(result?.maxConcurrent).toBe(1);
      expect(result?.runsToday).toBe(0);
      expect(result?.runsThisMonth).toBe(5);
      expect(result?.totalRuns).toBe(10);
      expect(result?.successfulRuns).toBe(8);
      expect(result?.failedRuns).toBe(2);
    });
  });

  describe('findByJobKey', () => {
    it('should find schedule by BullMQ job key', async () => {
      const result = await repository.findByJobKey('schedule:sched-123');

      expect(result).toBeDefined();
      expect(result?.bullmqJobKey).toBe('schedule:sched-123');
    });

    it('should return null when job key not found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.findByJobKey('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update schedule successfully', async () => {
      const updateData = {
        name: 'Updated Schedule',
        cronExpression: '0 10 * * *',
      };

      const result = await repository.update('sched-123', updateData);

      expect(result).toBeDefined();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should return null when schedule not found', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.update('nonexistent', { name: 'Test' });

      expect(result).toBeNull();
    });

    it('should update status', async () => {
      const updateData = {
        status: 'paused' as ScheduleStatus,
      };

      const result = await repository.update('sched-123', updateData);

      expect(result).toBeDefined();
    });

    it('should update run config', async () => {
      const updateData = {
        runConfig: {
          browser: 'webkit' as const,
          headless: false,
        },
      };

      const result = await repository.update('sched-123', updateData);

      expect(result).toBeDefined();
    });

    it('should update notification settings', async () => {
      const updateData = {
        notifyOnFailure: false,
        notifyOnSuccess: true,
        notificationEmails: 'new@example.com',
      };

      const result = await repository.update('sched-123', updateData);

      expect(result).toBeDefined();
    });
  });

  describe('incrementRunCounters', () => {
    it('should increment counters for successful run', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowCount: 1 }),
        }),
      });

      await repository.incrementRunCounters('sched-123', 'success');

      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should increment counters for failed run', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowCount: 1 }),
        }),
      });

      await repository.incrementRunCounters('sched-123', 'failed');

      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('resetDailyCounters', () => {
    it('should reset daily counters', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowCount: 5 }),
        }),
      });

      const result = await repository.resetDailyCounters();

      expect(result).toBe(5);
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('should soft delete schedule', async () => {
      const deletedSchedule = createMockScheduleResult({
        deletedAt: new Date(),
        status: 'disabled',
      });
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([deletedSchedule]),
          }),
        }),
      });

      const result = await repository.softDelete('sched-123');

      expect(result).toBe(true);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should return false when schedule not found', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.softDelete('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('restore', () => {
    it('should restore deleted schedule', async () => {
      const restoredSchedule = createMockScheduleResult({
        deletedAt: null,
        status: 'paused',
      });
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([restoredSchedule]),
          }),
        }),
      });

      const result = await repository.restore('sched-123');

      expect(result).toBeDefined();
      expect(result?.deletedAt).toBeNull();
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('hardDelete', () => {
    it('should permanently delete schedule', async () => {
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 1 }),
      });

      const result = await repository.hardDelete('sched-123');

      expect(result).toBe(true);
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('should return false when schedule not found', async () => {
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 0 }),
      });

      const result = await repository.hardDelete('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getActiveSchedules', () => {
    it('should get all active schedules', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockResolvedValue([
              createMockScheduleResult(),
              createMockScheduleResult({ id: 'sched-456' }),
            ]),
        }),
      });

      const result = await repository.getActiveSchedules();

      expect(result).toHaveLength(2);
    });
  });

  describe('getDueSchedules', () => {
    it('should get schedules due for execution', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([createMockScheduleResult()]),
        }),
      });

      const result = await repository.getDueSchedules(new Date());

      expect(result).toHaveLength(1);
    });
  });

  describe('countByUser', () => {
    it('should count schedules for user', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 5 }]),
        }),
      });

      const result = await repository.countByUser('user-123');

      expect(result).toBe(5);
    });
  });

  describe('SafeSchedule conversion', () => {
    it('should handle null maxDailyRuns', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([createMockScheduleResult({ maxDailyRuns: null })]),
          }),
        }),
      });

      const result = await repository.findById('sched-123');

      expect(result?.maxDailyRuns).toBeNull();
    });

    it('should handle null runConfig', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([createMockScheduleResult({ runConfig: null })]),
          }),
        }),
      });

      const result = await repository.findById('sched-123');

      expect(result?.runConfig).toBeNull();
    });

    it('should default notifyOnFailure to true', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([createMockScheduleResult({ notifyOnFailure: null })]),
          }),
        }),
      });

      const result = await repository.findById('sched-123');

      expect(result?.notifyOnFailure).toBe(true);
    });

    it('should default notifyOnSuccess to false', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([createMockScheduleResult({ notifyOnSuccess: null })]),
          }),
        }),
      });

      const result = await repository.findById('sched-123');

      expect(result?.notifyOnSuccess).toBe(false);
    });
  });
});
