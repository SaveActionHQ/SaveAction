/**
 * Test Service
 *
 * Business logic for test CRUD operations.
 * Handles validation, transformation, and coordination.
 *
 * A Test = Recording Data (JSONB) + Saved Config + Browser List
 * Tests belong to suites within projects.
 */

import { z } from 'zod';
import type {
  TestRepository,
  TestCreateData,
  TestUpdateData,
  TestListFilters,
  SafeTest,
  TestSummary,
} from '../repositories/TestRepository.js';
import type { TestSuiteRepository } from '../repositories/TestSuiteRepository.js';
import type {
  RecordingRepository,
  RecordingCreateData,
} from '../repositories/RecordingRepository.js';
import type { RecordingData } from '../db/schema/recordings.js';
import type { BrowserType, TestConfig } from '../db/schema/tests.js';
import { DEFAULT_TEST_CONFIG } from '../db/schema/tests.js';

/**
 * Test Service Error
 */
export class TestError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'TestError';
  }
}

/**
 * Predefined Test errors
 */
export const TestErrors = {
  NOT_FOUND: new TestError('Test not found', 'TEST_NOT_FOUND', 404),
  NOT_AUTHORIZED: new TestError('Not authorized to access this test', 'NOT_AUTHORIZED', 403),
  NAME_TAKEN: new TestError(
    'A test with this name already exists in this suite',
    'TEST_NAME_TAKEN',
    409
  ),
  SUITE_NOT_FOUND: new TestError('Target suite not found', 'SUITE_NOT_FOUND', 404),
  INVALID_RECORDING_DATA: new TestError(
    'Recording data is invalid or missing required fields',
    'INVALID_RECORDING_DATA',
    400
  ),
  INVALID_BROWSERS: new TestError('At least one browser must be selected', 'INVALID_BROWSERS', 400),
} as const;

/**
 * Browser type Zod schema
 */
const browserTypeSchema = z.enum(['chromium', 'firefox', 'webkit']);

/**
 * Test config Zod schema
 */
const testConfigSchema = z.object({
  headless: z.boolean().optional(),
  video: z.boolean().optional(),
  screenshot: z.enum(['on', 'off', 'only-on-failure']).optional(),
  timeout: z.number().int().positive().max(300000).optional(),
  retries: z.number().int().min(0).max(5).optional(),
  slowMo: z.number().int().min(0).max(5000).optional(),
  viewport: z
    .object({
      width: z.number().int().positive().max(7680),
      height: z.number().int().positive().max(4320),
    })
    .optional(),
});

/**
 * Create test request schema
 */
export const createTestSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional().nullable(),
  suiteId: z.string().uuid().optional(), // Defaults to default suite
  recordingId: z.string().uuid().optional().nullable(), // Existing library recording
  recordingData: z.record(z.unknown()),
  recordingUrl: z.string().url().max(2048).optional().nullable(),
  actionCount: z.number().int().min(0).optional(),
  browsers: z.array(browserTypeSchema).min(1).max(3).optional(),
  config: testConfigSchema.optional(),
});

/**
 * Update test request schema
 */
export const updateTestSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
  suiteId: z.string().uuid().optional(),
  recordingId: z.string().uuid().optional().nullable(),
  recordingData: z.record(z.unknown()).optional(),
  recordingUrl: z.string().url().max(2048).optional().nullable(),
  actionCount: z.number().int().min(0).optional(),
  browsers: z.array(browserTypeSchema).min(1).max(3).optional(),
  config: testConfigSchema.optional(),
});

/**
 * List tests query schema
 */
export const listTestsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  suiteId: z.string().uuid().optional(),
  search: z.string().max(255).optional(),
  status: z.string().optional(),
  sortBy: z
    .enum(['name', 'displayOrder', 'createdAt', 'lastRunAt'])
    .optional()
    .default('displayOrder'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
  includeDeleted: z.coerce.boolean().optional().default(false),
});

/**
 * Move tests request schema
 */
export const moveTestsSchema = z.object({
  testIds: z.array(z.string().uuid()).min(1),
  targetSuiteId: z.string().uuid(),
});

