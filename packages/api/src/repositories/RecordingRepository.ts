/**
 * Recording Repository
 *
 * Data access layer for recording CRUD operations.
 * Uses Drizzle ORM for type-safe queries.
 */

import { eq, and, isNull, sql, desc, asc, or, ilike, gte, lte } from 'drizzle-orm';
import {
  recordings,
  type Recording,
  type NewRecording,
  type RecordingData,
} from '../db/schema/recordings.js';
import type { Database } from '../db/index.js';

/**
 * Recording creation data
 */
export interface RecordingCreateData {
  userId: string;
  projectId: string;
  name: string;
  url: string;
  description?: string | null;
  originalId?: string | null;
  tags?: string[];
  data: RecordingData;
  schemaVersion?: string;
}

/**
 * Recording update data
 */
export interface RecordingUpdateData {
  name?: string;
  description?: string | null;
  tags?: string[];
  data?: RecordingData;
}

/**
 * Recording list filters
 */
export interface RecordingListFilters {
  userId: string;
  projectId?: string;
  search?: string;
  tags?: string[];
  url?: string;
  includeDeleted?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'actionCount';
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
 * Safe recording response (parsed JSON fields)
 */
export interface SafeRecording {
  id: string;
  userId: string;
  projectId: string;
  name: string;
  url: string;
  description: string | null;
  originalId: string | null;
  tags: string[];
  data: RecordingData;
  actionCount: number;
  estimatedDurationMs: number | null;
  schemaVersion: string;
  dataSizeBytes: number | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Recording summary (for list view - without full data)
 */
export interface RecordingSummary {
  id: string;
  userId: string;
  projectId: string;
  name: string;
  url: string;
  description: string | null;
  originalId: string | null;
  tags: string[];
  actionCount: number;
  estimatedDurationMs: number | null;
  schemaVersion: string;
  dataSizeBytes: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Convert raw DB result to SafeRecording
 */
function toSafeRecording(recording: Recording): SafeRecording {
  return {
    id: recording.id,
    userId: recording.userId,
    projectId: recording.projectId,
    name: recording.name,
    url: recording.url,
    description: recording.description,
    originalId: recording.originalId,
    tags: JSON.parse(recording.tags) as string[],
    data: recording.data as RecordingData,
    actionCount: parseInt(recording.actionCount, 10),
    estimatedDurationMs: recording.estimatedDurationMs
      ? parseInt(recording.estimatedDurationMs, 10)
      : null,
    schemaVersion: recording.schemaVersion,
    dataSizeBytes: recording.dataSizeBytes ? parseInt(recording.dataSizeBytes, 10) : null,
    deletedAt: recording.deletedAt,
    createdAt: recording.createdAt,
    updatedAt: recording.updatedAt,
  };
}

/**
 * Calculate estimated duration from recording data
 */
function calculateEstimatedDuration(data: RecordingData): number {
  if (data.startTime && data.endTime) {
    return new Date(data.endTime).getTime() - new Date(data.startTime).getTime();
  }
  // Fallback: estimate based on action count (avg 2 seconds per action)
  return (data.actions?.length || 0) * 2000;
}

/**
 * Recording Repository class
 */
export class RecordingRepository {
  constructor(private readonly db: Database) {}

  /**
   * Create a new recording
   */
  async create(data: RecordingCreateData): Promise<SafeRecording> {
    const dataSize = JSON.stringify(data.data).length;
    const estimatedDuration = calculateEstimatedDuration(data.data);

    const result = await this.db
      .insert(recordings)
      .values({
        userId: data.userId,
        projectId: data.projectId,
        name: data.name,
        url: data.url,
        description: data.description || null,
        originalId: data.originalId || null,
        tags: JSON.stringify(data.tags || []),
        data: data.data,
        actionCount: String(data.data.actions?.length || 0),
        estimatedDurationMs: String(estimatedDuration),
        schemaVersion: data.schemaVersion || '1.0.0',
        dataSizeBytes: String(dataSize),
      })
      .returning();

    return toSafeRecording(result[0]);
  }

  /**
   * Find a recording by ID (active recordings only by default)
   */
  async findById(id: string, includeDeleted = false): Promise<SafeRecording | null> {
    const conditions = includeDeleted
      ? eq(recordings.id, id)
      : and(eq(recordings.id, id), isNull(recordings.deletedAt));

    const result = await this.db.select().from(recordings).where(conditions).limit(1);

    return result[0] ? toSafeRecording(result[0]) : null;
  }

