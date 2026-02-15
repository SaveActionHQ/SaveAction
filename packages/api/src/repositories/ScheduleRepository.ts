/**
 * Schedule Repository
 *
 * Data access layer for schedule CRUD operations.
 * Uses Drizzle ORM for type-safe queries.
 */

import { eq, and, isNull, sql, desc, asc, inArray } from 'drizzle-orm';
import {
  schedules,
  type Schedule,
  type NewSchedule,
  type ScheduleStatus,
} from '../db/schema/schedules.js';
import type { Database } from '../db/index.js';

/**
 * Schedule creation data
 */
export interface ScheduleCreateData {
  userId: string;
  projectId: string;
  recordingId: string;
  name: string;
  description?: string;
  cronExpression: string;
  timezone?: string;
  runConfig?: {
    browser?: 'chromium' | 'firefox' | 'webkit';
    headless?: boolean;
    timeout?: number;
    viewport?: { width: number; height: number };
    retries?: number;
    environment?: Record<string, string>;
    tags?: string[];
    recordVideo?: boolean;
    screenshotMode?: 'on-failure' | 'always' | 'never';
  };
  startsAt?: Date;
  endsAt?: Date;
  notifyOnFailure?: boolean;
  notifyOnSuccess?: boolean;
  notificationEmails?: string;
}

/**
 * Schedule update data
 */
export interface ScheduleUpdateData {
  name?: string;
  description?: string;
  cronExpression?: string;
  timezone?: string;
  status?: ScheduleStatus;
  runConfig?: {
    browser?: 'chromium' | 'firefox' | 'webkit';
    headless?: boolean;
    timeout?: number;
    viewport?: { width: number; height: number };
    retries?: number;
    environment?: Record<string, string>;
    tags?: string[];
    recordVideo?: boolean;
    screenshotMode?: 'on-failure' | 'always' | 'never';
  };
  startsAt?: Date | null;
  endsAt?: Date | null;
  bullmqJobKey?: string | null;
  bullmqJobPattern?: string | null;
  lastRunId?: string | null;
  lastRunAt?: Date | null;
  lastRunStatus?: string | null;
  nextRunAt?: Date | null;
  notifyOnFailure?: boolean;
  notifyOnSuccess?: boolean;
  notificationEmails?: string | null;
}

/**
 * Schedule list filters
 */
