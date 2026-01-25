import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RedisClient } from './RedisClient.js';

// Mock ioredis
vi.mock('ioredis', () => {
  const mockRedis = vi.fn();
  mockRedis.prototype.connect = vi.fn().mockResolvedValue(undefined);
  mockRedis.prototype.quit = vi.fn().mockResolvedValue('OK');
  mockRedis.prototype.disconnect = vi.fn();
  mockRedis.prototype.ping = vi.fn().mockResolvedValue('PONG');
  mockRedis.prototype.set = vi.fn().mockResolvedValue('OK');
  mockRedis.prototype.setex = vi.fn().mockResolvedValue('OK');
  mockRedis.prototype.get = vi.fn().mockResolvedValue('value');
  mockRedis.prototype.del = vi.fn().mockResolvedValue(1);
  mockRedis.prototype.exists = vi.fn().mockResolvedValue(1);
  mockRedis.prototype.expire = vi.fn().mockResolvedValue(1);
  mockRedis.prototype.ttl = vi.fn().mockResolvedValue(3600);
  mockRedis.prototype.incr = vi.fn().mockResolvedValue(1);
  mockRedis.prototype.incrby = vi.fn().mockResolvedValue(5);
  mockRedis.prototype.hset = vi.fn().mockResolvedValue(1);
  mockRedis.prototype.hget = vi.fn().mockResolvedValue('hashValue');
  mockRedis.prototype.hgetall = vi.fn().mockResolvedValue({ field1: 'value1' });
  mockRedis.prototype.sadd = vi.fn().mockResolvedValue(1);
  mockRedis.prototype.smembers = vi.fn().mockResolvedValue(['member1', 'member2']);
  mockRedis.prototype.sismember = vi.fn().mockResolvedValue(1);
  mockRedis.prototype.publish = vi.fn().mockResolvedValue(1);
  mockRedis.prototype.on = vi.fn();

  return { default: mockRedis };
});

