import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import type { Redis } from 'ioredis';
import {
  type QueueName,
  type QueueStatus,
  type QueueHealthStatus,
  type BaseJobData,
  type JobProcessor,
  QUEUE_CONFIGS,
} from './types.js';

/**
 * Options for JobQueueManager initialization.
 */
export interface JobQueueManagerOptions {
  /** Redis connection (from ioredis) */
  connection: Redis;
  /** Queue prefix (default: 'saveaction') */
  prefix?: string;
  /** Enable workers (set false for read-only access) */
  enableWorkers?: boolean;
}

/**
 * Manages all BullMQ queues and workers.
 * Provides a unified interface for adding jobs, registering processors,
 * and monitoring queue health.
 */
export class JobQueueManager {
  private readonly queues: Map<QueueName, Queue> = new Map();
  private readonly workers: Map<QueueName, Worker> = new Map();
  private readonly queueEvents: Map<QueueName, QueueEvents> = new Map();
  private readonly connection: Redis;
  private readonly prefix: string;
  private readonly enableWorkers: boolean;
  private isShuttingDown = false;

  constructor(options: JobQueueManagerOptions) {
    this.connection = options.connection;
    this.prefix = options.prefix ?? 'saveaction';
    this.enableWorkers = options.enableWorkers ?? true;
  }

  /**
   * Initialize all queues.
   * Call this before using any queue operations.
   */
  async initialize(): Promise<void> {
    const queueNames: QueueName[] = ['test-runs', 'cleanup', 'scheduled-tests'];

    for (const name of queueNames) {
      await this.createQueue(name);
    }
  }

  /**
   * Create a queue with its configuration.
   */
  private async createQueue(name: QueueName): Promise<Queue> {
    const config = QUEUE_CONFIGS[name];

    const queue = new Queue(name, {
      connection: this.connection,
      prefix: this.prefix,
      defaultJobOptions: config.defaultJobOptions,
      ...config.queueOptions,
    });

    // Create QueueEvents for monitoring
    const events = new QueueEvents(name, {
      connection: this.connection,
      prefix: this.prefix,
    });

    this.queues.set(name, queue);
    this.queueEvents.set(name, events);

    return queue;
  }

  /**
   * Get a queue by name.
   */
  getQueue(name: QueueName): Queue {
    const queue = this.queues.get(name);
    if (!queue) {
      throw new Error(`Queue '${name}' not found. Did you call initialize()?`);
    }
    return queue;
  }

  /**
   * Add a job to a queue.
   */
  async addJob<T extends BaseJobData>(
    queueName: QueueName,
    jobName: string,
    data: T,
    options?: {
      priority?: number;
      delay?: number;
      jobId?: string;
    }
  ): Promise<Job<T>> {
    const queue = this.getQueue(queueName);

    const job = await queue.add(jobName, data, {
      priority: options?.priority,
      delay: options?.delay,
      jobId: options?.jobId,
    });

    return job as Job<T>;
  }

