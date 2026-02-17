/**
 * Run Repository
 *
 * Data access layer for run CRUD operations.
 * Uses Drizzle ORM for type-safe queries.
 */

import { eq, and, isNull, sql, desc, asc, gte, lte, inArray } from 'drizzle-orm';
import {
  runs,
  type Run,
  type NewRun,
  type RunStatus,
  type BrowserType,
} from '../db/schema/runs.js';
import { runActions, type RunAction, type ActionStatus } from '../db/schema/run-actions.js';
import { schedules } from '../db/schema/schedules.js';
import type { Database } from '../db/index.js';

/**
 * Run creation data
 */
export interface RunCreateData {
  userId: string;
  projectId: string;
  recordingId?: string | null;
  recordingName?: string | null;
  recordingUrl?: string | null;
  /** Run type: recording (legacy), test, or suite */
  runType?: 'recording' | 'test' | 'suite' | 'project';
  /** Test ID for test-based runs */
  testId?: string | null;
  /** Suite ID for suite-level runs */
  suiteId?: string | null;
  /** Parent run ID (for child runs of a suite run) */
  parentRunId?: string | null;
  /** Test snapshot fields */
  testName?: string | null;
  testSlug?: string | null;
  browser?: BrowserType;
  headless?: boolean;
  videoEnabled?: boolean;
  screenshotEnabled?: boolean;
  timeout?: number;
  timingEnabled?: boolean;
  timingMode?: string;
  speedMultiplier?: number;
  triggeredBy?: string;
  scheduleId?: string;
  ciMetadata?: Record<string, unknown>;
}

/**
 * Run update data (status, results, etc.)
 */
export interface RunUpdateData {
  status?: RunStatus;
  jobId?: string;
  queueName?: string;
  actionsTotal?: number;
  actionsExecuted?: number;
  actionsFailed?: number;
  actionsSkipped?: number;
  durationMs?: number;
  startedAt?: Date;
  completedAt?: Date;
  videoPath?: string;
  screenshotPaths?: string[];
  errorMessage?: string;
  errorStack?: string;
  errorActionId?: string;
}

/**
 * Run list filters
 */
