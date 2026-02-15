/**
 * Project Service
 *
 * Business logic for project CRUD operations.
 * Handles validation, transformation, and coordination.
 */

import { z } from 'zod';
import type {
  ProjectRepository,
  ProjectCreateData,
  ProjectUpdateData,
  ProjectListFilters,
  SafeProject,
} from '../repositories/ProjectRepository.js';
import { DEFAULT_PROJECT_NAME } from '../db/schema/projects.js';

/**
 * Project Service Error
 */
export class ProjectError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'ProjectError';
  }
}

/**
 * Predefined Project errors
 */
export const ProjectErrors = {
  NOT_FOUND: new ProjectError('Project not found', 'PROJECT_NOT_FOUND', 404),
  NOT_AUTHORIZED: new ProjectError('Not authorized to access this project', 'NOT_AUTHORIZED', 403),
  NAME_TAKEN: new ProjectError(
    'A project with this name already exists',
    'PROJECT_NAME_TAKEN',
    409
  ),
  CANNOT_DELETE_DEFAULT: new ProjectError(
    'Default project cannot be deleted. Create another project first.',
    'CANNOT_DELETE_DEFAULT_PROJECT',
    400
  ),
  CANNOT_RENAME_DEFAULT: new ProjectError(
    'Default project cannot be renamed',
    'CANNOT_RENAME_DEFAULT_PROJECT',
    400
  ),
  ALREADY_DELETED: new ProjectError('Project is already deleted', 'ALREADY_DELETED', 400),
  PROJECT_ID_REQUIRED: new ProjectError(
    'projectId query parameter is required',
    'PROJECT_ID_REQUIRED',
    400
  ),
} as const;

/**
 * Hex color validation regex
 */
const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

/**
 * Create project request schema
 */
export const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional().nullable(),
  color: z
    .string()
    .regex(hexColorRegex, 'Color must be a valid hex color (e.g., #FF5733)')
    .optional()
    .nullable(),
});

/**
 * Update project request schema
 */
export const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
  color: z
    .string()
    .regex(hexColorRegex, 'Color must be a valid hex color (e.g., #FF5733)')
    .optional()
    .nullable(),
});

/**
 * List projects query schema
 */
export const listProjectsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  search: z.string().max(255).optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).optional().default('name'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
  includeDeleted: z.coerce.boolean().optional().default(false),
});

export type CreateProjectRequest = z.infer<typeof createProjectSchema>;
export type UpdateProjectRequest = z.infer<typeof updateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;

/**
 * Service configuration
 */
export interface ProjectServiceConfig {
  /** Maximum projects per user (0 = unlimited) */
  maxProjectsPerUser: number;
}

const DEFAULT_CONFIG: ProjectServiceConfig = {
  maxProjectsPerUser: 100,
};

/**
 * Project Service response types
 */
