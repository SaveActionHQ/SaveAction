import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseEnv, validateProductionEnv, getEnv } from './env.js';

describe('Environment Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('parseEnv', () => {
    it('should return default values when no env vars set', () => {
      process.env = {};
      const env = parseEnv();

      expect(env.NODE_ENV).toBe('development');
      expect(env.API_PORT).toBe(3001);
      expect(env.API_HOST).toBe('0.0.0.0');
      expect(env.CORS_ORIGIN).toBe('*');
      expect(env.LOG_LEVEL).toBe('info');
    });

    it('should parse valid environment variables', () => {
      process.env = {
        NODE_ENV: 'production',
        API_PORT: '8080',
        API_HOST: 'localhost',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        REDIS_URL: 'redis://localhost:6379',
        JWT_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        CORS_ORIGIN: 'https://example.com',
        LOG_LEVEL: 'debug',
      };

      const env = parseEnv();

      expect(env.NODE_ENV).toBe('production');
      expect(env.API_PORT).toBe(8080);
      expect(env.API_HOST).toBe('localhost');
      expect(env.DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/db');
      expect(env.REDIS_URL).toBe('redis://localhost:6379');
      expect(env.JWT_SECRET).toBe('a'.repeat(32));
      expect(env.JWT_REFRESH_SECRET).toBe('b'.repeat(32));
      expect(env.CORS_ORIGIN).toBe('https://example.com');
      expect(env.LOG_LEVEL).toBe('debug');
    });

    it('should coerce API_PORT to number', () => {
      process.env = { API_PORT: '3000' };
      const env = parseEnv();
      expect(env.API_PORT).toBe(3000);
      expect(typeof env.API_PORT).toBe('number');
    });

    it('should throw error for invalid NODE_ENV', () => {
      process.env = { NODE_ENV: 'invalid' };
      expect(() => parseEnv()).toThrow('Environment validation failed');
    });

    it('should throw error for invalid LOG_LEVEL', () => {
      process.env = { LOG_LEVEL: 'invalid' };
      expect(() => parseEnv()).toThrow('Environment validation failed');
    });

    it('should throw error for invalid DATABASE_URL format', () => {
      process.env = { DATABASE_URL: 'not-a-url' };
      expect(() => parseEnv()).toThrow('Environment validation failed');
    });

    it('should throw error for JWT_SECRET shorter than 32 chars', () => {
      process.env = { JWT_SECRET: 'tooshort' };
      expect(() => parseEnv()).toThrow('Environment validation failed');
    });
  });

  describe('validateProductionEnv', () => {
    it('should pass in development without required vars', () => {
      const env = {
        NODE_ENV: 'development' as const,
        API_PORT: 3001,
        API_HOST: '0.0.0.0',
        CORS_ORIGIN: '*',
        LOG_LEVEL: 'info' as const,
      };

      expect(() => validateProductionEnv(env)).not.toThrow();
    });

    it('should pass in test without required vars', () => {
      const env = {
        NODE_ENV: 'test' as const,
        API_PORT: 3001,
        API_HOST: '0.0.0.0',
        CORS_ORIGIN: '*',
        LOG_LEVEL: 'info' as const,
      };

      expect(() => validateProductionEnv(env)).not.toThrow();
    });

    it('should throw in production without DATABASE_URL', () => {
      const env = {
        NODE_ENV: 'production' as const,
        API_PORT: 3001,
        API_HOST: '0.0.0.0',
        CORS_ORIGIN: '*',
        LOG_LEVEL: 'info' as const,
        REDIS_URL: 'redis://localhost:6379',
        JWT_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
      };

      expect(() => validateProductionEnv(env)).toThrow('DATABASE_URL');
    });

    it('should throw in production without JWT_SECRET', () => {
      const env = {
        NODE_ENV: 'production' as const,
        API_PORT: 3001,
        API_HOST: '0.0.0.0',
        CORS_ORIGIN: '*',
        LOG_LEVEL: 'info' as const,
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        REDIS_URL: 'redis://localhost:6379',
        JWT_REFRESH_SECRET: 'b'.repeat(32),
      };

      expect(() => validateProductionEnv(env)).toThrow('JWT_SECRET');
    });

    it('should throw in production with multiple missing vars', () => {
      const env = {
        NODE_ENV: 'production' as const,
        API_PORT: 3001,
        API_HOST: '0.0.0.0',
        CORS_ORIGIN: '*',
        LOG_LEVEL: 'info' as const,
      };

      expect(() => validateProductionEnv(env)).toThrow('DATABASE_URL');
      expect(() => validateProductionEnv(env)).toThrow('REDIS_URL');
    });

    it('should pass in production with all required vars', () => {
      const env = {
        NODE_ENV: 'production' as const,
        API_PORT: 3001,
        API_HOST: '0.0.0.0',
        CORS_ORIGIN: '*',
        LOG_LEVEL: 'info' as const,
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        REDIS_URL: 'redis://localhost:6379',
        JWT_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
      };

      expect(() => validateProductionEnv(env)).not.toThrow();
    });
  });

  describe('getEnv', () => {
    it('should return cached env on subsequent calls', async () => {
      process.env = { API_PORT: '4000' };

      // Reset module cache to get fresh getEnv
      vi.resetModules();

      // Dynamic import for ES modules
      const { getEnv: freshGetEnv } = await import('./env.js');

      const env1 = freshGetEnv();
      const env2 = freshGetEnv();

      expect(env1).toBe(env2); // Same reference
    });
  });
});