export interface ScheduleListFilters {
  userId: string;
  projectId?: string;
  recordingId?: string;
  status?: ScheduleStatus | ScheduleStatus[];
  includeDeleted?: boolean;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'name' | 'nextRunAt' | 'status';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

/**
 * Safe schedule response (with parsed fields)
 */
export interface SafeSchedule {
  id: string;
  userId: string;
  projectId: string;
  recordingId: string;
  name: string;
  description: string | null;
  cronExpression: string;
  timezone: string;
  status: ScheduleStatus;
  startsAt: Date | null;
  endsAt: Date | null;
  bullmqJobKey: string | null;
  bullmqJobPattern: string | null;
  runConfig: {
    browser?: 'chromium' | 'firefox' | 'webkit';
    headless?: boolean;
    timeout?: number;
    viewport?: { width: number; height: number };
    retries?: number;
    environment?: Record<string, string>;
    tags?: string[];
    recordVideo?: boolean;
    screenshotMode?: 'on-failure' | 'always' | 'never';
  } | null;
  maxConcurrent: number;
  maxDailyRuns: number | null;
  runsToday: number;
  runsThisMonth: number;
  lastRunId: string | null;
  lastRunAt: Date | null;
  lastRunStatus: string | null;
  nextRunAt: Date | null;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  notifyOnFailure: boolean;
  notifyOnSuccess: boolean;
  notificationEmails: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Schedule summary (for list view)
 */
export interface ScheduleSummary {
  id: string;
  userId: string;
  projectId: string;
  recordingId: string;
  name: string;
  cronExpression: string;
  timezone: string;
  status: ScheduleStatus;
  runConfig: {
    browser?: 'chromium' | 'firefox' | 'webkit';
    headless?: boolean;
    timeout?: number;
    viewport?: { width: number; height: number };
    retries?: number;
    environment?: Record<string, string>;
    tags?: string[];
    recordVideo?: boolean;
    screenshotMode?: 'on-failure' | 'always' | 'never';
  } | null;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  lastRunStatus: string | null;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  createdAt: Date;
}

/**
 * Convert database schedule to safe schedule
 */
function toSafeSchedule(schedule: Schedule): SafeSchedule {
  return {
    id: schedule.id,
    userId: schedule.userId,
    projectId: schedule.projectId,
    recordingId: schedule.recordingId,
    name: schedule.name,
    description: schedule.description,
    cronExpression: schedule.cronExpression,
    timezone: schedule.timezone,
    status: schedule.status,
    startsAt: schedule.startsAt,
    endsAt: schedule.endsAt,
    bullmqJobKey: schedule.bullmqJobKey,
    bullmqJobPattern: schedule.bullmqJobPattern,
    runConfig: schedule.runConfig as SafeSchedule['runConfig'],
    maxConcurrent: parseInt(schedule.maxConcurrent || '1', 10),
    maxDailyRuns: schedule.maxDailyRuns ? parseInt(schedule.maxDailyRuns, 10) : null,
    runsToday: parseInt(schedule.runsToday || '0', 10),
    runsThisMonth: parseInt(schedule.runsThisMonth || '0', 10),
    lastRunId: schedule.lastRunId,
    lastRunAt: schedule.lastRunAt,
    lastRunStatus: schedule.lastRunStatus,
    nextRunAt: schedule.nextRunAt,
    totalRuns: parseInt(schedule.totalRuns || '0', 10),
    successfulRuns: parseInt(schedule.successfulRuns || '0', 10),
    failedRuns: parseInt(schedule.failedRuns || '0', 10),
    notifyOnFailure: schedule.notifyOnFailure ?? true,
    notifyOnSuccess: schedule.notifyOnSuccess ?? false,
    notificationEmails: schedule.notificationEmails,
    deletedAt: schedule.deletedAt,
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
  };
}

/**
 * Convert database schedule to summary
 */
function toScheduleSummary(schedule: Schedule): ScheduleSummary {
  return {
    id: schedule.id,
    userId: schedule.userId,
    projectId: schedule.projectId,
    recordingId: schedule.recordingId,
    name: schedule.name,
    cronExpression: schedule.cronExpression,
    timezone: schedule.timezone,
    status: schedule.status,
    runConfig: schedule.runConfig as ScheduleSummary['runConfig'],
    nextRunAt: schedule.nextRunAt,
    lastRunAt: schedule.lastRunAt,
    lastRunStatus: schedule.lastRunStatus,
    totalRuns: parseInt(schedule.totalRuns || '0', 10),
    successfulRuns: parseInt(schedule.successfulRuns || '0', 10),
    failedRuns: parseInt(schedule.failedRuns || '0', 10),
    createdAt: schedule.createdAt,
  };
}

/**
 * Schedule Repository class
 */
export class ScheduleRepository {
  constructor(private readonly db: Database) {}

  /**
   * Create a new schedule
   */
  async create(data: ScheduleCreateData): Promise<SafeSchedule> {
    const newSchedule: NewSchedule = {
      userId: data.userId,
      projectId: data.projectId,
      recordingId: data.recordingId,
      name: data.name,
      description: data.description,
      cronExpression: data.cronExpression,
      timezone: data.timezone ?? 'UTC',
      runConfig: data.runConfig,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      notifyOnFailure: data.notifyOnFailure ?? true,
      notifyOnSuccess: data.notifyOnSuccess ?? false,
      notificationEmails: data.notificationEmails,
    };

    const [created] = await this.db.insert(schedules).values(newSchedule).returning();

    return toSafeSchedule(created);
  }

