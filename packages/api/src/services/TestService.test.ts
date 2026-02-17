/**
 * TestService Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TestService,
  TestError,
  TestErrors,
  createTestSchema,
  updateTestSchema,
  listTestsQuerySchema,
  moveTestsSchema,
  reorderTestsSchema,
  type CreateTestRequest,
  type UpdateTestRequest,
  type ListTestsQuery,
} from './TestService.js';
import type { SafeTest, TestSummary } from '../repositories/TestRepository.js';
import type { SafeTestSuite } from '../repositories/TestSuiteRepository.js';
import { DEFAULT_TEST_CONFIG } from '../db/schema/tests.js';

// Valid UUIDs for test data
const TEST_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440002';
const SUITE_ID = '550e8400-e29b-41d4-a716-446655440003';
const DEFAULT_SUITE_ID = '550e8400-e29b-41d4-a716-446655440004';
const SUITE_ID_2 = '550e8400-e29b-41d4-a716-446655440005';
const NON_EXISTENT_ID = '550e8400-e29b-41d4-a716-446655440006';
const DIFFERENT_PROJECT_ID = '550e8400-e29b-41d4-a716-446655440007';
const OTHER_USER_ID = '550e8400-e29b-41d4-a716-446655440008';
const TEST_ID_1 = '550e8400-e29b-41d4-a716-446655440010';
const TEST_ID_2 = '550e8400-e29b-41d4-a716-446655440011';
const TEST_ID_3 = '550e8400-e29b-41d4-a716-446655440012';

// Sample data
const sampleTest: SafeTest = {
  id: TEST_ID,
  userId: USER_ID,
  projectId: PROJECT_ID,
  suiteId: SUITE_ID,
  name: 'Login Test',
  description: 'Tests login flow',
  slug: 'login-test',
  recordingData: { id: 'rec_1', testName: 'Login', url: 'https://example.com', actions: [] },
  recordingUrl: 'https://example.com',
  actionCount: 5,
  browsers: ['chromium'],
  config: DEFAULT_TEST_CONFIG,
  displayOrder: 0,
  lastRunId: null,
  lastRunAt: null,
  lastRunStatus: null,
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const sampleTestSummary: TestSummary = {
  id: TEST_ID,
  userId: USER_ID,
  projectId: PROJECT_ID,
  suiteId: SUITE_ID,
  suiteName: 'Login Tests',
  name: 'Login Test',
  slug: 'login-test',
  recordingUrl: 'https://example.com',
  actionCount: 5,
  browsers: ['chromium'],
  displayOrder: 0,
  lastRunId: null,
  lastRunAt: null,
  lastRunStatus: null,
  createdAt: new Date('2026-01-01'),
};

const sampleSuite: SafeTestSuite = {
  id: SUITE_ID,
  userId: USER_ID,
  projectId: PROJECT_ID,
  name: 'Login Tests',
  description: null,
  displayOrder: 0,
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const sampleDefaultSuite: SafeTestSuite = {
  id: DEFAULT_SUITE_ID,
  userId: USER_ID,
  projectId: PROJECT_ID,
  name: 'Unorganized',
  description: 'Default suite',
  displayOrder: 0,
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

// Mock test repository
type MockedTestRepository = {
  create: ReturnType<typeof vi.fn>;
  findById: ReturnType<typeof vi.fn>;
  findByIdAndUser: ReturnType<typeof vi.fn>;
  findBySlug: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  findAllBySuite: ReturnType<typeof vi.fn>;
  findAllByProject: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  updateLastRun: ReturnType<typeof vi.fn>;
  moveToSuite: ReturnType<typeof vi.fn>;
  reorder: ReturnType<typeof vi.fn>;
  softDelete: ReturnType<typeof vi.fn>;
  restore: ReturnType<typeof vi.fn>;
  countByProject: ReturnType<typeof vi.fn>;
  countBySuite: ReturnType<typeof vi.fn>;
  isSlugAvailable: ReturnType<typeof vi.fn>;
  ensureUniqueSlug: ReturnType<typeof vi.fn>;
  isNameAvailable: ReturnType<typeof vi.fn>;
};

// Mock suite repository
type MockedSuiteRepository = {
  findByIdAndUser: ReturnType<typeof vi.fn>;
  getOrCreateDefaultSuite: ReturnType<typeof vi.fn>;
};

const createMockTestRepository = (): MockedTestRepository => ({
  create: vi.fn().mockResolvedValue(sampleTest),
  findById: vi.fn().mockResolvedValue(sampleTest),
  findByIdAndUser: vi.fn().mockResolvedValue(sampleTest),
  findBySlug: vi.fn().mockResolvedValue(sampleTest),
  findMany: vi.fn().mockResolvedValue({
    data: [sampleTestSummary],
    pagination: {
      page: 1,
      limit: 50,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    },
  }),
  findAllBySuite: vi.fn().mockResolvedValue([sampleTest]),
  findAllByProject: vi.fn().mockResolvedValue([sampleTest]),
  update: vi.fn().mockResolvedValue(sampleTest),
  updateLastRun: vi.fn().mockResolvedValue(undefined),
  moveToSuite: vi.fn().mockResolvedValue(1),
  reorder: vi.fn().mockResolvedValue(undefined),
  softDelete: vi.fn().mockResolvedValue(true),
  restore: vi.fn().mockResolvedValue(sampleTest),
  countByProject: vi.fn().mockResolvedValue(5),
  countBySuite: vi.fn().mockResolvedValue(3),
  isSlugAvailable: vi.fn().mockResolvedValue(true),
  ensureUniqueSlug: vi.fn().mockResolvedValue('login-test'),
  isNameAvailable: vi.fn().mockResolvedValue(true),
});

const createMockSuiteRepository = (): MockedSuiteRepository => ({
  findByIdAndUser: vi.fn().mockResolvedValue(sampleSuite),
  getOrCreateDefaultSuite: vi.fn().mockResolvedValue(sampleDefaultSuite),
});

describe('TestService', () => {
  let service: TestService;
  let mockTestRepo: MockedTestRepository;
  let mockSuiteRepo: MockedSuiteRepository;

  beforeEach(() => {
    mockTestRepo = createMockTestRepository();
    mockSuiteRepo = createMockSuiteRepository();
    service = new TestService(mockTestRepo as any, mockSuiteRepo as any);
  });

  describe('Schema Validation', () => {
    describe('createTestSchema', () => {
      it('should validate valid input', () => {
        const input = {
          name: 'Login Test',
          recordingData: { id: 'rec_1', actions: [] },
        };
        const result = createTestSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('should require name', () => {
        const result = createTestSchema.safeParse({
          recordingData: { id: 'rec_1' },
        });
        expect(result.success).toBe(false);
      });

      it('should require recordingData', () => {
        const result = createTestSchema.safeParse({ name: 'Test' });
        expect(result.success).toBe(false);
      });

      it('should reject empty name', () => {
        const result = createTestSchema.safeParse({
          name: '',
          recordingData: {},
        });
        expect(result.success).toBe(false);
      });

      it('should validate browsers', () => {
        const valid = createTestSchema.safeParse({
          name: 'Test',
          recordingData: {},
          browsers: ['chromium', 'firefox'],
        });
        expect(valid.success).toBe(true);

        const invalid = createTestSchema.safeParse({
          name: 'Test',
          recordingData: {},
          browsers: ['invalid-browser'],
        });
        expect(invalid.success).toBe(false);
      });

      it('should reject empty browsers array', () => {
        const result = createTestSchema.safeParse({
          name: 'Test',
          recordingData: {},
          browsers: [],
        });
        expect(result.success).toBe(false);
      });

      it('should validate config fields', () => {
        const result = createTestSchema.safeParse({
          name: 'Test',
          recordingData: {},
          config: {
            headless: true,
            timeout: 30000,
            retries: 2,
          },
        });
        expect(result.success).toBe(true);
      });

      it('should reject invalid timeout', () => {
        const result = createTestSchema.safeParse({
          name: 'Test',
          recordingData: {},
          config: { timeout: -1 },
        });
        expect(result.success).toBe(false);
      });

      it('should accept optional suiteId', () => {
        const result = createTestSchema.safeParse({
          name: 'Test',
          recordingData: {},
          suiteId: '550e8400-e29b-41d4-a716-446655440000',
        });
        expect(result.success).toBe(true);
      });
    });

    describe('updateTestSchema', () => {
      it('should allow partial updates', () => {
        const result = updateTestSchema.safeParse({ name: 'Updated' });
        expect(result.success).toBe(true);
      });

      it('should allow empty object', () => {
        const result = updateTestSchema.safeParse({});
        expect(result.success).toBe(true);
      });

      it('should validate browsers if provided', () => {
        const invalid = updateTestSchema.safeParse({
          browsers: ['bad'],
        });
        expect(invalid.success).toBe(false);
      });
    });

    describe('listTestsQuerySchema', () => {
      it('should have defaults', () => {
        const result = listTestsQuerySchema.parse({});
        expect(result.page).toBe(1);
        expect(result.limit).toBe(50);
        expect(result.sortBy).toBe('displayOrder');
        expect(result.sortOrder).toBe('asc');
        expect(result.includeDeleted).toBe(false);
      });

      it('should accept suiteId filter', () => {
        const result = listTestsQuerySchema.parse({
          suiteId: '550e8400-e29b-41d4-a716-446655440000',
        });
        expect(result.suiteId).toBe('550e8400-e29b-41d4-a716-446655440000');
      });

      it('should accept status filter', () => {
        const result = listTestsQuerySchema.parse({ status: 'completed' });
        expect(result.status).toBe('completed');
      });
    });

    describe('moveTestsSchema', () => {
      it('should validate valid input', () => {
        const result = moveTestsSchema.safeParse({
          testIds: ['550e8400-e29b-41d4-a716-446655440000'],
          targetSuiteId: '550e8400-e29b-41d4-a716-446655440001',
        });
        expect(result.success).toBe(true);
      });

      it('should reject empty testIds', () => {
        const result = moveTestsSchema.safeParse({
          testIds: [],
          targetSuiteId: '550e8400-e29b-41d4-a716-446655440001',
        });
        expect(result.success).toBe(false);
      });
    });

    describe('reorderTestsSchema', () => {
      it('should validate valid UUID array', () => {
        const result = reorderTestsSchema.safeParse({
          testIds: ['550e8400-e29b-41d4-a716-446655440000'],
        });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('TestError', () => {
    it('should create error with correct properties', () => {
      const error = new TestError('Test error', 'TEST_CODE', 404);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe('TestError');
    });

    it('should default statusCode to 400', () => {
      const error = new TestError('Test', 'TEST');
      expect(error.statusCode).toBe(400);
    });
  });

  describe('createTest', () => {
    it('should create a test successfully', async () => {
      const input: CreateTestRequest = {
        name: 'Login Test',
        recordingData: { id: 'rec_1', actions: [] },
      };

      const result = await service.createTest(USER_ID, PROJECT_ID, input);

      expect(result).toBeDefined();
      expect(result.id).toBe(TEST_ID);
      expect(result.name).toBe('Login Test');
      expect(mockTestRepo.create).toHaveBeenCalled();
    });

    it('should use default suite when suiteId not provided', async () => {
      const input: CreateTestRequest = {
        name: 'Test',
        recordingData: {},
      };

      await service.createTest(USER_ID, PROJECT_ID, input);

      expect(mockSuiteRepo.getOrCreateDefaultSuite).toHaveBeenCalledWith(USER_ID, PROJECT_ID);
      expect(mockTestRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ suiteId: DEFAULT_SUITE_ID })
      );
    });

    it('should verify suite when suiteId provided', async () => {
      const input: CreateTestRequest = {
        name: 'Test',
        recordingData: {},
        suiteId: SUITE_ID,
      };

      await service.createTest(USER_ID, PROJECT_ID, input);

      expect(mockSuiteRepo.findByIdAndUser).toHaveBeenCalledWith(SUITE_ID, USER_ID);
    });

    it('should throw when provided suite not found', async () => {
      mockSuiteRepo.findByIdAndUser.mockResolvedValue(null);

      const input: CreateTestRequest = {
        name: 'Test',
        recordingData: {},
        suiteId: NON_EXISTENT_ID,
      };

      await expect(
        service.createTest(USER_ID, PROJECT_ID, input)
      ).rejects.toThrow('Target suite not found');
    });

    it('should throw when suite belongs to different project', async () => {
      mockSuiteRepo.findByIdAndUser.mockResolvedValue({
        ...sampleSuite,
        projectId: DIFFERENT_PROJECT_ID,
      });

      const input: CreateTestRequest = {
        name: 'Test',
        recordingData: {},
        suiteId: SUITE_ID,
      };

      await expect(
        service.createTest(USER_ID, PROJECT_ID, input)
      ).rejects.toThrow('Target suite not found');
    });

    it('should check name availability', async () => {
      const input: CreateTestRequest = {
        name: 'Login Test',
        recordingData: {},
      };

      await service.createTest(USER_ID, PROJECT_ID, input);

      expect(mockTestRepo.isNameAvailable).toHaveBeenCalled();
    });

    it('should throw when name is taken', async () => {
      mockTestRepo.isNameAvailable.mockResolvedValue(false);

      const input: CreateTestRequest = {
        name: 'Existing Test',
        recordingData: {},
      };

      await expect(
        service.createTest(USER_ID, PROJECT_ID, input)
      ).rejects.toThrow(TestError);
    });

    it('should enforce max tests limit', async () => {
      mockTestRepo.countByProject.mockResolvedValue(1000);

      const input: CreateTestRequest = {
        name: 'Test',
        recordingData: {},
      };

      await expect(
        service.createTest(USER_ID, PROJECT_ID, input)
      ).rejects.toThrow(TestError);
    });

    it('should not include userId in response', async () => {
      const input: CreateTestRequest = {
        name: 'Test',
        recordingData: {},
      };

      const result = await service.createTest(USER_ID, PROJECT_ID, input);

      expect(result).not.toHaveProperty('userId');
      expect(result).not.toHaveProperty('deletedAt');
    });
  });

  describe('getTest', () => {
    it('should return a test by ID', async () => {
      const result = await service.getTest(USER_ID, TEST_ID);

      expect(result).toBeDefined();
      expect(result.id).toBe(TEST_ID);
      expect(mockTestRepo.findByIdAndUser).toHaveBeenCalledWith(TEST_ID, USER_ID);
    });

    it('should throw NOT_FOUND when test does not exist', async () => {
      mockTestRepo.findByIdAndUser.mockResolvedValue(null);

      await expect(
        service.getTest(USER_ID, NON_EXISTENT_ID)
      ).rejects.toThrow('Test not found');
    });
  });

  describe('getTestBySlug', () => {
    it('should return a test by slug', async () => {
      const result = await service.getTestBySlug(USER_ID, PROJECT_ID, 'login-test');

      expect(result).toBeDefined();
      expect(result.slug).toBe('login-test');
      expect(mockTestRepo.findBySlug).toHaveBeenCalledWith(PROJECT_ID, 'login-test');
    });

    it('should throw when test not found by slug', async () => {
      mockTestRepo.findBySlug.mockResolvedValue(null);

      await expect(
        service.getTestBySlug(USER_ID, PROJECT_ID, NON_EXISTENT_ID)
      ).rejects.toThrow('Test not found');
    });

    it('should throw when test belongs to different user', async () => {
      mockTestRepo.findBySlug.mockResolvedValue({
        ...sampleTest,
        userId: OTHER_USER_ID,
      });

      await expect(
        service.getTestBySlug(USER_ID, PROJECT_ID, 'login-test')
      ).rejects.toThrow('Test not found');
    });
  });

  describe('listTests', () => {
    it('should return paginated tests', async () => {
      const query: ListTestsQuery = { page: 1, limit: 10 };
      const result = await service.listTests(USER_ID, PROJECT_ID, query);

      expect(result.data).toBeDefined();
      expect(result.pagination).toBeDefined();
      expect(result.pagination.page).toBe(1);
    });

    it('should pass filters to repository', async () => {
      const query: ListTestsQuery = {
        page: 1,
        limit: 20,
        suiteId: SUITE_ID,
        search: 'login',
        status: 'completed',
        sortBy: 'name',
        sortOrder: 'desc',
      };

      await service.listTests(USER_ID, PROJECT_ID, query);

      expect(mockTestRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          projectId: PROJECT_ID,
          suiteId: SUITE_ID,
          search: 'login',
          status: 'completed',
        }),
        expect.objectContaining({
          sortBy: 'name',
          sortOrder: 'desc',
        })
      );
    });

    it('should return summary responses (no recordingData)', async () => {
      const result = await service.listTests(USER_ID, PROJECT_ID, {});

      expect(result.data[0]).not.toHaveProperty('recordingData');
      expect(result.data[0]).not.toHaveProperty('config');
      expect(result.data[0]).toHaveProperty('suiteName');
    });
  });

  describe('updateTest', () => {
    it('should update a test', async () => {
      const input: UpdateTestRequest = {
        name: 'Updated Name',
        description: 'Updated description',
      };

      const result = await service.updateTest(USER_ID, TEST_ID, input);

      expect(result).toBeDefined();
      expect(mockTestRepo.update).toHaveBeenCalled();
    });

    it('should throw when test not found', async () => {
      mockTestRepo.findByIdAndUser.mockResolvedValue(null);

      const input: UpdateTestRequest = { name: 'Test' };
      await expect(
        service.updateTest(USER_ID, NON_EXISTENT_ID, input)
      ).rejects.toThrow('Test not found');
    });

    it('should verify target suite when moving', async () => {
      const newSuiteId = SUITE_ID_2;
      mockSuiteRepo.findByIdAndUser.mockResolvedValue({
        ...sampleSuite,
        id: newSuiteId,
      });

      const input: UpdateTestRequest = { suiteId: newSuiteId };
      await service.updateTest(USER_ID, TEST_ID, input);

      expect(mockSuiteRepo.findByIdAndUser).toHaveBeenCalledWith(newSuiteId, USER_ID);
    });

    it('should throw when target suite not found', async () => {
      mockSuiteRepo.findByIdAndUser.mockResolvedValue(null);

      const input: UpdateTestRequest = { suiteId: NON_EXISTENT_ID };
      await expect(
        service.updateTest(USER_ID, TEST_ID, input)
      ).rejects.toThrow('Target suite not found');
    });

    it('should throw when target suite in different project', async () => {
      mockSuiteRepo.findByIdAndUser.mockResolvedValue({
        ...sampleSuite,
        projectId: DIFFERENT_PROJECT_ID,
      });

      const input: UpdateTestRequest = { suiteId: SUITE_ID_2 };
      await expect(
        service.updateTest(USER_ID, TEST_ID, input)
      ).rejects.toThrow('Target suite not found');
    });

    it('should check name availability when changing name', async () => {
      const input: UpdateTestRequest = { name: 'New Name' };
      await service.updateTest(USER_ID, TEST_ID, input);

      expect(mockTestRepo.isNameAvailable).toHaveBeenCalledWith(
        SUITE_ID,
        'New Name',
        TEST_ID
      );
    });

    it('should throw when name is taken', async () => {
      mockTestRepo.isNameAvailable.mockResolvedValue(false);

      const input: UpdateTestRequest = { name: 'Existing Name' };
      await expect(
        service.updateTest(USER_ID, TEST_ID, input)
      ).rejects.toThrow(TestError);
    });

    it('should throw when update returns null', async () => {
      mockTestRepo.update.mockResolvedValue(null);

      const input: UpdateTestRequest = { description: 'Updated' };
      await expect(
        service.updateTest(USER_ID, TEST_ID, input)
      ).rejects.toThrow('Test not found');
    });
  });

  describe('moveTests', () => {
    it('should move tests to target suite', async () => {
      const request = {
        testIds: [TEST_ID],
        targetSuiteId: SUITE_ID_2,
      };

      mockSuiteRepo.findByIdAndUser.mockResolvedValue({
        ...sampleSuite,
        id: SUITE_ID_2,
      });

      const result = await service.moveTests(USER_ID, PROJECT_ID, request);

      expect(result.movedCount).toBe(1);
      expect(mockTestRepo.moveToSuite).toHaveBeenCalledWith(
        [TEST_ID],
        USER_ID,
        SUITE_ID_2
      );
    });

    it('should throw when target suite not found', async () => {
      mockSuiteRepo.findByIdAndUser.mockResolvedValue(null);

      const request = {
        testIds: [TEST_ID],
        targetSuiteId: NON_EXISTENT_ID,
      };

      await expect(
        service.moveTests(USER_ID, PROJECT_ID, request)
      ).rejects.toThrow('Target suite not found');
    });

    it('should throw when target suite in different project', async () => {
      mockSuiteRepo.findByIdAndUser.mockResolvedValue({
        ...sampleSuite,
        projectId: DIFFERENT_PROJECT_ID,
      });

      const request = {
        testIds: [TEST_ID],
        targetSuiteId: SUITE_ID_2,
      };

      await expect(
        service.moveTests(USER_ID, PROJECT_ID, request)
      ).rejects.toThrow('Target suite not found');
    });
  });

  describe('reorderTests', () => {
    it('should reorder tests', async () => {
      const request = { testIds: [TEST_ID_1, TEST_ID_2, TEST_ID_3] };

      await service.reorderTests(USER_ID, SUITE_ID, request);

      expect(mockTestRepo.reorder).toHaveBeenCalledWith(
        USER_ID,
        SUITE_ID,
        [TEST_ID_1, TEST_ID_2, TEST_ID_3]
      );
    });

    it('should throw when suite not found', async () => {
      mockSuiteRepo.findByIdAndUser.mockResolvedValue(null);

      const request = { testIds: [TEST_ID_1] };
      await expect(
        service.reorderTests(USER_ID, NON_EXISTENT_ID, request)
      ).rejects.toThrow('Target suite not found');
    });
  });

  describe('deleteTest', () => {
    it('should delete a test', async () => {
      await service.deleteTest(USER_ID, TEST_ID);

      expect(mockTestRepo.softDelete).toHaveBeenCalledWith(TEST_ID, USER_ID);
    });

    it('should throw when test not found', async () => {
      mockTestRepo.findByIdAndUser.mockResolvedValue(null);

      await expect(
        service.deleteTest(USER_ID, NON_EXISTENT_ID)
      ).rejects.toThrow('Test not found');
    });

    it('should throw when softDelete returns false', async () => {
      mockTestRepo.softDelete.mockResolvedValue(false);

      await expect(
        service.deleteTest(USER_ID, TEST_ID)
      ).rejects.toThrow('Test not found');
    });
  });

  describe('countTests', () => {
    it('should return test count', async () => {
      const count = await service.countTests(USER_ID, PROJECT_ID);

      expect(count).toBe(5);
      expect(mockTestRepo.countByProject).toHaveBeenCalledWith(USER_ID, PROJECT_ID);
    });
  });
});
