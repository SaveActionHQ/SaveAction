/**
 * Test Run Worker Processor
 *
 * Processes test run jobs using @saveaction/core's PlaywrightRunner.
 * Handles the full lifecycle: start → execute → complete/fail.
 */

import type { Job } from 'bullmq';
import type { TestRunJobData, TestRunJobResult } from './types.js';
import type { Database } from '../db/index.js';
import { RunRepository } from '../repositories/RunRepository.js';
import { RecordingRepository } from '../repositories/RecordingRepository.js';
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
  videoStoragePath?: string;
  screenshotStoragePath?: string;
}

/**
 * Custom reporter that tracks action results
 */
class ActionTrackingReporter implements Reporter {
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

  getResults() {
    return this.actionResults;
  }

  onStart(_recording: { testName: string; actionsTotal: number }): void {
    // Recording started
  }

  onActionStart(_action: Action, _index: number): void {
    this.currentActionStart = Date.now();
  }

  onActionSuccess(action: Action, index: number, duration: number): void {
    const startedAt = new Date(Date.now() - duration);
    const selector = this.extractSelector(action);
    this.actionResults.push({
      actionId: action.id ?? `act_${index.toString().padStart(3, '0')}`,
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
  }

  onActionError(action: Action, index: number, error: Error): void {
    const duration = this.currentActionStart ? Date.now() - this.currentActionStart : 0;
    const startedAt = new Date(Date.now() - duration);
    const selector = this.extractSelector(action);
    this.actionResults.push({
      actionId: action.id ?? `act_${index.toString().padStart(3, '0')}`,
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
  }

  // Called for skipped actions (if the reporter has this method)
  onActionSkipped(action: Action, index: number, reason: string): void {
    const selector = this.extractSelector(action);
    this.actionResults.push({
      actionId: action.id ?? `act_${index.toString().padStart(3, '0')}`,
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
  }

  onComplete(_result: RunResult): void {
    // Run completed
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
  const { db } = options;

  const runRepository = new RunRepository(db);
  const recordingRepository = new RecordingRepository(db);

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

      // Create reporter to track actions
      const reporter = new ActionTrackingReporter();

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
      // Cast recording.data to Recording type (validated at upload time)
      const runner = new PlaywrightRunner(runOptions, reporter);
      const result = await runner.execute(recording.data as Recording);

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