  /**
   * Find schedule by ID
   */
  async findById(id: string, options?: { includeDeleted?: boolean }): Promise<SafeSchedule | null> {
    const conditions = [eq(schedules.id, id)];

    if (!options?.includeDeleted) {
      conditions.push(isNull(schedules.deletedAt));
    }

    const [schedule] = await this.db
      .select()
      .from(schedules)
      .where(and(...conditions))
      .limit(1);

    return schedule ? toSafeSchedule(schedule) : null;
  }

  /**
   * Find schedule by BullMQ job key
   */
  async findByJobKey(jobKey: string): Promise<SafeSchedule | null> {
    const [schedule] = await this.db
      .select()
      .from(schedules)
      .where(and(eq(schedules.bullmqJobKey, jobKey), isNull(schedules.deletedAt)))
      .limit(1);

    return schedule ? toSafeSchedule(schedule) : null;
  }

  /**
   * List schedules with filters and pagination
   */
  async list(
    filters: ScheduleListFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<ScheduleSummary>> {
    const page = pagination?.page ?? 1;
    const limit = Math.min(pagination?.limit ?? 20, 100);
    const offset = (page - 1) * limit;
    const sortBy = pagination?.sortBy ?? 'createdAt';
    const sortOrder = pagination?.sortOrder ?? 'desc';

    // Build conditions
    const conditions = [eq(schedules.userId, filters.userId)];

    if (!filters.includeDeleted) {
      conditions.push(isNull(schedules.deletedAt));
    }

    if (filters.recordingId) {
      conditions.push(eq(schedules.recordingId, filters.recordingId));
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        conditions.push(inArray(schedules.status, filters.status));
      } else {
        conditions.push(eq(schedules.status, filters.status));
      }
    }

    // Get total count
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schedules)
      .where(and(...conditions));

    // Build sort
    const sortColumn =
      sortBy === 'name'
        ? schedules.name
        : sortBy === 'nextRunAt'
          ? schedules.nextRunAt
          : sortBy === 'status'
            ? schedules.status
            : schedules.createdAt;

    const orderFn = sortOrder === 'asc' ? asc : desc;

    // Get paginated results
    const results = await this.db
      .select()
      .from(schedules)
      .where(and(...conditions))
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset);

    const totalPages = Math.ceil(count / limit);

    return {
      data: results.map(toScheduleSummary),
      pagination: {
        page,
        limit,
        total: count,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  /**
   * Update a schedule
   */
  async update(id: string, data: ScheduleUpdateData): Promise<SafeSchedule | null> {
    const updateData: Partial<NewSchedule> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.cronExpression !== undefined) updateData.cronExpression = data.cronExpression;
    if (data.timezone !== undefined) updateData.timezone = data.timezone;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.runConfig !== undefined) updateData.runConfig = data.runConfig;
    if (data.startsAt !== undefined) updateData.startsAt = data.startsAt ?? undefined;
    if (data.endsAt !== undefined) updateData.endsAt = data.endsAt ?? undefined;
    if (data.bullmqJobKey !== undefined) updateData.bullmqJobKey = data.bullmqJobKey ?? undefined;
    if (data.bullmqJobPattern !== undefined)
      updateData.bullmqJobPattern = data.bullmqJobPattern ?? undefined;
    if (data.lastRunId !== undefined) updateData.lastRunId = data.lastRunId ?? undefined;
    if (data.lastRunAt !== undefined) updateData.lastRunAt = data.lastRunAt ?? undefined;
    if (data.lastRunStatus !== undefined)
      updateData.lastRunStatus = data.lastRunStatus ?? undefined;
    if (data.nextRunAt !== undefined) updateData.nextRunAt = data.nextRunAt ?? undefined;
    if (data.notifyOnFailure !== undefined) updateData.notifyOnFailure = data.notifyOnFailure;
    if (data.notifyOnSuccess !== undefined) updateData.notifyOnSuccess = data.notifyOnSuccess;
    if (data.notificationEmails !== undefined)
      updateData.notificationEmails = data.notificationEmails ?? undefined;

    const [updated] = await this.db
      .update(schedules)
      .set(updateData)
      .where(and(eq(schedules.id, id), isNull(schedules.deletedAt)))
      .returning();

    return updated ? toSafeSchedule(updated) : null;
  }

