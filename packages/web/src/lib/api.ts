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
  projectId: string;
  recordingId: string;
  recordingName?: string;
  recordingUrl?: string;
  runType?: 'test' | 'suite' | 'project' | 'recording';
  testId?: string;
  testName?: string;
  suiteId?: string;
  parentRunId?: string;
  status: 'queued' | 'running' | 'passed' | 'failed' | 'cancelled';
  browser: 'chromium' | 'firefox' | 'webkit';
  browsers?: string[] | null;
  headless: boolean;
  videoEnabled: boolean;
  videoPath?: string;
  screenshotEnabled?: boolean;
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

export type RunStatus = Run['status'];
export type BrowserType = Run['browser'];

export interface RunBrowserResult {
  id: string;
  runId: string;
  testId: string;
  browser: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled' | 'skipped';
  durationMs?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
  actionsTotal?: number | null;
  actionsExecuted?: number | null;
  actionsFailed?: number | null;
  actionsSkipped?: number | null;
  errorMessage?: string | null;
  errorStack?: string | null;
  errorActionId?: string | null;
  videoPath?: string | null;
  screenshotPath?: string | null;
  createdAt: string;
}

export interface RunAction {
  id: string;
  actionId: string;
  actionType: string;
  actionIndex: number;
  browser?: string;
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
  targetType: 'test' | 'suite' | 'recording';
  testId?: string | null;
  suiteId?: string | null;
  recordingId?: string | null;
  name: string;
  cronExpression: string;
  timezone: string;
  status: 'active' | 'paused';
  browser?: 'chromium' | 'firefox' | 'webkit';
  browsers?: ('chromium' | 'firefox' | 'webkit')[];
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

// Project Types
export interface Project {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  color?: string;
}

// Test Suite Types
export interface TestSuite {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  description?: string | null;
  displayOrder: number;
  isDefault: boolean;
  testCount?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface TestSuiteWithStats extends TestSuite {
  testCount: number;
  lastRunAt?: string | null;
  passRate?: number | null;
}

export interface CreateTestSuiteRequest {
  name: string;
  description?: string;
}

export interface UpdateTestSuiteRequest {
  name?: string;
  description?: string;
}

// Test Types
export type TestBrowser = 'chromium' | 'firefox' | 'webkit';

export interface TestConfig {
  headless: boolean;
  video: boolean;
  screenshot: 'on' | 'off' | 'only-on-failure';
  timeout: number;
  retries: number;
  slowMo: number;
  viewport?: {
    width: number;
    height: number;
  };
}

export interface Test {
  id: string;
  projectId: string;
  suiteId: string;
  name: string;
  slug: string;
  description?: string | null;
  recordingId?: string | null;
  recordingUrl?: string | null;
  recordingData?: Record<string, unknown> | null;
  actionCount: number;
  browsers: TestBrowser[];
  config: TestConfig;
  status: 'active' | 'inactive' | 'archived';
  displayOrder: number;
  lastRunAt?: string | null;
  lastRunStatus?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface CreateTestRequest {
  name: string;
  suiteId?: string;
  description?: string;
  recordingId?: string;
  recordingData: Record<string, unknown>;
  recordingUrl?: string;
  actionCount?: number;
  browsers?: TestBrowser[];
  config?: Partial<TestConfig>;
}

export interface UpdateTestRequest {
  name?: string;
  description?: string;
  recordingId?: string | null;
  recordingData?: Record<string, unknown>;
  recordingUrl?: string;
  actionCount?: number;
  browsers?: TestBrowser[];
  config?: Partial<TestConfig>;
  status?: 'active' | 'inactive' | 'archived';
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
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
  // Projects API
  // =====================

  /**
   * List user's projects
   */
  async listProjects(params?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Project>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());

    const query = searchParams.toString();
    return this.request<PaginatedResponse<Project>>(`/api/v1/projects${query ? `?${query}` : ''}`);
  }

  /**
   * Get a single project by ID
   */
  async getProject(id: string): Promise<Project> {
    return this.request<Project>(`/api/v1/projects/${id}`);
  }

