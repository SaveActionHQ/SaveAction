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
import type { TestRunJobData, TestRunJobResult } from './types.js';
import type { Database } from '../db/index.js';
import { RunRepository } from '../repositories/RunRepository.js';
import { RecordingRepository } from '../repositories/RecordingRepository.js';
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
  }> = [];
  private currentActionStart: number = 0;

  /** Total number of actions in the recording */
  private totalActions: number = 0;

  /** Run ID for progress events */
  private readonly runId: string;

  /** Progress publisher (optional - only available if Redis is configured) */
  private readonly progressPublisher?: RunProgressPublisher;

  constructor(runId: string, progressPublisher?: RunProgressPublisher) {
    this.runId = runId;
    this.progressPublisher = progressPublisher;
  }

  getResults() {
    return this.actionResults;
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
      })
      .catch(() => {
        // Ignore publish errors - don't break test execution
      });
  }

  onActionSuccess(action: Action, index: number, duration: number): void {
    const startedAt = new Date(Date.now() - duration);
    const selector = this.extractSelector(action);
    const actionId = action.id ?? `act_${index.toString().padStart(3, '0')}`;

    this.actionResults.push({
      actionId,
      actionType: action.type,
      actionIndex: index - 1, // Convert to 0-based
      status: 'success',
      durationMs: duration,
      startedAt,
      completedAt: new Date(),
      selectorUsed: selector?.type,
      selectorValue: selector?.value,
    });
    this.currentActionStart = 0;

    // Publish action success event (fire and forget)
    this.progressPublisher
      ?.publishActionSuccess({
        runId: this.runId,
        actionId,
        actionType: action.type,
        actionIndex: index - 1,
        totalActions: this.totalActions,
        durationMs: duration,
        selectorUsed: selector?.type,
      })
      .catch(() => {
        // Ignore publish errors
      });
  }

  onActionError(action: Action, index: number, error: Error): void {
    const duration = this.currentActionStart ? Date.now() - this.currentActionStart : 0;
    const startedAt = new Date(Date.now() - duration);
    const selector = this.extractSelector(action);
    const actionId = action.id ?? `act_${index.toString().padStart(3, '0')}`;

    this.actionResults.push({
      actionId,
      actionType: action.type,
      actionIndex: index - 1, // Convert to 0-based
      status: 'failed',
      durationMs: duration,
      startedAt,
      completedAt: new Date(),
      selectorUsed: selector?.type,
      selectorValue: selector?.value,
      errorMessage: error.message,
      errorStack: error.stack,
    });
    this.currentActionStart = 0;

    // Publish action failed event (fire and forget)
    this.progressPublisher
      ?.publishActionFailed({
        runId: this.runId,
        actionId,
        actionType: action.type,
        actionIndex: index - 1,
        totalActions: this.totalActions,
        errorMessage: error.message,
        durationMs: duration,
      })
      .catch(() => {
        // Ignore publish errors
      });
  }

  // Called for skipped actions (if the reporter has this method)
  onActionSkipped(action: Action, index: number, reason: string): void {
    const selector = this.extractSelector(action);
    const actionId = action.id ?? `act_${index.toString().padStart(3, '0')}`;

    this.actionResults.push({
      actionId,
      actionType: action.type,
      actionIndex: index - 1, // Convert to 0-based
      status: 'skipped',
      durationMs: 0,
      startedAt: new Date(),
      completedAt: new Date(),
      selectorUsed: selector?.type,
      selectorValue: selector?.value,
      errorMessage: reason,
    });

    // Publish action skipped event (fire and forget)
    this.progressPublisher
      ?.publishActionSkipped({
        runId: this.runId,
        actionId,
        actionType: action.type,
        actionIndex: index - 1,
        totalActions: this.totalActions,
        reason,
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
 * @param options - Processor configuration
 * @returns Job processor function for BullMQ worker
 */
export function createTestRunProcessor(
  options: TestRunProcessorOptions
): (job: Job<TestRunJobData>) => Promise<TestRunJobResult> {
  const { db, redis } = options;

  const runRepository = new RunRepository(db);
  const recordingRepository = new RecordingRepository(db);

  // Create progress publisher if Redis is available
  const progressPublisher = redis ? new RunProgressPublisher(redis) : undefined;

  return async (job: Job<TestRunJobData>): Promise<TestRunJobResult> => {
    const { runId, recordingId, userId, browser, headless, recordVideo, timeout } = job.data;

    const startTime = Date.now();

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

    try {
      // Mark run as started
      await runRepository.update(runId, {
        status: 'running',
        startedAt: new Date(),
      });

      // Update job progress
      await job.updateProgress(5);

      // Get the recording data
      const recording = await recordingRepository.findById(recordingId);
      if (!recording) {
        throw new Error(`Recording not found: ${recordingId}`);
      }

      // Verify ownership
      if (recording.userId !== userId) {
        throw new Error('Not authorized to run this recording');
      }

      // Create reporter to track actions and publish progress events
      const reporter = new ProgressTrackingReporter(runId, progressPublisher);

      // Get recording data for events
      const recordingData = recording.data as Recording;

      // Publish run started event
      await progressPublisher?.publishRunStarted({
        runId,
        recordingId,
        recordingName: recording.name,
        totalActions: recording.actionCount,
        browser: browser ?? 'chromium',
      });

      // Build run options with abort signal
      const runOptions: RunOptions = {
        browser: browser ?? 'chromium',
        headless: headless ?? true,
        timeout: timeout ?? 30000,
        video: recordVideo ?? false,
        abortSignal: abortController.signal,
      };

      await job.updateProgress(10);

      // Execute the test run with reporter
      const runner = new PlaywrightRunner(runOptions, reporter);
      const result = await runner.execute(recordingData);

      // Clear cancellation check interval
      clearInterval(cancellationCheckInterval);

      await job.updateProgress(90);

      // Calculate stats
      const duration = Date.now() - startTime;
      const actionResults = reporter.getResults();
      const actionsExecuted = actionResults.filter((a) => a.status !== 'skipped').length;
      const actionsFailed = actionResults.filter((a) => a.status === 'failed').length;

      // Determine final status (check if cancelled)
      let finalStatus: 'passed' | 'failed' | 'cancelled';
      if (result.status === 'cancelled') {
        finalStatus = 'cancelled';
      } else if (result.status === 'success') {
        finalStatus = 'passed';
      } else {
        finalStatus = 'failed';
      }

      // Update run with results
      await runRepository.update(runId, {
        status: finalStatus,
        completedAt: new Date(),
        durationMs: duration,
        actionsTotal: recording.actionCount,
        actionsExecuted,
        actionsFailed,
        actionsSkipped: recording.actionCount - actionsExecuted,
        videoPath: result.video,
        errorMessage: result.errors?.[0]?.error,
        errorStack: undefined,
        errorActionId: result.errors?.[0]?.actionId,
      });

      // Save action results
      if (actionResults.length > 0) {
        const actionRecords = actionResults.map((action) => ({
          runId,
          actionId: action.actionId,
          actionType: action.actionType,
          actionIndex: action.actionIndex,
          status: action.status,
          durationMs: action.durationMs,
          startedAt: action.startedAt,
          completedAt: action.completedAt,
          selectorUsed: action.selectorUsed,
          selectorValue: action.selectorValue,
          retryCount: 0,
          retriedSelectors: undefined,
          errorMessage: action.errorMessage,
          errorStack: action.errorStack,
          screenshotPath: undefined,
          screenshotBefore: undefined,
          screenshotAfter: undefined,
          elementFound: action.status !== 'failed',
          elementVisible: action.status !== 'failed',
          elementTagName: undefined,
          pageUrl: recording.url,
          pageTitle: undefined,
        }));

        await runRepository.createActions(actionRecords);
      }

      // Publish run completed event
      await progressPublisher?.publishRunCompleted({
        runId,
        status: finalStatus,
        durationMs: duration,
        actionsExecuted,
        actionsFailed,
        actionsSkipped: recording.actionCount - actionsExecuted,
        videoPath: result.video,
      });

      await job.updateProgress(100);

      return {
        runId,
        status: finalStatus,
        duration,
        actionsExecuted,
        actionsFailed,
        errorMessage: result.errors?.[0]?.error,
        videoPath: result.video,
      };
    } catch (error) {
      // Clear cancellation check interval on error
      clearInterval(cancellationCheckInterval);

      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      // Check if this was a cancellation
      const isCancelled = errorMessage.startsWith('CANCELLED:');

      // Update run with failure or cancellation
      await runRepository.update(runId, {
        status: isCancelled ? 'cancelled' : 'failed',
        completedAt: new Date(),
        durationMs: duration,
        errorMessage: isCancelled ? 'Run cancelled by user' : errorMessage,
        errorStack: isCancelled ? undefined : errorStack,
      });

      // Publish run error/completed event
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

      return {
        runId,
        status: isCancelled ? 'cancelled' : 'error',
        duration,
        actionsExecuted: 0,
        actionsFailed: 0,
        errorMessage: isCancelled ? 'Run cancelled by user' : errorMessage,
      };
    }
  };
}
