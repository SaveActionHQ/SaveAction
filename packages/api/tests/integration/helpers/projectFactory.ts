/**
 * Project Factory
 *
 * Creates test projects for integration tests.
 */

import {
  projects,
  type Project,
  type NewProject,
  DEFAULT_PROJECT_NAME,
} from '../../../src/db/schema/index.js';
import { getTestDb } from './database.js';

let projectCounter = 0;

export interface CreateProjectOptions {
  userId: string;
  name?: string;
  description?: string;
  color?: string;
  isDefault?: boolean;
}

/**
 * Create a test project in the database.
 */
export async function createProject(options: CreateProjectOptions): Promise<Project> {
  projectCounter++;
  const db = await getTestDb();

  const projectData: NewProject = {
    userId: options.userId,
    name: options.name || `Test Project ${projectCounter}`,
    description: options.description || 'Test project for integration tests',
    color: options.color || '#3B82F6',
    isDefault: options.isDefault ?? false,
  };

  const [project] = await db.insert(projects).values(projectData).returning();
  return project;
}

/**
 * Create a default project for a user.
 */
export async function createDefaultProject(userId: string): Promise<Project> {
  return createProject({
    userId,
    name: DEFAULT_PROJECT_NAME,
    description: 'Your default project for test recordings',
    isDefault: true,
  });
}

/**
 * Get or create a default project for a user.
 * If a default project exists, returns it. Otherwise creates one.
 */
export async function getOrCreateDefaultProject(userId: string): Promise<Project> {
  const db = await getTestDb();
  const { eq, and } = await import('drizzle-orm');

  // Check if default project exists
  const existing = await db
    .select()
    .from(projects)
    .where(and(eq(projects.userId, userId), eq(projects.isDefault, true)))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  return createDefaultProject(userId);
}

/**
 * Create multiple test projects for a user.
 */
export async function createProjects(
  userId: string,
  count: number,
  options: Partial<CreateProjectOptions> = {}
): Promise<Project[]> {
  const createdProjects: Project[] = [];

  for (let i = 0; i < count; i++) {
    const project = await createProject({
      ...options,
      userId,
      name: options.name ? `${options.name} ${i + 1}` : undefined,
    });
    createdProjects.push(project);
  }

  return createdProjects;
}

/**
 * Reset project counter between test files.
 */
export function resetProjectCounter(): void {
  projectCounter = 0;
}
