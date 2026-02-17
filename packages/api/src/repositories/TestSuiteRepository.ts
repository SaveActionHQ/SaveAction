/**
 * Test Suite Repository
 *
 * Data access layer for test suite CRUD operations.
 * Uses Drizzle ORM for type-safe queries.
 *
 * Test suites group tests within a project. Each project
 * has a default "Unorganized" suite for ungrouped tests.
 */

import { eq, and, isNull, sql, desc, asc, ilike } from 'drizzle-orm';
import {
  testSuites,
  type TestSuite,
  type NewTestSuite,
} from '../db/schema/test-suites.js';
import { tests } from '../db/schema/tests.js';
import type { Database } from '../db/index.js';

/**
 * Default suite name (created automatically per project)
 */
export const DEFAULT_SUITE_NAME = 'Unorganized';

/**
 * Test suite creation data
 */
export interface TestSuiteCreateData {
  userId: string;
  projectId: string;
  name: string;
  description?: string | null;
  displayOrder?: number;
}

/**
 * Test suite update data
 */
export interface TestSuiteUpdateData {
  name?: string;
  description?: string | null;
  displayOrder?: number;
}

/**
 * Test suite list filters
 */
export interface TestSuiteListFilters {
  userId: string;
  projectId: string;
  search?: string;
  includeDeleted?: boolean;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'displayOrder' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

/**
 * Safe test suite response (typed fields)
 */
export interface SafeTestSuite {
  id: string;
  userId: string;
  projectId: string;
  name: string;
  description: string | null;
  displayOrder: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Test suite with test count (for list view)
 */
export interface TestSuiteWithStats extends SafeTestSuite {
  testCount: number;
  passedCount: number;
  failedCount: number;
}

/**
 * Convert raw DB result to SafeTestSuite
 */
function toSafeTestSuite(suite: TestSuite): SafeTestSuite {
  return {
    id: suite.id,
    userId: suite.userId,
    projectId: suite.projectId,
    name: suite.name,
    description: suite.description,
    displayOrder: suite.displayOrder,
    deletedAt: suite.deletedAt,
    createdAt: suite.createdAt,
    updatedAt: suite.updatedAt,
  };
}

/**
 * Test Suite Repository class
 */
export class TestSuiteRepository {
  constructor(private readonly db: Database) {}

  /**
   * Create a new test suite
   */
  async create(data: TestSuiteCreateData): Promise<SafeTestSuite> {
    const newSuite: NewTestSuite = {
      userId: data.userId,
      projectId: data.projectId,
      name: data.name,
      description: data.description || null,
      displayOrder: data.displayOrder ?? 0,
    };

    const result = await this.db.insert(testSuites).values(newSuite).returning();

    return toSafeTestSuite(result[0]);
  }

  /**
   * Create the default "Unorganized" suite for a project
   */
  async createDefaultSuite(userId: string, projectId: string): Promise<SafeTestSuite> {
    return this.create({
      userId,
      projectId,
      name: DEFAULT_SUITE_NAME,
      description: 'Default suite for ungrouped tests',
      displayOrder: 0,
    });
  }

  /**
   * Find a test suite by ID (active only by default)
   */
  async findById(id: string, includeDeleted = false): Promise<SafeTestSuite | null> {
    const conditions = includeDeleted
      ? eq(testSuites.id, id)
      : and(eq(testSuites.id, id), isNull(testSuites.deletedAt));

    const result = await this.db.select().from(testSuites).where(conditions).limit(1);

    return result[0] ? toSafeTestSuite(result[0]) : null;
  }

  /**
   * Find a test suite by ID and verify ownership
   */
  async findByIdAndUser(
    id: string,
    userId: string,
    includeDeleted = false
  ): Promise<SafeTestSuite | null> {
    const conditions = includeDeleted
      ? and(eq(testSuites.id, id), eq(testSuites.userId, userId))
      : and(
          eq(testSuites.id, id),
          eq(testSuites.userId, userId),
          isNull(testSuites.deletedAt)
        );

    const result = await this.db.select().from(testSuites).where(conditions).limit(1);

    return result[0] ? toSafeTestSuite(result[0]) : null;
  }

