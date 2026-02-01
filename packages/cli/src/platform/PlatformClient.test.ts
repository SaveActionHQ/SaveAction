import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PlatformClient,
  PlatformError,
  createPlatformClient,
  type PlatformClientConfig,
} from './PlatformClient.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('PlatformClient', () => {
  const validConfig: PlatformClientConfig = {
    apiUrl: 'https://api.saveaction.io',
    apiToken: 'test-token-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client with valid config', () => {
      const client = new PlatformClient(validConfig);
      expect(client.getApiUrl()).toBe('https://api.saveaction.io');
    });

    it('should normalize API URL by removing trailing slash', () => {
      const client = new PlatformClient({
        ...validConfig,
        apiUrl: 'https://api.saveaction.io/',
      });
      expect(client.getApiUrl()).toBe('https://api.saveaction.io');
    });

    it('should throw error if API URL is missing', () => {
      expect(() => new PlatformClient({ apiUrl: '', apiToken: 'token' })).toThrow(PlatformError);
      expect(() => new PlatformClient({ apiUrl: '', apiToken: 'token' })).toThrow(
        'API URL is required'
      );
    });

    it('should throw error if API token is missing', () => {
      expect(() => new PlatformClient({ apiUrl: 'https://api.test.com', apiToken: '' })).toThrow(
        PlatformError
      );
      expect(() => new PlatformClient({ apiUrl: 'https://api.test.com', apiToken: '' })).toThrow(
        'API token is required'
      );
    });
  });

  describe('testConnection', () => {
    it('should return true when health check succeeds', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const client = new PlatformClient(validConfig);
      const result = await client.testConnection();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.saveaction.io/api/health/ready',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-123',
          }),
        })
      );
    });

    it('should throw error when health check fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      const client = new PlatformClient(validConfig);

      await expect(client.testConnection()).rejects.toThrow(PlatformError);

      const error = await client.testConnection().catch((e) => e);
      expect(error.code).toBe('CONNECTION_FAILED');
    });
  });

  describe('fetchRecording', () => {
    const mockRecording = {
      id: 'rec_123',
      testName: 'Test Recording',
      url: 'https://example.com',
      startTime: '2024-01-01T00:00:00.000Z',
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Test Agent',
      actions: [],
      version: '1.0.0',
    };

    it('should fetch recording by ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce(mockRecording),
      });

      const client = new PlatformClient(validConfig);
      const recording = await client.fetchRecording('rec_123');

      expect(recording).toEqual(mockRecording);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.saveaction.io/api/v1/recordings/rec_123/export',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-123',
            Accept: 'application/json',
          }),
        })
      );
    });

    it('should encode recording ID in URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce(mockRecording),
      });

      const client = new PlatformClient(validConfig);
      await client.fetchRecording('rec/with/slashes');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.saveaction.io/api/v1/recordings/rec%2Fwith%2Fslashes/export',
        expect.any(Object)
      );
    });

    it('should throw RECORDING_NOT_FOUND for 404 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const client = new PlatformClient(validConfig);

      await expect(client.fetchRecording('nonexistent')).rejects.toThrow(
        'Recording not found: nonexistent'
      );
    });

    it('should throw UNAUTHORIZED for 401 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const client = new PlatformClient(validConfig);

      const error = await client.fetchRecording('rec_123').catch((e) => e);
      expect(error).toBeInstanceOf(PlatformError);
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.statusCode).toBe(401);
    });

    it('should throw FORBIDDEN for 403 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      const client = new PlatformClient(validConfig);

      const error = await client.fetchRecording('rec_123').catch((e) => e);
      expect(error).toBeInstanceOf(PlatformError);
      expect(error.code).toBe('FORBIDDEN');
    });

    it('should handle server errors with message from response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: vi.fn().mockResolvedValueOnce({ message: 'Database connection failed' }),
      });

      const client = new PlatformClient(validConfig);

      await expect(client.fetchRecording('rec_123')).rejects.toThrow('Database connection failed');
    });
  });

  describe('listRecordings', () => {
    // API returns { success, data: [...], pagination: {...} }
    const mockApiResponse = {
      success: true,
      data: [
        {
          id: 'rec_1',
          name: 'Test 1',
          url: 'https://example.com',
          tags: ['smoke'],
          actionCount: 5,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'rec_2',
          name: 'Test 2',
          url: 'https://example.com',
          tags: ['smoke', 'login'],
          actionCount: 10,
          createdAt: '2024-01-02T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      ],
      pagination: {
        page: 1,
        limit: 100,
        total: 2,
        totalPages: 1,
      },
    };

    // Expected normalized response
    const expectedResult = {
      recordings: mockApiResponse.data,
      pagination: mockApiResponse.pagination,
    };

    it('should list recordings without filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce(mockApiResponse),
      });

      const client = new PlatformClient(validConfig);
      const result = await client.listRecordings();

      expect(result).toEqual(expectedResult);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.saveaction.io/api/v1/recordings?page=1&limit=100',
        expect.any(Object)
      );
    });

    it('should list recordings with tag filter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce(mockApiResponse),
      });

      const client = new PlatformClient(validConfig);
      await client.listRecordings(['smoke', 'login']);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.saveaction.io/api/v1/recordings?page=1&limit=100&tags=smoke%2Clogin',
        expect.any(Object)
      );
    });

    it('should support pagination parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce(mockApiResponse),
      });

      const client = new PlatformClient(validConfig);
      await client.listRecordings(undefined, 2, 50);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.saveaction.io/api/v1/recordings?page=2&limit=50',
        expect.any(Object)
      );
    });

    it('should throw UNAUTHORIZED for 401 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const client = new PlatformClient(validConfig);

      const error = await client.listRecordings().catch((e) => e);
      expect(error).toBeInstanceOf(PlatformError);
      expect(error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('fetchRecordingsByTags', () => {
    it('should fetch all recordings matching tags', async () => {
      // API returns { success, data: [...], pagination }
      const mockApiListResponse = {
        success: true,
        data: [
          {
            id: 'rec_1',
            name: 'Test 1',
            url: '',
            tags: [],
            actionCount: 0,
            createdAt: '',
            updatedAt: '',
          },
          {
            id: 'rec_2',
            name: 'Test 2',
            url: '',
            tags: [],
            actionCount: 0,
            createdAt: '',
            updatedAt: '',
          },
        ],
        pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
      };

      const mockRecording1 = { id: 'rec_1', testName: 'Test 1', actions: [] };
      const mockRecording2 = { id: 'rec_2', testName: 'Test 2', actions: [] };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValueOnce(mockApiListResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValueOnce(mockRecording1),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValueOnce(mockRecording2),
        });

      const client = new PlatformClient(validConfig);
      const recordings = await client.fetchRecordingsByTags(['smoke']);

      expect(recordings).toHaveLength(2);
      expect(recordings[0]).toEqual(mockRecording1);
      expect(recordings[1]).toEqual(mockRecording2);
    });

    it('should return empty array when no recordings match', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce({
          success: true,
          data: [],
          pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
        }),
      });

      const client = new PlatformClient(validConfig);
      const recordings = await client.fetchRecordingsByTags(['nonexistent']);

      expect(recordings).toHaveLength(0);
    });

    it('should throw error if no tags provided', async () => {
      const client = new PlatformClient(validConfig);

      await expect(client.fetchRecordingsByTags([])).rejects.toThrow(
        'At least one tag is required'
      );
    });
  });

  describe('network error handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new TypeError('fetch failed'));

      const client = new PlatformClient(validConfig);

      await expect(client.testConnection()).rejects.toThrow(PlatformError);

      const error = await client.testConnection().catch((e) => e);
      expect(error.message).toContain('Unable to connect to platform');
    });

    it('should rethrow non-network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Something unexpected'));

      const client = new PlatformClient(validConfig);

      await expect(client.testConnection()).rejects.toThrow('Something unexpected');
    });
  });
});

