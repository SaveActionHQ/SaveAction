/**
 * Test Repository
 *
 * Data access layer for test CRUD operations.
 * Uses Drizzle ORM for type-safe queries.
 *
 * A Test = Recording Data (JSONB) + Saved Config + Browser List
 * Each test belongs to a suite within a project.
 */

import { eq, and, isNull, sql, desc, asc, ilike, inArray } from 'drizzle-orm';
import {
  tests,
  type Test,
  type NewTest,
  type TestConfig,
  type BrowserType,
  DEFAULT_TEST_CONFIG,
} from '../db/schema/tests.js';
import { testSuites } from '../db/schema/test-suites.js';
import type { Database } from '../db/index.js';

/**
 * Test creation data
 */
export interface TestCreateData {
  userId: string;
  projectId: string;
  suiteId: string;
  name: string;
  description?: string | null;
  slug?: string; // Auto-generated from name if not provided
  recordingData: Record<string, unknown>;
  recordingUrl?: string | null;
  actionCount?: number;
  browsers?: BrowserType[];
  config?: Partial<TestConfig>;
}

/**
 * Test update data
 */
export interface TestUpdateData {
  name?: string;
  description?: string | null;
  slug?: string;
  suiteId?: string;
  recordingData?: Record<string, unknown>;
  recordingUrl?: string | null;
  actionCount?: number;
  browsers?: BrowserType[];
  config?: Partial<TestConfig>;
  displayOrder?: number;
}

/**
 * Last run update data (denormalized for quick UI display)
 */
export interface TestLastRunUpdate {
  lastRunId: string;
  lastRunAt: Date;
  lastRunStatus: string;
}

/**
 * Test list filters
 */
export interface TestListFilters {
  userId: string;
  projectId: string;
  suiteId?: string;
  search?: string;
  status?: string; // Filter by lastRunStatus
  includeDeleted?: boolean;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'displayOrder' | 'createdAt' | 'lastRunAt';
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
 * Safe test response (typed fields)
 */
export interface SafeTest {
  id: string;
  userId: string;
  projectId: string;
  suiteId: string;
  name: string;
  description: string | null;
  slug: string;
  recordingData: Record<string, unknown>;
  recordingUrl: string | null;
  actionCount: number;
  browsers: BrowserType[];
  config: TestConfig;
  displayOrder: number;
  lastRunId: string | null;
  lastRunAt: Date | null;
  lastRunStatus: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Test summary (for list view - without recording data)
 */
export interface TestSummary {
  id: string;
  userId: string;
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
 * Generate a URL-friendly slug from a name
 * "Add to Cart Test" → "add-to-cart-test"
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_]+/g, '-') // Replace spaces/underscores with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, ''); // Trim leading/trailing hyphens
}

/**
 * Convert raw DB result to SafeTest
 */
function toSafeTest(test: Test): SafeTest {
  return {
    id: test.id,
    userId: test.userId,
    projectId: test.projectId,
    suiteId: test.suiteId,
    name: test.name,
    description: test.description,
    slug: test.slug,
    recordingData: test.recordingData as Record<string, unknown>,
    recordingUrl: test.recordingUrl,
    actionCount: test.actionCount ?? 0,
    browsers: (test.browsers ?? ['chromium']) as BrowserType[],
    config: (test.config ?? DEFAULT_TEST_CONFIG) as TestConfig,
    displayOrder: test.displayOrder,
    lastRunId: test.lastRunId,
    lastRunAt: test.lastRunAt,
    lastRunStatus: test.lastRunStatus,
    deletedAt: test.deletedAt,
    createdAt: test.createdAt,
    updatedAt: test.updatedAt,
  };
}

/**
 * Convert raw DB result to TestSummary
 */