  /**
   * Find the default suite for a project
   */
  async findDefaultSuite(projectId: string): Promise<SafeTestSuite | null> {
    const result = await this.db
      .select()
      .from(testSuites)
      .where(
        and(
          eq(testSuites.projectId, projectId),
          sql`LOWER(${testSuites.name}) = LOWER(${DEFAULT_SUITE_NAME})`,
          isNull(testSuites.deletedAt)
        )
      )
      .limit(1);

    return result[0] ? toSafeTestSuite(result[0]) : null;
  }

  /**
   * Find a suite by name within a project (case-insensitive)
   */
  async findByNameAndProject(
    name: string,
    projectId: string
  ): Promise<SafeTestSuite | null> {
    const result = await this.db
      .select()
      .from(testSuites)
      .where(
        and(
          eq(testSuites.projectId, projectId),
          sql`LOWER(${testSuites.name}) = LOWER(${name})`,
          isNull(testSuites.deletedAt)
        )
      )
      .limit(1);

    return result[0] ? toSafeTestSuite(result[0]) : null;
  }

  /**
   * List test suites for a project with pagination
   */
  async findMany(
    filters: TestSuiteListFilters,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<SafeTestSuite>> {
    const { page = 1, limit = 50, sortBy = 'displayOrder', sortOrder = 'asc' } = options;
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [
      eq(testSuites.userId, filters.userId),
      eq(testSuites.projectId, filters.projectId),
    ];

    if (!filters.includeDeleted) {
      conditions.push(isNull(testSuites.deletedAt));
    }

    if (filters.search) {
      conditions.push(ilike(testSuites.name, `%${filters.search}%`));
    }

    const whereClause = and(...conditions);

    // Get sort column
    const sortColumn = {
      name: testSuites.name,
      displayOrder: testSuites.displayOrder,
      createdAt: testSuites.createdAt,
    }[sortBy];

    const orderFn = sortOrder === 'asc' ? asc : desc;

    // Get total count
    const countResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(testSuites)
      .where(whereClause);

    const total = countResult[0]?.count || 0;

    // Get paginated results
    const result = await this.db
      .select()
      .from(testSuites)
      .where(whereClause)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset);

    const totalPages = Math.ceil(total / limit);

    return {
      data: result.map(toSafeTestSuite),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  /**
   * Get all suites for a project (simple list, ordered by displayOrder)
   */
  async findAllByProject(
    userId: string,
    projectId: string
  ): Promise<SafeTestSuite[]> {
    const result = await this.db
      .select()
      .from(testSuites)
      .where(
        and(
          eq(testSuites.userId, userId),
          eq(testSuites.projectId, projectId),
          isNull(testSuites.deletedAt)
        )
      )
      .orderBy(asc(testSuites.displayOrder), asc(testSuites.name));

    return result.map(toSafeTestSuite);
  }

  /**
   * Get suites with test counts and pass/fail stats
   */
  async findAllWithStats(
    userId: string,
    projectId: string
  ): Promise<TestSuiteWithStats[]> {
    const result = await this.db
      .select({
        id: testSuites.id,
        userId: testSuites.userId,
        projectId: testSuites.projectId,
        name: testSuites.name,
        description: testSuites.description,
        displayOrder: testSuites.displayOrder,
        deletedAt: testSuites.deletedAt,
        createdAt: testSuites.createdAt,
        updatedAt: testSuites.updatedAt,
        testCount: sql<number>`count(${tests.id})::int`,
        passedCount: sql<number>`count(case when ${tests.lastRunStatus} = 'completed' then 1 end)::int`,
        failedCount: sql<number>`count(case when ${tests.lastRunStatus} = 'failed' then 1 end)::int`,
      })
      .from(testSuites)
      .leftJoin(
        tests,
        and(eq(tests.suiteId, testSuites.id), isNull(tests.deletedAt))
      )
      .where(
        and(
          eq(testSuites.userId, userId),
          eq(testSuites.projectId, projectId),
          isNull(testSuites.deletedAt)
        )
      )
      .groupBy(testSuites.id)
      .orderBy(asc(testSuites.displayOrder), asc(testSuites.name));

    return result.map((row) => ({
      id: row.id,
      userId: row.userId,
      projectId: row.projectId,
      name: row.name,
      description: row.description,
      displayOrder: row.displayOrder,
      deletedAt: row.deletedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      testCount: row.testCount,
      passedCount: row.passedCount,
      failedCount: row.failedCount,
    }));
  }

  /**
   * Update a test suite
   */
  async update(
    id: string,
    userId: string,
    data: TestSuiteUpdateData
  ): Promise<SafeTestSuite | null> {
    const result = await this.db
      .update(testSuites)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.displayOrder !== undefined && { displayOrder: data.displayOrder }),
      })
      .where(
        and(
          eq(testSuites.id, id),
          eq(testSuites.userId, userId),
          isNull(testSuites.deletedAt)
        )
      )
      .returning();

