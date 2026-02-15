/**
 * Runner Service
 *
 * Business logic for test run execution.
 * Integrates @saveaction/core PlaywrightRunner with API infrastructure.
 */

import { z } from 'zod';
import type {
  RunRepository,
  RunCreateData,
  RunUpdateData,
  RunListFilters,
  SafeRun,
  RunSummary,
  SafeRunAction,
  PaginationOptions,
  PaginatedResult,
} from '../repositories/RunRepository.js';
import type { RecordingRepository } from '../repositories/RecordingRepository.js';
import type { JobQueueManager } from '../queues/JobQueueManager.js';
import type { TestRunJobData } from '../queues/types.js';
import type { BrowserType, RunStatus } from '../db/schema/runs.js';
import type { ActionStatus } from '../db/schema/run-actions.js';

/**
 * Run Service Error
 */
export class RunError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'RunError';
  }
}

/**
 * Predefined Run errors
 */
export const RunErrors = {
  NOT_FOUND: new RunError('Run not found', 'RUN_NOT_FOUND', 404),
  RECORDING_NOT_FOUND: new RunError('Recording not found', 'RECORDING_NOT_FOUND', 404),
  NOT_AUTHORIZED: new RunError('Not authorized to access this run', 'NOT_AUTHORIZED', 403),
  ALREADY_RUNNING: new RunError('Run is already in progress', 'ALREADY_RUNNING', 409),
  CANNOT_CANCEL: new RunError('Run cannot be cancelled in current state', 'CANNOT_CANCEL', 400),
  ALREADY_COMPLETED: new RunError('Run has already completed', 'ALREADY_COMPLETED', 400),
  ALREADY_DELETED: new RunError('Run is already deleted', 'ALREADY_DELETED', 400),
  QUEUE_ERROR: new RunError('Failed to queue run', 'QUEUE_ERROR', 500),
  EXECUTION_ERROR: new RunError('Run execution failed', 'EXECUTION_ERROR', 500),
} as const;

/**
 * Create run request schema
 */
export const createRunSchema = z.object({
  recordingId: z.string().uuid(),
  browser: z.enum(['chromium', 'firefox', 'webkit']).optional().default('chromium'),
  headless: z.boolean().optional().default(true),
  videoEnabled: z.boolean().optional().default(false),
  screenshotEnabled: z.boolean().optional().default(false),
  screenshotMode: z.enum(['on-failure', 'always', 'never']).optional().default('on-failure'),
  timeout: z.number().int().positive().max(600000).optional().default(30000), // Max 10 minutes
  timingEnabled: z.boolean().optional().default(true),
  timingMode: z.enum(['realistic', 'fast', 'instant']).optional().default('realistic'),
  speedMultiplier: z.number().min(0.1).max(10).optional().default(1.0),
});

/**
 * List runs query schema
 */
export const listRunsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  recordingId: z.string().uuid().optional(),
  scheduleId: z.string().uuid().optional(),
  status: z
    .union([
      z.enum(['queued', 'running', 'passed', 'failed', 'cancelled', 'skipped']),
      z.array(z.enum(['queued', 'running', 'passed', 'failed', 'cancelled', 'skipped'])),
    ])
    .optional(),
  triggeredBy: z.string().max(50).optional(),
  sortBy: z
    .enum(['createdAt', 'startedAt', 'completedAt', 'status'])
    .optional()
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  includeDeleted: z.coerce.boolean().optional().default(false),
});

export type CreateRunRequest = z.infer<typeof createRunSchema>;
export type ListRunsQuery = z.infer<typeof listRunsQuerySchema>;

/**
 * Run execution result (from @saveaction/core)
 */
export interface ExecutionResult {
  status: 'success' | 'failed' | 'partial';
  duration: number;
  actionsTotal: number;
  actionsExecuted: number;
  actionsFailed: number;
  errors: Array<{
    actionId: string;
    actionType: string;
    error: string;
    timestamp: number;
  }>;
  video?: string;
  skippedActions?: Array<{
    action: { id: string; type: string };
    reason: string;
  }>;
}

/**
 * Action execution result
 */
export interface ActionExecutionResult {
  actionId: string;
  actionType: string;
  actionIndex: number;
  status: ActionStatus;
  durationMs?: number;
  startedAt?: Date;
  completedAt?: Date;
  selectorUsed?: string;
  selectorValue?: string;
  errorMessage?: string;
  errorStack?: string;
  pageUrl?: string;
  pageTitle?: string;
}

/**
 * Runner Service options
 */
export interface RunnerServiceOptions {
  defaultTimeout?: number;
  maxConcurrentRuns?: number;
  videoStoragePath?: string;
  screenshotStoragePath?: string;
}

/**
 * Runner Service class
 */
export class RunnerService {
  constructor(
    private readonly runRepository: RunRepository,
    private readonly recordingRepository: RecordingRepository,
    private readonly jobQueueManager?: JobQueueManager,
    _options: RunnerServiceOptions = {}
  ) {
    // Options will be used in future for building run configuration
  }

  // ========================================
  // RUN LIFECYCLE
  // ========================================

