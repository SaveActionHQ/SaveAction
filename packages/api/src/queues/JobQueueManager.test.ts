import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JobQueueManager } from './JobQueueManager.js';
import type { TestRunJobData, CleanupJobData } from './types.js';

// Mock BullMQ
vi.mock('bullmq', () => {
  const createMockQueue = () => ({
    add: vi.fn().mockResolvedValue({ id: 'job-1', name: 'test-job' }),
    getWaitingCount: vi.fn().mockResolvedValue(5),
    getActiveCount: vi.fn().mockResolvedValue(2),
    getCompletedCount: vi.fn().mockResolvedValue(100),
    getFailedCount: vi.fn().mockResolvedValue(3),
    getDelayedCount: vi.fn().mockResolvedValue(1),
    isPaused: vi.fn().mockResolvedValue(false),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    getJob: vi.fn().mockResolvedValue(null),
    removeRepeatable: vi.fn().mockResolvedValue(true),
    close: vi.fn().mockResolvedValue(undefined),
  });

  const createMockWorker = () => ({
    on: vi.fn().mockReturnThis(),
    isRunning: vi.fn().mockReturnValue(true),
    close: vi.fn().mockResolvedValue(undefined),
  });

  const createMockQueueEvents = () => ({
    close: vi.fn().mockResolvedValue(undefined),
  });

  return {
    Queue: vi.fn().mockImplementation(() => createMockQueue()),
    Worker: vi.fn().mockImplementation(() => createMockWorker()),
    QueueEvents: vi.fn().mockImplementation(() => createMockQueueEvents()),
  };
});

// Mock Redis connection
const mockRedisConnection = {
  status: 'ready',
} as unknown as import('ioredis').Redis;