export interface ProjectResponse {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Convert SafeProject to ProjectResponse
 */
function toResponse(project: SafeProject): ProjectResponse {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    color: project.color,
    isDefault: project.isDefault,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

/**
 * Project Service class
 */
export class ProjectService {
  private readonly config: ProjectServiceConfig;

  constructor(
    private readonly projectRepository: ProjectRepository,
    config?: Partial<ProjectServiceConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create default project for a new user (called on signup)
   */
  async createDefaultProject(userId: string): Promise<ProjectResponse> {
    const project = await this.projectRepository.createDefaultProject(userId);
    return toResponse(project);
  }

  /**
   * Create a new project
   */
  async createProject(userId: string, request: CreateProjectRequest): Promise<ProjectResponse> {
    // Validate request
    const validatedData = createProjectSchema.parse(request);

    // Check project limit
    if (this.config.maxProjectsPerUser > 0) {
      const count = await this.projectRepository.countByUser(userId);
      if (count >= this.config.maxProjectsPerUser) {
        throw new ProjectError(
          `Maximum number of projects (${this.config.maxProjectsPerUser}) reached`,
          'PROJECT_LIMIT_REACHED',
          400
        );
      }
    }

    // Check name uniqueness
    const isAvailable = await this.projectRepository.isNameAvailable(userId, validatedData.name);
    if (!isAvailable) {
      throw ProjectErrors.NAME_TAKEN;
    }

    // Create project
    const createData: ProjectCreateData = {
      userId,
      name: validatedData.name,
      description: validatedData.description || null,
      color: validatedData.color || null,
      isDefault: false,
    };

    const project = await this.projectRepository.create(createData);
    return toResponse(project);
  }

  /**
   * Get a project by ID
   */
  async getProject(userId: string, projectId: string): Promise<ProjectResponse> {
    const project = await this.projectRepository.findByIdAndUser(projectId, userId);

    if (!project) {
      throw ProjectErrors.NOT_FOUND;
    }

    return toResponse(project);
  }

  /**
   * Get a project by name (case-insensitive)
   */
  async getProjectByName(userId: string, name: string): Promise<ProjectResponse> {
    const project = await this.projectRepository.findByNameAndUser(name, userId);

    if (!project) {
      throw ProjectErrors.NOT_FOUND;
    }

    return toResponse(project);
  }

  /**
   * Get the default project for a user
   */
  async getDefaultProject(userId: string): Promise<ProjectResponse> {
    const project = await this.projectRepository.findDefaultProject(userId);

    if (!project) {
      // This shouldn't happen - create default project if missing
      return this.createDefaultProject(userId);
    }

    return toResponse(project);
  }

  /**
   * Get or create default project (called during operations that require projectId)
   */
  async ensureDefaultProject(userId: string): Promise<ProjectResponse> {
    const project = await this.projectRepository.findDefaultProject(userId);

    if (project) {
      return toResponse(project);
    }

    // Create default project if it doesn't exist
    return this.createDefaultProject(userId);
  }

  /**
   * List all projects for a user (simple list, no pagination)
   */
  async listAllProjects(userId: string): Promise<ProjectResponse[]> {
    const projects = await this.projectRepository.findAllByUser(userId);
    return projects.map(toResponse);
  }

  /**
   * List projects with pagination
   */
  async listProjects(
    userId: string,
    query: ListProjectsQuery
  ): Promise<{
    data: ProjectResponse[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrevious: boolean;
    };
  }> {
    const validatedQuery = listProjectsQuerySchema.parse(query);

    const filters: ProjectListFilters = {
      userId,
      search: validatedQuery.search,
      includeDeleted: validatedQuery.includeDeleted,
    };

    const result = await this.projectRepository.findMany(filters, {
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
   * Update a project
   */
  async updateProject(
    userId: string,
    projectId: string,
    request: UpdateProjectRequest
  ): Promise<ProjectResponse> {
    // Validate request
    const validatedData = updateProjectSchema.parse(request);

    // Check that project exists and belongs to user
    const existing = await this.projectRepository.findByIdAndUser(projectId, userId);
    if (!existing) {
      throw ProjectErrors.NOT_FOUND;
    }

    // Cannot rename default project
    if (validatedData.name && existing.isDefault) {
      throw ProjectErrors.CANNOT_RENAME_DEFAULT;
    }

    // Check name uniqueness if changing name
    if (validatedData.name && validatedData.name !== existing.name) {
      const isAvailable = await this.projectRepository.isNameAvailable(
        userId,
        validatedData.name,
        projectId
      );
      if (!isAvailable) {
        throw ProjectErrors.NAME_TAKEN;
      }
    }

    // Update project
    const updateData: ProjectUpdateData = {};
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.color !== undefined) updateData.color = validatedData.color;

    const updated = await this.projectRepository.update(projectId, userId, updateData);
    if (!updated) {
      throw ProjectErrors.NOT_FOUND;
    }

    return toResponse(updated);
  }

  /**
   * Delete a project (soft delete)
   */
  async deleteProject(userId: string, projectId: string): Promise<void> {
    // Check that project exists and belongs to user
    const existing = await this.projectRepository.findByIdAndUser(projectId, userId);
    if (!existing) {
      throw ProjectErrors.NOT_FOUND;
    }

    // Cannot delete default project
    if (existing.isDefault) {
      throw ProjectErrors.CANNOT_DELETE_DEFAULT;
    }

    // Soft delete project
    const deleted = await this.projectRepository.softDelete(projectId, userId);
    if (!deleted) {
      throw ProjectErrors.NOT_FOUND;
    }

    // Note: Cascading to recordings, runs, schedules will be handled by:
    // 1. Recording queries filter by project.deletedAt IS NULL
    // 2. A background job can clean up orphaned records later
    // For now, we keep the child records but they become inaccessible
  }

  /**
   * Verify user has access to a project
   */
  async verifyProjectAccess(userId: string, projectId: string): Promise<SafeProject> {
    const project = await this.projectRepository.findByIdAndUser(projectId, userId);

    if (!project) {
      throw ProjectErrors.NOT_FOUND;
    }

    return project;
  }

  /**
   * Count projects for a user
   */
  async countProjects(userId: string): Promise<number> {
    return this.projectRepository.countByUser(userId);
  }
}

// Re-export for convenience
export { DEFAULT_PROJECT_NAME };
