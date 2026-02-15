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
  type TestApp,
} from './helpers/index.js';
import { runs } from '../../src/db/schema/index.js';

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
        url: '/api/v1/runs',
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
        url: '/api/v1/runs?status=passed',
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
      const recording2 = await createRecording({ userId: user.id, name: 'Recording 2' });

      await createDbRun(user.id, recording1.id, recording1.projectId, { status: 'passed' });
      await createDbRun(user.id, recording1.id, recording1.projectId, { status: 'passed' });
      await createDbRun(user.id, recording2.id, recording2.projectId, { status: 'passed' });

      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/runs?recordingId=${recording1.id}`,
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
        url: '/api/v1/runs?page=1&limit=2',
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
});
