import Redis, { RedisOptions } from 'ioredis';

/**
 * Redis connection state for health checks.
 */
export type RedisConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * Redis client configuration options.
 */
export interface RedisClientOptions {
  /** Redis URL (redis://host:port or redis://user:password@host:port/db) */
  url?: string;
  /** Connection timeout in milliseconds (default: 5000) */
  connectTimeout?: number;
  /** Max retries per request (default: 3) */
  maxRetriesPerRequest?: number;
  /** Enable auto-reconnect (default: true) */
  enableAutoReconnect?: boolean;
  /** Retry strategy: time in ms to wait before retry (default: exponential backoff) */
  retryDelayMs?: number;
  /** Key prefix for all keys (default: 'saveaction:') */
  keyPrefix?: string;
  /** Enable ready check on connection (default: true) */
  enableReadyCheck?: boolean;
  /** Name for this client (used in logging) */
  name?: string;
}

/**
 * Redis health check result.
 */
export interface RedisHealthStatus {
  status: 'healthy' | 'unhealthy';
  latencyMs?: number;
  error?: string;
  connectionState: RedisConnectionState;
}

/**
 * Redis client wrapper with connection pooling, health checks, and graceful shutdown.
 * Uses ioredis for the underlying Redis connection.
 */
export class RedisClient {
  private client: Redis | null = null;
  private readonly options: Required<RedisClientOptions>;
  private connectionState: RedisConnectionState = 'disconnected';
  private lastError: Error | null = null;

  constructor(options: RedisClientOptions = {}) {
    this.options = {
      url: options.url ?? 'redis://localhost:6379',
      connectTimeout: options.connectTimeout ?? 5000,
      maxRetriesPerRequest: options.maxRetriesPerRequest ?? 3,
      enableAutoReconnect: options.enableAutoReconnect ?? true,
      retryDelayMs: options.retryDelayMs ?? 1000,
      keyPrefix: options.keyPrefix ?? 'saveaction:',
      enableReadyCheck: options.enableReadyCheck ?? true,
      name: options.name ?? 'default',
    };
  }

  /**
   * Connect to Redis server.
   * Returns the connected client instance.
   */
  async connect(): Promise<Redis> {
    if (this.client && this.connectionState === 'connected') {
      return this.client;
    }

    const redisOptions: RedisOptions = {
      connectTimeout: this.options.connectTimeout,
      maxRetriesPerRequest: this.options.maxRetriesPerRequest,
      keyPrefix: this.options.keyPrefix,
      enableReadyCheck: this.options.enableReadyCheck,
      retryStrategy: this.options.enableAutoReconnect
        ? (times: number) => {
            // Exponential backoff with max 30 seconds
            const delay = Math.min(times * this.options.retryDelayMs, 30000);
            return delay;
          }
        : () => null, // Disable retries
      lazyConnect: true, // Don't connect immediately
    };

    this.connectionState = 'connecting';
    this.client = new Redis(this.options.url, redisOptions);

    // Set up event handlers
    this.setupEventHandlers();

    // Actually connect
    await this.client.connect();

    return this.client;
  }

  /**
   * Setup event handlers for connection state tracking.
   */
  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('connect', () => {
      this.connectionState = 'connected';
      this.lastError = null;
    });

    this.client.on('ready', () => {
      this.connectionState = 'connected';
      this.lastError = null;
    });

    this.client.on('error', (err: Error) => {
      this.connectionState = 'error';
      this.lastError = err;
    });

    this.client.on('close', () => {
      this.connectionState = 'disconnected';
    });

    this.client.on('reconnecting', () => {
      this.connectionState = 'connecting';
    });