/**
 * Reorder tests request schema
 */
export const reorderTestsSchema = z.object({
  testIds: z.array(z.string().uuid()).min(1),
});

export type CreateTestRequest = z.infer<typeof createTestSchema>;
export type UpdateTestRequest = z.infer<typeof updateTestSchema>;
export type ListTestsQuery = z.infer<typeof listTestsQuerySchema>;
export type MoveTestsRequest = z.infer<typeof moveTestsSchema>;
export type ReorderTestsRequest = z.infer<typeof reorderTestsSchema>;

/**
 * Service configuration
 */
export interface TestServiceConfig {
  /** Maximum tests per project (0 = unlimited) */
  maxTestsPerProject: number;
}

const DEFAULT_SERVICE_CONFIG: TestServiceConfig = {
  maxTestsPerProject: 1000,
};

/**
 * Test response type (API-safe, full detail)
 */
export interface TestResponse {
  id: string;
  projectId: string;
  suiteId: string;
  name: string;
  description: string | null;
  slug: string;
  recordingId: string | null;
  recordingData: Record<string, unknown>;
  recordingUrl: string | null;
  actionCount: number;
  browsers: BrowserType[];
  config: TestConfig;
  displayOrder: number;
  lastRunId: string | null;
  lastRunAt: Date | null;
  lastRunStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Test summary response type (for list views)
 */
export interface TestSummaryResponse {
  id: string;
  projectId: string;
  suiteId: string;
  suiteName: string | null;
  name: string;
  slug: string;
  recordingUrl: string | null;
  actionCount: number;
  browsers: BrowserType[];
  displayOrder: number;
  lastRunId: string | null;
  lastRunAt: Date | null;
  lastRunStatus: string | null;
  createdAt: Date;
}

/**
 * Convert SafeTest to TestResponse
 */
function toResponse(test: SafeTest): TestResponse {
  return {
    id: test.id,
    projectId: test.projectId,
    suiteId: test.suiteId,
    name: test.name,
    description: test.description,
    slug: test.slug,
    recordingId: test.recordingId,
    recordingData: test.recordingData,
    recordingUrl: test.recordingUrl,
    actionCount: test.actionCount,
    browsers: test.browsers,
    config: test.config,
    displayOrder: test.displayOrder,
    lastRunId: test.lastRunId,
    lastRunAt: test.lastRunAt,
    lastRunStatus: test.lastRunStatus,
    createdAt: test.createdAt,
    updatedAt: test.updatedAt,
  };
}

/**
 * Convert TestSummary to TestSummaryResponse
 */
function toSummaryResponse(test: TestSummary): TestSummaryResponse {
  return {
    id: test.id,
    projectId: test.projectId,
    suiteId: test.suiteId,
    suiteName: test.suiteName,
    name: test.name,
    slug: test.slug,
    recordingUrl: test.recordingUrl,
    actionCount: test.actionCount,
    browsers: test.browsers,
    displayOrder: test.displayOrder,
    lastRunId: test.lastRunId,
    lastRunAt: test.lastRunAt,
    lastRunStatus: test.lastRunStatus,
    createdAt: test.createdAt,
  };
}

/**
 * Test Service class
 */
export class TestService {
  private readonly config: TestServiceConfig;

  constructor(
    private readonly testRepository: TestRepository,
    private readonly testSuiteRepository: TestSuiteRepository,
    private readonly recordingRepository?: RecordingRepository,
    config?: Partial<TestServiceConfig>
  ) {
    this.config = { ...DEFAULT_SERVICE_CONFIG, ...config };
  }