function toTestSummary(
  test: Partial<Test> & { suiteName?: string | null }
): TestSummary {
  return {
    id: test.id!,
    userId: test.userId!,
    projectId: test.projectId!,
    suiteId: test.suiteId!,
    suiteName: test.suiteName ?? null,
    name: test.name!,
    slug: test.slug!,
    recordingUrl: test.recordingUrl ?? null,
    actionCount: test.actionCount ?? 0,
    browsers: (test.browsers ?? ['chromium']) as BrowserType[],
    displayOrder: test.displayOrder ?? 0,
    lastRunId: test.lastRunId ?? null,
    lastRunAt: test.lastRunAt ?? null,
    lastRunStatus: test.lastRunStatus ?? null,
    createdAt: test.createdAt!,
  };
}

/**
 * Test Repository class
 */
export class TestRepository {
  constructor(private readonly db: Database) {}

  /**
   * Create a new test
   */
  async create(data: TestCreateData): Promise<SafeTest> {
    const slug = data.slug || generateSlug(data.name);
    const uniqueSlug = await this.ensureUniqueSlug(data.projectId, slug);

    const config: TestConfig = {
      ...DEFAULT_TEST_CONFIG,
      ...(data.config || {}),
    };

    const newTest: NewTest = {
      userId: data.userId,
      projectId: data.projectId,
      suiteId: data.suiteId,
      name: data.name,
      description: data.description || null,
      slug: uniqueSlug,
      recordingData: data.recordingData,
      recordingUrl: data.recordingUrl || null,
      actionCount: data.actionCount ?? 0,
      browsers: data.browsers || ['chromium'],
      config,
      displayOrder: 0,
    };

    const result = await this.db.insert(tests).values(newTest).returning();

    return toSafeTest(result[0]);
  }

  /**
   * Find a test by ID (active only by default)
   */
  async findById(id: string, includeDeleted = false): Promise<SafeTest | null> {
    const conditions = includeDeleted
      ? eq(tests.id, id)
      : and(eq(tests.id, id), isNull(tests.deletedAt));

    const result = await this.db.select().from(tests).where(conditions).limit(1);

    return result[0] ? toSafeTest(result[0]) : null;
  }

  /**
   * Find a test by ID and verify ownership
   */
  async findByIdAndUser(
    id: string,
    userId: string,
    includeDeleted = false
  ): Promise<SafeTest | null> {
    const conditions = includeDeleted
      ? and(eq(tests.id, id), eq(tests.userId, userId))
      : and(eq(tests.id, id), eq(tests.userId, userId), isNull(tests.deletedAt));

    const result = await this.db.select().from(tests).where(conditions).limit(1);

    return result[0] ? toSafeTest(result[0]) : null;
  }

  /**
   * Find a test by slug within a project
   */
  async findBySlug(
    projectId: string,
    slug: string,
    includeDeleted = false
  ): Promise<SafeTest | null> {
    const conditions = includeDeleted
      ? and(eq(tests.projectId, projectId), eq(tests.slug, slug))
      : and(
          eq(tests.projectId, projectId),
          eq(tests.slug, slug),
          isNull(tests.deletedAt)
        );

    const result = await this.db.select().from(tests).where(conditions).limit(1);

    return result[0] ? toSafeTest(result[0]) : null;
  }

