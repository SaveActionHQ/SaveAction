import Fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { errorHandler } from './plugins/index.js';
import type { Env } from './config/index.js';

export interface AppOptions {
  env: Env;
  logger?: FastifyServerOptions['logger'];
}

/**
 * Create and configure Fastify application instance.
 * Registers plugins, middleware, and routes.
 */
export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const { env, logger } = options;

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

  // Health check endpoint (basic - will be expanded later)
  app.get('/api/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
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
