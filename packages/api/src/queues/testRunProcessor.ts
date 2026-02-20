/**
 * Test Run Worker Processor
 *
 * Processes test run jobs using @saveaction/core's PlaywrightRunner.
 * Handles the full lifecycle: start → execute → complete/fail.
 *
 * Real-time Progress Events:
 * - Publishes progress events to Redis pub/sub for SSE streaming
 * - Events: run:started, action:started, action:success, action:failed, run:completed
 */

import type { Job } from 'bullmq';
import type Redis from 'ioredis';
import type { TestRunJobData, TestRunJobResult, BrowserRunResult } from './types.js';
import type { Database } from '../db/index.js';
import { RunRepository } from '../repositories/RunRepository.js';
import { RecordingRepository } from '../repositories/RecordingRepository.js';
import { RunBrowserResultRepository } from '../repositories/RunBrowserResultRepository.js';
import { ScheduleRepository } from '../repositories/ScheduleRepository.js';
import { TestRepository } from '../repositories/TestRepository.js';
import { TestSuiteRepository } from '../repositories/TestSuiteRepository.js';
import { ScheduleService } from '../services/ScheduleService.js';
import { RunProgressPublisher } from '../services/RunProgressService.js';
import {
  PlaywrightRunner,
  type RunOptions,
  type Reporter,
  type RunResult,
  type Action,
  type Recording,
} from '@saveaction/core';

/**
 * Options for creating the test run processor
 */
export interface TestRunProcessorOptions {
  db: Database;
  /** Redis connection for publishing progress events */
  redis?: Redis;
  videoStoragePath?: string;
  screenshotStoragePath?: string;
}

/**
 * Custom reporter that tracks action results and publishes progress events
 */
class ProgressTrackingReporter implements Reporter {
  private readonly actionResults: Array<{
    actionId: string;
    actionType: string;
    actionIndex: number;
    status: 'success' | 'failed' | 'skipped';
    durationMs: number;
    startedAt: Date;
    completedAt: Date;
    selectorUsed?: string;
    selectorValue?: string;
    errorMessage?: string;
    errorStack?: string;
    screenshotPath?: string;
  }> = [];
  private currentActionStart: number = 0;

  /** Total number of actions in the recording */
  private totalActions: number = 0;

  /** Run ID for progress events */
  private readonly runId: string;

  /** Progress publisher (optional - only available if Redis is configured) */
  private readonly progressPublisher?: RunProgressPublisher;

  /** Browser name for progress events */
  private readonly browser?: string;

  /** Repository for incremental action persistence */
  private readonly runRepository: RunRepository;

  /** Page URL context for action records */
  private readonly pageUrl?: string;

  /** Map of action ID to screenshot path (populated after execution) */
  private screenshotPaths: Map<string, string> = new Map();

  constructor(
    runId: string,
    runRepository: RunRepository,
    progressPublisher?: RunProgressPublisher,
    browser?: string,
    pageUrl?: string
  ) {
    this.runId = runId;
    this.runRepository = runRepository;
    this.progressPublisher = progressPublisher;
    this.browser = browser;
    this.pageUrl = pageUrl;
  }

  /**
   * Set screenshot paths after run execution
   * These come from RunResult.errors[].screenshotPath
   */
  setScreenshotPaths(paths: Map<string, string>): void {
    this.screenshotPaths = paths;
  }

  getResults() {
    // Merge screenshot paths into action results
    return this.actionResults.map((result) => ({
      ...result,
      screenshotPath: this.screenshotPaths.get(result.actionId) || result.screenshotPath,
    }));
  }

  onStart(recording: { testName: string; actionsTotal: number }): void {
    this.totalActions = recording.actionsTotal;
    // Note: run:started is published by the processor before execute() is called
  }

  onActionStart(action: Action, index: number): void {
    this.currentActionStart = Date.now();

    // Publish action started event (fire and forget)
    this.progressPublisher
      ?.publishActionStarted({
        runId: this.runId,
        actionId: action.id ?? `act_${index.toString().padStart(3, '0')}`,
        actionType: action.type,
        actionIndex: index - 1, // Convert to 0-based
        totalActions: this.totalActions,
        browser: this.browser,
      })
      .catch(() => {
        // Ignore publish errors - don't break test execution
      });
  }

