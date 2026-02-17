/**
 * Recording Service
 *
 * Business logic for recording CRUD operations.
 * Handles validation, transformation, and coordination.
 */

import { z } from 'zod';
import type {
  RecordingRepository,
  RecordingCreateData,
  RecordingUpdateData,
  RecordingListFilters,
  PaginationOptions,
  PaginatedResult,
  SafeRecording,
  RecordingSummary,
} from '../repositories/RecordingRepository.js';
import type { ProjectRepository } from '../repositories/ProjectRepository.js';
import type { RecordingData } from '../db/schema/recordings.js';

/**
 * Recording Service Error
 */
export class RecordingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'RecordingError';
  }
}

/**
 * Predefined Recording errors
 */
export const RecordingErrors = {
  NOT_FOUND: new RecordingError('Recording not found', 'RECORDING_NOT_FOUND', 404),
  NOT_AUTHORIZED: new RecordingError(
    'Not authorized to access this recording',
    'NOT_AUTHORIZED',
    403
  ),
  INVALID_DATA: new RecordingError('Invalid recording data', 'INVALID_DATA', 400),
  DUPLICATE_ORIGINAL_ID: new RecordingError(
    'Recording with this original ID already exists',
    'DUPLICATE_ORIGINAL_ID',
    409
  ),
  VALIDATION_FAILED: new RecordingError('Recording validation failed', 'VALIDATION_FAILED', 400),
  TOO_LARGE: new RecordingError('Recording data exceeds maximum size limit', 'TOO_LARGE', 413),
  ALREADY_DELETED: new RecordingError('Recording is already deleted', 'ALREADY_DELETED', 400),
} as const;

/**
 * Recording data schema (matching @saveaction/core Recording interface)
 */
const selectorSchema = z
  .object({
    id: z.string().optional(),
    dataTestId: z.string().optional(),
    ariaLabel: z.string().optional(),
    name: z.string().optional(),
    css: z.string().optional(),
    xpath: z.string().optional(),
    xpathAbsolute: z.string().optional(),
    text: z.string().optional(),
    position: z
      .object({
        parent: z.string(),
        index: z.number(),
      })
      .optional(),
    priority: z.array(z.string()).optional(),
    validation: z.record(z.unknown()).optional(),
    fallback: z.record(z.unknown()).optional(),
  })
  .passthrough();

const actionSchema = z
  .object({
    id: z.string(),
    type: z.string(),
    timestamp: z.number(),
    url: z.string(),
    selector: selectorSchema.optional(),
  })
  .passthrough();

const viewportSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
});

export const recordingDataSchema = z
  .object({
    id: z.string(),
    testName: z.string().min(1).max(255),
    url: z.string().url(),
    startTime: z.string(),
    endTime: z.string().optional(),
    viewport: viewportSchema,
    windowSize: viewportSchema.optional(),
    screenSize: viewportSchema.optional(),
    devicePixelRatio: z.number().optional(),
    userAgent: z.string(),
    actions: z.array(actionSchema),
    version: z.string(),
  })
  .passthrough();

/**
 * Create recording request schema
 */
export const createRecordingSchema = z.object({
  projectId: z.string().uuid().optional(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional().default([]),
  data: recordingDataSchema,
});

/**
 * Update recording request schema
 */
export const updateRecordingSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  data: recordingDataSchema.optional(),
});

/**
 * List recordings query schema
 */
