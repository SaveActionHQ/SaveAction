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
  scheduleId?: string;
  scheduleName?: string;
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
  userId?: string;
  recordingId: string;
  name: string;
  cronExpression: string;
  timezone: string;
  status: 'active' | 'paused';
  browser?: 'chromium' | 'firefox' | 'webkit';
  headless?: boolean;
  recordVideo?: boolean;
  screenshotMode?: 'on-failure' | 'always' | 'never';
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  lastRunAt?: string;
  lastRunStatus?: string | null;
  nextRunAt?: string;
  createdAt: string;
  updatedAt?: string;
}

// API Token Types
export const API_TOKEN_SCOPES = [
  'recordings:read',
  'recordings:write',
  'runs:read',
  'runs:execute',
  'schedules:read',
  'schedules:write',
  'webhooks:read',
  'webhooks:write',
] as const;

export type ApiTokenScope = (typeof API_TOKEN_SCOPES)[number];

export interface ApiToken {
  id: string;
  name: string;
  tokenPrefix: string;
  tokenSuffix: string;
  scopes: string[];
  lastUsedAt?: string | null;
  useCount: number;
  expiresAt?: string | null;
  revokedAt?: string | null;
  revokedReason?: string | null;
  createdAt: string;
}

export interface CreateTokenResponse {
  id: string;
  name: string;
  token: string; // Full token - only shown once on creation
  tokenPrefix: string;
  tokenSuffix: string;
  scopes: string[];
  expiresAt?: string | null;
  createdAt: string;
}

// Dashboard Types
export interface DashboardStats {
  recordings: {
    total: number;
  };
  runs: {
    total: number;
    passed: number;
    failed: number;
    cancelled: number;
    queued: number;
    running: number;
    passRate: number;
  };
  schedules: {
    total: number;
    active: number;
    paused: number;
  };
}

export interface DashboardRecentRun {
  id: string;
  recordingName: string;
  recordingUrl: string;
  status: string;
  browser: string;
  durationMs: number | null;
  createdAt: string;
  completedAt: string | null;
}

export interface DashboardUpcomingSchedule {
  id: string;
  name: string;
  recordingId: string;
  recordingName: string;
  cronExpression: string;
  nextRunAt: string | null;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
}

export interface DashboardData {
  stats: DashboardStats;
  recentRuns: DashboardRecentRun[];
  upcomingSchedules: DashboardUpcomingSchedule[];
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

// Session expired callback type
type SessionExpiredCallback = () => void;

class ApiClient {
  private accessToken: string | null = null;
  private refreshPromise: Promise<string | null> | null = null;
  private sessionExpiredCallbacks: Set<SessionExpiredCallback> = new Set();

  constructor() {
    // Initialize token from localStorage on client side
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('accessToken');
    }
  }

  /**
   * Subscribe to session expired events
   * Returns an unsubscribe function
   */
  onSessionExpired(callback: SessionExpiredCallback): () => void {
    this.sessionExpiredCallbacks.add(callback);
    return () => {
      this.sessionExpiredCallbacks.delete(callback);
    };
  }

  /**
   * Notify all listeners that session has expired
   */
  private notifySessionExpired(): void {
    this.sessionExpiredCallbacks.forEach((callback) => {
      try {
        callback();
      } catch {
        // Ignore callback errors
      }
    });
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
      ...options.headers,
    };

