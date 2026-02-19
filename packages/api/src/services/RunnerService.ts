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
import type { TestRepository } from '../repositories/TestRepository.js';
import type { TestSuiteRepository } from '../repositories/TestSuiteRepository.js';
import type { RunBrowserResultRepository } from '../repositories/RunBrowserResultRepository.js';
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
  TEST_NOT_FOUND: new RunError('Test not found', 'TEST_NOT_FOUND', 404),
  SUITE_NOT_FOUND: new RunError('Suite not found', 'SUITE_NOT_FOUND', 404),
  SUITE_EMPTY: new RunError('Suite has no tests to run', 'SUITE_EMPTY', 400),
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
  projectId: z.string().uuid(),
  testId: z.string().uuid().optional(),
  suiteId: z.string().uuid().optional(),
  parentRunId: z.string().uuid().optional(),
  runType: z.enum(['test', 'suite', 'project', 'recording']).optional(),
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
 * Queue a test run request schema (new test-based runs)
 */
export const queueTestRunSchema = z.object({
  testId: z.string().uuid(),
  /** Override browsers from test config */
  browsers: z.array(z.enum(['chromium', 'firefox', 'webkit'])).min(1).optional(),
  /** Override parallel browsers setting */
  parallelBrowsers: z.boolean().optional(),
  /** Override headless from test config */
  headless: z.boolean().optional(),
  /** Override timeout from test config */
  timeout: z.number().int().positive().max(600000).optional(),
  /** Trigger source */
  triggeredBy: z.enum(['manual', 'schedule', 'api', 'webhook', 'ci']).optional().default('manual'),
});

/**
 * Queue a suite run request schema
 */
export const queueSuiteRunSchema = z.object({
  suiteId: z.string().uuid(),
  /** Override browsers for all tests */
  browsers: z.array(z.enum(['chromium', 'firefox', 'webkit'])).min(1).optional(),
  /** Override parallel browsers setting */
  parallelBrowsers: z.boolean().optional(),
  /** Override headless for all tests */
  headless: z.boolean().optional(),
  /** Override timeout for all tests */
  timeout: z.number().int().positive().max(600000).optional(),
  /** Trigger source */
  triggeredBy: z.enum(['manual', 'schedule', 'api', 'webhook', 'ci']).optional().default('manual'),
});

