import { promises as fs } from 'fs';
import { z } from 'zod';
import type { Recording } from '../types/index.js';

/**
 * Zod schema for recording validation
 */
const recordingSchema = z.object({
  id: z.string(),
  version: z.string(),
  testName: z.string(),
  url: z.string().url(),
  startTime: z.string(),
  endTime: z.string().optional(),
  viewport: z.object({
    width: z.number(),
    height: z.number(),
  }),
  windowSize: z.object({
    width: z.number(),
    height: z.number(),
  }).optional(),
  screenSize: z.object({
    width: z.number(),
    height: z.number(),
  }).optional(),
  devicePixelRatio: z.number().optional(),
  userAgent: z.string(),
  actions: z.array(z.any()), // We'll validate individual actions later
});

/**
 * Parses and validates JSON recording files
 */
export class RecordingParser {
  /**
   * Parse recording from JSON file
   */
  async parseFile(filePath: string): Promise<Recording> {
    const content = await fs.readFile(filePath, 'utf-8');
    return this.parseString(content);
  }

  /**
   * Parse recording from JSON string
   */
  parseString(json: string): Recording {
    const data = JSON.parse(json);
    return this.validate(data);
  }

  /**
   * Validate recording structure
   */
  private validate(data: unknown): Recording {
    const result = recordingSchema.safeParse(data);

    if (!result.success) {
      throw new Error(`Invalid recording format: ${result.error.message}`);
    }

    return result.data as Recording;
  }

  /**
   * Normalize timestamps to relative format (milliseconds since recording start)
   * Auto-detects if timestamps are absolute (Unix epoch) or relative and converts if needed
   */
  normalizeTimestamps(recording: Recording): Recording {
    if (recording.actions.length === 0) {
      return recording;
    }

    const firstTimestamp = recording.actions[0].timestamp;

    // If first timestamp > 1 billion, it's absolute Unix epoch time
    // Convert to relative by subtracting first timestamp from all actions
    if (firstTimestamp > 1_000_000_000_000) {
      const startTime = firstTimestamp;
      return {
        ...recording,
        actions: recording.actions.map((action) => ({
          ...action,
          timestamp: action.timestamp - startTime,
        })),
      };
    }

    // Already relative, return as-is
    return recording;
  }
}
