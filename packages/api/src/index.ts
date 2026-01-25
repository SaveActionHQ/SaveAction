// App factory for building Fastify instance
export { buildApp } from './app.js';
export type { AppOptions } from './app.js';

// Configuration
export { getEnv, parseEnv, validateProductionEnv } from './config/index.js';
export type { Env } from './config/index.js';

// Errors
export { ApiError, Errors } from './errors/index.js';
export type { ApiErrorResponse } from './errors/index.js';

// Redis
export { RedisClient } from './redis/index.js';
export type { RedisClientOptions, RedisConnectionState, RedisHealthStatus } from './redis/index.js';

// Queues
export { JobQueueManager, QUEUE_CONFIGS } from './queues/index.js';
export type {
  JobQueueManagerOptions,
  QueueName,
  BaseJobData,
  TestRunJobData,
  CleanupJobData,
  ScheduledTestJobData,
  QueueStatus,
  QueueHealthStatus,
  JobProcessor,
} from './queues/index.js';

// Plugins
export { redisConnectionPlugin, checkRedisHealth } from './plugins/index.js';
export { bullmqConnectionPlugin, checkQueueHealth } from './plugins/index.js';
export type { RedisPluginOptions, BullMQPluginOptions } from './plugins/index.js';
