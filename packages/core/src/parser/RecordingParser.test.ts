import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RecordingParser } from './RecordingParser';
import { promises as fs } from 'fs';
import { join } from 'path';
import type { Recording } from '../types';

describe('RecordingParser', () => {
  let parser: RecordingParser;
  const testDir = join(__dirname, '__test_fixtures__');
  const validRecordingPath = join(testDir, 'valid-recording.json');
  const invalidJsonPath = join(testDir, 'invalid-json.json');

  const validRecording: Recording = {
    id: 'rec_123',
    version: '1.0.0',
    testName: 'test-example',
    url: 'https://example.com',
    startTime: '2025-11-25T00:00:00.000Z',
    endTime: '2025-11-25T00:01:00.000Z',
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0',
    actions: [
      {
        id: 'act_001',
        type: 'click',
        timestamp: 1700000000000,
        url: 'https://example.com',
        tagName: 'button',
        text: 'Submit',
        button: 'left',
        clickCount: 1,
        coordinates: { x: 100, y: 200 },
        coordinatesRelativeTo: 'element',
        modifiers: [],
        selector: {
          id: 'submit-btn',
          css: 'button#submit-btn',
          xpath: '//button[@id="submit-btn"]',
          priority: ['id', 'css', 'xpath'],
        },
      },
    ],
  };

  beforeEach(async () => {
    parser = new RecordingParser();
    
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });
    
    // Create test files
    await fs.writeFile(validRecordingPath, JSON.stringify(validRecording, null, 2));
    await fs.writeFile(invalidJsonPath, '{ invalid json }');
  });

  afterEach(async () => {
    // Cleanup test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('parseFile', () => {
    it('should successfully parse a valid recording file', async () => {
      const result = await parser.parseFile(validRecordingPath);

      expect(result).toBeDefined();
      expect(result.id).toBe('rec_123');
      expect(result.testName).toBe('test-example');
      expect(result.url).toBe('https://example.com');
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe('click');
    });

    it('should throw error for non-existent file', async () => {
      await expect(parser.parseFile('non-existent.json')).rejects.toThrow();
    });

    it('should throw error for invalid JSON', async () => {
      await expect(parser.parseFile(invalidJsonPath)).rejects.toThrow();
    });

    it('should validate recording structure with Zod', async () => {
      const invalidRecordingPath = join(testDir, 'invalid-structure.json');
      await fs.writeFile(invalidRecordingPath, JSON.stringify({
        id: 'rec_123',
        // missing required fields
      }));

      await expect(parser.parseFile(invalidRecordingPath)).rejects.toThrow();
    });
  });

  describe('parseString', () => {
    it('should successfully parse a valid JSON string', () => {
      const jsonString = JSON.stringify(validRecording);
      const result = parser.parseString(jsonString);

      expect(result).toBeDefined();
      expect(result.id).toBe('rec_123');
      expect(result.testName).toBe('test-example');
    });

    it('should throw error for invalid JSON string', () => {
      expect(() => parser.parseString('{ invalid }')).toThrow();
    });

    it('should throw error for empty string', () => {
      expect(() => parser.parseString('')).toThrow();
    });

    it('should reject recording without id', () => {
      const invalid = { ...validRecording };
      delete (invalid as any).id;
      
      expect(() => parser.parseString(JSON.stringify(invalid))).toThrow();
    });

    it('should reject recording without testName', () => {
      const invalid = { ...validRecording };
      delete (invalid as any).testName;
      
      expect(() => parser.parseString(JSON.stringify(invalid))).toThrow();
    });

    it('should reject recording without actions', () => {
      const invalid = { ...validRecording };
      delete (invalid as any).actions;
      
      expect(() => parser.parseString(JSON.stringify(invalid))).toThrow();
    });

    it('should accept recording with empty actions array', () => {
      const emptyActions = { ...validRecording, actions: [] };
      
      expect(() => parser.parseString(JSON.stringify(emptyActions))).not.toThrow();
    });

    it('should validate viewport dimensions', () => {
      const invalidViewport = {
        ...validRecording,
        viewport: { width: 'invalid', height: 1080 },
      };
      
      expect(() => parser.parseString(JSON.stringify(invalidViewport))).toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle recording with multiple action types', () => {
      const multiActionRecording: Recording = {
        ...validRecording,
        actions: [
          validRecording.actions[0],
          {
            id: 'act_002',
            type: 'input',
            timestamp: 1700000001000,
            url: 'https://example.com',
            tagName: 'input',
            selector: {
              id: 'email',
              priority: ['id'],
            },
            value: 'test@example.com',
            inputType: 'text',
            isSensitive: false,
            simulationType: 'type',
            typingDelay: 100,
          },
          {
            id: 'act_003',
            type: 'scroll',
            timestamp: 1700000002000,
            url: 'https://example.com',
            element: 'window',
            scrollX: 0,
            scrollY: 500,
          },
        ],
      };

      const result = parser.parseString(JSON.stringify(multiActionRecording));
      expect(result.actions).toHaveLength(3);
    });

    it('should handle recording with very long action list', () => {
      const manyActions = Array.from({ length: 100 }, (_, i) => ({
        ...validRecording.actions[0],
        id: `act_${i.toString().padStart(3, '0')}`,
        timestamp: 1700000000000 + i * 1000,
      }));

      const longRecording = {
        ...validRecording,
        actions: manyActions,
      };

      const result = parser.parseString(JSON.stringify(longRecording));
      expect(result.actions).toHaveLength(100);
    });

    it('should handle special characters in text fields', () => {
      const specialChars = {
        ...validRecording,
        testName: 'Test with émojis 🎉 and spëcial çhars',
        actions: [
          {
            ...validRecording.actions[0],
            text: 'Button with "quotes" and \'apostrophes\'',
          },
        ],
      };

      const result = parser.parseString(JSON.stringify(specialChars));
      expect(result.testName).toBe('Test with émojis 🎉 and spëcial çhars');
    });
  });
});
