import Fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
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
  swaggerPlugin,
  helmetPlugin,
  rateLimitPlugin,
  csrfPlugin,
} from './plugins/index.js';
import authRoutes from './routes/auth.js';
import apiTokenRoutes from './routes/tokens.js';
import recordingRoutes from './routes/recordings.js';
import runRoutes from './routes/runs.js';
import scheduleRoutes from './routes/schedules.js';
import { EmailService } from './services/EmailService.js';
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
  /** Skip Swagger/OpenAPI documentation (useful for tests) */
  skipSwagger?: boolean;
  /** Skip security headers (useful for tests) */
  skipHelmet?: boolean;
  /** Skip rate limiting (useful for tests) */
  skipRateLimit?: boolean;
  /** Skip CSRF protection (useful for tests) */
  skipCsrf?: boolean;
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
    skipSwagger = false,
    skipHelmet = false,
    skipRateLimit = false,
    skipCsrf = false,
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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-CSRF-Token'],
    exposedHeaders: [
      'X-Request-ID',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],
    maxAge: 86400, // 24 hours
  });

  // Register cookie plugin (required for refresh tokens and CSRF)
  // Must be registered before CSRF plugin and auth routes
  await app.register(cookie, {
    secret: env.JWT_REFRESH_SECRET || env.JWT_SECRET,
    parseOptions: {},
  });

  // Register security headers (Helmet) - unless skipped for testing
  if (!skipHelmet) {
    await app.register(helmetPlugin, {
      isProduction: env.NODE_ENV === 'production',
      enableHsts: env.NODE_ENV === 'production',
      swaggerPrefix: '/api/docs',
    });
  }

  // Register Swagger/OpenAPI documentation (unless skipped for testing)
  if (!skipSwagger) {
    await app.register(swaggerPlugin, {
      baseUrl: env.APP_BASE_URL || `http://localhost:${env.API_PORT}`,
      enableUi: true,
      uiPrefix: '/api/docs',
    });
  }

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

    // Initialize email service if SMTP is configured
    let emailService: EmailService | undefined;
    if (env.SMTP_HOST && env.SMTP_FROM) {
      emailService = new EmailService({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
        from: env.SMTP_FROM,
        fromName: env.SMTP_FROM_NAME,
      });

      try {
        await emailService.initialize();
        app.log.info('Email service initialized');
      } catch (error) {
        app.log.warn(
          { error },
          'Failed to initialize email service - password reset will be unavailable'
        );
        emailService = undefined;
      }

      // Close email service on app close
      app.addHook('onClose', async () => {
        if (emailService) {
          await emailService.close();
        }
      });
    }

    // Register auth routes (requires both database and JWT)
    if (!skipDatabase && app.db) {
      // Register all v1 API routes under /api/v1 prefix
      await app.register(
        async (v1App) => {
          // Auth routes
          await v1App.register(authRoutes, {
            prefix: '/auth',
            db: app.db!,
            jwtSecret: env.JWT_SECRET!,
            jwtRefreshSecret: env.JWT_REFRESH_SECRET || env.JWT_SECRET!,
            accessTokenExpiry: '15m',
            refreshTokenExpiry: '7d',
            bcryptRounds: 12,
            maxLoginAttempts: 5,
            lockoutDuration: 900,
            emailService,
            appBaseUrl: env.APP_BASE_URL,
          });

          // API token routes
          await v1App.register(apiTokenRoutes, {
            prefix: '/tokens',
            db: app.db!,
            maxTokensPerUser: 10,
          });

          // Recording routes
          await v1App.register(recordingRoutes, {
            prefix: '/recordings',
            db: app.db!,
            maxDataSizeBytes: 10 * 1024 * 1024, // 10MB
            maxRecordingsPerUser: 0, // Unlimited
          });
        },
        { prefix: '/api/v1' }
      );

      // Note: Run routes registered after Redis/BullMQ initialization below
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

    // Register rate limiting with Redis store (unless skipped)
    if (!skipRateLimit) {
      await app.register(rateLimitPlugin, {
        redis: app.redis?.getClient(), // Use Redis for distributed rate limiting
        global: 100, // 100 requests/min for unauthenticated
        authenticated: 200, // 200 requests/min for authenticated
        auth: 20, // 20 requests/min for auth endpoints (anti-brute-force)
        timeWindow: 60000, // 1 minute
      });
    }

    // Register BullMQ (requires Redis, unless skipped)
    // Note: Workers are NOT registered here - they run in a separate process (worker.ts)
    // This is intentional for production scalability:
    // - API server handles HTTP requests only
    // - Worker process(es) handle test execution
    // - Workers can scale independently
    if (!skipQueues) {
      await app.register(bullmqConnectionPlugin, {
        prefix: 'saveaction',
        enableWorkers: false, // Workers run in separate process
      });
    }
  } else if (!skipRateLimit) {
    // Register rate limiting with in-memory store (no Redis)
    await app.register(rateLimitPlugin, {
      global: 100,
      authenticated: 200,
      auth: 20,
      timeWindow: 60000,
    });
  }

  // Register CSRF protection (unless skipped)
  // Must be registered after cookie plugin
  if (!skipCsrf) {
    await app.register(csrfPlugin, {
      skip: false,
      cookieName: '_csrf',
      headerName: 'x-csrf-token',
      cookie: {
        path: '/api',
        httpOnly: false, // Must be false for JS to read
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
      },
    });
  }

  // Register run routes AFTER BullMQ (requires database, JWT, and optionally queues)
  // This is registered under /api/v1 to match the versioned API pattern
  if (!skipAuth && !skipDatabase && app.db) {
    await app.register(runRoutes, {
      prefix: '/api/v1/runs',
      db: app.db,
      jobQueueManager: app.queues, // Now properly initialized if Redis is configured
    });

    // Register schedule routes (requires database, JWT, and optionally queues)
    await app.register(scheduleRoutes, {
      prefix: '/api/v1/schedules',
      db: app.db,
      jobQueueManager: app.queues,
      maxSchedulesPerUser: 50,
    });
  }

  // Health check endpoint (basic)
  app.get(
    '/api/health',
    {
      schema: {
        tags: ['Health'],
        summary: 'Basic health check',
        description: 'Returns basic API health status',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', example: 'ok' },
              timestamp: { type: 'string', format: 'date-time' },
              version: { type: 'string', example: '0.1.0' },
            },
          },
        },
      },
    },
    async () => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '0.1.0',
      };
    }
  );

  // Detailed health check endpoint with service status
  app.get(
    '/api/health/detailed',
    {
      schema: {
        tags: ['Health'],
        summary: 'Detailed health check',
        description: 'Returns health status of all services including database, Redis, and queues',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['ok', 'degraded'] },
              timestamp: { type: 'string', format: 'date-time' },
              version: { type: 'string' },
              services: {
                type: 'object',
                additionalProperties: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                    latencyMs: { type: 'number' },
                    error: { type: 'string' },
                  },
                },
              },
            },
          },
          503: {
            type: 'object',
            properties: {
              status: { type: 'string', example: 'degraded' },
              timestamp: { type: 'string', format: 'date-time' },
              version: { type: 'string' },
              services: { type: 'object' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
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
    }
  );

  // Liveness probe (for Kubernetes)
  app.get(
    '/api/health/live',
    {
      schema: {
        tags: ['Health'],
        summary: 'Liveness probe',
        description: 'Kubernetes liveness probe - returns ok if the process is alive',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', example: 'ok' },
            },
          },
        },
      },
    },
    async () => {
      return { status: 'ok' };
    }
  );

  // Readiness probe (for Kubernetes)
  app.get(
    '/api/health/ready',
    {
      schema: {
        tags: ['Health'],
        summary: 'Readiness probe',
        description:
          'Kubernetes readiness probe - returns ready if all critical services are healthy',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', example: 'ready' },
            },
          },
          503: {
            type: 'object',
            properties: {
              status: { type: 'string', example: 'not_ready' },
              reason: { type: 'string' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
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
    }
  );

  // Queue status endpoint
  app.get(
    '/api/queues/status',
    {
      schema: {
        tags: ['Health'],
        summary: 'Queue status',
        description: 'Returns the status of all job queues',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
              queues: { type: 'object' },
              workers: { type: 'object' },
            },
          },
          503: {
            type: 'object',
            properties: {
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (_request, reply) => {
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
    }
  );

  // Root endpoint
  app.get(
    '/',
    {
      schema: {
        hide: true, // Hide from swagger - it's just a redirect hint
      },
    },
    async () => {
      return {
        name: 'SaveAction API',
        version: '0.1.0',
        docs: '/api/docs',
      };
    }
  );

  return app;
}
