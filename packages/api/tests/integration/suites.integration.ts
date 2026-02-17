/**
 * Test Suites API Integration Tests
 *
 * Tests CRUD operations on test suites with real PostgreSQL database.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestApp,
  createUser,
  createProject,
  createTestSuite,
  createDefaultTestSuite,
  createTestSuites,
  createTestRecord,
  type TestApp,
} from './helpers/index.js';

describe('Test Suites Routes Integration', () => {
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

  describe('POST /api/v1/projects/:projectId/suites', () => {
    it('should create a suite successfully', async () => {
      const user = await createUser({ email: 'create-suite@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });

      const response = await testApp.app.inject({
        method: 'POST',
        url: `/api/v1/projects/${project.id}/suites`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        payload: {
          name: 'Login Tests',
          description: 'Tests for login flow',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.name).toBe('Login Tests');
      expect(body.data.description).toBe('Tests for login flow');
    });

    it('should reject request without authentication', async () => {
      const user = await createUser({ email: 'suite-noauth@example.com' });
      const project = await createProject({ userId: user.id });

      const response = await testApp.app.inject({
        method: 'POST',
        url: `/api/v1/projects/${project.id}/suites`,
        headers: { 'Content-Type': 'application/json' },
        payload: { name: 'Test Suite' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should require name field', async () => {
      const user = await createUser({ email: 'suite-noname@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });

      const response = await testApp.app.inject({
        method: 'POST',
        url: `/api/v1/projects/${project.id}/suites`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        payload: { description: 'Missing name' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject duplicate suite name in same project', async () => {
      const user = await createUser({ email: 'suite-dup@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });

      // Create first suite
      await createTestSuite({
        userId: user.id,
        projectId: project.id,
        name: 'Unique Suite',
      });

      // Try to create duplicate
      const response = await testApp.app.inject({
        method: 'POST',
        url: `/api/v1/projects/${project.id}/suites`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        payload: { name: 'Unique Suite' },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
    });

    it('should reject creating suite named "Unorganized"', async () => {
      const user = await createUser({ email: 'suite-reserved@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });

      const response = await testApp.app.inject({
        method: 'POST',
        url: `/api/v1/projects/${project.id}/suites`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        payload: { name: 'Unorganized' },
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe('GET /api/v1/projects/:projectId/suites', () => {
    it('should list suites with pagination', async () => {
      const user = await createUser({ email: 'list-suite@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });

      await createTestSuites(user.id, project.id, 3);

      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}/suites`,
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(3);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.total).toBe(3);
    });

    it('should paginate suites', async () => {
      const user = await createUser({ email: 'paginate-suite@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });

      await createTestSuites(user.id, project.id, 5);

      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}/suites?page=1&limit=2`,
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data).toHaveLength(2);
      expect(body.pagination.total).toBe(5);
      expect(body.pagination.totalPages).toBe(3);
    });

    it('should filter suites by search', async () => {
      const user = await createUser({ email: 'search-suite@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });

      await createTestSuite({ userId: user.id, projectId: project.id, name: 'Login Tests' });
      await createTestSuite({ userId: user.id, projectId: project.id, name: 'Checkout Tests' });
      await createTestSuite({ userId: user.id, projectId: project.id, name: 'Login Edge Cases' });

      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}/suites?search=login`,
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data).toHaveLength(2);
    });

    it('should not show other users suites', async () => {
      const user1 = await createUser({ email: 'suite-iso1@example.com' });
      const user2 = await createUser({ email: 'suite-iso2@example.com' });
      const token2 = await getAuthToken(user2.email, user2.plainPassword);
      const project1 = await createProject({ userId: user1.id });
      const project2 = await createProject({ userId: user2.id });

      // User1's suites
      await createTestSuites(user1.id, project1.id, 2);

      // User2 should see 0 suites in their own project
      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project2.id}/suites`,
        headers: { Authorization: `Bearer ${token2}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data).toHaveLength(0);
    });
  });

  describe('GET /api/v1/projects/:projectId/suites/all', () => {
    it('should return all suites with stats', async () => {
      const user = await createUser({ email: 'allstats-suite@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });

      const suite = await createTestSuite({
        userId: user.id,
        projectId: project.id,
        name: 'Suite With Tests',
      });

      // Create tests in the suite
      await createTestRecord({ userId: user.id, projectId: project.id, suiteId: suite.id, name: 'Test 1' });
      await createTestRecord({ userId: user.id, projectId: project.id, suiteId: suite.id, name: 'Test 2' });

      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}/suites/all`,
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toBeInstanceOf(Array);
      expect(body.data.length).toBeGreaterThanOrEqual(1);

      const suiteWithStats = body.data.find((s: any) => s.id === suite.id);
      expect(suiteWithStats).toBeDefined();
      expect(suiteWithStats.testCount).toBe(2);
    });
  });

  describe('GET /api/v1/projects/:projectId/suites/:suiteId', () => {
    it('should return a specific suite', async () => {
      const user = await createUser({ email: 'get-suite@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });
      const suite = await createTestSuite({
        userId: user.id,
        projectId: project.id,
        name: 'Get Me Suite',
      });

      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}/suites/${suite.id}`,
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(suite.id);
      expect(body.data.name).toBe('Get Me Suite');
    });

    it('should return 404 for non-existent suite', async () => {
      const user = await createUser({ email: 'suite-404@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });

      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}/suites/00000000-0000-0000-0000-000000000000`,
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should not allow accessing other users suite', async () => {
      const user1 = await createUser({ email: 'suite-owner@example.com' });
      const user2 = await createUser({ email: 'suite-intruder@example.com' });
      const token2 = await getAuthToken(user2.email, user2.plainPassword);
      const project1 = await createProject({ userId: user1.id });
      const project2 = await createProject({ userId: user2.id });

      const suite = await createTestSuite({
        userId: user1.id,
        projectId: project1.id,
        name: 'Private Suite',
      });

      // User2 tries to access user1's suite
      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project2.id}/suites/${suite.id}`,
        headers: { Authorization: `Bearer ${token2}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /api/v1/projects/:projectId/suites/:suiteId', () => {
    it('should update a suite', async () => {
      const user = await createUser({ email: 'update-suite@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });
      const suite = await createTestSuite({
        userId: user.id,
        projectId: project.id,
        name: 'Original Suite',
      });

      const response = await testApp.app.inject({
        method: 'PUT',
        url: `/api/v1/projects/${project.id}/suites/${suite.id}`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        payload: {
          name: 'Updated Suite',
          description: 'Updated description',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Updated Suite');
      expect(body.data.description).toBe('Updated description');
    });

    it('should return 404 for non-existent suite', async () => {
      const user = await createUser({ email: 'update404-suite@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });

      const response = await testApp.app.inject({
        method: 'PUT',
        url: `/api/v1/projects/${project.id}/suites/00000000-0000-0000-0000-000000000000`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        payload: { name: 'Updated' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should prevent renaming to "Unorganized"', async () => {
      const user = await createUser({ email: 'rename-unorg-suite@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });
      const suite = await createTestSuite({
        userId: user.id,
        projectId: project.id,
        name: 'Normal Suite',
      });

      const response = await testApp.app.inject({
        method: 'PUT',
        url: `/api/v1/projects/${project.id}/suites/${suite.id}`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        payload: { name: 'Unorganized' },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should prevent renaming default suite', async () => {
      const user = await createUser({ email: 'rename-default-suite@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });
      const defaultSuite = await createDefaultTestSuite(user.id, project.id);

      const response = await testApp.app.inject({
        method: 'PUT',
        url: `/api/v1/projects/${project.id}/suites/${defaultSuite.id}`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        payload: { name: 'New Name' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject duplicate name', async () => {
      const user = await createUser({ email: 'dup-update-suite@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });

      await createTestSuite({ userId: user.id, projectId: project.id, name: 'Existing Name' });
      const suite2 = await createTestSuite({
        userId: user.id,
        projectId: project.id,
        name: 'Other Suite',
      });

      const response = await testApp.app.inject({
        method: 'PUT',
        url: `/api/v1/projects/${project.id}/suites/${suite2.id}`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        payload: { name: 'Existing Name' },
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe('PUT /api/v1/projects/:projectId/suites/reorder', () => {
    it('should reorder suites', async () => {
      const user = await createUser({ email: 'reorder-suite@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });

      const suites = await createTestSuites(user.id, project.id, 3);

      // Reverse order
      const reorderedIds = suites.map((s) => s.id).reverse();

      const response = await testApp.app.inject({
        method: 'PUT',
        url: `/api/v1/projects/${project.id}/suites/reorder`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        payload: { suiteIds: reorderedIds },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
    });
  });

  describe('DELETE /api/v1/projects/:projectId/suites/:suiteId', () => {
    it('should delete a suite', async () => {
      const user = await createUser({ email: 'delete-suite@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });
      const suite = await createTestSuite({
        userId: user.id,
        projectId: project.id,
        name: 'Delete Me',
      });

      const response = await testApp.app.inject({
        method: 'DELETE',
        url: `/api/v1/projects/${project.id}/suites/${suite.id}`,
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(204);

      // Verify it's gone
      const getResponse = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}/suites/${suite.id}`,
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(getResponse.statusCode).toBe(404);
    });

    it('should prevent deleting default suite', async () => {
      const user = await createUser({ email: 'del-default-suite@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });
      const defaultSuite = await createDefaultTestSuite(user.id, project.id);

      const response = await testApp.app.inject({
        method: 'DELETE',
        url: `/api/v1/projects/${project.id}/suites/${defaultSuite.id}`,
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should move tests to default suite when deleting', async () => {
      const user = await createUser({ email: 'del-move-suite@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });

      // Create default suite and another suite with tests
      const defaultSuite = await createDefaultTestSuite(user.id, project.id);
      const suite = await createTestSuite({
        userId: user.id,
        projectId: project.id,
        name: 'Suite With Tests',
      });

      await createTestRecord({
        userId: user.id,
        projectId: project.id,
        suiteId: suite.id,
        name: 'Orphaned Test',
      });

      // Delete suite - tests should move to default
      const response = await testApp.app.inject({
        method: 'DELETE',
        url: `/api/v1/projects/${project.id}/suites/${suite.id}`,
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(204);

      // Check tests in default suite
      const testsResponse = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}/tests?suiteId=${defaultSuite.id}`,
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(testsResponse.statusCode).toBe(200);
      const testsBody = JSON.parse(testsResponse.payload);
      expect(testsBody.data.length).toBeGreaterThanOrEqual(1);

      const movedTest = testsBody.data.find((t: any) => t.name === 'Orphaned Test');
      expect(movedTest).toBeDefined();
    });

    it('should return 404 for non-existent suite', async () => {
      const user = await createUser({ email: 'del404-suite@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id });

      const response = await testApp.app.inject({
        method: 'DELETE',
        url: `/api/v1/projects/${project.id}/suites/00000000-0000-0000-0000-000000000000`,
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