    return result[0] ? toSafeTestSuite(result[0]) : null;
  }

  /**
   * Reorder suites within a project
   */
  async reorder(
    userId: string,
    projectId: string,
    orderedIds: string[]
  ): Promise<void> {
    // Use a transaction to update all display orders
    await this.db.transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx
          .update(testSuites)
          .set({ displayOrder: i })
          .where(
            and(
              eq(testSuites.id, orderedIds[i]),
              eq(testSuites.userId, userId),
              eq(testSuites.projectId, projectId),
              isNull(testSuites.deletedAt)
            )
          );
      }
    });
  }

  /**
   * Soft delete a test suite
   * Note: Tests in the suite will be moved to the default suite
   */
  async softDelete(id: string, userId: string): Promise<boolean> {
    const now = new Date();

    const result = await this.db
      .update(testSuites)
      .set({ deletedAt: now })
      .where(
        and(
          eq(testSuites.id, id),
          eq(testSuites.userId, userId),
          // Cannot delete default suite
          sql`LOWER(${testSuites.name}) != LOWER(${DEFAULT_SUITE_NAME})`,
          isNull(testSuites.deletedAt)
        )
      )
      .returning();

    return result.length > 0;
  }

  /**
   * Restore a soft-deleted test suite
   */
  async restore(id: string, userId: string): Promise<SafeTestSuite | null> {
    const result = await this.db
      .update(testSuites)
      .set({ deletedAt: null })
      .where(and(eq(testSuites.id, id), eq(testSuites.userId, userId)))
      .returning();

    return result[0] ? toSafeTestSuite(result[0]) : null;
  }

  /**
   * Count suites for a project
   */
  async countByProject(userId: string, projectId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(testSuites)
      .where(
        and(
          eq(testSuites.userId, userId),
          eq(testSuites.projectId, projectId),
          isNull(testSuites.deletedAt)
        )
      );

    return result[0]?.count || 0;
  }

  /**
   * Check if a suite name is available within a project
   */
  async isNameAvailable(
    projectId: string,
    name: string,
    excludeId?: string
  ): Promise<boolean> {
    const conditions = [
      eq(testSuites.projectId, projectId),
      sql`LOWER(${testSuites.name}) = LOWER(${name})`,
      isNull(testSuites.deletedAt),
    ];

    if (excludeId) {
      conditions.push(sql`${testSuites.id} != ${excludeId}`);
    }

    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(testSuites)
      .where(and(...conditions));

    return (result[0]?.count || 0) === 0;
  }

  /**
   * Get or create the default suite for a project
   */
  async getOrCreateDefaultSuite(
    userId: string,
    projectId: string
  ): Promise<SafeTestSuite> {
    const existing = await this.findDefaultSuite(projectId);
    if (existing) return existing;
    return this.createDefaultSuite(userId, projectId);
  }
}