  /**
   * Create a new project
   */
  async createProject(data: CreateProjectRequest): Promise<Project> {
    return this.request<Project>('/api/v1/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update a project
   */
  async updateProject(id: string, data: UpdateProjectRequest): Promise<Project> {
    return this.request<Project>(`/api/v1/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete a project
   */
  async deleteProject(id: string): Promise<void> {
    return this.request<void>(`/api/v1/projects/${id}`, {
      method: 'DELETE',
    });
  }

  // =====================
  // Test Suites API
  // =====================

  /**
   * List test suites for a project
   */
  async listSuites(
    projectId: string,
    params?: {
      page?: number;
      limit?: number;
      search?: string;
      sortBy?: 'name' | 'displayOrder' | 'createdAt';
      sortOrder?: 'asc' | 'desc';
    }
  ): Promise<PaginatedResponse<TestSuite>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.search) searchParams.set('search', params.search);
    if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
    if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder);

    const query = searchParams.toString();
    return this.request<PaginatedResponse<TestSuite>>(
      `/api/v1/projects/${projectId}/suites${query ? `?${query}` : ''}`
    );
  }

  /**
   * List all suites with stats (no pagination)
   */
  async listAllSuites(projectId: string): Promise<TestSuiteWithStats[]> {
    return this.request<TestSuiteWithStats[]>(`/api/v1/projects/${projectId}/suites/all`);
  }

  /**
   * Get a single test suite
   */
  async getSuite(projectId: string, suiteId: string): Promise<TestSuite> {
    return this.request<TestSuite>(`/api/v1/projects/${projectId}/suites/${suiteId}`);
  }

  /**
   * Create a new test suite
   */
  async createSuite(projectId: string, data: CreateTestSuiteRequest): Promise<TestSuite> {
    return this.request<TestSuite>(`/api/v1/projects/${projectId}/suites`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update a test suite
   */
  async updateSuite(
    projectId: string,
    suiteId: string,
    data: UpdateTestSuiteRequest
  ): Promise<TestSuite> {
    return this.request<TestSuite>(`/api/v1/projects/${projectId}/suites/${suiteId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete a test suite
   */
  async deleteSuite(projectId: string, suiteId: string): Promise<void> {
    return this.request<void>(`/api/v1/projects/${projectId}/suites/${suiteId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Reorder suites within a project
   */
  async reorderSuites(projectId: string, suiteIds: string[]): Promise<void> {
    return this.request<void>(`/api/v1/projects/${projectId}/suites/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ suiteIds }),
    });
  }

  // =====================
  // Tests API
  // =====================

  /**
   * List tests for a project, optionally filtered by suite
   */
  async listTests(
    projectId: string,
    params?: {
      suiteId?: string;
      page?: number;
      limit?: number;
      search?: string;
      status?: 'active' | 'inactive' | 'archived';
      sortBy?: 'name' | 'displayOrder' | 'createdAt' | 'lastRunAt';
      sortOrder?: 'asc' | 'desc';
    }
  ): Promise<PaginatedResponse<Test>> {
    const searchParams = new URLSearchParams();
    if (params?.suiteId) searchParams.set('suiteId', params.suiteId);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.search) searchParams.set('search', params.search);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
    if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder);

    const query = searchParams.toString();
    return this.request<PaginatedResponse<Test>>(
      `/api/v1/projects/${projectId}/tests${query ? `?${query}` : ''}`
    );
  }

  /**
   * Get a single test
   */
  async getTest(projectId: string, testId: string): Promise<Test> {
    return this.request<Test>(`/api/v1/projects/${projectId}/tests/${testId}`);
  }

