/**
 * SaveAction Worker Process
 *
 * This is a SEPARATE process from the API server.
 * It handles test execution using BullMQ workers and Playwright.
 *
 * Run with: pnpm worker
 *
 * Architecture:
 * - API Server (server.ts): Handles HTTP requests, queues jobs
 * - Worker Process (worker.ts): Pulls jobs from queue, executes tests
 *
 * Benefits:
 * - Workers can scale independently
 * - Worker crash doesn't affect API
 * - Logs are isolated per worker
 * - Resource contention eliminated
 */

import 'dotenv/config';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { getEnv, validateProductionEnv } from './config/index.js';
import { initializeDatabase, closeDatabase } from './db/index.js';
import { createTestRunProcessor } from './queues/testRunProcessor.js';
import { createScheduledTestProcessor } from './queues/scheduledTestProcessor.js';
import { JobQueueManager } from './queues/JobQueueManager.js';
import type { TestRunJobData, TestRunJobResult, ScheduledTestJobData } from './queues/types.js';
import type { ScheduledTestJobResult } from './queues/scheduledTestProcessor.js';

// Worker configuration
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY ?? '3', 10);
const WORKER_NAME = process.env.WORKER_NAME ?? `worker-${process.pid}`;
const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';

// Log level priority
const LOG_LEVELS: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLogLevel = LOG_LEVELS[LOG_LEVEL] ?? 1;

// Structured logger for worker with log level support
const logger = {
  debug: (message: string, data?: Record<string, unknown>) => {
    if (currentLogLevel <= LOG_LEVELS.debug) {
      console.log(
        JSON.stringify({
          level: 'debug',
          worker: WORKER_NAME,
          timestamp: new Date().toISOString(),
          message,
          ...data,
        })
      );
    }
  },
  info: (message: string, data?: Record<string, unknown>) => {
    if (currentLogLevel <= LOG_LEVELS.info) {
      console.log(
        JSON.stringify({
          level: 'info',
          worker: WORKER_NAME,
          timestamp: new Date().toISOString(),
          message,
          ...data,
        })
      );
    }
  },
  error: (message: string, error?: Error, data?: Record<string, unknown>) => {
    if (currentLogLevel <= LOG_LEVELS.error) {
      console.error(
        JSON.stringify({
          level: 'error',
          worker: WORKER_NAME,
          timestamp: new Date().toISOString(),
          message,
          error: error?.message,
          stack: error?.stack,
          ...data,
        })
      );
    }
  },
  warn: (message: string, data?: Record<string, unknown>) => {
    if (currentLogLevel <= LOG_LEVELS.warn) {
      console.warn(
        JSON.stringify({
          level: 'warn',
          worker: WORKER_NAME,
          timestamp: new Date().toISOString(),
          message,
          ...data,
        })
      );
    }
  },
};

let testRunWorker: Worker<TestRunJobData, TestRunJobResult> | null = null;
let scheduledTestWorker: Worker<ScheduledTestJobData, ScheduledTestJobResult> | null = null;
let jobQueueManager: JobQueueManager | null = null;
let redisConnection: Redis | null = null;
let isShuttingDown = false;

/**
 * Start the worker process
 */
