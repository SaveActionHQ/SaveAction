import { getEnv, validateProductionEnv } from './config/index.js';
import { buildApp } from './app.js';

/**
 * Start the API server.
 */
async function start(): Promise<void> {
  // Validate environment
  const env = getEnv();
  validateProductionEnv(env);

  // Build application
  const app = await buildApp({ env });

  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down gracefully...`);

    try {
      await app.close();
      app.log.info('Server closed successfully');
      process.exit(0);
    } catch (err) {
      app.log.error(err, 'Error during shutdown');
      process.exit(1);
    }
  };

  // Register shutdown handlers
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Start server
  try {
    await app.listen({
      port: env.API_PORT,
      host: env.API_HOST,
    });

    app.log.info(`🚀 SaveAction API running at http://${env.API_HOST}:${env.API_PORT}`);
    app.log.info(`📚 Environment: ${env.NODE_ENV}`);
  } catch (err) {
    app.log.error(err, 'Failed to start server');
    process.exit(1);
  }
}

// Run server
start();
