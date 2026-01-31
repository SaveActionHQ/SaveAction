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
import type { TestRunJobData, TestRunJobResult } from './queues/types.js';

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

let worker: Worker<TestRunJobData, TestRunJobResult> | null = null;
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

  // Create processor function
  const processor = createTestRunProcessor({
    db,
    videoStoragePath: env.VIDEO_STORAGE_PATH,
    screenshotStoragePath: env.SCREENSHOT_STORAGE_PATH,
  });

  // Create BullMQ worker
  logger.info('Creating BullMQ worker...');
  worker = new Worker<TestRunJobData, TestRunJobResult>('test-runs', processor, {
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

  // Worker event handlers
  worker.on('ready', () => {
    logger.info('Worker is ready and listening for jobs');
  });

  worker.on('active', (job) => {
    logger.info('Job started', {
      jobId: job.id,
      runId: job.data.runId,
      recordingId: job.data.recordingId,
    });
  });

  worker.on('progress', (job, progress) => {
    logger.info('Job progress', {
      jobId: job.id,
      runId: job.data.runId,
      progress,
    });
  });

  worker.on('completed', (job, result) => {
    logger.info('Job completed', {
      jobId: job.id,
      runId: job.data.runId,
      status: result.status,
      actionsExecuted: result.actionsExecuted,
      actionsFailed: result.actionsFailed,
      duration: result.duration,
    });
  });

  worker.on('failed', (job, error) => {
    logger.error('Job failed', error, {
      jobId: job?.id,
      runId: job?.data.runId,
    });
  });

  worker.on('error', (error) => {
    logger.error('Worker error', error);
  });

  worker.on('stalled', (jobId) => {
    logger.warn('Job stalled', { jobId });
  });

  logger.info('SaveAction Worker started successfully', {
    queue: 'test-runs',
    concurrency: WORKER_CONCURRENCY,
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
    // Close worker (waits for active jobs to finish)
    if (worker) {
      logger.info('Closing worker (waiting for active jobs)...');
      await worker.close();
      logger.info('Worker closed');
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