  /**
   * List tests with filters and pagination
   */
  async findMany(
    filters: TestListFilters,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<TestSummary>> {
    const { page = 1, limit = 50, sortBy = 'displayOrder', sortOrder = 'asc' } = options;
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [
      eq(tests.userId, filters.userId),
      eq(tests.projectId, filters.projectId),
    ];

    if (!filters.includeDeleted) {
      conditions.push(isNull(tests.deletedAt));
    }

    if (filters.suiteId) {
      conditions.push(eq(tests.suiteId, filters.suiteId));
    }

    if (filters.search) {
      conditions.push(ilike(tests.name, `%${filters.search}%`));
    }

    if (filters.status) {
      conditions.push(eq(tests.lastRunStatus, filters.status));
    }

    const whereClause = and(...conditions);

    // Get sort column
    const sortColumn = {
      name: tests.name,
      displayOrder: tests.displayOrder,
      createdAt: tests.createdAt,
      lastRunAt: tests.lastRunAt,
    }[sortBy];

    const orderFn = sortOrder === 'asc' ? asc : desc;

    // Get total count
    const countResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(tests)
      .where(whereClause);

    const total = countResult[0]?.count || 0;

    // Get paginated results with suite name joined
    const result = await this.db
      .select({
        id: tests.id,
        userId: tests.userId,
        projectId: tests.projectId,
        suiteId: tests.suiteId,
        suiteName: testSuites.name,
        name: tests.name,
        slug: tests.slug,
        recordingUrl: tests.recordingUrl,
        actionCount: tests.actionCount,
        browsers: tests.browsers,
        displayOrder: tests.displayOrder,
        lastRunId: tests.lastRunId,
        lastRunAt: tests.lastRunAt,
        lastRunStatus: tests.lastRunStatus,
        createdAt: tests.createdAt,
      })
      .from(tests)
      .leftJoin(testSuites, eq(tests.suiteId, testSuites.id))
      .where(whereClause)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset);

    const totalPages = Math.ceil(total / limit);

    return {
      data: result.map((row) =>
        toTestSummary({
          ...row,
          browsers: row.browsers as BrowserType[],
        })
      ),
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
   * Get all tests for a suite (simple list, no pagination)
   */
  async findAllBySuite(
    userId: string,
    suiteId: string
  ): Promise<SafeTest[]> {
    const result = await this.db
      .select()
      .from(tests)
      .where(
        and(
          eq(tests.userId, userId),
          eq(tests.suiteId, suiteId),
          isNull(tests.deletedAt)
        )
      )
      .orderBy(asc(tests.displayOrder), asc(tests.name));

    return result.map(toSafeTest);
  }

  /**
   * Get all tests for a project (for project-level runs)
   */
  async findAllByProject(
    userId: string,
    projectId: string
  ): Promise<SafeTest[]> {
    const result = await this.db
      .select()
      .from(tests)
      .where(
        and(
          eq(tests.userId, userId),
          eq(tests.projectId, projectId),
          isNull(tests.deletedAt)
        )
      )
      .orderBy(asc(tests.displayOrder), asc(tests.name));

    return result.map(toSafeTest);
  }

  /**
   * Update a test
   */
  async update(
    id: string,
    userId: string,
    data: TestUpdateData
  ): Promise<SafeTest | null> {
    const updateData: Partial<NewTest> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.suiteId !== undefined) updateData.suiteId = data.suiteId;
    if (data.recordingData !== undefined) updateData.recordingData = data.recordingData;
    if (data.recordingUrl !== undefined) updateData.recordingUrl = data.recordingUrl;
    if (data.actionCount !== undefined) updateData.actionCount = data.actionCount;
    if (data.browsers !== undefined) updateData.browsers = data.browsers;
    if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder;

    if (data.config !== undefined) {
      // Merge with existing config
      const existing = await this.findByIdAndUser(id, userId);
      if (!existing) return null;
      updateData.config = { ...existing.config, ...data.config };
    }

    if (data.slug !== undefined) {
      // Verify slug uniqueness
      const existing = await this.findByIdAndUser(id, userId);
      if (!existing) return null;
      updateData.slug = await this.ensureUniqueSlug(
        existing.projectId,
        data.slug,
        id
      );
    } else if (data.name !== undefined) {
      // Auto-update slug when name changes
      const existing = await this.findByIdAndUser(id, userId);
      if (!existing) return null;
      updateData.slug = await this.ensureUniqueSlug(
        existing.projectId,
        generateSlug(data.name),
        id
      );
    }

    const result = await this.db
      .update(tests)
      .set(updateData)
      .where(
        and(
          eq(tests.id, id),
          eq(tests.userId, userId),
          isNull(tests.deletedAt)
        )
      )
      .returning();

    return result[0] ? toSafeTest(result[0]) : null;
  }

  /**
   * Update last run tracking fields (called after test execution)
   */
  async updateLastRun(
    id: string,
    data: TestLastRunUpdate
  ): Promise<void> {
    await this.db
      .update(tests)
      .set({
        lastRunId: data.lastRunId,
        lastRunAt: data.lastRunAt,
        lastRunStatus: data.lastRunStatus,
      })
      .where(eq(tests.id, id));
  }

  /**
   * Move tests to a different suite
   */
  async moveToSuite(
    testIds: string[],
    userId: string,
    targetSuiteId: string
  ): Promise<number> {
    if (testIds.length === 0) return 0;

    const result = await this.db
      .update(tests)
      .set({ suiteId: targetSuiteId })
      .where(
        and(
          inArray(tests.id, testIds),
          eq(tests.userId, userId),
          isNull(tests.deletedAt)
        )
      )
      .returning();

    return result.length;
  }

  /**
   * Reorder tests within a suite
   */
  async reorder(
    userId: string,
    suiteId: string,
    orderedIds: string[]
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx
          .update(tests)
          .set({ displayOrder: i })
          .where(
            and(
              eq(tests.id, orderedIds[i]),
              eq(tests.userId, userId),
              eq(tests.suiteId, suiteId),
              isNull(tests.deletedAt)
            )
          );
      }
    });
  }

  /**
   * Soft delete a test
   */
  async softDelete(id: string, userId: string): Promise<boolean> {
    const now = new Date();

    const result = await this.db
      .update(tests)
      .set({ deletedAt: now })
      .where(
        and(
          eq(tests.id, id),
          eq(tests.userId, userId),
          isNull(tests.deletedAt)
        )
      )
      .returning();

    return result.length > 0;
  }

  /**
   * Restore a soft-deleted test
   */
  async restore(id: string, userId: string): Promise<SafeTest | null> {
    const result = await this.db
      .update(tests)
      .set({ deletedAt: null })
      .where(and(eq(tests.id, id), eq(tests.userId, userId)))
      .returning();

    return result[0] ? toSafeTest(result[0]) : null;
  }

  /**
   * Count tests for a project
   */
  async countByProject(userId: string, projectId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(tests)
      .where(
        and(
          eq(tests.userId, userId),
          eq(tests.projectId, projectId),
          isNull(tests.deletedAt)
        )
      );

    return result[0]?.count || 0;
  }

  /**
   * Count tests for a suite
   */
  async countBySuite(userId: string, suiteId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(tests)
      .where(
        and(
          eq(tests.userId, userId),
          eq(tests.suiteId, suiteId),
          isNull(tests.deletedAt)
        )
      );

    return result[0]?.count || 0;
  }

  /**
   * Check if a slug is available within a project
   */
  async isSlugAvailable(
    projectId: string,
    slug: string,
    excludeId?: string
  ): Promise<boolean> {
    const conditions = [
      eq(tests.projectId, projectId),
      eq(tests.slug, slug),
      isNull(tests.deletedAt),
    ];

    if (excludeId) {
      conditions.push(sql`${tests.id} != ${excludeId}`);
    }

    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(tests)
      .where(and(...conditions));

    return (result[0]?.count || 0) === 0;
  }

  /**
   * Ensure a slug is unique within a project
   * Appends -1, -2, etc. if slug already exists
   */
  async ensureUniqueSlug(
    projectId: string,
    baseSlug: string,
    excludeId?: string
  ): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (!(await this.isSlugAvailable(projectId, slug, excludeId))) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  /**
   * Check if a test name is available within a suite
   */
  async isNameAvailable(
    suiteId: string,
    name: string,
    excludeId?: string
  ): Promise<boolean> {
    const conditions = [
      eq(tests.suiteId, suiteId),
      sql`LOWER(${tests.name}) = LOWER(${name})`,
      isNull(tests.deletedAt),
    ];

    if (excludeId) {
      conditions.push(sql`${tests.id} != ${excludeId}`);
    }

    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(tests)
      .where(and(...conditions));

    return (result[0]?.count || 0) === 0;
  }
}
