import { z } from 'zod';

/**
 * Environment variable schema with Zod validation.
 * Validates required environment variables on startup.
 */
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().default(3001),
  API_HOST: z.string().default('0.0.0.0'),

  // Database (PostgreSQL)
  DATABASE_URL: z.string().url().optional(),

  // Redis
  REDIS_URL: z.string().url().optional(),

  // JWT Secrets (required in production)
  JWT_SECRET: z.string().min(32).optional(),
  JWT_REFRESH_SECRET: z.string().min(32).optional(),

  // CORS
  CORS_ORIGIN: z.string().default('*'),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Email (SMTP)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
  SMTP_FROM_NAME: z.string().default('SaveAction'),

  // App URLs
  APP_BASE_URL: z.string().url().default('http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parse and validate environment variables.
 * Throws descriptive error if validation fails.
 */
export function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');

    throw new Error(`Environment validation failed:\n${errors}`);
  }

  return result.data;
}

/**
 * Validate that required environment variables are set for production.
 * Call this after parseEnv() to ensure critical vars are present.
 */
export function validateProductionEnv(env: Env): void {
  if (env.NODE_ENV === 'production') {
    const missing: string[] = [];

    if (!env.DATABASE_URL) missing.push('DATABASE_URL');
    if (!env.REDIS_URL) missing.push('REDIS_URL');
    if (!env.JWT_SECRET) missing.push('JWT_SECRET');
    if (!env.JWT_REFRESH_SECRET) missing.push('JWT_REFRESH_SECRET');

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables for production:\n  - ${missing.join('\n  - ')}`
      );
    }
  }
}

// Parse environment on module load for early failure
let _env: Env | null = null;

/**
 * Get validated environment configuration.
 * Parses on first call, returns cached value on subsequent calls.
 */
export function getEnv(): Env {
  if (!_env) {
    _env = parseEnv();
  }
  return _env;
}
