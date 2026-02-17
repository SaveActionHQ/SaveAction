import type { Job, JobsOptions, QueueOptions, WorkerOptions } from 'bullmq';

/**
 * Supported queue names in the system.
 */
export type QueueName = 'test-runs' | 'cleanup' | 'scheduled-tests';

/**
 * Base job data interface - all jobs extend this.
 */
export interface BaseJobData {
  /** Unique identifier for tracking */
  correlationId?: string;
  /** When the job was created */
  createdAt: string;
}

/**
 * Run type for the job
 */
export type JobRunType = 'recording' | 'test' | 'suite';

/**
 * Job data for test run execution.
 *
 * Supports three run types:
 * - 'recording': Legacy single-recording run (uses recordingId)
 * - 'test': Single test run with multi-browser support (uses testId)
 * - 'suite': All tests in a suite (uses suiteId, spawns child jobs)
 */
export interface TestRunJobData extends BaseJobData {
  /** User who triggered the run */
  userId: string;
  /** Run ID in database (for status updates) */
  runId: string;

  /** Run type: recording (legacy), test, or suite */
  runType?: JobRunType;

  /** Recording ID from database (legacy recording runs) */
  recordingId?: string;

  /** Test ID for test-based runs */
  testId?: string;

  /** Suite ID for suite-level runs */
  suiteId?: string;

  /** Project ID (required for test/suite runs) */
  projectId?: string;

  /** Browser to use (legacy single-browser) */
  browser?: 'chromium' | 'firefox' | 'webkit';

  /** Browsers to run (multi-browser test runs) */
  browsers?: Array<'chromium' | 'firefox' | 'webkit'>;

  /** Run browsers in parallel or sequentially */
  parallelBrowsers?: boolean;

  /** Run in headless mode */
  headless?: boolean;
  /** Record video */
  recordVideo?: boolean;
  /** Capture screenshots */
  recordScreenshots?: boolean;
  /** Screenshot capture mode */
  screenshotMode?: 'on-failure' | 'always' | 'never';
  /** Execution timeout in ms */
  timeout?: number;
}

/**
 * Job data for cleanup tasks.
 */
export interface CleanupJobData extends BaseJobData {
  /** Type of cleanup to perform */
  cleanupType: 'old-videos' | 'old-screenshots' | 'orphaned-runs' | 'expired-tokens';
  /** Max age in days for cleanup */
  maxAgeDays?: number;
}

/**
 * Job data for scheduled test execution.
 */
export interface ScheduledTestJobData extends BaseJobData {
  /** Schedule ID from database */
  scheduleId: string;
}

/**
 * Union of all job data types.
 */
export type JobData = TestRunJobData | CleanupJobData | ScheduledTestJobData;

/**
 * Per-browser execution result within a test run.
 */
export interface BrowserRunResult {
  browser: string;
  browserResultId: string;
  status: 'passed' | 'failed' | 'cancelled' | 'error';
  duration: number;
  actionsExecuted: number;
  actionsFailed: number;
  errorMessage?: string;
  videoPath?: string;
  screenshotPaths?: string[];
}

/**
 * Job result for test runs.
 */
export interface TestRunJobResult {
  runId: string;
  status: 'passed' | 'failed' | 'cancelled' | 'error';
  duration: number;
  actionsExecuted: number;
  actionsFailed: number;
  errorMessage?: string;
  videoPath?: string;
  /** Paths to captured screenshots */
  screenshotPaths?: string[];
  /** Per-browser results (for multi-browser runs) */
  browserResults?: BrowserRunResult[];
}

/**
 * Job result for cleanup tasks.
 */
export interface CleanupJobResult {
  cleanupType: string;
  itemsProcessed: number;
  itemsDeleted: number;
  errors: string[];
}

/**
 * Queue configuration with sensible defaults.
 */
export interface QueueConfig {
  name: QueueName;
  /** Default job options */
  defaultJobOptions?: JobsOptions;
  /** Queue-specific options */
  queueOptions?: Partial<QueueOptions>;
  /** Worker options (concurrency, etc.) */
  workerOptions?: Partial<WorkerOptions>;
}

/**
 * Default configurations for each queue type.
 */
export const QUEUE_CONFIGS: Record<QueueName, QueueConfig> = {
  'test-runs': {
    name: 'test-runs',
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000, // 1s, 2s, 4s
      },
      removeOnComplete: {
        age: 24 * 3600, // Keep completed jobs for 24 hours
        count: 1000, // Keep last 1000 completed jobs
      },
      removeOnFail: {
        age: 7 * 24 * 3600, // Keep failed jobs for 7 days
      },
    },
    workerOptions: {
      concurrency: 5, // Max 5 concurrent test runs
    },
  },
  cleanup: {
    name: 'cleanup',
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000, // 5s, 10s, 20s
      },
      removeOnComplete: {
        age: 3600, // Keep completed cleanup jobs for 1 hour
      },
      removeOnFail: {
        age: 24 * 3600, // Keep failed cleanup jobs for 1 day
      },
    },
    workerOptions: {
      concurrency: 1, // Cleanup runs sequentially
    },
  },
  'scheduled-tests': {
    name: 'scheduled-tests',
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: 'fixed',
        delay: 30000, // 30s retry for scheduled tests
      },
      removeOnComplete: {
        age: 24 * 3600,
        count: 500,
      },
      removeOnFail: {
        age: 7 * 24 * 3600,
      },
    },
    workerOptions: {
      concurrency: 3, // Max 3 concurrent scheduled runs
    },
  },
};

/**
 * Queue status counts.
 */
export interface QueueStatus {
  name: QueueName;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

/**
 * Overall queue health status.
 */
export interface QueueHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  queues: QueueStatus[];
  workers: {
    name: QueueName;
    running: boolean;
    concurrency: number;
  }[];
}

/**
 * Job processor function type.
 */
export type JobProcessor<T extends BaseJobData, R = unknown> = (job: Job<T, R>) => Promise<R>;
