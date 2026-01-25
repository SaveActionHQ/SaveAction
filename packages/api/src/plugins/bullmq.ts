import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import Redis from 'ioredis';
import { JobQueueManager, type QueueHealthStatus } from '../queues/index.js';
import { getEnv } from '../config/env.js';

declare module 'fastify' {
  interface FastifyInstance {
    queues: JobQueueManager;
  }
}

export interface BullMQPluginOptions {
  /** Skip initialization (useful for testing) */
  skipInit?: boolean;
  /** Enable workers (default: true) */
  enableWorkers?: boolean;
  /** Queue prefix (default: 'saveaction') */
  prefix?: string;
  /** Redis URL override (defaults to REDIS_URL env var) */
  redisUrl?: string;
}

/**
 * Fastify plugin that provides BullMQ job queue manager.
 * Requires Redis plugin to be registered first.
 *
 * Note: BullMQ requires a separate Redis connection without keyPrefix,
 * so we create our own connection here instead of reusing the Redis plugin's client.
 */
async function bullmqPlugin(app: FastifyInstance, options: BullMQPluginOptions): Promise<void> {
  // Ensure Redis plugin is registered (we use it for health checks)
  if (!app.redis) {
    throw new Error('BullMQ plugin requires Redis plugin to be registered first');
  }

  // Verify Redis is connected
  if (!app.redis.isConnected()) {
    throw new Error('Redis is not connected. Cannot initialize BullMQ.');
  }

  // Create a new Redis connection for BullMQ WITHOUT keyPrefix
  // BullMQ manages its own prefixing and doesn't support ioredis keyPrefix
  const env = getEnv();
  const redisUrl = options.redisUrl ?? env.REDIS_URL ?? 'redis://localhost:6379';

  const redisConnection = new Redis(redisUrl, {
    maxRetriesPerRequest: null, // Required by BullMQ for blocking commands
    enableReadyCheck: true,
    // Do NOT set keyPrefix - BullMQ uses its own prefix option
  });

  const queueManager = new JobQueueManager({
    connection: redisConnection,
    prefix: options.prefix ?? 'saveaction',
    enableWorkers: options.enableWorkers ?? true,
  });

  // Initialize queues unless skipped
  if (!options.skipInit) {
    try {
      await queueManager.initialize();
      app.log.info('BullMQ queues initialized successfully');
    } catch (err) {
      app.log.error({ err }, 'Failed to initialize BullMQ queues');
      throw err;
    }
  }

  // Decorate fastify instance
  app.decorate('queues', queueManager);

  // Graceful shutdown
  app.addHook('onClose', async () => {
    app.log.info('Shutting down BullMQ queues...');
    await queueManager.shutdown();
    // Disconnect BullMQ's dedicated Redis connection
    await redisConnection.quit();
    app.log.info('BullMQ queues shut down');
  });
}

/**
 * Check BullMQ health status.
 */
export async function checkQueueHealth(queues: JobQueueManager): Promise<QueueHealthStatus> {
  return queues.getHealthStatus();
}

// Use fastify-plugin to break encapsulation (global plugin)
export const bullmqConnectionPlugin = fp(bullmqPlugin, {
  name: 'bullmq',
  dependencies: ['redis'], // Depends on redis plugin
});