  onActionSuccess(action: Action, index: number, duration: number): void {
    const startedAt = new Date(Date.now() - duration);
    const completedAt = new Date();
    const selector = this.extractSelector(action);
    const actionId = action.id ?? `act_${index.toString().padStart(3, '0')}`;
    const actionIndex = index - 1; // Convert to 0-based

    this.actionResults.push({
      actionId,
      actionType: action.type,
      actionIndex,
      status: 'success',
      durationMs: duration,
      startedAt,
      completedAt,
      selectorUsed: selector?.type,
      selectorValue: selector?.value,
    });
    this.currentActionStart = 0;

    // Persist action to DB immediately (fire and forget)
    this.runRepository
      .createAction({
        runId: this.runId,
        actionId,
        actionType: action.type,
        actionIndex,
        browser: this.browser,
        status: 'success',
        durationMs: duration,
        startedAt,
        completedAt,
        selectorUsed: selector?.type,
        selectorValue: selector?.value,
        elementFound: true,
        elementVisible: true,
        pageUrl: this.pageUrl,
      })
      .catch((err) => {
        console.error(`[Worker] Failed to persist action ${actionId}:`, err);
      });

    // Publish action success event (fire and forget)
    this.progressPublisher
      ?.publishActionSuccess({
        runId: this.runId,
        actionId,
        actionType: action.type,
        actionIndex,
        totalActions: this.totalActions,
        durationMs: duration,
        selectorUsed: selector?.type,
        browser: this.browser,
      })
      .catch(() => {
        // Ignore publish errors
      });
  }

  onActionError(action: Action, index: number, error: Error): void {
    const duration = this.currentActionStart ? Date.now() - this.currentActionStart : 0;
    const startedAt = new Date(Date.now() - duration);
    const completedAt = new Date();
    const selector = this.extractSelector(action);
    const actionId = action.id ?? `act_${index.toString().padStart(3, '0')}`;
    const actionIndex = index - 1; // Convert to 0-based

    this.actionResults.push({
      actionId,
      actionType: action.type,
      actionIndex,
      status: 'failed',
      durationMs: duration,
      startedAt,
      completedAt,
      selectorUsed: selector?.type,
      selectorValue: selector?.value,
      errorMessage: error.message,
      errorStack: error.stack,
    });
    this.currentActionStart = 0;

    // Persist action to DB immediately (fire and forget)
    this.runRepository
      .createAction({
        runId: this.runId,
        actionId,
        actionType: action.type,
        actionIndex,
        browser: this.browser,
        status: 'failed',
        durationMs: duration,
        startedAt,
        completedAt,
        selectorUsed: selector?.type,
        selectorValue: selector?.value,
        errorMessage: error.message,
        errorStack: error.stack,
        elementFound: false,
        elementVisible: false,
        pageUrl: this.pageUrl,
      })
      .catch((err) => {
        console.error(`[Worker] Failed to persist action ${actionId}:`, err);
      });

    // Publish action failed event (fire and forget)
    this.progressPublisher
      ?.publishActionFailed({
        runId: this.runId,
        actionId,
        actionType: action.type,
        actionIndex,
        totalActions: this.totalActions,
        errorMessage: error.message,
        durationMs: duration,
        browser: this.browser,
      })
      .catch(() => {
        // Ignore publish errors
      });
  }

  // Called for skipped actions (if the reporter has this method)
  onActionSkipped(action: Action, index: number, reason: string): void {
    const selector = this.extractSelector(action);
    const actionId = action.id ?? `act_${index.toString().padStart(3, '0')}`;
    const actionIndex = index - 1; // Convert to 0-based
    const now = new Date();

    this.actionResults.push({
      actionId,
      actionType: action.type,
      actionIndex,
      status: 'skipped',
      durationMs: 0,
      startedAt: now,
      completedAt: now,
      selectorUsed: selector?.type,
      selectorValue: selector?.value,
      errorMessage: reason,
    });

    // Persist action to DB immediately (fire and forget)
    this.runRepository
      .createAction({
        runId: this.runId,
        actionId,
        actionType: action.type,
        actionIndex,
        browser: this.browser,
        status: 'skipped',
        durationMs: 0,
        startedAt: now,
        completedAt: now,
        selectorUsed: selector?.type,
        selectorValue: selector?.value,
        errorMessage: reason,
        pageUrl: this.pageUrl,
      })
      .catch((err) => {
        console.error(`[Worker] Failed to persist action ${actionId}:`, err);
      });

    // Publish action skipped event (fire and forget)
    this.progressPublisher
      ?.publishActionSkipped({
        runId: this.runId,
        actionId,
        actionType: action.type,
        actionIndex,
        totalActions: this.totalActions,
        reason,
        browser: this.browser,
      })
      .catch(() => {
        // Ignore publish errors
      });
  }

