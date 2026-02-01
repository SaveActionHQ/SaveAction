/**
 * Authentication Integration Tests
 *
 * Tests the complete auth flow with real PostgreSQL database.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestApp, createUser, type TestApp } from './helpers/index.js';

describe('Auth Routes Integration', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          email: 'newuser@example.com',
          password: 'SecurePassword123!',
          name: 'New User',
        },
      });

      expect(response.statusCode).toBe(201);

      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.user).toBeDefined();
      expect(body.data.user.email).toBe('newuser@example.com');
      expect(body.data.user.name).toBe('New User');
      expect(body.data.tokens).toBeDefined();
      expect(body.data.tokens.accessToken).toBeDefined();
      expect(body.data.tokens.refreshToken).toBeDefined();
      expect(body.data.tokens.expiresIn).toBeDefined();

      // Verify refresh token cookie is set
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(String(cookies)).toContain('refreshToken=');
    });

    it('should reject duplicate email registration', async () => {
      // Create a user first
      await createUser({ email: 'duplicate@example.com' });

      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          email: 'duplicate@example.com',
          password: 'SecurePassword123!',
        },
      });

      expect(response.statusCode).toBe(409);

      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('EMAIL_EXISTS');
    });

    it('should reject weak passwords', async () => {
      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          email: 'weakpass@example.com',
          password: '123', // Too short
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject invalid email format', async () => {
      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          email: 'not-an-email',
          password: 'SecurePassword123!',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login with valid credentials', async () => {
      const user = await createUser({
        email: 'logintest@example.com',
        password: 'MySecurePass123!',
      });

      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          email: user.email,
          password: user.plainPassword,
        },
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.user.id).toBe(user.id);
      expect(body.data.user.email).toBe(user.email);
      expect(body.data.tokens.accessToken).toBeDefined();
      expect(body.data.tokens.refreshToken).toBeDefined();
    });

    it('should reject invalid password', async () => {
      const user = await createUser({
        email: 'wrongpass@example.com',
        password: 'CorrectPassword123!',
      });

      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          email: user.email,
          password: 'WrongPassword123!',
        },
      });

      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject non-existent user', async () => {
      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          email: 'nonexistent@example.com',
          password: 'SomePassword123!',
        },
      });

      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject inactive user', async () => {
      const user = await createUser({
        email: 'inactive@example.com',
        password: 'Password123!',
        isActive: false,
      });

      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          email: user.email,
          password: user.plainPassword,
        },
      });

      expect(response.statusCode).toBe(403);

      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('USER_INACTIVE');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should refresh tokens with valid refresh token', async () => {
      const user = await createUser({
        email: 'refresh@example.com',
        password: 'Password123!',
      });

      // First login to get tokens
      const loginResponse = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          email: user.email,
          password: user.plainPassword,
        },
      });

      const loginBody = JSON.parse(loginResponse.payload);
      const refreshToken = loginBody.data.tokens.refreshToken;

      // Now refresh
      const refreshResponse = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          refreshToken,
        },
      });

      expect(refreshResponse.statusCode).toBe(200);

      const body = JSON.parse(refreshResponse.payload);
      expect(body.success).toBe(true);
      expect(body.data.tokens.accessToken).toBeDefined();
      expect(body.data.tokens.refreshToken).toBeDefined();
      // Note: API may return same refresh token if rotation is not enabled
    });

    it('should reject invalid refresh token', async () => {
      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          refreshToken: 'invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return current user with valid token', async () => {
      const user = await createUser({
        email: 'me@example.com',
        password: 'Password123!',
      });

      // Login to get access token
      const loginResponse = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          email: user.email,
          password: user.plainPassword,
        },
      });

      const loginBody = JSON.parse(loginResponse.payload);
      const accessToken = loginBody.data.tokens.accessToken;

      // Get current user
      const meResponse = await testApp.app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      expect(meResponse.statusCode).toBe(200);

      const body = JSON.parse(meResponse.payload);
      expect(body.success).toBe(true);
      expect(body.data.user.id).toBe(user.id);
      expect(body.data.user.email).toBe(user.email);
    });

    it('should reject request without token', async () => {
      const response = await testApp.app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject request with invalid token', async () => {
      const response = await testApp.app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          'Authorization': 'Bearer invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should logout successfully', async () => {
      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
    });
  });

  describe('Full Auth Flow', () => {
    it('should complete register → login → me → logout flow', async () => {
      // 1. Register
      const registerResponse = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          email: 'fullflow@example.com',
          password: 'FlowPassword123!',
          name: 'Full Flow User',
        },
      });

      expect(registerResponse.statusCode).toBe(201);
      const registerBody = JSON.parse(registerResponse.payload);
      const userId = registerBody.data.user.id;

      // 2. Login with same credentials
      const loginResponse = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          email: 'fullflow@example.com',
          password: 'FlowPassword123!',
        },
      });

      expect(loginResponse.statusCode).toBe(200);
      const loginBody = JSON.parse(loginResponse.payload);
      expect(loginBody.data.user.id).toBe(userId);
      const accessToken = loginBody.data.tokens.accessToken;

      // 3. Get current user
      const meResponse = await testApp.app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      expect(meResponse.statusCode).toBe(200);
      const meBody = JSON.parse(meResponse.payload);
      expect(meBody.data.user.id).toBe(userId);
      expect(meBody.data.user.email).toBe('fullflow@example.com');

      // 4. Logout
      const logoutResponse = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
      });

      expect(logoutResponse.statusCode).toBe(200);
    });
  });
});