    this.client.on('end', () => {
      this.connectionState = 'disconnected';
    });
  }

  /**
   * Get the underlying ioredis client.
   * Throws if not connected.
   */
  getClient(): Redis {
    if (!this.client || this.connectionState !== 'connected') {
      throw new Error('Redis client is not connected. Call connect() first.');
    }
    return this.client;
  }

  /**
   * Get current connection state.
   */
  getConnectionState(): RedisConnectionState {
    return this.connectionState;
  }

  /**
   * Check if Redis is healthy by sending a PING command.
   * Returns health status with latency.
   */
  async healthCheck(): Promise<RedisHealthStatus> {
    if (!this.client || this.connectionState !== 'connected') {
      return {
        status: 'unhealthy',
        error: this.lastError?.message ?? 'Not connected',
        connectionState: this.connectionState,
      };
    }

    try {
      const start = Date.now();
      const pong = await this.client.ping();
      const latencyMs = Date.now() - start;

      if (pong === 'PONG') {
        return {
          status: 'healthy',
          latencyMs,
          connectionState: this.connectionState,
        };
      }

      return {
        status: 'unhealthy',
        error: `Unexpected PING response: ${pong}`,
        connectionState: this.connectionState,
      };
    } catch (err) {
      return {
        status: 'unhealthy',
        error: err instanceof Error ? err.message : 'Unknown error',
        connectionState: this.connectionState,
      };
    }
  }

  /**
   * Check if client is connected and ready.
   */
  isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  /**
   * Gracefully disconnect from Redis.
   * Waits for pending commands to complete.
   */
  async disconnect(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      await this.client.quit();
    } catch {
      // If quit fails, force disconnect
      this.client.disconnect();
    } finally {
      this.client = null;
      this.connectionState = 'disconnected';
    }
  }

  /**
   * Force disconnect without waiting for pending commands.
   */
  forceDisconnect(): void {
    if (this.client) {
      this.client.disconnect();
      this.client = null;
      this.connectionState = 'disconnected';
    }
  }

  // ========================================
  // Convenience methods for common operations
  // ========================================

  /**
   * Set a value with optional expiration.
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<'OK'> {
    const client = this.getClient();
    if (ttlSeconds) {
      return client.setex(key, ttlSeconds, value);
    }
    return client.set(key, value);
  }

  /**
   * Get a value by key.
   */
  async get(key: string): Promise<string | null> {
    return this.getClient().get(key);
  }

  /**
   * Delete one or more keys.
   */
  async del(...keys: string[]): Promise<number> {
    return this.getClient().del(...keys);
  }

  /**
   * Check if a key exists.
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.getClient().exists(key);
    return result === 1;
  }

  /**
   * Set expiration on a key.
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    const result = await this.getClient().expire(key, seconds);
    return result === 1;
  }

  /**
   * Get remaining TTL for a key.
   */
  async ttl(key: string): Promise<number> {
    return this.getClient().ttl(key);
  }

  /**
   * Increment a numeric value.
   */
  async incr(key: string): Promise<number> {
    return this.getClient().incr(key);
  }

  /**
   * Increment by a specific amount.
   */
  async incrBy(key: string, increment: number): Promise<number> {
    return this.getClient().incrby(key, increment);
  }

  /**
   * Set hash field.
   */
  async hset(key: string, field: string, value: string): Promise<number> {
    return this.getClient().hset(key, field, value);
  }

  /**
   * Get hash field.
   */
  async hget(key: string, field: string): Promise<string | null> {
    return this.getClient().hget(key, field);
  }

  /**
   * Get all hash fields.
   */
  async hgetall(key: string): Promise<Record<string, string>> {
    return this.getClient().hgetall(key);
  }

  /**
   * Add member to set.
   */
  async sadd(key: string, ...members: string[]): Promise<number> {
    return this.getClient().sadd(key, ...members);
  }

  /**
   * Get all set members.
   */
  async smembers(key: string): Promise<string[]> {
    return this.getClient().smembers(key);
  }

  /**
   * Check if member exists in set.
   */
  async sismember(key: string, member: string): Promise<boolean> {
    const result = await this.getClient().sismember(key, member);
    return result === 1;
  }

  /**
   * Publish message to channel (pub/sub).
   */
  async publish(channel: string, message: string): Promise<number> {
    return this.getClient().publish(channel, message);
  }
}
