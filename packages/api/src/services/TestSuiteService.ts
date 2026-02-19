/**
 * Test Suite Service
 *
 * Business logic for test suite CRUD operations.
 * Handles validation, transformation, and coordination.
 *
 * Test suites group tests within a project.
 * Each project has a default "Unorganized" suite.
 */

import { z } from 'zod';
import type {
  TestSuiteRepository,
  TestSuiteCreateData,
  TestSuiteUpdateData,
  TestSuiteListFilters,
  SafeTestSuite,
  TestSuiteWithStats,
} from '../repositories/TestSuiteRepository.js';
import { DEFAULT_SUITE_NAME } from '../repositories/TestSuiteRepository.js';

/**
 * Test Suite Service Error
 */
export class TestSuiteError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'TestSuiteError';
  }
}

/**
 * Predefined Test Suite errors
 */
export const TestSuiteErrors = {
  NOT_FOUND: new TestSuiteError('Test suite not found', 'SUITE_NOT_FOUND', 404),
  NOT_AUTHORIZED: new TestSuiteError(
    'Not authorized to access this test suite',
    'NOT_AUTHORIZED',
    403
  ),
  NAME_TAKEN: new TestSuiteError(
    'A test suite with this name already exists in this project',
    'SUITE_NAME_TAKEN',
    409
  ),
  CANNOT_DELETE_DEFAULT: new TestSuiteError(
    'The default suite cannot be deleted',
    'CANNOT_DELETE_DEFAULT_SUITE',
    400
  ),
  CANNOT_RENAME_DEFAULT: new TestSuiteError(
    'The default suite cannot be renamed',
    'CANNOT_RENAME_DEFAULT_SUITE',
    400
  ),
  INVALID_REORDER: new TestSuiteError(
    'Invalid reorder data: must provide all suite IDs',
    'INVALID_REORDER',
    400
  ),
} as const;

/**
 * Create test suite request schema
 */
export const createTestSuiteSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional().nullable(),
});

/**
 * Update test suite request schema
 */
export const updateTestSuiteSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
});

/**
 * List test suites query schema
 */
export const listTestSuitesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  search: z.string().max(255).optional(),
  sortBy: z.enum(['name', 'displayOrder', 'createdAt']).optional().default('displayOrder'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
  includeDeleted: z.coerce.boolean().optional().default(false),
});

/**
 * Reorder test suites request schema
 */
export const reorderTestSuitesSchema = z.object({
  suiteIds: z.array(z.string().uuid()).min(1),
});

export type CreateTestSuiteRequest = z.infer<typeof createTestSuiteSchema>;
export type UpdateTestSuiteRequest = z.infer<typeof updateTestSuiteSchema>;
export type ListTestSuitesQuery = z.infer<typeof listTestSuitesQuerySchema>;
export type ReorderTestSuitesRequest = z.infer<typeof reorderTestSuitesSchema>;

/**
 * Service configuration
 */
export interface TestSuiteServiceConfig {
  /** Maximum suites per project (0 = unlimited) */
  maxSuitesPerProject: number;
}

const DEFAULT_CONFIG: TestSuiteServiceConfig = {
  maxSuitesPerProject: 100,
};

/**
 * Test Suite response type (API-safe)
 */
export interface TestSuiteResponse {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Test Suite with stats response type
 */
export interface TestSuiteWithStatsResponse extends TestSuiteResponse {
  testCount: number;
  passedCount: number;
  failedCount: number;
}

/**
 * Convert SafeTestSuite to TestSuiteResponse
 */
function toResponse(suite: SafeTestSuite): TestSuiteResponse {
  return {
    id: suite.id,
    projectId: suite.projectId,
    name: suite.name,
    description: suite.description,
    displayOrder: suite.displayOrder,
    createdAt: suite.createdAt,
    updatedAt: suite.updatedAt,
  };
}

/**
 * Convert TestSuiteWithStats to TestSuiteWithStatsResponse
 */
function toStatsResponse(suite: TestSuiteWithStats): TestSuiteWithStatsResponse {
  return {
    id: suite.id,
    projectId: suite.projectId,
    name: suite.name,
    description: suite.description,
    displayOrder: suite.displayOrder,
    createdAt: suite.createdAt,
    updatedAt: suite.updatedAt,
    testCount: suite.testCount,
    passedCount: suite.passedCount,
    failedCount: suite.failedCount,
  };
}

/**
 * Check if a suite is the default suite
 */
function isDefaultSuite(name: string): boolean {
  return name.toLowerCase() === DEFAULT_SUITE_NAME.toLowerCase();
}

/**
 * Test Suite Service class
 */
export class TestSuiteService {
  private readonly config: TestSuiteServiceConfig;

