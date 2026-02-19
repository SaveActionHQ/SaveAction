/**
 * Project Routes Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import projectRoutes from './projects.js';
import { DEFAULT_PROJECT_NAME } from '../db/schema/projects.js';

// Mock project data
const mockProject = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  userId: 'user-123',
  name: 'Test Project',
  description: 'Test description',
  color: '#3B82F6',
  isDefault: false,
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockDefaultProject = {
  ...mockProject,
  id: '550e8400-e29b-41d4-a716-446655440001',
  name: DEFAULT_PROJECT_NAME,
  isDefault: true,
  description: 'Your default project for test recordings',
};

// Mock database
const createMockDb = () => {
  return {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockProject]),
      }),
    }),
    select: vi.fn().mockImplementation((...args) => {
      // Default to returning mockProject
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockProject]),
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([mockProject]),
              }),
            }),
          }),
        }),
      };
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockProject]),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: mockProject.id }]),
      }),
    }),
  };
};

describe('Project Routes', () => {
  let app: FastifyInstance;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(async () => {
    mockDb = createMockDb();
    app = Fastify();

    // Mock JWT verification
    app.decorate('jwt', {} as any);
    app.decorateRequest('jwtVerify', async function () {
      (this as any).user = { sub: 'user-123', email: 'test@example.com' };
    });

    // Mock authenticate decorator (dual-auth: JWT + API tokens)
    app.decorate('authenticate', async function (request: any, reply: any) {
      try {
        await request.jwtVerify();
        request.jwtPayload = request.user;
      } catch {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }
    });

    // Register routes
    await app.register(projectRoutes, {
      prefix: '/api/projects',
      db: mockDb as any,
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  describe('POST /api/projects - Create Project', () => {
    it('should create a project successfully', async () => {
      // Mock name availability check
      let callCount = 0;
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              callCount++;
              // First call is name check (returns empty), subsequent calls return project
              return Promise.resolve(callCount === 1 ? [] : [mockProject]);
            }),
          }),
        }),
      }));

      const response = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: {
          name: 'New Project',
          description: 'A new test project',
          color: '#FF0000',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.id).toBeDefined();
    });

    it('should require name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: {
          description: 'Missing name',
        },
      });

      expect(response.statusCode).toBe(400);
      // Fastify schema validation returns its own format
    });

    it('should validate name length', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: {
          name: 'a'.repeat(256),
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should require authentication', async () => {
      // Create app without JWT
      const unauthApp = Fastify();
      unauthApp.decorate('jwt', {} as any);
      unauthApp.decorateRequest('jwtVerify', async function () {
        throw new Error('Unauthorized');
      });

      // Mock authenticate decorator
      unauthApp.decorate('authenticate', async function (request: any, reply: any) {
        try {
          await request.jwtVerify();
          request.jwtPayload = request.user;
        } catch {
          return reply.status(401).send({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
          });
        }
      });

      await unauthApp.register(projectRoutes, {
        prefix: '/api/projects',
        db: mockDb as any,
      });
      await unauthApp.ready();

      const response = await unauthApp.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { name: 'Test' },
      });

      expect(response.statusCode).toBe(401);

      await unauthApp.close();
    });
  });

  describe('GET /api/projects - List Projects', () => {
    it('should return paginated projects', async () => {
      // Mock for paginated query - return count and projects
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockResolvedValue([{ count: 1 }]),
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([mockProject]),
              }),
            }),
          })),
        }),
      }));

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.pagination).toBeDefined();
    });

    it('should support search parameter', async () => {
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockResolvedValue([{ count: 1 }]),
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([mockProject]),
              }),
            }),
          })),
        }),
      }));

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects?search=test',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should support pagination parameters', async () => {
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockResolvedValue([{ count: 1 }]),
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([mockProject]),
              }),
            }),
          })),
        }),
      }));

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects?page=2&limit=10',
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /api/projects/default - Get Default Project', () => {
    it('should return the default project', async () => {
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockDefaultProject]),
          }),
        }),
      }));

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/default',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.isDefault).toBe(true);
    });

    it('should create default project if none exists', async () => {
      let callCount = 0;
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              callCount++;
              // First call finds no default, subsequent calls should return it
              return Promise.resolve(callCount === 1 ? [] : [mockDefaultProject]);
            }),
          }),
        }),
      }));

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockDefaultProject]),
        }),
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/default',
      });

      expect(response.statusCode).toBe(200);
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('GET /api/projects/:id - Get Project', () => {
    it('should return a project by ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/projects/${mockProject.id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(mockProject.id);
    });

    it('should return 404 when project not found', async () => {
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }));

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/00000000-0000-0000-0000-000000000000',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /api/projects/:id - Update Project', () => {
    it('should update a project', async () => {
      // Create a select mock that tracks calls via closure
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        const currentCall = selectCallCount;
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(() => {
                // First call: findByIdAndUser - project exists
                // Second call: isNameAvailable - no conflict found
                if (currentCall === 1) return Promise.resolve([mockProject]);
                return Promise.resolve([]); // Name available
              }),
            }),
          }),
        };
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ ...mockProject, name: 'Updated Name' }]),
          }),
        }),
      });

      const response = await app.inject({
        method: 'PUT',
        url: `/api/projects/${mockProject.id}`,
        payload: {
          name: 'Updated Name',
          description: 'Updated description',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should return error when project not found for update', async () => {
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }));

      const response = await app.inject({
        method: 'PUT',
        url: `/api/projects/${mockProject.id}`,
        payload: { name: 'Test' },
      });

      // API throws validation or not found, we get 400 or 404
      expect([400, 404]).toContain(response.statusCode);
    });
  });

  describe('DELETE /api/projects/:id - Delete Project', () => {
    it('should delete a project', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/projects/${mockProject.id}`,
      });

      expect(response.statusCode).toBe(204);
    });

    it('should not allow deleting default project', async () => {
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockDefaultProject]),
          }),
        }),
      }));

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/projects/${mockDefaultProject.id}`,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('CANNOT_DELETE_DEFAULT_PROJECT');
    });

    it('should return error when project not found for delete', async () => {
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }));

      // Mock softDelete to return false when project not found
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/projects/${mockProject.id}`,
      });

      // API returns 400 or 404 when project not found
      expect([400, 404]).toContain(response.statusCode);
    });
  });
});
