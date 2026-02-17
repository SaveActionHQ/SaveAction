/**
 * Test Factory
 *
 * Creates tests for integration tests.
 */

import {
  tests,
  DEFAULT_TEST_CONFIG,
  type Test,
  type NewTest,
  type TestConfig,
  type BrowserType as TestBrowserType,
} from '../../../src/db/schema/index.js';
import { getTestDb } from './database.js';

let testCounter = 0;

export interface CreateTestOptions {
  userId: string;
  projectId: string;
  suiteId: string;
  name?: string;
  description?: string;
  slug?: string;
  recordingData?: Record<string, unknown>;
  recordingUrl?: string;
  actionCount?: number;
  browsers?: TestBrowserType[];
  config?: TestConfig;
  displayOrder?: number;
}

/**
 * Create a test in the database.
 */
export async function createTest(options: CreateTestOptions): Promise<Test> {
  testCounter++;
  const db = await getTestDb();

  const name = options.name || `Test ${testCounter}`;
  const slug = options.slug || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const testData: NewTest = {
    userId: options.userId,
    projectId: options.projectId,
    suiteId: options.suiteId,
    name,
    description: options.description || null,
    slug,
    recordingData: options.recordingData || {
      id: `rec_${testCounter}`,
      testName: name,
      url: 'https://example.com',
      actions: [],
      version: '1.0',
    },
    recordingUrl: options.recordingUrl || 'https://example.com',
    actionCount: options.actionCount ?? 5,
    browsers: options.browsers || ['chromium'],
    config: options.config || DEFAULT_TEST_CONFIG,
    displayOrder: options.displayOrder ?? testCounter,
  };

  const [test] = await db.insert(tests).values(testData).returning();
  return test;
}

/**
 * Create multiple tests in a suite.
 */
export async function createTests(
  userId: string,
  projectId: string,
  suiteId: string,
  count: number,
  options: Partial<CreateTestOptions> = {}
): Promise<Test[]> {
  const createdTests: Test[] = [];

  for (let i = 0; i < count; i++) {
    const test = await createTest({
      ...options,
      userId,
      projectId,
      suiteId,
      name: options.name ? `${options.name} ${i + 1}` : undefined,
    });
    createdTests.push(test);
  }

  return createdTests;
}

/**
 * Sample recording data for tests.
 */
export function createSampleTestRecordingData(name: string = 'Sample Test'): Record<string, unknown> {
  return {
    id: `rec_${Date.now()}`,
    testName: name,
    url: 'https://example.com',
    startTime: new Date().toISOString(),
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 Test Agent',
    actions: [
      {
        id: 'act_001',
        type: 'navigation',
        timestamp: Date.now(),
        url: 'https://example.com',
        description: 'Navigate to example.com',
      },
      {
        id: 'act_002',
        type: 'click',
        timestamp: Date.now() + 1000,
        url: 'https://example.com',
        selector: { css: 'button.submit' },
        description: 'Click submit button',
      },
    ],
    version: '1.0',
  };
}

/**
 * Reset test counter between test files.
 */
export function resetTestCounter(): void {
  testCounter = 0;
}
