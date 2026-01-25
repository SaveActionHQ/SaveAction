/**
 * Database Connection & Drizzle Client
 *
 * Enterprise-grade database setup with:
 * - Connection pooling via pg Pool
 * - Health check support
 * - Graceful shutdown
 * - Auto-migration on startup
 */

import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool, PoolConfig } from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as schema from './schema/index.js';

// Type for Drizzle client with our schema
export type Database = NodePgDatabase<typeof schema>;

// Singleton instances
let pool: Pool | null = null;
let db: Database | null = null;

/**
 * Database configuration from environment
 */
export interface DatabaseConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean | { rejectUnauthorized: boolean };

  // Pool configuration
  poolMin?: number;
  poolMax?: number;
  idleTimeoutMs?: number;
  connectionTimeoutMs?: number;
}

/**
 * Get database configuration from environment variables
 */
export function getDatabaseConfig(): DatabaseConfig {
  return {
    connectionString: process.env['DATABASE_URL'],
    host: process.env['DB_HOST'] || 'localhost',
    port: parseInt(process.env['DB_PORT'] || '5432', 10),
    database: process.env['DB_NAME'] || 'saveaction',
    user: process.env['DB_USER'] || 'saveaction',
    password: process.env['DB_PASSWORD'] || 'saveaction_dev',
    ssl:
      process.env['DB_SSL'] === 'true'
        ? { rejectUnauthorized: process.env['DB_SSL_REJECT_UNAUTHORIZED'] !== 'false' }
        : false,

    // Pool settings
    poolMin: parseInt(process.env['DB_POOL_MIN'] || '2', 10),
    poolMax: parseInt(process.env['DB_POOL_MAX'] || '10', 10),
    idleTimeoutMs: parseInt(process.env['DB_IDLE_TIMEOUT'] || '30000', 10),
    connectionTimeoutMs: parseInt(process.env['DB_CONNECTION_TIMEOUT'] || '5000', 10),
  };
}

/**
 * Create PostgreSQL connection pool
 */
export function createPool(config: DatabaseConfig = getDatabaseConfig()): Pool {
  const poolConfig: PoolConfig = config.connectionString
    ? {
        connectionString: config.connectionString,
        ssl: config.ssl,
        min: config.poolMin,
        max: config.poolMax,
        idleTimeoutMillis: config.idleTimeoutMs,
        connectionTimeoutMillis: config.connectionTimeoutMs,
      }
    : {
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        ssl: config.ssl,
        min: config.poolMin,
        max: config.poolMax,
        idleTimeoutMillis: config.idleTimeoutMs,
        connectionTimeoutMillis: config.connectionTimeoutMs,
      };

  return new Pool(poolConfig);
}

/**
 * Get or create the database connection pool
 */
export function getPool(): Pool {
  if (!pool) {
    pool = createPool();
  }
  return pool;
}

/**
 * Get or create the Drizzle database client
 */
export function getDatabase(): Database {
  if (!db) {
    db = drizzle(getPool(), { schema });
  }
  return db;
}

/**
 * Initialize database with new pool (useful for testing)
 */
export function initializeDatabase(customPool?: Pool): Database {
  if (customPool) {
    pool = customPool;
  } else if (!pool) {
    pool = createPool();
  }
  db = drizzle(pool, { schema });
  return db;
}

/**
 * Run database migrations
 *
 * @param migrationsFolder - Path to migrations folder (default: ./drizzle)
 */
export async function runMigrations(migrationsFolder?: string): Promise<void> {
  const database = getDatabase();

  // Resolve migrations folder
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const folder = migrationsFolder || path.resolve(__dirname, '../../drizzle');

  console.log(`[DB] Running migrations from: ${folder}`);

  try {
    await migrate(database, { migrationsFolder: folder });
    console.log('[DB] Migrations completed successfully');
  } catch (error) {
    console.error('[DB] Migration failed:', error);
    throw error;
  }
}

/**
 * Check database connection health
 *
 * @returns Object with connection status and latency
 */
export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  latencyMs: number;
  poolSize: number;
  idleConnections: number;
  waitingClients: number;
  error?: string;
}> {
  const currentPool = getPool();
  const start = Date.now();

  try {
    const client = await currentPool.connect();
    await client.query('SELECT 1');
    client.release();

    return {
      connected: true,
      latencyMs: Date.now() - start,
      poolSize: currentPool.totalCount,
      idleConnections: currentPool.idleCount,
      waitingClients: currentPool.waitingCount,
    };
  } catch (error) {
    return {
      connected: false,
      latencyMs: Date.now() - start,
      poolSize: currentPool.totalCount,
      idleConnections: currentPool.idleCount,
      waitingClients: currentPool.waitingCount,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Close database connections gracefully
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    console.log('[DB] Closing database connections...');
    await pool.end();
    pool = null;
    db = null;
    console.log('[DB] Database connections closed');
  }
}

/**
 * Reset database state (for testing)
 */
export function resetDatabaseState(): void {
  pool = null;
  db = null;
}

// Re-export schema for convenience
export { schema };
export * from './schema/index.js';
