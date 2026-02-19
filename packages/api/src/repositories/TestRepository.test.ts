/**
 * TestRepository Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestRepository, generateSlug } from './TestRepository.js';

// Mock database
const createMockDb = () => {
  const mockTest = {
    id: 'test-123',
    userId: 'user-123',
    projectId: 'proj-123',
    suiteId: 'suite-123',
    name: 'Add to Cart Test',
    description: 'Tests the add to cart flow',
    slug: 'add-to-cart-test',
    recordingData: { id: 'rec_123', testName: 'Add to Cart', actions: [] },
    recordingUrl: 'https://example.com/shop',
    actionCount: 5,
    browsers: ['chromium', 'firefox'],
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

  return {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockTest]),
      }),
    }),
    select: vi.fn().mockReturnValue({
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
                offset: vi.fn().mockResolvedValue([
                  {
                    ...mockTest,
                    suiteName: 'Checkout Flow',
                  },
                ]),
              }),
            }),
          }),
        }),
        orderBy: vi.fn().mockResolvedValue([mockTest]),
      }),
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
    _mockTest: mockTest,
  };
};

describe('TestRepository', () => {
  let repository: TestRepository;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    repository = new TestRepository(mockDb as any);
  });

  describe('create', () => {
    it('should create a test successfully', async () => {
      // Mock slug availability check (isSlugAvailable → select returns count: 0)
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        })
        .mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockDb._mockTest]),
            }),
          }),
        });

      const createData = {
        userId: 'user-123',
        projectId: 'proj-123',
        suiteId: 'suite-123',
        name: 'Add to Cart Test',
        recordingData: { id: 'rec_123', testName: 'Add to Cart', actions: [] },
        recordingUrl: 'https://example.com/shop',
        actionCount: 5,
        browsers: ['chromium', 'firefox'] as ('chromium' | 'firefox' | 'webkit')[],
      };

      const result = await repository.create(createData);

      expect(result).toBeDefined();
      expect(result.id).toBe('test-123');
      expect(result.name).toBe('Add to Cart Test');
      expect(result.slug).toBe('add-to-cart-test');
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should auto-generate slug from name', async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      const createData = {
        userId: 'user-123',
        projectId: 'proj-123',
        suiteId: 'suite-123',
        name: 'My Test Name',
        recordingData: {},
      };

      await repository.create(createData);

      const insertValues = mockDb.insert.mock.results[0].value.values;
      expect(insertValues).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'my-test-name' })
      );
    });

    it('should use provided slug if given', async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      const createData = {
        userId: 'user-123',
        projectId: 'proj-123',
        suiteId: 'suite-123',
        name: 'My Test',
        slug: 'custom-slug',
        recordingData: {},
      };

      await repository.create(createData);

      const insertValues = mockDb.insert.mock.results[0].value.values;
      expect(insertValues).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'custom-slug' })
      );
    });

    it('should apply default config values', async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      const createData = {
        userId: 'user-123',
        projectId: 'proj-123',
        suiteId: 'suite-123',
        name: 'Test With Defaults',
        recordingData: {},
      };

      await repository.create(createData);

      const insertValues = mockDb.insert.mock.results[0].value.values;
      expect(insertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            headless: true,
            video: false,
            timeout: 30000,
          }),
        })
      );
    });

    it('should merge partial config with defaults', async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      const createData = {
        userId: 'user-123',
        projectId: 'proj-123',
        suiteId: 'suite-123',
        name: 'Custom Config Test',
        recordingData: {},
        config: { timeout: 60000, video: true },
      };

      await repository.create(createData);

      const insertValues = mockDb.insert.mock.results[0].value.values;
      expect(insertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            headless: true, // From defaults
            video: true, // Overridden
            timeout: 60000, // Overridden
            retries: 0, // From defaults
          }),
        })
      );
    });
  });

  describe('findById', () => {
    it('should find a test by ID', async () => {
      const result = await repository.findById('test-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('test-123');
      expect(result?.browsers).toEqual(['chromium', 'firefox']);
    });

    it('should return null when test not found', async () => {
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
    it('should find a test by ID and user ID', async () => {
      const result = await repository.findByIdAndUser('test-123', 'user-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('test-123');
      expect(result?.userId).toBe('user-123');
    });

    it('should return null when test not found or unauthorized', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.findByIdAndUser('test-123', 'other-user');

      expect(result).toBeNull();
    });
  });

  describe('findBySlug', () => {
    it('should find a test by slug within a project', async () => {
      const result = await repository.findBySlug('proj-123', 'add-to-cart-test');

      expect(result).toBeDefined();
      expect(result?.slug).toBe('add-to-cart-test');
    });

    it('should return null when slug not found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.findBySlug('proj-123', 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findMany', () => {
    it('should list tests with pagination', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 1 }]),
          }),
        })
        .mockReturnValue({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([
                      { ...mockDb._mockTest, suiteName: 'Checkout Flow' },
                    ]),
                  }),
                }),
              }),
            }),
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

    it('should filter by suite ID', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 1 }]),
          }),
        })
        .mockReturnValue({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([
                      { ...mockDb._mockTest, suiteName: 'Checkout Flow' },
                    ]),
                  }),
                }),
              }),
            }),
          }),
        });

      const result = await repository.findMany({
        userId: 'user-123',
        projectId: 'proj-123',
        suiteId: 'suite-123',
      });

      expect(result.data).toBeDefined();
    });

    it('should filter by search term', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        })
        .mockReturnValue({
          from: vi.fn().mockReturnValue({
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
        });

      const result = await repository.findMany({
        userId: 'user-123',
        projectId: 'proj-123',
        search: 'cart',
      });

      expect(result.data).toBeDefined();
    });

    it('should filter by last run status', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        })
        .mockReturnValue({
          from: vi.fn().mockReturnValue({
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
        });

      const result = await repository.findMany({
        userId: 'user-123',
        projectId: 'proj-123',
        status: 'failed',
      });

      expect(result.data).toBeDefined();
    });
  });

  describe('findAllBySuite', () => {
    it('should return all tests for a suite', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([mockDb._mockTest]),
          }),
        }),
      });

      const result = await repository.findAllBySuite('user-123', 'suite-123');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('test-123');
    });
  });

  describe('findAllByProject', () => {
    it('should return all tests for a project', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([mockDb._mockTest]),
          }),
        }),
      });

      const result = await repository.findAllByProject('user-123', 'proj-123');

      expect(result).toHaveLength(1);
      expect(result[0].projectId).toBe('proj-123');
    });
  });

  describe('update', () => {
    it('should update test fields', async () => {
      const result = await repository.update('test-123', 'user-123', {
        description: 'Updated description',
        browsers: ['chromium', 'webkit'] as ('chromium' | 'firefox' | 'webkit')[],
      });

      expect(result).toBeDefined();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should return null when test not found', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.update('non-existent', 'user-123', {
        description: 'New desc',
      });

      expect(result).toBeNull();
    });
  });

  describe('updateLastRun', () => {
    it('should update last run tracking fields', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      await repository.updateLastRun('test-123', {
        lastRunId: 'run-456',
        lastRunAt: new Date('2026-02-01'),
        lastRunStatus: 'completed',
      });

      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('moveToSuite', () => {
    it('should move tests to a different suite', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              mockDb._mockTest,
              { ...mockDb._mockTest, id: 'test-456' },
            ]),
          }),
        }),
      });

      const count = await repository.moveToSuite(
        ['test-123', 'test-456'],
        'user-123',
        'suite-new'
      );

      expect(count).toBe(2);
    });

    it('should return 0 when no test IDs provided', async () => {
      const count = await repository.moveToSuite([], 'user-123', 'suite-new');

      expect(count).toBe(0);
    });
  });

  describe('reorder', () => {
    it('should reorder tests within a suite', async () => {
      await repository.reorder('user-123', 'suite-123', [
        'test-3',
        'test-1',
        'test-2',
      ]);

      expect(mockDb.transaction).toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('should soft delete a test', async () => {
      const result = await repository.softDelete('test-123', 'user-123');

      expect(result).toBe(true);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should return false when test not found', async () => {
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
    it('should restore a soft-deleted test', async () => {
      const result = await repository.restore('test-123', 'user-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('test-123');
    });

    it('should return null when test not found', async () => {
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
    it('should count tests for a project', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 10 }]),
        }),
      });

      const result = await repository.countByProject('user-123', 'proj-123');

      expect(result).toBe(10);
    });
  });

  describe('countBySuite', () => {
    it('should count tests for a suite', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 3 }]),
        }),
      });

      const result = await repository.countBySuite('user-123', 'suite-123');

      expect(result).toBe(3);
    });
  });

  describe('isSlugAvailable', () => {
    it('should return true when slug is available', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      const result = await repository.isSlugAvailable('proj-123', 'new-slug');

      expect(result).toBe(true);
    });

    it('should return false when slug is taken', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      });

      const result = await repository.isSlugAvailable('proj-123', 'add-to-cart-test');

      expect(result).toBe(false);
    });
  });

  describe('isNameAvailable', () => {
    it('should return true when name is available', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      const result = await repository.isNameAvailable('suite-123', 'New Test');

      expect(result).toBe(true);
    });

    it('should return false when name is taken', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      });

      const result = await repository.isNameAvailable('suite-123', 'Add to Cart Test');

      expect(result).toBe(false);
    });
  });
});

describe('generateSlug', () => {
  it('should generate a slug from a simple name', () => {
    expect(generateSlug('Add to Cart Test')).toBe('add-to-cart-test');
  });

  it('should handle special characters', () => {
    expect(generateSlug('Test #1 (Admin)')).toBe('test-1-admin');
  });

  it('should handle multiple spaces', () => {
    expect(generateSlug('test   with   spaces')).toBe('test-with-spaces');
  });

  it('should handle underscores', () => {
    expect(generateSlug('test_with_underscores')).toBe('test-with-underscores');
  });

  it('should handle leading and trailing spaces', () => {
    expect(generateSlug('  trim me  ')).toBe('trim-me');
  });

  it('should handle consecutive special chars', () => {
    expect(generateSlug('test---slug')).toBe('test-slug');
  });

  it('should handle uppercase', () => {
    expect(generateSlug('MY TEST')).toBe('my-test');
  });

  it('should handle empty string', () => {
    expect(generateSlug('')).toBe('');
  });

  it('should handle single word', () => {
    expect(generateSlug('checkout')).toBe('checkout');
  });
});
