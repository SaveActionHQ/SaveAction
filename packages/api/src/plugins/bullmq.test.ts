import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { bullmqConnectionPlugin, checkQueueHealth } from './bullmq.js';
import { redisConnectionPlugin } from './redis.js';
import { JobQueueManager } from '../queues/index.js';

// Mock ioredis for BullMQ's dedicated Redis connection
vi.mock('ioredis', () => {
  const mockRedis = {
    status: 'ready',
    quit: vi.fn().mockResolvedValue('OK'),
    disconnect: vi.fn(),
  };
  return {
    default: vi.fn().mockImplementation(() => mockRedis),
  };
});

// Mock env config
vi.mock('../config/env.js', () => ({
  getEnv: vi.fn().mockReturnValue({
    REDIS_URL: 'redis://localhost:6379',
    NODE_ENV: 'test',
    API_PORT: 3000,
    LOG_LEVEL: 'info',
  }),
}));

// Mock RedisClient
vi.mock('../redis/index.js', () => {
  const mockRedisClient = {
    connect: vi.fn().mockResolvedValue({}),
    disconnect: vi.fn().mockResolvedValue(undefined),
    getClient: vi.fn().mockReturnValue({ status: 'ready' }),
    healthCheck: vi.fn().mockResolvedValue({
      status: 'healthy',
      latencyMs: 1,
      connectionState: 'connected',
    }),
    isConnected: vi.fn().mockReturnValue(true),
    getConnectionState: vi.fn().mockReturnValue('connected'),
  };

  return {
    RedisClient: vi.fn().mockImplementation(() => mockRedisClient),
  };
});

// Mock JobQueueManager
vi.mock('../queues/index.js', () => {
  const mockManager = {
    initialize: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
    isInitialized: vi.fn().mockReturnValue(true),
    getHealthStatus: vi.fn().mockResolvedValue({
      status: 'healthy',
      queues: [
        {
          name: 'test-runs',
          waiting: 0,
          active: 0,
          completed: 10,
          failed: 0,
          delayed: 0,
          paused: false,
        },
      ],
      workers: [{ name: 'test-runs', running: true, concurrency: 5 }],
    }),
  };

  return {
    JobQueueManager: vi.fn().mockImplementation(() => mockManager),
    QUEUE_CONFIGS: {
      'test-runs': { name: 'test-runs' },
      cleanup: { name: 'cleanup' },
      'scheduled-tests': { name: 'scheduled-tests' },
    },
  };
});

describe('bullmqConnectionPlugin', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify({ logger: false });

    // Register Redis plugin first (required dependency)
    await app.register(redisConnectionPlugin, {
      skipConnect: true,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('should register queues on fastify instance', async () => {
    await app.register(bullmqConnectionPlugin, {
      skipInit: true,
    });
    await app.ready();

    expect(app.queues).toBeDefined();
  });

  it('should initialize queues when skipInit is false', async () => {
    await app.register(bullmqConnectionPlugin, {
      skipInit: false,
    });
    await app.ready();

    const MockJobQueueManager = vi.mocked(JobQueueManager);
    const instance = MockJobQueueManager.mock.results[0].value;
    expect(instance.initialize).toHaveBeenCalled();
  });

  it('should use custom options', async () => {
    await app.register(bullmqConnectionPlugin, {
      prefix: 'custom-prefix',
      enableWorkers: false,
      skipInit: true,
    });
    await app.ready();

    const MockJobQueueManager = vi.mocked(JobQueueManager);
    expect(MockJobQueueManager).toHaveBeenCalledWith({
      connection: expect.anything(),
      prefix: 'custom-prefix',
      enableWorkers: false,
    });
  });

  it('should shutdown queues on app close', async () => {
    await app.register(bullmqConnectionPlugin, {
      skipInit: true,
    });
    await app.ready();

    const queues = app.queues;
    await app.close();

    expect(queues.shutdown).toHaveBeenCalled();
  });

  it('should throw if Redis is not registered', async () => {
    const appWithoutRedis = Fastify({ logger: false });

    await expect(
      appWithoutRedis.register(bullmqConnectionPlugin, {
        skipInit: true,
      })
    ).rejects.toThrow("The dependency 'redis' of plugin 'bullmq' is not registered");

    await appWithoutRedis.close();
  });

  it('should throw if Redis is not connected', async () => {
    const { RedisClient } = await import('../redis/index.js');
    vi.mocked(RedisClient).mockImplementationOnce(
      () =>
        ({
          connect: vi.fn().mockResolvedValue({}),
          disconnect: vi.fn(),
          getClient: vi.fn().mockImplementation(() => {
            throw new Error('Not connected');
          }),
          isConnected: vi.fn().mockReturnValue(false),
        }) as unknown as InstanceType<typeof RedisClient>
    );

    const appWithDisconnectedRedis = Fastify({ logger: false });
    await appWithDisconnectedRedis.register(redisConnectionPlugin, {
      skipConnect: true,
    });

    await expect(
      appWithDisconnectedRedis.register(bullmqConnectionPlugin, {
        skipInit: true,
      })
    ).rejects.toThrow('Redis is not connected');

    await appWithDisconnectedRedis.close();
  });
});

describe('checkQueueHealth', () => {
  it('should return health status from queue manager', async () => {
    const mockManager = {
      getHealthStatus: vi.fn().mockResolvedValue({
        status: 'healthy',
        queues: [
          {
            name: 'test-runs',
            waiting: 5,
            active: 2,
            completed: 100,
            failed: 0,
            delayed: 0,
            paused: false,
          },
        ],
        workers: [{ name: 'test-runs', running: true, concurrency: 5 }],
      }),
    } as unknown as JobQueueManager;

    const health = await checkQueueHealth(mockManager);

    expect(health.status).toBe('healthy');
    expect(health.queues).toHaveLength(1);
    expect(health.workers).toHaveLength(1);
  });

  it('should return degraded status when there are issues', async () => {
    const mockManager = {
      getHealthStatus: vi.fn().mockResolvedValue({
        status: 'degraded',
        queues: [
          {
            name: 'test-runs',
            waiting: 0,
            active: 0,
            completed: 0,
            failed: 200,
            delayed: 0,
            paused: false,
          },
        ],
        workers: [],
      }),
    } as unknown as JobQueueManager;

    const health = await checkQueueHealth(mockManager);

    expect(health.status).toBe('degraded');
  });
});

describe('BullMQ plugin with Fastify integration', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify({ logger: false });

    await app.register(redisConnectionPlugin, {
      skipConnect: true,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('should be accessible in route handlers', async () => {
    await app.register(bullmqConnectionPlugin, {
      skipInit: true,
    });

    app.get('/test', async (request, reply) => {
      const isInitialized = request.server.queues.isInitialized();
      return { queuesAvailable: isInitialized };
    });

    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/test',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.queuesAvailable).toBe(true);
  });

  it('should work with encapsulated routes', async () => {
    await app.register(bullmqConnectionPlugin, {
      skipInit: true,
    });

    await app.register(
      async (fastify) => {
        fastify.get('/nested', async () => {
          return { hasQueues: !!fastify.queues };
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
    expect(body.hasQueues).toBe(true);
  });
});