export interface RunListFilters {
  userId: string;
  projectId?: string;
  testId?: string;
  suiteId?: string;
  parentRunId?: string;
  runType?: string;
  recordingId?: string;
  scheduleId?: string;
  status?: RunStatus | RunStatus[];
  triggeredBy?: string;
  includeDeleted?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'startedAt' | 'completedAt' | 'status';
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
 * Safe run response (parsed fields)
 */
export interface SafeRun {
  id: string;
  userId: string;
  projectId: string;
  recordingId: string | null;
  recordingName: string | null;
  recordingUrl: string | null;
  runType: string | null;
  testId: string | null;
  suiteId: string | null;
  parentRunId: string | null;
  testName: string | null;
  testSlug: string | null;
  status: RunStatus;
  jobId: string | null;
  queueName: string | null;
  browser: BrowserType;
  headless: boolean;
  videoEnabled: boolean;
  screenshotEnabled: boolean;
  timeout: number;
  timingEnabled: boolean;
  timingMode: string | null;
  speedMultiplier: number | null;
  actionsTotal: number | null;
  actionsExecuted: number | null;
  actionsFailed: number | null;
  actionsSkipped: number | null;
  durationMs: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  videoPath: string | null;
  screenshotPaths: string[];
  errorMessage: string | null;
  errorStack: string | null;
  errorActionId: string | null;
  triggeredBy: string;
  scheduleId: string | null;
  scheduleName: string | null;
  ciMetadata: Record<string, unknown> | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Run summary (for list view - without large fields)
 */
export interface RunSummary {
  id: string;
  userId: string;
  projectId: string;
  recordingId: string | null;
  recordingName: string | null;
  recordingUrl: string | null;
  runType: string | null;
  testId: string | null;
  suiteId: string | null;
  parentRunId: string | null;
  testName: string | null;
  testSlug: string | null;
  status: RunStatus;
  browser: BrowserType;
  actionsTotal: number | null;
  actionsExecuted: number | null;
  actionsFailed: number | null;
  durationMs: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  triggeredBy: string;
  scheduleId: string | null;
  scheduleName: string | null;
  createdAt: Date;
}

/**
 * Safe run action response
 */
export interface SafeRunAction {
  id: string;
  runId: string;
  actionId: string;
  actionType: string;
  actionIndex: number;
  browser: string | null;
  status: ActionStatus;
  durationMs: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  selectorUsed: string | null;
  selectorValue: string | null;
  retryCount: number;
  retriedSelectors: string[];
  errorMessage: string | null;
  errorStack: string | null;
  screenshotPath: string | null;
  screenshotBefore: string | null;
  screenshotAfter: string | null;
  elementFound: boolean;
  elementVisible: boolean | null;
  elementTagName: string | null;
  pageUrl: string | null;
  pageTitle: string | null;
  createdAt: Date;
}

/**
 * Run action creation data
 */
export interface RunActionCreateData {
  runId: string;
  actionId: string;
  actionType: string;
  actionIndex: number;
  browser?: string;
  status: ActionStatus;
  durationMs?: number;
  startedAt?: Date;
  completedAt?: Date;
  selectorUsed?: string;
  selectorValue?: string;
  retryCount?: number;
  retriedSelectors?: string[];
  errorMessage?: string;
  errorStack?: string;
  screenshotPath?: string;
  screenshotBefore?: string;
  screenshotAfter?: string;
  elementFound?: boolean;
  elementVisible?: boolean;
  elementTagName?: string;
  pageUrl?: string;
  pageTitle?: string;
}

/**
 * Convert raw DB result to SafeRun
 */
function toSafeRun(run: Run, scheduleName?: string | null): SafeRun {
  return {
    id: run.id,
    userId: run.userId,
    projectId: run.projectId,
    recordingId: run.recordingId,
    recordingName: run.recordingName,
    recordingUrl: run.recordingUrl,
    runType: run.runType,
    testId: run.testId,
    suiteId: run.suiteId,
    parentRunId: run.parentRunId ?? null,
    testName: run.testName,
    testSlug: run.testSlug,
    status: run.status,
    jobId: run.jobId,
    queueName: run.queueName,
    browser: run.browser,
    headless: run.headless,
    videoEnabled: run.videoEnabled,
    screenshotEnabled: run.screenshotEnabled,
    timeout: parseInt(run.timeout, 10),
    timingEnabled: run.timingEnabled,
    timingMode: run.timingMode,
    speedMultiplier: run.speedMultiplier ? parseFloat(run.speedMultiplier) : null,
    actionsTotal: run.actionsTotal ? parseInt(run.actionsTotal, 10) : null,
    actionsExecuted: run.actionsExecuted ? parseInt(run.actionsExecuted, 10) : null,
    actionsFailed: run.actionsFailed ? parseInt(run.actionsFailed, 10) : null,
    actionsSkipped: run.actionsSkipped ? parseInt(run.actionsSkipped, 10) : null,
    durationMs: run.durationMs ? parseInt(run.durationMs, 10) : null,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    videoPath: run.videoPath,
    screenshotPaths: run.screenshotPaths ? JSON.parse(run.screenshotPaths) : [],
    errorMessage: run.errorMessage,
    errorStack: run.errorStack,
    errorActionId: run.errorActionId,
    triggeredBy: run.triggeredBy,
    scheduleId: run.scheduleId,
    scheduleName: scheduleName ?? null,
    ciMetadata: run.ciMetadata ? JSON.parse(run.ciMetadata) : null,
    deletedAt: run.deletedAt,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  };
}

/**
 * Convert raw DB result to RunSummary
 */
function toRunSummary(run: Partial<Run> & { scheduleName?: string | null }): RunSummary {
  return {
    id: run.id!,
    userId: run.userId!,
    projectId: run.projectId!,
    recordingId: run.recordingId ?? null,
    recordingName: run.recordingName ?? null,
    recordingUrl: run.recordingUrl ?? null,
    runType: run.runType ?? null,
    testId: run.testId ?? null,
    suiteId: run.suiteId ?? null,
    parentRunId: run.parentRunId ?? null,
    testName: run.testName ?? null,
    testSlug: run.testSlug ?? null,
    status: run.status!,
    browser: run.browser!,
    actionsTotal: run.actionsTotal ? parseInt(run.actionsTotal, 10) : null,
    actionsExecuted: run.actionsExecuted ? parseInt(run.actionsExecuted, 10) : null,
    actionsFailed: run.actionsFailed ? parseInt(run.actionsFailed, 10) : null,
    durationMs: run.durationMs ? parseInt(run.durationMs, 10) : null,
    startedAt: run.startedAt ?? null,
    completedAt: run.completedAt ?? null,
    triggeredBy: run.triggeredBy!,
    scheduleId: run.scheduleId ?? null,
    scheduleName: run.scheduleName ?? null,
    createdAt: run.createdAt!,
  };
}

/**
 * Convert raw DB result to SafeRunAction
 */
function toSafeRunAction(action: RunAction): SafeRunAction {
  return {
    id: action.id,
    runId: action.runId,
    actionId: action.actionId,
    actionType: action.actionType,
    actionIndex: parseInt(action.actionIndex, 10),
    browser: action.browser ?? null,
    status: action.status,
    durationMs: action.durationMs ? parseInt(action.durationMs, 10) : null,
    startedAt: action.startedAt,
    completedAt: action.completedAt,
    selectorUsed: action.selectorUsed,
    selectorValue: action.selectorValue,
    retryCount: action.retryCount ? parseInt(action.retryCount, 10) : 0,
    retriedSelectors: action.retriedSelectors ? JSON.parse(action.retriedSelectors) : [],
    errorMessage: action.errorMessage,
    errorStack: action.errorStack,
    screenshotPath: action.screenshotPath,
    screenshotBefore: action.screenshotBefore,
    screenshotAfter: action.screenshotAfter,
    elementFound: action.elementFound !== 'false',
    elementVisible: action.elementVisible === null ? null : action.elementVisible !== 'false',
    elementTagName: action.elementTagName,
    pageUrl: action.pageUrl,
    pageTitle: action.pageTitle,
    createdAt: action.createdAt,
  };
}

/**
 * Run Repository class
 */
export class RunRepository {
  constructor(private readonly db: Database) {}

