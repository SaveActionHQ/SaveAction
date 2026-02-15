/**
 * Projects API Integration Tests
 *
 * Tests CRUD operations on projects with real PostgreSQL database.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestApp,
  createUser,
  createProject,
  createDefaultProject,
  createRecording,
  type TestApp,
} from './helpers/index.js';
import { DEFAULT_PROJECT_NAME } from '../../src/db/schema/projects.js';

describe('Projects Routes Integration', () => {
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

  describe('POST /api/v1/projects', () => {
    it('should create a project successfully', async () => {
      const user = await createUser({ email: 'create-proj@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);

      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        payload: {
          name: 'My New Project',
          description: 'A test project',
          color: '#FF5733',
        },
      });

      expect(response.statusCode).toBe(201);

      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.name).toBe('My New Project');
      expect(body.data.description).toBe('A test project');
      expect(body.data.color).toBe('#FF5733');
      expect(body.data.isDefault).toBe(false);
    });

    it('should reject request without authentication', async () => {
      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          name: 'Test',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should require name field', async () => {
      const user = await createUser({ email: 'no-name-proj@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);

      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        payload: {
          description: 'Missing name',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject duplicate project name for same user', async () => {
      const user = await createUser({ email: 'dup-proj@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);

      // Create first project
      await createProject({ userId: user.id, name: 'Unique Project' });

      // Try to create another with same name
      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        payload: {
          name: 'Unique Project',
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('PROJECT_NAME_TAKEN');
    });

    it('should allow same project name for different users', async () => {
      const user1 = await createUser({ email: 'user1-proj@example.com' });
      const user2 = await createUser({ email: 'user2-proj@example.com' });
      const token2 = await getAuthToken(user2.email, user2.plainPassword);

      // Create project for user1
      await createProject({ userId: user1.id, name: 'Shared Name' });

      // user2 should be able to create project with same name
      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token2}`,
        },
        payload: {
          name: 'Shared Name',
        },
      });

      expect(response.statusCode).toBe(201);
    });
  });

  describe('GET /api/v1/projects', () => {
    it('should list user projects', async () => {
      const user = await createUser({ email: 'list-proj@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);

      // Create some projects directly in DB
      await createProject({ userId: user.id, name: 'Project Alpha' });
      await createProject({ userId: user.id, name: 'Project Beta' });
      await createProject({ userId: user.id, name: 'Project Gamma' });

      const response = await testApp.app.inject({
        method: 'GET',
        url: '/api/v1/projects',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(3);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.total).toBe(3);
    });

    it('should paginate projects', async () => {
      const user = await createUser({ email: 'paginate-proj@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);

      // Create 5 projects
      for (let i = 0; i < 5; i++) {
        await createProject({ userId: user.id, name: `Project ${i + 1}` });
      }

      // Get first page
      const page1Response = await testApp.app.inject({
        method: 'GET',
        url: '/api/v1/projects?page=1&limit=2',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(page1Response.statusCode).toBe(200);
      const page1Body = JSON.parse(page1Response.payload);
      expect(page1Body.data).toHaveLength(2);
      expect(page1Body.pagination.total).toBe(5);
      expect(page1Body.pagination.page).toBe(1);
      expect(page1Body.pagination.totalPages).toBe(3);

      // Get second page
      const page2Response = await testApp.app.inject({
        method: 'GET',
        url: '/api/v1/projects?page=2&limit=2',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(page2Response.statusCode).toBe(200);
      const page2Body = JSON.parse(page2Response.payload);
      expect(page2Body.data).toHaveLength(2);
      expect(page2Body.pagination.page).toBe(2);
    });

    it('should filter projects by search term', async () => {
      const user = await createUser({ email: 'search-proj@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);

      await createProject({ userId: user.id, name: 'E-commerce Tests' });
      await createProject({ userId: user.id, name: 'Mobile App' });
      await createProject({ userId: user.id, name: 'E-commerce Checkout' });

      const response = await testApp.app.inject({
        method: 'GET',
        url: '/api/v1/projects?search=e-commerce',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data).toHaveLength(2);
    });

    it('should not show other users projects', async () => {
      const user1 = await createUser({ email: 'isolated1@example.com' });
      const user2 = await createUser({ email: 'isolated2@example.com' });
      const token2 = await getAuthToken(user2.email, user2.plainPassword);

      // Create projects for user1
      await createProject({ userId: user1.id, name: 'User1 Project' });

      // user2 should not see user1's projects
      const response = await testApp.app.inject({
        method: 'GET',
        url: '/api/v1/projects',
        headers: {
          'Authorization': `Bearer ${token2}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data).toHaveLength(0);
    });
  });

  describe('GET /api/v1/projects/default', () => {
    it('should return existing default project', async () => {
      const user = await createUser({ email: 'has-default@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);

      // Create default project
      const defaultProject = await createDefaultProject(user.id);

      const response = await testApp.app.inject({
        method: 'GET',
        url: '/api/v1/projects/default',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(defaultProject.id);
      expect(body.data.name).toBe(DEFAULT_PROJECT_NAME);
      expect(body.data.isDefault).toBe(true);
    });

    it('should create default project if none exists', async () => {
      const user = await createUser({ email: 'no-default@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);

      // User has no projects yet
      const response = await testApp.app.inject({
        method: 'GET',
        url: '/api/v1/projects/default',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe(DEFAULT_PROJECT_NAME);
      expect(body.data.isDefault).toBe(true);
    });
  });

  describe('GET /api/v1/projects/:id', () => {
    it('should get a specific project', async () => {
      const user = await createUser({ email: 'get-one-proj@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id, name: 'Get Me' });

      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}`,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(project.id);
      expect(body.data.name).toBe('Get Me');
    });

    it('should return 404 for non-existent project', async () => {
      const user = await createUser({ email: 'proj-notfound@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);

      const response = await testApp.app.inject({
        method: 'GET',
        url: '/api/v1/projects/00000000-0000-0000-0000-000000000000',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should not allow accessing other user project', async () => {
      const user1 = await createUser({ email: 'owner-proj@example.com' });
      const user2 = await createUser({ email: 'intruder-proj@example.com' });
      const token2 = await getAuthToken(user2.email, user2.plainPassword);

      const project = await createProject({ userId: user1.id, name: 'Private' });

      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}`,
        headers: {
          'Authorization': `Bearer ${token2}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /api/v1/projects/:id', () => {
    it('should update a project', async () => {
      const user = await createUser({ email: 'update-proj@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id, name: 'Original Name' });

      const response = await testApp.app.inject({
        method: 'PUT',
        url: `/api/v1/projects/${project.id}`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        payload: {
          name: 'Updated Name',
          description: 'Updated description',
          color: '#00FF00',
        },
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Updated Name');
      expect(body.data.description).toBe('Updated description');
      expect(body.data.color).toBe('#00FF00');
    });

    it('should return 404 for non-existent project', async () => {
      const user = await createUser({ email: 'update404-proj@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);

      const response = await testApp.app.inject({
        method: 'PUT',
        url: '/api/v1/projects/00000000-0000-0000-0000-000000000000',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        payload: {
          name: 'Will Not Update',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should not allow renaming to existing project name', async () => {
      const user = await createUser({ email: 'rename-dup-proj@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);

      await createProject({ userId: user.id, name: 'Existing Name' });
      const project = await createProject({ userId: user.id, name: 'My Project' });

      const response = await testApp.app.inject({
        method: 'PUT',
        url: `/api/v1/projects/${project.id}`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        payload: {
          name: 'Existing Name',
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('PROJECT_NAME_TAKEN');
    });

    it('should not allow renaming default project', async () => {
      const user = await createUser({ email: 'rename-default@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);

      const defaultProject = await createDefaultProject(user.id);

      const response = await testApp.app.inject({
        method: 'PUT',
        url: `/api/v1/projects/${defaultProject.id}`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        payload: {
          name: 'Renamed Default',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('CANNOT_RENAME_DEFAULT_PROJECT');
    });

    it('should allow updating default project description', async () => {
      const user = await createUser({ email: 'update-default@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);

      const defaultProject = await createDefaultProject(user.id);

      const response = await testApp.app.inject({
        method: 'PUT',
        url: `/api/v1/projects/${defaultProject.id}`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        payload: {
          description: 'Updated default project description',
          color: '#FF0000',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data.description).toBe('Updated default project description');
      expect(body.data.color).toBe('#FF0000');
    });
  });

  describe('DELETE /api/v1/projects/:id', () => {
    it('should delete a project', async () => {
      const user = await createUser({ email: 'delete-proj@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id, name: 'Delete Me' });

      const response = await testApp.app.inject({
        method: 'DELETE',
        url: `/api/v1/projects/${project.id}`,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(204);

      // Verify it's deleted
      const getResponse = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}`,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(getResponse.statusCode).toBe(404);
    });

    it('should not allow deleting default project', async () => {
      const user = await createUser({ email: 'del-default@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);

      const defaultProject = await createDefaultProject(user.id);

      const response = await testApp.app.inject({
        method: 'DELETE',
        url: `/api/v1/projects/${defaultProject.id}`,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('CANNOT_DELETE_DEFAULT_PROJECT');
    });

    it('should return 404 for non-existent project', async () => {
      const user = await createUser({ email: 'del404-proj@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);

      const response = await testApp.app.inject({
        method: 'DELETE',
        url: '/api/v1/projects/00000000-0000-0000-0000-000000000000',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Project-Recording Integration', () => {
    it('should create recording with project assignment', async () => {
      const user = await createUser({ email: 'rec-proj@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id, name: 'Test Suite' });

      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/recordings',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        payload: {
          name: 'Recording in Project',
          projectId: project.id,
          data: {
            id: 'rec_test',
            testName: 'Test',
            url: 'https://example.com',
            startTime: new Date().toISOString(),
            viewport: { width: 1920, height: 1080 },
            userAgent: 'Test',
            actions: [],
            version: '1.0.0',
          },
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.data.projectId).toBe(project.id);
    });

    it('should filter recordings by project', async () => {
      const user = await createUser({ email: 'filter-by-proj@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);

      const project1 = await createProject({ userId: user.id, name: 'Project 1' });
      const project2 = await createProject({ userId: user.id, name: 'Project 2' });

      // Create recordings in different projects
      await createRecording({ userId: user.id, name: 'Rec in P1', projectId: project1.id });
      await createRecording({ userId: user.id, name: 'Rec in P2', projectId: project2.id });

      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/recordings?projectId=${project1.id}`,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe('Rec in P1');
    });
  });
});