  onComplete(_result: RunResult): void {
    // Note: run:completed is published by the processor after execute() completes
  }

  /**
   * Extract selector info from action (selector structure varies by action type)
   */
  private extractSelector(action: Action): { type?: string; value?: string } | undefined {
    // Check if action has selector property (click, input, etc.)
    if ('selector' in action && action.selector) {
      const sel = action.selector;
      // Get the first available selector type
      if (sel.id) return { type: 'id', value: sel.id };
      if (sel.dataTestId) return { type: 'dataTestId', value: sel.dataTestId };
      if (sel.ariaLabel) return { type: 'ariaLabel', value: sel.ariaLabel };
      if (sel.name) return { type: 'name', value: sel.name };
      if (sel.css) return { type: 'css', value: sel.css };
      if (sel.xpath) return { type: 'xpath', value: sel.xpath };
      if (sel.text) return { type: 'text', value: sel.text };
    }
    return undefined;
  }
}

/**
 * Create a test run processor function
 *
 * Supports two modes:
 * 1. Legacy recording runs: Single recording, single browser (runType === 'recording' or undefined)
 * 2. Test-based runs: Uses test's recordingData, supports multi-browser execution (runType === 'test')
 *
 * @param options - Processor configuration
 * @returns Job processor function for BullMQ worker
 */