  // ========================================
  // RUN CRUD OPERATIONS
  // ========================================

  /**
   * Create a new run
   */
  async create(data: RunCreateData): Promise<SafeRun> {
    const result = await this.db
      .insert(runs)
      .values({
        userId: data.userId,
        projectId: data.projectId,
        recordingId: data.recordingId ?? null,
        recordingName: data.recordingName ?? null,
        recordingUrl: data.recordingUrl ?? null,
        runType: data.runType ?? 'recording',
        testId: data.testId ?? null,
        suiteId: data.suiteId ?? null,
        parentRunId: data.parentRunId ?? null,
        testName: data.testName ?? null,
        testSlug: data.testSlug ?? null,
        status: 'queued',
        browser: data.browser ?? 'chromium',
        headless: data.headless ?? true,
        videoEnabled: data.videoEnabled ?? false,
        screenshotEnabled: data.screenshotEnabled ?? false,
        timeout: String(data.timeout ?? 30000),
        timingEnabled: data.timingEnabled ?? true,
        timingMode: data.timingMode ?? 'realistic',
        speedMultiplier: data.speedMultiplier ? String(data.speedMultiplier) : '1.0',
        triggeredBy: data.triggeredBy ?? 'manual',
        scheduleId: data.scheduleId,
        ciMetadata: data.ciMetadata ? JSON.stringify(data.ciMetadata) : null,
      })
      .returning();

    return toSafeRun(result[0]);
  }

  /**
   * Find a run by ID
   */
  async findById(id: string, includeDeleted = false): Promise<SafeRun | null> {
    const conditions = includeDeleted
      ? eq(runs.id, id)
      : and(eq(runs.id, id), isNull(runs.deletedAt));

    const result = await this.db
      .select({
        run: runs,
        scheduleName: schedules.name,
      })
      .from(runs)
      .leftJoin(schedules, eq(runs.scheduleId, schedules.id))
      .where(conditions)
      .limit(1);

    return result[0] ? toSafeRun(result[0].run, result[0].scheduleName) : null;
  }

  /**
   * Find a run by job ID
   */
  async findByJobId(jobId: string): Promise<SafeRun | null> {
    const result = await this.db
      .select()
      .from(runs)
      .where(and(eq(runs.jobId, jobId), isNull(runs.deletedAt)))
      .limit(1);

    return result[0] ? toSafeRun(result[0]) : null;
  }

