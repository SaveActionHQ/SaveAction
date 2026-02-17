/**
 * Test Routes Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import testRoutes from './tests.js';

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440002';

// Mock test data
const mockTest = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  userId: 'user-123',
  projectId: PROJECT_ID,
  suiteId: '550e8400-e29b-41d4-a716-446655440003',
  name: 'Login Test',
  description: 'Test login flow',
  slug: 'login-test',
  recordingData: { id: 'rec_1', testName: 'Login', url: 'https://example.com', actions: [] },
  recordingUrl: 'https://example.com',
  actionCount: 5,
  browsers: ['chromium'],
  config: {
    headless: true,
    video: false,
    screenshot: 'only-on-failure',
    timeout: 30000,
    retries: 0,
    slowMo: 0,
  },
  displayOrder: 0,
  lastRunId: null,
  lastRunAt: null,
  lastRunStatus: null,
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockDefaultSuite = {
  id: '550e8400-e29b-41d4-a716-446655440004',
  userId: 'user-123',
  projectId: PROJECT_ID,
  name: 'Unorganized',
  description: 'Default suite',
  displayOrder: 0,
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockSuite = {
  id: '550e8400-e29b-41d4-a716-446655440003',
  userId: 'user-123',
  projectId: PROJECT_ID,
  name: 'Login Tests',
  description: null,
  displayOrder: 1,
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

// Mock database
const createMockDb = () => {
  return {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockTest]),
      }),
    }),
    select: vi.fn().mockImplementation(() => {
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockTest]),
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([mockTest]),
              }),
            }),
          }),
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([{
                    ...mockTest,
                    suiteName: 'Login Tests',
                  }]),
                }),
              }),
            }),
          }),
        }),
      };
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockTest]),
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

describe('Test Routes', () => {
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

    await app.register(testRoutes, {
      prefix: '/api/projects/:projectId/tests',
      db: mockDb as any,
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  describe('POST /tests - Create Test', () => {
    it('should create a test successfully', async () => {
      // Mock: count returns low, default suite exists, name available, create
      let callCount = 0;
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              callCount++;
              // 1st = countByProject, 2nd = getOrCreateDefaultSuite (findDefaultSuite), 3rd = isNameAvailable
              if (callCount === 1) return Promise.resolve([{ count: 1 }]);
              if (callCount === 2) return Promise.resolve([mockDefaultSuite]);
              return Promise.resolve([{ count: 0 }]); // name available
            }),
          }),
        }),
      }));

      const response = await app.inject({
        method: 'POST',
        url: `/api/projects/${PROJECT_ID}/tests`,
        payload: {
          name: 'New Test',
          recordingData: { id: 'rec_1', actions: [] },
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
        url: `/api/projects/${PROJECT_ID}/tests`,
        payload: {
          recordingData: { id: 'rec_1' },
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should require recordingData', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/projects/${PROJECT_ID}/tests`,
        payload: {
          name: 'Test',
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

      await unauthApp.register(testRoutes, {
        prefix: '/api/projects/:projectId/tests',
        db: mockDb as any,
      });
      await unauthApp.ready();

      const response = await unauthApp.inject({
        method: 'POST',
        url: `/api/projects/${PROJECT_ID}/tests`,
        payload: {
          name: 'Test',
          recordingData: {},
        },
      });

      expect(response.statusCode).toBe(401);
      await unauthApp.close();
    });
  });

  describe('GET /tests - List Tests', () => {
    it('should return paginated tests', async () => {
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockResolvedValue([{ count: 1 }]),
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([mockTest]),
              }),
            }),
          })),
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([{
                    ...mockTest,
                    suiteName: 'Login Tests',
                  }]),
                }),
              }),
            }),
          }),
        }),
      }));

      const response = await app.inject({
        method: 'GET',
        url: `/api/projects/${PROJECT_ID}/tests`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.pagination).toBeDefined();
    });

    it('should accept filter query parameters', async () => {
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
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        }),
      }));

      const response = await app.inject({
        method: 'GET',
        url: `/api/projects/${PROJECT_ID}/tests?page=1&limit=10&search=login&status=completed`,
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /tests/:testId - Get Test', () => {
    it('should return a test by ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/projects/${PROJECT_ID}/tests/${mockTest.id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
    });

    it('should return 404 when test not found', async () => {
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }));

      const response = await app.inject({
        method: 'GET',
        url: `/api/projects/${PROJECT_ID}/tests/${mockTest.id}`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /tests/by-slug/:slug - Get Test by Slug', () => {
    it('should return a test by slug', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/projects/${PROJECT_ID}/tests/by-slug/login-test`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
    });

    it('should return 404 when slug not found', async () => {
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }));

      const response = await app.inject({
        method: 'GET',
        url: `/api/projects/${PROJECT_ID}/tests/by-slug/non-existent`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /tests/:testId - Update Test', () => {
    it('should update a test', async () => {
      let callCount = 0;
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              callCount++;
              // 1st = findByIdAndUser (exists), 2nd = isNameAvailable
              if (callCount === 1) return Promise.resolve([mockTest]);
              return Promise.resolve([{ count: 0 }]);
            }),
          }),
        }),
      }));

      const response = await app.inject({
        method: 'PUT',
        url: `/api/projects/${PROJECT_ID}/tests/${mockTest.id}`,
        payload: {
          name: 'Updated Test Name',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('PUT /tests/move - Move Tests', () => {
    it('should move tests between suites', async () => {
      // Mock: findByIdAndUser for suite, then moveToSuite
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockSuite]),
          }),
        }),
      }));

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockTest]),
          }),
        }),
      });

      const response = await app.inject({
        method: 'PUT',
        url: `/api/projects/${PROJECT_ID}/tests/move`,
        payload: {
          testIds: [mockTest.id],
          targetSuiteId: mockSuite.id,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('DELETE /tests/:testId - Delete Test', () => {
    it('should delete a test', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/projects/${PROJECT_ID}/tests/${mockTest.id}`,
      });

      // Should succeed
      expect([200, 204]).toContain(response.statusCode);
    });

    it('should return 404 when test not found', async () => {
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }));

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/projects/${PROJECT_ID}/tests/${mockTest.id}`,
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