  constructor(
    private readonly testSuiteRepository: TestSuiteRepository,
    config?: Partial<TestSuiteServiceConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create a new test suite
   */
  async createTestSuite(
    userId: string,
    projectId: string,
    request: CreateTestSuiteRequest
  ): Promise<TestSuiteResponse> {
    const validatedData = createTestSuiteSchema.parse(request);

    // Cannot create a suite named like the default
    if (isDefaultSuite(validatedData.name)) {
      throw TestSuiteErrors.NAME_TAKEN;
    }

    // Check suite limit
    if (this.config.maxSuitesPerProject > 0) {
      const count = await this.testSuiteRepository.countByProject(userId, projectId);
      if (count >= this.config.maxSuitesPerProject) {
        throw new TestSuiteError(
          `Maximum number of suites (${this.config.maxSuitesPerProject}) per project reached`,
          'SUITE_LIMIT_REACHED',
          400
        );
      }
    }

    // Check name uniqueness
    const isAvailable = await this.testSuiteRepository.isNameAvailable(
      projectId,
      validatedData.name
    );
    if (!isAvailable) {
      throw TestSuiteErrors.NAME_TAKEN;
    }

    const createData: TestSuiteCreateData = {
      userId,
      projectId,
      name: validatedData.name,
      description: validatedData.description || null,
    };

    const suite = await this.testSuiteRepository.create(createData);
    return toResponse(suite);
  }

  /**
   * Get a test suite by ID
   */
  async getTestSuite(userId: string, suiteId: string): Promise<TestSuiteResponse> {
    const suite = await this.testSuiteRepository.findByIdAndUser(suiteId, userId);

    if (!suite) {
      throw TestSuiteErrors.NOT_FOUND;
    }

    return toResponse(suite);
  }

  /**
   * Get or create the default suite for a project
   */
  async ensureDefaultSuite(userId: string, projectId: string): Promise<TestSuiteResponse> {
    const suite = await this.testSuiteRepository.getOrCreateDefaultSuite(userId, projectId);
    return toResponse(suite);
  }

  /**
   * List all suites for a project with stats (no pagination)
   */
  async listAllWithStats(
    userId: string,
    projectId: string
  ): Promise<TestSuiteWithStatsResponse[]> {
    const suites = await this.testSuiteRepository.findAllWithStats(userId, projectId);
    return suites.map(toStatsResponse);
  }

  /**
   * List suites with pagination
   */
  async listTestSuites(
    userId: string,
    projectId: string,
    query: ListTestSuitesQuery
  ): Promise<{
    data: TestSuiteResponse[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrevious: boolean;
    };
  }> {
    const validatedQuery = listTestSuitesQuerySchema.parse(query);

    const filters: TestSuiteListFilters = {
      userId,
      projectId,
      search: validatedQuery.search,
      includeDeleted: validatedQuery.includeDeleted,
    };

    const result = await this.testSuiteRepository.findMany(filters, {
      page: validatedQuery.page,
      limit: validatedQuery.limit,
      sortBy: validatedQuery.sortBy,
      sortOrder: validatedQuery.sortOrder,
    });

    return {
      data: result.data.map(toResponse),
      pagination: result.pagination,
    };
  }

  /**
   * Update a test suite
   */
  async updateTestSuite(
    userId: string,
    suiteId: string,
    request: UpdateTestSuiteRequest
  ): Promise<TestSuiteResponse> {
    const validatedData = updateTestSuiteSchema.parse(request);

    // Check that suite exists and belongs to user
    const existing = await this.testSuiteRepository.findByIdAndUser(suiteId, userId);
    if (!existing) {
      throw TestSuiteErrors.NOT_FOUND;
    }

    // Cannot rename default suite
    if (validatedData.name && isDefaultSuite(existing.name)) {
      throw TestSuiteErrors.CANNOT_RENAME_DEFAULT;
    }

    // Cannot rename to default suite name
    if (validatedData.name && isDefaultSuite(validatedData.name)) {
      throw TestSuiteErrors.NAME_TAKEN;
    }

    // Check name uniqueness if changing name
    if (validatedData.name && validatedData.name !== existing.name) {
      const isAvailable = await this.testSuiteRepository.isNameAvailable(
        existing.projectId,
        validatedData.name,
        suiteId
      );
      if (!isAvailable) {
        throw TestSuiteErrors.NAME_TAKEN;
      }
    }

    const updateData: TestSuiteUpdateData = {};
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;

    const updated = await this.testSuiteRepository.update(suiteId, userId, updateData);
    if (!updated) {
      throw TestSuiteErrors.NOT_FOUND;
    }

    return toResponse(updated);
  }

  /**
   * Reorder suites within a project
   */
  async reorderTestSuites(
    userId: string,
    projectId: string,
    request: ReorderTestSuitesRequest
  ): Promise<void> {
    const validatedData = reorderTestSuitesSchema.parse(request);

    // Verify all suite IDs belong to the project
    const allSuites = await this.testSuiteRepository.findAllByProject(userId, projectId);
    const allIds = new Set(allSuites.map((s) => s.id));

    for (const id of validatedData.suiteIds) {
      if (!allIds.has(id)) {
        throw TestSuiteErrors.INVALID_REORDER;
      }
    }

    await this.testSuiteRepository.reorder(userId, projectId, validatedData.suiteIds);
  }

  /**
   * Delete a test suite (soft delete)
   * Tests in the suite will be moved to the default suite
   */
  async deleteTestSuite(
    userId: string,
    _projectId: string,
    suiteId: string
  ): Promise<void> {
    const existing = await this.testSuiteRepository.findByIdAndUser(suiteId, userId);
    if (!existing) {
      throw TestSuiteErrors.NOT_FOUND;
    }

    // Cannot delete default suite
    if (isDefaultSuite(existing.name)) {
      throw TestSuiteErrors.CANNOT_DELETE_DEFAULT;
    }

    const deleted = await this.testSuiteRepository.softDelete(suiteId, userId);
    if (!deleted) {
      throw TestSuiteErrors.NOT_FOUND;
    }

    // Note: Tests in this suite should be moved to the default suite.
    // This is handled at the route/controller level with the TestRepository.
  }

  /**
   * Count suites for a project
   */
  async countSuites(userId: string, projectId: string): Promise<number> {
    return this.testSuiteRepository.countByProject(userId, projectId);
  }
}

// Re-export for convenience
export { DEFAULT_SUITE_NAME };
