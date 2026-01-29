/**
 * RecordingRepository Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecordingRepository } from './RecordingRepository.js';
import type { RecordingData } from '../db/schema/recordings.js';

// Mock database
const createMockDb = () => {
  const mockResult = {
    id: 'rec-123',
    userId: 'user-123',
    name: 'Test Recording',
    url: 'https://example.com',
    description: 'Test description',
    originalId: 'rec_1234567890',
    tags: '["smoke", "login"]',
    data: {
      id: 'rec_1234567890',
      testName: 'Test Recording',
      url: 'https://example.com',
      startTime: '2026-01-01T00:00:00Z',
      endTime: '2026-01-01T00:01:00Z',
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0',
      actions: [{ id: 'act_001', type: 'click', timestamp: 1000, url: 'https://example.com' }],
      version: '1.0.0',
    },
    actionCount: '1',
    estimatedDurationMs: '60000',
    schemaVersion: '1.0.0',
    dataSizeBytes: '500',
    deletedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  return {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockResult]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockResult]),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([mockResult]),
            }),
          }),
        }),
        orderBy: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockResult]),
          }),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockResult]),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'rec-123' }]),
      }),
    }),
  };
};

describe('RecordingRepository', () => {
  let repository: RecordingRepository;
  let mockDb: ReturnType<typeof createMockDb>;

  const sampleRecordingData: RecordingData = {
    id: 'rec_1234567890',
    testName: 'Test Recording',
    url: 'https://example.com',
    startTime: '2026-01-01T00:00:00Z',
    endTime: '2026-01-01T00:01:00Z',
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0',
    actions: [{ id: 'act_001', type: 'click', timestamp: 1000, url: 'https://example.com' }],
    version: '1.0.0',
  };

  beforeEach(() => {
    mockDb = createMockDb();
    repository = new RecordingRepository(mockDb as any);
  });

  describe('create', () => {
    it('should create a recording successfully', async () => {
      const createData = {
        userId: 'user-123',
        name: 'Test Recording',
        url: 'https://example.com',
        description: 'Test description',
        originalId: 'rec_1234567890',
        tags: ['smoke', 'login'],
        data: sampleRecordingData,
      };

      const result = await repository.create(createData);

      expect(result).toBeDefined();
      expect(result.id).toBe('rec-123');
      expect(result.name).toBe('Test Recording');
      expect(result.tags).toEqual(['smoke', 'login']);
      expect(result.actionCount).toBe(1);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should handle recording without optional fields', async () => {
      const createData = {
        userId: 'user-123',
        name: 'Simple Recording',
        url: 'https://example.com',
        data: sampleRecordingData,
      };

      const result = await repository.create(createData);

      expect(result).toBeDefined();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should calculate data size', async () => {
      const createData = {
        userId: 'user-123',
        name: 'Test Recording',
        url: 'https://example.com',
        data: sampleRecordingData,
      };

      await repository.create(createData);

      const insertCall = mockDb.insert.mock.results[0].value.values;
      expect(insertCall).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should find a recording by ID', async () => {
      const result = await repository.findById('rec-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('rec-123');
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return null when recording not found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should include deleted recordings when flag is true', async () => {
      await repository.findById('rec-123', true);

      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe('findByOriginalId', () => {
    it('should find a recording by original ID', async () => {
      const result = await repository.findByOriginalId('user-123', 'rec_1234567890');

      expect(result).toBeDefined();
      expect(result?.originalId).toBe('rec_1234567890');
    });

    it('should return null when not found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.findByOriginalId('user-123', 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findMany', () => {
    it('should list recordings with pagination', async () => {
      // Mock count query
      const mockSelectForCount = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 10 }]),
        }),
      });

      // Mock data query
      const mockSelectForData = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([
                  {
                    id: 'rec-123',
                    userId: 'user-123',
                    name: 'Test Recording',
                    url: 'https://example.com',
                    description: 'Test',
                    originalId: 'rec_123',
                    tags: '["smoke"]',
                    actionCount: '5',
                    estimatedDurationMs: '30000',
                    schemaVersion: '1.0.0',
                    dataSizeBytes: '1000',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                ]),
              }),
            }),
          }),
        }),
      });

      let callCount = 0;
      mockDb.select = vi.fn(() => {
        callCount++;
        if (callCount === 1) return mockSelectForCount();
        return mockSelectForData();
      });

      const result = await repository.findMany({ userId: 'user-123' }, { page: 1, limit: 20 });

      expect(result.data).toBeDefined();
      expect(result.pagination).toBeDefined();
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
    });

    it('should apply search filter', async () => {
      const mockSelectForCount = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      });

      const mockSelectForData = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });

      let callCount = 0;
      mockDb.select = vi.fn(() => {
        callCount++;
        if (callCount === 1) return mockSelectForCount();
        return mockSelectForData();
      });

      await repository.findMany({ userId: 'user-123', search: 'login' }, { page: 1, limit: 20 });

      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should apply tag filter', async () => {
      const mockSelectForCount = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      });

      const mockSelectForData = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });

      let callCount = 0;
      mockDb.select = vi.fn(() => {
        callCount++;
        if (callCount === 1) return mockSelectForCount();
        return mockSelectForData();
      });

      await repository.findMany(
        { userId: 'user-123', tags: ['smoke', 'critical'] },
        { page: 1, limit: 20 }
      );

      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should apply sorting', async () => {
      const mockSelectForCount = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      const mockSelectForData = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });

      let callCount = 0;
      mockDb.select = vi.fn(() => {
        callCount++;
        if (callCount === 1) return mockSelectForCount();
        return mockSelectForData();
      });

      await repository.findMany({ userId: 'user-123' }, { sortBy: 'name', sortOrder: 'asc' });

      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update a recording successfully', async () => {
      const result = await repository.update('rec-123', 'user-123', {
        name: 'Updated Name',
        tags: ['updated'],
      });

      expect(result).toBeDefined();
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should return null when recording not found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.update('nonexistent', 'user-123', {
        name: 'Updated Name',
      });

      expect(result).toBeNull();
    });

    it('should update recording data and recalculate stats', async () => {
      const newData: RecordingData = {
        ...sampleRecordingData,
        actions: [
          { id: 'act_001', type: 'click', timestamp: 1000, url: 'https://example.com' },
          { id: 'act_002', type: 'input', timestamp: 2000, url: 'https://example.com' },
        ],
      };

      await repository.update('rec-123', 'user-123', { data: newData });

      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('should soft delete a recording', async () => {
      const result = await repository.softDelete('rec-123', 'user-123');

      expect(result).toBe(true);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should return false when recording not found', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.softDelete('nonexistent', 'user-123');

      expect(result).toBe(false);
    });
  });

  describe('restore', () => {
    it('should restore a soft-deleted recording', async () => {
      const result = await repository.restore('rec-123', 'user-123');

      expect(result).toBeDefined();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should return null when recording not found', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.restore('nonexistent', 'user-123');

      expect(result).toBeNull();
    });
  });

  describe('hardDelete', () => {
    it('should permanently delete a recording', async () => {
      const result = await repository.hardDelete('rec-123', 'user-123');

      expect(result).toBe(true);
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('should return false when recording not found', async () => {
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await repository.hardDelete('nonexistent', 'user-123');

      expect(result).toBe(false);
    });
  });

  describe('countByUserId', () => {
    it('should count recordings for a user', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 5 }]),
        }),
      });

      const result = await repository.countByUserId('user-123');

      expect(result).toBe(5);
    });

    it('should include deleted when flag is true', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 10 }]),
        }),
      });

      const result = await repository.countByUserId('user-123', true);

      expect(result).toBe(10);
    });
  });

  describe('isOwner', () => {
    it('should return true when user owns the recording', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'rec-123' }]),
          }),
        }),
      });

      const result = await repository.isOwner('rec-123', 'user-123');

      expect(result).toBe(true);
    });

    it('should return false when user does not own the recording', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.isOwner('rec-123', 'other-user');

      expect(result).toBe(false);
    });
  });

  describe('getTagsByUserId', () => {
    it('should return unique tags for a user', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockResolvedValue([{ tags: '["smoke", "login"]' }, { tags: '["smoke", "checkout"]' }]),
        }),
      });

      const result = await repository.getTagsByUserId('user-123');

      expect(result).toContain('smoke');
      expect(result).toContain('login');
      expect(result).toContain('checkout');
      expect(result.length).toBe(3);
    });

    it('should return empty array when no recordings', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await repository.getTagsByUserId('user-123');

      expect(result).toEqual([]);
    });
  });

  describe('findByTag', () => {
    it('should find recordings by tag', async () => {
      const mockRecording = {
        id: 'rec-123',
        userId: 'user-123',
        name: 'Test',
        url: 'https://example.com',
        description: null,
        originalId: 'rec_123',
        tags: '["smoke"]',
        actionCount: '5',
        estimatedDurationMs: '30000',
        schemaVersion: '1.0.0',
        dataSizeBytes: '1000',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([mockRecording]),
          }),
        }),
      });

      const result = await repository.findByTag('user-123', 'smoke');

      expect(result).toHaveLength(1);
      expect(result[0].tags).toContain('smoke');
    });
  });
});
