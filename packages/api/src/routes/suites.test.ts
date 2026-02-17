/**
 * Suite Routes Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import suiteRoutes from './suites.js';

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440002';

// Mock suite data
const mockSuite = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  userId: 'user-123',
  projectId: PROJECT_ID,
  name: 'Login Tests',
  description: 'Tests for login flow',
  displayOrder: 1,
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockDefaultSuite = {
  ...mockSuite,
  id: '550e8400-e29b-41d4-a716-446655440001',
  name: 'Unorganized',
  description: 'Default suite for ungrouped tests',
  displayOrder: 0,
};

// Mock database
const createMockDb = () => {
  return {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockSuite]),
      }),
    }),
    select: vi.fn().mockImplementation(() => {
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockSuite]),
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([mockSuite]),
              }),
            }),
          }),
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue([{
                  ...mockSuite,
                  testCount: 5,
                  passedCount: 3,
                  failedCount: 1,
                }]),
              }),
            }),
          }),
        }),
      };
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockSuite]),
        }),
      }),
    }),
    transaction: vi.fn().mockImplementation(async (fn: any) => {
      await fn({
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      });
    }),
  };
};

describe('Suite Routes', () => {
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

    await app.register(suiteRoutes, {
      prefix: '/api/projects/:projectId/suites',
      db: mockDb as any,
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  describe('POST /suites - Create Suite', () => {
    it('should create a suite successfully', async () => {
      // Mock: count returns low number, name is available, create returns suite
      let callCount = 0;
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              callCount++;
              // First call = count (returns low), second = name check (available)
              if (callCount === 1) return Promise.resolve([{ count: 1 }]);
              return Promise.resolve([]);
            }),
          }),
        }),
      }));

      const response = await app.inject({
        method: 'POST',
        url: `/api/projects/${PROJECT_ID}/suites`,
        payload: {
          name: 'New Suite',
          description: 'A test suite',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
    });

    it('should require name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/projects/${PROJECT_ID}/suites`,
        payload: {
          description: 'Missing name',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should require authentication', async () => {
      const unauthApp = Fastify();
      unauthApp.decorate('jwt', {} as any);
      unauthApp.decorateRequest('jwtVerify', async function () {
        throw new Error('Unauthorized');
      });

      await unauthApp.register(suiteRoutes, {
        prefix: '/api/projects/:projectId/suites',
        db: mockDb as any,
      });
      await unauthApp.ready();

      const response = await unauthApp.inject({
        method: 'POST',
        url: `/api/projects/${PROJECT_ID}/suites`,
        payload: { name: 'Test' },
      });

      expect(response.statusCode).toBe(401);
      await unauthApp.close();
    });
  });

  describe('GET /suites - List Suites', () => {
    it('should return paginated suites', async () => {
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockResolvedValue([{ count: 1 }]),
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([mockSuite]),
              }),
            }),
          })),
        }),
      }));

      const response = await app.inject({
        method: 'GET',
        url: `/api/projects/${PROJECT_ID}/suites`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.pagination).toBeDefined();
    });

    it('should accept query parameters', async () => {
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockResolvedValue([{ count: 0 }]),
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          })),
        }),
      }));

      const response = await app.inject({
        method: 'GET',
        url: `/api/projects/${PROJECT_ID}/suites?page=1&limit=10&search=login`,
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /suites/all - List All With Stats', () => {
    it('should return all suites with stats', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/projects/${PROJECT_ID}/suites/all`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
    });
  });

  describe('GET /suites/:suiteId - Get Suite', () => {
    it('should return a suite by ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/projects/${PROJECT_ID}/suites/${mockSuite.id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
    });

    it('should return 404 when suite not found', async () => {
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }));

      const response = await app.inject({
        method: 'GET',
        url: `/api/projects/${PROJECT_ID}/suites/${mockSuite.id}`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /suites/:suiteId - Update Suite', () => {
    it('should update a suite', async () => {
      // First call = findByIdAndUser, then name check, then update
      let callCount = 0;
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) return Promise.resolve([mockSuite]);
              return Promise.resolve([{ count: 0 }]); // name available
            }),
          }),
        }),
      }));

      const response = await app.inject({
        method: 'PUT',
        url: `/api/projects/${PROJECT_ID}/suites/${mockSuite.id}`,
        payload: {
          name: 'Updated Suite',
          description: 'Updated description',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('DELETE /suites/:suiteId - Delete Suite', () => {
    it('should delete a suite and move tests', async () => {
      // Mock: findAllBySuite returns empty (no tests to move), findByIdAndUser returns suite
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockSuite]),
            orderBy: vi.fn().mockResolvedValue([]), // findAllBySuite returns no tests
          }),
        }),
      }));

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/projects/${PROJECT_ID}/suites/${mockSuite.id}`,
      });

      // Should succeed (204) or handle the soft delete
      expect([204, 200]).toContain(response.statusCode);
    });

    it('should return 404 when suite not found', async () => {
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      }));

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/projects/${PROJECT_ID}/suites/${mockSuite.id}`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /suites/reorder - Reorder Suites', () => {
    it('should reorder suites', async () => {
      // Mock: findAllByProject returns suites with matching IDs
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([mockDefaultSuite, mockSuite]),
          }),
        }),
      }));

      const response = await app.inject({
        method: 'PUT',
        url: `/api/projects/${PROJECT_ID}/suites/reorder`,
        payload: {
          suiteIds: [mockDefaultSuite.id, mockSuite.id],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });
});
