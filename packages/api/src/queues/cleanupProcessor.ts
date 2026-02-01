/**
 * Cleanup Processor
 *
 * Processes cleanup jobs for:
 * - orphaned-runs: Mark stale "running" runs as failed (timeout cleanup)
 * - old-videos: Delete video files older than retention period
 *
 * Note: expired-tokens cleanup is not needed since we use JWT refresh tokens
 * which are stateless and self-expiring.
 */

import type { Job } from 'bullmq';
import type { CleanupJobData, CleanupJobResult } from './types.js';
import type { Database } from '../db/index.js';
import { RunRepository } from '../repositories/RunRepository.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Logger interface (injected from worker)
 */
export interface CleanupLogger {
  info: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, error?: Error, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  debug: (message: string, data?: Record<string, unknown>) => void;
}

/**
 * Options for creating the cleanup processor
 */
export interface CleanupProcessorOptions {
  db: Database;
  logger: CleanupLogger;
  /** Path to video storage directory */
  videoStoragePath?: string;
  /** Default timeout for orphaned runs in ms (default: 10 minutes) */
  runTimeoutMs?: number;
  /** Max age for videos in days (default: 30) */
  videoRetentionDays?: number;
}

/**
 * Default timeout for orphaned runs (10 minutes)
 */
const DEFAULT_RUN_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Default video retention (30 days)
 */
const DEFAULT_VIDEO_RETENTION_DAYS = 30;

/**
 * Create the cleanup processor function
 */
export function createCleanupProcessor(options: CleanupProcessorOptions) {
  const {
    db,
    logger,
    videoStoragePath = './storage/videos',
    runTimeoutMs = DEFAULT_RUN_TIMEOUT_MS,
    videoRetentionDays = DEFAULT_VIDEO_RETENTION_DAYS,
  } = options;

  const runRepository = new RunRepository(db);

  return async (job: Job<CleanupJobData>): Promise<CleanupJobResult> => {
    const { cleanupType, maxAgeDays } = job.data;

    logger.info('Processing cleanup job', {
      jobId: job.id,
      cleanupType,
      maxAgeDays,
    });

    const errors: string[] = [];
    let itemsProcessed = 0;
    let itemsDeleted = 0;

    try {
      switch (cleanupType) {
        case 'orphaned-runs':
          {
            const result = await cleanupOrphanedRuns(runRepository, runTimeoutMs, logger);
            itemsProcessed = result.found;
            itemsDeleted = result.cleaned;
          }
          break;

        case 'old-videos':
          {
            const retentionDays = maxAgeDays ?? videoRetentionDays;
            const result = await cleanupOldVideos(
              runRepository,
              videoStoragePath,
              retentionDays,
              logger
            );
            itemsProcessed = result.found;
            itemsDeleted = result.deleted;
            errors.push(...result.errors);
          }
          break;

        case 'expired-tokens':
          // JWT refresh tokens are stateless and self-expiring, no cleanup needed
          logger.info('expired-tokens cleanup skipped (using JWT refresh tokens)', {
            jobId: job.id,
          });
          break;

        default:
          throw new Error(`Unknown cleanup type: ${cleanupType}`);
      }

      logger.info('Cleanup job completed', {
        jobId: job.id,
        cleanupType,
        itemsProcessed,
        itemsDeleted,
        errorCount: errors.length,
      });

      return {
        cleanupType,
        itemsProcessed,
        itemsDeleted,
        errors,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Cleanup job failed', error instanceof Error ? error : undefined, {
        jobId: job.id,
        cleanupType,
      });

      return {
        cleanupType,
        itemsProcessed,
        itemsDeleted,
        errors: [...errors, errorMessage],
      };
    }
  };
}

/**
 * Clean up orphaned runs (running past timeout)
 * Marks them as failed with appropriate error message
 */
async function cleanupOrphanedRuns(
  runRepository: RunRepository,
  timeoutMs: number,
  logger: CleanupLogger
): Promise<{ found: number; cleaned: number }> {
  // Find runs that have been "running" for longer than the timeout
  const orphanedRuns = await runRepository.findOrphanedRuns(timeoutMs);

  logger.info('Found orphaned runs', {
    count: orphanedRuns.length,
    timeoutMs,
  });

  let cleaned = 0;
  for (const run of orphanedRuns) {
    try {
      await runRepository.update(run.id, {
        status: 'failed',
        errorMessage: 'Run timed out or was orphaned (worker/API restart)',
        completedAt: new Date(),
      });
      cleaned++;

      logger.debug('Cleaned orphaned run', {
        runId: run.id,
        userId: run.userId,
        startedAt: run.startedAt,
      });
    } catch (error) {
      logger.error('Failed to clean orphaned run', error instanceof Error ? error : undefined, {
        runId: run.id,
      });
    }
  }

  return { found: orphanedRuns.length, cleaned };
}

/**
 * Clean up old video files that exceed retention period
 * Also cleans orphaned videos (files without matching run records)
 */
async function cleanupOldVideos(
  runRepository: RunRepository,
  videoStoragePath: string,
  retentionDays: number,
  logger: CleanupLogger
): Promise<{ found: number; deleted: number; errors: string[] }> {
  const errors: string[] = [];
  let found = 0;
  let deleted = 0;

  // Ensure video storage path exists
  try {
    await fs.access(videoStoragePath);
  } catch {
    logger.info('Video storage path does not exist, skipping cleanup', {
      path: videoStoragePath,
    });
    return { found: 0, deleted: 0, errors: [] };
  }

  const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const entries = await fs.readdir(videoStoragePath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.webm') && !entry.name.endsWith('.mp4')) continue;

    found++;
    const filePath = path.join(videoStoragePath, entry.name);

    try {
      const stat = await fs.stat(filePath);

      // Check if file is older than retention period
      if (stat.mtimeMs < cutoffTime) {
        // Extract run ID from filename if possible (format: run-{id}.webm)
        const runIdMatch = entry.name.match(/^run-([a-zA-Z0-9-]+)\.(webm|mp4)$/);
        const runId = runIdMatch?.[1];

        // Check if the run still exists
        let shouldDelete = true;
        if (runId) {
          const run = await runRepository.findById(runId);
          if (run && run.status === 'running') {
            // Don't delete videos for runs that might still be active
            shouldDelete = false;
            logger.debug('Skipping video for active run', { runId, filePath });
          }
        }

        if (shouldDelete) {
          await fs.unlink(filePath);
          deleted++;
          logger.debug('Deleted old video', {
            filePath,
            age: Math.floor((Date.now() - stat.mtimeMs) / (24 * 60 * 60 * 1000)),
          });
        }
      }
    } catch (error) {
      const msg = `Failed to process video ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(msg);
      logger.warn('Failed to process video file', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info('Video cleanup completed', {
    found,
    deleted,
    retentionDays,
    errorCount: errors.length,
  });

  return { found, deleted, errors };
}

/**
 * Run cleanup immediately (for startup cleanup)
 * This is a convenience function for cleaning orphaned runs on API/worker restart
 */
export async function runStartupCleanup(options: {
  db: Database;
  logger: CleanupLogger;
  runTimeoutMs?: number;
}): Promise<{ orphanedRunsCleaned: number }> {
  const { db, logger, runTimeoutMs = DEFAULT_RUN_TIMEOUT_MS } = options;

  logger.info('Running startup cleanup...');

  const runRepository = new RunRepository(db);
  const result = await cleanupOrphanedRuns(runRepository, runTimeoutMs, logger);

  logger.info('Startup cleanup completed', {
    orphanedRunsCleaned: result.cleaned,
  });

  return { orphanedRunsCleaned: result.cleaned };
}
