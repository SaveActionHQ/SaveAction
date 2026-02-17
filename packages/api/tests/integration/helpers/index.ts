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
export { createTestSuite, createDefaultTestSuite, createTestSuites, resetSuiteCounter, type CreateTestSuiteOptions } from './suiteFactory.js';
export { createTest as createTestRecord, createTests as createTestRecords, createSampleTestRecordingData, resetTestCounter, type CreateTestOptions } from './testFactory.js';
