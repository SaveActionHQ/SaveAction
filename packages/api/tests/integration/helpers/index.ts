/**
 * Integration Test Helpers - Central Export
 */

// Database utilities
export { getTestDb, closeTestDb, getTestConfig, getTestPool, type TestDatabase, type TestConfig } from './database.js';

// Test app builder
export { createTestApp, injectJson, injectAuthenticated, type TestApp, type TestAppOptions } from './testApp.js';

// Factories
export { createUser, createUsers, resetUserCounter, type CreateUserOptions, type CreatedUser } from './userFactory.js';
export { createRecording, createRecordings, createSampleRecordingData, resetRecordingCounter, type CreateRecordingOptions } from './recordingFactory.js';
export { createProject, createDefaultProject, getOrCreateDefaultProject, createProjects, resetProjectCounter, type CreateProjectOptions } from './projectFactory.js';
