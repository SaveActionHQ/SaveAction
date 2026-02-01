/**
 * Permission & Data Isolation Integration Tests
 *
 * CRITICAL: Tests that User A cannot access User B's data.
 * These tests verify the security boundaries between users.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  createTestApp,
  createUser,
  createRecording,
  type TestApp,
  type CreatedUser,
} from './helpers/index.js';
import { runs } from '../../src/db/schema/index.js';

describe('Data Isolation & Permissions', () => {
  let testApp: TestApp;
  let userA: CreatedUser;
  let userB: CreatedUser;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  // Create fresh users and tokens before each test since afterEach truncates tables
  beforeEach(async () => {
    userA = await createUser({ email: 'usera@example.com', password: 'PasswordA123!' });
    userB = await createUser({ email: 'userb@example.com', password: 'PasswordB123!' });

    const loginA = await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'Content-Type': 'application/json' },
      payload: { email: userA.email, password: userA.plainPassword },
    });
    tokenA = JSON.parse(loginA.payload).data.tokens.accessToken;

    const loginB = await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'Content-Type': 'application/json' },
      payload: { email: userB.email, password: userB.plainPassword },
    });
    tokenB = JSON.parse(loginB.payload).data.tokens.accessToken;
  });

  describe('Recordings Isolation', () => {
    it('should NOT allow User B to access User A recording', async () => {
      const recordingA = await createRecording({
        userId: userA.id,
        name: 'User A Private Recording',
      });

      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/recordings/${recordingA.id}`,
        headers: {
          'Authorization': `Bearer ${tokenB}`,
        },
      });

      // API returns 403 Forbidden for unauthorized access (could also be 404)
      expect([403, 404]).toContain(response.statusCode);
    });

    it('should NOT allow User B to update User A recording', async () => {
      const recordingA = await createRecording({
        userId: userA.id,
        name: 'User A Recording',
      });

      const response = await testApp.app.inject({
        method: 'PATCH',
        url: `/api/v1/recordings/${recordingA.id}`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenB}`,
        },
        payload: {
          name: 'Hacked by User B',
        },
      });

      expect([403, 404]).toContain(response.statusCode);

      // Verify recording wasn't actually updated
      const verifyResponse = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/recordings/${recordingA.id}`,
        headers: {
          'Authorization': `Bearer ${tokenA}`,
        },
      });

      const body = JSON.parse(verifyResponse.payload);
      expect(body.data.name).toBe('User A Recording');
    });

    it('should NOT allow User B to delete User A recording', async () => {
      const recordingA = await createRecording({
        userId: userA.id,
        name: 'User A Important Recording',
      });

      const response = await testApp.app.inject({
        method: 'DELETE',
        url: `/api/v1/recordings/${recordingA.id}`,
        headers: {
          'Authorization': `Bearer ${tokenB}`,
        },
      });

      expect([403, 404]).toContain(response.statusCode);

      // Verify recording still exists for User A
      const verifyResponse = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/recordings/${recordingA.id}`,
        headers: {
          'Authorization': `Bearer ${tokenA}`,
        },
      });

      expect(verifyResponse.statusCode).toBe(200);
    });

    it('should only list own recordings', async () => {
      await createRecording({ userId: userA.id, name: 'A Recording 1' });
      await createRecording({ userId: userA.id, name: 'A Recording 2' });
      await createRecording({ userId: userB.id, name: 'B Recording 1' });

      // List as User A
      const responseA = await testApp.app.inject({
        method: 'GET',
        url: '/api/v1/recordings',
        headers: {
          'Authorization': `Bearer ${tokenA}`,
        },
      });

      const bodyA = JSON.parse(responseA.payload);
      expect(bodyA.data).toHaveLength(2);
      bodyA.data.forEach((rec: { name: string }) => {
        expect(rec.name).toMatch(/^A Recording/);
      });

      // List as User B
      const responseB = await testApp.app.inject({
        method: 'GET',
        url: '/api/v1/recordings',
        headers: {
          'Authorization': `Bearer ${tokenB}`,
        },
      });

      const bodyB = JSON.parse(responseB.payload);
      expect(bodyB.data).toHaveLength(1);
      expect(bodyB.data[0].name).toBe('B Recording 1');
    });
  });

  describe('Runs Isolation', () => {
    async function createDbRun(userId: string, recordingId: string) {
      const [run] = await testApp.db.insert(runs).values({
        userId,
        recordingId,
        recordingName: 'Test Recording',
        recordingUrl: 'https://example.com',
        status: 'passed',
        browser: 'chromium',
        headless: true,
        actionsTotal: '5',
        actionsExecuted: '5',
        actionsFailed: '0',
        videoEnabled: false,
        durationMs: '5000',
      }).returning();
      return run;
    }

    it('should NOT allow User B to access User A run', async () => {
      const recordingA = await createRecording({ userId: userA.id });
      const runA = await createDbRun(userA.id, recordingA.id);

      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/runs/${runA.id}`,
        headers: {
          'Authorization': `Bearer ${tokenB}`,
        },
      });

      expect([403, 404]).toContain(response.statusCode);
    });

    it('should NOT allow User B to delete User A run', async () => {
      const recordingA = await createRecording({ userId: userA.id });
      const runA = await createDbRun(userA.id, recordingA.id);

      const response = await testApp.app.inject({
        method: 'DELETE',
        url: `/api/v1/runs/${runA.id}`,
        headers: {
          'Authorization': `Bearer ${tokenB}`,
        },
      });

      expect([403, 404]).toContain(response.statusCode);

      // Verify run still exists
      const verifyResponse = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/runs/${runA.id}`,
        headers: {
          'Authorization': `Bearer ${tokenA}`,
        },
      });

      expect(verifyResponse.statusCode).toBe(200);
    });

    it('should NOT allow User B to create run for User A recording', async () => {
      const recordingA = await createRecording({ userId: userA.id });

      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/runs',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenB}`,
        },
        payload: {
          recordingId: recordingA.id,
          browser: 'chromium',
        },
      });

      expect([403, 404]).toContain(response.statusCode);
    });

    it('should only list own runs', async () => {
      const recordingA = await createRecording({ userId: userA.id });
      const recordingB = await createRecording({ userId: userB.id });

      await createDbRun(userA.id, recordingA.id);
      await createDbRun(userA.id, recordingA.id);
      await createDbRun(userB.id, recordingB.id);

      // List as User A
      const responseA = await testApp.app.inject({
        method: 'GET',
        url: '/api/v1/runs',
        headers: {
          'Authorization': `Bearer ${tokenA}`,
        },
      });

      const bodyA = JSON.parse(responseA.payload);
      expect(bodyA.data).toHaveLength(2);

      // List as User B
      const responseB = await testApp.app.inject({
        method: 'GET',
        url: '/api/v1/runs',
        headers: {
          'Authorization': `Bearer ${tokenB}`,
        },
      });

      const bodyB = JSON.parse(responseB.payload);
      expect(bodyB.data).toHaveLength(1);
    });
  });

  describe('Cross-Resource Attacks', () => {
    it('should prevent accessing other user data via filter parameters', async () => {
      const recordingA = await createRecording({ userId: userA.id });

      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/v1/runs?recordingId=${recordingA.id}`,
        headers: {
          'Authorization': `Bearer ${tokenB}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data).toHaveLength(0);
    });
  });

  describe('Token Security', () => {
    it('should reject expired/invalid tokens', async () => {
      const response = await testApp.app.inject({
        method: 'GET',
        url: '/api/v1/recordings',
        headers: {
          'Authorization': 'Bearer invalid.token.here',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject requests with modified token payload', async () => {
      const parts = tokenA.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      payload.sub = userB.id;
      const modifiedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
      const modifiedToken = `${parts[0]}.${modifiedPayload}.${parts[2]}`;

      const response = await testApp.app.inject({
        method: 'GET',
        url: '/api/v1/recordings',
        headers: {
          'Authorization': `Bearer ${modifiedToken}`,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject requests without Authorization header', async () => {
      const response = await testApp.app.inject({
        method: 'GET',
        url: '/api/v1/recordings',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject requests with malformed Authorization header', async () => {
      const response = await testApp.app.inject({
        method: 'GET',
        url: '/api/v1/recordings',
        headers: {
          'Authorization': 'NotBearer sometoken',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
