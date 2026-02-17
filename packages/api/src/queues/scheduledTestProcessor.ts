/**
 * Scheduled Test Processor
 *
 * Processes scheduled test jobs triggered by BullMQ repeatable jobs.
 * Creates test runs for each scheduled execution.
 */

import type { Job } from 'bullmq';
import type { ScheduledTestJobData, TestRunJobData } from './types.js';
import type { JobQueueManager } from './JobQueueManager.js';
import type { Database } from '../db/index.js';
import { ScheduleRepository } from '../repositories/ScheduleRepository.js';
import { RecordingRepository } from '../repositories/RecordingRepository.js';
import { RunRepository, type RunCreateData } from '../repositories/RunRepository.js';
import type { BrowserType } from '../db/schema/runs.js';

/**
 * Logger interface (injected from worker)
 */
export interface ScheduledTestLogger {
  info: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, error?: Error, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  debug: (message: string, data?: Record<string, unknown>) => void;
}

/**
 * Options for creating the scheduled test processor
 */
export interface ScheduledTestProcessorOptions {
  db: Database;
  jobQueueManager: JobQueueManager;
  logger: ScheduledTestLogger;
}

/**
 * Result from scheduled test processing
 */
export interface ScheduledTestJobResult {
  scheduleId: string;
  runId: string | null;
  status: 'queued' | 'skipped' | 'error';
  message?: string;
}

/**
 * Create the scheduled test processor function
 */
export function createScheduledTestProcessor(options: ScheduledTestProcessorOptions) {
  const { db, jobQueueManager, logger } = options;

  const scheduleRepository = new ScheduleRepository(db);
  const recordingRepository = new RecordingRepository(db);
  const runRepository = new RunRepository(db);

  return async (job: Job<ScheduledTestJobData>): Promise<ScheduledTestJobResult> => {
    const { scheduleId } = job.data;

    logger.info('Processing scheduled test job', {
      jobId: job.id,
      scheduleId,
      jobName: job.name,
    });

    try {
      // 1. Fetch schedule from database
      const schedule = await scheduleRepository.findById(scheduleId);
      if (!schedule) {
        logger.warn('Schedule not found, skipping', { scheduleId });
        return {
          scheduleId,
          runId: null,
          status: 'skipped',
          message: 'Schedule not found',
        };
      }

      // 2. Check if schedule is active
      if (schedule.status !== 'active') {
        logger.info('Schedule is not active, skipping', {
          scheduleId,
          status: schedule.status,
        });
        return {
          scheduleId,
          runId: null,
          status: 'skipped',
          message: `Schedule status is ${schedule.status}`,
        };
      }

      // 3. Check date range constraints
      const now = new Date();
      if (schedule.startsAt && now < schedule.startsAt) {
        logger.info('Schedule has not started yet, skipping', {
          scheduleId,
          startsAt: schedule.startsAt,
        });
        return {
          scheduleId,
          runId: null,
          status: 'skipped',
          message: 'Schedule has not started yet',
        };
      }

      if (schedule.endsAt && now > schedule.endsAt) {
        logger.info('Schedule has ended, skipping', {
          scheduleId,
          endsAt: schedule.endsAt,
        });
        // Disable the schedule since it's past end date
        await scheduleRepository.update(scheduleId, { status: 'disabled' });
        return {
          scheduleId,
          runId: null,
          status: 'skipped',
          message: 'Schedule has ended',
        };
      }

      // 4. Check daily run limit
      if (schedule.maxDailyRuns !== null && schedule.runsToday >= schedule.maxDailyRuns) {
        logger.info('Daily run limit reached, skipping', {
          scheduleId,
          runsToday: schedule.runsToday,
          maxDailyRuns: schedule.maxDailyRuns,
        });
        return {
          scheduleId,
          runId: null,
          status: 'skipped',
          message: 'Daily run limit reached',
        };
      }

      // 5. Verify recording exists
      if (!schedule.recordingId) {
        logger.error('Schedule has no recording ID', undefined, {
          scheduleId,
        });
        return {
          scheduleId,
          runId: null,
          status: 'error',
          message: 'Schedule has no recording ID',
        };
      }

      const recording = await recordingRepository.findById(schedule.recordingId);
      if (!recording) {
        logger.error('Recording not found for schedule', undefined, {
          scheduleId,
          recordingId: schedule.recordingId,
        });
        return {
          scheduleId,
          runId: null,
          status: 'error',
          message: 'Recording not found',
        };
      }

      // 6. Create run record
      const runConfig = schedule.runConfig || {};
      const runData: RunCreateData = {
        userId: schedule.userId,
        projectId: schedule.projectId,
        recordingId: schedule.recordingId,
        recordingName: recording.name,
        recordingUrl: recording.url,
        browser: (runConfig.browser || 'chromium') as BrowserType,
        headless: runConfig.headless ?? true,
        videoEnabled: runConfig.recordVideo ?? false,
        screenshotEnabled:
          (runConfig.screenshotMode && runConfig.screenshotMode !== 'never') ?? false,
        timeout: runConfig.timeout || 60000,
        triggeredBy: 'schedule',
        scheduleId: schedule.id,
      };

      const run = await runRepository.create(runData);

      logger.info('Created run for scheduled test', {
        scheduleId,
        runId: run.id,
        recordingId: schedule.recordingId,
      });

      // 7. Queue the test run job
      const testRunJobData: TestRunJobData = {
        recordingId: schedule.recordingId,
        userId: schedule.userId,
        runId: run.id,
        browser: (runConfig.browser || 'chromium') as 'chromium' | 'firefox' | 'webkit',
        headless: runConfig.headless ?? true,
        recordVideo: runConfig.recordVideo ?? false,
        recordScreenshots:
          (runConfig.screenshotMode && runConfig.screenshotMode !== 'never') ?? false,
        screenshotMode: runConfig.screenshotMode ?? 'on-failure',
        timeout: runConfig.timeout || 60000,
        createdAt: new Date().toISOString(),
      };

      const testJob = await jobQueueManager.addJob('test-runs', 'execute-run', testRunJobData, {
        jobId: run.id,
      });

      // 8. Update run with job ID
      await runRepository.update(run.id, {
        jobId: testJob.id ?? run.id,
        queueName: 'test-runs',
      });

      // 9. Update schedule tracking (nextRunAt will be calculated by BullMQ for repeatable jobs)
      // Note: incrementRunCounters is called after the test-runs job completes via updateAfterRun
      // Here we just track that we queued a run and set status to running
      await scheduleRepository.update(scheduleId, {
        lastRunId: run.id,
        lastRunAt: new Date(),
        lastRunStatus: 'running',
      });

      logger.info('Successfully queued scheduled test run', {
        scheduleId,
        runId: run.id,
        testJobId: testJob.id,
      });

      return {
        scheduleId,
        runId: run.id,
        status: 'queued',
      };
    } catch (error) {
      logger.error('Error processing scheduled test', error as Error, {
        scheduleId,
        jobId: job.id,
      });

      return {
        scheduleId,
        runId: null,
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };
}
