/**
 * Project Repository
 *
 * Data access layer for project CRUD operations.
 * Uses Drizzle ORM for type-safe queries.
 */

import { eq, and, isNull, sql, desc, asc, ilike } from 'drizzle-orm';
import {
  projects,
  DEFAULT_PROJECT_NAME,
  DEFAULT_PROJECT_SLUG,
  type Project,
  type NewProject,
} from '../db/schema/projects.js';
import type { Database } from '../db/index.js';

/**
 * Project creation data
 */
export interface ProjectCreateData {
  userId: string;
  name: string;
  slug: string;
  description?: string | null;
  color?: string | null;
  isDefault?: boolean;
}

/**
 * Project update data
 */
export interface ProjectUpdateData {
  name?: string;
  slug?: string;
  description?: string | null;
  color?: string | null;
}

/**
 * Project list filters
 */
export interface ProjectListFilters {
  userId: string;
  search?: string;
  includeDeleted?: boolean;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
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
 * Safe project response (typed fields)
 */
export interface SafeProject {
  id: string;
  userId: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  isDefault: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Project with stats (for list view)
 */
export interface ProjectWithStats extends SafeProject {
  recordingCount: number;
  runCount: number;
  lastRunAt: Date | null;
}

/**
 * Convert raw DB result to SafeProject
 */
function toSafeProject(project: Project): SafeProject {
  return {
    id: project.id,
    userId: project.userId,
    name: project.name,
    slug: project.slug,
    description: project.description,
    color: project.color,
    isDefault: project.isDefault,
    deletedAt: project.deletedAt,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

/**
 * Project Repository class
 */
export class ProjectRepository {
  constructor(private readonly db: Database) {}

  /**
   * Create a new project
   */
  async create(data: ProjectCreateData): Promise<SafeProject> {
    const newProject: NewProject = {
      userId: data.userId,
      name: data.name,
      slug: data.slug,
      description: data.description || null,
      color: data.color || null,
      isDefault: data.isDefault ?? false,
    };

    const result = await this.db.insert(projects).values(newProject).returning();

    return toSafeProject(result[0]);
  }

  /**
   * Create default project for a user (called on signup)
   */
  async createDefaultProject(userId: string): Promise<SafeProject> {
    return this.create({
      userId,
      name: DEFAULT_PROJECT_NAME,
      slug: DEFAULT_PROJECT_SLUG,
      description: 'Your default project for test recordings',
      isDefault: true,
    });
  }

  /**
   * Find a project by ID (active projects only by default)
   */
  async findById(id: string, includeDeleted = false): Promise<SafeProject | null> {
    const conditions = includeDeleted
      ? eq(projects.id, id)
      : and(eq(projects.id, id), isNull(projects.deletedAt));

    const result = await this.db.select().from(projects).where(conditions).limit(1);

    return result[0] ? toSafeProject(result[0]) : null;
  }

  /**
   * Find a project by ID and verify ownership
   */
  async findByIdAndUser(
    id: string,
    userId: string,
    includeDeleted = false
  ): Promise<SafeProject | null> {
    const conditions = includeDeleted
      ? and(eq(projects.id, id), eq(projects.userId, userId))
      : and(eq(projects.id, id), eq(projects.userId, userId), isNull(projects.deletedAt));

    const result = await this.db.select().from(projects).where(conditions).limit(1);

    return result[0] ? toSafeProject(result[0]) : null;
  }

  /**
   * Find a project by name and user (case-insensitive)
   */
  async findByNameAndUser(name: string, userId: string): Promise<SafeProject | null> {
    const result = await this.db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.userId, userId),
          sql`LOWER(${projects.name}) = LOWER(${name})`,
          isNull(projects.deletedAt)
        )
      )
      .limit(1);

    return result[0] ? toSafeProject(result[0]) : null;
  }

  /**
   * Find the default project for a user
   */
  async findDefaultProject(userId: string): Promise<SafeProject | null> {
    const result = await this.db
      .select()
      .from(projects)
      .where(
        and(eq(projects.userId, userId), eq(projects.isDefault, true), isNull(projects.deletedAt))
      )
      .limit(1);

    return result[0] ? toSafeProject(result[0]) : null;
  }

