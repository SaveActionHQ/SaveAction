/**
 * Schedule Service
 *
 * Business logic for scheduled test runs.
 * Handles cron validation, BullMQ integration, and schedule management.
 */

import { z } from 'zod';
import { CronExpressionParser } from 'cron-parser';
import type {
  ScheduleRepository,
  ScheduleCreateData,
  ScheduleUpdateData,
  ScheduleListFilters,
  PaginationOptions,
  PaginatedResult,
  SafeSchedule,
  ScheduleSummary,
} from '../repositories/ScheduleRepository.js';
import type { RecordingRepository } from '../repositories/RecordingRepository.js';
import type { JobQueueManager } from '../queues/JobQueueManager.js';
import type { ScheduledTestJobData } from '../queues/types.js';

/**
 * Schedule Service Error
 */
export class ScheduleError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'ScheduleError';
  }
}

/**
 * Predefined Schedule errors
 */
export const ScheduleErrors = {
  NOT_FOUND: new ScheduleError('Schedule not found', 'SCHEDULE_NOT_FOUND', 404),
  NOT_AUTHORIZED: new ScheduleError(
    'Not authorized to access this schedule',
    'NOT_AUTHORIZED',
    403
  ),
  RECORDING_NOT_FOUND: new ScheduleError('Recording not found', 'RECORDING_NOT_FOUND', 404),
  INVALID_CRON: new ScheduleError('Invalid cron expression', 'INVALID_CRON', 400),
  INVALID_TIMEZONE: new ScheduleError('Invalid timezone', 'INVALID_TIMEZONE', 400),
  ALREADY_DELETED: new ScheduleError('Schedule is already deleted', 'ALREADY_DELETED', 400),
  INVALID_STATUS_TRANSITION: new ScheduleError(
    'Invalid status transition',
    'INVALID_STATUS_TRANSITION',
    400
  ),
  MAX_SCHEDULES_REACHED: new ScheduleError(
    'Maximum number of schedules reached',
    'MAX_SCHEDULES_REACHED',
    400
  ),
  BULLMQ_NOT_AVAILABLE: new ScheduleError('Job queue not available', 'BULLMQ_NOT_AVAILABLE', 503),
} as const;

/**
 * Zod schema for schedule creation
 */
export const createScheduleSchema = z.object({
  recordingId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  cronExpression: z.string().min(9).max(100), // "* * * * *" minimum
  timezone: z.string().max(100).optional(),
  runConfig: z
    .object({
      browser: z.enum(['chromium', 'firefox', 'webkit']).optional(),
      headless: z.boolean().optional(),
      timeout: z.number().min(1000).max(600000).optional(),
      viewport: z
        .object({
          width: z.number().min(100).max(4096),
          height: z.number().min(100).max(4096),
        })
        .optional(),
      retries: z.number().min(0).max(5).optional(),
      environment: z.record(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      recordVideo: z.boolean().optional(),
      screenshotMode: z.enum(['on-failure', 'always', 'never']).optional(),
    })
    .optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  notifyOnFailure: z.boolean().optional(),
  notifyOnSuccess: z.boolean().optional(),
  notificationEmails: z.string().max(500).optional(),
});

/**
 * Zod schema for schedule update
 */
export const updateScheduleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  cronExpression: z.string().min(9).max(100).optional(),
  timezone: z.string().max(100).optional(),
  runConfig: z
    .object({
      browser: z.enum(['chromium', 'firefox', 'webkit']).optional(),
      headless: z.boolean().optional(),
      timeout: z.number().min(1000).max(600000).optional(),
      viewport: z
        .object({
          width: z.number().min(100).max(4096),
          height: z.number().min(100).max(4096),
        })
        .optional(),
      retries: z.number().min(0).max(5).optional(),
      environment: z.record(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      recordVideo: z.boolean().optional(),
      screenshotMode: z.enum(['on-failure', 'always', 'never']).optional(),
    })
    .optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  notifyOnFailure: z.boolean().optional(),
  notifyOnSuccess: z.boolean().optional(),
  notificationEmails: z.string().max(500).nullable().optional(),
});

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;

/**
 * Service options
 */
export interface ScheduleServiceOptions {
  maxSchedulesPerUser?: number;
}

/**
 * Schedule Service class
 */
export class ScheduleService {
  private readonly maxSchedulesPerUser: number;

  constructor(
    private readonly scheduleRepository: ScheduleRepository,
    private readonly recordingRepository: RecordingRepository,
    private readonly jobQueueManager?: JobQueueManager,
    options?: ScheduleServiceOptions
  ) {
    this.maxSchedulesPerUser = options?.maxSchedulesPerUser ?? 50;
  }

