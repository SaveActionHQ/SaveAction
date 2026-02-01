/**
 * Tests for Cleanup Processor
 *
 * Tests cleanup job processing for orphaned runs, old videos, and old screenshots.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Job } from 'bullmq';
import type { CleanupJobData, CleanupJobResult } from './types.js';
import fs from 'fs/promises';
import path from 'path';

// Mock the dependencies before importing
vi.mock('../repositories/RunRepository.js', () => ({
  RunRepository: vi.fn().mockImplementation(() => ({
    findOrphanedRuns: vi.fn(),
    update: vi.fn(),
    findById: vi.fn(),
  })),
}));

vi.mock('fs/promises', () => ({
  default: {
    access: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    unlink: vi.fn(),
  },
}));

import {
  createCleanupProcessor,
  runStartupCleanup,
  type CleanupLogger,
} from './cleanupProcessor.js';
import { RunRepository } from '../repositories/RunRepository.js';

describe('cleanupProcessor', () => {
  let mockDb: any;
  let mockJob: Job<CleanupJobData>;
  let mockRunRepository: any;
  let mockLogger: CleanupLogger;

  const mockOrphanedRun = {
    id: 'run-123',
    userId: 'user-123',
    status: 'running',
    startedAt: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {};

    mockRunRepository = {
      findOrphanedRuns: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    // Setup mocks
    (RunRepository as any).mockImplementation(() => mockRunRepository);

    mockJob = {
      id: 'job-123',
      data: {
        cleanupType: 'orphaned-runs',
        createdAt: new Date().toISOString(),
      },
      updateProgress: vi.fn().mockResolvedValue(undefined),
    } as unknown as Job<CleanupJobData>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createCleanupProcessor', () => {
    describe('orphaned-runs cleanup', () => {
      it('should clean orphaned runs that exceed timeout', async () => {
        mockRunRepository.findOrphanedRuns.mockResolvedValue([mockOrphanedRun]);

        const processor = createCleanupProcessor({
          db: mockDb,
          logger: mockLogger,
          runTimeoutMs: 10 * 60 * 1000, // 10 minutes
        });

        const result = await processor(mockJob);

        expect(mockRunRepository.findOrphanedRuns).toHaveBeenCalledWith(10 * 60 * 1000);
        expect(mockRunRepository.update).toHaveBeenCalledWith('run-123', {
          status: 'failed',
          errorMessage: 'Run timed out or was orphaned (worker/API restart)',
          completedAt: expect.any(Date),
        });
        expect(result).toEqual({
          cleanupType: 'orphaned-runs',
          itemsProcessed: 1,
          itemsDeleted: 1,
          errors: [],
        });
      });

      it('should handle no orphaned runs', async () => {
        mockRunRepository.findOrphanedRuns.mockResolvedValue([]);

        const processor = createCleanupProcessor({
          db: mockDb,
          logger: mockLogger,
        });

        const result = await processor(mockJob);

        expect(result).toEqual({
          cleanupType: 'orphaned-runs',
          itemsProcessed: 0,
          itemsDeleted: 0,
          errors: [],
        });
      });

      it('should handle multiple orphaned runs', async () => {
        const runs = [
          { id: 'run-1', userId: 'user-1', status: 'running', startedAt: new Date() },
          { id: 'run-2', userId: 'user-2', status: 'running', startedAt: new Date() },
          { id: 'run-3', userId: 'user-3', status: 'running', startedAt: new Date() },
        ];
        mockRunRepository.findOrphanedRuns.mockResolvedValue(runs);

        const processor = createCleanupProcessor({
          db: mockDb,
          logger: mockLogger,
        });

        const result = await processor(mockJob);

        expect(mockRunRepository.update).toHaveBeenCalledTimes(3);
        expect(result.itemsProcessed).toBe(3);
        expect(result.itemsDeleted).toBe(3);
      });

      it('should continue processing if one run fails to update', async () => {
        const runs = [
          { id: 'run-1', userId: 'user-1', status: 'running', startedAt: new Date() },
          { id: 'run-2', userId: 'user-2', status: 'running', startedAt: new Date() },
        ];
        mockRunRepository.findOrphanedRuns.mockResolvedValue(runs);
        mockRunRepository.update
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(new Error('DB error'));

        const processor = createCleanupProcessor({
          db: mockDb,
          logger: mockLogger,
        });

        const result = await processor(mockJob);

        expect(mockRunRepository.update).toHaveBeenCalledTimes(2);
        expect(result.itemsProcessed).toBe(2);
        expect(result.itemsDeleted).toBe(1); // Only first one succeeded
      });
    });

    describe('old-videos cleanup', () => {
      beforeEach(() => {
        mockJob.data.cleanupType = 'old-videos';
      });

      it('should skip if video storage path does not exist', async () => {
        (fs.access as any).mockRejectedValue(new Error('ENOENT'));

        const processor = createCleanupProcessor({
          db: mockDb,
          logger: mockLogger,
          videoStoragePath: '/path/to/videos',
        });

        const result = await processor(mockJob);

        expect(result).toEqual({
          cleanupType: 'old-videos',
          itemsProcessed: 0,
          itemsDeleted: 0,
          errors: [],
        });
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Video storage path does not exist, skipping cleanup',
          expect.any(Object)
        );
      });

      it('should delete old video files', async () => {
        (fs.access as any).mockResolvedValue(undefined);
        (fs.readdir as any).mockResolvedValue([
          { name: 'run-123.webm', isFile: () => true },
          { name: 'run-456.webm', isFile: () => true },
        ]);
        // Make files old (31 days old)
        (fs.stat as any).mockResolvedValue({
          mtimeMs: Date.now() - 31 * 24 * 60 * 60 * 1000,
        });
        (fs.unlink as any).mockResolvedValue(undefined);

        const processor = createCleanupProcessor({
          db: mockDb,
          logger: mockLogger,
          videoStoragePath: '/path/to/videos',
          videoRetentionDays: 30,
        });

        const result = await processor(mockJob);

        expect(fs.unlink).toHaveBeenCalledTimes(2);
        expect(result.itemsProcessed).toBe(2);
        expect(result.itemsDeleted).toBe(2);
      });

      it('should not delete recent video files', async () => {
        (fs.access as any).mockResolvedValue(undefined);
        (fs.readdir as any).mockResolvedValue([{ name: 'run-123.webm', isFile: () => true }]);
        // Make file recent (1 day old)
        (fs.stat as any).mockResolvedValue({
          mtimeMs: Date.now() - 1 * 24 * 60 * 60 * 1000,
        });

        const processor = createCleanupProcessor({
          db: mockDb,
          logger: mockLogger,
          videoStoragePath: '/path/to/videos',
          videoRetentionDays: 30,
        });

        const result = await processor(mockJob);

        expect(fs.unlink).not.toHaveBeenCalled();
        expect(result.itemsDeleted).toBe(0);
      });

      it('should skip non-video files', async () => {
        (fs.access as any).mockResolvedValue(undefined);
        (fs.readdir as any).mockResolvedValue([
          { name: 'readme.txt', isFile: () => true },
          { name: 'logs', isFile: () => false }, // directory
          { name: 'run-123.webm', isFile: () => true },
        ]);
        (fs.stat as any).mockResolvedValue({
          mtimeMs: Date.now() - 31 * 24 * 60 * 60 * 1000,
        });
        (fs.unlink as any).mockResolvedValue(undefined);

        const processor = createCleanupProcessor({
          db: mockDb,
          logger: mockLogger,
          videoStoragePath: '/path/to/videos',
        });

        const result = await processor(mockJob);

        // Only the .webm file should be processed
        expect(result.itemsProcessed).toBe(1);
        expect(fs.unlink).toHaveBeenCalledTimes(1);
      });

      it('should not delete video if run is still active', async () => {
        (fs.access as any).mockResolvedValue(undefined);
        (fs.readdir as any).mockResolvedValue([
          { name: 'run-active-123.webm', isFile: () => true },
        ]);
        (fs.stat as any).mockResolvedValue({
          mtimeMs: Date.now() - 31 * 24 * 60 * 60 * 1000,
        });
        // Run is still active
        mockRunRepository.findById.mockResolvedValue({
          id: 'active-123',
          status: 'running',
        });

        const processor = createCleanupProcessor({
          db: mockDb,
          logger: mockLogger,
          videoStoragePath: '/path/to/videos',
        });

        const result = await processor(mockJob);

        expect(fs.unlink).not.toHaveBeenCalled();
        expect(result.itemsDeleted).toBe(0);
      });

      it('should use maxAgeDays from job data if provided', async () => {
        mockJob.data.maxAgeDays = 7;
        (fs.access as any).mockResolvedValue(undefined);
        (fs.readdir as any).mockResolvedValue([{ name: 'run-123.webm', isFile: () => true }]);
        // File is 10 days old (older than 7 days)
        (fs.stat as any).mockResolvedValue({
          mtimeMs: Date.now() - 10 * 24 * 60 * 60 * 1000,
        });
        (fs.unlink as any).mockResolvedValue(undefined);

        const processor = createCleanupProcessor({
          db: mockDb,
          logger: mockLogger,
          videoStoragePath: '/path/to/videos',
          videoRetentionDays: 30, // Default is 30, but job specifies 7
        });

        const result = await processor(mockJob);

        expect(fs.unlink).toHaveBeenCalled();
        expect(result.itemsDeleted).toBe(1);
      });

      it('should handle file deletion errors', async () => {
        (fs.access as any).mockResolvedValue(undefined);
        (fs.readdir as any).mockResolvedValue([{ name: 'run-123.webm', isFile: () => true }]);
        (fs.stat as any).mockResolvedValue({
          mtimeMs: Date.now() - 31 * 24 * 60 * 60 * 1000,
        });
        (fs.unlink as any).mockRejectedValue(new Error('Permission denied'));

        const processor = createCleanupProcessor({
          db: mockDb,
          logger: mockLogger,
          videoStoragePath: '/path/to/videos',
        });

        const result = await processor(mockJob);

        expect(result.itemsDeleted).toBe(0);
        expect(result.errors.length).toBe(1);
        expect(result.errors[0]).toContain('Permission denied');
      });
    });

    describe('old-screenshots cleanup', () => {
      beforeEach(() => {
        mockJob.data.cleanupType = 'old-screenshots';
      });

      it('should skip if screenshot storage path does not exist', async () => {
        (fs.access as any).mockRejectedValue(new Error('ENOENT'));

        const processor = createCleanupProcessor({
          db: mockDb,
          logger: mockLogger,
          screenshotStoragePath: '/path/to/screenshots',
        });

        const result = await processor(mockJob);

        expect(result).toEqual({
          cleanupType: 'old-screenshots',
          itemsProcessed: 0,
          itemsDeleted: 0,
          errors: [],
        });
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Screenshot storage path does not exist, skipping cleanup',
          expect.any(Object)
        );
      });

      it('should delete old screenshot files (png)', async () => {
        (fs.access as any).mockResolvedValue(undefined);
        (fs.readdir as any).mockResolvedValue([
          { name: 'run-123-1.png', isFile: () => true },
          { name: 'run-456-2.png', isFile: () => true },
        ]);
        // Make files old (31 days old)
        (fs.stat as any).mockResolvedValue({
          mtimeMs: Date.now() - 31 * 24 * 60 * 60 * 1000,
        });
        (fs.unlink as any).mockResolvedValue(undefined);

        const processor = createCleanupProcessor({
          db: mockDb,
          logger: mockLogger,
          screenshotStoragePath: '/path/to/screenshots',
          screenshotRetentionDays: 30,
        });

        const result = await processor(mockJob);

        expect(fs.unlink).toHaveBeenCalledTimes(2);
        expect(result.itemsProcessed).toBe(2);
        expect(result.itemsDeleted).toBe(2);
      });

      it('should delete old screenshot files (jpg and jpeg)', async () => {
        (fs.access as any).mockResolvedValue(undefined);
        (fs.readdir as any).mockResolvedValue([
          { name: 'run-123.jpg', isFile: () => true },
          { name: 'run-456.jpeg', isFile: () => true },
        ]);
        (fs.stat as any).mockResolvedValue({
          mtimeMs: Date.now() - 31 * 24 * 60 * 60 * 1000,
        });
        (fs.unlink as any).mockResolvedValue(undefined);

        const processor = createCleanupProcessor({
          db: mockDb,
          logger: mockLogger,
          screenshotStoragePath: '/path/to/screenshots',
          screenshotRetentionDays: 30,
        });

        const result = await processor(mockJob);

        expect(fs.unlink).toHaveBeenCalledTimes(2);
        expect(result.itemsProcessed).toBe(2);
        expect(result.itemsDeleted).toBe(2);
      });

      it('should not delete recent screenshot files', async () => {
        (fs.access as any).mockResolvedValue(undefined);
        (fs.readdir as any).mockResolvedValue([{ name: 'run-123.png', isFile: () => true }]);
        // Make file recent (1 day old)
        (fs.stat as any).mockResolvedValue({
          mtimeMs: Date.now() - 1 * 24 * 60 * 60 * 1000,
        });

        const processor = createCleanupProcessor({
          db: mockDb,
          logger: mockLogger,
          screenshotStoragePath: '/path/to/screenshots',
          screenshotRetentionDays: 30,
        });

        const result = await processor(mockJob);

        expect(fs.unlink).not.toHaveBeenCalled();
        expect(result.itemsDeleted).toBe(0);
      });

      it('should skip non-screenshot files', async () => {
        (fs.access as any).mockResolvedValue(undefined);
        (fs.readdir as any).mockResolvedValue([
          { name: 'readme.txt', isFile: () => true },
          { name: 'thumbnails', isFile: () => false }, // directory
          { name: 'run-123.png', isFile: () => true },
        ]);
        (fs.stat as any).mockResolvedValue({
          mtimeMs: Date.now() - 31 * 24 * 60 * 60 * 1000,
        });
        (fs.unlink as any).mockResolvedValue(undefined);

        const processor = createCleanupProcessor({
          db: mockDb,
          logger: mockLogger,
          screenshotStoragePath: '/path/to/screenshots',
        });

        const result = await processor(mockJob);

        // Only the .png file should be processed
        expect(result.itemsProcessed).toBe(1);
        expect(fs.unlink).toHaveBeenCalledTimes(1);
      });

      it('should not delete screenshot if run is still active', async () => {
        (fs.access as any).mockResolvedValue(undefined);
        (fs.readdir as any).mockResolvedValue([
          { name: 'run-active-123-1.png', isFile: () => true },
        ]);
        (fs.stat as any).mockResolvedValue({
          mtimeMs: Date.now() - 31 * 24 * 60 * 60 * 1000,
        });
        // Run is still active
        mockRunRepository.findById.mockResolvedValue({
          id: 'active-123',
          status: 'running',
        });

        const processor = createCleanupProcessor({
          db: mockDb,
          logger: mockLogger,
          screenshotStoragePath: '/path/to/screenshots',
        });

        const result = await processor(mockJob);

        expect(fs.unlink).not.toHaveBeenCalled();
        expect(result.itemsDeleted).toBe(0);
      });

      it('should use maxAgeDays from job data if provided', async () => {
        mockJob.data.maxAgeDays = 7;
        (fs.access as any).mockResolvedValue(undefined);
        (fs.readdir as any).mockResolvedValue([{ name: 'run-123.png', isFile: () => true }]);
        // File is 10 days old (older than 7 days)
        (fs.stat as any).mockResolvedValue({
          mtimeMs: Date.now() - 10 * 24 * 60 * 60 * 1000,
        });
        (fs.unlink as any).mockResolvedValue(undefined);

        const processor = createCleanupProcessor({
          db: mockDb,
          logger: mockLogger,
          screenshotStoragePath: '/path/to/screenshots',
          screenshotRetentionDays: 30, // Default is 30, but job specifies 7
        });

        const result = await processor(mockJob);

        expect(fs.unlink).toHaveBeenCalled();
        expect(result.itemsDeleted).toBe(1);
      });

      it('should handle file deletion errors', async () => {
        (fs.access as any).mockResolvedValue(undefined);
        (fs.readdir as any).mockResolvedValue([{ name: 'run-123.png', isFile: () => true }]);
        (fs.stat as any).mockResolvedValue({
          mtimeMs: Date.now() - 31 * 24 * 60 * 60 * 1000,
        });
        (fs.unlink as any).mockRejectedValue(new Error('Permission denied'));

        const processor = createCleanupProcessor({
          db: mockDb,
          logger: mockLogger,
          screenshotStoragePath: '/path/to/screenshots',
        });

        const result = await processor(mockJob);

        expect(result.itemsDeleted).toBe(0);
        expect(result.errors.length).toBe(1);
        expect(result.errors[0]).toContain('Permission denied');
      });
    });

    describe('expired-tokens cleanup', () => {
      it('should skip expired-tokens cleanup (JWT tokens are stateless)', async () => {
        mockJob.data.cleanupType = 'expired-tokens';

        const processor = createCleanupProcessor({
          db: mockDb,
          logger: mockLogger,
        });

        const result = await processor(mockJob);

        expect(result).toEqual({
          cleanupType: 'expired-tokens',
          itemsProcessed: 0,
          itemsDeleted: 0,
          errors: [],
        });
        expect(mockLogger.info).toHaveBeenCalledWith(
          'expired-tokens cleanup skipped (using JWT refresh tokens)',
          expect.any(Object)
        );
      });
    });

    describe('unknown cleanup type', () => {
      it('should handle unknown cleanup type gracefully', async () => {
        mockJob.data.cleanupType = 'unknown-type' as any;

        const processor = createCleanupProcessor({
          db: mockDb,
          logger: mockLogger,
        });

        const result = await processor(mockJob);

        expect(result.errors.length).toBe(1);
        expect(result.errors[0]).toContain('Unknown cleanup type');
      });
    });
  });

  describe('runStartupCleanup', () => {
    it('should clean orphaned runs on startup', async () => {
      mockRunRepository.findOrphanedRuns.mockResolvedValue([
        mockOrphanedRun,
        { ...mockOrphanedRun, id: 'run-456' },
      ]);

      const result = await runStartupCleanup({
        db: mockDb,
        logger: mockLogger,
        runTimeoutMs: 10 * 60 * 1000,
      });

      expect(mockRunRepository.findOrphanedRuns).toHaveBeenCalledWith(10 * 60 * 1000);
      expect(mockRunRepository.update).toHaveBeenCalledTimes(2);
      expect(result.orphanedRunsCleaned).toBe(2);
    });

    it('should use default timeout if not specified', async () => {
      mockRunRepository.findOrphanedRuns.mockResolvedValue([]);

      await runStartupCleanup({
        db: mockDb,
        logger: mockLogger,
      });

      // Default is 10 minutes (600000ms)
      expect(mockRunRepository.findOrphanedRuns).toHaveBeenCalledWith(600000);
    });

    it('should return 0 if no orphaned runs found', async () => {
      mockRunRepository.findOrphanedRuns.mockResolvedValue([]);

      const result = await runStartupCleanup({
        db: mockDb,
        logger: mockLogger,
      });

      expect(result.orphanedRunsCleaned).toBe(0);
    });

    it('should log startup cleanup messages', async () => {
      mockRunRepository.findOrphanedRuns.mockResolvedValue([mockOrphanedRun]);

      await runStartupCleanup({
        db: mockDb,
        logger: mockLogger,
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Running startup cleanup...');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Startup cleanup completed',
        expect.objectContaining({ orphanedRunsCleaned: 1 })
      );
    });
  });
});