export function createTestRunProcessor(
  options: TestRunProcessorOptions
): (job: Job<TestRunJobData>) => Promise<TestRunJobResult> {
  const { db, redis } = options;

  const runRepository = new RunRepository(db);
  const recordingRepository = new RecordingRepository(db);
  const browserResultRepository = new RunBrowserResultRepository(db);
  const scheduleRepository = new ScheduleRepository(db);
  const testRepository = new TestRepository(db);
  const testSuiteRepository = new TestSuiteRepository(db);
  const scheduleService = new ScheduleService(
    scheduleRepository,
    recordingRepository,
    testRepository,
    testSuiteRepository
  );

  // Create progress publisher if Redis is available
  const progressPublisher = redis ? new RunProgressPublisher(redis) : undefined;

  /**
   * Check if all child runs of a parent suite run are complete,
   * and if so, update the parent suite run's status accordingly.
   */
  async function checkAndUpdateParentSuiteRun(runId: string): Promise<void> {
    try {
      const run = await runRepository.findById(runId);
      if (!run?.parentRunId) return;

      const parentRunId = run.parentRunId;
      const children = await runRepository.findChildrenStatuses(parentRunId);

      if (children.length === 0) return;

      const terminalStatuses = new Set(['passed', 'failed', 'cancelled']);
      const allDone = children.every((c) => terminalStatuses.has(c.status));

      if (!allDone) return;

      // Determine parent status
      const hasFailed = children.some((c) => c.status === 'failed');
      const hasCancelled = children.some((c) => c.status === 'cancelled');
      let parentStatus: 'passed' | 'failed' | 'cancelled';
      if (hasFailed) {
        parentStatus = 'failed';
      } else if (hasCancelled) {
        parentStatus = 'cancelled';
      } else {
        parentStatus = 'passed';
      }

      // Aggregate stats
      let totalDuration = 0;
      let totalActionsTotal = 0;
      let totalActionsExecuted = 0;
      let totalActionsFailed = 0;
      let totalActionsSkipped = 0;
      const errors: string[] = [];

      for (const child of children) {
        totalDuration += child.durationMs ? parseInt(child.durationMs, 10) : 0;
        totalActionsTotal += child.actionsTotal ? parseInt(child.actionsTotal, 10) : 0;
        totalActionsExecuted += child.actionsExecuted ? parseInt(child.actionsExecuted, 10) : 0;
        totalActionsFailed += child.actionsFailed ? parseInt(child.actionsFailed, 10) : 0;
        totalActionsSkipped += child.actionsSkipped ? parseInt(child.actionsSkipped, 10) : 0;
        if (child.errorMessage) errors.push(child.errorMessage);
      }

      await runRepository.update(parentRunId, {
        status: parentStatus,
        completedAt: new Date(),
        durationMs: totalDuration,
        actionsTotal: totalActionsTotal,
        actionsExecuted: totalActionsExecuted,
        actionsFailed: totalActionsFailed,
        actionsSkipped: totalActionsSkipped,
        errorMessage: errors.length > 0 ? errors.join('; ') : undefined,
      });

      // Publish suite run completed event
      await progressPublisher?.publishRunCompleted({
        runId: parentRunId,
        status: parentStatus,
        durationMs: totalDuration,
        actionsExecuted: totalActionsExecuted,
        actionsFailed: totalActionsFailed,
        actionsSkipped: totalActionsSkipped,
      });

      console.log(
        `[Worker] Parent suite run ${parentRunId} completed with status: ${parentStatus}`
      );
    } catch (error) {
      console.error(`[Worker] Error updating parent suite run for child ${runId}:`, error);
    }
  }

  /**
   * Execute a single browser run and return results.
   * Shared between legacy recording runs and multi-browser test runs.
   */
  async function executeSingleBrowserRun(params: {
    runId: string;
    browser: 'chromium' | 'firefox' | 'webkit';
    recordingData: Recording;
    actionCount: number;
    recordingUrl: string;
    headless: boolean;
    timeout: number;
    recordVideo: boolean;
    recordScreenshots: boolean;
    screenshotMode: 'on-failure' | 'always' | 'never';
    abortSignal: AbortSignal;
    recordingId?: string;
    recordingName?: string | null;
  }): Promise<{
    status: 'passed' | 'failed' | 'cancelled';
    duration: number;
    actionsExecuted: number;
    actionsFailed: number;
    actionsSkipped: number;
    videoPath?: string;
    screenshotPaths?: string[];
    errorMessage?: string;
    errorActionId?: string;
    actionResults: Array<{
      actionId: string;
      actionType: string;
      actionIndex: number;
      status: 'success' | 'failed' | 'skipped';
      durationMs: number;
      startedAt: Date;
      completedAt: Date;
      selectorUsed?: string;
      selectorValue?: string;
      errorMessage?: string;
      errorStack?: string;
      screenshotPath?: string;
    }>;
  }> {
    const startTime = Date.now();
    const reporter = new ProgressTrackingReporter(
      params.runId,
      runRepository,
      progressPublisher,
      params.browser,
      params.recordingUrl
    );

    // Build actions summary for SSE (so frontend knows all actions up front)
    const actionsSummary =
      params.recordingData.actions?.map((a, i) => ({
        id: a.id ?? `act_${(i + 1).toString().padStart(3, '0')}`,
        type: a.type,
      })) ?? [];

    // Publish run started event
    await progressPublisher?.publishRunStarted({
      runId: params.runId,
      recordingId: params.recordingId ?? '',
      recordingName: params.recordingName ?? null,
      totalActions: params.actionCount,
      browser: params.browser,
      actions: actionsSummary,
    });

    // Build run options
    const runOptions: RunOptions = {
      browser: params.browser,
      headless: params.headless,
      timeout: params.timeout,
      video: params.recordVideo,
      videoDir: options.videoStoragePath ?? './storage/videos',
      screenshot: params.recordScreenshots,
      screenshotMode: params.screenshotMode,
      screenshotDir: options.screenshotStoragePath ?? './storage/screenshots',
      runId: params.runId,
      abortSignal: params.abortSignal,
    };

    // Execute
    const runner = new PlaywrightRunner(runOptions, reporter);
    const result = await runner.execute(params.recordingData);

    // Extract screenshot paths
    const screenshotPathsMap = new Map<string, string>();
    if (result.errors) {
      for (const error of result.errors) {
        if (error.screenshotPath) {
          screenshotPathsMap.set(error.actionId, error.screenshotPath);
        }
      }
    }
    if (result.screenshots && result.screenshots.length > 0) {
      for (const screenshotPath of result.screenshots) {
        const filename = screenshotPath.split(/[/\\]/).pop() || '';
        // Match both old format: {runId}-{index}-{actionId}.png
        // and new format: {runId}-{browser}-{index}-{actionId}.png
        const match = filename.match(/-(act_\d+)\.png$/);
        if (match) {
          screenshotPathsMap.set(match[1], screenshotPath);
        }
      }
    }
    reporter.setScreenshotPaths(screenshotPathsMap);

    const duration = Date.now() - startTime;
    const actionResults = reporter.getResults();
    const actionsExecuted = actionResults.filter((a) => a.status !== 'skipped').length;
    const actionsFailed = actionResults.filter((a) => a.status === 'failed').length;

    let finalStatus: 'passed' | 'failed' | 'cancelled';
    if (result.status === 'cancelled') {
      finalStatus = 'cancelled';
    } else if (result.status === 'success') {
      finalStatus = 'passed';
    } else {
      finalStatus = 'failed';
    }

    return {
      status: finalStatus,
      duration,
      actionsExecuted,
      actionsFailed,
      actionsSkipped: params.actionCount - actionsExecuted,
      videoPath: result.video,
      screenshotPaths: result.screenshots,
      errorMessage: result.errors?.[0]?.error,
      errorActionId: result.errors?.[0]?.actionId,
      actionResults,
    };
  }

  /**
   * Process a legacy recording-based run (single browser)
   */
  async function processRecordingRun(
    job: Job<TestRunJobData>,
    abortController: AbortController,
    cancellationCheckInterval: ReturnType<typeof setInterval>
  ): Promise<TestRunJobResult> {
    const {
      runId,
      recordingId,
      userId,
      browser,
      headless,
      recordVideo,
      recordScreenshots,
      screenshotMode,
      timeout,
    } = job.data;

    const startTime = Date.now();

    try {
      // Mark run as started
      await runRepository.update(runId, {
        status: 'running',
        startedAt: new Date(),
      });

      await job.updateProgress(5);

      // Get the recording data
      const recording = await recordingRepository.findById(recordingId!);
      if (!recording) {
        throw new Error(`Recording not found: ${recordingId}`);
      }

      if (recording.userId !== userId) {
        throw new Error('Not authorized to run this recording');
      }

      const recordingData = recording.data as Recording;

      await job.updateProgress(10);

      // Execute single browser run
      const result = await executeSingleBrowserRun({
        runId,
        browser: (browser ?? 'chromium') as 'chromium' | 'firefox' | 'webkit',
        recordingData,
        actionCount: recording.actionCount,
        recordingUrl: recording.url,
        headless: headless ?? true,
        timeout: timeout ?? 30000,
        recordVideo: recordVideo ?? false,
        recordScreenshots: recordScreenshots ?? false,
        screenshotMode: screenshotMode ?? 'on-failure',
        abortSignal: abortController.signal,
        recordingId: recording.id,
        recordingName: recording.name,
      });

      clearInterval(cancellationCheckInterval);
      await job.updateProgress(90);

      // Update run with results
      await runRepository.update(runId, {
        status: result.status,
        completedAt: new Date(),
        durationMs: result.duration,
        actionsTotal: recording.actionCount,
        actionsExecuted: result.actionsExecuted,
        actionsFailed: result.actionsFailed,
        actionsSkipped: result.actionsSkipped,
        videoPath: result.videoPath,
        errorMessage: result.errorMessage,
        errorStack: undefined,
        errorActionId: result.errorActionId,
        screenshotPaths: result.screenshotPaths,
      });

      // Save action results
      // Actions are already persisted incrementally during execution.
      // Update screenshot paths that are only available after execution completes.
      if (result.actionResults.length > 0) {
        for (const action of result.actionResults) {
          if (action.screenshotPath) {
            await runRepository
              .updateActionScreenshot(runId, action.actionId, action.screenshotPath)
              .catch(() => {
                /* ignore */
              });
          }
        }
      }

      // Publish run completed event
      await progressPublisher?.publishRunCompleted({
        runId,
        status: result.status,
        durationMs: result.duration,
        actionsExecuted: result.actionsExecuted,
        actionsFailed: result.actionsFailed,
        actionsSkipped: result.actionsSkipped,
        videoPath: result.videoPath,
      });

      // Update schedule tracking if triggered by schedule
      const run = await runRepository.findById(runId);
      if (run?.scheduleId && (result.status === 'passed' || result.status === 'failed')) {
        await scheduleService.updateAfterRun(run.scheduleId, runId, result.status);
      }

      // Check if parent suite run should be completed
      await checkAndUpdateParentSuiteRun(runId);

      await job.updateProgress(100);

      return {
        runId,
        status: result.status,
        duration: result.duration,
        actionsExecuted: result.actionsExecuted,
        actionsFailed: result.actionsFailed,
        errorMessage: result.errorMessage,
        videoPath: result.videoPath,
        screenshotPaths: result.screenshotPaths,
      };
    } catch (error) {
      clearInterval(cancellationCheckInterval);

      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      const isCancelled = errorMessage.startsWith('CANCELLED:');

      await runRepository.update(runId, {
        status: isCancelled ? 'cancelled' : 'failed',
        completedAt: new Date(),
        durationMs: duration,
        errorMessage: isCancelled ? 'Run cancelled by user' : errorMessage,
        errorStack: isCancelled ? undefined : errorStack,
      });

      if (isCancelled) {
        await progressPublisher?.publishRunCompleted({
          runId,
          status: 'cancelled',
          durationMs: duration,
          actionsExecuted: 0,
          actionsFailed: 0,
          actionsSkipped: 0,
        });
      } else {
        await progressPublisher?.publishRunError({
          runId,
          errorMessage,
          errorStack,
        });
      }

      // Check if parent suite run should be completed
      await checkAndUpdateParentSuiteRun(runId);

      return {
        runId,
        status: isCancelled ? 'cancelled' : 'error',
        duration,
        actionsExecuted: 0,
        actionsFailed: 0,
        errorMessage: isCancelled ? 'Run cancelled by user' : errorMessage,
      };
    }
  }

  /**
   * Process a test-based run with multi-browser support.
   * Runs the test on each browser (parallel or sequential),
   * storing results per-browser in run_browser_results.
   */
  async function processTestRun(
    job: Job<TestRunJobData>,
    abortController: AbortController,
    cancellationCheckInterval: ReturnType<typeof setInterval>
  ): Promise<TestRunJobResult> {
    const {
      runId,
      testId,
      userId,
      browsers = ['chromium'],
      parallelBrowsers = true,
      headless,
      recordVideo,
      recordScreenshots,
      screenshotMode,
      timeout,
    } = job.data;

    const startTime = Date.now();

    try {
      // Mark run as started
      await runRepository.update(runId, {
        status: 'running',
        startedAt: new Date(),
      });

      await job.updateProgress(5);

      // Get test data from the run (test's recordingData is passed via the run)
      // We need to get the test from the DB to access its recordingData
      const { TestRepository } = await import('../repositories/TestRepository.js');
      const testRepository = new TestRepository(db);
      const testRecord = await testRepository.findById(testId!);

      if (!testRecord) {
        throw new Error(`Test not found: ${testId}`);
      }

      if (testRecord.userId !== userId) {
        throw new Error('Not authorized to run this test');
      }

      const recordingData = testRecord.recordingData as unknown as Recording;
      const actionCount = testRecord.actionCount ?? recordingData.actions?.length ?? 0;

      await job.updateProgress(10);

      // Get existing browser result rows (created by RunnerService.queueTestRun)
      const browserResults = await browserResultRepository.findByRunId(runId);

      // Execute on each browser
      const browsersToRun = browsers as Array<'chromium' | 'firefox' | 'webkit'>;
      const browserRunResults: BrowserRunResult[] = [];

      // Track action results per browser for saving to DB
      const allBrowserActionResults: Map<
        string,
        Array<{
          actionId: string;
          actionType: string;
          actionIndex: number;
          status: 'success' | 'failed' | 'skipped';
          durationMs: number;
          startedAt: Date;
          completedAt: Date;
          selectorUsed?: string;
          selectorValue?: string;
          errorMessage?: string;
          errorStack?: string;
          screenshotPath?: string;
        }>
      > = new Map();

      const executeBrowser = async (
        browser: 'chromium' | 'firefox' | 'webkit'
      ): Promise<BrowserRunResult> => {
        // Find the browser result row
        const browserResult = browserResults.find((br) => br.browser === browser);

        // Mark browser result as running
        if (browserResult) {
          await browserResultRepository.markStarted(browserResult.id);
        }

        try {
          const result = await executeSingleBrowserRun({
            runId,
            browser,
            recordingData,
            actionCount,
            recordingUrl: testRecord.recordingUrl ?? recordingData.url,
            headless: headless ?? true,
            timeout: timeout ?? 30000,
            recordVideo: recordVideo ?? false,
            recordScreenshots: recordScreenshots ?? false,
            screenshotMode: screenshotMode ?? 'on-failure',
            abortSignal: abortController.signal,
            recordingName: testRecord.name,
          });

          // Track action results for this browser
          if (result.actionResults.length > 0) {
            allBrowserActionResults.set(browser, result.actionResults);
          }

          // First screenshot path for browser result summary
          const firstScreenshot = result.screenshotPaths?.[0];

          // Update browser result row
          if (browserResult) {
            if (result.status === 'passed') {
              await browserResultRepository.markPassed(browserResult.id, {
                durationMs: result.duration,
                actionsTotal: actionCount,
                actionsExecuted: result.actionsExecuted,
                videoPath: result.videoPath,
                screenshotPath: firstScreenshot,
              });
            } else if (result.status === 'failed') {
              await browserResultRepository.markFailed(browserResult.id, {
                durationMs: result.duration,
                actionsTotal: actionCount,
                actionsExecuted: result.actionsExecuted,
                actionsFailed: result.actionsFailed,
                actionsSkipped: result.actionsSkipped,
                errorMessage: result.errorMessage ?? 'Unknown error',
                errorActionId: result.errorActionId,
                videoPath: result.videoPath,
                screenshotPath: firstScreenshot,
              });
            } else {
              // cancelled
              await browserResultRepository.update(browserResult.id, {
                status: 'cancelled',
                completedAt: new Date(),
                durationMs: result.duration,
              });
            }
          }

          return {
            browser,
            browserResultId: browserResult?.id ?? '',
            status: result.status,
            duration: result.duration,
            actionsExecuted: result.actionsExecuted,
            actionsFailed: result.actionsFailed,
            errorMessage: result.errorMessage,
            videoPath: result.videoPath,
            screenshotPaths: result.screenshotPaths,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          if (browserResult) {
            await browserResultRepository.markFailed(browserResult.id, {
              durationMs: Date.now() - startTime,
              actionsTotal: actionCount,
              actionsExecuted: 0,
              actionsFailed: 0,
              errorMessage,
            });
          }

          return {
            browser,
            browserResultId: browserResult?.id ?? '',
            status: 'error' as const,
            duration: Date.now() - startTime,
            actionsExecuted: 0,
            actionsFailed: 0,
            errorMessage,
          };
        }
      };

      // Execute browsers in parallel or sequential
      if (parallelBrowsers && browsersToRun.length > 1) {
        const results = await Promise.all(browsersToRun.map(executeBrowser));
        browserRunResults.push(...results);
      } else {
        for (const browser of browsersToRun) {
          const result = await executeBrowser(browser);
          browserRunResults.push(result);
        }
      }

      clearInterval(cancellationCheckInterval);

      // Calculate aggregate stats
      const totalDuration = Date.now() - startTime;
      const allPassed = browserRunResults.every((r) => r.status === 'passed');
      const anyCancelled = browserRunResults.some((r) => r.status === 'cancelled');
      const totalActionsExecuted = browserRunResults.reduce((sum, r) => sum + r.actionsExecuted, 0);
      const totalActionsFailed = browserRunResults.reduce((sum, r) => sum + r.actionsFailed, 0);

      let overallStatus: 'passed' | 'failed' | 'cancelled';
      if (anyCancelled) {
        overallStatus = 'cancelled';
      } else if (allPassed) {
        overallStatus = 'passed';
      } else {
        overallStatus = 'failed';
      }

      const firstError = browserRunResults.find((r) => r.errorMessage);

      // Update parent run
      await runRepository.update(runId, {
        status: overallStatus,
        completedAt: new Date(),
        durationMs: totalDuration,
        actionsTotal: actionCount * browsersToRun.length,
        actionsExecuted: totalActionsExecuted,
        actionsFailed: totalActionsFailed,
        actionsSkipped: actionCount * browsersToRun.length - totalActionsExecuted,
        errorMessage: firstError?.errorMessage,
        videoPath: browserRunResults.find((r) => r.videoPath)?.videoPath,
        screenshotPaths: browserRunResults.flatMap((r) => r.screenshotPaths ?? []),
      });

      // Action results are already persisted incrementally during execution.
      // Update screenshot paths that are only available after execution completes.
      for (const [, actionResults] of allBrowserActionResults) {
        if (actionResults && actionResults.length > 0) {
          for (const action of actionResults) {
            if (action.screenshotPath) {
              await runRepository
                .updateActionScreenshot(runId, action.actionId, action.screenshotPath)
                .catch(() => {
                  /* ignore */
                });
            }
          }
        }
      }

      // Update test's last run tracking
      await testRepository.updateLastRun(testId!, {
        lastRunId: runId,
        lastRunAt: new Date(),
        lastRunStatus: overallStatus,
      });

      // Publish run completed event
      await progressPublisher?.publishRunCompleted({
        runId,
        status: overallStatus,
        durationMs: totalDuration,
        actionsExecuted: totalActionsExecuted,
        actionsFailed: totalActionsFailed,
        actionsSkipped: actionCount * browsersToRun.length - totalActionsExecuted,
      });

      // Update schedule tracking if triggered by schedule
      const completedRun = await runRepository.findById(runId);
      if (completedRun?.scheduleId && (overallStatus === 'passed' || overallStatus === 'failed')) {
        await scheduleService.updateAfterRun(completedRun.scheduleId, runId, overallStatus);
      }

      await job.updateProgress(100);

      // Check if parent suite run should be completed
      await checkAndUpdateParentSuiteRun(runId);

      return {
        runId,
        status: overallStatus,
        duration: totalDuration,
        actionsExecuted: totalActionsExecuted,
        actionsFailed: totalActionsFailed,
        errorMessage: firstError?.errorMessage,
        browserResults: browserRunResults,
      };
    } catch (error) {
      clearInterval(cancellationCheckInterval);

      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      const isCancelled = errorMessage.startsWith('CANCELLED:');

      // Cancel any pending browser results
      await browserResultRepository.cancelByRunId(runId);

      await runRepository.update(runId, {
        status: isCancelled ? 'cancelled' : 'failed',
        completedAt: new Date(),
        durationMs: duration,
        errorMessage: isCancelled ? 'Run cancelled by user' : errorMessage,
        errorStack: isCancelled ? undefined : errorStack,
      });

      if (isCancelled) {
        await progressPublisher?.publishRunCompleted({
          runId,
          status: 'cancelled',
          durationMs: duration,
          actionsExecuted: 0,
          actionsFailed: 0,
          actionsSkipped: 0,
        });
      } else {
        await progressPublisher?.publishRunError({
          runId,
          errorMessage,
          errorStack,
        });
      }

      // Update schedule tracking if triggered by schedule
      if (!isCancelled) {
        const failedRun = await runRepository.findById(runId);
        if (failedRun?.scheduleId) {
          await scheduleService.updateAfterRun(failedRun.scheduleId, runId, 'failed');
        }
      }

      // Check if parent suite run should be completed
      await checkAndUpdateParentSuiteRun(runId);

      return {
        runId,
        status: isCancelled ? 'cancelled' : 'error',
        duration,
        actionsExecuted: 0,
        actionsFailed: 0,
        errorMessage: isCancelled ? 'Run cancelled by user' : errorMessage,
      };
    }
  }

  // Main processor function
  return async (job: Job<TestRunJobData>): Promise<TestRunJobResult> => {
    const { runId } = job.data;
    const runType = job.data.runType ?? 'recording';

    // Create abort controller for cancellation support
    const abortController = new AbortController();

    // Periodic cancellation check (every 2 seconds)
    const cancellationCheckInterval = setInterval(async () => {
      try {
        const run = await runRepository.findById(runId);
        if (run?.status === 'cancelled') {
          console.log(`[Worker] Run ${runId} was cancelled, aborting...`);
          abortController.abort();
        }
      } catch {
        // Ignore errors during cancellation check
      }
    }, 2000);

    // Route to appropriate processor based on run type
    if (runType === 'test') {
      return processTestRun(job, abortController, cancellationCheckInterval);
    }

    // Default: legacy recording-based run
    return processRecordingRun(job, abortController, cancellationCheckInterval);
  };
}
