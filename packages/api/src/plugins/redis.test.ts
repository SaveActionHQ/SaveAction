import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { redisConnectionPlugin, checkRedisHealth } from './redis.js';
import { RedisClient } from '../redis/index.js';

// Mock the RedisClient
vi.mock('../redis/index.js', () => {
  const mockClient = {
    connect: vi.fn().mockResolvedValue({}),
    disconnect: vi.fn().mockResolvedValue(undefined),
    healthCheck: vi.fn().mockResolvedValue({
      status: 'healthy',
      latencyMs: 1,
      connectionState: 'connected',
    }),
    isConnected: vi.fn().mockReturnValue(true),
    getConnectionState: vi.fn().mockReturnValue('connected'),
  };

  return {
    RedisClient: vi.fn().mockImplementation(() => mockClient),
  };
});

describe('redisConnectionPlugin', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify({ logger: false });
  });

  afterEach(async () => {
    await app.close();
  });

  it('should register redis client on fastify instance', async () => {
    await app.register(redisConnectionPlugin, {
      url: 'redis://localhost:6379',
      skipConnect: true, // Skip actual connection in tests
    });
    await app.ready();

    expect(app.redis).toBeDefined();
  });

  it('should connect to Redis when skipConnect is false', async () => {
    await app.register(redisConnectionPlugin, {
      url: 'redis://localhost:6379',
      skipConnect: false,
    });
    await app.ready();

    expect(app.redis).toBeDefined();
    const MockRedisClient = vi.mocked(RedisClient);
    expect(MockRedisClient).toHaveBeenCalled();
  });

  it('should use default URL from environment', async () => {
    process.env.REDIS_URL = 'redis://env-redis:6379';

    await app.register(redisConnectionPlugin, {
      skipConnect: true,
    });
    await app.ready();

    expect(app.redis).toBeDefined();

    delete process.env.REDIS_URL;
  });

  it('should use custom options', async () => {
    await app.register(redisConnectionPlugin, {
      url: 'redis://custom:6380',
      connectTimeout: 10000,
      maxRetriesPerRequest: 5,
      keyPrefix: 'test:',
      skipConnect: true,
    });
    await app.ready();

    const MockRedisClient = vi.mocked(RedisClient);
    expect(MockRedisClient).toHaveBeenCalledWith({
      url: 'redis://custom:6380',
      connectTimeout: 10000,
      maxRetriesPerRequest: 5,
      keyPrefix: 'test:',
      enableAutoReconnect: true,
      enableReadyCheck: true,
      name: 'fastify-redis',
    });
  });

  it('should disconnect on app close', async () => {
    await app.register(redisConnectionPlugin, {
      url: 'redis://localhost:6379',
      skipConnect: true,
    });
    await app.ready();

    const redis = app.redis;
    await app.close();

    expect(redis.disconnect).toHaveBeenCalled();
  });

  it('should throw error on connection failure', async () => {
    const MockRedisClient = vi.mocked(RedisClient);

    MockRedisClient.mockImplementationOnce((): any => ({
      connect: vi.fn().mockRejectedValue(new Error('Connection refused')),
      disconnect: vi.fn(),
      healthCheck: vi.fn(),
      isConnected: vi.fn(),
      getConnectionState: vi.fn(),
    }));

    await expect(
      app.register(redisConnectionPlugin, {
        url: 'redis://localhost:6379',
        skipConnect: false,
      })
    ).rejects.toThrow('Connection refused');
  });
});

describe('checkRedisHealth', () => {
  it('should return health status from redis client', async () => {
    const mockClient = {
      healthCheck: vi.fn().mockResolvedValue({
        status: 'healthy',
        latencyMs: 2,
        connectionState: 'connected',
      }),
    } as unknown as RedisClient;

    const health = await checkRedisHealth(mockClient);

    expect(health.status).toBe('healthy');
    expect(health.latencyMs).toBe(2);
    expect(health.connectionState).toBe('connected');
  });

  it('should return unhealthy status on error', async () => {
    const mockClient = {
      healthCheck: vi.fn().mockResolvedValue({
        status: 'unhealthy',
        error: 'Connection lost',
        connectionState: 'error',
      }),
    } as unknown as RedisClient;

    const health = await checkRedisHealth(mockClient);

    expect(health.status).toBe('unhealthy');
    expect(health.error).toBe('Connection lost');
  });
});

describe('Redis plugin with Fastify integration', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    app = Fastify({ logger: false });
  });

  afterEach(async () => {
    await app.close();
  });

  it('should be accessible in route handlers', async () => {
    await app.register(redisConnectionPlugin, {
      skipConnect: true,
    });

    app.get('/test', async (request, reply) => {
      const isConnected = request.server.redis.isConnected();
      return { redisAvailable: isConnected };
    });

    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/test',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.redisAvailable).toBe(true);
  });

  it('should work with encapsulated routes', async () => {
    // Register redis at root level
    await app.register(redisConnectionPlugin, {
      skipConnect: true,
    });

    // Register encapsulated plugin with routes
    await app.register(
      async (fastify) => {
        fastify.get('/nested', async () => {
          return { hasRedis: !!fastify.redis };
        });
      },
      { prefix: '/api' }
    );

    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/nested',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.hasRedis).toBe(true);
  });
});
