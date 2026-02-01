/**
 * User Factory
 *
 * Creates test users for integration tests.
 */

import * as bcrypt from 'bcrypt';
import { users, type User, type NewUser } from '../../../src/db/schema/index.js';
import { getTestDb } from './database.js';

const BCRYPT_ROUNDS = 4; // Lower rounds for faster tests

let userCounter = 0;

export interface CreateUserOptions {
  email?: string;
  password?: string;
  name?: string;
  isActive?: boolean;
  emailVerified?: boolean;
}

export interface CreatedUser extends User {
  /** The plain text password (for login tests) */
  plainPassword: string;
}

/**
 * Create a test user in the database.
 */
export async function createUser(options: CreateUserOptions = {}): Promise<CreatedUser> {
  userCounter++;
  const db = await getTestDb();

  const email = options.email || `testuser${userCounter}@example.com`;
  const password = options.password || `TestPassword123!`;
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const userData: NewUser = {
    email,
    passwordHash,
    name: options.name || `Test User ${userCounter}`,
    isActive: options.isActive ?? true,
    emailVerifiedAt: options.emailVerified ? new Date() : null,
  };

  const [user] = await db.insert(users).values(userData).returning();

  return {
    ...user,
    plainPassword: password,
  };
}

/**
 * Create multiple test users.
 */
export async function createUsers(count: number, options: CreateUserOptions = {}): Promise<CreatedUser[]> {
  const createdUsers: CreatedUser[] = [];

  for (let i = 0; i < count; i++) {
    const user = await createUser({
      ...options,
      email: options.email ? `${i}-${options.email}` : undefined,
    });
    createdUsers.push(user);
  }

  return createdUsers;
}

/**
 * Reset user counter between test files.
 */
export function resetUserCounter(): void {
  userCounter = 0;
}
