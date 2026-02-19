/**
 * ProjectRepository Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectRepository } from './ProjectRepository.js';
import { DEFAULT_PROJECT_NAME } from '../db/schema/projects.js';

// Mock database
const createMockDb = () => {
  const mockProject = {
    id: 'proj-123',
    userId: 'user-123',
    name: 'Default Project',
    slug: 'default-project',
    description: 'Your default project for test recordings',
    color: '#3B82F6',
    isDefault: true,
    deletedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  return {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockProject]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockProject]),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([mockProject]),
            }),
          }),
        }),
        orderBy: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockProject]),
          }),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockProject]),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'proj-123' }]),
      }),
    }),
    _mockProject: mockProject,
  };
};

describe('ProjectRepository', () => {
  let repository: ProjectRepository;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    repository = new ProjectRepository(mockDb as any);
  });

  describe('create', () => {
    it('should create a project successfully', async () => {
      const createData = {
        userId: 'user-123',
        name: 'Test Project',
        slug: 'test-project',
        description: 'A test project',
        color: '#FF0000',
        isDefault: false,
      };

      const result = await repository.create(createData);

      expect(result).toBeDefined();
      expect(result.id).toBe('proj-123');
      expect(result.name).toBe('Default Project');
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should create a project with minimal fields', async () => {
      const createData = {
        userId: 'user-123',
        name: 'Minimal Project',
        slug: 'minimal-project',
      };

      const result = await repository.create(createData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('createDefaultProject', () => {
    it('should create a default project for a user', async () => {
      const result = await repository.createDefaultProject('user-123');

      expect(result).toBeDefined();
      expect(result.isDefault).toBe(true);
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should find a project by ID', async () => {
      const result = await repository.findById('proj-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('proj-123');
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return null when project not found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByIdAndUser', () => {
    it('should find a project by ID and user ID', async () => {
      const result = await repository.findByIdAndUser('proj-123', 'user-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('proj-123');
      expect(result?.userId).toBe('user-123');
    });

    it('should return null when project not found or unauthorized', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.findByIdAndUser('proj-123', 'other-user');

      expect(result).toBeNull();
    });
  });

  describe('findDefaultProject', () => {
    it('should find the default project for a user', async () => {
      const result = await repository.findDefaultProject('user-123');

      expect(result).toBeDefined();
      expect(result?.isDefault).toBe(true);
    });

    it('should return null when no default project exists', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.findDefaultProject('user-without-default');

      expect(result).toBeNull();
    });
  });

  describe('findByNameAndUser', () => {
    it('should find a project by name and user ID', async () => {
      const result = await repository.findByNameAndUser('user-123', DEFAULT_PROJECT_NAME);

      expect(result).toBeDefined();
      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe('findMany', () => {
    it('should list projects with pagination', async () => {
      // Mock for paginated query
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockResolvedValue([{ count: 1 }]),
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([mockDb._mockProject]),
              }),
            }),
          })),
        }),
      });

      const result = await repository.findMany({ userId: 'user-123' }, { page: 1, limit: 10 });

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.pagination).toBeDefined();
    });

    it('should filter by search term', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockResolvedValue([{ count: 1 }]),
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([mockDb._mockProject]),
              }),
            }),
          })),
        }),
      });

      const result = await repository.findMany(
        { userId: 'user-123', search: 'test' },
        { page: 1, limit: 10 }
      );

      expect(result).toBeDefined();
      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update a project', async () => {
      const result = await repository.update('proj-123', 'user-123', {
        name: 'Updated Project',
        description: 'Updated description',
      });

      expect(result).toBeDefined();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should return null when project not found', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.update('non-existent', 'user-123', {
        name: 'Updated Project',
      });

      expect(result).toBeNull();
    });

    it('should update color', async () => {
      const result = await repository.update('proj-123', 'user-123', {
        color: '#00FF00',
      });

      expect(result).toBeDefined();
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('should soft delete a project', async () => {
      const result = await repository.softDelete('proj-123', 'user-123');

      expect(result).toBe(true);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should return false when project not found', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.softDelete('non-existent', 'user-123');

      expect(result).toBe(false);
    });
  });

  describe('countByUser', () => {
    it('should count projects for a user', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 5 }]),
        }),
      });

      const result = await repository.countByUser('user-123');

      expect(result).toBe(5);
    });
  });

  describe('isNameAvailable', () => {
    it('should return true when name is available', async () => {
      // Mock: count returns 0 (name available)
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      const result = await repository.isNameAvailable('user-123', 'Available Name');

      expect(result).toBe(true);
    });

    it('should return false when name is taken', async () => {
      // Mock: count returns > 0 (name taken)
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      });

      const result = await repository.isNameAvailable('user-123', 'Default Project');

      // When count > 0, name is NOT available (return false)
      expect(result).toBe(false);
    });

    it('should return true when editing existing project', async () => {
      // When updating, exclude current project ID - count returns 0
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      const result = await repository.isNameAvailable('user-123', 'Some Name', 'proj-123');

      expect(result).toBe(true);
    });
  });
});
