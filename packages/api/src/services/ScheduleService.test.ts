/**
 * ScheduleService Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ScheduleService,
  ScheduleError,
  ScheduleErrors,
  createScheduleSchema,
  updateScheduleSchema,
} from './ScheduleService.js';
import type {
  ScheduleRepository,
  SafeSchedule,
  ScheduleSummary,
} from '../repositories/ScheduleRepository.js';
import type { ScheduleStatus } from '../db/schema/schedules.js';

// Sample schedule data
const sampleSafeSchedule: SafeSchedule = {
  id: 'sched-123',
  userId: 'user-123',
  recordingId: 'rec-123',
  name: 'Daily Test Run',
  description: 'Runs tests every day at 9 AM',
  cronExpression: '0 9 * * *',
  timezone: 'UTC',
  status: 'active' as ScheduleStatus,
  startsAt: null,
  endsAt: null,
  bullmqJobKey: 'schedule:sched-123',
  bullmqJobPattern: '0 9 * * *',
  runConfig: { browser: 'chromium', headless: true },
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

const sampleScheduleSummary: ScheduleSummary = {
  id: 'sched-123',
  userId: 'user-123',
  recordingId: 'rec-123',
  name: 'Daily Test Run',
  cronExpression: '0 9 * * *',
  timezone: 'UTC',
  status: 'active' as ScheduleStatus,
  nextRunAt: new Date('2026-01-16T09:00:00Z'),
  lastRunAt: new Date('2026-01-15T09:00:00Z'),
  lastRunStatus: 'passed',
  totalRuns: 10,
  successfulRuns: 8,
  failedRuns: 2,
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

const sampleRecording = {
  id: 'rec-123',
  userId: 'user-123',
  name: 'Test Recording',
  url: 'https://example.com',
  data: {
    id: 'rec_123',
    testName: 'Test',
    url: 'https://example.com',
    startTime: '2026-01-01T00:00:00Z',
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Test',
    actions: [],
    version: '1.0.0',
  },
};

// Mock repository
type MockedScheduleRepository = {
  create: ReturnType<typeof vi.fn>;
  findById: ReturnType<typeof vi.fn>;
  findByJobKey: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  incrementRunCounters: ReturnType<typeof vi.fn>;
  resetDailyCounters: ReturnType<typeof vi.fn>;
  softDelete: ReturnType<typeof vi.fn>;
  restore: ReturnType<typeof vi.fn>;
  hardDelete: ReturnType<typeof vi.fn>;
  getActiveSchedules: ReturnType<typeof vi.fn>;
  getDueSchedules: ReturnType<typeof vi.fn>;
  countByUser: ReturnType<typeof vi.fn>;
};

type MockedRecordingRepository = {
  findById: ReturnType<typeof vi.fn>;
};

type MockedJobQueueManager = {
  addRepeatableJob: ReturnType<typeof vi.fn>;
  removeRepeatableJob: ReturnType<typeof vi.fn>;
};

const createMockScheduleRepository = (): MockedScheduleRepository => ({
  create: vi.fn().mockResolvedValue(sampleSafeSchedule),
  findById: vi.fn().mockResolvedValue(sampleSafeSchedule),
  findByJobKey: vi.fn().mockResolvedValue(sampleSafeSchedule),
  list: vi.fn().mockResolvedValue({
    data: [sampleScheduleSummary],
    pagination: {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    },
  }),
  update: vi.fn().mockResolvedValue(sampleSafeSchedule),
  incrementRunCounters: vi.fn().mockResolvedValue(undefined),
  resetDailyCounters: vi.fn().mockResolvedValue(undefined),
  softDelete: vi.fn().mockResolvedValue(true),
  restore: vi.fn().mockResolvedValue(sampleSafeSchedule),
  hardDelete: vi.fn().mockResolvedValue(true),
  getActiveSchedules: vi.fn().mockResolvedValue([sampleSafeSchedule]),
  getDueSchedules: vi.fn().mockResolvedValue([sampleSafeSchedule]),
  countByUser: vi.fn().mockResolvedValue(5),
});

const createMockRecordingRepository = (): MockedRecordingRepository => ({
  findById: vi.fn().mockResolvedValue(sampleRecording),
});

const createMockJobQueueManager = (): MockedJobQueueManager => ({
  addRepeatableJob: vi.fn().mockResolvedValue(undefined),
  removeRepeatableJob: vi.fn().mockResolvedValue(true),
});

describe('ScheduleService', () => {
  let service: ScheduleService;
  let mockScheduleRepository: MockedScheduleRepository;
  let mockRecordingRepository: MockedRecordingRepository;
  let mockJobQueueManager: MockedJobQueueManager;

  beforeEach(() => {
    mockScheduleRepository = createMockScheduleRepository();
    mockRecordingRepository = createMockRecordingRepository();
    mockJobQueueManager = createMockJobQueueManager();
    service = new ScheduleService(
      mockScheduleRepository as unknown as ScheduleRepository,
      mockRecordingRepository as any,
      mockJobQueueManager as any
    );
  });

  describe('ScheduleError', () => {
    it('should create error with code and status', () => {
      const error = new ScheduleError('Test error', 'TEST_ERROR', 400);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.statusCode).toBe(400);
    });

    it('should default status to 400', () => {
      const error = new ScheduleError('Test error', 'TEST_ERROR');
      expect(error.statusCode).toBe(400);
    });
  });

  describe('ScheduleErrors', () => {
    it('should have NOT_FOUND with 404 status', () => {
      expect(ScheduleErrors.NOT_FOUND.statusCode).toBe(404);
      expect(ScheduleErrors.NOT_FOUND.code).toBe('SCHEDULE_NOT_FOUND');
    });

    it('should have NOT_AUTHORIZED with 403 status', () => {
      expect(ScheduleErrors.NOT_AUTHORIZED.statusCode).toBe(403);
    });

    it('should have INVALID_CRON with 400 status', () => {
      expect(ScheduleErrors.INVALID_CRON.statusCode).toBe(400);
    });

    it('should have INVALID_TIMEZONE with 400 status', () => {
      expect(ScheduleErrors.INVALID_TIMEZONE.statusCode).toBe(400);
    });
  });

  describe('createSchedule', () => {
    it('should create schedule successfully', async () => {
      const request = {
        recordingId: 'rec-123',
        name: 'Daily Test Run',
        cronExpression: '0 9 * * *',
      };

      const result = await service.createSchedule('user-123', request);

      expect(result).toBeDefined();
      expect(result.id).toBe('sched-123');
      expect(mockRecordingRepository.findById).toHaveBeenCalledWith('rec-123');
      expect(mockScheduleRepository.create).toHaveBeenCalled();
    });

    it('should throw when recording not found', async () => {
      mockRecordingRepository.findById.mockResolvedValue(null);

      const request = {
        recordingId: 'nonexistent',
        name: 'Test',
        cronExpression: '0 9 * * *',
      };

      await expect(service.createSchedule('user-123', request)).rejects.toThrow(ScheduleError);
    });

    it('should throw when recording belongs to another user', async () => {
      mockRecordingRepository.findById.mockResolvedValue({
        ...sampleRecording,
        userId: 'other-user',
      });

      const request = {
        recordingId: 'rec-123',
        name: 'Test',
        cronExpression: '0 9 * * *',
      };

      await expect(service.createSchedule('user-123', request)).rejects.toThrow(ScheduleError);
    });

    it('should throw when cron expression is invalid', async () => {
      const request = {
        recordingId: 'rec-123',
        name: 'Test',
        cronExpression: 'invalid cron',
      };

      await expect(service.createSchedule('user-123', request)).rejects.toThrow(ScheduleError);
    });

    it('should throw when timezone is invalid', async () => {
      const request = {
        recordingId: 'rec-123',
        name: 'Test',
        cronExpression: '0 9 * * *',
        timezone: 'Invalid/Timezone',
      };

      await expect(service.createSchedule('user-123', request)).rejects.toThrow(ScheduleError);
    });

    it('should throw when max schedules reached', async () => {
      mockScheduleRepository.countByUser.mockResolvedValue(50);

      const request = {
        recordingId: 'rec-123',
        name: 'Test',
        cronExpression: '0 9 * * *',
      };

      await expect(service.createSchedule('user-123', request)).rejects.toThrow(ScheduleError);
    });

    it('should add BullMQ repeatable job when job queue manager is available', async () => {
      const request = {
        recordingId: 'rec-123',
        name: 'Test',
        cronExpression: '0 9 * * *',
      };

      await service.createSchedule('user-123', request);

      expect(mockJobQueueManager.addRepeatableJob).toHaveBeenCalled();
    });
  });

  describe('getSchedule', () => {
    it('should get schedule by ID', async () => {
      const result = await service.getSchedule('user-123', 'sched-123');

      expect(result).toBeDefined();
      expect(result.id).toBe('sched-123');
    });

    it('should throw when schedule not found', async () => {
      mockScheduleRepository.findById.mockResolvedValue(null);

      await expect(service.getSchedule('user-123', 'nonexistent')).rejects.toThrow(ScheduleError);
    });

    it('should throw when user not authorized', async () => {
      mockScheduleRepository.findById.mockResolvedValue({
        ...sampleSafeSchedule,
        userId: 'other-user',
      });

      await expect(service.getSchedule('user-123', 'sched-123')).rejects.toThrow(ScheduleError);
    });
  });

  describe('listSchedules', () => {
    it('should list schedules with default options', async () => {
      const result = await service.listSchedules('user-123');

      expect(result.data).toHaveLength(1);
      expect(result.pagination).toBeDefined();
      expect(mockScheduleRepository.list).toHaveBeenCalled();
    });

    it('should list schedules with filters', async () => {
      await service.listSchedules('user-123', { recordingId: 'rec-123' });

      expect(mockScheduleRepository.list).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          recordingId: 'rec-123',
        }),
        undefined
      );
    });
  });

  describe('updateSchedule', () => {
    it('should update schedule successfully', async () => {
      const updateData = {
        name: 'Updated Schedule',
      };

      const result = await service.updateSchedule('user-123', 'sched-123', updateData);

      expect(result).toBeDefined();
      expect(mockScheduleRepository.update).toHaveBeenCalled();
    });

    it('should throw when schedule not found', async () => {
      mockScheduleRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateSchedule('user-123', 'nonexistent', { name: 'Test' })
      ).rejects.toThrow(ScheduleError);
    });

    it('should throw when user not authorized', async () => {
      mockScheduleRepository.findById.mockResolvedValue({
        ...sampleSafeSchedule,
        userId: 'other-user',
      });

      await expect(
        service.updateSchedule('user-123', 'sched-123', { name: 'Test' })
      ).rejects.toThrow(ScheduleError);
    });

    it('should validate new cron expression', async () => {
      await expect(
        service.updateSchedule('user-123', 'sched-123', { cronExpression: 'invalid' })
      ).rejects.toThrow(ScheduleError);
    });

    it('should validate new timezone', async () => {
      await expect(
        service.updateSchedule('user-123', 'sched-123', { timezone: 'Invalid/Zone' })
      ).rejects.toThrow(ScheduleError);
    });
  });

  describe('toggleSchedule', () => {
    it('should toggle schedule status', async () => {
      const result = await service.toggleSchedule('user-123', 'sched-123');

      expect(result).toBeDefined();
      expect(mockScheduleRepository.update).toHaveBeenCalled();
    });

    it('should throw when schedule not found', async () => {
      mockScheduleRepository.findById.mockResolvedValue(null);

      await expect(service.toggleSchedule('user-123', 'nonexistent')).rejects.toThrow(
        ScheduleError
      );
    });

    it('should throw when user not authorized', async () => {
      mockScheduleRepository.findById.mockResolvedValue({
        ...sampleSafeSchedule,
        userId: 'other-user',
      });

      await expect(service.toggleSchedule('user-123', 'sched-123')).rejects.toThrow(ScheduleError);
    });
  });

  describe('deleteSchedule', () => {
    it('should soft delete schedule', async () => {
      await service.deleteSchedule('user-123', 'sched-123');

      expect(mockScheduleRepository.softDelete).toHaveBeenCalledWith('sched-123');
    });

    it('should throw when schedule not found', async () => {
      mockScheduleRepository.findById.mockResolvedValue(null);

      await expect(service.deleteSchedule('user-123', 'nonexistent')).rejects.toThrow(
        ScheduleError
      );
    });

    it('should throw when user not authorized', async () => {
      mockScheduleRepository.findById.mockResolvedValue({
        ...sampleSafeSchedule,
        userId: 'other-user',
      });

      await expect(service.deleteSchedule('user-123', 'sched-123')).rejects.toThrow(ScheduleError);
    });
  });

  describe('restoreSchedule', () => {
    it('should restore deleted schedule', async () => {
      mockScheduleRepository.findById.mockResolvedValue({
        ...sampleSafeSchedule,
        deletedAt: new Date(),
      });

      const result = await service.restoreSchedule('user-123', 'sched-123');

      expect(result).toBeDefined();
      expect(mockScheduleRepository.restore).toHaveBeenCalled();
    });

    it('should throw when schedule not deleted', async () => {
      await expect(service.restoreSchedule('user-123', 'sched-123')).rejects.toThrow(ScheduleError);
    });
  });

  describe('permanentDeleteSchedule', () => {
    it('should permanently delete schedule', async () => {
      mockScheduleRepository.findById.mockResolvedValue({
        ...sampleSafeSchedule,
        deletedAt: new Date(),
      });

      await service.permanentDeleteSchedule('user-123', 'sched-123');

      expect(mockScheduleRepository.hardDelete).toHaveBeenCalledWith('sched-123');
    });
  });

  describe('syncSchedulesOnStartup', () => {
    it('should sync all active schedules with BullMQ', async () => {
      const result = await service.syncSchedulesOnStartup();

      expect(result).toHaveProperty('synced');
      expect(result).toHaveProperty('failed');
      expect(mockScheduleRepository.getActiveSchedules).toHaveBeenCalled();
    });

    it('should return zeros when job queue manager not available', async () => {
      const serviceWithoutQueue = new ScheduleService(
        mockScheduleRepository as unknown as ScheduleRepository,
        mockRecordingRepository as any
      );

      const result = await serviceWithoutQueue.syncSchedulesOnStartup();

      expect(result).toEqual({ synced: 0, failed: 0 });
    });
  });

  describe('updateAfterRun', () => {
    it('should update schedule after run', async () => {
      await service.updateAfterRun('sched-123', 'run-789', 'passed');

      expect(mockScheduleRepository.update).toHaveBeenCalled();
      expect(mockScheduleRepository.incrementRunCounters).toHaveBeenCalled();
    });

    it('should handle failed run', async () => {
      await service.updateAfterRun('sched-123', 'run-789', 'failed');

      expect(mockScheduleRepository.incrementRunCounters).toHaveBeenCalledWith(
        'sched-123',
        'failed'
      );
    });

    it('should skip if schedule not found', async () => {
      mockScheduleRepository.findById.mockResolvedValue(null);

      await service.updateAfterRun('nonexistent', 'run-789', 'passed');

      expect(mockScheduleRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('Validation Schemas', () => {
    describe('createScheduleSchema', () => {
      it('should validate valid create request', () => {
        const data = {
          recordingId: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test Schedule',
          cronExpression: '0 9 * * *',
        };

        const result = createScheduleSchema.safeParse(data);
        expect(result.success).toBe(true);
      });

      it('should reject missing required fields', () => {
        const data = {
          name: 'Test',
        };

        const result = createScheduleSchema.safeParse(data);
        expect(result.success).toBe(false);
      });

      it('should validate optional fields', () => {
        const data = {
          recordingId: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test Schedule',
          cronExpression: '0 9 * * *',
          description: 'Test description',
          timezone: 'America/New_York',
          runConfig: {
            browser: 'firefox',
            headless: false,
          },
        };

        const result = createScheduleSchema.safeParse(data);
        expect(result.success).toBe(true);
      });

      it('should reject invalid browser type', () => {
        const data = {
          recordingId: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test',
          cronExpression: '0 9 * * *',
          runConfig: {
            browser: 'invalid',
          },
        };

        const result = createScheduleSchema.safeParse(data);
        expect(result.success).toBe(false);
      });
    });

    describe('updateScheduleSchema', () => {
      it('should validate partial update', () => {
        const data = {
          name: 'Updated Name',
        };

        const result = updateScheduleSchema.safeParse(data);
        expect(result.success).toBe(true);
      });

      it('should validate empty update', () => {
        const data = {};

        const result = updateScheduleSchema.safeParse(data);
        expect(result.success).toBe(true);
      });

      it('should validate full update', () => {
        const data = {
          name: 'Updated',
          description: 'Updated description',
          cronExpression: '0 10 * * *',
          timezone: 'Europe/London',
        };

        const result = updateScheduleSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Service without JobQueueManager', () => {
    let serviceWithoutQueue: ScheduleService;

    beforeEach(() => {
      mockScheduleRepository = createMockScheduleRepository();
      mockRecordingRepository = createMockRecordingRepository();
      serviceWithoutQueue = new ScheduleService(
        mockScheduleRepository as unknown as ScheduleRepository,
        mockRecordingRepository as any
      );
    });

    it('should create schedule without BullMQ integration', async () => {
      const request = {
        recordingId: 'rec-123',
        name: 'Test',
        cronExpression: '0 9 * * *',
      };

      const result = await serviceWithoutQueue.createSchedule('user-123', request);

      expect(result).toBeDefined();
    });

    it('should delete schedule without BullMQ integration', async () => {
      await serviceWithoutQueue.deleteSchedule('user-123', 'sched-123');

      expect(mockScheduleRepository.softDelete).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle various cron expressions', async () => {
      const expressions = [
        '* * * * *', // every minute
        '0 0 * * *', // daily at midnight
        '0 0 * * 0', // weekly on Sunday
        '0 0 1 * *', // monthly on 1st
        '0 0 1 1 *', // yearly on Jan 1
      ];

      for (const cronExpression of expressions) {
        const request = {
          recordingId: 'rec-123',
          name: 'Test',
          cronExpression,
        };

        const result = await service.createSchedule('user-123', request);
        expect(result).toBeDefined();
      }
    });

    it('should handle various timezones', async () => {
      const timezones = [
        'UTC',
        'America/New_York',
        'Europe/London',
        'Asia/Tokyo',
        'Australia/Sydney',
      ];

      for (const timezone of timezones) {
        const request = {
          recordingId: 'rec-123',
          name: 'Test',
          cronExpression: '0 9 * * *',
          timezone,
        };

        const result = await service.createSchedule('user-123', request);
        expect(result).toBeDefined();
      }
    });
  });
});