  /**
   * Queue a new test run
   */
  async queueRun(userId: string, request: CreateRunRequest): Promise<SafeRun> {
    // Validate request
    const validated = createRunSchema.parse(request);

    // Verify recording exists and user owns it
    const recording = await this.recordingRepository.findById(validated.recordingId);
    if (!recording) {
      throw RunErrors.RECORDING_NOT_FOUND;
    }
    if (recording.userId !== userId) {
      throw RunErrors.NOT_AUTHORIZED;
    }

    // Create run record
    const runData: RunCreateData = {
      userId,
      projectId: recording.projectId,
      recordingId: validated.recordingId,
      recordingName: recording.name,
      recordingUrl: recording.url,
      browser: validated.browser as BrowserType,
      headless: validated.headless,
      videoEnabled: validated.videoEnabled,
      screenshotEnabled: validated.screenshotEnabled,
      timeout: validated.timeout,
      timingEnabled: validated.timingEnabled,
      timingMode: validated.timingMode,
      speedMultiplier: validated.speedMultiplier,
      triggeredBy: 'manual',
    };

    const run = await this.runRepository.create(runData);

    // Queue job for execution
    if (this.jobQueueManager) {
      try {
        const jobData: TestRunJobData = {
          recordingId: validated.recordingId,
          userId,
          runId: run.id,
          browser: validated.browser,
          headless: validated.headless,
          recordVideo: validated.videoEnabled,
          recordScreenshots: validated.screenshotEnabled,
          screenshotMode: validated.screenshotMode,
          timeout: validated.timeout,
          createdAt: new Date().toISOString(),
        };

        const job = await this.jobQueueManager.addJob('test-runs', 'execute-run', jobData, {
          jobId: run.id, // Use run ID as job ID for easy lookup
        });

        // Update run with job ID
        await this.runRepository.update(run.id, {
          jobId: job.id ?? run.id,
          queueName: 'test-runs',
        });

        run.jobId = job.id ?? run.id;
        run.queueName = 'test-runs';
      } catch {
        // Mark run as failed if queueing fails
        await this.runRepository.update(run.id, {
          status: 'failed',
          errorMessage: 'Failed to queue run for execution',
        });
        throw RunErrors.QUEUE_ERROR;
      }
    }

    return run;
  }

  /**
   * Get run by ID
   */
  async getRunById(userId: string, runId: string, includeDeleted = false): Promise<SafeRun> {
    const run = await this.runRepository.findById(runId, includeDeleted);
    if (!run) {
      throw RunErrors.NOT_FOUND;
    }
    if (run.userId !== userId) {
      throw RunErrors.NOT_AUTHORIZED;
    }
    return run;
  }

  /**
   * List runs for user
   */
  async listRuns(userId: string, query: ListRunsQuery): Promise<PaginatedResult<RunSummary>> {
    const validated = listRunsQuerySchema.parse(query);

    const filters: RunListFilters = {
      userId,
      recordingId: validated.recordingId,
      scheduleId: validated.scheduleId,
      status: validated.status as RunStatus | RunStatus[] | undefined,
      triggeredBy: validated.triggeredBy,
      includeDeleted: validated.includeDeleted,
    };

    const options: PaginationOptions = {
      page: validated.page,
      limit: validated.limit,
      sortBy: validated.sortBy,
      sortOrder: validated.sortOrder,
    };

    return this.runRepository.findMany(filters, options);
  }

  /**
   * Get run actions
   */
  async getRunActions(userId: string, runId: string): Promise<SafeRunAction[]> {
    // Verify access
    await this.getRunById(userId, runId);
    return this.runRepository.findActionsByRunId(runId);
  }

  /**
   * Soft delete a run
   */
  async deleteRun(userId: string, runId: string): Promise<void> {
    const run = await this.getRunById(userId, runId);

    if (run.deletedAt) {
      throw RunErrors.ALREADY_DELETED;
    }

    // Cannot delete running runs
    if (run.status === 'running') {
      throw new RunError(
        'Cannot delete a running run. Cancel it first.',
        'CANNOT_DELETE_RUNNING',
        400
      );
    }

    await this.runRepository.softDelete(runId);
  }

  /**
   * Restore a soft-deleted run
   */
  async restoreRun(userId: string, runId: string): Promise<SafeRun> {
    const run = await this.runRepository.findById(runId, true);
    if (!run) {
      throw RunErrors.NOT_FOUND;
    }
    if (run.userId !== userId) {
      throw RunErrors.NOT_AUTHORIZED;
    }
    if (!run.deletedAt) {
      throw new RunError('Run is not deleted', 'NOT_DELETED', 400);
    }

    const restored = await this.runRepository.restore(runId);
    if (!restored) {
      throw RunErrors.NOT_FOUND;
    }
    return restored;
  }

  /**
   * Permanently delete a run
   */
  async permanentlyDeleteRun(userId: string, runId: string): Promise<void> {
    const run = await this.runRepository.findById(runId, true);
    if (!run) {
      throw RunErrors.NOT_FOUND;
    }
    if (run.userId !== userId) {
      throw RunErrors.NOT_AUTHORIZED;
    }

    // Delete all actions first (cascade should handle this, but be explicit)
    await this.runRepository.deleteActionsByRunId(runId);
    await this.runRepository.hardDelete(runId);
  }