describe('RedisClient', () => {
  let client: RedisClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new RedisClient();
  });

  afterEach(async () => {
    if (client.isConnected()) {
      await client.disconnect();
    }
  });

  describe('constructor', () => {
    it('should use default options when none provided', () => {
      const defaultClient = new RedisClient();
      expect(defaultClient.getConnectionState()).toBe('disconnected');
    });

    it('should accept custom options', () => {
      const customClient = new RedisClient({
        url: 'redis://custom:6380',
        connectTimeout: 10000,
        maxRetriesPerRequest: 5,
        keyPrefix: 'custom:',
        name: 'test-client',
      });
      expect(customClient.getConnectionState()).toBe('disconnected');
    });
  });

  describe('connect', () => {
    it('should connect to Redis successfully', async () => {
      const redisInstance = await client.connect();
      expect(redisInstance).toBeDefined();
      expect(client.getConnectionState()).toBe('connecting'); // State updates via events
    });

    it('should return existing client if already connected', async () => {
      await client.connect();
      // Simulate connected state
      (client as unknown as { connectionState: string }).connectionState = 'connected';

      const secondConnect = await client.connect();
      expect(secondConnect).toBeDefined();
    });
  });

  describe('getClient', () => {
    it('should throw if not connected', () => {
      expect(() => client.getClient()).toThrow('Redis client is not connected');
    });

    it('should return client when connected', async () => {
      await client.connect();
      // Simulate connected state
      (client as unknown as { connectionState: string }).connectionState = 'connected';

      const redisClient = client.getClient();
      expect(redisClient).toBeDefined();
    });
  });

  describe('healthCheck', () => {
    it('should return unhealthy when not connected', async () => {
      const health = await client.healthCheck();
      expect(health.status).toBe('unhealthy');
      expect(health.connectionState).toBe('disconnected');
    });

    it('should return healthy with latency when connected', async () => {
      await client.connect();
      // Simulate connected state
      (client as unknown as { connectionState: string }).connectionState = 'connected';

      const health = await client.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.latencyMs).toBeDefined();
      expect(health.connectionState).toBe('connected');
    });

    it('should return unhealthy if PING returns unexpected value', async () => {
      const { default: MockRedis } = await import('ioredis');
      MockRedis.prototype.ping = vi.fn().mockResolvedValue('WRONG');

      await client.connect();
      (client as unknown as { connectionState: string }).connectionState = 'connected';

      const health = await client.healthCheck();
      expect(health.status).toBe('unhealthy');
      expect(health.error).toContain('Unexpected PING response');
    });

    it('should return unhealthy if PING throws', async () => {
      const { default: MockRedis } = await import('ioredis');
      MockRedis.prototype.ping = vi.fn().mockRejectedValue(new Error('Connection lost'));

      await client.connect();
      (client as unknown as { connectionState: string }).connectionState = 'connected';

      const health = await client.healthCheck();
      expect(health.status).toBe('unhealthy');
      expect(health.error).toBe('Connection lost');
    });
  });

  describe('disconnect', () => {
    it('should gracefully disconnect', async () => {
      await client.connect();
      (client as unknown as { connectionState: string }).connectionState = 'connected';

      await client.disconnect();
      expect(client.getConnectionState()).toBe('disconnected');
    });

    it('should handle disconnect when not connected', async () => {
      await client.disconnect(); // Should not throw
      expect(client.getConnectionState()).toBe('disconnected');
    });

    it('should force disconnect if quit fails', async () => {
      const { default: MockRedis } = await import('ioredis');
      MockRedis.prototype.quit = vi.fn().mockRejectedValue(new Error('Quit failed'));

      await client.connect();
      (client as unknown as { connectionState: string }).connectionState = 'connected';

      await client.disconnect();
      expect(client.getConnectionState()).toBe('disconnected');
    });
  });

  describe('forceDisconnect', () => {
    it('should immediately disconnect', async () => {
      await client.connect();
      (client as unknown as { connectionState: string }).connectionState = 'connected';

      client.forceDisconnect();
      expect(client.getConnectionState()).toBe('disconnected');
    });

    it('should handle force disconnect when not connected', () => {
      client.forceDisconnect(); // Should not throw
      expect(client.getConnectionState()).toBe('disconnected');
    });
  });

  describe('isConnected', () => {
    it('should return false when disconnected', () => {
      expect(client.isConnected()).toBe(false);
    });

    it('should return true when connected', async () => {
      await client.connect();
      (client as unknown as { connectionState: string }).connectionState = 'connected';
      expect(client.isConnected()).toBe(true);
    });
  });

  describe('convenience methods', () => {
    beforeEach(async () => {
      await client.connect();
      (client as unknown as { connectionState: string }).connectionState = 'connected';
    });

    describe('set/get', () => {
      it('should set value without TTL', async () => {
        const result = await client.set('key', 'value');
        expect(result).toBe('OK');
      });

      it('should set value with TTL', async () => {
        const result = await client.set('key', 'value', 3600);
        expect(result).toBe('OK');
      });

      it('should get value', async () => {
        const result = await client.get('key');
        expect(result).toBe('value');
      });
    });

    describe('del', () => {
      it('should delete keys', async () => {
        const result = await client.del('key1', 'key2');
        expect(result).toBe(1);
      });
    });

    describe('exists', () => {
      it('should return true if key exists', async () => {
        const result = await client.exists('key');
        expect(result).toBe(true);
      });

      it('should return false if key does not exist', async () => {
        const { default: MockRedis } = await import('ioredis');
        MockRedis.prototype.exists = vi.fn().mockResolvedValue(0);

        const result = await client.exists('nonexistent');
        expect(result).toBe(false);
      });
    });

    describe('expire', () => {
      it('should set expiration', async () => {
        const result = await client.expire('key', 3600);
        expect(result).toBe(true);
      });

      it('should return false if key does not exist', async () => {
        const { default: MockRedis } = await import('ioredis');
        MockRedis.prototype.expire = vi.fn().mockResolvedValue(0);

        const result = await client.expire('nonexistent', 3600);
        expect(result).toBe(false);
      });
    });

    describe('ttl', () => {
      it('should return TTL in seconds', async () => {
        const result = await client.ttl('key');
        expect(result).toBe(3600);
      });
    });

    describe('incr/incrBy', () => {
      it('should increment value', async () => {
        const result = await client.incr('counter');
        expect(result).toBe(1);
      });

      it('should increment by amount', async () => {
        const result = await client.incrBy('counter', 5);
        expect(result).toBe(5);
      });
    });

    describe('hash operations', () => {
      it('should set hash field', async () => {
        const result = await client.hset('hash', 'field', 'value');
        expect(result).toBe(1);
      });

      it('should get hash field', async () => {
        const result = await client.hget('hash', 'field');
        expect(result).toBe('hashValue');
      });

      it('should get all hash fields', async () => {
        const result = await client.hgetall('hash');
        expect(result).toEqual({ field1: 'value1' });
      });
    });

    describe('set operations', () => {
      it('should add to set', async () => {
        const result = await client.sadd('set', 'member1', 'member2');
        expect(result).toBe(1);
      });

      it('should get set members', async () => {
        const result = await client.smembers('set');
        expect(result).toEqual(['member1', 'member2']);
      });

      it('should check set membership', async () => {
        const result = await client.sismember('set', 'member1');
        expect(result).toBe(true);
      });

      it('should return false for non-member', async () => {
        const { default: MockRedis } = await import('ioredis');
        MockRedis.prototype.sismember = vi.fn().mockResolvedValue(0);

        const result = await client.sismember('set', 'nonmember');
        expect(result).toBe(false);
      });
    });

    describe('publish', () => {
      it('should publish message', async () => {
        const result = await client.publish('channel', 'message');
        expect(result).toBe(1);
      });
    });
  });

  describe('event handlers', () => {
    it('should track connect event', async () => {
      const { default: MockRedis } = await import('ioredis');
      let connectHandler: (() => void) | undefined;

      MockRedis.prototype.on = vi.fn((event: string, handler: () => void): any => {
        if (event === 'connect') {
          connectHandler = handler;
        }
        return this;
      });

      await client.connect();
      connectHandler?.();

      expect(client.getConnectionState()).toBe('connected');
    });

    it('should track error event', async () => {
      const { default: MockRedis } = await import('ioredis');
      let errorHandler: ((err: Error) => void) | undefined;

      (MockRedis.prototype as any).on = vi.fn(
        (event: string, handler: (err: Error) => void): any => {
          if (event === 'error') {
            errorHandler = handler;
          }
          return this;
        }
      );

      await client.connect();
      errorHandler?.(new Error('Connection error'));

      expect(client.getConnectionState()).toBe('error');
    });

    it('should track close event', async () => {
      const { default: MockRedis } = await import('ioredis');
      let closeHandler: (() => void) | undefined;

      MockRedis.prototype.on = vi.fn((event: string, handler: () => void): any => {
        if (event === 'close') {
          closeHandler = handler;
        }
        return this;
      });

      await client.connect();
      (client as unknown as { connectionState: string }).connectionState = 'connected';
      closeHandler?.();

      expect(client.getConnectionState()).toBe('disconnected');
    });

    it('should track reconnecting event', async () => {
      const { default: MockRedis } = await import('ioredis');
      let reconnectingHandler: (() => void) | undefined;

      MockRedis.prototype.on = vi.fn((event: string, handler: () => void): any => {
        if (event === 'reconnecting') {
          reconnectingHandler = handler;
        }
        return this;
      });

      await client.connect();
      (client as unknown as { connectionState: string }).connectionState = 'connected';
      reconnectingHandler?.();

      expect(client.getConnectionState()).toBe('connecting');
    });
  });
});
