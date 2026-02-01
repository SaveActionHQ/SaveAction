/**
 * Recording Factory
 *
 * Creates test recordings for integration tests.
 */

import { recordings, type Recording, type NewRecording, type RecordingData } from '../../../src/db/schema/index.js';
import { getTestDb } from './database.js';

let recordingCounter = 0;

/**
 * Sample recording data that matches the schema expected by the API.
 */
export function createSampleRecordingData(overrides: Partial<RecordingData> = {}): RecordingData {
  recordingCounter++;
  const id = `rec_test_${Date.now()}_${recordingCounter}`;

  return {
    id: overrides.id || id,
    testName: overrides.testName || `Test Recording ${recordingCounter}`,
    url: overrides.url || 'https://example.com',
    startTime: overrides.startTime || new Date().toISOString(),
    endTime: overrides.endTime || new Date(Date.now() + 60000).toISOString(),
    viewport: overrides.viewport || { width: 1920, height: 1080 },
    userAgent: overrides.userAgent || 'Mozilla/5.0 (Test)',
    actions: overrides.actions || [
      {
        id: 'act_001',
        type: 'click',
        timestamp: 1000,
        url: 'https://example.com',
        selector: {
          css: 'button.submit',
          xpath: '//button',
        },
      },
      {
        id: 'act_002',
        type: 'input',
        timestamp: 2000,
        url: 'https://example.com',
        selector: {
          css: 'input[name="email"]',
        },
        value: 'test@example.com',
      },
    ],
    version: overrides.version || '1.0.0',
  };
}

export interface CreateRecordingOptions {
  userId: string;
  name?: string;
  url?: string;
  description?: string;
  tags?: string[];
  data?: RecordingData;
}

/**
 * Create a test recording in the database.
 */
export async function createRecording(options: CreateRecordingOptions): Promise<Recording> {
  const db = await getTestDb();

  const data = options.data || createSampleRecordingData();

  const recordingData: NewRecording = {
    userId: options.userId,
    name: options.name || data.testName,
    url: options.url || data.url,
    description: options.description || 'Test recording for integration tests',
    tags: JSON.stringify(options.tags || ['test']),
    data: data as unknown as Record<string, unknown>,
    actionCount: String(data.actions.length),
    originalId: data.id,
    schemaVersion: data.version,
    dataSizeBytes: String(JSON.stringify(data).length),
  };

  const [recording] = await db.insert(recordings).values(recordingData).returning();
  return recording;
}

/**
 * Create multiple test recordings for a user.
 */
export async function createRecordings(
  userId: string,
  count: number,
  options: Partial<CreateRecordingOptions> = {}
): Promise<Recording[]> {
  const createdRecordings: Recording[] = [];

  for (let i = 0; i < count; i++) {
    const recording = await createRecording({
      ...options,
      userId,
      name: options.name ? `${options.name} ${i + 1}` : undefined,
    });
    createdRecordings.push(recording);
  }

  return createdRecordings;
}

/**
 * Reset recording counter between test files.
 */
export function resetRecordingCounter(): void {
  recordingCounter = 0;
}
