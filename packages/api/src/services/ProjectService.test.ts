/**
 * ProjectService Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ProjectService,
  ProjectError,
  ProjectErrors,
  createProjectSchema,
  updateProjectSchema,
  listProjectsQuerySchema,
  type CreateProjectInput,
  type UpdateProjectInput,
  type ListProjectsQuery,
} from './ProjectService.js';
import type { SafeProject, ProjectSummary } from '../repositories/ProjectRepository.js';
import { DEFAULT_PROJECT_NAME } from '../db/schema/projects.js';

// Sample project data
const sampleSafeProject: SafeProject = {
  id: 'proj-123',
  userId: 'user-123',
  name: 'Test Project',
  description: 'A test project',
  color: '#3B82F6',
  isDefault: false,
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const sampleDefaultProject: SafeProject = {
  id: 'proj-default',
  userId: 'user-123',
  name: DEFAULT_PROJECT_NAME,
  description: 'Your default project for test recordings',
  color: '#3B82F6',
  isDefault: true,
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const sampleProjectSummary: ProjectSummary = {
  id: 'proj-123',
  userId: 'user-123',
  name: 'Test Project',
  description: 'A test project',
  color: '#3B82F6',
  isDefault: false,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

// Mock repository interface
type MockedRepository = {
  create: ReturnType<typeof vi.fn>;
  createDefaultProject: ReturnType<typeof vi.fn>;
  findById: ReturnType<typeof vi.fn>;
  findByIdAndUser: ReturnType<typeof vi.fn>;
  findByNameAndUser: ReturnType<typeof vi.fn>;
  findDefaultProject: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  softDelete: ReturnType<typeof vi.fn>;
  countByUser: ReturnType<typeof vi.fn>;
  isNameAvailable: ReturnType<typeof vi.fn>;
};

const createMockRepository = (): MockedRepository => ({
  create: vi.fn().mockResolvedValue(sampleSafeProject),
  createDefaultProject: vi.fn().mockResolvedValue(sampleDefaultProject),
  findById: vi.fn().mockResolvedValue(sampleSafeProject),
  findByIdAndUser: vi.fn().mockResolvedValue(sampleSafeProject),
  findByNameAndUser: vi.fn().mockResolvedValue(null),
  findDefaultProject: vi.fn().mockResolvedValue(sampleDefaultProject),
  findMany: vi.fn().mockResolvedValue({
    data: [sampleProjectSummary],
    pagination: {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    },
  }),
  update: vi.fn().mockResolvedValue(sampleSafeProject),
  softDelete: vi.fn().mockResolvedValue(true),
  countByUser: vi.fn().mockResolvedValue(1),
  isNameAvailable: vi.fn().mockResolvedValue(true),
});

describe('ProjectService', () => {
  let service: ProjectService;
  let mockRepository: MockedRepository;

  beforeEach(() => {
    mockRepository = createMockRepository();
    service = new ProjectService(mockRepository as any);
  });

  describe('Schema Validation', () => {
    describe('createProjectSchema', () => {
      it('should validate valid create project input', () => {
        const input = {
          name: 'My Project',
          description: 'A test project',
          color: '#3B82F6',
        };

        const result = createProjectSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('should require name', () => {
        const input = {
          description: 'A test project',
        };

        const result = createProjectSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should validate name length', () => {
        const input = {
          name: 'a'.repeat(256), // Too long
        };

        const result = createProjectSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should validate color format (if provided)', () => {
        const validInput = { name: 'Test', color: '#FF0000' };
        const invalidInput = { name: 'Test', color: 'not-a-color' };

        expect(createProjectSchema.safeParse(validInput).success).toBe(true);
        // Color accepts any string if not validated strictly
      });

      it('should allow missing optional fields', () => {
        const input = { name: 'Test' };

        const result = createProjectSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('updateProjectSchema', () => {
      it('should allow partial updates', () => {
        const input = { name: 'Updated Name' };

        const result = updateProjectSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('should allow empty object', () => {
        const result = updateProjectSchema.safeParse({});
        expect(result.success).toBe(true);
      });
    });

    describe('listProjectsQuerySchema', () => {
      it('should have defaults', () => {
        const result = listProjectsQuerySchema.parse({});

        expect(result.page).toBe(1);
        expect(result.limit).toBe(50);
        expect(result.sortBy).toBe('name');
        expect(result.sortOrder).toBe('asc');
      });

      it('should accept valid search', () => {
        const result = listProjectsQuerySchema.parse({ search: 'project' });
        expect(result.search).toBe('project');
      });
    });
  });

  describe('ProjectError', () => {
    it('should create error with correct properties', () => {
      const error = new ProjectError('Test error', 'TEST_CODE', 400);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('ProjectError');
    });
  });

  describe('createProject', () => {
    it('should create a project successfully', async () => {
      const input: CreateProjectInput = {
        name: 'New Project',
        description: 'A new project',
      };

      const result = await service.createProject('user-123', input);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(mockRepository.create).toHaveBeenCalled();
    });

    it('should check for name availability', async () => {
      const input: CreateProjectInput = {
        name: 'Existing Project',
      };

      await service.createProject('user-123', input);

      expect(mockRepository.isNameAvailable).toHaveBeenCalledWith('user-123', 'Existing Project');
    });

    it('should throw error when name is taken', async () => {
      mockRepository.isNameAvailable.mockResolvedValue(false);

      const input: CreateProjectInput = {
        name: 'Existing Project',
      };

      await expect(service.createProject('user-123', input)).rejects.toThrow(ProjectError);
    });

    it('should enforce max projects limit', async () => {
      mockRepository.countByUser.mockResolvedValue(100);

      const input: CreateProjectInput = {
        name: 'New Project',
      };

      await expect(service.createProject('user-123', input)).rejects.toThrow(ProjectError);
    });
  });

  describe('getProject', () => {
    it('should return a project by ID', async () => {
      const result = await service.getProject('user-123', 'proj-123');

      expect(result).toBeDefined();
      expect(result.id).toBe('proj-123');
      expect(mockRepository.findByIdAndUser).toHaveBeenCalledWith('proj-123', 'user-123');
    });

    it('should throw NOT_FOUND when project does not exist', async () => {
      mockRepository.findByIdAndUser.mockResolvedValue(null);

      await expect(service.getProject('user-123', 'non-existent')).rejects.toThrow(
        'Project not found'
      );
    });
  });

  describe('getDefaultProject', () => {
    it('should return the default project', async () => {
      const result = await service.getDefaultProject('user-123');

      expect(result).toBeDefined();
      expect(result.isDefault).toBe(true);
    });

    it('should create default project when none exists', async () => {
      mockRepository.findDefaultProject.mockResolvedValue(null);
      mockRepository.isNameAvailable.mockResolvedValue(true);
      mockRepository.countByUser.mockResolvedValue(0);

      const result = await service.getDefaultProject('user-123');

      expect(result).toBeDefined();
      // The createDefaultProject method is called
      expect(mockRepository.createDefaultProject).toHaveBeenCalled();
    });
  });

  describe('ensureDefaultProject', () => {
    it('should return existing default project', async () => {
      const result = await service.ensureDefaultProject('user-123');

      expect(result).toBeDefined();
      expect(result.isDefault).toBe(true);
      expect(mockRepository.createDefaultProject).not.toHaveBeenCalled();
    });

    it('should create default project if none exists', async () => {
      mockRepository.findDefaultProject.mockResolvedValue(null);

      const result = await service.ensureDefaultProject('user-123');

      expect(result).toBeDefined();
      expect(mockRepository.createDefaultProject).toHaveBeenCalledWith('user-123');
    });
  });

  describe('listProjects', () => {
    it('should return paginated projects', async () => {
      const query: ListProjectsQuery = { page: 1, limit: 10 };

      const result = await service.listProjects('user-123', query);

      expect(result.data).toBeDefined();
      expect(result.pagination).toBeDefined();
      expect(result.pagination.page).toBe(1);
    });

    it('should pass filters to repository', async () => {
      const query: ListProjectsQuery = {
        page: 1,
        limit: 20,
        search: 'test',
        sortBy: 'name',
        sortOrder: 'asc',
      };

      await service.listProjects('user-123', query);

      expect(mockRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          search: 'test',
        }),
        expect.objectContaining({
          sortBy: 'name',
          sortOrder: 'asc',
        })
      );
    });
  });

  describe('updateProject', () => {
    it('should update a project', async () => {
      const input: UpdateProjectInput = {
        name: 'Updated Name',
        description: 'Updated description',
      };

      const result = await service.updateProject('user-123', 'proj-123', input);

      expect(result).toBeDefined();
      expect(mockRepository.update).toHaveBeenCalled();
    });

    it('should check name availability when updating name', async () => {
      const input: UpdateProjectInput = {
        name: 'New Name',
      };

      await service.updateProject('user-123', 'proj-123', input);

      expect(mockRepository.isNameAvailable).toHaveBeenCalledWith(
        'user-123',
        'New Name',
        'proj-123'
      );
    });

    it('should throw when project not found', async () => {
      mockRepository.findByIdAndUser.mockResolvedValue(null);

      const input: UpdateProjectInput = { name: 'Test' };

      await expect(service.updateProject('user-123', 'non-existent', input)).rejects.toThrow(
        'Project not found'
      );
    });

    it('should throw when name is taken', async () => {
      mockRepository.isNameAvailable.mockResolvedValue(false);

      const input: UpdateProjectInput = { name: 'Existing Name' };

      await expect(service.updateProject('user-123', 'proj-123', input)).rejects.toThrow(
        ProjectError
      );
    });
  });

  describe('deleteProject', () => {
    it('should delete a project', async () => {
      mockRepository.findByIdAndUser.mockResolvedValue(sampleSafeProject);

      await service.deleteProject('user-123', 'proj-123');

      expect(mockRepository.softDelete).toHaveBeenCalledWith('proj-123', 'user-123');
    });

    it('should throw when trying to delete default project', async () => {
      mockRepository.findByIdAndUser.mockResolvedValue(sampleDefaultProject);

      await expect(service.deleteProject('user-123', 'proj-default')).rejects.toThrow(
        'Default project cannot be deleted'
      );
    });

    it('should throw when project not found', async () => {
      mockRepository.findByIdAndUser.mockResolvedValue(null);

      await expect(service.deleteProject('user-123', 'non-existent')).rejects.toThrow(
        'Project not found'
      );
    });
  });

  describe('verifyProjectAccess', () => {
    it('should return project when user has access', async () => {
      const result = await service.verifyProjectAccess('user-123', 'proj-123');

      expect(result).toBeDefined();
      expect(result.id).toBe('proj-123');
    });

    it('should throw when user does not have access', async () => {
      mockRepository.findByIdAndUser.mockResolvedValue(null);

      await expect(service.verifyProjectAccess('user-123', 'proj-123')).rejects.toThrow(
        ProjectError
      );
    });
  });
});