  /**
   * Increment run counters
   */
  async incrementRunCounters(id: string, status: 'success' | 'failed'): Promise<void> {
    const incrementField = status === 'success' ? 'successfulRuns' : 'failedRuns';

    await this.db
      .update(schedules)
      .set({
        totalRuns: sql`(${schedules.totalRuns}::int + 1)::text`,
        [incrementField]: sql`(${schedules[incrementField]}::int + 1)::text`,
        runsToday: sql`(${schedules.runsToday}::int + 1)::text`,
        runsThisMonth: sql`(${schedules.runsThisMonth}::int + 1)::text`,
      })
      .where(eq(schedules.id, id));
  }

  /**
   * Reset daily run counters (called by cleanup job at midnight)
   */
  async resetDailyCounters(): Promise<number> {
    const result = await this.db
      .update(schedules)
      .set({ runsToday: '0' })
      .where(isNull(schedules.deletedAt));

    return result.rowCount ?? 0;
  }

  /**
   * Reset monthly run counters (called by cleanup job at month start)
   */
  async resetMonthlyCounters(): Promise<number> {
    const result = await this.db
      .update(schedules)
      .set({ runsThisMonth: '0' })
      .where(isNull(schedules.deletedAt));

    return result.rowCount ?? 0;
  }

  /**
   * Soft delete a schedule
   */
  async softDelete(id: string): Promise<boolean> {
    const [deleted] = await this.db
      .update(schedules)
      .set({ deletedAt: new Date(), status: 'disabled' })
      .where(and(eq(schedules.id, id), isNull(schedules.deletedAt)))
      .returning();

    return !!deleted;
  }

  /**
   * Restore a soft-deleted schedule
   */
  async restore(id: string): Promise<SafeSchedule | null> {
    const [restored] = await this.db
      .update(schedules)
      .set({ deletedAt: null, status: 'paused' })
      .where(eq(schedules.id, id))
      .returning();

    return restored ? toSafeSchedule(restored) : null;
  }

  /**
   * Permanently delete a schedule
   */
  async hardDelete(id: string): Promise<boolean> {
    const result = await this.db.delete(schedules).where(eq(schedules.id, id));

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get all active schedules (for startup sync)
   */
  async getActiveSchedules(): Promise<SafeSchedule[]> {
    const results = await this.db
      .select()
      .from(schedules)
      .where(and(eq(schedules.status, 'active'), isNull(schedules.deletedAt)));

    return results.map(toSafeSchedule);
  }

  /**
   * Get schedules due for execution
   */
  async getDueSchedules(beforeTime: Date): Promise<SafeSchedule[]> {
    const results = await this.db
      .select()
      .from(schedules)
      .where(
        and(
          eq(schedules.status, 'active'),
          isNull(schedules.deletedAt),
          sql`${schedules.nextRunAt} <= ${beforeTime}`
        )
      );

    return results.map(toSafeSchedule);
  }

  /**
   * Count schedules for a user
   */
  async countByUser(userId: string): Promise<number> {
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schedules)
      .where(and(eq(schedules.userId, userId), isNull(schedules.deletedAt)));

    return count;
  }

  /**
   * Count schedules for a recording
   */
  async countByRecording(recordingId: string): Promise<number> {
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schedules)
      .where(and(eq(schedules.recordingId, recordingId), isNull(schedules.deletedAt)));

    return count;
  }
}