  /**
   * Validate cron expression
   */
  private validateCronExpression(expression: string): { valid: boolean; error?: string } {
    try {
      CronExpressionParser.parse(expression);
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid cron expression',
      };
    }
  }

  /**
   * Validate timezone
   */
  private validateTimezone(timezone: string): boolean {
    try {
      // Intl.DateTimeFormat will throw if timezone is invalid
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Calculate next run time from cron expression
   */
  private calculateNextRunTime(cronExpression: string, timezone: string = 'UTC'): Date | null {
    try {
      const interval = CronExpressionParser.parse(cronExpression, {
        tz: timezone,
        currentDate: new Date(),
      });
      return interval.next().toDate();
    } catch {
      return null;
    }
  }

  /**
   * Generate BullMQ job key for a schedule
   */
  private generateJobKey(scheduleId: string): string {
    return `schedule:${scheduleId}`;
  }

  /**
   * Create a new schedule
   */
  async createSchedule(userId: string, input: CreateScheduleInput): Promise<SafeSchedule> {
    // Validate cron expression
    const cronValidation = this.validateCronExpression(input.cronExpression);
    if (!cronValidation.valid) {
      throw new ScheduleError(
        `Invalid cron expression: ${cronValidation.error}`,
        'INVALID_CRON',
        400
      );
    }

    // Validate timezone
    const timezone = input.timezone ?? 'UTC';
    if (!this.validateTimezone(timezone)) {
      throw ScheduleErrors.INVALID_TIMEZONE;
    }

    // Verify recording exists and belongs to user
    const recording = await this.recordingRepository.findById(input.recordingId);
    if (!recording) {
      throw ScheduleErrors.RECORDING_NOT_FOUND;
    }
    if (recording.userId !== userId) {
      throw ScheduleErrors.NOT_AUTHORIZED;
    }

    // Check max schedules limit
    const scheduleCount = await this.scheduleRepository.countByUser(userId);
    if (scheduleCount >= this.maxSchedulesPerUser) {
      throw ScheduleErrors.MAX_SCHEDULES_REACHED;
    }

    // Create schedule in database
    const createData: ScheduleCreateData = {
      userId,
      recordingId: input.recordingId,
      name: input.name,
      description: input.description,
      cronExpression: input.cronExpression,
      timezone,
      runConfig: input.runConfig,
      startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
      endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
      notifyOnFailure: input.notifyOnFailure,
      notifyOnSuccess: input.notifyOnSuccess,
      notificationEmails: input.notificationEmails,
    };

    const schedule = await this.scheduleRepository.create(createData);

    // Calculate next run time
    const nextRunAt = this.calculateNextRunTime(input.cronExpression, timezone);

    // Create BullMQ repeatable job if queue manager is available
    if (this.jobQueueManager) {
      try {
        const jobKey = this.generateJobKey(schedule.id);
        const jobData: ScheduledTestJobData = {
          scheduleId: schedule.id,
          createdAt: new Date().toISOString(),
        };

        await this.jobQueueManager.addRepeatableJob(
          'scheduled-tests',
          'scheduled-run',
          jobData,
          input.cronExpression,
          {
            jobId: jobKey,
            timezone,
          }
        );

        // Update schedule with BullMQ info
        await this.scheduleRepository.update(schedule.id, {
          bullmqJobKey: jobKey,
          bullmqJobPattern: input.cronExpression,
          nextRunAt,
        });
      } catch (error) {
        // Log but don't fail - schedule is created, just not activated
        console.error('Failed to create BullMQ repeatable job:', error);
      }
    }

    // Return updated schedule
    const updatedSchedule = await this.scheduleRepository.findById(schedule.id);
    return updatedSchedule || schedule;
  }

  /**
   * Get schedule by ID
   */
  async getSchedule(userId: string, scheduleId: string): Promise<SafeSchedule> {
    const schedule = await this.scheduleRepository.findById(scheduleId);

    if (!schedule) {
      throw ScheduleErrors.NOT_FOUND;
    }

    if (schedule.userId !== userId) {
      throw ScheduleErrors.NOT_AUTHORIZED;
    }

    return schedule;
  }

  /**
   * List schedules for a user
   */
  async listSchedules(
    userId: string,
    filters?: Omit<ScheduleListFilters, 'userId'>,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<ScheduleSummary>> {
    return this.scheduleRepository.list({ ...filters, userId }, pagination);
  }

  /**
   * Update a schedule
   */
  async updateSchedule(
    userId: string,
    scheduleId: string,
    input: UpdateScheduleInput
  ): Promise<SafeSchedule> {
    const schedule = await this.scheduleRepository.findById(scheduleId);

    if (!schedule) {
      throw ScheduleErrors.NOT_FOUND;
    }

    if (schedule.userId !== userId) {
      throw ScheduleErrors.NOT_AUTHORIZED;
    }

    // Validate cron expression if provided
    let newCronExpression = schedule.cronExpression;
    if (input.cronExpression) {
      const cronValidation = this.validateCronExpression(input.cronExpression);
      if (!cronValidation.valid) {
        throw new ScheduleError(
          `Invalid cron expression: ${cronValidation.error}`,
          'INVALID_CRON',
          400
        );
      }
      newCronExpression = input.cronExpression;
    }

    // Validate timezone if provided
    const newTimezone = input.timezone ?? schedule.timezone;
    if (input.timezone && !this.validateTimezone(input.timezone)) {
      throw ScheduleErrors.INVALID_TIMEZONE;
    }

    // Build update data
    const updateData: ScheduleUpdateData = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description ?? undefined;
    if (input.cronExpression !== undefined) updateData.cronExpression = input.cronExpression;
    if (input.timezone !== undefined) updateData.timezone = input.timezone;
    if (input.runConfig !== undefined) updateData.runConfig = input.runConfig;
    if (input.startsAt !== undefined)
      updateData.startsAt = input.startsAt ? new Date(input.startsAt) : null;
    if (input.endsAt !== undefined)
      updateData.endsAt = input.endsAt ? new Date(input.endsAt) : null;
    if (input.notifyOnFailure !== undefined) updateData.notifyOnFailure = input.notifyOnFailure;
    if (input.notifyOnSuccess !== undefined) updateData.notifyOnSuccess = input.notifyOnSuccess;
    if (input.notificationEmails !== undefined)
      updateData.notificationEmails = input.notificationEmails ?? undefined;

    // If cron or timezone changed and schedule is active, update BullMQ job
    if (
      this.jobQueueManager &&
      schedule.status === 'active' &&
      (input.cronExpression || input.timezone)
    ) {
      try {
        // Remove old repeatable job
        if (schedule.bullmqJobPattern) {
          await this.jobQueueManager.removeRepeatableJob(
            'scheduled-tests',
            'scheduled-run',
            schedule.bullmqJobPattern
          );
        }

        // Create new repeatable job
        const jobKey = this.generateJobKey(scheduleId);
        const jobData: ScheduledTestJobData = {
          scheduleId: schedule.id,
          createdAt: new Date().toISOString(),
        };

        await this.jobQueueManager.addRepeatableJob(
          'scheduled-tests',
          'scheduled-run',
          jobData,
          newCronExpression,
          {
            jobId: jobKey,
            timezone: newTimezone,
          }
        );

        updateData.bullmqJobKey = jobKey;
        updateData.bullmqJobPattern = newCronExpression;
        updateData.nextRunAt = this.calculateNextRunTime(newCronExpression, newTimezone);
      } catch (error) {
        console.error('Failed to update BullMQ repeatable job:', error);
      }
    }

    const updated = await this.scheduleRepository.update(scheduleId, updateData);

    if (!updated) {
      throw ScheduleErrors.NOT_FOUND;
    }

    return updated;
  }

  /**
   * Toggle schedule status (active/paused)
   */
  async toggleSchedule(userId: string, scheduleId: string): Promise<SafeSchedule> {
    const schedule = await this.scheduleRepository.findById(scheduleId);

    if (!schedule) {
      throw ScheduleErrors.NOT_FOUND;
    }

    if (schedule.userId !== userId) {
      throw ScheduleErrors.NOT_AUTHORIZED;
    }

    // Only allow toggling between active and paused
    if (schedule.status !== 'active' && schedule.status !== 'paused') {
      throw ScheduleErrors.INVALID_STATUS_TRANSITION;
    }

    const newStatus = schedule.status === 'active' ? 'paused' : 'active';
    const updateData: ScheduleUpdateData = { status: newStatus };

    // Handle BullMQ job based on new status
    if (this.jobQueueManager) {
      try {
        if (newStatus === 'active') {
          // Create repeatable job
          const jobKey = this.generateJobKey(scheduleId);
          const jobData: ScheduledTestJobData = {
            scheduleId: schedule.id,
            createdAt: new Date().toISOString(),
          };

          await this.jobQueueManager.addRepeatableJob(
            'scheduled-tests',
            'scheduled-run',
            jobData,
            schedule.cronExpression,
            {
              jobId: jobKey,
              timezone: schedule.timezone,
            }
          );

          updateData.bullmqJobKey = jobKey;
          updateData.bullmqJobPattern = schedule.cronExpression;
          updateData.nextRunAt = this.calculateNextRunTime(
            schedule.cronExpression,
            schedule.timezone
          );
        } else {
          // Remove repeatable job
          if (schedule.bullmqJobPattern) {
            await this.jobQueueManager.removeRepeatableJob(
              'scheduled-tests',
              'scheduled-run',
              schedule.bullmqJobPattern
            );
          }
          updateData.bullmqJobKey = null;
          updateData.bullmqJobPattern = null;
          updateData.nextRunAt = null;
        }
      } catch (error) {
        console.error('Failed to toggle BullMQ repeatable job:', error);
      }
    }

    const updated = await this.scheduleRepository.update(scheduleId, updateData);

    if (!updated) {
      throw ScheduleErrors.NOT_FOUND;
    }

    return updated;
  }

  /**
   * Delete a schedule (soft delete)
   */
  async deleteSchedule(userId: string, scheduleId: string): Promise<void> {
    const schedule = await this.scheduleRepository.findById(scheduleId);

    if (!schedule) {
      throw ScheduleErrors.NOT_FOUND;
    }

    if (schedule.userId !== userId) {
      throw ScheduleErrors.NOT_AUTHORIZED;
    }

    // Remove BullMQ job if exists
    if (this.jobQueueManager && schedule.bullmqJobPattern) {
      try {
        await this.jobQueueManager.removeRepeatableJob(
          'scheduled-tests',
          'scheduled-run',
          schedule.bullmqJobPattern
        );
      } catch (error) {
        console.error('Failed to remove BullMQ repeatable job:', error);
      }
    }

    await this.scheduleRepository.softDelete(scheduleId);
  }

  /**
   * Restore a soft-deleted schedule
   */
  async restoreSchedule(userId: string, scheduleId: string): Promise<SafeSchedule> {
    const schedule = await this.scheduleRepository.findById(scheduleId, { includeDeleted: true });

    if (!schedule) {
      throw ScheduleErrors.NOT_FOUND;
    }

    if (schedule.userId !== userId) {
      throw ScheduleErrors.NOT_AUTHORIZED;
    }

    if (!schedule.deletedAt) {
      throw new ScheduleError('Schedule is not deleted', 'NOT_DELETED', 400);
    }

    const restored = await this.scheduleRepository.restore(scheduleId);

    if (!restored) {
      throw ScheduleErrors.NOT_FOUND;
    }

    return restored;
  }

  /**
   * Permanently delete a schedule
   */
  async permanentDeleteSchedule(userId: string, scheduleId: string): Promise<void> {
    const schedule = await this.scheduleRepository.findById(scheduleId, { includeDeleted: true });

    if (!schedule) {
      throw ScheduleErrors.NOT_FOUND;
    }

    if (schedule.userId !== userId) {
      throw ScheduleErrors.NOT_AUTHORIZED;
    }

    // Remove BullMQ job if exists
    if (this.jobQueueManager && schedule.bullmqJobPattern) {
      try {
        await this.jobQueueManager.removeRepeatableJob(
          'scheduled-tests',
          'scheduled-run',
          schedule.bullmqJobPattern
        );
      } catch (error) {
        console.error('Failed to remove BullMQ repeatable job:', error);
      }
    }

    await this.scheduleRepository.hardDelete(scheduleId);
  }

  /**
   * Sync all active schedules with BullMQ on startup
   * Called when API server starts to ensure schedules are active
   */
  async syncSchedulesOnStartup(): Promise<{ synced: number; failed: number }> {
    if (!this.jobQueueManager) {
      return { synced: 0, failed: 0 };
    }

    const activeSchedules = await this.scheduleRepository.getActiveSchedules();
    let synced = 0;
    let failed = 0;

    for (const schedule of activeSchedules) {
      try {
        const jobKey = this.generateJobKey(schedule.id);
        const jobData: ScheduledTestJobData = {
          scheduleId: schedule.id,
          createdAt: new Date().toISOString(),
        };

        await this.jobQueueManager.addRepeatableJob(
          'scheduled-tests',
          'scheduled-run',
          jobData,
          schedule.cronExpression,
          {
            jobId: jobKey,
            timezone: schedule.timezone,
          }
        );

        // Update next run time
        const nextRunAt = this.calculateNextRunTime(schedule.cronExpression, schedule.timezone);

        await this.scheduleRepository.update(schedule.id, {
          bullmqJobKey: jobKey,
          bullmqJobPattern: schedule.cronExpression,
          nextRunAt,
        });

        synced++;
      } catch (error) {
        console.error(`Failed to sync schedule ${schedule.id}:`, error);
        failed++;
      }
    }

    return { synced, failed };
  }

  /**
   * Update schedule after a run completes
   */
  async updateAfterRun(
    scheduleId: string,
    runId: string,
    status: 'passed' | 'failed'
  ): Promise<void> {
    const schedule = await this.scheduleRepository.findById(scheduleId);
    if (!schedule) return;

    // Update run tracking
    await this.scheduleRepository.update(scheduleId, {
      lastRunId: runId,
      lastRunAt: new Date(),
      lastRunStatus: status,
      nextRunAt: this.calculateNextRunTime(schedule.cronExpression, schedule.timezone),
    });

    // Increment counters
    await this.scheduleRepository.incrementRunCounters(
      scheduleId,
      status === 'passed' ? 'success' : 'failed'
    );
  }
}
