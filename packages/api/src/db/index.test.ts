/**
 * Database Plugin Tests
 *
 * These are unit tests for the database module.
 * They test the module structure and configuration without requiring a real database.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDatabaseConfig, resetDatabaseState } from './index.js';

describe('Database Module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset state between tests
    resetDatabaseState();
    // Reset environment
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    resetDatabaseState();
  });

  describe('getDatabaseConfig', () => {
    it('should return default configuration when no env vars set', () => {
      // Clear all DB-related env vars
      delete process.env['DATABASE_URL'];
      delete process.env['DB_HOST'];
      delete process.env['DB_PORT'];
      delete process.env['DB_NAME'];
      delete process.env['DB_USER'];
      delete process.env['DB_PASSWORD'];
      delete process.env['DB_SSL'];

      const config = getDatabaseConfig();

      expect(config).toEqual({
        connectionString: undefined,
        host: 'localhost',
        port: 5432,
        database: 'saveaction',
        user: 'saveaction',
        password: 'saveaction_dev',
        ssl: false,
        poolMin: 2,
        poolMax: 10,
        idleTimeoutMs: 30000,
        connectionTimeoutMs: 5000,
      });
    });

    it('should use DATABASE_URL when provided', () => {
      process.env['DATABASE_URL'] = 'postgresql://user:pass@host:5433/db';

      const config = getDatabaseConfig();

      expect(config.connectionString).toBe('postgresql://user:pass@host:5433/db');
    });

    it('should use individual env vars when provided', () => {
      process.env['DB_HOST'] = 'db.example.com';
      process.env['DB_PORT'] = '5433';
      process.env['DB_NAME'] = 'testdb';
      process.env['DB_USER'] = 'testuser';
      process.env['DB_PASSWORD'] = 'testpass';

      const config = getDatabaseConfig();

      expect(config.host).toBe('db.example.com');
      expect(config.port).toBe(5433);
      expect(config.database).toBe('testdb');
      expect(config.user).toBe('testuser');
      expect(config.password).toBe('testpass');
    });

    it('should enable SSL when DB_SSL is true', () => {
      process.env['DB_SSL'] = 'true';

      const config = getDatabaseConfig();

      expect(config.ssl).toEqual({ rejectUnauthorized: true });
    });

    it('should allow insecure SSL when DB_SSL_REJECT_UNAUTHORIZED is false', () => {
      process.env['DB_SSL'] = 'true';
      process.env['DB_SSL_REJECT_UNAUTHORIZED'] = 'false';

      const config = getDatabaseConfig();

      expect(config.ssl).toEqual({ rejectUnauthorized: false });
    });

    it('should use custom pool settings when provided', () => {
      process.env['DB_POOL_MIN'] = '5';
      process.env['DB_POOL_MAX'] = '20';
      process.env['DB_IDLE_TIMEOUT'] = '60000';
      process.env['DB_CONNECTION_TIMEOUT'] = '10000';

      const config = getDatabaseConfig();

      expect(config.poolMin).toBe(5);
      expect(config.poolMax).toBe(20);
      expect(config.idleTimeoutMs).toBe(60000);
      expect(config.connectionTimeoutMs).toBe(10000);
    });
  });
});

describe('Database Schema', () => {
  // Import schemas to verify they load correctly
  it('should export all schema tables', async () => {
    const schema = await import('./schema/index.js');

    // Verify all tables are exported
    expect(schema.users).toBeDefined();
    expect(schema.apiTokens).toBeDefined();
    expect(schema.recordings).toBeDefined();
    expect(schema.runs).toBeDefined();
    expect(schema.runActions).toBeDefined();
    expect(schema.schedules).toBeDefined();
    expect(schema.webhooks).toBeDefined();
    expect(schema.webhookDeliveries).toBeDefined();
  });

  it('should export all enums', async () => {
    const schema = await import('./schema/index.js');

    // Verify enums are exported
    expect(schema.runStatusEnum).toBeDefined();
    expect(schema.browserEnum).toBeDefined();
    expect(schema.actionStatusEnum).toBeDefined();
    expect(schema.scheduleStatusEnum).toBeDefined();
    expect(schema.webhookEventEnum).toBeDefined();
    expect(schema.webhookStatusEnum).toBeDefined();
  });

  it('should export allTables constant', async () => {
    const schema = await import('./schema/index.js');

    expect(schema.allTables).toEqual({
      users: 'users',
      apiTokens: 'api_tokens',
      projects: 'projects',
      recordings: 'recordings',
      runs: 'runs',
      runActions: 'run_actions',
      schedules: 'schedules',
      webhooks: 'webhooks',
      webhookDeliveries: 'webhook_deliveries',
    });
  });
});
