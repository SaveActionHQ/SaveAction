import Fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { errorHandler, redisConnectionPlugin, checkRedisHealth } from './plugins/index.js';
import type { Env } from './config/index.js';

export interface AppOptions {
  env: Env;
  logger?: FastifyServerOptions['logger'];
  /** Skip Redis connection (useful for tests that don't need Redis) */
  skipRedis?: boolean;
}

/**
 * Create and configure Fastify application instance.
 * Registers plugins, middleware, and routes.
 */
export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const { env, logger, skipRedis = false } = options;

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

  // Register Redis (unless skipped for testing)
  if (!skipRedis && env.REDIS_URL) {
    await app.register(redisConnectionPlugin, {
      url: env.REDIS_URL,
      connectTimeout: 5000,
      maxRetriesPerRequest: 3,
      keyPrefix: 'saveaction:',
    });
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
