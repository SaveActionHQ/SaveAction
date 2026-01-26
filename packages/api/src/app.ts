import Fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import {
  errorHandler,
  redisConnectionPlugin,
  checkRedisHealth,
  bullmqConnectionPlugin,
  checkQueueHealth,
  databasePlugin,
  checkDatabaseHealth,
  jwtPlugin,
} from './plugins/index.js';
import authRoutes from './routes/auth.js';
import type { Env } from './config/index.js';

export interface AppOptions {
  env: Env;
  logger?: FastifyServerOptions['logger'];
  /** Skip Redis connection (useful for tests that don't need Redis) */
  skipRedis?: boolean;
  /** Skip BullMQ initialization (useful for tests that don't need queues) */
  skipQueues?: boolean;
  /** Skip database connection (useful for tests that don't need database) */
  skipDatabase?: boolean;
  /** Skip auto-migrations (useful for tests) */
  skipMigrations?: boolean;
  /** Skip JWT authentication plugin (useful for tests) */
  skipAuth?: boolean;
}

/**
 * Create and configure Fastify application instance.
 * Registers plugins, middleware, and routes.
 */
export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const {
    env,
    logger,
    skipRedis = false,
    skipQueues = false,
    skipDatabase = false,
    skipMigrations = false,
    skipAuth = false,
  } = options;

  // Create Fastify instance with logging
  const app = Fastify({
    logger: logger ?? {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'HH:MM:ss',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    },
    // Generate request IDs for tracing
    genReqId: () => crypto.randomUUID(),
    // Disable default error handler (we use custom one)
    disableRequestLogging: false,
  });

  // Register @fastify/sensible for common utilities
  await app.register(sensible);

  // Register CORS
  await app.register(cors, {
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID'],
    maxAge: 86400, // 24 hours
  });

  // Register custom error handler
  await app.register(errorHandler);

  // Register Database (unless skipped for testing)
  if (!skipDatabase) {
    await app.register(databasePlugin, {
      autoMigrate: !skipMigrations && env.NODE_ENV !== 'test',
    });
  }

  // Register JWT plugin (unless skipped for testing)
  if (!skipAuth && env.JWT_SECRET) {
    await app.register(jwtPlugin, {
      secret: env.JWT_SECRET,
      cookieSecret: env.JWT_REFRESH_SECRET || env.JWT_SECRET,
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d',
    });

    // Register auth routes (requires both database and JWT)
    if (!skipDatabase && app.db) {
      await app.register(authRoutes, {
        prefix: '/api/auth',
        db: app.db,
        jwtSecret: env.JWT_SECRET,
        jwtRefreshSecret: env.JWT_REFRESH_SECRET || env.JWT_SECRET,
        accessTokenExpiry: '15m',
        refreshTokenExpiry: '7d',
        bcryptRounds: 12,
        maxLoginAttempts: 5,
        lockoutDuration: 900,
      });
    }
  }

  // Register Redis (unless skipped for testing)
  if (!skipRedis && env.REDIS_URL) {
    await app.register(redisConnectionPlugin, {
      url: env.REDIS_URL,
      connectTimeout: 5000,
      maxRetriesPerRequest: 3,
      keyPrefix: 'saveaction:',
    });

    // Register BullMQ (requires Redis, unless skipped)
    if (!skipQueues) {
      await app.register(bullmqConnectionPlugin, {
        prefix: 'saveaction',
        enableWorkers: true,
      });
    }
  }

  // Health check endpoint (basic)
  app.get('/api/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    };
  });

  // Detailed health check endpoint with service status
  app.get('/api/health/detailed', async (_request, reply) => {
    const services: Record<string, { status: string; latencyMs?: number; error?: string }> = {
      api: { status: 'healthy' },
    };

    // Check Database if available
    if (app.db) {
      const dbHealth = await checkDatabaseHealth();
      services.database = {
        status: dbHealth.connected ? 'healthy' : 'unhealthy',
        latencyMs: dbHealth.latencyMs,
        error: dbHealth.error,
      };
    } else {
      services.database = { status: 'not_configured' };
    }

    // Check Redis if available
    if (app.redis) {
      const redisHealth = await checkRedisHealth(app.redis);
      services.redis = {
        status: redisHealth.status,
        latencyMs: redisHealth.latencyMs,
        error: redisHealth.error,
      };
    } else {
      services.redis = { status: 'not_configured' };
    }

    // Check BullMQ queues if available
    if (app.queues) {
      const queueHealth = await checkQueueHealth(app.queues);
      services.queues = {
        status: queueHealth.status,
      };
    } else {
      services.queues = { status: 'not_configured' };
    }

    // Determine overall status
    const allHealthy = Object.values(services).every(
      (s) => s.status === 'healthy' || s.status === 'not_configured'
    );

    const status = allHealthy ? 'ok' : 'degraded';
    const httpStatus = allHealthy ? 200 : 503;

    return reply.status(httpStatus).send({
      status,
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      services,
    });
  });

  // Liveness probe (for Kubernetes)
  app.get('/api/health/live', async () => {
    return { status: 'ok' };
  });

  // Readiness probe (for Kubernetes)
  app.get('/api/health/ready', async (_request, reply) => {
    // Check critical services

    // Check Database if available
    if (app.db) {
      const dbHealth = await checkDatabaseHealth();
      if (!dbHealth.connected) {
        return reply.status(503).send({
          status: 'not_ready',
          reason: 'Database is not healthy',
        });
      }
    }

    // Check Redis if available
    if (app.redis) {
      const redisHealth = await checkRedisHealth(app.redis);
      if (redisHealth.status !== 'healthy') {
        return reply.status(503).send({
          status: 'not_ready',
          reason: 'Redis is not healthy',
        });
      }
    }

    return { status: 'ready' };
  });

  // Queue status endpoint
  app.get('/api/queues/status', async (_request, reply) => {
    if (!app.queues) {
      return reply.status(503).send({
        error: {
          code: 'QUEUES_NOT_CONFIGURED',
          message: 'Job queues are not configured',
        },
      });
    }

    const health = await checkQueueHealth(app.queues);
    return {
      status: health.status,
      timestamp: new Date().toISOString(),
      queues: health.queues,
      workers: health.workers,
    };
  });

  // Root endpoint
  app.get('/', async () => {
    return {
      name: 'SaveAction API',
      version: '0.1.0',
      docs: '/api/docs',
    };
  });

  return app;
}