export const listRecordingsQuerySchema = z.object({
  projectId: z.string().uuid(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.string().max(255).optional(),
  tags: z.string().optional(), // Comma-separated tags
  url: z.string().max(2048).optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt', 'actionCount']).optional().default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  includeDeleted: z.coerce.boolean().optional().default(false),
});

export type CreateRecordingRequest = z.infer<typeof createRecordingSchema>;
export type UpdateRecordingRequest = z.infer<typeof updateRecordingSchema>;
export type ListRecordingsQuery = z.infer<typeof listRecordingsQuerySchema>;

/**
 * Service configuration
 */
export interface RecordingServiceConfig {
  /** Maximum recording data size in bytes (default: 10MB) */
  maxDataSizeBytes: number;
  /** Maximum recordings per user (0 = unlimited) */
  maxRecordingsPerUser: number;
}

const DEFAULT_CONFIG: RecordingServiceConfig = {
  maxDataSizeBytes: 10 * 1024 * 1024, // 10MB
  maxRecordingsPerUser: 0, // Unlimited
};

/**
 * Recording Service response types
 */
export interface RecordingResponse {
  id: string;
  projectId: string | null;
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

export interface RecordingDetailResponse extends RecordingResponse {
  data: RecordingData;
}

/**
 * Convert SafeRecording to RecordingResponse
 */
function toResponse(recording: SafeRecording): RecordingDetailResponse {
  return {
    id: recording.id,
    projectId: recording.projectId,
    name: recording.name,
    url: recording.url,
    description: recording.description,
    originalId: recording.originalId,
    tags: recording.tags,
    actionCount: recording.actionCount,
    estimatedDurationMs: recording.estimatedDurationMs,
    schemaVersion: recording.schemaVersion,
    dataSizeBytes: recording.dataSizeBytes,
    createdAt: recording.createdAt,
    updatedAt: recording.updatedAt,
    data: recording.data,
  };
}

/**
 * Convert RecordingSummary to RecordingResponse
 */
function summaryToResponse(recording: RecordingSummary): RecordingResponse {
  return {
    id: recording.id,
    projectId: recording.projectId,
    name: recording.name,
    url: recording.url,
    description: recording.description,
    originalId: recording.originalId,
    tags: recording.tags,
    actionCount: recording.actionCount,
    estimatedDurationMs: recording.estimatedDurationMs,
    schemaVersion: recording.schemaVersion,
    dataSizeBytes: recording.dataSizeBytes,
    createdAt: recording.createdAt,
    updatedAt: recording.updatedAt,
  };
}

/**
 * Recording Service class
 */
export class RecordingService {
  private readonly config: RecordingServiceConfig;

  constructor(
    private readonly recordingRepository: RecordingRepository,
    private readonly projectRepository: ProjectRepository,
    config?: Partial<RecordingServiceConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create a new recording
   */
  async createRecording(
    userId: string,
    request: CreateRecordingRequest
  ): Promise<RecordingDetailResponse> {
    // Validate recording data
    const validatedData = createRecordingSchema.parse(request);

    // Check data size
    const dataSize = JSON.stringify(validatedData.data).length;
    if (dataSize > this.config.maxDataSizeBytes) {
      throw RecordingErrors.TOO_LARGE;
    }

    // Determine project ID - use provided or get/create default project
    let projectId = validatedData.projectId;
    if (!projectId) {
      let defaultProject = await this.projectRepository.findDefaultProject(userId);
      if (!defaultProject) {
        defaultProject = await this.projectRepository.createDefaultProject(userId);
      }
      projectId = defaultProject.id;
    } else {
      // Verify user has access to the specified project
      const project = await this.projectRepository.findByIdAndUser(projectId, userId);
      if (!project) {
        throw new RecordingError('Project not found or not accessible', 'PROJECT_NOT_FOUND', 404);
      }
    }

    // Check recording limit
    if (this.config.maxRecordingsPerUser > 0) {
      const count = await this.recordingRepository.countByUserId(userId);
      if (count >= this.config.maxRecordingsPerUser) {
        throw new RecordingError(
          `Maximum number of recordings (${this.config.maxRecordingsPerUser}) reached`,
          'RECORDING_LIMIT_REACHED',
          400
        );
      }
    }

    // Check for duplicate original ID
    if (validatedData.data.id) {
      const existing = await this.recordingRepository.findByOriginalId(
        userId,
        validatedData.data.id
      );
      if (existing) {
        throw RecordingErrors.DUPLICATE_ORIGINAL_ID;
      }
    }

    // Create recording
    const createData: RecordingCreateData = {
      userId,
      projectId,
      name: validatedData.name || validatedData.data.testName,
      url: validatedData.data.url,
      description: validatedData.description || null,
      originalId: validatedData.data.id,
      tags: validatedData.tags,
      data: validatedData.data as RecordingData,
      schemaVersion: validatedData.data.version,
    };

    const recording = await this.recordingRepository.create(createData);
    return toResponse(recording);
  }

  /**
   * Get a recording by ID
   */
  async getRecording(userId: string, recordingId: string): Promise<RecordingDetailResponse> {
    const recording = await this.recordingRepository.findById(recordingId);

    if (!recording) {
      throw RecordingErrors.NOT_FOUND;
    }

    if (recording.userId !== userId) {
      throw RecordingErrors.NOT_AUTHORIZED;
    }

    return toResponse(recording);
  }

  /**
   * List recordings with filters and pagination
   */
  async listRecordings(
    userId: string,
    query: ListRecordingsQuery
  ): Promise<PaginatedResult<RecordingResponse>> {
    const validatedQuery = listRecordingsQuerySchema.parse(query);

    const filters: RecordingListFilters = {
      userId,
      projectId: validatedQuery.projectId,
      search: validatedQuery.search,
      tags: validatedQuery.tags ? validatedQuery.tags.split(',').map((t) => t.trim()) : undefined,
      url: validatedQuery.url,
      includeDeleted: validatedQuery.includeDeleted,
    };

    const options: PaginationOptions = {
      page: validatedQuery.page,
      limit: validatedQuery.limit,
      sortBy: validatedQuery.sortBy,
      sortOrder: validatedQuery.sortOrder,
    };

    const result = await this.recordingRepository.findMany(filters, options);

    return {
      data: result.data.map(summaryToResponse),
      pagination: result.pagination,
    };
  }

  /**
   * Update a recording
   */
  async updateRecording(
    userId: string,
    recordingId: string,
    request: UpdateRecordingRequest
  ): Promise<RecordingDetailResponse> {
    // Validate update data
    const validatedData = updateRecordingSchema.parse(request);

    // Check data size if updating data
    if (validatedData.data) {
      const dataSize = JSON.stringify(validatedData.data).length;
      if (dataSize > this.config.maxDataSizeBytes) {
        throw RecordingErrors.TOO_LARGE;
      }
    }

    // Check ownership
    const existing = await this.recordingRepository.findById(recordingId);
    if (!existing) {
      throw RecordingErrors.NOT_FOUND;
    }

    if (existing.userId !== userId) {
      throw RecordingErrors.NOT_AUTHORIZED;
    }

    // Build update data
    const updateData: RecordingUpdateData = {};

    if (validatedData.name !== undefined) {
      updateData.name = validatedData.name;
    }

    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description;
    }

    if (validatedData.tags !== undefined) {
      updateData.tags = validatedData.tags;
    }

    if (validatedData.data !== undefined) {
      updateData.data = validatedData.data as RecordingData;
    }

    const updated = await this.recordingRepository.update(recordingId, userId, updateData);

    if (!updated) {
      throw RecordingErrors.NOT_FOUND;
    }

    return toResponse(updated);
  }

  /**
   * Delete a recording (soft delete)
   */
  async deleteRecording(userId: string, recordingId: string): Promise<void> {
    // Check ownership
    const existing = await this.recordingRepository.findById(recordingId);
    if (!existing) {
      throw RecordingErrors.NOT_FOUND;
    }

    if (existing.userId !== userId) {
      throw RecordingErrors.NOT_AUTHORIZED;
    }

    const deleted = await this.recordingRepository.softDelete(recordingId, userId);

    if (!deleted) {
      throw RecordingErrors.NOT_FOUND;
    }
  }

  /**
   * Restore a deleted recording
   */
  async restoreRecording(userId: string, recordingId: string): Promise<RecordingDetailResponse> {
    // Check ownership (including deleted)
    const existing = await this.recordingRepository.findById(recordingId, true);
    if (!existing) {
      throw RecordingErrors.NOT_FOUND;
    }

    if (existing.userId !== userId) {
      throw RecordingErrors.NOT_AUTHORIZED;
    }

    if (!existing.deletedAt) {
      throw new RecordingError('Recording is not deleted', 'NOT_DELETED', 400);
    }

    const restored = await this.recordingRepository.restore(recordingId, userId);

    if (!restored) {
      throw RecordingErrors.NOT_FOUND;
    }

    return toResponse(restored);
  }

  /**
   * Permanently delete a recording
   */
  async permanentlyDeleteRecording(userId: string, recordingId: string): Promise<void> {
    // Check ownership
    const isOwner = await this.recordingRepository.isOwner(recordingId, userId);
    if (!isOwner) {
      throw RecordingErrors.NOT_FOUND;
    }

    const deleted = await this.recordingRepository.hardDelete(recordingId, userId);

    if (!deleted) {
      throw RecordingErrors.NOT_FOUND;
    }
  }

  /**
   * Get recording for export (download as JSON)
   */
  async exportRecording(userId: string, recordingId: string): Promise<RecordingData> {
    const recording = await this.recordingRepository.findById(recordingId);

    if (!recording) {
      throw RecordingErrors.NOT_FOUND;
    }

    if (recording.userId !== userId) {
      throw RecordingErrors.NOT_AUTHORIZED;
    }

    return recording.data;
  }

  /**
   * Get all tags used by a user
   */
  async getTags(userId: string): Promise<string[]> {
    return this.recordingRepository.getTagsByUserId(userId);
  }

  /**
   * Get recordings by tag
   */
  async getRecordingsByTag(userId: string, tag: string): Promise<RecordingResponse[]> {
    const recordings = await this.recordingRepository.findByTag(userId, tag);
    return recordings.map(summaryToResponse);
  }

  /**
   * Get recording count for a user
   */
  async getRecordingCount(userId: string): Promise<number> {
    return this.recordingRepository.countByUserId(userId);
  }
}
