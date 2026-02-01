/**
 * Swagger/OpenAPI Plugin
 *
 * Provides auto-generated API documentation using @fastify/swagger
 * and interactive Swagger UI at /api/docs
 */

import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

/**
 * Swagger plugin options
 */
export interface SwaggerPluginOptions {
  /** Base URL for the API (e.g., http://localhost:3000) */
  baseUrl?: string;
  /** Enable Swagger UI (default: true) */
  enableUi?: boolean;
  /** Route prefix for Swagger UI (default: /api/docs) */
  uiPrefix?: string;
}

/**
 * Swagger plugin implementation
 */
const swaggerPluginImpl: FastifyPluginAsync<SwaggerPluginOptions> = async (
  fastify: FastifyInstance,
  options: SwaggerPluginOptions
) => {
  const { baseUrl = 'http://localhost:3000', enableUi = true, uiPrefix = '/api/docs' } = options;

  // Register @fastify/swagger for OpenAPI spec generation
  await fastify.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'SaveAction API',
        description: `
SaveAction is an open-source test automation platform that replays browser interactions recorded by a Chrome extension.

## Authentication

The API supports two authentication methods:

### 1. JWT Bearer Token (for Web UI)
Used for browser-based authentication with access and refresh tokens.

\`\`\`
Authorization: Bearer <access_token>
\`\`\`

### 2. API Token (for CI/CD)
Used for programmatic access with long-lived tokens.

\`\`\`
Authorization: Bearer sa_live_<token>
\`\`\`

## Error Responses

All errors follow a consistent format:

\`\`\`json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {},
    "requestId": "uuid"
  }
}
\`\`\`

## Rate Limits

- Default: 100 requests/minute per IP
- Auth endpoints: 20 requests/minute per IP
- Authenticated users: 200 requests/minute
        `.trim(),
        version: '0.1.0',
        contact: {
          name: 'SaveAction Support',
          url: 'https://github.com/SaveActionHQ/SaveAction',
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
      },
      externalDocs: {
        description: 'Full Documentation',
        url: 'https://github.com/SaveActionHQ/SaveAction/tree/main/docs',
      },
      servers: [
        {
          url: baseUrl,
          description: 'Current Server',
        },
      ],
      tags: [
        {
          name: 'Health',
          description: 'Health check endpoints for monitoring and Kubernetes probes',
        },
        {
          name: 'Authentication',
          description: 'User registration, login, logout, and password management',
        },
        {
          name: 'API Tokens',
          description: 'Manage API tokens for programmatic access',
        },
        {
          name: 'Recordings',
          description: 'CRUD operations for test recordings',
        },
        {
          name: 'Runs',
          description: 'Execute test runs and view results',
        },
        {
          name: 'Schedules',
          description: 'Manage scheduled test executions',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT access token obtained from /api/v1/auth/login',
          },
          apiToken: {
            type: 'http',
            scheme: 'bearer',
            description: 'API token in format sa_live_<token>. Create tokens at /api/v1/tokens',
          },
        },
        schemas: {
          Error: {
            type: 'object',
            properties: {
              error: {
                type: 'object',
                properties: {
                  code: {
                    type: 'string',
                    description: 'Error code for programmatic handling',
                    example: 'VALIDATION_ERROR',
                  },
                  message: {
                    type: 'string',
                    description: 'Human-readable error message',
                    example: 'Invalid request body',
                  },
                  details: {
                    type: 'object',
                    description: 'Additional error details (optional)',
                    nullable: true,
                  },
                  requestId: {
                    type: 'string',
                    format: 'uuid',
                    description: 'Request ID for debugging',
                    example: '123e4567-e89b-12d3-a456-426614174000',
                  },
                },
                required: ['code', 'message'],
              },
            },
            required: ['error'],
          },
          User: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
                description: 'Unique user identifier',
              },
              email: {
                type: 'string',
                format: 'email',
                description: 'User email address',
              },
              name: {
                type: 'string',
                nullable: true,
                description: 'User display name',
              },
              isActive: {
                type: 'boolean',
                description: 'Whether the user account is active',
              },
              createdAt: {
                type: 'string',
                format: 'date-time',
                description: 'Account creation timestamp',
              },
              updatedAt: {
                type: 'string',
                format: 'date-time',
                description: 'Last update timestamp',
              },
            },
          },
          Recording: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
                description: 'Unique recording identifier',
              },
              userId: {
                type: 'string',
                format: 'uuid',
                description: 'Owner user ID',
              },
              name: {
                type: 'string',
                description: 'Recording name',
              },
              description: {
                type: 'string',
                nullable: true,
                description: 'Recording description',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Tags for categorization',
              },
              data: {
                type: 'object',
                description: 'Recording data (actions, selectors, etc.)',
              },
              createdAt: {
                type: 'string',
                format: 'date-time',
              },
              updatedAt: {
                type: 'string',
                format: 'date-time',
              },
            },
          },
          Run: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
                description: 'Unique run identifier',
              },
              recordingId: {
                type: 'string',
                format: 'uuid',
                description: 'Recording that was executed',
              },
              userId: {
                type: 'string',
                format: 'uuid',
                description: 'User who triggered the run',
              },
              status: {
                type: 'string',
                enum: ['queued', 'running', 'passed', 'failed', 'cancelled'],
                description: 'Current run status',
              },
              browser: {
                type: 'string',
                enum: ['chromium', 'firefox', 'webkit'],
                description: 'Browser used for execution',
              },
              headless: {
                type: 'boolean',
                description: 'Whether browser ran in headless mode',
              },
              duration: {
                type: 'integer',
                nullable: true,
                description: 'Total execution duration in milliseconds',
              },
              actionsTotal: {
                type: 'integer',
                description: 'Total number of actions',
              },
              actionsPassed: {
                type: 'integer',
                description: 'Number of passed actions',
              },
              actionsFailed: {
                type: 'integer',
                description: 'Number of failed actions',
              },
              errorMessage: {
                type: 'string',
                nullable: true,
                description: 'Error message if run failed',
              },
              startedAt: {
                type: 'string',
                format: 'date-time',
                nullable: true,
              },
              completedAt: {
                type: 'string',
                format: 'date-time',
                nullable: true,
              },
              createdAt: {
                type: 'string',
                format: 'date-time',
              },
            },
          },
          Schedule: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
                description: 'Unique schedule identifier',
              },
              recordingId: {
                type: 'string',
                format: 'uuid',
                description: 'Recording to execute',
              },
              userId: {
                type: 'string',
                format: 'uuid',
                description: 'Owner user ID',
              },
              name: {
                type: 'string',
                description: 'Schedule name',
              },
              cronExpression: {
                type: 'string',
                description: 'Cron expression (e.g., "0 9 * * 1-5")',
              },
              timezone: {
                type: 'string',
                description: 'Timezone (e.g., "America/New_York")',
              },
              status: {
                type: 'string',
                enum: ['active', 'paused'],
                description: 'Schedule status',
              },
              browser: {
                type: 'string',
                enum: ['chromium', 'firefox', 'webkit'],
              },
              headless: {
                type: 'boolean',
              },
              runCount: {
                type: 'integer',
                description: 'Number of times executed',
              },
              lastRunAt: {
                type: 'string',
                format: 'date-time',
                nullable: true,
              },
              nextRunAt: {
                type: 'string',
                format: 'date-time',
                nullable: true,
              },
              createdAt: {
                type: 'string',
                format: 'date-time',
              },
            },
          },
          Pagination: {
            type: 'object',
            properties: {
              page: {
                type: 'integer',
                minimum: 1,
                description: 'Current page number',
              },
              limit: {
                type: 'integer',
                minimum: 1,
                maximum: 100,
                description: 'Items per page',
              },
              total: {
                type: 'integer',
                description: 'Total number of items',
              },
              totalPages: {
                type: 'integer',
                description: 'Total number of pages',
              },
            },
          },
        },
        responses: {
          UnauthorizedError: {
            description: 'Authentication required or invalid token',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: {
                  error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required',
                    requestId: '123e4567-e89b-12d3-a456-426614174000',
                  },
                },
              },
            },
          },
          ForbiddenError: {
            description: 'Insufficient permissions',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: {
                  error: {
                    code: 'FORBIDDEN',
                    message: 'You do not have permission to access this resource',
                    requestId: '123e4567-e89b-12d3-a456-426614174000',
                  },
                },
              },
            },
          },
          NotFoundError: {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: {
                  error: {
                    code: 'NOT_FOUND',
                    message: 'The requested resource was not found',
                    requestId: '123e4567-e89b-12d3-a456-426614174000',
                  },
                },
              },
            },
          },
          ValidationError: {
            description: 'Request validation failed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: {
                  error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Request validation failed',
                    details: {
                      field: 'email',
                      message: 'Invalid email format',
                    },
                    requestId: '123e4567-e89b-12d3-a456-426614174000',
                  },
                },
              },
            },
          },
          InternalError: {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: {
                  error: {
                    code: 'INTERNAL_ERROR',
                    message: 'An unexpected error occurred',
                    requestId: '123e4567-e89b-12d3-a456-426614174000',
                  },
                },
              },
            },
          },
        },
      },
    },
    // Transform the schema for better OpenAPI compatibility
    transform: ({ schema, url }) => {
      // Remove internal schemas that shouldn't be in OpenAPI
      const transformedSchema = { ...schema };

      // Add tags based on URL path
      if (!transformedSchema.tags) {
        if (url.includes('/health') || url.includes('/queues')) {
          transformedSchema.tags = ['Health'];
        } else if (url.includes('/auth')) {
          transformedSchema.tags = ['Authentication'];
        } else if (url.includes('/tokens')) {
          transformedSchema.tags = ['API Tokens'];
        } else if (url.includes('/recordings')) {
          transformedSchema.tags = ['Recordings'];
        } else if (url.includes('/runs')) {
          transformedSchema.tags = ['Runs'];
        } else if (url.includes('/schedules')) {
          transformedSchema.tags = ['Schedules'];
        }
      }

      return { schema: transformedSchema, url };
    },
  });

  // Register Swagger UI (if enabled)
  if (enableUi) {
    await fastify.register(swaggerUi, {
      routePrefix: uiPrefix,
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true,
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        syntaxHighlight: {
          activate: true,
          theme: 'monokai',
        },
      },
      uiHooks: {
        onRequest: function (_request, _reply, next) {
          next();
        },
        preHandler: function (_request, _reply, next) {
          next();
        },
      },
      staticCSP: true,
      transformStaticCSP: (header) => header,
      transformSpecification: (swaggerObject) => {
        return swaggerObject;
      },
      transformSpecificationClone: true,
    });

    fastify.log.info(`Swagger UI available at ${uiPrefix}`);
  }
};

/**
 * Swagger plugin (with encapsulation broken for global availability)
 */
export const swaggerPlugin = fp(swaggerPluginImpl, {
  name: 'swagger-plugin',
});

export default swaggerPlugin;
