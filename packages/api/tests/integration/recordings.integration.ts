/**
 * Recordings API Integration Tests
 *
 * Tests CRUD operations on recordings with real PostgreSQL database.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestApp,
  createUser,
  createRecording,
  createSampleRecordingData,
  createProject,
  type TestApp,
} from './helpers/index.js';

describe('Recordings Routes Integration', () => {
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

  describe('POST /api/v1/recordings', () => {
    it('should create a recording successfully', async () => {
      const user = await createUser({ email: 'create-rec@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const project = await createProject({ userId: user.id, name: 'Test Project' });
      const recordingData = createSampleRecordingData();

      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/recordings',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        payload: {
          projectId: project.id,
          name: 'My Test Recording',
          description: 'A test recording',
          tags: ['smoke', 'login'],
          data: recordingData,
        },
      });

      expect(response.statusCode).toBe(201);

      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.name).toBe('My Test Recording');
      expect(body.data.description).toBe('A test recording');
      expect(body.data.tags).toEqual(['smoke', 'login']);
      expect(body.data.actionCount).toBe(2);
    });

    it('should reject request without authentication', async () => {
      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/recordings',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          name: 'Test',
          data: createSampleRecordingData(),
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject invalid recording data', async () => {
      const user = await createUser({ email: 'invalid-rec@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);

      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/recordings',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        payload: {
          name: 'Test',
          data: { invalid: 'data' }, // Missing required fields
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/recordings', () => {
    it('should list user recordings', async () => {
      const user = await createUser({ email: 'list-rec@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);

      // Create some recordings directly in DB
      const recording1 = await createRecording({ userId: user.id, name: 'Recording 1' });
      await createRecording({ userId: user.id, name: 'Recording 2', projectId: recording1.projectId });
      await createRecording({ userId: user.id, name: 'Recording 3', projectId: recording1.projectId });

      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/recordings?projectId=${recording1.projectId}`,
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

    it('should paginate recordings', async () => {
      const user = await createUser({ email: 'paginate-rec@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);

      // Create 5 recordings - first one to get projectId
      const firstRecording = await createRecording({ userId: user.id, name: 'Recording 1' });
      const projectId = firstRecording.projectId;
      for (let i = 1; i < 5; i++) {
        await createRecording({ userId: user.id, name: `Recording ${i + 1}`, projectId });
      }

      // Get first page
      const page1Response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/recordings?projectId=${projectId}&page=1&limit=2`,
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
        url: `/api/v1/recordings?projectId=${projectId}&page=2&limit=2`,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(page2Response.statusCode).toBe(200);
      const page2Body = JSON.parse(page2Response.payload);
      expect(page2Body.data).toHaveLength(2);
      expect(page2Body.pagination.page).toBe(2);
    });

    it('should filter recordings by tag', async () => {
      const user = await createUser({ email: 'filter-tag@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);

      const smokeRecording = await createRecording({ userId: user.id, name: 'Smoke Test', tags: ['smoke'] });
      const projectId = smokeRecording.projectId;
      await createRecording({ userId: user.id, name: 'Regression', tags: ['regression'], projectId });
      await createRecording({ userId: user.id, name: 'Both', tags: ['smoke', 'regression'], projectId });

      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/recordings?projectId=${projectId}&tags=smoke`,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      // Should return recordings that have 'smoke' tag: 'Smoke Test' and 'Both'
      expect(body.data).toHaveLength(2);
    });
  });

  describe('GET /api/v1/recordings/:id', () => {
    it('should get a specific recording', async () => {
      const user = await createUser({ email: 'get-one@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const recording = await createRecording({ userId: user.id, name: 'Get Me' });

      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/recordings/${recording.id}`,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(recording.id);
      expect(body.data.name).toBe('Get Me');
      expect(body.data.data).toBeDefined(); // Full recording data
    });

    it('should return 404 for non-existent recording', async () => {
      const user = await createUser({ email: 'notfound@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);

      const response = await testApp.app.inject({
        method: 'GET',
        url: '/api/v1/recordings/00000000-0000-0000-0000-000000000000',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /api/v1/recordings/:id', () => {
    it('should update a recording', async () => {
      const user = await createUser({ email: 'update@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const recording = await createRecording({ userId: user.id, name: 'Original Name' });

      const response = await testApp.app.inject({
        method: 'PUT',
        url: `/api/v1/recordings/${recording.id}`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        payload: {
          name: 'Updated Name',
          description: 'Updated description',
          tags: ['updated', 'tags'],
        },
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Updated Name');
      expect(body.data.description).toBe('Updated description');
      expect(body.data.tags).toEqual(['updated', 'tags']);
    });

    it('should return 404 for non-existent recording', async () => {
      const user = await createUser({ email: 'update404@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);

      const response = await testApp.app.inject({
        method: 'PUT',
        url: '/api/v1/recordings/00000000-0000-0000-0000-000000000000',
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
  });

  describe('DELETE /api/v1/recordings/:id', () => {
    it('should delete a recording', async () => {
      const user = await createUser({ email: 'delete@example.com' });
      const token = await getAuthToken(user.email, user.plainPassword);
      const recording = await createRecording({ userId: user.id, name: 'Delete Me' });

      const response = await testApp.app.inject({
        method: 'DELETE',
        url: `/api/v1/recordings/${recording.id}`,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);

      // Verify it's deleted
      const getResponse = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/recordings/${recording.id}`,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(getResponse.statusCode).toBe(404);
    });
  });
});
