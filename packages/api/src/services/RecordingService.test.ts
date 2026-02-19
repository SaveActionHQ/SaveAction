/**
 * RecordingService Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RecordingService,
  RecordingError,
  RecordingErrors,
  createRecordingSchema,
  updateRecordingSchema,
  listRecordingsQuerySchema,
  recordingDataSchema,
  type CreateRecordingRequest,
  type ListRecordingsQuery,
  type UpdateRecordingRequest,
} from './RecordingService.js';
import type {
  RecordingRepository,
  SafeRecording,
  RecordingSummary,
} from '../repositories/RecordingRepository.js';
import type { ProjectRepository, SafeProject } from '../repositories/ProjectRepository.js';
import type { RecordingData } from '../db/schema/recordings.js';

// Sample recording data
const sampleRecordingData: RecordingData = {
  id: 'rec_1234567890',
  testName: 'Test Recording',
  url: 'https://example.com',
  startTime: '2026-01-01T00:00:00Z',
  endTime: '2026-01-01T00:01:00Z',
  viewport: { width: 1920, height: 1080 },
  userAgent: 'Mozilla/5.0',
  actions: [
    { id: 'act_001', type: 'click', timestamp: 1000, url: 'https://example.com' },
    { id: 'act_002', type: 'input', timestamp: 2000, url: 'https://example.com' },
  ],
  version: '1.0.0',
};

const sampleProject: SafeProject = {
  id: 'proj-123',
  userId: 'user-123',
  name: 'Default Project',
  slug: 'default-project',
  description: 'Default project',
  color: '#3B82F6',
  isDefault: true,
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const sampleSafeRecording: SafeRecording = {
  id: 'rec-uuid-123',
  userId: 'user-123',
  projectId: 'proj-123',
  name: 'Test Recording',
  url: 'https://example.com',
  description: 'Test description',
  originalId: 'rec_1234567890',
  tags: ['smoke', 'login'],
  data: sampleRecordingData,
  actionCount: 2,
  estimatedDurationMs: 60000,
  schemaVersion: '1.0.0',
  dataSizeBytes: 500,
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const sampleSummary: RecordingSummary = {
  id: 'rec-uuid-123',
  userId: 'user-123',
  projectId: 'proj-123',
  name: 'Test Recording',
  url: 'https://example.com',
  description: 'Test description',
  originalId: 'rec_1234567890',
  tags: ['smoke', 'login'],
  actionCount: 2,
  estimatedDurationMs: 60000,
  schemaVersion: '1.0.0',
  dataSizeBytes: 500,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

// Mock project repository
type MockedProjectRepository = {
  findDefaultProject: ReturnType<typeof vi.fn>;
  createDefaultProject: ReturnType<typeof vi.fn>;
  findByIdAndUser: ReturnType<typeof vi.fn>;
};

const createMockProjectRepository = (): MockedProjectRepository => ({
  findDefaultProject: vi.fn().mockResolvedValue(sampleProject),
  createDefaultProject: vi.fn().mockResolvedValue(sampleProject),
  findByIdAndUser: vi.fn().mockResolvedValue(sampleProject),
});

// Mock repository interface (only the methods we need)
type MockedRepository = {
  create: ReturnType<typeof vi.fn>;
  findById: ReturnType<typeof vi.fn>;
  findByOriginalId: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  softDelete: ReturnType<typeof vi.fn>;
  restore: ReturnType<typeof vi.fn>;
  hardDelete: ReturnType<typeof vi.fn>;
  countByUserId: ReturnType<typeof vi.fn>;
  isOwner: ReturnType<typeof vi.fn>;
  getTagsByUserId: ReturnType<typeof vi.fn>;
  findByTag: ReturnType<typeof vi.fn>;
};

const createMockRepository = (): MockedRepository => ({
  create: vi.fn().mockResolvedValue(sampleSafeRecording),
  findById: vi.fn().mockResolvedValue(sampleSafeRecording),
  findByOriginalId: vi.fn().mockResolvedValue(null),
  findMany: vi.fn().mockResolvedValue({
    data: [sampleSummary],
    pagination: {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    },
  }),
  update: vi.fn().mockResolvedValue(sampleSafeRecording),
  softDelete: vi.fn().mockResolvedValue(true),
  restore: vi.fn().mockResolvedValue(sampleSafeRecording),
  hardDelete: vi.fn().mockResolvedValue(true),
  countByUserId: vi.fn().mockResolvedValue(5),
  isOwner: vi.fn().mockResolvedValue(true),
  getTagsByUserId: vi.fn().mockResolvedValue(['smoke', 'login', 'checkout']),
  findByTag: vi.fn().mockResolvedValue([sampleSummary]),
});

describe('RecordingService', () => {
  let service: RecordingService;
  let mockRepository: MockedRepository;
  let mockProjectRepository: MockedProjectRepository;

  beforeEach(() => {
    mockRepository = createMockRepository();
    mockProjectRepository = createMockProjectRepository();
    service = new RecordingService(
      mockRepository as unknown as RecordingRepository,
      mockProjectRepository as unknown as ProjectRepository
    );
  });

  describe('Schema Validation', () => {
    describe('recordingDataSchema', () => {
      it('should validate valid recording data', () => {
        const result = recordingDataSchema.safeParse(sampleRecordingData);
        expect(result.success).toBe(true);
      });

      it('should reject invalid URL', () => {
        const invalidData = { ...sampleRecordingData, url: 'not-a-url' };
        const result = recordingDataSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should reject empty testName', () => {
        const invalidData = { ...sampleRecordingData, testName: '' };
        const result = recordingDataSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should reject invalid viewport', () => {
        const invalidData = { ...sampleRecordingData, viewport: { width: -100, height: 0 } };
        const result = recordingDataSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });

    describe('createRecordingSchema', () => {
      it('should validate valid create request', () => {
        const request = {
          name: 'My Recording',
          description: 'Test',
          tags: ['smoke'],
          data: sampleRecordingData,
        };
        const result = createRecordingSchema.safeParse(request);
        expect(result.success).toBe(true);
      });

      it('should use data.testName as default name', () => {
        const request = {
          data: sampleRecordingData,
        };
        const result = createRecordingSchema.safeParse(request);
        expect(result.success).toBe(true);
      });

      it('should reject too many tags', () => {
        const request = {
          data: sampleRecordingData,
          tags: Array(25).fill('tag'),
        };
        const result = createRecordingSchema.safeParse(request);
        expect(result.success).toBe(false);
      });

      it('should reject empty tag names', () => {
        const request = {
          data: sampleRecordingData,
          tags: ['valid', ''],
        };
        const result = createRecordingSchema.safeParse(request);
        expect(result.success).toBe(false);
      });
    });

    describe('updateRecordingSchema', () => {
      it('should validate partial update', () => {
        const request = { name: 'Updated Name' };
        const result = updateRecordingSchema.safeParse(request);
        expect(result.success).toBe(true);
      });

      it('should validate tags-only update', () => {
        const request = { tags: ['new-tag'] };
        const result = updateRecordingSchema.safeParse(request);
        expect(result.success).toBe(true);
      });

      it('should validate full update', () => {
        const request = {
          name: 'Updated',
          description: 'New description',
          tags: ['updated'],
          data: sampleRecordingData,
        };
        const result = updateRecordingSchema.safeParse(request);
        expect(result.success).toBe(true);
      });
    });

    describe('listRecordingsQuerySchema', () => {
      const validProjectId = '00000000-0000-0000-0000-000000000001';

      it('should require projectId', () => {
        const result = listRecordingsQuerySchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('should provide defaults for query with projectId', () => {
        const result = listRecordingsQuerySchema.parse({ projectId: validProjectId });
        expect(result.projectId).toBe(validProjectId);
        expect(result.page).toBe(1);
        expect(result.limit).toBe(20);
        expect(result.sortBy).toBe('updatedAt');
        expect(result.sortOrder).toBe('desc');
      });

      it('should coerce string numbers', () => {
        const result = listRecordingsQuerySchema.parse({
          projectId: validProjectId,
          page: '2',
          limit: '50',
        });
        expect(result.page).toBe(2);
        expect(result.limit).toBe(50);
      });

      it('should reject invalid sortBy', () => {
        const result = listRecordingsQuerySchema.safeParse({
          projectId: validProjectId,
          sortBy: 'invalid',
        });
        expect(result.success).toBe(false);
      });

      it('should reject limit over 100', () => {
        const result = listRecordingsQuerySchema.safeParse({
          projectId: validProjectId,
          limit: 200,
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe('createRecording', () => {
    it('should create a recording successfully', async () => {
      const request: CreateRecordingRequest = {
        name: 'My Recording',
        description: 'Test description',
        tags: ['smoke'],
        data: sampleRecordingData as CreateRecordingRequest['data'],
      };

      const result = await service.createRecording('user-123', request);

      expect(result).toBeDefined();
      expect(result.id).toBe('rec-uuid-123');
      expect(result.name).toBe('Test Recording');
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          name: 'My Recording',
        })
      );
    });

    it('should use testName as default name', async () => {
      const request: CreateRecordingRequest = {
        tags: [],
        data: sampleRecordingData as CreateRecordingRequest['data'],
      };

      await service.createRecording('user-123', request);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: sampleRecordingData.testName,
        })
      );
    });

    it('should reject duplicate original ID', async () => {
      mockRepository.findByOriginalId.mockResolvedValue(sampleSafeRecording);

      const request: CreateRecordingRequest = {
        tags: [],
        data: sampleRecordingData as CreateRecordingRequest['data'],
      };

      await expect(service.createRecording('user-123', request)).rejects.toThrow(
        RecordingErrors.DUPLICATE_ORIGINAL_ID
      );
    });

    it('should reject data exceeding size limit', async () => {
      const serviceWithLimit = new RecordingService(
        mockRepository as unknown as RecordingRepository,
        mockProjectRepository as unknown as ProjectRepository,
        {
          maxDataSizeBytes: 100, // Very small limit
        }
      );

      const request: CreateRecordingRequest = {
        tags: [],
        data: sampleRecordingData as CreateRecordingRequest['data'],
      };

      await expect(serviceWithLimit.createRecording('user-123', request)).rejects.toThrow(
        RecordingErrors.TOO_LARGE
      );
    });

    it('should enforce recording limit per user', async () => {
      const serviceWithLimit = new RecordingService(
        mockRepository as unknown as RecordingRepository,
        mockProjectRepository as unknown as ProjectRepository,
        {
          maxRecordingsPerUser: 5,
        }
      );
      mockRepository.countByUserId.mockResolvedValue(5);

      const request: CreateRecordingRequest = {
        tags: [],
        data: sampleRecordingData as CreateRecordingRequest['data'],
      };

      await expect(serviceWithLimit.createRecording('user-123', request)).rejects.toThrow(
        'Maximum number of recordings'
      );
    });

    it('should handle validation errors', async () => {
      const invalidRequest = {
        data: { ...sampleRecordingData, url: 'not-a-url' },
      };

      await expect(service.createRecording('user-123', invalidRequest as any)).rejects.toThrow();
    });
  });

  describe('getRecording', () => {
    it('should get a recording by ID', async () => {
      const result = await service.getRecording('user-123', 'rec-uuid-123');

      expect(result).toBeDefined();
      expect(result.id).toBe('rec-uuid-123');
      expect(result.data).toEqual(sampleRecordingData);
    });

    it('should throw NOT_FOUND when recording does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.getRecording('user-123', 'nonexistent')).rejects.toThrow(
        RecordingErrors.NOT_FOUND
      );
    });

    it('should throw NOT_AUTHORIZED when user does not own recording', async () => {
      mockRepository.findById.mockResolvedValue({
        ...sampleSafeRecording,
        userId: 'other-user',
      });

      await expect(service.getRecording('user-123', 'rec-uuid-123')).rejects.toThrow(
        RecordingErrors.NOT_AUTHORIZED
      );
    });
  });

  describe('listRecordings', () => {
    const defaultQuery: ListRecordingsQuery = {
      projectId: '00000000-0000-0000-0000-000000000001',
      page: 1,
      limit: 20,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      includeDeleted: false,
    };

    it('should list recordings with default options', async () => {
      const result = await service.listRecordings('user-123', defaultQuery);

      expect(result.data).toHaveLength(1);
      expect(result.pagination).toBeDefined();
      expect(mockRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-123' }),
        expect.objectContaining({ page: 1, limit: 20 })
      );
    });

    it('should pass search filter', async () => {
      await service.listRecordings('user-123', { ...defaultQuery, search: 'login' });

      expect(mockRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'login' }),
        expect.any(Object)
      );
    });

    it('should parse comma-separated tags', async () => {
      await service.listRecordings('user-123', { ...defaultQuery, tags: 'smoke,login' });

      expect(mockRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ tags: ['smoke', 'login'] }),
        expect.any(Object)
      );
    });

    it('should pass pagination options', async () => {
      await service.listRecordings('user-123', {
        ...defaultQuery,
        page: 3,
        limit: 50,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      expect(mockRepository.findMany).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          page: 3,
          limit: 50,
          sortBy: 'name',
          sortOrder: 'asc',
        })
      );
    });
  });

  describe('updateRecording', () => {
    it('should update a recording successfully', async () => {
      const result = await service.updateRecording('user-123', 'rec-uuid-123', {
        name: 'Updated Name',
      });

      expect(result).toBeDefined();
      expect(mockRepository.update).toHaveBeenCalled();
    });

    it('should throw NOT_FOUND when recording does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateRecording('user-123', 'nonexistent', { name: 'Updated' })
      ).rejects.toThrow(RecordingErrors.NOT_FOUND);
    });

    it('should throw NOT_AUTHORIZED when user does not own recording', async () => {
      mockRepository.findById.mockResolvedValue({
        ...sampleSafeRecording,
        userId: 'other-user',
      });

      await expect(
        service.updateRecording('user-123', 'rec-uuid-123', { name: 'Updated' })
      ).rejects.toThrow(RecordingErrors.NOT_AUTHORIZED);
    });

    it('should reject data exceeding size limit on update', async () => {
      const serviceWithLimit = new RecordingService(
        mockRepository as unknown as RecordingRepository,
        mockProjectRepository as unknown as ProjectRepository,
        {
          maxDataSizeBytes: 100,
        }
      );

      const updateData: UpdateRecordingRequest = {
        data: sampleRecordingData as UpdateRecordingRequest['data'],
      };

      await expect(
        serviceWithLimit.updateRecording('user-123', 'rec-uuid-123', updateData)
      ).rejects.toThrow(RecordingErrors.TOO_LARGE);
    });
  });

  describe('deleteRecording', () => {
    it('should soft delete a recording', async () => {
      await service.deleteRecording('user-123', 'rec-uuid-123');

      expect(mockRepository.softDelete).toHaveBeenCalledWith('rec-uuid-123', 'user-123');
    });

    it('should throw NOT_FOUND when recording does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.deleteRecording('user-123', 'nonexistent')).rejects.toThrow(
        RecordingErrors.NOT_FOUND
      );
    });

    it('should throw NOT_AUTHORIZED when user does not own recording', async () => {
      mockRepository.findById.mockResolvedValue({
        ...sampleSafeRecording,
        userId: 'other-user',
      });

      await expect(service.deleteRecording('user-123', 'rec-uuid-123')).rejects.toThrow(
        RecordingErrors.NOT_AUTHORIZED
      );
    });
  });

  describe('restoreRecording', () => {
    it('should restore a deleted recording', async () => {
      mockRepository.findById.mockResolvedValue({
        ...sampleSafeRecording,
        deletedAt: new Date(),
      });

      const result = await service.restoreRecording('user-123', 'rec-uuid-123');

      expect(result).toBeDefined();
      expect(mockRepository.restore).toHaveBeenCalled();
    });

    it('should throw NOT_FOUND when recording does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.restoreRecording('user-123', 'nonexistent')).rejects.toThrow(
        RecordingErrors.NOT_FOUND
      );
    });

    it('should throw when recording is not deleted', async () => {
      mockRepository.findById.mockResolvedValue(sampleSafeRecording);

      await expect(service.restoreRecording('user-123', 'rec-uuid-123')).rejects.toThrow(
        'Recording is not deleted'
      );
    });
  });

  describe('permanentlyDeleteRecording', () => {
    it('should permanently delete a recording', async () => {
      await service.permanentlyDeleteRecording('user-123', 'rec-uuid-123');

      expect(mockRepository.hardDelete).toHaveBeenCalledWith('rec-uuid-123', 'user-123');
    });

    it('should throw NOT_FOUND when user does not own recording', async () => {
      mockRepository.isOwner.mockResolvedValue(false);

      await expect(service.permanentlyDeleteRecording('user-123', 'nonexistent')).rejects.toThrow(
        RecordingErrors.NOT_FOUND
      );
    });
  });

  describe('exportRecording', () => {
    it('should export recording data', async () => {
      const result = await service.exportRecording('user-123', 'rec-uuid-123');

      expect(result).toEqual(sampleRecordingData);
    });

    it('should throw NOT_FOUND when recording does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.exportRecording('user-123', 'nonexistent')).rejects.toThrow(
        RecordingErrors.NOT_FOUND
      );
    });
  });

  describe('getTags', () => {
    it('should get all tags for a user', async () => {
      const result = await service.getTags('user-123');

      expect(result).toEqual(['smoke', 'login', 'checkout']);
      expect(mockRepository.getTagsByUserId).toHaveBeenCalledWith('user-123');
    });
  });

  describe('getRecordingsByTag', () => {
    it('should get recordings by tag', async () => {
      const result = await service.getRecordingsByTag('user-123', 'smoke');

      expect(result).toHaveLength(1);
      expect(mockRepository.findByTag).toHaveBeenCalledWith('user-123', 'smoke');
    });
  });

  describe('getRecordingCount', () => {
    it('should get recording count for a user', async () => {
      const result = await service.getRecordingCount('user-123');

      expect(result).toBe(5);
      expect(mockRepository.countByUserId).toHaveBeenCalledWith('user-123');
    });
  });

  describe('RecordingError', () => {
    it('should create error with correct properties', () => {
      const error = new RecordingError('Test error', 'TEST_CODE', 500);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('RecordingError');
    });

    it('should default to status 400', () => {
      const error = new RecordingError('Test', 'CODE');

      expect(error.statusCode).toBe(400);
    });
  });

  describe('Predefined Errors', () => {
    it('should have correct NOT_FOUND error', () => {
      expect(RecordingErrors.NOT_FOUND.code).toBe('RECORDING_NOT_FOUND');
      expect(RecordingErrors.NOT_FOUND.statusCode).toBe(404);
    });

    it('should have correct NOT_AUTHORIZED error', () => {
      expect(RecordingErrors.NOT_AUTHORIZED.code).toBe('NOT_AUTHORIZED');
      expect(RecordingErrors.NOT_AUTHORIZED.statusCode).toBe(403);
    });

    it('should have correct TOO_LARGE error', () => {
      expect(RecordingErrors.TOO_LARGE.code).toBe('TOO_LARGE');
      expect(RecordingErrors.TOO_LARGE.statusCode).toBe(413);
    });

    it('should have correct DUPLICATE_ORIGINAL_ID error', () => {
      expect(RecordingErrors.DUPLICATE_ORIGINAL_ID.code).toBe('DUPLICATE_ORIGINAL_ID');
      expect(RecordingErrors.DUPLICATE_ORIGINAL_ID.statusCode).toBe(409);
    });
  });
});
