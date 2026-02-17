/**
 * Tests API Integration Tests
 *
 * Tests CRUD operations on tests with real PostgreSQL database.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestApp,
  createUser,
  createProject,
  createTestSuite,
  createDefaultTestSuite,
  createTestRecord,
  createTestRecords,
  createSampleTestRecordingData,
  type TestApp,
} from './helpers/index.js';

describe('Tests Routes Integration', () => {
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

  describe('POST /api/v1/projects/:projectId/tests', () => {
    it('should create a test successfully', async () => {
      const user = await createUser({ email: 'create-test@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });
      const suite = await createTestSuite({ userId: user.id, projectId: project.id, name: 'My Suite' });

      const recordingData = createSampleTestRecordingData('Login Test');

      const response = await testApp.app.inject({
        method: 'POST',
        url: `/api/v1/projects/${project.id}/tests`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        payload: {
          name: 'Login Test',
          description: 'Tests the login flow',
          suiteId: suite.id,
          recordingData,
          browsers: ['chromium', 'firefox'],
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.name).toBe('Login Test');
      expect(body.data.slug).toBe('login-test');
      expect(body.data.browsers).toEqual(['chromium', 'firefox']);
    });

    it('should auto-create default suite if suiteId not provided', async () => {
      const user = await createUser({ email: 'test-defaultsuite@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });

      const response = await testApp.app.inject({
        method: 'POST',
        url: `/api/v1/projects/${project.id}/tests`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        payload: {
          name: 'Auto Suite Test',
          recordingData: { id: 'rec_1', actions: [] },
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.data.suiteId).toBeDefined();
    });

    it('should reject request without authentication', async () => {
      const user = await createUser({ email: 'test-noauth@example.com' });
      const project = await createProject({ userId: user.id });

      const response = await testApp.app.inject({
        method: 'POST',
        url: `/api/v1/projects/${project.id}/tests`,
        headers: { 'Content-Type': 'application/json' },
        payload: {
          name: 'Test',
          recordingData: {},
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should require name', async () => {
      const user = await createUser({ email: 'test-noname@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });

      const response = await testApp.app.inject({
        method: 'POST',
        url: `/api/v1/projects/${project.id}/tests`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        payload: { recordingData: { id: 'rec_1' } },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should require recordingData', async () => {
      const user = await createUser({ email: 'test-norec@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });

      const response = await testApp.app.inject({
        method: 'POST',
        url: `/api/v1/projects/${project.id}/tests`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        payload: { name: 'Test' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject duplicate test name in same suite', async () => {
      const user = await createUser({ email: 'test-dup@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });
      const suite = await createTestSuite({ userId: user.id, projectId: project.id });

      await createTestRecord({
        userId: user.id,
        projectId: project.id,
        suiteId: suite.id,
        name: 'Unique Test',
      });

      const response = await testApp.app.inject({
        method: 'POST',
        url: `/api/v1/projects/${project.id}/tests`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        payload: {
          name: 'Unique Test',
          suiteId: suite.id,
          recordingData: {},
        },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should validate browser values', async () => {
      const user = await createUser({ email: 'test-badbrowser@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });

      const response = await testApp.app.inject({
        method: 'POST',
        url: `/api/v1/projects/${project.id}/tests`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        payload: {
          name: 'Bad Browser Test',
          recordingData: {},
          browsers: ['invalid-browser'],
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/projects/:projectId/tests', () => {
    it('should list tests with pagination', async () => {
      const user = await createUser({ email: 'list-test@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });
      const suite = await createTestSuite({ userId: user.id, projectId: project.id });

      await createTestRecords(user.id, project.id, suite.id, 3);

      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}/tests`,
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(3);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.total).toBe(3);
    });

    it('should filter by suiteId', async () => {
      const user = await createUser({ email: 'filter-suite-test@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });
      const suite1 = await createTestSuite({ userId: user.id, projectId: project.id, name: 'Suite 1' });
      const suite2 = await createTestSuite({ userId: user.id, projectId: project.id, name: 'Suite 2' });

      await createTestRecords(user.id, project.id, suite1.id, 3);
      await createTestRecords(user.id, project.id, suite2.id, 2);

      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}/tests?suiteId=${suite1.id}`,
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data).toHaveLength(3);
    });

    it('should search tests by name', async () => {
      const user = await createUser({ email: 'search-test@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });
      const suite = await createTestSuite({ userId: user.id, projectId: project.id });

      await createTestRecord({ userId: user.id, projectId: project.id, suiteId: suite.id, name: 'Login Flow' });
      await createTestRecord({ userId: user.id, projectId: project.id, suiteId: suite.id, name: 'Checkout Flow' });
      await createTestRecord({ userId: user.id, projectId: project.id, suiteId: suite.id, name: 'Login Edge Case' });

      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}/tests?search=login`,
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data).toHaveLength(2);
    });

    it('should not show other users tests', async () => {
      const user1 = await createUser({ email: 'test-iso1@example.com' });
      const user2 = await createUser({ email: 'test-iso2@example.com' });
      const token2 = await getAuthToken(user2.email, user2.plainPassword);
      const project1 = await createProject({ userId: user1.id });
      const project2 = await createProject({ userId: user2.id });
      const suite1 = await createTestSuite({ userId: user1.id, projectId: project1.id });

      await createTestRecords(user1.id, project1.id, suite1.id, 2);

      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project2.id}/tests`,
        headers: { Authorization: `Bearer ${token2}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data).toHaveLength(0);
    });

    it('should paginate tests', async () => {
      const user = await createUser({ email: 'paginate-test@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });
      const suite = await createTestSuite({ userId: user.id, projectId: project.id });

      await createTestRecords(user.id, project.id, suite.id, 5);

      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}/tests?page=1&limit=2`,
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data).toHaveLength(2);
      expect(body.pagination.total).toBe(5);
      expect(body.pagination.totalPages).toBe(3);
    });
  });

  describe('GET /api/v1/projects/:projectId/tests/:testId', () => {
    it('should return a specific test with full details', async () => {
      const user = await createUser({ email: 'get-test@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });
      const suite = await createTestSuite({ userId: user.id, projectId: project.id });

      const test = await createTestRecord({
        userId: user.id,
        projectId: project.id,
        suiteId: suite.id,
        name: 'Detailed Test',
        browsers: ['chromium', 'firefox'],
      });

      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}/tests/${test.id}`,
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(test.id);
      expect(body.data.name).toBe('Detailed Test');
      expect(body.data.recordingData).toBeDefined();
      expect(body.data.config).toBeDefined();
      expect(body.data.browsers).toEqual(['chromium', 'firefox']);
    });

    it('should return 404 for non-existent test', async () => {
      const user = await createUser({ email: 'test-404@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });

      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}/tests/00000000-0000-0000-0000-000000000000`,
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/projects/:projectId/tests/by-slug/:slug', () => {
    it('should return a test by slug', async () => {
      const user = await createUser({ email: 'slug-test@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });
      const suite = await createTestSuite({ userId: user.id, projectId: project.id });

      await createTestRecord({
        userId: user.id,
        projectId: project.id,
        suiteId: suite.id,
        name: 'Slug Lookup Test',
        slug: 'slug-lookup-test',
      });

      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}/tests/by-slug/slug-lookup-test`,
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.slug).toBe('slug-lookup-test');
    });

    it('should return 404 for non-existent slug', async () => {
      const user = await createUser({ email: 'slug404-test@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });

      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}/tests/by-slug/does-not-exist`,
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /api/v1/projects/:projectId/tests/:testId', () => {
    it('should update a test', async () => {
      const user = await createUser({ email: 'update-test@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });
      const suite = await createTestSuite({ userId: user.id, projectId: project.id });

      const test = await createTestRecord({
        userId: user.id,
        projectId: project.id,
        suiteId: suite.id,
        name: 'Original Test',
      });

      const response = await testApp.app.inject({
        method: 'PUT',
        url: `/api/v1/projects/${project.id}/tests/${test.id}`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        payload: {
          name: 'Updated Test',
          description: 'Updated description',
          browsers: ['chromium', 'webkit'],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Updated Test');
      expect(body.data.description).toBe('Updated description');
    });

    it('should return 404 for non-existent test', async () => {
      const user = await createUser({ email: 'update404-test@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });

      const response = await testApp.app.inject({
        method: 'PUT',
        url: `/api/v1/projects/${project.id}/tests/00000000-0000-0000-0000-000000000000`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        payload: { name: 'Updated' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should reject duplicate name in same suite', async () => {
      const user = await createUser({ email: 'dup-update-test@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });
      const suite = await createTestSuite({ userId: user.id, projectId: project.id });

      await createTestRecord({
        userId: user.id,
        projectId: project.id,
        suiteId: suite.id,
        name: 'Existing Name',
      });

      const test2 = await createTestRecord({
        userId: user.id,
        projectId: project.id,
        suiteId: suite.id,
        name: 'Other Test',
      });

      const response = await testApp.app.inject({
        method: 'PUT',
        url: `/api/v1/projects/${project.id}/tests/${test2.id}`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        payload: { name: 'Existing Name' },
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe('PUT /api/v1/projects/:projectId/tests/move', () => {
    it('should move tests between suites', async () => {
      const user = await createUser({ email: 'move-test@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });
      const suite1 = await createTestSuite({ userId: user.id, projectId: project.id, name: 'Source Suite' });
      const suite2 = await createTestSuite({ userId: user.id, projectId: project.id, name: 'Target Suite' });

      const test = await createTestRecord({
        userId: user.id,
        projectId: project.id,
        suiteId: suite1.id,
        name: 'Moveable Test',
      });

      const response = await testApp.app.inject({
        method: 'PUT',
        url: `/api/v1/projects/${project.id}/tests/move`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        payload: {
          testIds: [test.id],
          targetSuiteId: suite2.id,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.movedCount).toBe(1);

      // Verify test is now in suite2
      const testsInSuite2 = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}/tests?suiteId=${suite2.id}`,
        headers: { Authorization: `Bearer ${token}` },
      });

      const suite2Body = JSON.parse(testsInSuite2.payload);
      const movedTest = suite2Body.data.find((t: any) => t.id === test.id);
      expect(movedTest).toBeDefined();
    });

    it('should reject moving to non-existent suite', async () => {
      const user = await createUser({ email: 'move404-test@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });
      const suite = await createTestSuite({ userId: user.id, projectId: project.id });

      const test = await createTestRecord({
        userId: user.id,
        projectId: project.id,
        suiteId: suite.id,
        name: 'Stuck Test',
      });

      const response = await testApp.app.inject({
        method: 'PUT',
        url: `/api/v1/projects/${project.id}/tests/move`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        payload: {
          testIds: [test.id],
          targetSuiteId: '00000000-0000-0000-0000-000000000000',
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/v1/projects/:projectId/tests/:testId', () => {
    it('should delete a test', async () => {
      const user = await createUser({ email: 'delete-test@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });
      const suite = await createTestSuite({ userId: user.id, projectId: project.id });

      const test = await createTestRecord({
        userId: user.id,
        projectId: project.id,
        suiteId: suite.id,
        name: 'Delete Me Test',
      });

      const response = await testApp.app.inject({
        method: 'DELETE',
        url: `/api/v1/projects/${project.id}/tests/${test.id}`,
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(204);

      // Verify deleted
      const getResponse = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}/tests/${test.id}`,
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(getResponse.statusCode).toBe(404);
    });

    it('should return 404 for non-existent test', async () => {
      const user = await createUser({ email: 'del404-test@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });

      const response = await testApp.app.inject({
        method: 'DELETE',
        url: `/api/v1/projects/${project.id}/tests/00000000-0000-0000-0000-000000000000`,
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
