/**
 * TestSuiteService Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TestSuiteService,
  TestSuiteError,
  TestSuiteErrors,
  createTestSuiteSchema,
  updateTestSuiteSchema,
  listTestSuitesQuerySchema,
  reorderTestSuitesSchema,
  type CreateTestSuiteRequest,
  type UpdateTestSuiteRequest,
  type ListTestSuitesQuery,
} from './TestSuiteService.js';
import type { SafeTestSuite, TestSuiteWithStats } from '../repositories/TestSuiteRepository.js';
import { DEFAULT_SUITE_NAME } from '../repositories/TestSuiteRepository.js';

// Valid UUIDs for test data
const SUITE_ID = '550e8400-e29b-41d4-a716-446655440003';
const USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440002';
const DEFAULT_SUITE_ID = '550e8400-e29b-41d4-a716-446655440004';
const NON_EXISTENT_ID = '550e8400-e29b-41d4-a716-446655440006';
const UNKNOWN_ID = '550e8400-e29b-41d4-a716-446655440009';

// Sample data
const sampleSuite: SafeTestSuite = {
  id: SUITE_ID,
  userId: USER_ID,
  projectId: PROJECT_ID,
  name: 'Login Tests',
  description: 'Tests for login flow',
  displayOrder: 1,
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const sampleDefaultSuite: SafeTestSuite = {
  id: DEFAULT_SUITE_ID,
  userId: USER_ID,
  projectId: PROJECT_ID,
  name: DEFAULT_SUITE_NAME,
  description: 'Default suite for ungrouped tests',
  displayOrder: 0,
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const sampleSuiteWithStats: TestSuiteWithStats = {
  ...sampleSuite,
  testCount: 5,
  passedCount: 3,
  failedCount: 1,
};

// Mock repository
type MockedRepository = {
  create: ReturnType<typeof vi.fn>;
  createDefaultSuite: ReturnType<typeof vi.fn>;
  findById: ReturnType<typeof vi.fn>;
  findByIdAndUser: ReturnType<typeof vi.fn>;
  findDefaultSuite: ReturnType<typeof vi.fn>;
  findByNameAndProject: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  findAllByProject: ReturnType<typeof vi.fn>;
  findAllWithStats: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  reorder: ReturnType<typeof vi.fn>;
  softDelete: ReturnType<typeof vi.fn>;
  restore: ReturnType<typeof vi.fn>;
  countByProject: ReturnType<typeof vi.fn>;
  isNameAvailable: ReturnType<typeof vi.fn>;
  getOrCreateDefaultSuite: ReturnType<typeof vi.fn>;
};

const createMockRepository = (): MockedRepository => ({
  create: vi.fn().mockResolvedValue(sampleSuite),
  createDefaultSuite: vi.fn().mockResolvedValue(sampleDefaultSuite),
  findById: vi.fn().mockResolvedValue(sampleSuite),
  findByIdAndUser: vi.fn().mockResolvedValue(sampleSuite),
  findDefaultSuite: vi.fn().mockResolvedValue(sampleDefaultSuite),
  findByNameAndProject: vi.fn().mockResolvedValue(null),
  findMany: vi.fn().mockResolvedValue({
    data: [sampleSuite],
    pagination: {
      page: 1,
      limit: 50,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    },
  }),
  findAllByProject: vi.fn().mockResolvedValue([sampleDefaultSuite, sampleSuite]),
  findAllWithStats: vi.fn().mockResolvedValue([sampleSuiteWithStats]),
  update: vi.fn().mockResolvedValue(sampleSuite),
  reorder: vi.fn().mockResolvedValue(undefined),
  softDelete: vi.fn().mockResolvedValue(true),
  restore: vi.fn().mockResolvedValue(sampleSuite),
  countByProject: vi.fn().mockResolvedValue(2),
  isNameAvailable: vi.fn().mockResolvedValue(true),
  getOrCreateDefaultSuite: vi.fn().mockResolvedValue(sampleDefaultSuite),
});

describe('TestSuiteService', () => {
  let service: TestSuiteService;
  let mockRepository: MockedRepository;

  beforeEach(() => {
    mockRepository = createMockRepository();
    service = new TestSuiteService(mockRepository as any);
  });

  describe('Schema Validation', () => {
    describe('createTestSuiteSchema', () => {
      it('should validate valid input', () => {
        const input = { name: 'Login Tests', description: 'Tests for login' };
        const result = createTestSuiteSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('should require name', () => {
        const result = createTestSuiteSchema.safeParse({ description: 'test' });
        expect(result.success).toBe(false);
      });

      it('should reject empty name', () => {
        const result = createTestSuiteSchema.safeParse({ name: '' });
        expect(result.success).toBe(false);
      });

      it('should reject name exceeding 255 chars', () => {
        const result = createTestSuiteSchema.safeParse({ name: 'a'.repeat(256) });
        expect(result.success).toBe(false);
      });

      it('should allow missing description', () => {
        const result = createTestSuiteSchema.safeParse({ name: 'Test' });
        expect(result.success).toBe(true);
      });

      it('should reject description exceeding 2000 chars', () => {
        const result = createTestSuiteSchema.safeParse({
          name: 'Test',
          description: 'a'.repeat(2001),
        });
        expect(result.success).toBe(false);
      });
    });

    describe('updateTestSuiteSchema', () => {
      it('should allow partial updates', () => {
        const result = updateTestSuiteSchema.safeParse({ name: 'Updated' });
        expect(result.success).toBe(true);
      });

      it('should allow empty object', () => {
        const result = updateTestSuiteSchema.safeParse({});
        expect(result.success).toBe(true);
      });
    });

    describe('listTestSuitesQuerySchema', () => {
      it('should have defaults', () => {
        const result = listTestSuitesQuerySchema.parse({});
        expect(result.page).toBe(1);
        expect(result.limit).toBe(50);
        expect(result.sortBy).toBe('displayOrder');
        expect(result.sortOrder).toBe('asc');
        expect(result.includeDeleted).toBe(false);
      });

      it('should accept search parameter', () => {
        const result = listTestSuitesQuerySchema.parse({ search: 'login' });
        expect(result.search).toBe('login');
      });
    });

    describe('reorderTestSuitesSchema', () => {
      it('should validate valid UUID array', () => {
        const result = reorderTestSuitesSchema.safeParse({
          suiteIds: ['550e8400-e29b-41d4-a716-446655440000'],
        });
        expect(result.success).toBe(true);
      });

      it('should reject empty array', () => {
        const result = reorderTestSuitesSchema.safeParse({ suiteIds: [] });
        expect(result.success).toBe(false);
      });

      it('should reject non-UUID strings', () => {
        const result = reorderTestSuitesSchema.safeParse({ suiteIds: ['not-a-uuid'] });
        expect(result.success).toBe(false);
      });
    });
  });

  describe('TestSuiteError', () => {
    it('should create error with correct properties', () => {
      const error = new TestSuiteError('Test error', 'TEST_CODE', 400);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('TestSuiteError');
    });

    it('should default statusCode to 400', () => {
      const error = new TestSuiteError('Test', 'TEST');
      expect(error.statusCode).toBe(400);
    });
  });

  describe('createTestSuite', () => {
    it('should create a suite successfully', async () => {
      const input: CreateTestSuiteRequest = {
        name: 'Login Tests',
        description: 'Tests for login flow',
      };

      const result = await service.createTestSuite(USER_ID, PROJECT_ID, input);

      expect(result).toBeDefined();
      expect(result.id).toBe(SUITE_ID);
      expect(result.name).toBe('Login Tests');
      expect(mockRepository.create).toHaveBeenCalled();
    });

    it('should check name availability', async () => {
      const input: CreateTestSuiteRequest = { name: 'New Suite' };
      await service.createTestSuite(USER_ID, PROJECT_ID, input);

      expect(mockRepository.isNameAvailable).toHaveBeenCalledWith(PROJECT_ID, 'New Suite');
    });

    it('should throw when name is taken', async () => {
      mockRepository.isNameAvailable.mockResolvedValue(false);

      const input: CreateTestSuiteRequest = { name: 'Existing Suite' };
      await expect(
        service.createTestSuite(USER_ID, PROJECT_ID, input)
      ).rejects.toThrow(TestSuiteError);
    });

    it('should prevent creating suite named "Unorganized"', async () => {
      const input: CreateTestSuiteRequest = { name: 'Unorganized' };
      await expect(
        service.createTestSuite(USER_ID, PROJECT_ID, input)
      ).rejects.toThrow(TestSuiteError);
    });

    it('should prevent creating suite named "unorganized" (case-insensitive)', async () => {
      const input: CreateTestSuiteRequest = { name: 'unorganized' };
      await expect(
        service.createTestSuite(USER_ID, PROJECT_ID, input)
      ).rejects.toThrow(TestSuiteError);
    });

    it('should enforce max suites limit', async () => {
      mockRepository.countByProject.mockResolvedValue(100);

      const input: CreateTestSuiteRequest = { name: 'New Suite' };
      await expect(
        service.createTestSuite(USER_ID, PROJECT_ID, input)
      ).rejects.toThrow(TestSuiteError);
    });

    it('should not include userId in response', async () => {
      const input: CreateTestSuiteRequest = { name: 'Test' };
      const result = await service.createTestSuite(USER_ID, PROJECT_ID, input);

      expect(result).not.toHaveProperty('userId');
      expect(result).not.toHaveProperty('deletedAt');
    });
  });

  describe('getTestSuite', () => {
    it('should return a suite by ID', async () => {
      const result = await service.getTestSuite(USER_ID, SUITE_ID);

      expect(result).toBeDefined();
      expect(result.id).toBe(SUITE_ID);
      expect(mockRepository.findByIdAndUser).toHaveBeenCalledWith(SUITE_ID, USER_ID);
    });

    it('should throw NOT_FOUND when suite does not exist', async () => {
      mockRepository.findByIdAndUser.mockResolvedValue(null);

      await expect(
        service.getTestSuite(USER_ID, NON_EXISTENT_ID)
      ).rejects.toThrow('Test suite not found');
    });
  });

  describe('ensureDefaultSuite', () => {
    it('should return existing default suite', async () => {
      const result = await service.ensureDefaultSuite(USER_ID, PROJECT_ID);

      expect(result).toBeDefined();
      expect(result.name).toBe(DEFAULT_SUITE_NAME);
      expect(mockRepository.getOrCreateDefaultSuite).toHaveBeenCalledWith(USER_ID, PROJECT_ID);
    });
  });

  describe('listAllWithStats', () => {
    it('should return suites with stats', async () => {
      const result = await service.listAllWithStats(USER_ID, PROJECT_ID);

      expect(result).toHaveLength(1);
      expect(result[0].testCount).toBe(5);
      expect(result[0].passedCount).toBe(3);
      expect(result[0].failedCount).toBe(1);
      expect(mockRepository.findAllWithStats).toHaveBeenCalledWith(USER_ID, PROJECT_ID);
    });

    it('should not include userId in stats response', async () => {
      const result = await service.listAllWithStats(USER_ID, PROJECT_ID);
      expect(result[0]).not.toHaveProperty('userId');
    });
  });

  describe('listTestSuites', () => {
    it('should return paginated suites', async () => {
      const query: ListTestSuitesQuery = { page: 1, limit: 10 };
      const result = await service.listTestSuites(USER_ID, PROJECT_ID, query);

      expect(result.data).toBeDefined();
      expect(result.pagination).toBeDefined();
      expect(result.pagination.page).toBe(1);
    });

    it('should pass filters to repository', async () => {
      const query: ListTestSuitesQuery = {
        page: 1,
        limit: 20,
        search: 'login',
        sortBy: 'name',
        sortOrder: 'desc',
      };

      await service.listTestSuites(USER_ID, PROJECT_ID, query);

      expect(mockRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          projectId: PROJECT_ID,
          search: 'login',
        }),
        expect.objectContaining({
          sortBy: 'name',
          sortOrder: 'desc',
        })
      );
    });
  });

  describe('updateTestSuite', () => {
    it('should update a suite', async () => {
      const input: UpdateTestSuiteRequest = {
        name: 'Updated Name',
        description: 'Updated description',
      };

      const result = await service.updateTestSuite(USER_ID, SUITE_ID, input);

      expect(result).toBeDefined();
      expect(mockRepository.update).toHaveBeenCalled();
    });

    it('should check name availability when updating name', async () => {
      const input: UpdateTestSuiteRequest = { name: 'New Name' };
      await service.updateTestSuite(USER_ID, SUITE_ID, input);

      expect(mockRepository.isNameAvailable).toHaveBeenCalledWith(
        PROJECT_ID,
        'New Name',
        SUITE_ID
      );
    });

    it('should throw when suite not found', async () => {
      mockRepository.findByIdAndUser.mockResolvedValue(null);

      const input: UpdateTestSuiteRequest = { name: 'Test' };
      await expect(
        service.updateTestSuite(USER_ID, NON_EXISTENT_ID, input)
      ).rejects.toThrow('Test suite not found');
    });

    it('should throw when name is taken', async () => {
      mockRepository.isNameAvailable.mockResolvedValue(false);

      const input: UpdateTestSuiteRequest = { name: 'Existing Name' };
      await expect(
        service.updateTestSuite(USER_ID, SUITE_ID, input)
      ).rejects.toThrow(TestSuiteError);
    });

    it('should prevent renaming default suite', async () => {
      mockRepository.findByIdAndUser.mockResolvedValue(sampleDefaultSuite);

      const input: UpdateTestSuiteRequest = { name: 'New Name' };
      await expect(
        service.updateTestSuite(USER_ID, DEFAULT_SUITE_ID, input)
      ).rejects.toThrow('The default suite cannot be renamed');
    });

    it('should allow updating description of default suite', async () => {
      mockRepository.findByIdAndUser.mockResolvedValue(sampleDefaultSuite);
      mockRepository.update.mockResolvedValue({
        ...sampleDefaultSuite,
        description: 'Updated desc',
      });

      const input: UpdateTestSuiteRequest = { description: 'Updated desc' };
      const result = await service.updateTestSuite(USER_ID, DEFAULT_SUITE_ID, input);

      expect(result).toBeDefined();
      expect(mockRepository.update).toHaveBeenCalled();
    });

    it('should prevent renaming to "Unorganized"', async () => {
      const input: UpdateTestSuiteRequest = { name: 'Unorganized' };
      await expect(
        service.updateTestSuite(USER_ID, SUITE_ID, input)
      ).rejects.toThrow(TestSuiteError);
    });

    it('should throw when update returns null', async () => {
      mockRepository.update.mockResolvedValue(null);

      const input: UpdateTestSuiteRequest = { description: 'Updated' };
      await expect(
        service.updateTestSuite(USER_ID, SUITE_ID, input)
      ).rejects.toThrow('Test suite not found');
    });
  });

  describe('reorderTestSuites', () => {
    it('should reorder suites', async () => {
      const request = {
        suiteIds: [DEFAULT_SUITE_ID, SUITE_ID],
      };

      await service.reorderTestSuites(USER_ID, PROJECT_ID, request);

      expect(mockRepository.reorder).toHaveBeenCalledWith(
        USER_ID,
        PROJECT_ID,
        [DEFAULT_SUITE_ID, SUITE_ID]
      );
    });

    it('should throw when suite ID does not belong to project', async () => {
      const request = {
        suiteIds: [SUITE_ID, UNKNOWN_ID],
      };

      await expect(
        service.reorderTestSuites(USER_ID, PROJECT_ID, request)
      ).rejects.toThrow('Invalid reorder data');
    });
  });

  describe('deleteTestSuite', () => {
    it('should delete a suite', async () => {
      await service.deleteTestSuite(USER_ID, PROJECT_ID, SUITE_ID);

      expect(mockRepository.softDelete).toHaveBeenCalledWith(SUITE_ID, USER_ID);
    });

    it('should throw when trying to delete default suite', async () => {
      mockRepository.findByIdAndUser.mockResolvedValue(sampleDefaultSuite);

      await expect(
        service.deleteTestSuite(USER_ID, PROJECT_ID, DEFAULT_SUITE_ID)
      ).rejects.toThrow('The default suite cannot be deleted');
    });

    it('should throw when suite not found', async () => {
      mockRepository.findByIdAndUser.mockResolvedValue(null);

      await expect(
        service.deleteTestSuite(USER_ID, PROJECT_ID, NON_EXISTENT_ID)
      ).rejects.toThrow('Test suite not found');
    });

    it('should throw when softDelete returns false', async () => {
      mockRepository.softDelete.mockResolvedValue(false);

      await expect(
        service.deleteTestSuite(USER_ID, PROJECT_ID, SUITE_ID)
      ).rejects.toThrow('Test suite not found');
    });
  });

  describe('countSuites', () => {
    it('should return suite count', async () => {
      const count = await service.countSuites(USER_ID, PROJECT_ID);

      expect(count).toBe(2);
      expect(mockRepository.countByProject).toHaveBeenCalledWith(USER_ID, PROJECT_ID);
    });
  });
});