  /**
   * List projects with filters and pagination
   */
  async findMany(
    filters: ProjectListFilters,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<SafeProject>> {
    const { page = 1, limit = 50, sortBy = 'name', sortOrder = 'asc' } = options;
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [eq(projects.userId, filters.userId)];

    if (!filters.includeDeleted) {
      conditions.push(isNull(projects.deletedAt));
    }

    if (filters.search) {
      conditions.push(ilike(projects.name, `%${filters.search}%`));
    }

    const whereClause = and(...conditions);

    // Get sort column
    const sortColumn = {
      name: projects.name,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    }[sortBy];

    const orderFn = sortOrder === 'asc' ? asc : desc;

    // Get total count
    const countResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(projects)
      .where(whereClause);

    const total = countResult[0]?.count || 0;

    // Get paginated results
    const result = await this.db
      .select()
      .from(projects)
      .where(whereClause)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset);

    const totalPages = Math.ceil(total / limit);

    return {
      data: result.map(toSafeProject),
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
   * Get all projects for a user (simple list, no pagination)
   */
  async findAllByUser(userId: string): Promise<SafeProject[]> {
    const result = await this.db
      .select()
      .from(projects)
      .where(and(eq(projects.userId, userId), isNull(projects.deletedAt)))
      .orderBy(desc(projects.isDefault), asc(projects.name));

    return result.map(toSafeProject);
  }

  /**
   * Update a project
   */
  async update(id: string, userId: string, data: ProjectUpdateData): Promise<SafeProject | null> {
    const result = await this.db
      .update(projects)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.color !== undefined && { color: data.color }),
      })
      .where(and(eq(projects.id, id), eq(projects.userId, userId), isNull(projects.deletedAt)))
      .returning();

    return result[0] ? toSafeProject(result[0]) : null;
  }

  /**
   * Soft delete a project (and cascade to children)
   * Note: Default project cannot be deleted
   */
  async softDelete(id: string, userId: string): Promise<boolean> {
    const now = new Date();

    const result = await this.db
      .update(projects)
      .set({ deletedAt: now })
      .where(
        and(
          eq(projects.id, id),
          eq(projects.userId, userId),
          eq(projects.isDefault, false), // Cannot delete default project
          isNull(projects.deletedAt)
        )
      )
      .returning();

    return result.length > 0;
  }

  /**
   * Restore a soft-deleted project
   */
  async restore(id: string, userId: string): Promise<SafeProject | null> {
    const result = await this.db
      .update(projects)
      .set({ deletedAt: null })
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .returning();

    return result[0] ? toSafeProject(result[0]) : null;
  }

  /**
   * Count projects for a user
   */
  async countByUser(userId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(projects)
      .where(and(eq(projects.userId, userId), isNull(projects.deletedAt)));

    return result[0]?.count || 0;
  }

  /**
   * Check if a project name is available for a user
   */
  async isNameAvailable(userId: string, name: string, excludeId?: string): Promise<boolean> {
    const conditions = [
      eq(projects.userId, userId),
      sql`LOWER(${projects.name}) = LOWER(${name})`,
      isNull(projects.deletedAt),
    ];

    if (excludeId) {
      conditions.push(sql`${projects.id} != ${excludeId}`);
    }

    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(projects)
      .where(and(...conditions));

    return (result[0]?.count || 0) === 0;
  }

  /**
   * Find a project by slug and user (case-insensitive)
   */
  async findBySlugAndUser(slug: string, userId: string): Promise<SafeProject | null> {
    const result = await this.db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.userId, userId),
          sql`LOWER(${projects.slug}) = LOWER(${slug})`,
          isNull(projects.deletedAt)
        )
      )
      .limit(1);

    return result[0] ? toSafeProject(result[0]) : null;
  }

  /**
   * Check if a project slug is available for a user
   */
  async isSlugAvailable(userId: string, slug: string, excludeId?: string): Promise<boolean> {
    const conditions = [
      eq(projects.userId, userId),
      sql`LOWER(${projects.slug}) = LOWER(${slug})`,
      isNull(projects.deletedAt),
    ];

    if (excludeId) {
      conditions.push(sql`${projects.id} != ${excludeId}`);
    }

    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(projects)
      .where(and(...conditions));

    return (result[0]?.count || 0) === 0;
  }
}