  /**
   * List runs with filters and pagination
   */
  async findMany(
    filters: RunListFilters,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<RunSummary>> {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [eq(runs.userId, filters.userId)];

    if (!filters.includeDeleted) {
      conditions.push(isNull(runs.deletedAt));
    }

    if (filters.projectId) {
      conditions.push(eq(runs.projectId, filters.projectId));
    }

    if (filters.testId) {
      conditions.push(eq(runs.testId, filters.testId));
    }

    if (filters.suiteId) {
      conditions.push(eq(runs.suiteId, filters.suiteId));
    }

    if (filters.parentRunId) {
      conditions.push(eq(runs.parentRunId, filters.parentRunId));
    }

    if (filters.runType) {
      conditions.push(eq(runs.runType, filters.runType as any));
    }

    if (filters.recordingId) {
      conditions.push(eq(runs.recordingId, filters.recordingId));
    }

    if (filters.scheduleId) {
      conditions.push(eq(runs.scheduleId, filters.scheduleId));
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        conditions.push(inArray(runs.status, filters.status));
      } else {
        conditions.push(eq(runs.status, filters.status));
      }
    }

    if (filters.triggeredBy) {
      conditions.push(eq(runs.triggeredBy, filters.triggeredBy));
    }

    if (filters.createdAfter) {
      conditions.push(gte(runs.createdAt, filters.createdAfter));
    }

    if (filters.createdBefore) {
      conditions.push(lte(runs.createdAt, filters.createdBefore));
    }

    const whereClause = and(...conditions);

    // Get sort column
    const sortColumn = {
      createdAt: runs.createdAt,
      startedAt: runs.startedAt,
      completedAt: runs.completedAt,
      status: runs.status,
    }[sortBy];

    const orderFn = sortOrder === 'asc' ? asc : desc;

    // Get total count
    const countResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(runs)
      .where(whereClause);

    const total = countResult[0]?.count || 0;

    // Get paginated results with schedule name join
    const result = await this.db
      .select({
        id: runs.id,
        userId: runs.userId,
        projectId: runs.projectId,
        runType: runs.runType,
        testId: runs.testId,
        suiteId: runs.suiteId,
        parentRunId: runs.parentRunId,
        testName: runs.testName,
        testSlug: runs.testSlug,
        recordingId: runs.recordingId,
        recordingName: runs.recordingName,
        recordingUrl: runs.recordingUrl,
        status: runs.status,
        browser: runs.browser,
        actionsTotal: runs.actionsTotal,
        actionsExecuted: runs.actionsExecuted,
        actionsFailed: runs.actionsFailed,
        durationMs: runs.durationMs,
        startedAt: runs.startedAt,
        completedAt: runs.completedAt,
        triggeredBy: runs.triggeredBy,
        scheduleId: runs.scheduleId,
        scheduleName: schedules.name,
        createdAt: runs.createdAt,
      })
      .from(runs)
      .leftJoin(schedules, eq(runs.scheduleId, schedules.id))
      .where(whereClause)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset);

    const totalPages = Math.ceil(total / limit);

