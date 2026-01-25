export { RedisClient } from './RedisClient.js';
export type { RedisClientOptions, RedisConnectionState, RedisHealthStatus } from './RedisClient.js';

// Re-export ioredis types that consumers might need
export type { Redis, RedisOptions } from 'ioredis';
