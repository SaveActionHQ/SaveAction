/**
 * Security Headers Plugin (Helmet)
 *
 * Adds security headers to all responses:
 * - Content-Security-Policy (CSP)
 * - X-Frame-Options
 * - X-Content-Type-Options
 * - Strict-Transport-Security (HSTS)
 * - X-XSS-Protection
 * - Referrer-Policy
 * - Cross-Origin-Embedder-Policy
 * - Cross-Origin-Opener-Policy
 * - Cross-Origin-Resource-Policy
 *
 * Special handling for Swagger UI which requires looser CSP.
 */

import fp from 'fastify-plugin';
import helmet from '@fastify/helmet';
import type { FastifyInstance } from 'fastify';

export interface HelmetPluginOptions {
  /**
   * Whether the app is running in production mode.
   * Enables stricter settings in production (e.g., HSTS).
   */
  isProduction?: boolean;
  /**
   * Enable HSTS header (Strict-Transport-Security).
   * Only enable when behind HTTPS.
   * @default true in production
   */
  enableHsts?: boolean;
  /**
   * Swagger UI route prefix for relaxed CSP.
   * @default '/api/docs'
   */
  swaggerPrefix?: string;
}

/**
 * Default Content-Security-Policy for API endpoints (strict).
 */
const API_CSP_DIRECTIVES = {
  defaultSrc: ["'none'"],
  baseUri: ["'none'"],
  formAction: ["'none'"],
  frameAncestors: ["'none'"],
  objectSrc: ["'none'"],
};

/**
 * Content-Security-Policy for Swagger UI (relaxed to allow UI functionality).
 * Swagger UI requires inline styles, scripts from CDN, and blob URLs.
 */
const SWAGGER_CSP_DIRECTIVES = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
  styleSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
  imgSrc: ["'self'", 'data:', 'https://validator.swagger.io'],
  fontSrc: ["'self'", 'data:'],
  connectSrc: ["'self'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
  objectSrc: ["'none'"],
  workerSrc: ["'self'", 'blob:'],
};

/**
 * Helmet plugin implementation that adds security headers to responses.
 *
 * Uses strict CSP for API endpoints and relaxed CSP for Swagger UI.
 */
async function helmetPluginImpl(app: FastifyInstance, options: HelmetPluginOptions): Promise<void> {
  const {
    isProduction = process.env.NODE_ENV === 'production',
    enableHsts = isProduction,
    swaggerPrefix = '/api/docs',
  } = options;

  // Register helmet with global settings
  await app.register(helmet, {
    global: true,

    // Content-Security-Policy - default strict for API
    // Will be overridden per-route for Swagger UI
    contentSecurityPolicy: {
      directives: API_CSP_DIRECTIVES,
    },

    // X-Frame-Options: DENY - prevent clickjacking
    frameguard: {
      action: 'deny',
    },

    // X-Content-Type-Options: nosniff
    noSniff: true,

    // X-XSS-Protection: 0 (deprecated, but belt-and-suspenders)
    xssFilter: true,

    // Referrer-Policy: strict-origin-when-cross-origin
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },

    // Strict-Transport-Security (HSTS)
    // Only enable in production behind HTTPS
    hsts: enableHsts
      ? {
          maxAge: 31536000, // 1 year
          includeSubDomains: true,
          preload: true,
        }
      : false,

    // Cross-Origin-Embedder-Policy: require-corp
    crossOriginEmbedderPolicy: false, // Can cause issues, disabled by default

    // Cross-Origin-Opener-Policy: same-origin
    crossOriginOpenerPolicy: {
      policy: 'same-origin',
    },

    // Cross-Origin-Resource-Policy: same-origin
    crossOriginResourcePolicy: {
      policy: 'same-origin',
    },

    // DNS Prefetch Control: off
    dnsPrefetchControl: {
      allow: false,
    },

    // Download Options: noopen (IE-specific)
    ieNoOpen: true,

    // Origin-Agent-Cluster: ?1
    originAgentCluster: true,

    // X-Permitted-Cross-Domain-Policies: none
    permittedCrossDomainPolicies: {
      permittedPolicies: 'none',
    },

    // X-Powered-By: removed
    hidePoweredBy: true,
  });

  // Override CSP for Swagger UI routes
  // Use onRequest hook to set CSP before response
  app.addHook('onRequest', async (request, reply) => {
    const url = request.url;

    // Check if this is a Swagger UI route
    if (url.startsWith(swaggerPrefix)) {
      // Build CSP header value for Swagger UI
      const cspParts = Object.entries(SWAGGER_CSP_DIRECTIVES).map(([key, values]) => {
        // Convert camelCase to kebab-case
        const directive = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        return `${directive} ${values.join(' ')}`;
      });

      // Set relaxed CSP for Swagger UI
      reply.header('Content-Security-Policy', cspParts.join('; '));
    }
  });

  app.log.info({ hsts: enableHsts, swaggerPrefix }, 'Security headers plugin registered');
}

export const helmetPlugin = fp(helmetPluginImpl, {
  name: 'helmet-plugin',
  fastify: '4.x',
});