  /**
   * Create a new test
   */
  async createTest(
    userId: string,
    projectId: string,
    request: CreateTestRequest
  ): Promise<TestResponse> {
    const validatedData = createTestSchema.parse(request);

    // Check test limit per project
    if (this.config.maxTestsPerProject > 0) {
      const count = await this.testRepository.countByProject(userId, projectId);
      if (count >= this.config.maxTestsPerProject) {
        throw new TestError(
          `Maximum number of tests (${this.config.maxTestsPerProject}) per project reached`,
          'TEST_LIMIT_REACHED',
          400
        );
      }
    }

    // Determine suite - use provided or default
    let suiteId = validatedData.suiteId;
    if (!suiteId) {
      const defaultSuite = await this.testSuiteRepository.getOrCreateDefaultSuite(
        userId,
        projectId
      );
      suiteId = defaultSuite.id;
    } else {
      // Verify suite exists and belongs to user
      const suite = await this.testSuiteRepository.findByIdAndUser(suiteId, userId);
      if (!suite) {
        throw TestErrors.SUITE_NOT_FOUND;
      }
      // Verify suite belongs to the same project
      if (suite.projectId !== projectId) {
        throw TestErrors.SUITE_NOT_FOUND;
      }
    }

    // Check name uniqueness within suite
    const isAvailable = await this.testRepository.isNameAvailable(suiteId, validatedData.name);
    if (!isAvailable) {
      throw TestErrors.NAME_TAKEN;
    }

    // Auto-create recording in library if not already linked to one
    let recordingId = validatedData.recordingId || null;
    if (!recordingId && this.recordingRepository) {
      try {
        const recData = validatedData.recordingData as Record<string, unknown>;
        const recordingCreateData: RecordingCreateData = {
          userId,
          projectId,
          name: (recData.testName as string) || validatedData.name,
          url: (recData.url as string) || validatedData.recordingUrl || '',
          description: null,
          originalId: (recData.id as string) || null,
          tags: [],
          data: recData as unknown as RecordingData,
          schemaVersion: (recData.version as string) || '1.0.0',
        };
        const libraryRecording = await this.recordingRepository.create(recordingCreateData);
        recordingId = libraryRecording.id;
      } catch {
        // Non-critical: if library creation fails, still create the test
        // The recording data is stored inline on the test as a snapshot
      }
    }

    const createData: TestCreateData = {
      userId,
      projectId,
      suiteId,
      name: validatedData.name,
      description: validatedData.description || null,
      recordingId,
      recordingData: validatedData.recordingData,
      recordingUrl: validatedData.recordingUrl || null,
      actionCount: validatedData.actionCount ?? 0,
      browsers: validatedData.browsers as BrowserType[] | undefined,
      config: validatedData.config as Partial<TestConfig> | undefined,
    };

    const test = await this.testRepository.create(createData);
    return toResponse(test);
  }

  /**
   * Get a test by ID (full detail)
   */
  async getTest(userId: string, testId: string): Promise<TestResponse> {
    const test = await this.testRepository.findByIdAndUser(testId, userId);

    if (!test) {
      throw TestErrors.NOT_FOUND;
    }

    return toResponse(test);
  }

  /**
   * Get a test by slug within a project
   */
  async getTestBySlug(userId: string, projectId: string, slug: string): Promise<TestResponse> {
    const test = await this.testRepository.findBySlug(projectId, slug);

    if (!test) {
      throw TestErrors.NOT_FOUND;
    }

    // Verify ownership
    if (test.userId !== userId) {
      throw TestErrors.NOT_FOUND;
    }

    return toResponse(test);
  }

  /**
   * List tests with pagination
   */
  async listTests(
    userId: string,
    projectId: string,
    query: ListTestsQuery
  ): Promise<{
    data: TestSummaryResponse[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrevious: boolean;
    };
  }> {
    const validatedQuery = listTestsQuerySchema.parse(query);

    const filters: TestListFilters = {
      userId,
      projectId,
      suiteId: validatedQuery.suiteId,
      search: validatedQuery.search,
      status: validatedQuery.status,
      includeDeleted: validatedQuery.includeDeleted,
    };

    const result = await this.testRepository.findMany(filters, {
      page: validatedQuery.page,
      limit: validatedQuery.limit,
      sortBy: validatedQuery.sortBy,
      sortOrder: validatedQuery.sortOrder,
    });

    return {
      data: result.data.map(toSummaryResponse),
      pagination: result.pagination,
    };
  }

