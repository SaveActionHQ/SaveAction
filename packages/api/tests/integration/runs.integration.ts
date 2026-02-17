/**
 * Runs API Integration Tests
 *
 * Tests run operations with real PostgreSQL database.
 * Note: Tests focus on API operations that don't require BullMQ workers.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestApp,
  createUser,
  createRecording,
  createProject,
  createTestSuite,
  createTestRecord,
  type TestApp,
} from './helpers/index.js';
import { runs, runBrowserResults } from '../../src/db/schema/index.js';

describe('Runs Routes Integration', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  /**
   * Helper to get auth token for a user
   */
  async function getAuthToken(email: string, password: string): Promise<string> {
    const response = await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'Content-Type': 'application/json' },
      payload: { email, password },
    });
    const body = JSON.parse(response.payload);
    return body.data.tokens.accessToken;
  }

  /**
   * Helper to create a run directly in database for testing
   */
  async function createDbRun(userId: string, recordingId: string, projectId: string, options: Partial<typeof runs.$inferInsert> = {}) {
    const [run] = await testApp.db.insert(runs).values({
      userId,
      projectId,
      recordingId,
      recordingName: 'Test Recording',
      recordingUrl: 'https://example.com',
      status: options.status || 'passed',
      browser: options.browser || 'chromium',
      headless: options.headless ?? true,
      actionsTotal: options.actionsTotal ?? '5',
      actionsExecuted: options.actionsExecuted ?? '5',
      actionsFailed: options.actionsFailed ?? '0',
      videoEnabled: options.videoEnabled ?? false,
      durationMs: options.durationMs || '5000',
      ...options,
    }).returning();
    return run;
  }

  describe('POST /api/v1/runs', () => {
    it('should create a run request successfully', async () => {
      const user = await createUser({ email: 'create-run@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const recording = await createRecording({ userId: user.id });

      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/runs',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        payload: {
          recordingId: recording.id,
          browser: 'chromium',
          headless: true,
        },
      });

      expect(response.statusCode).toBe(201);

      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.recordingId).toBe(recording.id);
      expect(body.data.status).toBe('queued');
      expect(body.data.browser).toBe('chromium');
    });

    it('should reject run for non-existent recording', async () => {
      const user = await createUser({ email: 'run-norecord@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);

      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/runs',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        payload: {
          recordingId: '00000000-0000-0000-0000-000000000000',
          browser: 'chromium',
        },
      });

      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('RECORDING_NOT_FOUND');
    });

    it('should reject request without authentication', async () => {
      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/runs',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          recordingId: '00000000-0000-0000-0000-000000000000',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/runs', () => {
    it('should list user runs', async () => {
      const user = await createUser({ email: 'list-runs@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const recording = await createRecording({ userId: user.id });

      // Create some runs directly in DB
      await createDbRun(user.id, recording.id, recording.projectId, { status: 'passed' });
      await createDbRun(user.id, recording.id, recording.projectId, { status: 'failed' });
      await createDbRun(user.id, recording.id, recording.projectId, { status: 'passed' });

      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/runs?projectId=${recording.projectId}`,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(3);
      expect(body.pagination).toBeDefined();
    });

    it('should filter runs by status', async () => {
      const user = await createUser({ email: 'filter-runs@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const recording = await createRecording({ userId: user.id });

      await createDbRun(user.id, recording.id, recording.projectId, { status: 'passed' });
      await createDbRun(user.id, recording.id, recording.projectId, { status: 'passed' });
      await createDbRun(user.id, recording.id, recording.projectId, { status: 'failed' });

      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/runs?projectId=${recording.projectId}&status=passed`,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload);
      expect(body.data).toHaveLength(2);
      body.data.forEach((run: { status: string }) => {
        expect(run.status).toBe('passed');
      });
    });

    it('should filter runs by recording', async () => {
      const user = await createUser({ email: 'filter-rec-runs@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const recording1 = await createRecording({ userId: user.id, name: 'Recording 1' });
      const recording2 = await createRecording({ userId: user.id, name: 'Recording 2', projectId: recording1.projectId });

      await createDbRun(user.id, recording1.id, recording1.projectId, { status: 'passed' });
      await createDbRun(user.id, recording1.id, recording1.projectId, { status: 'passed' });
      await createDbRun(user.id, recording2.id, recording2.projectId, { status: 'passed' });

      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/runs?projectId=${recording1.projectId}&recordingId=${recording1.id}`,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload);
      expect(body.data).toHaveLength(2);
    });

    it('should paginate runs', async () => {
      const user = await createUser({ email: 'paginate-runs@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const recording = await createRecording({ userId: user.id });

      // Create 5 runs
      for (let i = 0; i < 5; i++) {
        await createDbRun(user.id, recording.id, recording.projectId);
      }

      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/runs?projectId=${recording.projectId}&page=1&limit=2`,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload);
      expect(body.data).toHaveLength(2);
      expect(body.pagination.total).toBe(5);
      expect(body.pagination.totalPages).toBe(3);
    });
  });

  describe('GET /api/v1/runs/:id', () => {
    it('should get a specific run', async () => {
      const user = await createUser({ email: 'get-run@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const recording = await createRecording({ userId: user.id });
      const run = await createDbRun(user.id, recording.id, recording.projectId, { status: 'passed' });

      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/runs/${run.id}`,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(run.id);
      expect(body.data.status).toBe('passed');
    });

    it('should return 404 for non-existent run', async () => {
      const user = await createUser({ email: 'run-notfound@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);

      const response = await testApp.app.inject({
        method: 'GET',
        url: '/api/v1/runs/00000000-0000-0000-0000-000000000000',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/v1/runs/:id', () => {
    it('should delete a run', async () => {
      const user = await createUser({ email: 'delete-run@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const recording = await createRecording({ userId: user.id });
      const run = await createDbRun(user.id, recording.id, recording.projectId, { status: 'passed' });

      const response = await testApp.app.inject({
        method: 'DELETE',
        url: `/api/v1/runs/${run.id}`,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(204);

      // Verify it's deleted
      const getResponse = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/runs/${run.id}`,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(getResponse.statusCode).toBe(404);
    });

    it('should reject deleting in-progress run', async () => {
      const user = await createUser({ email: 'del-inprogress@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const recording = await createRecording({ userId: user.id });
      const run = await createDbRun(user.id, recording.id, recording.projectId, { status: 'running' });

      const response = await testApp.app.inject({
        method: 'DELETE',
        url: `/api/v1/runs/${run.id}`,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('CANNOT_DELETE_RUNNING');
    });
  });

  describe('POST /api/v1/runs/test (Multi-browser test runs)', () => {
    it('should queue a test run successfully', async () => {
      const user = await createUser({ email: 'test-run@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id, name: 'Test Run Project' });
      const suite = await createTestSuite({ userId: user.id, projectId: project.id });
      const testRecord = await createTestRecord({
        userId: user.id,
        projectId: project.id,
        suiteId: suite.id,
        name: 'Login Flow',
        browsers: ['chromium'],
      });

      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/runs/test',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        payload: {
          testId: testRecord.id,
          projectId: project.id,
        },
      });

      expect(response.statusCode).toBe(201);

      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.testId).toBe(testRecord.id);
      expect(body.data.testName).toBe('Login Flow');
      expect(body.data.status).toBe('queued');
    });

    it('should create browser result rows', async () => {
      const user = await createUser({ email: 'test-run-browsers@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id, name: 'Browser Results Project' });
      const suite = await createTestSuite({ userId: user.id, projectId: project.id });
      const testRecord = await createTestRecord({
        userId: user.id,
        projectId: project.id,
        suiteId: suite.id,
        browsers: ['chromium', 'firefox'],
      });

      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/runs/test',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        payload: {
          testId: testRecord.id,
          projectId: project.id,
        },
      });

      expect(response.statusCode).toBe(201);
      const runId = JSON.parse(response.payload).data.id;

      // Verify browser results were created via the API
      const browserResponse = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/runs/${runId}/browsers`,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(browserResponse.statusCode).toBe(200);
      const browserBody = JSON.parse(browserResponse.payload);
      expect(browserBody.success).toBe(true);
      expect(browserBody.data).toHaveLength(2);

      const browsers = browserBody.data.map((r: { browser: string }) => r.browser).sort();
      expect(browsers).toEqual(['chromium', 'firefox']);

      browserBody.data.forEach((r: { status: string; runId: string }) => {
        expect(r.status).toBe('pending');
        expect(r.runId).toBe(runId);
      });
    });

    it('should override browsers from request', async () => {
      const user = await createUser({ email: 'test-run-override@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id, name: 'Override Project' });
      const suite = await createTestSuite({ userId: user.id, projectId: project.id });
      const testRecord = await createTestRecord({
        userId: user.id,
        projectId: project.id,
        suiteId: suite.id,
        browsers: ['chromium'],
      });

      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/runs/test',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        payload: {
          testId: testRecord.id,
          projectId: project.id,
          browsers: ['chromium', 'firefox', 'webkit'],
        },
      });

      expect(response.statusCode).toBe(201);
      const runId = JSON.parse(response.payload).data.id;

      // Verify 3 browser results were created
      const browserResponse = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/runs/${runId}/browsers`,
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const browserBody = JSON.parse(browserResponse.payload);
      expect(browserBody.data).toHaveLength(3);
    });

    it('should reject test run for non-existent test', async () => {
      const user = await createUser({ email: 'test-run-notest@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id, name: 'No Test Project' });

      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/runs/test',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        payload: {
          testId: '00000000-0000-0000-0000-000000000000',
          projectId: project.id,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('TEST_NOT_FOUND');
    });

    it('should reject test run for wrong project', async () => {
      const user = await createUser({ email: 'test-run-wrongproj@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project1 = await createProject({ userId: user.id, name: 'Project A' });
      const project2 = await createProject({ userId: user.id, name: 'Project B' });
      const suite = await createTestSuite({ userId: user.id, projectId: project1.id });
      const testRecord = await createTestRecord({
        userId: user.id,
        projectId: project1.id,
        suiteId: suite.id,
      });

      // Try to run test from project1 under project2
      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/runs/test',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        payload: {
          testId: testRecord.id,
          projectId: project2.id,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should reject request without authentication', async () => {
      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/runs/test',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          testId: '00000000-0000-0000-0000-000000000000',
          projectId: '00000000-0000-0000-0000-000000000001',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/runs/suite (Suite runs)', () => {
    it('should queue runs for all tests in a suite', async () => {
      const user = await createUser({ email: 'suite-run@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id, name: 'Suite Run Project' });
      const suite = await createTestSuite({ userId: user.id, projectId: project.id, name: 'Smoke Tests' });

      await createTestRecord({ userId: user.id, projectId: project.id, suiteId: suite.id, name: 'Test A' });
      await createTestRecord({ userId: user.id, projectId: project.id, suiteId: suite.id, name: 'Test B' });
      await createTestRecord({ userId: user.id, projectId: project.id, suiteId: suite.id, name: 'Test C' });

      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/runs/suite',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        payload: {
          suiteId: suite.id,
          projectId: project.id,
        },
      });

      expect(response.statusCode).toBe(201);

      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.suiteRun).toBeDefined();
      expect(body.data.suiteRun.suiteId).toBe(suite.id);
      expect(body.data.suiteRun.status).toBe('queued');
      expect(body.data.testRuns).toHaveLength(3);

      body.data.testRuns.forEach((run: { testId: string; status: string; testName: string }) => {
        expect(run.testId).toBeDefined();
        expect(run.status).toBe('queued');
        expect(run.testName).toBeDefined();
      });
    });

    it('should reject suite run for non-existent suite', async () => {
      const user = await createUser({ email: 'suite-run-nosuite@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id, name: 'No Suite Project' });

      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/runs/suite',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        payload: {
          suiteId: '00000000-0000-0000-0000-000000000000',
          projectId: project.id,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('SUITE_NOT_FOUND');
    });

    it('should reject suite run for empty suite', async () => {
      const user = await createUser({ email: 'suite-run-empty@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id, name: 'Empty Suite Project' });
      const suite = await createTestSuite({ userId: user.id, projectId: project.id, name: 'Empty Suite' });

      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/runs/suite',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        payload: {
          suiteId: suite.id,
          projectId: project.id,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('SUITE_EMPTY');
    });

    it('should reject suite run for wrong project', async () => {
      const user = await createUser({ email: 'suite-wrongproj@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project1 = await createProject({ userId: user.id, name: 'Suite Proj A' });
      const project2 = await createProject({ userId: user.id, name: 'Suite Proj B' });
      const suite = await createTestSuite({ userId: user.id, projectId: project1.id });
      await createTestRecord({ userId: user.id, projectId: project1.id, suiteId: suite.id });

      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/runs/suite',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        payload: {
          suiteId: suite.id,
          projectId: project2.id,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('GET /api/v1/runs/:id/browsers (Browser results)', () => {
    it('should return browser results for a test run', async () => {
      const user = await createUser({ email: 'browser-results@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id, name: 'Browser Results Project' });
      const suite = await createTestSuite({ userId: user.id, projectId: project.id });
      const testRecord = await createTestRecord({
        userId: user.id,
        projectId: project.id,
        suiteId: suite.id,
        browsers: ['chromium', 'firefox'],
      });

      // Create the test run (this also creates browser results)
      const runResponse = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/runs/test',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        payload: {
          testId: testRecord.id,
          projectId: project.id,
        },
      });

      const runId = JSON.parse(runResponse.payload).data.id;

      // Fetch browser results
      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/runs/${runId}/browsers`,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.data[0].runId).toBe(runId);
      expect(body.data[1].runId).toBe(runId);
    });

    it('should return empty array for recording-based run', async () => {
      const user = await createUser({ email: 'browser-results-legacy@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const recording = await createRecording({ userId: user.id });
      const run = await createDbRun(user.id, recording.id, recording.projectId, { status: 'passed' });

      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/runs/${run.id}/browsers`,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(0);
    });

    it('should return 404 for non-existent run', async () => {
      const user = await createUser({ email: 'browser-results-notfound@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);

      const response = await testApp.app.inject({
        method: 'GET',
        url: '/api/v1/runs/00000000-0000-0000-0000-000000000000/browsers',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should not return browser results to another user', async () => {
      const user1 = await createUser({ email: 'browser-results-user1@example.com' });
      const user2 = await createUser({ email: 'browser-results-user2@example.com' });
      const token2 = await getAuthToken(user2.email, user2.plainPassword);
      const project = await createProject({ userId: user1.id, name: 'User1 Project' });
      const suite = await createTestSuite({ userId: user1.id, projectId: project.id });
      const testRecord = await createTestRecord({
        userId: user1.id,
        projectId: project.id,
        suiteId: suite.id,
        browsers: ['chromium'],
      });

      // Create run as user1 (directly in DB since user2 can't call the API for user1's project)
      const [run] = await testApp.db.insert(runs).values({
        userId: user1.id,
        projectId: project.id,
        testId: testRecord.id,
        suiteId: suite.id,
        runType: 'test',
        testName: testRecord.name,
        testSlug: testRecord.slug,
        browser: 'chromium',
        headless: true,
        status: 'queued',
      }).returning();

      // Try to access as user2
      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/runs/${run.id}/browsers`,
        headers: {
          'Authorization': `Bearer ${token2}`,
        },
      });

      // Service returns 403 NOT_AUTHORIZED when user doesn't own the run
      expect(response.statusCode).toBe(403);
    });
  });
});
