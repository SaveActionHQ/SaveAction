/**
 * Test Suite Factory
 *
 * Creates test suites for integration tests.
 */

import {
  testSuites,
  type TestSuite,
  type NewTestSuite,
} from '../../../src/db/schema/index.js';
import { getTestDb } from './database.js';

let suiteCounter = 0;

export interface CreateTestSuiteOptions {
  userId: string;
  projectId: string;
  name?: string;
  description?: string;
  displayOrder?: number;
  isDefault?: boolean;
}

/**
 * Create a test suite in the database.
 */
export async function createTestSuite(options: CreateTestSuiteOptions): Promise<TestSuite> {
  suiteCounter++;
  const db = await getTestDb();

  const suiteData: NewTestSuite = {
    userId: options.userId,
    projectId: options.projectId,
    name: options.isDefault ? 'Unorganized' : (options.name || `Test Suite ${suiteCounter}`),
    description: options.description || null,
    displayOrder: options.displayOrder ?? suiteCounter,
  };

  const [suite] = await db.insert(testSuites).values(suiteData).returning();
  return suite;
}

/**
 * Create a default "Unorganized" suite for a project.
 */
export async function createDefaultTestSuite(userId: string, projectId: string): Promise<TestSuite> {
  return createTestSuite({
    userId,
    projectId,
    name: 'Unorganized',
    description: 'Default suite for ungrouped tests',
    displayOrder: 0,
    isDefault: true,
  });
}

/**
 * Create multiple test suites for a project.
 */
export async function createTestSuites(
  userId: string,
  projectId: string,
  count: number,
  options: Partial<CreateTestSuiteOptions> = {}
): Promise<TestSuite[]> {
  const suites: TestSuite[] = [];

  for (let i = 0; i < count; i++) {
    const suite = await createTestSuite({
      ...options,
      userId,
      projectId,
      name: options.name ? `${options.name} ${i + 1}` : undefined,
    });
    suites.push(suite);
  }

  return suites;
}

/**
 * Reset suite counter between test files.
 */
export function resetSuiteCounter(): void {
  suiteCounter = 0;
}