describe('createPlatformClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should create client with explicit parameters', () => {
    const client = createPlatformClient('https://api.test.com', 'explicit-token');
    expect(client.getApiUrl()).toBe('https://api.test.com');
  });

  it('should use environment variables as fallback', () => {
    process.env.SAVEACTION_API_URL = 'https://env.api.com';
    process.env.SAVEACTION_API_TOKEN = 'env-token';

    const client = createPlatformClient();
    expect(client.getApiUrl()).toBe('https://env.api.com');
  });

  it('should prefer explicit parameters over environment variables', () => {
    process.env.SAVEACTION_API_URL = 'https://env.api.com';
    process.env.SAVEACTION_API_TOKEN = 'env-token';

    const client = createPlatformClient('https://explicit.api.com', 'explicit-token');
    expect(client.getApiUrl()).toBe('https://explicit.api.com');
  });

  it('should throw error if API URL is not provided', () => {
    delete process.env.SAVEACTION_API_URL;
    delete process.env.SAVEACTION_API_TOKEN;

    expect(() => createPlatformClient(undefined, 'token')).toThrow('Platform API URL is required');
  });

  it('should throw error if API token is not provided', () => {
    delete process.env.SAVEACTION_API_URL;
    delete process.env.SAVEACTION_API_TOKEN;

    expect(() => createPlatformClient('https://api.test.com', undefined)).toThrow(
      'Platform API token is required'
    );
  });
});

describe('PlatformError', () => {
  it('should create error with message only', () => {
    const error = new PlatformError('Test error');
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('PlatformError');
    expect(error.statusCode).toBeUndefined();
    expect(error.code).toBeUndefined();
  });

  it('should create error with status code', () => {
    const error = new PlatformError('Not found', 404);
    expect(error.statusCode).toBe(404);
  });

  it('should create error with code', () => {
    const error = new PlatformError('Not found', 404, 'NOT_FOUND');
    expect(error.code).toBe('NOT_FOUND');
  });
});
