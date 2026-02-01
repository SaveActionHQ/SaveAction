/**
 * SaveAction API Client
 *
 * Type-safe API client for communicating with the SaveAction backend.
 * Handles authentication, token refresh, and error handling.
 */

// API Types
export interface User {
  id: string;
  email: string;
  name: string | null;
  emailVerifiedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: User;
  tokens: Tokens;
}

// Internal API response wrapper
interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId?: string;
  };
}

type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId?: string;
  };
}

// Recording as returned from list endpoint (without full data)
export interface RecordingListItem {
  id: string;
  name: string;
  description?: string;
  originalId: string;
  url: string;
  actionCount: number;
  tags: string[];
  estimatedDurationMs?: number;
  schemaVersion?: string;
  dataSizeBytes?: number;
  createdAt: string;
  updatedAt: string;
}

// Full recording with data (returned from get single recording)
export interface Recording extends RecordingListItem {
  userId: string;
  data: RecordingData;
}

export interface RecordingData {
  id: string;
  testName: string;
  url: string;
  startTime: string;
  viewport: { width: number; height: number };
  userAgent: string;
  actions: unknown[];
  version: string;
}

export interface Run {
  id: string;
  userId: string;
  recordingId: string;
  recordingName?: string;
  status: 'queued' | 'running' | 'passed' | 'failed' | 'cancelled';
  browser: 'chromium' | 'firefox' | 'webkit';
  headless: boolean;
  videoEnabled: boolean;
  videoPath?: string;
  duration?: number;
  durationMs?: number;
  actionsTotal?: number;
  actionsExecuted?: number;
  actionsFailed?: number;
  actionsSkipped?: number;
  errorMessage?: string;
  errorActionId?: string;
  triggeredBy?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface RunAction {
  id: string;
  actionId: string;
  actionType: string;
  actionIndex: number;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  durationMs?: number;
  startedAt?: string;
  completedAt?: string;
  selectorUsed?: string;
  selectorValue?: string;
  retryCount?: number;
  errorMessage?: string;
  screenshotPath?: string;
  elementFound?: boolean;
  elementTagName?: string;
  pageUrl?: string;
  pageTitle?: string;
}

export interface Schedule {
  id: string;
  userId: string;
  recordingId: string;
  name: string;
  cronExpression: string;
  timezone: string;
  status: 'active' | 'paused';
  browser: 'chromium' | 'firefox' | 'webkit';
  headless: boolean;
  runCount: number;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext?: boolean;
    hasPrevious?: boolean;
  };
}

