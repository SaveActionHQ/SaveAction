/**
 * Fastify Database Plugin
 *
 * Provides:
 * - Database connection via request decorator
 * - Health check endpoint
 * - Auto-migration on startup (optional)
 * - Graceful shutdown
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import {
  getDatabase,
  checkDatabaseHealth,
  closeDatabase,
  runMigrations,
  type Database,
} from '../db/index.js';

/**
 * Plugin options
 */
export interface DatabasePluginOptions {
  /** Run migrations on startup (default: true in production, false otherwise) */
  autoMigrate?: boolean;
  /** Migrations folder path (optional) */
  migrationsFolder?: string;
}

/**
 * Extend Fastify types
 */
declare module 'fastify' {
  interface FastifyInstance {
    db: Database;
    checkDbHealth: typeof checkDatabaseHealth;
  }
  interface FastifyRequest {
    db: Database;
  }
}

/**
 * Database plugin implementation
 */
const databasePlugin: FastifyPluginAsync<DatabasePluginOptions> = async (
  fastify: FastifyInstance,
  options: DatabasePluginOptions
) => {
  const { autoMigrate = process.env['NODE_ENV'] !== 'test', migrationsFolder } = options;

  // Initialize database
  fastify.log.info('[DB] Initializing database connection...');
  const db = getDatabase();

  // Run migrations if enabled
  if (autoMigrate) {
    try {
      fastify.log.info('[DB] Running auto-migrations...');
      await runMigrations(migrationsFolder);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      fastify.log.error('[DB] Migration failed: %s', errorMessage);
      // Don't throw in development - allow starting without migrations
      if (process.env['NODE_ENV'] === 'production') {
        throw err;
      }
    }
  }

  // Verify connection
  const health = await checkDatabaseHealth();
  if (!health.connected) {
    fastify.log.error(`[DB] Failed to connect: ${health.error}`);
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error(`Database connection failed: ${health.error}`);
    }
  } else {
    fastify.log.info(`[DB] Connected successfully (latency: ${health.latencyMs}ms)`);
  }

  // Decorate fastify instance
  fastify.decorate('db', db);
  fastify.decorate('checkDbHealth', checkDatabaseHealth);

  // Decorate requests for convenience
  fastify.decorateRequest('db', null);
  fastify.addHook('onRequest', async (request) => {
    request.db = db;
  });

  // Graceful shutdown
  fastify.addHook('onClose', async () => {
    fastify.log.info('[DB] Closing database connections...');
    await closeDatabase();
  });
};

export default fp(databasePlugin, {
  name: 'database',
  fastify: '4.x',
});