  /**
   * Update a test
   */
  async updateTest(
    userId: string,
    testId: string,
    request: UpdateTestRequest
  ): Promise<TestResponse> {
    const validatedData = updateTestSchema.parse(request);

    // Check that test exists and belongs to user
    const existing = await this.testRepository.findByIdAndUser(testId, userId);
    if (!existing) {
      throw TestErrors.NOT_FOUND;
    }

    // If moving to a different suite, verify the target suite
    if (validatedData.suiteId && validatedData.suiteId !== existing.suiteId) {
      const suite = await this.testSuiteRepository.findByIdAndUser(validatedData.suiteId, userId);
      if (!suite) {
        throw TestErrors.SUITE_NOT_FOUND;
      }
      if (suite.projectId !== existing.projectId) {
        throw TestErrors.SUITE_NOT_FOUND;
      }
    }

    // Check name uniqueness if changing name
    const targetSuiteId = validatedData.suiteId || existing.suiteId;
    if (validatedData.name && validatedData.name !== existing.name) {
      const isAvailable = await this.testRepository.isNameAvailable(
        targetSuiteId,
        validatedData.name,
        testId
      );
      if (!isAvailable) {
        throw TestErrors.NAME_TAKEN;
      }
    }

    const updateData: TestUpdateData = {};
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.suiteId !== undefined) updateData.suiteId = validatedData.suiteId;
    if (validatedData.recordingId !== undefined) updateData.recordingId = validatedData.recordingId;
    if (validatedData.recordingData !== undefined)
      updateData.recordingData = validatedData.recordingData;
    if (validatedData.recordingUrl !== undefined)
      updateData.recordingUrl = validatedData.recordingUrl;
    if (validatedData.actionCount !== undefined) updateData.actionCount = validatedData.actionCount;
    if (validatedData.browsers !== undefined)
      updateData.browsers = validatedData.browsers as BrowserType[];
    if (validatedData.config !== undefined)
      updateData.config = validatedData.config as Partial<TestConfig>;

    const updated = await this.testRepository.update(testId, userId, updateData);
    if (!updated) {
      throw TestErrors.NOT_FOUND;
    }

    return toResponse(updated);
  }

  /**
   * Move tests to a different suite
   */
  async moveTests(
    userId: string,
    projectId: string,
    request: MoveTestsRequest
  ): Promise<{ movedCount: number }> {
    const validatedData = moveTestsSchema.parse(request);

    // Verify target suite exists and belongs to same project
    const suite = await this.testSuiteRepository.findByIdAndUser(
      validatedData.targetSuiteId,
      userId
    );
    if (!suite) {
      throw TestErrors.SUITE_NOT_FOUND;
    }
    if (suite.projectId !== projectId) {
      throw TestErrors.SUITE_NOT_FOUND;
    }

    const movedCount = await this.testRepository.moveToSuite(
      validatedData.testIds,
      userId,
      validatedData.targetSuiteId
    );

    return { movedCount };
  }

  /**
   * Reorder tests within a suite
   */
  async reorderTests(userId: string, suiteId: string, request: ReorderTestsRequest): Promise<void> {
    const validatedData = reorderTestsSchema.parse(request);

    // Verify suite exists
    const suite = await this.testSuiteRepository.findByIdAndUser(suiteId, userId);
    if (!suite) {
      throw TestErrors.SUITE_NOT_FOUND;
    }

    await this.testRepository.reorder(userId, suiteId, validatedData.testIds);
  }

  /**
   * Delete a test (soft delete)
   */
  async deleteTest(userId: string, testId: string): Promise<void> {
    const existing = await this.testRepository.findByIdAndUser(testId, userId);
    if (!existing) {
      throw TestErrors.NOT_FOUND;
    }

    const deleted = await this.testRepository.softDelete(testId, userId);
    if (!deleted) {
      throw TestErrors.NOT_FOUND;
    }
  }

  /**
   * Count tests for a project
   */
  async countTests(userId: string, projectId: string): Promise<number> {
    return this.testRepository.countByProject(userId, projectId);
  }
}

// Re-export for convenience
export { DEFAULT_TEST_CONFIG };
export type { BrowserType, TestConfig };
