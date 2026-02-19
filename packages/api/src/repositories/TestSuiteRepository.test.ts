/**
 * TestSuiteRepository Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestSuiteRepository, DEFAULT_SUITE_NAME } from './TestSuiteRepository.js';

// Mock database
const createMockDb = () => {
  const mockSuite = {
    id: 'suite-123',
    userId: 'user-123',
    projectId: 'proj-123',
    name: 'Checkout Flow',
    description: 'Tests for checkout flow',
    displayOrder: 0,
    deletedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const mockDefaultSuite = {
    ...mockSuite,
    id: 'suite-default',
    name: DEFAULT_SUITE_NAME,
    description: 'Default suite for ungrouped tests',
  };

  return {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockSuite]),
      }),
    }),
    select: vi.fn().mockReturnValue({
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
              orderBy: vi.fn().mockResolvedValue([
                {
                  ...mockSuite,
                  testCount: 5,
                  passedCount: 3,
                  failedCount: 1,
                },
              ]),
            }),
          }),
        }),
        orderBy: vi.fn().mockResolvedValue([mockSuite]),
      }),
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
    _mockSuite: mockSuite,
    _mockDefaultSuite: mockDefaultSuite,
  };
};

describe('TestSuiteRepository', () => {
  let repository: TestSuiteRepository;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    repository = new TestSuiteRepository(mockDb as any);
  });

  describe('create', () => {
    it('should create a test suite successfully', async () => {
      const createData = {
        userId: 'user-123',
        projectId: 'proj-123',
        name: 'Checkout Flow',
        description: 'Tests for checkout flow',
      };

      const result = await repository.create(createData);

      expect(result).toBeDefined();
      expect(result.id).toBe('suite-123');
      expect(result.name).toBe('Checkout Flow');
      expect(result.projectId).toBe('proj-123');
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should create a suite with minimal fields', async () => {
      const createData = {
        userId: 'user-123',
        projectId: 'proj-123',
        name: 'Minimal Suite',
      };

      const result = await repository.create(createData);

      expect(result).toBeDefined();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should use default displayOrder of 0', async () => {
      const createData = {
        userId: 'user-123',
        projectId: 'proj-123',
        name: 'Test Suite',
      };

      await repository.create(createData);

      const insertCall = mockDb.insert.mock.results[0].value.values;
      expect(insertCall).toHaveBeenCalledWith(
        expect.objectContaining({ displayOrder: 0 })
      );
    });
  });

  describe('createDefaultSuite', () => {
    it('should create a default suite for a project', async () => {
      const result = await repository.createDefaultSuite('user-123', 'proj-123');

      expect(result).toBeDefined();
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should find a suite by ID', async () => {
      const result = await repository.findById('suite-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('suite-123');
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return null when suite not found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByIdAndUser', () => {
    it('should find a suite by ID and user ID', async () => {
      const result = await repository.findByIdAndUser('suite-123', 'user-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('suite-123');
      expect(result?.userId).toBe('user-123');
    });

    it('should return null when suite not found or unauthorized', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.findByIdAndUser('suite-123', 'other-user');

      expect(result).toBeNull();
    });
  });

  describe('findDefaultSuite', () => {
    it('should find the default suite for a project', async () => {
      const result = await repository.findDefaultSuite('proj-123');

      expect(result).toBeDefined();
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return null when no default suite exists', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.findDefaultSuite('proj-no-default');

      expect(result).toBeNull();
    });
  });

  describe('findByNameAndProject', () => {
    it('should find a suite by name and project', async () => {
      const result = await repository.findByNameAndProject('Checkout Flow', 'proj-123');

      expect(result).toBeDefined();
      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe('findMany', () => {
    it('should list suites with pagination', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockResolvedValue([{ count: 1 }]),
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([mockDb._mockSuite]),
              }),
            }),
          })),
        }),
      });

      const result = await repository.findMany({
        userId: 'user-123',
        projectId: 'proj-123',
      });

      expect(result.data).toBeDefined();
      expect(result.pagination).toBeDefined();
      expect(result.pagination.page).toBe(1);
    });

    it('should apply search filter', async () => {
      mockDb.select.mockReturnValue({
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
      });

      const result = await repository.findMany({
        userId: 'user-123',
        projectId: 'proj-123',
        search: 'checkout',
      });

      expect(result.data).toBeDefined();
    });
  });

  describe('findAllByProject', () => {
    it('should return all suites for a project', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([mockDb._mockSuite]),
          }),
        }),
      });

      const result = await repository.findAllByProject('user-123', 'proj-123');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('suite-123');
    });
  });

  describe('findAllWithStats', () => {
    it('should return suites with test count and pass/fail stats', async () => {
      const result = await repository.findAllWithStats('user-123', 'proj-123');

      expect(result).toHaveLength(1);
      expect(result[0].testCount).toBe(5);
      expect(result[0].passedCount).toBe(3);
      expect(result[0].failedCount).toBe(1);
    });
  });

  describe('update', () => {
    it('should update a test suite', async () => {
      const result = await repository.update('suite-123', 'user-123', {
        name: 'Updated Suite',
        description: 'Updated description',
      });

      expect(result).toBeDefined();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should update displayOrder', async () => {
      const result = await repository.update('suite-123', 'user-123', {
        displayOrder: 5,
      });

      expect(result).toBeDefined();
    });

    it('should return null when suite not found', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.update('non-existent', 'user-123', {
        name: 'New Name',
      });

      expect(result).toBeNull();
    });
  });

  describe('reorder', () => {
    it('should reorder suites within a project', async () => {
      await repository.reorder('user-123', 'proj-123', [
        'suite-3',
        'suite-1',
        'suite-2',
      ]);

      expect(mockDb.transaction).toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('should soft delete a suite', async () => {
      const result = await repository.softDelete('suite-123', 'user-123');

      expect(result).toBe(true);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should return false when suite not found', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.softDelete('non-existent', 'user-123');

      expect(result).toBe(false);
    });
  });

  describe('restore', () => {
    it('should restore a soft-deleted suite', async () => {
      const result = await repository.restore('suite-123', 'user-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('suite-123');
    });

    it('should return null when suite not found', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.restore('non-existent', 'user-123');

      expect(result).toBeNull();
    });
  });

  describe('countByProject', () => {
    it('should count suites for a project', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 3 }]),
        }),
      });

      const result = await repository.countByProject('user-123', 'proj-123');

      expect(result).toBe(3);
    });

    it('should return 0 when no suites exist', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      const result = await repository.countByProject('user-123', 'proj-empty');

      expect(result).toBe(0);
    });
  });

  describe('isNameAvailable', () => {
    it('should return true when name is available', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      const result = await repository.isNameAvailable('proj-123', 'New Suite');

      expect(result).toBe(true);
    });

    it('should return false when name is taken', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      });

      const result = await repository.isNameAvailable('proj-123', 'Checkout Flow');

      expect(result).toBe(false);
    });

    it('should exclude a specific suite ID when checking', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      const result = await repository.isNameAvailable(
        'proj-123',
        'Checkout Flow',
        'suite-123'
      );

      expect(result).toBe(true);
    });
  });

  describe('getOrCreateDefaultSuite', () => {
    it('should return existing default suite', async () => {
      // findDefaultSuite will find a suite
      const result = await repository.getOrCreateDefaultSuite('user-123', 'proj-123');

      expect(result).toBeDefined();
    });

    it('should create default suite when none exists', async () => {
      // First call (findDefaultSuite): select returns empty
      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          } as any;
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockDb._mockDefaultSuite]),
            }),
          }),
        } as any;
      });

      const result = await repository.getOrCreateDefaultSuite('user-123', 'proj-123');

      expect(result).toBeDefined();
    });
  });
});