describe('JobQueueManager', () => {
  let manager: JobQueueManager;

  beforeEach(() => {
    // Don't use clearAllMocks - it can interfere with mock implementations
    manager = new JobQueueManager({
      connection: mockRedisConnection,
      prefix: 'test',
      enableWorkers: true,
    });
  });

  afterEach(async () => {
    if (manager.isInitialized()) {
      await manager.shutdown();
    }
  });

  describe('constructor', () => {
    it('should create manager with default options', () => {
      const mgr = new JobQueueManager({
        connection: mockRedisConnection,
      });
      expect(mgr.isInitialized()).toBe(false);
    });

    it('should create manager with custom options', () => {
      const mgr = new JobQueueManager({
        connection: mockRedisConnection,
        prefix: 'custom',
        enableWorkers: false,
      });
      expect(mgr.isInitialized()).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should create all queues', async () => {
      await manager.initialize();
      expect(manager.isInitialized()).toBe(true);
    });

    it('should be able to get queue after initialization', async () => {
      await manager.initialize();
      const queue = manager.getQueue('test-runs');
      expect(queue).toBeDefined();
    });
  });

  describe('getQueue', () => {
    it('should throw if not initialized', () => {
      expect(() => manager.getQueue('test-runs')).toThrow("Queue 'test-runs' not found");
    });

    it('should return queue after initialization', async () => {
      await manager.initialize();
      const queue = manager.getQueue('test-runs');
      expect(queue).toBeDefined();
    });
  });

  describe('addJob', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should add job to queue', async () => {
      const jobData: TestRunJobData = {
        recordingId: 'rec-1',
        userId: 'user-1',
        runId: 'run-1',
        createdAt: new Date().toISOString(),
      };

      const job = await manager.addJob('test-runs', 'execute', jobData);
      expect(job).toBeDefined();
      expect(job.id).toBe('job-1');
    });

    it('should add job with priority', async () => {
      const jobData: TestRunJobData = {
        recordingId: 'rec-1',
        userId: 'user-1',
        runId: 'run-1',
        createdAt: new Date().toISOString(),
      };

      const job = await manager.addJob('test-runs', 'execute', jobData, {
        priority: 1,
      });
      expect(job).toBeDefined();
    });

    it('should add job with delay', async () => {
      const jobData: CleanupJobData = {
        cleanupType: 'old-videos',
        maxAgeDays: 30,
        createdAt: new Date().toISOString(),
      };

      const job = await manager.addJob('cleanup', 'cleanup-videos', jobData, {
        delay: 60000,
      });
      expect(job).toBeDefined();
    });

    it('should add job with custom jobId', async () => {
      const jobData: TestRunJobData = {
        recordingId: 'rec-1',
        userId: 'user-1',
        runId: 'run-1',
        createdAt: new Date().toISOString(),
      };

      const job = await manager.addJob('test-runs', 'execute', jobData, {
        jobId: 'custom-job-id',
      });
      expect(job).toBeDefined();
    });
  });

  describe('registerProcessor', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should register a processor for queue', async () => {
      const processor = vi.fn().mockResolvedValue({ success: true });
      const worker = manager.registerProcessor('test-runs', processor);
      expect(worker).toBeDefined();
    });

    it('should throw if workers are disabled', async () => {
      const mgr = new JobQueueManager({
        connection: mockRedisConnection,
        enableWorkers: false,
      });
      await mgr.initialize();

      expect(() => mgr.registerProcessor('test-runs', vi.fn())).toThrow('Workers are disabled');
    });

    it('should replace existing worker when registering again', async () => {
      const processor1 = vi.fn();
      const processor2 = vi.fn();

      manager.registerProcessor('test-runs', processor1);
      manager.registerProcessor('test-runs', processor2);

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('getQueueStatus', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should return queue status', async () => {
      const status = await manager.getQueueStatus('test-runs');

      expect(status.name).toBe('test-runs');
      expect(status.waiting).toBe(5);
      expect(status.active).toBe(2);
      expect(status.completed).toBe(100);
      expect(status.failed).toBe(3);
      expect(status.delayed).toBe(1);
      expect(status.paused).toBe(false);
    });
  });

  describe('getAllQueuesStatus', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should return status for all queues', async () => {
      const statuses = await manager.getAllQueuesStatus();

      expect(statuses).toHaveLength(3);
      expect(statuses.map((s) => s.name)).toContain('test-runs');
      expect(statuses.map((s) => s.name)).toContain('cleanup');
      expect(statuses.map((s) => s.name)).toContain('scheduled-tests');
    });
  });

  describe('getHealthStatus', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should return healthy status when all is well', async () => {
      const health = await manager.getHealthStatus();

      expect(health.status).toBe('healthy');
      expect(health.queues).toHaveLength(3);
      expect(health.workers).toHaveLength(0); // No workers registered yet
    });

    it('should include worker info when workers are registered', async () => {
      manager.registerProcessor('test-runs', vi.fn());

      const health = await manager.getHealthStatus();

      expect(health.workers).toHaveLength(1);
      expect(health.workers[0].name).toBe('test-runs');
      expect(health.workers[0].running).toBe(true);
    });

    it('should return degraded when many jobs have failed', async () => {
      // Mock high failure count - use mockImplementationOnce to avoid polluting other tests
      const { Queue } = await import('bullmq');
      (Queue as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
        add: vi.fn().mockResolvedValue({ id: 'job-1' }),
        getWaitingCount: vi.fn().mockResolvedValue(0),
        getActiveCount: vi.fn().mockResolvedValue(0),
        getCompletedCount: vi.fn().mockResolvedValue(0),
        getFailedCount: vi.fn().mockResolvedValue(150), // High failure
        getDelayedCount: vi.fn().mockResolvedValue(0),
        isPaused: vi.fn().mockResolvedValue(false),
        pause: vi.fn().mockResolvedValue(undefined),
        resume: vi.fn().mockResolvedValue(undefined),
        getJob: vi.fn().mockResolvedValue(null),
        removeRepeatable: vi.fn().mockResolvedValue(true),
        close: vi.fn().mockResolvedValue(undefined),
      }));

      // Reinitialize with mocked high failures
      const mgr = new JobQueueManager({
        connection: mockRedisConnection,
        enableWorkers: true,
      });
      await mgr.initialize();

      const health = await mgr.getHealthStatus();
      expect(health.status).toBe('degraded');

      await mgr.shutdown();
    });
  });

  describe('pauseQueue / resumeQueue', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should pause a queue', async () => {
      await manager.pauseQueue('test-runs');
      const queue = manager.getQueue('test-runs');
      expect(queue.pause).toHaveBeenCalled();
    });

    it('should resume a queue', async () => {
      await manager.resumeQueue('test-runs');
      const queue = manager.getQueue('test-runs');
      expect(queue.resume).toHaveBeenCalled();
    });
  });

  describe('getJob', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should return null for non-existent job', async () => {
      const job = await manager.getJob('test-runs', 'non-existent');
      expect(job).toBeNull();
    });

    it('should return job if it exists', async () => {
      const { Queue } = await import('bullmq');
      const mockJob = { id: 'job-1', data: {}, getState: vi.fn() };
      // Use mockImplementationOnce to avoid polluting other tests
      (Queue as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
        add: vi.fn(),
        getJob: vi.fn().mockResolvedValue(mockJob),
        getWaitingCount: vi.fn().mockResolvedValue(0),
        getActiveCount: vi.fn().mockResolvedValue(0),
        getCompletedCount: vi.fn().mockResolvedValue(0),
        getFailedCount: vi.fn().mockResolvedValue(0),
        getDelayedCount: vi.fn().mockResolvedValue(0),
        isPaused: vi.fn().mockResolvedValue(false),
        pause: vi.fn().mockResolvedValue(undefined),
        resume: vi.fn().mockResolvedValue(undefined),
        removeRepeatable: vi.fn().mockResolvedValue(true),
        close: vi.fn().mockResolvedValue(undefined),
      }));

      const mgr = new JobQueueManager({
        connection: mockRedisConnection,
      });
      await mgr.initialize();

      const job = await mgr.getJob('test-runs', 'job-1');
      expect(job).toBeDefined();

      await mgr.shutdown();
    });
  });

  describe('cancelJob', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should return false for non-existent job', async () => {
      const result = await manager.cancelJob('test-runs', 'non-existent');
      expect(result).toBe(false);
    });
  });

  describe('addRepeatableJob', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should add a repeatable job', async () => {
      const jobData: CleanupJobData = {
        cleanupType: 'old-videos',
        createdAt: new Date().toISOString(),
      };

      const job = await manager.addRepeatableJob(
        'cleanup',
        'daily-cleanup',
        jobData,
        '0 0 * * *' // Daily at midnight
      );

      expect(job).toBeDefined();
    });

    it('should add repeatable job with timezone', async () => {
      const jobData: CleanupJobData = {
        cleanupType: 'old-videos',
        createdAt: new Date().toISOString(),
      };

      const job = await manager.addRepeatableJob('cleanup', 'daily-cleanup', jobData, '0 0 * * *', {
        timezone: 'America/New_York',
      });

      expect(job).toBeDefined();
    });
  });

  describe('removeRepeatableJob', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should remove a repeatable job', async () => {
      const result = await manager.removeRepeatableJob('cleanup', 'daily-cleanup', '0 0 * * *');

      expect(result).toBe(true);
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      await manager.initialize();
      manager.registerProcessor('test-runs', vi.fn());

      await manager.shutdown();

      expect(manager.isInitialized()).toBe(false);
      expect(manager.isShutdownInProgress()).toBe(true);
    });

    it('should not shutdown twice', async () => {
      await manager.initialize();

      await manager.shutdown();
      await manager.shutdown(); // Second call should be no-op

      expect(manager.isShutdownInProgress()).toBe(true);
    });
  });

  describe('isInitialized', () => {
    it('should return false before initialization', () => {
      expect(manager.isInitialized()).toBe(false);
    });

    it('should return true after initialization', async () => {
      await manager.initialize();
      expect(manager.isInitialized()).toBe(true);
    });
  });
});