    // Only set Content-Type for requests with a body
    if (options.body) {
      (headers as Record<string, string>)['Content-Type'] = 'application/json';
    }

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
        // Refresh failed, clear token and notify listeners
        this.setAccessToken(null);
        this.notifySessionExpired();
        // Return a promise that never resolves - the session expiry handler will redirect
        // This prevents the error from bubbling up to the page component
        return new Promise<T>(() => {});
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
    scheduleId?: string;
    status?: Run['status'];
  }): Promise<PaginatedResponse<Run>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.recordingId) searchParams.set('recordingId', params.recordingId);
    if (params?.scheduleId) searchParams.set('scheduleId', params.scheduleId);
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
    screenshotEnabled?: boolean;
    screenshotMode?: 'on-failure' | 'always' | 'never';
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
    recordVideo?: boolean;
    screenshotMode?: 'on-failure' | 'always' | 'never';
  }): Promise<Schedule> {
    // Backend expects browser/video/screenshot inside runConfig
    const { browser, recordVideo, screenshotMode, ...rest } = data;
    const payload: Record<string, unknown> = { ...rest };
    if (browser !== undefined || recordVideo !== undefined || screenshotMode !== undefined) {
      payload.runConfig = {
        ...(browser !== undefined && { browser }),
        ...(recordVideo !== undefined && { recordVideo }),
        ...(screenshotMode !== undefined && { screenshotMode }),
      };
    }
    return this.request<Schedule>('/api/v1/schedules', {
      method: 'POST',
      body: JSON.stringify(payload),
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
      recordVideo?: boolean;
      screenshotMode?: 'on-failure' | 'always' | 'never';
    }
  ): Promise<Schedule> {
    // Backend expects browser/video/screenshot inside runConfig
    const { browser, recordVideo, screenshotMode, ...rest } = data;
    const payload: Record<string, unknown> = { ...rest };
    if (browser !== undefined || recordVideo !== undefined || screenshotMode !== undefined) {
      payload.runConfig = {
        ...(browser !== undefined && { browser }),
        ...(recordVideo !== undefined && { recordVideo }),
        ...(screenshotMode !== undefined && { screenshotMode }),
      };
    }
    return this.request<Schedule>(`/api/v1/schedules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Toggle schedule status (active/paused)
   */
  async toggleSchedule(
    id: string
  ): Promise<{ id: string; status: Schedule['status']; nextRunAt: string | null }> {
    return this.request<{ id: string; status: Schedule['status']; nextRunAt: string | null }>(
      `/api/v1/schedules/${id}/toggle`,
      {
        method: 'POST',
      }
    );
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(id: string): Promise<void> {
    return this.request<void>(`/api/v1/schedules/${id}`, {
      method: 'DELETE',
    });
  }

  // =====================
  // API Tokens API
  // =====================

  /**
   * List API tokens
   */
  async listApiTokens(active?: boolean): Promise<{ tokens: ApiToken[]; total: number }> {
    const query = active !== undefined ? `?active=${active}` : '';
    return this.request<{ tokens: ApiToken[]; total: number }>(`/api/v1/tokens${query}`);
  }

  /**
   * Get a single API token
   */
  async getApiToken(id: string): Promise<ApiToken> {
    return this.request<ApiToken>(`/api/v1/tokens/${id}`);
  }

  /**
   * Create a new API token
   */
  async createApiToken(data: {
    name: string;
    scopes: string[];
    expiresAt?: string | null;
  }): Promise<CreateTokenResponse> {
    return this.request<CreateTokenResponse>('/api/v1/tokens', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Revoke an API token
   */
  async revokeApiToken(id: string, reason?: string): Promise<void> {
    return this.request<void>(`/api/v1/tokens/${id}/revoke`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  /**
   * Delete an API token
   */
  async deleteApiToken(id: string): Promise<void> {
    return this.request<void>(`/api/v1/tokens/${id}`, {
      method: 'DELETE',
    });
  }

  // =====================
  // Dashboard API
  // =====================

  /**
   * Get dashboard data (stats, recent runs, upcoming schedules)
   */
  async getDashboard(): Promise<DashboardData> {
    return this.request<DashboardData>('/api/v1/dashboard');
  }

  /**
   * Get dashboard statistics only
   */
  async getDashboardStats(): Promise<DashboardStats> {
    return this.request<DashboardStats>('/api/v1/dashboard/stats');
  }

  // =====================
  // User Profile API
  // =====================

  /**
   * Update user profile
   */
  async updateProfile(data: { name?: string }): Promise<User> {
    return this.request<User>('/api/v1/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
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
