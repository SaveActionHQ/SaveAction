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
import { TestRepository } from '../repositories/TestRepository.js';
import { TestSuiteRepository } from '../repositories/TestSuiteRepository.js';
import { RunRepository, type RunCreateData } from '../repositories/RunRepository.js';
import { RunBrowserResultRepository } from '../repositories/RunBrowserResultRepository.js';
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
  const testRepository = new TestRepository(db);
  const testSuiteRepository = new TestSuiteRepository(db);
  const runRepository = new RunRepository(db);
  const browserResultRepository = new RunBrowserResultRepository(db);

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

      // 5. Resolve target tests based on targetType
      const targetType = schedule.targetType ?? 'recording';
      const runConfig = schedule.runConfig || {};
      const browsers = runConfig.browsers?.length ? runConfig.browsers : ['chromium'];

      if (targetType === 'test') {
        // Single test schedule - uses same model as manual runs:
        // 1 run + run_browser_results rows + 1 execute-test-run job
        if (!schedule.testId) {
          logger.error('Schedule has no test ID', undefined, { scheduleId });
          return { scheduleId, runId: null, status: 'error', message: 'Schedule has no test ID' };
        }

        const test = await testRepository.findById(schedule.testId);
        if (!test) {
          logger.error('Test not found for schedule', undefined, {
            scheduleId,
            testId: schedule.testId,
          });
          return { scheduleId, runId: null, status: 'error', message: 'Test not found' };
        }

        if (!test.recordingData) {
          logger.error('Test has no recording data', undefined, { scheduleId, testId: test.id });
          return {
            scheduleId,
            runId: null,
            status: 'error',
            message: 'Test has no recording data',
          };
        }

        // Resolve recording info from recordingId if available
        let recordingName = test.name;
        let recordingUrl = test.recordingUrl || '';
        if (test.recordingId) {
          const recording = await recordingRepository.findById(test.recordingId);
          if (recording) {
            recordingName = recording.name;
            recordingUrl = recording.url;
          }
        }

        const testConfig = test.config as {
          headless?: boolean;
          timeout?: number;
          video?: boolean;
          screenshot?: string;
          parallelBrowsers?: boolean;
        } | null;
        const headless = runConfig.headless ?? testConfig?.headless ?? true;
        const timeout = runConfig.timeout || testConfig?.timeout || 60000;
        const videoEnabled = runConfig.recordVideo ?? testConfig?.video ?? false;
        const screenshotEnabled =
          (runConfig.screenshotMode && runConfig.screenshotMode !== 'never') ??
          testConfig?.screenshot !== 'off';
        const screenshotMode =
          runConfig.screenshotMode ??
          (testConfig?.screenshot === 'on' ? ('always' as const) : ('on-failure' as const));
        const parallelBrowsers = testConfig?.parallelBrowsers ?? true;

        // Create a single run record (same as RunnerService.queueTestRun)
        const runData: RunCreateData = {
          userId: schedule.userId,
          projectId: schedule.projectId,
          recordingId: test.recordingId || null,
          testId: test.id,
          testName: test.name,
          testSlug: test.slug,
          recordingName,
          recordingUrl,
          browser: browsers[0] as BrowserType,
          headless,
          videoEnabled,
          screenshotEnabled,
          timeout,
          triggeredBy: 'schedule',
          scheduleId: schedule.id,
          runType: 'test',
        };

        const run = await runRepository.create(runData);

        // Create browser result rows for each browser
        const browserResultData = browsers.map((browser) => ({
          userId: schedule.userId,
          runId: run.id,
          testId: test.id,
          browser,
          status: 'pending' as const,
        }));
        await browserResultRepository.createMany(browserResultData);

        // Queue a single execute-test-run job (worker handles all browsers)
        const testRunJobData: TestRunJobData = {
          userId: schedule.userId,
          runId: run.id,
          runType: 'test',
          testId: test.id,
          projectId: schedule.projectId,
          browsers: browsers as Array<'chromium' | 'firefox' | 'webkit'>,
          parallelBrowsers,
          headless,
          recordVideo: videoEnabled,
          recordScreenshots: screenshotEnabled,
          screenshotMode,
          timeout,
          createdAt: new Date().toISOString(),
        };

        const testJob = await jobQueueManager.addJob(
          'test-runs',
          'execute-test-run',
          testRunJobData,
          {
            jobId: run.id,
          }
        );

        await runRepository.update(run.id, {
          jobId: testJob.id ?? run.id,
          queueName: 'test-runs',
        });

        await scheduleRepository.update(scheduleId, {
          lastRunId: run.id,
          lastRunAt: new Date(),
          lastRunStatus: 'running',
        });

        logger.info('Successfully queued scheduled test run', {
          scheduleId,
          runId: run.id,
          testId: test.id,
          browsers,
        });

        return { scheduleId, runId: run.id, status: 'queued' };
      } else if (targetType === 'suite') {
        // Suite schedule - run all tests in the suite
        if (!schedule.suiteId) {
          logger.error('Schedule has no suite ID', undefined, { scheduleId });
          return { scheduleId, runId: null, status: 'error', message: 'Schedule has no suite ID' };
        }

        const suite = await testSuiteRepository.findById(schedule.suiteId);
        if (!suite) {
          logger.error('Suite not found for schedule', undefined, {
            scheduleId,
            suiteId: schedule.suiteId,
          });
          return { scheduleId, runId: null, status: 'error', message: 'Suite not found' };
        }

        // Get all tests in the suite
        const testsInSuite = await testRepository.findAllBySuite(schedule.userId, schedule.suiteId);

        if (testsInSuite.length === 0) {
          logger.warn('Suite has no tests to run', { scheduleId, suiteId: schedule.suiteId });
          return { scheduleId, runId: null, status: 'skipped', message: 'Suite has no tests' };
        }

        // Create a parent "suite" run
        const parentRunData: RunCreateData = {
          userId: schedule.userId,
          projectId: schedule.projectId,
          testName: suite.name,
          recordingName: suite.name,
          recordingUrl: '',
          browser: (browsers[0] || 'chromium') as BrowserType,
          headless: runConfig.headless ?? true,
          videoEnabled: runConfig.recordVideo ?? false,
          screenshotEnabled:
            (runConfig.screenshotMode && runConfig.screenshotMode !== 'never') ?? false,
          timeout: runConfig.timeout || 60000,
          triggeredBy: 'schedule',
          scheduleId: schedule.id,
          runType: 'suite',
          suiteId: schedule.suiteId,
        };

        const parentRun = await runRepository.create(parentRunData);

        logger.info('Created parent suite run for schedule', {
          scheduleId,
          runId: parentRun.id,
          suiteId: schedule.suiteId,
          testCount: testsInSuite.length,
        });

        // Queue individual test runs (same pattern as single-test schedule)
        let queuedCount = 0;
        for (const test of testsInSuite) {
          if (!test.recordingData) {
            logger.warn('Skipping test without recording data', { testId: test.id });
            continue;
          }

          const testConfig = test.config as {
            headless?: boolean;
            timeout?: number;
            video?: boolean;
            screenshot?: string;
            parallelBrowsers?: boolean;
          } | null;

          let recordingName = test.name;
          let recordingUrl = test.recordingUrl || '';
          if (test.recordingId) {
            const recording = await recordingRepository.findById(test.recordingId);
            if (recording) {
              recordingName = recording.name;
              recordingUrl = recording.url;
            }
          }

          // Determine per-test config with schedule config as override
          const headless = runConfig.headless ?? testConfig?.headless ?? true;
          const videoEnabled = runConfig.recordVideo ?? testConfig?.video ?? false;
          const screenshotEnabled =
            runConfig.screenshotMode != null
              ? runConfig.screenshotMode !== 'never'
              : testConfig?.screenshot != null
                ? testConfig.screenshot !== 'off'
                : true;
          const screenshotMode =
            runConfig.screenshotMode ??
            (testConfig?.screenshot === 'on' ? ('always' as const) : ('on-failure' as const));
          const timeout = runConfig.timeout || testConfig?.timeout || 60000;
          const parallelBrowsers = testConfig?.parallelBrowsers ?? true;

          // Create child run with runType 'test' (same as single-test schedule)
          const childRunData: RunCreateData = {
            userId: schedule.userId,
            projectId: schedule.projectId,
            recordingId: test.recordingId || null,
            testId: test.id,
            testName: test.name,
            testSlug: test.slug,
            recordingName,
            recordingUrl,
            browser: browsers[0] as BrowserType,
            headless,
            videoEnabled,
            screenshotEnabled,
            timeout,
            triggeredBy: 'schedule',
            scheduleId: schedule.id,
            parentRunId: parentRun.id,
            runType: 'test',
          };

          const childRun = await runRepository.create(childRunData);

          // Create browser result rows for each browser (multi-browser support)
          const browserResultData = browsers.map((browser) => ({
            userId: schedule.userId,
            runId: childRun.id,
            testId: test.id,
            browser,
            status: 'pending' as const,
          }));
          await browserResultRepository.createMany(browserResultData);

          // Queue execute-test-run job (worker handles all browsers)
          const testRunJobData: TestRunJobData = {
            userId: schedule.userId,
            runId: childRun.id,
            runType: 'test',
            testId: test.id,
            projectId: schedule.projectId,
            browsers: browsers as Array<'chromium' | 'firefox' | 'webkit'>,
            parallelBrowsers,
            headless,
            recordVideo: videoEnabled,
            recordScreenshots: screenshotEnabled,
            screenshotMode,
            timeout,
            createdAt: new Date().toISOString(),
          };

          const testJob = await jobQueueManager.addJob(
            'test-runs',
            'execute-test-run',
            testRunJobData,
            { jobId: childRun.id }
          );

          await runRepository.update(childRun.id, {
            jobId: testJob.id ?? childRun.id,
            queueName: 'test-runs',
          });

          queuedCount++;
        }

        // Update parent suite run status
        if (queuedCount === 0) {
          await runRepository.update(parentRun.id, {
            status: 'failed',
            errorMessage: 'No tests could be queued (missing recording data)',
            completedAt: new Date(),
          });
        } else {
          await runRepository.update(parentRun.id, {
            status: 'running',
            startedAt: new Date(),
          });
        }

        await scheduleRepository.update(scheduleId, {
          lastRunId: parentRun.id,
          lastRunAt: new Date(),
          lastRunStatus: queuedCount > 0 ? 'running' : 'failed',
        });

        logger.info('Successfully queued suite scheduled runs', {
          scheduleId,
          parentRunId: parentRun.id,
          testCount: testsInSuite.length,
          queuedCount,
        });

        return { scheduleId, runId: parentRun.id, status: 'queued' };
      } else {
        // Legacy recording-based schedule (backward compatibility)
        if (!schedule.recordingId) {
          logger.error('Schedule has no recording ID', undefined, { scheduleId });
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
          return { scheduleId, runId: null, status: 'error', message: 'Recording not found' };
        }

        const runData: RunCreateData = {
          userId: schedule.userId,
          projectId: schedule.projectId,
          recordingId: schedule.recordingId,
          recordingName: recording.name,
          recordingUrl: recording.url,
          browser: (browsers[0] || 'chromium') as BrowserType,
          headless: runConfig.headless ?? true,
          videoEnabled: runConfig.recordVideo ?? false,
          screenshotEnabled:
            (runConfig.screenshotMode && runConfig.screenshotMode !== 'never') ?? false,
          timeout: runConfig.timeout || 60000,
          triggeredBy: 'schedule',
          scheduleId: schedule.id,
        };

        const run = await runRepository.create(runData);

        logger.info('Created run for scheduled recording', {
          scheduleId,
          runId: run.id,
          recordingId: schedule.recordingId,
        });

        const testRunJobData: TestRunJobData = {
          recordingId: schedule.recordingId,
          userId: schedule.userId,
          runId: run.id,
          browser: (browsers[0] || 'chromium') as 'chromium' | 'firefox' | 'webkit',
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

        await runRepository.update(run.id, {
          jobId: testJob.id ?? run.id,
          queueName: 'test-runs',
        });

        await scheduleRepository.update(scheduleId, {
          lastRunId: run.id,
          lastRunAt: new Date(),
          lastRunStatus: 'running',
        });

        logger.info('Successfully queued scheduled recording run', {
          scheduleId,
          runId: run.id,
          testJobId: testJob.id,
        });

        return { scheduleId, runId: run.id, status: 'queued' };
      }
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
