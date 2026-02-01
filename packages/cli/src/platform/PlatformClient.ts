/**
 * SaveAction Platform API Client
 *
 * Provides methods to interact with the SaveAction API for fetching recordings.
 * Used by CLI commands when running tests from the platform instead of local files.
 */

import type { Recording } from '@saveaction/core';

/**
 * Configuration for the platform client
 */
export interface PlatformClientConfig {
  /** Base URL of the SaveAction API (e.g., https://api.saveaction.io) */
  apiUrl: string;
  /** API token for authentication */
  apiToken: string;
}

/**
 * Recording summary returned from list endpoint
 */
export interface RecordingSummary {
  id: string;
  name: string;
  url: string;
  tags: string[];
  actionCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Response from list recordings endpoint
 */
export interface ListRecordingsResponse {
  recordings: RecordingSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Error thrown when platform API operations fail
 */
export class PlatformError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'PlatformError';
  }
}

/**
 * Client for interacting with the SaveAction Platform API
 */
export class PlatformClient {
  private readonly config: PlatformClientConfig;

  constructor(config: PlatformClientConfig) {
    if (!config.apiUrl) {
      throw new PlatformError('API URL is required', undefined, 'MISSING_API_URL');
    }
    if (!config.apiToken) {
      throw new PlatformError('API token is required', undefined, 'MISSING_API_TOKEN');
    }

    // Normalize API URL (remove trailing slash)
    this.config = {
      ...config,
      apiUrl: config.apiUrl.replace(/\/+$/, ''),
    };
  }

  /**
   * Get the configured API URL
   */
  getApiUrl(): string {
    return this.config.apiUrl;
  }

  /**
   * Test connection to the platform API
   * @returns True if connection is successful
   * @throws PlatformError if connection fails
   */
  async testConnection(): Promise<boolean> {
    const response = await this.makeRequest('/api/health/ready', 'GET');

    if (!response.ok) {
      throw new PlatformError(
        `Failed to connect to platform: ${response.status} ${response.statusText}`,
        response.status,
        'CONNECTION_FAILED'
      );
    }

    return true;
  }

  /**
   * Fetch a recording by ID from the platform
   * @param recordingId The recording ID to fetch
   * @returns The recording data
   * @throws PlatformError if recording not found or fetch fails
   */
  async fetchRecording(recordingId: string): Promise<Recording> {
    const response = await this.makeRequest(
      `/api/v1/recordings/${encodeURIComponent(recordingId)}/export`,
      'GET'
    );

    if (response.status === 404) {
      throw new PlatformError(`Recording not found: ${recordingId}`, 404, 'RECORDING_NOT_FOUND');
    }

    if (response.status === 401) {
      throw new PlatformError('Invalid or expired API token', 401, 'UNAUTHORIZED');
    }

    if (response.status === 403) {
      throw new PlatformError('Access denied to this recording', 403, 'FORBIDDEN');
    }

    if (!response.ok) {
      const errorBody = await this.tryParseJson(response);
      const message =
        (errorBody?.message as string) || `Failed to fetch recording: ${response.status}`;
      throw new PlatformError(message, response.status, 'FETCH_FAILED');
    }

    const recording = await response.json();
    return recording as Recording;
  }

  /**
   * List recordings with optional tag filter
   * @param tags Optional array of tags to filter by
   * @param page Page number (1-based)
   * @param limit Number of results per page
   * @returns List of recording summaries with pagination info
   */
  async listRecordings(
    tags?: string[],
    page: number = 1,
    limit: number = 100
  ): Promise<ListRecordingsResponse> {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));

    if (tags && tags.length > 0) {
      params.set('tags', tags.join(','));
    }

    const response = await this.makeRequest(`/api/v1/recordings?${params.toString()}`, 'GET');

    if (response.status === 401) {
      throw new PlatformError('Invalid or expired API token', 401, 'UNAUTHORIZED');
    }

    if (!response.ok) {
      const errorBody = await this.tryParseJson(response);
      const message =
        (errorBody?.message as string) || `Failed to list recordings: ${response.status}`;
      throw new PlatformError(message, response.status, 'LIST_FAILED');
    }

    const responseData = (await response.json()) as {
      data?: RecordingSummary[];
      pagination?: ListRecordingsResponse['pagination'];
    };

    // API returns { success, data: [...], pagination: {...} }
    // Normalize to our expected format
    return {
      recordings: responseData.data || [],
      pagination: responseData.pagination || {
        page: 1,
        limit: 100,
        total: 0,
        totalPages: 0,
      },
    };
  }

  /**
   * Fetch all recordings matching the given tags
   * @param tags Array of tags to filter by
   * @returns Array of recordings
   */
  async fetchRecordingsByTags(tags: string[]): Promise<Recording[]> {
    if (tags.length === 0) {
      throw new PlatformError('At least one tag is required', undefined, 'MISSING_TAGS');
    }

    // First, list recordings with the tags
    const listResponse = await this.listRecordings(tags, 1, 100);

    if (listResponse.recordings.length === 0) {
      return [];
    }

    // Then fetch each recording
    const recordings: Recording[] = [];
    for (const summary of listResponse.recordings) {
      const recording = await this.fetchRecording(summary.id);
      recordings.push(recording);
    }

    return recordings;
  }

  /**
   * Make an authenticated request to the platform API
   */
  private async makeRequest(path: string, method: string): Promise<Response> {
    const url = `${this.config.apiUrl}${path}`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.config.apiToken}`,
          Accept: 'application/json',
          'User-Agent': 'SaveAction-CLI/0.1.0',
        },
      });

      return response;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new PlatformError(
          `Unable to connect to platform at ${this.config.apiUrl}. Is the server running?`,
          undefined,
          'NETWORK_ERROR'
        );
      }
      throw error;
    }
  }

  /**
   * Try to parse JSON from response, return null if it fails
   */
  private async tryParseJson(response: Response): Promise<Record<string, unknown> | null> {
    try {
      return (await response.json()) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

/**
 * Create a platform client from environment variables or explicit config
 *
 * @param apiUrl Optional API URL (falls back to SAVEACTION_API_URL env var)
 * @param apiToken Optional API token (falls back to SAVEACTION_API_TOKEN env var)
 * @returns Configured PlatformClient
 * @throws PlatformError if required config is missing
 */
export function createPlatformClient(apiUrl?: string, apiToken?: string): PlatformClient {
  const resolvedApiUrl = apiUrl || process.env.SAVEACTION_API_URL;
  const resolvedApiToken = apiToken || process.env.SAVEACTION_API_TOKEN;

  if (!resolvedApiUrl) {
    throw new PlatformError(
      'Platform API URL is required. Use --api-url or set SAVEACTION_API_URL environment variable.',
      undefined,
      'MISSING_API_URL'
    );
  }

  if (!resolvedApiToken) {
    throw new PlatformError(
      'Platform API token is required. Use --api-token or set SAVEACTION_API_TOKEN environment variable.',
      undefined,
      'MISSING_API_TOKEN'
    );
  }

  return new PlatformClient({
    apiUrl: resolvedApiUrl,
    apiToken: resolvedApiToken,
  });
}