  // ========================================
  // RUN CANCELLATION
  // ========================================

  /**
   * Cancel a running test
   */
  async cancelRun(userId: string, runId: string): Promise<SafeRun> {
    const run = await this.getRunById(userId, runId);

    // Only queued or running runs can be cancelled
    if (run.status !== 'queued' && run.status !== 'running') {
      throw RunErrors.CANNOT_CANCEL;
    }

    // If queued, remove from queue
    if (run.status === 'queued' && run.jobId && this.jobQueueManager) {
      try {
        const queue = this.jobQueueManager.getQueue('test-runs');
        const job = await queue.getJob(run.jobId);
        if (job) {
          await job.remove();
        }
      } catch {
        // Job may already be processing, continue with status update
      }
    }

    // Update status to cancelled
    const updated = await this.runRepository.update(runId, {
      status: 'cancelled',
      completedAt: new Date(),
    });

    if (!updated) {
      throw RunErrors.NOT_FOUND;
    }

    return updated;
  }

  // ========================================
  // EXECUTION (called by worker)
  // ========================================

  /**
   * Mark run as started
   */
  async markRunStarted(runId: string): Promise<SafeRun> {
    const updated = await this.runRepository.update(runId, {
      status: 'running',
      startedAt: new Date(),
    });

    if (!updated) {
      throw RunErrors.NOT_FOUND;
    }

    return updated;
  }

  /**
   * Mark run as completed (success or failure)
   */
  async markRunCompleted(
    runId: string,
    result: ExecutionResult,
    videoPath?: string
  ): Promise<SafeRun> {
    const status: RunStatus = result.status === 'success' ? 'passed' : 'failed';

    const updateData: RunUpdateData = {
      status,
      actionsTotal: result.actionsTotal,
      actionsExecuted: result.actionsExecuted,
      actionsFailed: result.actionsFailed,
      actionsSkipped: result.skippedActions?.length ?? 0,
      durationMs: result.duration,
      completedAt: new Date(),
    };

    if (videoPath) {
      updateData.videoPath = videoPath;
    }

    // Add error details if failed
    if (result.errors.length > 0) {
      const firstError = result.errors[0];
      updateData.errorMessage = firstError.error;
      updateData.errorActionId = firstError.actionId;
    }

    const updated = await this.runRepository.update(runId, updateData);
    if (!updated) {
      throw RunErrors.NOT_FOUND;
    }

    return updated;
  }

  /**
   * Mark run as failed with error
   */
  async markRunFailed(runId: string, error: Error): Promise<SafeRun> {
    const updated = await this.runRepository.update(runId, {
      status: 'failed',
      errorMessage: error.message,
      errorStack: error.stack,
      completedAt: new Date(),
    });

    if (!updated) {
      throw RunErrors.NOT_FOUND;
    }

    return updated;
  }

  /**
   * Save action results
   */
  async saveActionResults(runId: string, results: ActionExecutionResult[]): Promise<void> {
    const actions = results.map((result) => ({
      runId,
      actionId: result.actionId,
      actionType: result.actionType,
      actionIndex: result.actionIndex,
      status: result.status,
      durationMs: result.durationMs,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      selectorUsed: result.selectorUsed,
      selectorValue: result.selectorValue,
      errorMessage: result.errorMessage,
      errorStack: result.errorStack,
      pageUrl: result.pageUrl,
      pageTitle: result.pageTitle,
    }));

    await this.runRepository.createActions(actions);
  }

  // ========================================
  // STATISTICS & UTILITIES
  // ========================================

  /**
   * Get recent runs for a recording
   */
  async getRecentRunsForRecording(
    userId: string,
    recordingId: string,
    limit = 10
  ): Promise<RunSummary[]> {
    // Verify recording ownership
    const recording = await this.recordingRepository.findById(recordingId);
    if (!recording) {
      throw RunErrors.RECORDING_NOT_FOUND;
    }
    if (recording.userId !== userId) {
      throw RunErrors.NOT_AUTHORIZED;
    }

    return this.runRepository.findRecentByRecordingId(recordingId, limit);
  }

  /**
   * Get run count for user
   */
  async getRunCount(userId: string): Promise<number> {
    return this.runRepository.countByUserId(userId);
  }

  /**
   * Find orphaned runs (running past timeout)
   */
  async findOrphanedRuns(timeoutMs: number = 600000): Promise<SafeRun[]> {
    return this.runRepository.findOrphanedRuns(timeoutMs);
  }

  /**
   * Clean up orphaned runs (mark as failed)
   */
  async cleanupOrphanedRuns(timeoutMs: number = 600000): Promise<number> {
    const orphanedRuns = await this.findOrphanedRuns(timeoutMs);

    let cleaned = 0;
    for (const run of orphanedRuns) {
      await this.runRepository.update(run.id, {
        status: 'failed',
        errorMessage: 'Run timed out or was orphaned',
        completedAt: new Date(),
      });
      cleaned++;
    }

    return cleaned;
  }
}