  /**
   * Create a new test
   */
  async createTest(projectId: string, data: CreateTestRequest): Promise<Test> {
    return this.request<Test>(`/api/v1/projects/${projectId}/tests`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update a test
   */
  async updateTest(projectId: string, testId: string, data: UpdateTestRequest): Promise<Test> {
    return this.request<Test>(`/api/v1/projects/${projectId}/tests/${testId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete a test
   */
  async deleteTest(projectId: string, testId: string): Promise<void> {
    return this.request<void>(`/api/v1/projects/${projectId}/tests/${testId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Move tests to a different suite
   */
  async moveTests(projectId: string, testIds: string[], targetSuiteId: string): Promise<void> {
    return this.request<void>(`/api/v1/projects/${projectId}/tests/move`, {
      method: 'PUT',
      body: JSON.stringify({ testIds, targetSuiteId }),
    });
  }

  /**
   * Reorder tests within a suite
   */
  async reorderTests(projectId: string, suiteId: string, testIds: string[]): Promise<void> {
    return this.request<void>(`/api/v1/projects/${projectId}/tests/suites/${suiteId}/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ testIds }),
    });
  }

  // =====================
  // Recordings API
  // =====================

  /**
   * List recordings with pagination and filtering
   * projectId is REQUIRED
   */
  async listRecordings(params: {
    projectId: string;
    page?: number;
    limit?: number;
    search?: string;
    tags?: string[];
    sortBy?: 'createdAt' | 'updatedAt' | 'name';
    sortOrder?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<RecordingListItem>> {
    const searchParams = new URLSearchParams();
    searchParams.set('projectId', params.projectId);
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.search) searchParams.set('search', params.search);
    if (params.tags?.length) searchParams.set('tags', params.tags.join(','));
    if (params.sortBy) searchParams.set('sortBy', params.sortBy);
    if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);

    return this.request<PaginatedResponse<RecordingListItem>>(
      `/api/v1/recordings?${searchParams.toString()}`
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
    projectId: string;
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
   * projectId is REQUIRED
   */
  async listRuns(params: {
    projectId: string;
    page?: number;
    limit?: number;
    testId?: string;
    suiteId?: string;
    parentRunId?: string;
    runType?: 'test' | 'suite' | 'project' | 'recording';
    recordingId?: string;
    scheduleId?: string;
    status?: Run['status'];
  }): Promise<PaginatedResponse<Run>> {
    const searchParams = new URLSearchParams();
    searchParams.set('projectId', params.projectId);
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.testId) searchParams.set('testId', params.testId);
    if (params.suiteId) searchParams.set('suiteId', params.suiteId);
    if (params.parentRunId) searchParams.set('parentRunId', params.parentRunId);
    if (params.runType) searchParams.set('runType', params.runType);
    if (params.recordingId) searchParams.set('recordingId', params.recordingId);
    if (params.scheduleId) searchParams.set('scheduleId', params.scheduleId);
    if (params.status) searchParams.set('status', params.status);

    return this.request<PaginatedResponse<Run>>(`/api/v1/runs?${searchParams.toString()}`);
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
    projectId: string;
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
   * Queue a test run (multi-browser, uses saved test config)
   */
  async runTest(data: {
    testId: string;
    projectId: string;
    browsers?: ('chromium' | 'firefox' | 'webkit')[];
    headless?: boolean;
    timeout?: number;
    triggeredBy?: 'manual' | 'api' | 'schedule' | 'ci';
  }): Promise<Run> {
    return this.request<Run>('/api/v1/runs/test', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Queue runs for all tests in a suite
   */
  async runSuite(data: {
    suiteId: string;
    projectId: string;
    browsers?: ('chromium' | 'firefox' | 'webkit')[];
    headless?: boolean;
    timeout?: number;
    triggeredBy?: 'manual' | 'api' | 'schedule' | 'ci';
  }): Promise<{
    suiteRun: { id: string; suiteId: string; status: string };
    testRuns: { id: string; testId: string; testName: string; status: string }[];
  }> {
    return this.request('/api/v1/runs/suite', {
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
      body: JSON.stringify({}),
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
   * Get action results for a run, optionally filtered by browser
   */
  async getRunActions(id: string, browser?: string): Promise<RunAction[]> {
    const params = browser ? `?browser=${browser}` : '';
    return this.request<RunAction[]>(`/api/v1/runs/${id}/actions${params}`);
  }

  /**
   * Get browser results for a multi-browser run
   */
  async getRunBrowserResults(id: string): Promise<RunBrowserResult[]> {
    return this.request<RunBrowserResult[]>(`/api/v1/runs/${id}/browsers`);
  }

  // =====================
  // Schedules API
  // =====================

  /**
   * List schedules with pagination
   * projectId is REQUIRED
   */
  async listSchedules(params: {
    projectId: string;
    page?: number;
    limit?: number;
    recordingId?: string;
    status?: Schedule['status'];
  }): Promise<PaginatedResponse<Schedule>> {
    const searchParams = new URLSearchParams();
    searchParams.set('projectId', params.projectId);
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.recordingId) searchParams.set('recordingId', params.recordingId);
    if (params.status) searchParams.set('status', params.status);

    return this.request<PaginatedResponse<Schedule>>(
      `/api/v1/schedules?${searchParams.toString()}`
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
    projectId: string;
    targetType: 'test' | 'suite';
    testId?: string;
    suiteId: string;
    name: string;
    cronExpression: string;
    timezone?: string;
    browsers?: ('chromium' | 'firefox' | 'webkit')[];
    recordVideo?: boolean;
    screenshotMode?: 'on-failure' | 'always' | 'never';
  }): Promise<Schedule> {
    // Backend expects browsers/video/screenshot inside runConfig
    const { browsers, recordVideo, screenshotMode, ...rest } = data;
    const payload: Record<string, unknown> = { ...rest };
    if (browsers !== undefined || recordVideo !== undefined || screenshotMode !== undefined) {
      payload.runConfig = {
        ...(browsers !== undefined && { browsers }),
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
      browsers?: ('chromium' | 'firefox' | 'webkit')[];
      recordVideo?: boolean;
      screenshotMode?: 'on-failure' | 'always' | 'never';
    }
  ): Promise<Schedule> {
    // Backend expects browsers/video/screenshot inside runConfig
    const { browsers, recordVideo, screenshotMode, ...rest } = data;
    const payload: Record<string, unknown> = { ...rest };
    if (browsers !== undefined || recordVideo !== undefined || screenshotMode !== undefined) {
      payload.runConfig = {
        ...(browsers !== undefined && { browsers }),
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
  async getDashboard(projectId: string): Promise<DashboardData> {
    const params = new URLSearchParams({ projectId });
    return this.request<DashboardData>(`/api/v1/dashboard?${params.toString()}`);
  }

  /**
   * Get dashboard statistics only
   */
  async getDashboardStats(projectId: string): Promise<DashboardStats> {
    const params = new URLSearchParams({ projectId });
    return this.request<DashboardStats>(`/api/v1/dashboard/stats?${params.toString()}`);
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