async function start(): Promise<void> {
  logger.info('Starting SaveAction Worker', {
    concurrency: WORKER_CONCURRENCY,
    pid: process.pid,
  });

  // Validate environment
  const env = getEnv();
  validateProductionEnv(env);

  if (!env.REDIS_URL) {
    throw new Error('REDIS_URL is required for worker process');
  }

  // Connect to database
  logger.info('Connecting to database...');
  const db = initializeDatabase();

  // Connect to Redis for BullMQ
  // Note: BullMQ requires a Redis connection WITHOUT keyPrefix
  // BullMQ manages its own prefixing via the 'prefix' option
  logger.info('Connecting to Redis...');
  const redisUrl = env.REDIS_URL ?? 'redis://localhost:6379';
  redisConnection = new Redis(redisUrl, {
    maxRetriesPerRequest: null, // Required by BullMQ for blocking commands
    enableReadyCheck: true,
    // Do NOT set keyPrefix - BullMQ uses its own prefix option
  });

  // Wait for Redis to be ready
  await new Promise<void>((resolve, reject) => {
    redisConnection!.on('ready', () => {
      logger.info('Redis connection ready');
      resolve();
    });
    redisConnection!.on('error', (err) => {
      reject(err);
    });
    // Timeout after 10 seconds
    setTimeout(() => reject(new Error('Redis connection timeout')), 10000);
  });

  // Create JobQueueManager for scheduled-tests processor to queue test-runs
  logger.info('Creating JobQueueManager...');
  jobQueueManager = new JobQueueManager({ connection: redisConnection });
  await jobQueueManager.initialize();

  // Create test-runs processor function
  const testRunProcessor = createTestRunProcessor({
    db,
    videoStoragePath: env.VIDEO_STORAGE_PATH,
    screenshotStoragePath: env.SCREENSHOT_STORAGE_PATH,
  });

  // Create scheduled-tests processor function
  const scheduledTestProcessor = createScheduledTestProcessor({
    db,
    jobQueueManager,
    logger,
  });

  // Create BullMQ workers
  logger.info('Creating BullMQ workers...');

  // Test runs worker (executes actual tests with Playwright)
  testRunWorker = new Worker<TestRunJobData, TestRunJobResult>('test-runs', testRunProcessor, {
    connection: redisConnection,
    concurrency: WORKER_CONCURRENCY,
    prefix: 'saveaction',
    // Prevent stalled jobs from being reprocessed too quickly
    stalledInterval: 30000,
    // Maximum time a job can run before being considered stalled
    lockDuration: 300000, // 5 minutes for long tests
    // How long to wait for jobs
    drainDelay: 5,
  });

  // Scheduled tests worker (triggers test runs on schedule)
  scheduledTestWorker = new Worker<ScheduledTestJobData, ScheduledTestJobResult>(
    'scheduled-tests',
    scheduledTestProcessor,
    {
      connection: redisConnection,
      concurrency: 3, // Schedule processing is fast, lower concurrency
      prefix: 'saveaction',
      stalledInterval: 30000,
      lockDuration: 60000, // 1 minute is enough for schedule processing
      drainDelay: 5,
    }
  );

  // Test-runs worker event handlers
  testRunWorker.on('ready', () => {
    logger.info('Test-runs worker is ready and listening for jobs');
  });

  testRunWorker.on('active', (job) => {
    logger.info('Test run job started', {
      queue: 'test-runs',
      jobId: job.id,
      runId: job.data.runId,
      recordingId: job.data.recordingId,
    });
  });

  testRunWorker.on('progress', (job, progress) => {
    logger.info('Test run job progress', {
      queue: 'test-runs',
      jobId: job.id,
      runId: job.data.runId,
      progress,
    });
  });

  testRunWorker.on('completed', (job, result) => {
    logger.info('Test run job completed', {
      queue: 'test-runs',
      jobId: job.id,
      runId: job.data.runId,
      status: result.status,
      actionsExecuted: result.actionsExecuted,
      actionsFailed: result.actionsFailed,
      duration: result.duration,
    });
  });

  testRunWorker.on('failed', (job, error) => {
    logger.error('Test run job failed', error, {
      queue: 'test-runs',
      jobId: job?.id,
      runId: job?.data.runId,
    });
  });

  testRunWorker.on('error', (error) => {
    logger.error('Test-runs worker error', error);
  });

  testRunWorker.on('stalled', (jobId) => {
    logger.warn('Test run job stalled', { queue: 'test-runs', jobId });
  });

  // Scheduled-tests worker event handlers
  scheduledTestWorker.on('ready', () => {
    logger.info('Scheduled-tests worker is ready and listening for jobs');
  });

  scheduledTestWorker.on('active', (job) => {
    logger.info('Scheduled test job started', {
      queue: 'scheduled-tests',
      jobId: job.id,
      scheduleId: job.data.scheduleId,
    });
  });

  scheduledTestWorker.on('completed', (job, result) => {
    logger.info('Scheduled test job completed', {
      queue: 'scheduled-tests',
      jobId: job.id,
      scheduleId: job.data.scheduleId,
      status: result.status,
      runId: result.runId,
    });
  });

  scheduledTestWorker.on('failed', (job, error) => {
    logger.error('Scheduled test job failed', error, {
      queue: 'scheduled-tests',
      jobId: job?.id,
      scheduleId: job?.data.scheduleId,
    });
  });

  scheduledTestWorker.on('error', (error) => {
    logger.error('Scheduled-tests worker error', error);
  });

  scheduledTestWorker.on('stalled', (jobId) => {
    logger.warn('Scheduled test job stalled', { queue: 'scheduled-tests', jobId });
  });

  logger.info('SaveAction Worker started successfully', {
    queues: ['test-runs', 'scheduled-tests'],
    testRunsConcurrency: WORKER_CONCURRENCY,
    scheduledTestsConcurrency: 3,
  });
}

/**
 * Graceful shutdown
 */
async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress, forcing exit');
    process.exit(1);
  }

  isShuttingDown = true;
  logger.info(`Received ${signal}, shutting down gracefully...`);

  try {
    // Close workers (waits for active jobs to finish)
    if (testRunWorker) {
      logger.info('Closing test-runs worker (waiting for active jobs)...');
      await testRunWorker.close();
      logger.info('Test-runs worker closed');
    }

    if (scheduledTestWorker) {
      logger.info('Closing scheduled-tests worker...');
      await scheduledTestWorker.close();
      logger.info('Scheduled-tests worker closed');
    }

    // Close JobQueueManager
    if (jobQueueManager) {
      logger.info('Closing JobQueueManager...');
      await jobQueueManager.shutdown();
      logger.info('JobQueueManager closed');
    }

    // Close Redis
    if (redisConnection) {
      logger.info('Closing Redis connection...');
      await redisConnection.quit();
      logger.info('Redis closed');
    }

    // Close database
    logger.info('Closing database connection...');
    await closeDatabase();
    logger.info('Database closed');

    logger.info('Worker shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error('Error during shutdown', err as Error);
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', err);
  shutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', reason instanceof Error ? reason : new Error(String(reason)));
  shutdown('unhandledRejection');
});

// Start worker
start().catch((err) => {
  logger.error('Failed to start worker', err);
  process.exit(1);
});