  /**
   * Find a recording by original ID and user
   */
  async findByOriginalId(userId: string, originalId: string): Promise<SafeRecording | null> {
    const result = await this.db
      .select()
      .from(recordings)
      .where(
        and(
          eq(recordings.userId, userId),
          eq(recordings.originalId, originalId),
          isNull(recordings.deletedAt)
        )
      )
      .limit(1);

    return result[0] ? toSafeRecording(result[0]) : null;
  }

  /**
   * List recordings with filters and pagination
   */
  async findMany(
    filters: RecordingListFilters,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<RecordingSummary>> {
    const { page = 1, limit = 20, sortBy = 'updatedAt', sortOrder = 'desc' } = options;
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [eq(recordings.userId, filters.userId)];

    if (!filters.includeDeleted) {
      conditions.push(isNull(recordings.deletedAt));
    }

    if (filters.projectId) {
      conditions.push(eq(recordings.projectId, filters.projectId));
    }

    if (filters.search) {
      conditions.push(
        or(
          ilike(recordings.name, `%${filters.search}%`),
          ilike(recordings.url, `%${filters.search}%`),
          ilike(recordings.description, `%${filters.search}%`)
        )!
      );
    }

    if (filters.url) {
      conditions.push(ilike(recordings.url, `%${filters.url}%`));
    }

    if (filters.tags && filters.tags.length > 0) {
      // Match any of the tags using JSONB containment
      const tagConditions = filters.tags.map(
        (tag) => sql`${recordings.tags}::jsonb @> ${JSON.stringify([tag])}::jsonb`
      );
      conditions.push(or(...tagConditions)!);
    }

    if (filters.createdAfter) {
      conditions.push(gte(recordings.createdAt, filters.createdAfter));
    }

    if (filters.createdBefore) {
      conditions.push(lte(recordings.createdAt, filters.createdBefore));
    }

    const whereClause = and(...conditions);

    // Get sort column
    const sortColumn = {
      name: recordings.name,
      createdAt: recordings.createdAt,
      updatedAt: recordings.updatedAt,
      actionCount: recordings.actionCount,
    }[sortBy];

    const orderFn = sortOrder === 'asc' ? asc : desc;

    // Get total count
    const countResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(recordings)
      .where(whereClause);

    const total = countResult[0]?.count || 0;

    // Get paginated results
    const result = await this.db
      .select({
        id: recordings.id,
        userId: recordings.userId,
        projectId: recordings.projectId,
        name: recordings.name,
        url: recordings.url,
        description: recordings.description,
        originalId: recordings.originalId,
        tags: recordings.tags,
        actionCount: recordings.actionCount,
        estimatedDurationMs: recordings.estimatedDurationMs,
        schemaVersion: recordings.schemaVersion,
        dataSizeBytes: recordings.dataSizeBytes,
        createdAt: recordings.createdAt,
        updatedAt: recordings.updatedAt,
      })
      .from(recordings)
      .where(whereClause)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset);

    const totalPages = Math.ceil(total / limit);

    return {
      data: result.map((r) => ({
        id: r.id,
        userId: r.userId,
        projectId: r.projectId,
        name: r.name,
        url: r.url,
        description: r.description,
        originalId: r.originalId,
        tags: JSON.parse(r.tags) as string[],
        actionCount: parseInt(r.actionCount, 10),
        estimatedDurationMs: r.estimatedDurationMs ? parseInt(r.estimatedDurationMs, 10) : null,
        schemaVersion: r.schemaVersion,
        dataSizeBytes: r.dataSizeBytes ? parseInt(r.dataSizeBytes, 10) : null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
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
   * Update a recording
   */
  async update(
    id: string,
    userId: string,
    data: RecordingUpdateData
  ): Promise<SafeRecording | null> {
    // Verify ownership and existence
    const existing = await this.db
      .select()
      .from(recordings)
      .where(
        and(eq(recordings.id, id), eq(recordings.userId, userId), isNull(recordings.deletedAt))
      )
      .limit(1);

    if (!existing[0]) {
      return null;
    }

    // Build update values
    const updateValues: Partial<NewRecording> = {};

    if (data.name !== undefined) {
      updateValues.name = data.name;
    }

    if (data.description !== undefined) {
      updateValues.description = data.description;
    }

    if (data.tags !== undefined) {
      updateValues.tags = JSON.stringify(data.tags);
    }

    if (data.data !== undefined) {
      updateValues.data = data.data;
      updateValues.actionCount = String(data.data.actions?.length || 0);
      updateValues.estimatedDurationMs = String(calculateEstimatedDuration(data.data));
      updateValues.dataSizeBytes = String(JSON.stringify(data.data).length);
      updateValues.url = data.data.url;
    }

    if (Object.keys(updateValues).length === 0) {
      return toSafeRecording(existing[0]);
    }

    const result = await this.db
      .update(recordings)
      .set(updateValues)
      .where(eq(recordings.id, id))
      .returning();

    return result[0] ? toSafeRecording(result[0]) : null;
  }

  /**
   * Soft delete a recording
   */
  async softDelete(id: string, userId: string): Promise<boolean> {
    const result = await this.db
      .update(recordings)
      .set({ deletedAt: new Date() })
      .where(
        and(eq(recordings.id, id), eq(recordings.userId, userId), isNull(recordings.deletedAt))
      )
      .returning({ id: recordings.id });

    return result.length > 0;
  }

  /**
   * Restore a soft-deleted recording
   */
  async restore(id: string, userId: string): Promise<SafeRecording | null> {
    const result = await this.db
      .update(recordings)
      .set({ deletedAt: null })
      .where(
        and(
          eq(recordings.id, id),
          eq(recordings.userId, userId),
          sql`${recordings.deletedAt} IS NOT NULL`
        )
      )
      .returning();

    return result[0] ? toSafeRecording(result[0]) : null;
  }

  /**
   * Permanently delete a recording
   */
  async hardDelete(id: string, userId: string): Promise<boolean> {
    const result = await this.db
      .delete(recordings)
      .where(and(eq(recordings.id, id), eq(recordings.userId, userId)))
      .returning({ id: recordings.id });

    return result.length > 0;
  }

  /**
   * Count recordings for a user
   */
  async countByUserId(userId: string, includeDeleted = false): Promise<number> {
    const conditions = includeDeleted
      ? eq(recordings.userId, userId)
      : and(eq(recordings.userId, userId), isNull(recordings.deletedAt));

    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(recordings)
      .where(conditions);

    return result[0]?.count || 0;
  }

  /**
   * Check if user owns a recording
   */
  async isOwner(id: string, userId: string): Promise<boolean> {
    const result = await this.db
      .select({ id: recordings.id })
      .from(recordings)
      .where(and(eq(recordings.id, id), eq(recordings.userId, userId)))
      .limit(1);

    return result.length > 0;
  }

  /**
   * Get all tags used by a user
   */
  async getTagsByUserId(userId: string): Promise<string[]> {
    const result = await this.db
      .select({ tags: recordings.tags })
      .from(recordings)
      .where(and(eq(recordings.userId, userId), isNull(recordings.deletedAt)));

    // Aggregate unique tags
    const tagSet = new Set<string>();
    for (const row of result) {
      const tags = JSON.parse(row.tags) as string[];
      tags.forEach((tag) => tagSet.add(tag));
    }

    return Array.from(tagSet).sort();
  }

  /**
   * Find recordings by tag
   */
  async findByTag(userId: string, tag: string): Promise<RecordingSummary[]> {
    const result = await this.db
      .select({
        id: recordings.id,
        userId: recordings.userId,
        projectId: recordings.projectId,
        name: recordings.name,
        url: recordings.url,
        description: recordings.description,
        originalId: recordings.originalId,
        tags: recordings.tags,
        actionCount: recordings.actionCount,
        estimatedDurationMs: recordings.estimatedDurationMs,
        schemaVersion: recordings.schemaVersion,
        dataSizeBytes: recordings.dataSizeBytes,
        createdAt: recordings.createdAt,
        updatedAt: recordings.updatedAt,
      })
      .from(recordings)
      .where(
        and(
          eq(recordings.userId, userId),
          isNull(recordings.deletedAt),
          sql`${recordings.tags}::jsonb @> ${JSON.stringify([tag])}::jsonb`
        )
      )
      .orderBy(desc(recordings.updatedAt));

    return result.map((r) => ({
      id: r.id,
      userId: r.userId,
      projectId: r.projectId,
      name: r.name,
      url: r.url,
      description: r.description,
      originalId: r.originalId,
      tags: JSON.parse(r.tags) as string[],
      actionCount: parseInt(r.actionCount, 10),
      estimatedDurationMs: r.estimatedDurationMs ? parseInt(r.estimatedDurationMs, 10) : null,
      schemaVersion: r.schemaVersion,
      dataSizeBytes: r.dataSizeBytes ? parseInt(r.dataSizeBytes, 10) : null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }
}