  /**
   * Register a processor for a queue.
   * Creates a worker that processes jobs.
   */
  registerProcessor<T extends BaseJobData, R = unknown>(
    queueName: QueueName,
    processor: JobProcessor<T, R>
  ): Worker<T, R> {
    if (!this.enableWorkers) {
      throw new Error('Workers are disabled. Set enableWorkers: true in options.');
    }

    // Close existing worker if any
    const existingWorker = this.workers.get(queueName);
    if (existingWorker) {
      existingWorker.close();
    }

    const config = QUEUE_CONFIGS[queueName];

    const worker = new Worker<T, R>(
      queueName,
      async (job) => {
        return processor(job);
      },
      {
        connection: this.connection,
        prefix: this.prefix,
        concurrency: config.workerOptions?.concurrency ?? 1,
        ...config.workerOptions,
      }
    );

    // Set up error handling
    worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} in queue '${queueName}' failed:`, err.message);
    });

    worker.on('error', (err) => {
      console.error(`Worker error in queue '${queueName}':`, err.message);
    });

    this.workers.set(queueName, worker as Worker);

    return worker;
  }

  /**
   * Get status for a specific queue.
   */
  async getQueueStatus(name: QueueName): Promise<QueueStatus> {
    const queue = this.getQueue(name);

    const [waiting, active, completed, failed, delayed, isPaused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused(),
    ]);

    return {
      name,
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused: isPaused,
    };
  }

  /**
   * Get status for all queues.
   */
  async getAllQueuesStatus(): Promise<QueueStatus[]> {
    const statuses: QueueStatus[] = [];

    for (const name of this.queues.keys()) {
      const status = await this.getQueueStatus(name);
      statuses.push(status);
    }

    return statuses;
  }

  /**
   * Get overall health status of the queue system.
   */
  async getHealthStatus(): Promise<QueueHealthStatus> {
    const queues = await this.getAllQueuesStatus();

    const workers: QueueHealthStatus['workers'] = [];
    for (const [name, worker] of this.workers) {
      workers.push({
        name,
        running: worker.isRunning(),
        concurrency: QUEUE_CONFIGS[name].workerOptions?.concurrency ?? 1,
      });
    }

    // Determine overall health
    let status: QueueHealthStatus['status'] = 'healthy';

    // Check if any queue has too many failed jobs (> 100 in last period)
    const highFailureQueues = queues.filter((q) => q.failed > 100);
    if (highFailureQueues.length > 0) {
      status = 'degraded';
    }

    // Check if any required worker is not running
    const stoppedWorkers = workers.filter((w) => !w.running);
    if (stoppedWorkers.length > 0 && this.enableWorkers) {
      status = 'unhealthy';
    }

    return {
      status,
      queues,
      workers,
    };
  }

  /**
   * Pause a queue.
   */
  async pauseQueue(name: QueueName): Promise<void> {
    const queue = this.getQueue(name);
    await queue.pause();
  }

  /**
   * Resume a paused queue.
   */
  async resumeQueue(name: QueueName): Promise<void> {
    const queue = this.getQueue(name);
    await queue.resume();
  }

  /**
   * Get a job by ID from a queue.
   */
  async getJob(queueName: QueueName, jobId: string): Promise<Job | null> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);
    return job ?? null;
  }

  /**
   * Cancel a job if it's waiting.
   */
  async cancelJob(queueName: QueueName, jobId: string): Promise<boolean> {
    const job = await this.getJob(queueName, jobId);
    if (!job) return false;

    const state = await job.getState();
    if (state === 'waiting' || state === 'delayed') {
      await job.remove();
      return true;
    }

    return false;
  }

  /**
   * Add a repeatable job (for scheduled tasks).
   */
  async addRepeatableJob<T extends BaseJobData>(
    queueName: QueueName,
    jobName: string,
    data: T,
    pattern: string, // cron pattern
    options?: {
      jobId?: string;
      timezone?: string;
    }
  ): Promise<Job<T>> {
    const queue = this.getQueue(queueName);

    const job = await queue.add(jobName, data, {
      repeat: {
        pattern,
        tz: options?.timezone,
      },
      jobId: options?.jobId,
    });

    return job as Job<T>;
  }

  /**
   * Remove a repeatable job.
   */
  async removeRepeatableJob(
    queueName: QueueName,
    jobName: string,
    pattern: string
  ): Promise<boolean> {
    const queue = this.getQueue(queueName);
    return queue.removeRepeatable(jobName, { pattern });
  }

  /**
   * Gracefully shutdown all queues and workers.
   * Waits for active jobs to complete (with timeout).
   */
  async shutdown(timeoutMs = 30000): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    console.log('Shutting down job queues...');

    // Close workers first (stop processing new jobs)
    const workerClosePromises = Array.from(this.workers.values()).map((worker) => worker.close());

    // Wait for workers to close with timeout
    await Promise.race([
      Promise.all(workerClosePromises),
      new Promise((resolve) => setTimeout(resolve, timeoutMs)),
    ]);

    // Close queue events
    const eventClosePromises = Array.from(this.queueEvents.values()).map((events) =>
      events.close()
    );
    await Promise.all(eventClosePromises);

    // Close queues
    const queueClosePromises = Array.from(this.queues.values()).map((queue) => queue.close());
    await Promise.all(queueClosePromises);

    // Clear maps
    this.workers.clear();
    this.queueEvents.clear();
    this.queues.clear();

    console.log('Job queues shut down successfully');
  }

  /**
   * Check if manager is initialized.
   */
  isInitialized(): boolean {
    return this.queues.size > 0;
  }

  /**
   * Check if shutdown is in progress.
   */
  isShutdownInProgress(): boolean {
    return this.isShuttingDown;
  }
}