// API Client Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiClient {
  private accessToken: string | null = null;
  private refreshPromise: Promise<string | null> | null = null;

  constructor() {
    // Initialize token from localStorage on client side
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('accessToken');
    }
  }

  /**
   * Set the access token for authenticated requests
   */
  setAccessToken(token: string | null): void {
    this.accessToken = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('accessToken', token);
      } else {
        localStorage.removeItem('accessToken');
      }
    }
  }

  /**
   * Get the current access token
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  /**
   * Make an API request with automatic token refresh
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.accessToken) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Include cookies for refresh token
    });

    // Handle 401 - try to refresh token
    if (response.status === 401 && this.accessToken) {
      const newToken = await this.refreshAccessToken();
      if (newToken) {
        // Retry the request with new token
        (headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
        const retryResponse = await fetch(url, {
          ...options,
          headers,
          credentials: 'include',
        });

        if (!retryResponse.ok) {
          const errorData = await retryResponse.json();
          if (errorData.error) {
            throw new ApiClientError(errorData.error);
          }
          throw new ApiClientError({ code: 'UNKNOWN_ERROR', message: 'Request failed' });
        }

        const result = (await retryResponse.json()) as ApiResponse<T>;
        if (result.success === false) {
          throw new ApiClientError(result.error);
        }
        return result.data;
      } else {
        // Refresh failed, clear token and throw
        this.setAccessToken(null);
        throw new ApiClientError({
          code: 'SESSION_EXPIRED',
          message: 'Session expired. Please login again.',
        });
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: { code: 'UNKNOWN_ERROR', message: 'Request failed' },
      }));
      if (errorData.error) {
        throw new ApiClientError(errorData.error);
      }
      throw new ApiClientError({ code: 'UNKNOWN_ERROR', message: 'Request failed' });
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    const result = await response.json();

    // Handle wrapped API response { success: true/false, data/error }
    if (typeof result === 'object' && result !== null && 'success' in result) {
      if (result.success === false) {
        throw new ApiClientError(result.error);
      }

      // Check if this is a paginated response (has pagination at top level)
      if ('pagination' in result && Array.isArray(result.data)) {
        // Return as PaginatedResponse structure
        return {
          data: result.data,
          pagination: result.pagination,
        } as T;
      }

      return result.data as T;
    }

    // Return raw result if not wrapped (for backwards compatibility)
    return result as T;
  }

  /**
   * Refresh the access token using the refresh token cookie
   */
  private async refreshAccessToken(): Promise<string | null> {
    // Prevent multiple simultaneous refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          return null;
        }

        const result = (await response.json()) as ApiResponse<{ tokens: Tokens }>;
        if (result.success && result.data?.tokens?.accessToken) {
          this.setAccessToken(result.data.tokens.accessToken);
          return result.data.tokens.accessToken;
        }
        return null;
      } catch {
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  // =====================
  // Authentication API
  // =====================

  /**
   * Register a new user
   */
  async register(data: { name: string; email: string; password: string }): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    // Token is already set in cookie by server, also store accessToken for API calls
    this.setAccessToken(response.tokens.accessToken);
    return response;
  }

  /**
   * Login with email and password
   */
  async login(data: { email: string; password: string }): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    // Token is already set in cookie by server, also store accessToken for API calls
    this.setAccessToken(response.tokens.accessToken);
    return response;
  }

  /**
   * Logout the current user
   */
  async logout(): Promise<void> {
    try {
      await this.request<void>('/api/v1/auth/logout', {
        method: 'POST',
      });
    } finally {
      this.setAccessToken(null);
    }
  }

  /**
   * Get the current authenticated user
   */
  async getCurrentUser(): Promise<User> {
    const response = await this.request<{ user: User }>('/api/v1/auth/me');
    return response.user;
  }

  /**
   * Change password
   */
  async changePassword(data: { currentPassword: string; newPassword: string }): Promise<void> {
    return this.request<void>('/api/v1/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Request password reset
   */
  async forgotPassword(email: string): Promise<void> {
    return this.request<void>('/api/v1/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  /**
   * Reset password with token
   */
  async resetPassword(data: { token: string; password: string }): Promise<void> {
    return this.request<void>('/api/v1/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // =====================
  // Recordings API
  // =====================

  /**
   * List recordings with pagination and filtering
   */
  async listRecordings(params?: {
    page?: number;
    limit?: number;
    search?: string;
    tags?: string[];
    sortBy?: 'createdAt' | 'updatedAt' | 'name';
    sortOrder?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<RecordingListItem>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.search) searchParams.set('search', params.search);
    if (params?.tags?.length) searchParams.set('tags', params.tags.join(','));
    if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
    if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder);

    const query = searchParams.toString();
    return this.request<PaginatedResponse<RecordingListItem>>(
      `/api/v1/recordings${query ? `?${query}` : ''}`
    );
  }

  /**
   * Get a single recording by ID
   */
  async getRecording(id: string): Promise<Recording> {
    return this.request<Recording>(`/api/v1/recordings/${id}`);
  }

  /**
   * Create a new recording
   */
  async createRecording(data: {
    name: string;
    description?: string;
    tags?: string[];
    data: RecordingData;
  }): Promise<Recording> {
    return this.request<Recording>('/api/v1/recordings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update a recording
   */
  async updateRecording(
    id: string,
    data: {
      name?: string;
      description?: string;
      tags?: string[];
    }
  ): Promise<Recording> {
    return this.request<Recording>(`/api/v1/recordings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete a recording (soft delete)
   */
  async deleteRecording(id: string): Promise<void> {
    return this.request<void>(`/api/v1/recordings/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get all tags used by the user
   */
  async getRecordingTags(): Promise<string[]> {
    const response = await this.request<{ tags: string[] }>('/api/v1/recordings/tags');
    return response.tags;
  }

  // =====================
  // Runs API
  // =====================

  /**
   * List runs with pagination and filtering
   */
  async listRuns(params?: {
    page?: number;
    limit?: number;
    recordingId?: string;
    status?: Run['status'];
  }): Promise<PaginatedResponse<Run>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.recordingId) searchParams.set('recordingId', params.recordingId);
    if (params?.status) searchParams.set('status', params.status);

    const query = searchParams.toString();
    return this.request<PaginatedResponse<Run>>(`/api/v1/runs${query ? `?${query}` : ''}`);
  }

  /**
   * Get a single run by ID
   */
  async getRun(id: string): Promise<Run> {
    return this.request<Run>(`/api/v1/runs/${id}`);
  }

  /**
   * Create a new run (execute a recording)
   */
  async createRun(data: {
    recordingId: string;
    browser?: 'chromium' | 'firefox' | 'webkit';
    headless?: boolean;
    videoEnabled?: boolean;
  }): Promise<Run> {
    return this.request<Run>('/api/v1/runs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Cancel a running or queued run
   */
  async cancelRun(id: string): Promise<Run> {
    return this.request<Run>(`/api/v1/runs/${id}/cancel`, {
      method: 'POST',
    });
  }

  /**
   * Retry a failed run
   */
  async retryRun(id: string): Promise<Run> {
    return this.request<Run>(`/api/v1/runs/${id}/retry`, {
      method: 'POST',
    });
  }

  /**
   * Delete a run
   */
  async deleteRun(id: string): Promise<void> {
    return this.request<void>(`/api/v1/runs/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get action results for a run
   */
  async getRunActions(id: string): Promise<RunAction[]> {
    const response = await this.request<RunAction[]>(`/api/v1/runs/${id}/actions`);
    return response;
  }

  // =====================
  // Schedules API
  // =====================

  /**
   * List schedules with pagination
   */
  async listSchedules(params?: {
    page?: number;
    limit?: number;
    recordingId?: string;
    status?: Schedule['status'];
  }): Promise<PaginatedResponse<Schedule>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.recordingId) searchParams.set('recordingId', params.recordingId);
    if (params?.status) searchParams.set('status', params.status);

    const query = searchParams.toString();
    return this.request<PaginatedResponse<Schedule>>(
      `/api/v1/schedules${query ? `?${query}` : ''}`
    );
  }

  /**
   * Get a single schedule by ID
   */
  async getSchedule(id: string): Promise<Schedule> {
    return this.request<Schedule>(`/api/v1/schedules/${id}`);
  }

  /**
   * Create a new schedule
   */
  async createSchedule(data: {
    recordingId: string;
    name: string;
    cronExpression: string;
    timezone?: string;
    browser?: 'chromium' | 'firefox' | 'webkit';
    headless?: boolean;
  }): Promise<Schedule> {
    return this.request<Schedule>('/api/v1/schedules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update a schedule
   */
  async updateSchedule(
    id: string,
    data: {
      name?: string;
      cronExpression?: string;
      timezone?: string;
      browser?: 'chromium' | 'firefox' | 'webkit';
      headless?: boolean;
    }
  ): Promise<Schedule> {
    return this.request<Schedule>(`/api/v1/schedules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Toggle schedule status (active/paused)
   */
  async toggleSchedule(id: string): Promise<Schedule> {
    return this.request<Schedule>(`/api/v1/schedules/${id}/toggle`, {
      method: 'POST',
    });
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(id: string): Promise<void> {
    return this.request<void>(`/api/v1/schedules/${id}`, {
      method: 'DELETE',
    });
  }
}

/**
 * Custom error class for API errors
 */
export class ApiClientError extends Error {
  code: string;
  details?: Record<string, unknown>;
  requestId?: string;

  constructor(error: ApiError['error']) {
    super(error.message);
    this.name = 'ApiClientError';
    this.code = error.code;
    this.details = error.details;
    this.requestId = error.requestId;
  }
}

// Export singleton instance
export const api = new ApiClient();