export type QueueTestRunRequest = z.infer<typeof queueTestRunSchema>;
export type QueueSuiteRunRequest = z.infer<typeof queueSuiteRunSchema>;

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
    _options: RunnerServiceOptions = {},
    private readonly testRepository?: TestRepository,
    private readonly testSuiteRepository?: TestSuiteRepository,
    private readonly browserResultRepository?: RunBrowserResultRepository,
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
   * Queue a test run (new test-based execution with multi-browser support)
   *
   * Creates a run record, creates browser result rows for each browser,
   * and queues a job for the worker to execute.
   */
  async queueTestRun(userId: string, projectId: string, request: QueueTestRunRequest, options?: { parentRunId?: string }): Promise<SafeRun> {
    const validated = queueTestRunSchema.parse(request);

    if (!this.testRepository) {
      throw new RunError('Test repository not configured', 'CONFIG_ERROR', 500);
    }

    // Get the test and verify ownership
    const test = await this.testRepository.findById(validated.testId);
    if (!test) {
      throw RunErrors.TEST_NOT_FOUND;
    }
    if (test.userId !== userId) {
      throw RunErrors.NOT_AUTHORIZED;
    }
    if (test.projectId !== projectId) {
      throw RunErrors.NOT_AUTHORIZED;
    }

    // Determine browsers and config
    const browsers = validated.browsers ?? (test.browsers as Array<'chromium' | 'firefox' | 'webkit'>);
    const testConfig = test.config as { headless?: boolean; timeout?: number; video?: boolean; screenshot?: string; parallelBrowsers?: boolean } | null;
    const headless = validated.headless ?? testConfig?.headless ?? true;
    const timeout = validated.timeout ?? testConfig?.timeout ?? 30000;
    const parallelBrowsers = validated.parallelBrowsers ?? testConfig?.parallelBrowsers ?? true;
    const videoEnabled = testConfig?.video ?? false;
    const screenshotEnabled = testConfig?.screenshot !== 'off';
    const screenshotMode = testConfig?.screenshot === 'on' ? 'always' as const : 'on-failure' as const;

    // Create run record
    const runData: RunCreateData = {
      userId,
      projectId,
      runType: 'test',
      testId: test.id,
      suiteId: test.suiteId,
      parentRunId: options?.parentRunId ?? null,
      testName: test.name,
      testSlug: test.slug,
      recordingUrl: test.recordingUrl,
      browser: browsers[0] as BrowserType, // Primary browser
      headless,
      videoEnabled,
      screenshotEnabled,
      timeout,
      triggeredBy: validated.triggeredBy ?? 'manual',
    };

    const run = await this.runRepository.create(runData);

    // Create browser result rows for each browser
    if (this.browserResultRepository) {
      const browserResultData = browsers.map(browser => ({
        userId,
        runId: run.id,
        testId: test.id,
        browser,
        status: 'pending' as const,
      }));
      await this.browserResultRepository.createMany(browserResultData);
    }

    // Queue job for execution
    if (this.jobQueueManager) {
      try {
        const jobData: TestRunJobData = {
          userId,
          runId: run.id,
          runType: 'test',
          testId: test.id,
          projectId,
          browsers,
          parallelBrowsers,
          headless,
          recordVideo: videoEnabled,
          recordScreenshots: screenshotEnabled,
          screenshotMode,
          timeout,
          createdAt: new Date().toISOString(),
        };

        const job = await this.jobQueueManager.addJob('test-runs', 'execute-test-run', jobData, {
          jobId: run.id,
        });

        await this.runRepository.update(run.id, {
          jobId: job.id ?? run.id,
          queueName: 'test-runs',
        });

        run.jobId = job.id ?? run.id;
        run.queueName = 'test-runs';
      } catch {
        await this.runRepository.update(run.id, {
          status: 'failed',
          errorMessage: 'Failed to queue test run for execution',
        });
        throw RunErrors.QUEUE_ERROR;
      }
    }

    return run;
  }

  /**
   * Queue a suite run (runs all tests in a suite)
   *
   * Creates a parent run for the suite, then queues individual test runs
   * for each test in the suite.
   */
  async queueSuiteRun(userId: string, projectId: string, request: QueueSuiteRunRequest): Promise<{ suiteRun: SafeRun; testRuns: SafeRun[] }> {
    const validated = queueSuiteRunSchema.parse(request);

    if (!this.testRepository || !this.testSuiteRepository) {
      throw new RunError('Test/Suite repositories not configured', 'CONFIG_ERROR', 500);
    }

    // Get suite and verify ownership
    const suite = await this.testSuiteRepository.findById(validated.suiteId);
    if (!suite) {
      throw RunErrors.SUITE_NOT_FOUND;
    }
    if (suite.userId !== userId) {
      throw RunErrors.NOT_AUTHORIZED;
    }
    if (suite.projectId !== projectId) {
      throw RunErrors.NOT_AUTHORIZED;
    }

    // Get all tests in the suite
    const testResults = await this.testRepository.findMany(
      { userId, projectId, suiteId: validated.suiteId },
      { limit: 1000 }
    );
    const tests = testResults.data;

    if (tests.length === 0) {
      throw RunErrors.SUITE_EMPTY;
    }

    // Create parent suite run
    const suiteRunData: RunCreateData = {
      userId,
      projectId,
      runType: 'suite',
      suiteId: suite.id,
      testName: suite.name,
      browser: (validated.browsers?.[0] ?? 'chromium') as BrowserType,
      headless: validated.headless ?? true,
      timeout: validated.timeout ?? 30000,
      triggeredBy: validated.triggeredBy ?? 'manual',
    };

    const suiteRun = await this.runRepository.create(suiteRunData);

    // Queue individual test runs for each test
    const testRuns: SafeRun[] = [];
    for (const test of tests) {
      try {
        const testRun = await this.queueTestRun(userId, projectId, {
          testId: test.id,
          browsers: validated.browsers,
          parallelBrowsers: validated.parallelBrowsers,
          headless: validated.headless,
          timeout: validated.timeout,
          triggeredBy: validated.triggeredBy,
        }, { parentRunId: suiteRun.id });
        testRuns.push(testRun);
      } catch {
        // If individual test queueing fails, continue with others
      }
    }

    // Update suite run status
    if (testRuns.length === 0) {
      await this.runRepository.update(suiteRun.id, {
        status: 'failed',
        errorMessage: 'Failed to queue any test runs',
        completedAt: new Date(),
      });
    } else {
      await this.runRepository.update(suiteRun.id, {
        status: 'running',
        startedAt: new Date(),
      });
    }

    return { suiteRun, testRuns };
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
      projectId: validated.projectId,
      testId: validated.testId,
      suiteId: validated.suiteId,
      parentRunId: validated.parentRunId,
      runType: validated.runType,
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
   * Get run actions, optionally filtered by browser
   */
  async getRunActions(userId: string, runId: string, browser?: string): Promise<SafeRunAction[]> {
    // Verify access
    await this.getRunById(userId, runId);
    return this.runRepository.findActionsByRunId(runId, browser);
  }

  /**
   * Get browser results for a run (matrix view)
   */
  async getBrowserResults(userId: string, runId: string): Promise<import('../repositories/RunBrowserResultRepository.js').SafeBrowserResult[]> {
    await this.getRunById(userId, runId);
    if (!this.browserResultRepository) {
      return [];
    }
    return this.browserResultRepository.findByRunId(runId);
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
   * Retry a completed/failed run by creating a new run with the same parameters
   */
  async retryRun(userId: string, runId: string): Promise<SafeRun> {
    const run = await this.getRunById(userId, runId);

    // Only completed runs can be retried
    if (run.status === 'queued' || run.status === 'running') {
      throw RunErrors.ALREADY_RUNNING;
    }

    // If this was a test-based run, re-queue via queueTestRun
    if (run.runType === 'test' && run.testId && this.testRepository) {
      return this.queueTestRun(userId, run.projectId, {
        testId: run.testId,
        headless: run.headless,
        timeout: run.timeout ?? 30000,
        triggeredBy: 'manual',
      });
    }

    // Legacy recording-based run: re-queue via queueRun
    if (run.recordingId) {
      return this.queueRun(userId, {
        recordingId: run.recordingId,
        browser: (run.browser as 'chromium' | 'firefox' | 'webkit') ?? 'chromium',
        headless: run.headless,
        videoEnabled: run.videoEnabled,
        screenshotEnabled: run.screenshotEnabled ?? false,
        screenshotMode: 'on-failure',
        timeout: run.timeout ?? 30000,
        timingEnabled: true,
        timingMode: 'realistic',
        speedMultiplier: 1.0,
      });
    }

    throw new RunError('Cannot determine how to retry this run', 'RETRY_ERROR', 400);
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