    return {
      data: result.map(toRunSummary),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  /**
   * Update a run
   */
  async update(id: string, data: RunUpdateData): Promise<SafeRun | null> {
    const updateValues: Partial<NewRun> = {};

    if (data.status !== undefined) updateValues.status = data.status;
    if (data.jobId !== undefined) updateValues.jobId = data.jobId;
    if (data.queueName !== undefined) updateValues.queueName = data.queueName;
    if (data.actionsTotal !== undefined) updateValues.actionsTotal = String(data.actionsTotal);
    if (data.actionsExecuted !== undefined)
      updateValues.actionsExecuted = String(data.actionsExecuted);
    if (data.actionsFailed !== undefined) updateValues.actionsFailed = String(data.actionsFailed);
    if (data.actionsSkipped !== undefined)
      updateValues.actionsSkipped = String(data.actionsSkipped);
    if (data.durationMs !== undefined) updateValues.durationMs = String(data.durationMs);
    if (data.startedAt !== undefined) updateValues.startedAt = data.startedAt;
    if (data.completedAt !== undefined) updateValues.completedAt = data.completedAt;
    if (data.videoPath !== undefined) updateValues.videoPath = data.videoPath;
    if (data.screenshotPaths !== undefined)
      updateValues.screenshotPaths = JSON.stringify(data.screenshotPaths);
    if (data.errorMessage !== undefined) updateValues.errorMessage = data.errorMessage;
    if (data.errorStack !== undefined) updateValues.errorStack = data.errorStack;
    if (data.errorActionId !== undefined) updateValues.errorActionId = data.errorActionId;

    const result = await this.db
      .update(runs)
      .set(updateValues)
      .where(and(eq(runs.id, id), isNull(runs.deletedAt)))
      .returning();

    return result[0] ? toSafeRun(result[0]) : null;
  }

  /**
   * Soft delete a run
   */
  async softDelete(id: string): Promise<boolean> {
    const result = await this.db
      .update(runs)
      .set({ deletedAt: new Date() })
      .where(and(eq(runs.id, id), isNull(runs.deletedAt)))
      .returning({ id: runs.id });

    return result.length > 0;
  }

  /**
   * Restore a soft-deleted run
   */
  async restore(id: string): Promise<SafeRun | null> {
    const result = await this.db
      .update(runs)
      .set({ deletedAt: null })
      .where(eq(runs.id, id))
      .returning();

    return result[0] ? toSafeRun(result[0]) : null;
  }

  /**
   * Hard delete a run (permanent)
   */
  async hardDelete(id: string): Promise<boolean> {
    const result = await this.db.delete(runs).where(eq(runs.id, id)).returning({ id: runs.id });

    return result.length > 0;
  }

  /**
   * Check if user owns a run
   */
  async isOwner(runId: string, userId: string): Promise<boolean> {
    const result = await this.db
      .select({ id: runs.id })
      .from(runs)
      .where(and(eq(runs.id, runId), eq(runs.userId, userId)))
      .limit(1);

    return result.length > 0;
  }

  /**
   * Get runs with 'running' status (for cleanup on restart)
   */
  async findOrphanedRuns(olderThanMs: number): Promise<SafeRun[]> {
    const cutoffTime = new Date(Date.now() - olderThanMs);

    const result = await this.db
      .select()
      .from(runs)
      .where(
        and(eq(runs.status, 'running'), lte(runs.startedAt, cutoffTime), isNull(runs.deletedAt))
      );

    return result.map((run) => toSafeRun(run));
  }

  /**
   * Count runs by user
   */
  async countByUserId(userId: string, includeDeleted = false): Promise<number> {
    const conditions = includeDeleted
      ? eq(runs.userId, userId)
      : and(eq(runs.userId, userId), isNull(runs.deletedAt));

    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(runs)
      .where(conditions);

    return result[0]?.count || 0;
  }

  /**
   * Get recent runs for a recording
   */
  async findRecentByRecordingId(recordingId: string, limit = 10): Promise<RunSummary[]> {
    const result = await this.db
      .select({
        id: runs.id,
        userId: runs.userId,
        recordingId: runs.recordingId,
        recordingName: runs.recordingName,
        recordingUrl: runs.recordingUrl,
        status: runs.status,
        browser: runs.browser,
        actionsTotal: runs.actionsTotal,
        actionsExecuted: runs.actionsExecuted,
        actionsFailed: runs.actionsFailed,
        durationMs: runs.durationMs,
        startedAt: runs.startedAt,
        completedAt: runs.completedAt,
        triggeredBy: runs.triggeredBy,
        createdAt: runs.createdAt,
      })
      .from(runs)
      .where(and(eq(runs.recordingId, recordingId), isNull(runs.deletedAt)))
      .orderBy(desc(runs.createdAt))
      .limit(limit);

    return result.map(toRunSummary);
  }

  // ========================================
  // RUN ACTION OPERATIONS
  // ========================================

  /**
   * Create multiple run actions (bulk insert)
   */
  async createActions(actions: RunActionCreateData[]): Promise<SafeRunAction[]> {
    if (actions.length === 0) return [];

    const values = actions.map((action) => ({
      runId: action.runId,
      actionId: action.actionId,
      actionType: action.actionType,
      actionIndex: String(action.actionIndex),
      browser: action.browser ?? null,
      status: action.status,
      durationMs: action.durationMs !== undefined ? String(action.durationMs) : null,
      startedAt: action.startedAt,
      completedAt: action.completedAt,
      selectorUsed: action.selectorUsed,
      selectorValue: action.selectorValue,
      retryCount: action.retryCount !== undefined ? String(action.retryCount) : '0',
      retriedSelectors: action.retriedSelectors ? JSON.stringify(action.retriedSelectors) : null,
      errorMessage: action.errorMessage,
      errorStack: action.errorStack,
      screenshotPath: action.screenshotPath,
      screenshotBefore: action.screenshotBefore,
      screenshotAfter: action.screenshotAfter,
      elementFound: action.elementFound !== false ? 'true' : 'false',
      elementVisible:
        action.elementVisible === undefined ? null : action.elementVisible ? 'true' : 'false',
      elementTagName: action.elementTagName,
      pageUrl: action.pageUrl,
      pageTitle: action.pageTitle,
    }));

    const result = await this.db.insert(runActions).values(values).returning();

    return result.map(toSafeRunAction);
  }

  /**
   * Create a single run action
   */
  async createAction(action: RunActionCreateData): Promise<SafeRunAction> {
    const result = await this.createActions([action]);
    return result[0];
  }

  /**
   * Get all actions for a run, optionally filtered by browser.
   * Falls back to unfiltered results if browser filter returns nothing (old runs without browser data).
   */
  async findActionsByRunId(runId: string, browser?: string): Promise<SafeRunAction[]> {
    if (browser) {
      const conditions = [
        eq(runActions.runId, runId),
        eq(runActions.browser, browser),
      ];
      const result = await this.db
        .select()
        .from(runActions)
        .where(and(...conditions))
        .orderBy(asc(runActions.actionIndex));

      // Fallback: old runs may not have browser column populated
      if (result.length > 0) {
        return result.map(toSafeRunAction);
      }
    }

    const result = await this.db
      .select()
      .from(runActions)
      .where(eq(runActions.runId, runId))
      .orderBy(asc(runActions.actionIndex));

    return result.map(toSafeRunAction);
  }

  /**
   * Get a specific action by run ID and action ID, optionally filtered by browser.
   * Falls back to unfiltered lookup if browser filter returns nothing (old runs without browser data).
   */
  async findActionByRunIdAndActionId(
    runId: string,
    actionId: string,
    browser?: string
  ): Promise<SafeRunAction | null> {
    if (browser) {
      const [filtered] = await this.db
        .select()
        .from(runActions)
        .where(
          and(
            eq(runActions.runId, runId),
            eq(runActions.actionId, actionId),
            eq(runActions.browser, browser)
          )
        );
      if (filtered) {
        return toSafeRunAction(filtered);
      }
      // Fallback: old runs may not have browser column populated
    }

    const [result] = await this.db
      .select()
      .from(runActions)
      .where(
        and(
          eq(runActions.runId, runId),
          eq(runActions.actionId, actionId)
        )
      );

    return result ? toSafeRunAction(result) : null;
  }

  /**
   * Get failed actions for a run
   */
  async findFailedActionsByRunId(runId: string): Promise<SafeRunAction[]> {
    const result = await this.db
      .select()
      .from(runActions)
      .where(and(eq(runActions.runId, runId), eq(runActions.status, 'failed')))
      .orderBy(asc(runActions.actionIndex));

    return result.map(toSafeRunAction);
  }

  /**
   * Delete all actions for a run
   */
  async deleteActionsByRunId(runId: string): Promise<number> {
    const result = await this.db
      .delete(runActions)
      .where(eq(runActions.runId, runId))
      .returning({ id: runActions.id });

    return result.length;
  }

  /**
   * Find all child run statuses for a parent run.
   * Used to determine when a suite run is complete.
   */
  async findChildrenStatuses(parentRunId: string): Promise<Array<{ id: string; status: RunStatus; durationMs: string | null; actionsTotal: string | null; actionsExecuted: string | null; actionsFailed: string | null; actionsSkipped: string | null; errorMessage: string | null }>> {
    const result = await this.db
      .select({
        id: runs.id,
        status: runs.status,
        durationMs: runs.durationMs,
        actionsTotal: runs.actionsTotal,
        actionsExecuted: runs.actionsExecuted,
        actionsFailed: runs.actionsFailed,
        actionsSkipped: runs.actionsSkipped,
        errorMessage: runs.errorMessage,
      })
      .from(runs)
      .where(
        and(
          eq(runs.parentRunId, parentRunId),
          isNull(runs.deletedAt),
        )
      );

    return result;
  }

  /**
   * Update screenshot path for a specific action.
   * Used after run execution when screenshots become available.
   */
  async updateActionScreenshot(
    runId: string,
    actionId: string,
    screenshotPath: string,
  ): Promise<void> {
    await this.db
      .update(runActions)
      .set({ screenshotPath })
      .where(
        and(
          eq(runActions.runId, runId),
          eq(runActions.actionId, actionId),
        )
      );
  }
}
