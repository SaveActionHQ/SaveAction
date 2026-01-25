import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { RedisClient, RedisHealthStatus } from '../redis/index.js';

declare module 'fastify' {
  interface FastifyInstance {
    redis: RedisClient;
  }
}

export interface RedisPluginOptions {
  /** Redis URL (default: process.env.REDIS_URL or redis://localhost:6379) */
  url?: string;
  /** Connection timeout in ms (default: 5000) */
  connectTimeout?: number;
  /** Max retries per request (default: 3) */
  maxRetriesPerRequest?: number;
  /** Key prefix (default: 'saveaction:') */
  keyPrefix?: string;
  /** Skip connection on startup (useful for testing) */
  skipConnect?: boolean;
}

/**
 * Fastify plugin that provides Redis client instance.
 * Decorates fastify with `redis` property.
 * Handles connection on startup and graceful shutdown.
 */
async function redisPlugin(app: FastifyInstance, options: RedisPluginOptions): Promise<void> {
  const redisClient = new RedisClient({
    url: options.url ?? process.env.REDIS_URL ?? 'redis://localhost:6379',
    connectTimeout: options.connectTimeout ?? 5000,
    maxRetriesPerRequest: options.maxRetriesPerRequest ?? 3,
    keyPrefix: options.keyPrefix ?? 'saveaction:',
    enableAutoReconnect: true,
    enableReadyCheck: true,
    name: 'fastify-redis',
  });

  // Connect unless skipped (e.g., in tests)
  if (!options.skipConnect) {
    try {
      await redisClient.connect();
      app.log.info('Redis connected successfully');
    } catch (err) {
      app.log.error({ err }, 'Failed to connect to Redis');
      throw err;
    }
  }

  // Decorate fastify instance with redis client
  app.decorate('redis', redisClient);

  // Graceful shutdown
  app.addHook('onClose', async () => {
    app.log.info('Closing Redis connection...');
    await redisClient.disconnect();
    app.log.info('Redis connection closed');
  });
}

/**
 * Check Redis health status.
 * Can be called directly or used in health check endpoint.
 */
export async function checkRedisHealth(redis: RedisClient): Promise<RedisHealthStatus> {
  return redis.healthCheck();
}

// Use fastify-plugin to break encapsulation (global plugin)
export const redisConnectionPlugin = fp(redisPlugin, {
  name: 'redis',
  dependencies: [],
});
