/**
 * Project Routes
 *
 * Handles project CRUD operations.
 * All routes require JWT authentication.
 */

import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import {
  ProjectService,
  ProjectError,
  createProjectSchema,
  updateProjectSchema,
  listProjectsQuerySchema,
} from '../services/ProjectService.js';
import { ProjectRepository } from '../repositories/ProjectRepository.js';
import type { Database } from '../db/index.js';
import { requireScopes } from '../plugins/jwt.js';
import { z } from 'zod';

/**
 * Project routes options
 */
interface ProjectRoutesOptions {
  db: Database;
  maxProjectsPerUser?: number;
}

/**
 * Handle Project errors
 */
function handleProjectError(error: unknown, reply: FastifyReply): FastifyReply {
  if (error instanceof ProjectError) {
    return reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }

  if (error instanceof z.ZodError) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: error.errors,
      },
    });
  }

  // Log unexpected errors
  console.error('Unexpected Project error:', error);

  return reply.status(500).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}

/**
 * Project routes plugin
 */
const projectRoutes: FastifyPluginAsync<ProjectRoutesOptions> = async (fastify, options) => {
  const { db, maxProjectsPerUser } = options;

  // Create repository and service
  const projectRepository = new ProjectRepository(db);
  const projectService = new ProjectService(projectRepository, {
    maxProjectsPerUser,
  });

  // All routes require authentication (JWT or API token)
  fastify.addHook('onRequest', async (request, reply) => {
    await fastify.authenticate(request, reply);

    // Scope enforcement for API token users
    if (request.apiToken) {
      const isRead = request.method === 'GET' || request.method === 'HEAD';
      const scope = isRead ? 'projects:read' : 'projects:write';
      if (!requireScopes(request, reply, [scope as 'projects:read' | 'projects:write'])) return;
    }
  });

  /**
   * POST /projects - Create a new project
   */
  fastify.post(
    '/',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            slug: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string', maxLength: 2000, nullable: true },
            color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$', nullable: true },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  slug: { type: 'string' },
                  description: { type: 'string', nullable: true },
                  color: { type: 'string', nullable: true },
                  isDefault: { type: 'boolean' },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        const result = await projectService.createProject(
          userId,
          request.body as z.infer<typeof createProjectSchema>
        );

        return reply.status(201).send({
          success: true,
          data: result,
        });
      } catch (error) {
        return handleProjectError(error, reply);
      }
    }
  );

  /**
   * GET /projects - List projects with filtering and pagination
   */
  fastify.get(
    '/',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100 },
            search: { type: 'string', maxLength: 255 },
            sortBy: { type: 'string', enum: ['name', 'createdAt', 'updatedAt'] },
            sortOrder: { type: 'string', enum: ['asc', 'desc'] },
            includeDeleted: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        const query = listProjectsQuerySchema.parse(request.query);
        const result = await projectService.listProjects(userId, query);

        return reply.send({
          success: true,
          data: result.data,
          pagination: result.pagination,
        });
      } catch (error) {
        return handleProjectError(error, reply);
      }
    }
  );

  /**
   * GET /projects/default - Get the user's default project
   */
  fastify.get(
    '/default',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  slug: { type: 'string' },
                  description: { type: 'string', nullable: true },
                  color: { type: 'string', nullable: true },
                  isDefault: { type: 'boolean' },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        const result = await projectService.getDefaultProject(userId);

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        return handleProjectError(error, reply);
      }
    }
  );

  /**
   * GET /projects/:id - Get a project by ID
   */
  fastify.get<{
    Params: { id: string };
  }>(
    '/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  slug: { type: 'string' },
                  description: { type: 'string', nullable: true },
                  color: { type: 'string', nullable: true },
                  isDefault: { type: 'boolean' },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        const result = await projectService.getProject(userId, request.params.id);

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        return handleProjectError(error, reply);
      }
    }
  );

  /**
   * PUT /projects/:id - Update a project
   */
  fastify.put<{
    Params: { id: string };
  }>(
    '/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            slug: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string', maxLength: 2000, nullable: true },
            color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$', nullable: true },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  slug: { type: 'string' },
                  description: { type: 'string', nullable: true },
                  color: { type: 'string', nullable: true },
                  isDefault: { type: 'boolean' },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        const result = await projectService.updateProject(
          userId,
          request.params.id,
          request.body as z.infer<typeof updateProjectSchema>
        );

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        return handleProjectError(error, reply);
      }
    }
  );

  /**
   * DELETE /projects/:id - Delete a project (soft delete)
   */
  fastify.delete<{
    Params: { id: string };
  }>(
    '/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          204: {
            type: 'null',
            description: 'No content - project deleted successfully',
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        await projectService.deleteProject(userId, request.params.id);

        return reply.status(204).send();
      } catch (error) {
        return handleProjectError(error, reply);
      }
    }
  );

  /**
   * GET /projects/check-slug/:slug - Check if a slug is available
   */
  fastify.get<{
    Params: { slug: string };
    Querystring: { excludeProjectId?: string };
  }>(
    '/check-slug/:slug',
    {
      schema: {
        params: {
          type: 'object',
          required: ['slug'],
          properties: {
            slug: { type: 'string', minLength: 1, maxLength: 255 },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            excludeProjectId: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  available: { type: 'boolean' },
                  slug: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        const available = await projectService.checkSlugAvailability(
          userId,
          request.params.slug,
          request.query.excludeProjectId
        );

        return reply.send({
          success: true,
          data: { available, slug: request.params.slug },
        });
      } catch (error) {
        return handleProjectError(error, reply);
      }
    }
  );

  /**
   * GET /projects/by-slug/:slug - Get a project by slug
   */
  fastify.get<{
    Params: { slug: string };
  }>(
    '/by-slug/:slug',
    {
      schema: {
        params: {
          type: 'object',
          required: ['slug'],
          properties: {
            slug: { type: 'string', minLength: 1, maxLength: 255 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  slug: { type: 'string' },
                  description: { type: 'string', nullable: true },
                  color: { type: 'string', nullable: true },
                  isDefault: { type: 'boolean' },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { sub: string }).sub;
        const result = await projectService.getProjectBySlug(userId, request.params.slug);

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        return handleProjectError(error, reply);
      }
    }
  );
};

export default projectRoutes;
