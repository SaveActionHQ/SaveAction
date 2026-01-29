/**
 * Recording Routes Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import recordingRoutes from './recordings.js';
import type { RecordingData } from '../db/schema/recordings.js';

// Sample recording data
const sampleRecordingData: RecordingData = {
  id: 'rec_1234567890',
  testName: 'Test Recording',
  url: 'https://example.com',
  startTime: '2026-01-01T00:00:00Z',
  endTime: '2026-01-01T00:01:00Z',
  viewport: { width: 1920, height: 1080 },
  userAgent: 'Mozilla/5.0',
  actions: [
    { id: 'act_001', type: 'click', timestamp: 1000, url: 'https://example.com' },
    { id: 'act_002', type: 'input', timestamp: 2000, url: 'https://example.com' },
  ],
  version: '1.0.0',
};

// Mock database results
const mockRecording = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  userId: 'user-123',
  name: 'Test Recording',
  url: 'https://example.com',
  description: 'Test description',
  originalId: 'rec_1234567890',
  tags: '["smoke", "login"]',
  data: sampleRecordingData,
  actionCount: '2',
  estimatedDurationMs: '60000',
  schemaVersion: '1.0.0',
  dataSizeBytes: '500',
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

// Mock database
const createMockDb = () => {
  return {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockRecording]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockRecording]),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([mockRecording]),
            }),
          }),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockRecording]),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: mockRecording.id }]),
      }),
    }),
  };
};

describe('Recording Routes', () => {
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

    // Register routes
    await app.register(recordingRoutes, {
      prefix: '/api/recordings',
      db: mockDb as any,
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/recordings', () => {
    it('should create a recording successfully', async () => {
      // Reset select mock to return null for findByOriginalId (duplicate check)
      // and then return recording for count check
      let selectCallCount = 0;
      mockDb.select = vi.fn(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // findByOriginalId - no duplicate
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          };
        }
        // countByUserId
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        };
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/recordings',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          name: 'My Recording',
          description: 'Test description',
          tags: ['smoke'],
          data: sampleRecordingData,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.id).toBeDefined();
    });

    it('should create recording without optional fields', async () => {
      // Reset select mock for duplicate check
      let selectCallCount = 0;
      mockDb.select = vi.fn(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          };
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        };
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/recordings',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          data: sampleRecordingData,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
    });

    it('should return 400 for invalid data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/recordings',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          data: { invalid: 'data' },
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 without authentication', async () => {
      // Create app without auth mock
      const unauthApp = Fastify();
      unauthApp.decorate('jwt', {} as any);
      unauthApp.decorateRequest('jwtVerify', async function () {
        throw new Error('Unauthorized');
      });
      await unauthApp.register(recordingRoutes, {
        prefix: '/api/recordings',
        db: mockDb as any,
      });
      await unauthApp.ready();

      const response = await unauthApp.inject({
        method: 'POST',
        url: '/api/recordings',
        payload: { data: sampleRecordingData },
      });

      expect(response.statusCode).toBe(401);
      await unauthApp.close();
    });
  });

  describe('GET /api/recordings', () => {
    it('should list recordings', async () => {
      // Mock count and data queries
      let callCount = 0;
      mockDb.select = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count: 1 }]),
            }),
          };
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([mockRecording]),
                }),
              }),
            }),
          }),
        };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/recordings',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.pagination).toBeDefined();
    });

    it('should support pagination parameters', async () => {
      let callCount = 0;
      mockDb.select = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count: 50 }]),
            }),
          };
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/recordings?page=2&limit=10',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.pagination.page).toBe(2);
      expect(body.pagination.limit).toBe(10);
    });

    it('should support search filter', async () => {
      let callCount = 0;
      mockDb.select = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count: 0 }]),
            }),
          };
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/recordings?search=login',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should support sorting', async () => {
      let callCount = 0;
      mockDb.select = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count: 0 }]),
            }),
          };
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/recordings?sortBy=name&sortOrder=asc',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /api/recordings/tags', () => {
    it('should return user tags', async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockResolvedValue([{ tags: '["smoke", "login"]' }, { tags: '["smoke", "checkout"]' }]),
        }),
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/recordings/tags',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  describe('GET /api/recordings/:id', () => {
    it('should return a recording by ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/recordings/${mockRecording.id}`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.id).toBe(mockRecording.id);
    });

    it('should return 404 when recording not found', async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/recordings/550e8400-e29b-41d4-a716-446655440001',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('RECORDING_NOT_FOUND');
    });

    it('should return 403 when user does not own recording', async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ ...mockRecording, userId: 'other-user' }]),
          }),
        }),
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/recordings/${mockRecording.id}`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('GET /api/recordings/:id/export', () => {
    it('should export recording as JSON', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/recordings/${mockRecording.id}/export`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers['content-disposition']).toContain('attachment');

      const body = JSON.parse(response.payload);
      expect(body.id).toBe(sampleRecordingData.id);
      expect(body.testName).toBe(sampleRecordingData.testName);
    });

    it('should return 404 for non-existent recording', async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/recordings/550e8400-e29b-41d4-a716-446655440001/export',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /api/recordings/:id', () => {
    it('should update a recording', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/recordings/${mockRecording.id}`,
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          name: 'Updated Name',
          tags: ['updated'],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
    });

    it('should return 404 when recording not found', async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const response = await app.inject({
        method: 'PUT',
        url: '/api/recordings/550e8400-e29b-41d4-a716-446655440001',
        headers: { authorization: 'Bearer valid-token' },
        payload: { name: 'Updated' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/recordings/:id', () => {
    it('should soft delete a recording', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/recordings/${mockRecording.id}`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.message).toContain('deleted');
    });

    it('should return 404 when recording not found', async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/recordings/550e8400-e29b-41d4-a716-446655440001',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/recordings/:id/restore', () => {
    it('should restore a deleted recording', async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ ...mockRecording, deletedAt: new Date() }]),
          }),
        }),
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/recordings/${mockRecording.id}/restore`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
    });

    it('should return error when recording is not deleted', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/recordings/${mockRecording.id}/restore`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/recordings/:id/permanent', () => {
    it('should permanently delete a recording', async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: mockRecording.id }]),
          }),
        }),
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/recordings/${mockRecording.id}/permanent`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.message).toContain('permanently');
    });

    it('should return 404 when not owner', async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/recordings/${mockRecording.id}/permanent`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors', async () => {
      mockDb.select = vi.fn().mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/recordings/${mockRecording.id}`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });
});
