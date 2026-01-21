import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validate } from './validate.js';
import { z } from 'zod';
import { existsSync, statSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Recording } from '@saveaction/core';

describe('validate command', () => {
  const testDir = path.join(__dirname, '__test_fixtures__');
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
    // Mock process.exit to prevent tests from actually exiting
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    // Mock console to silence output during tests
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    // Restore mocks in reverse order
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    exitSpy.mockRestore();
  });

  describe('file validation', () => {
    it('should reject non-existent file', async () => {
      await validate('fake.json', {});

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error: File not found:')
      );
    });

    it('should reject non-JSON file extension', async () => {
      const txtFile = await writeTestFile('test.txt', { data: 'text' });

      await validate(txtFile, {});

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Error: Invalid file type. Expected .json, got .txt'
      );
    });

    // TODO: Re-enable these tests when we can properly mock statSync in Vitest
    it.skip('should warn for files > 10MB', async () => {
      const validFile = await writeTestFile('large.json', createValidRecording());

      // Mock statSync to return large file size (15MB)
      const originalStatSync = statSync;
      vi.spyOn(await import('node:fs'), 'statSync').mockReturnValue({
        ...originalStatSync(validFile),
        size: 15 * 1024 * 1024,
      } as any);

      await validate(validFile, {});

      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Warning: Large file size')
      );
    });

    it.skip('should reject files > 50MB (hard limit)', async () => {
      const validFile = await writeTestFile('huge.json', createValidRecording());

      // Mock statSync to return huge file size (51MB)
      vi.spyOn(await import('node:fs'), 'statSync').mockReturnValue({
        size: 51 * 1024 * 1024,
      } as any);

      await validate(validFile, {});

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('File too large'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('50MB'));
    });
  });

  describe('JSON parsing', () => {
    it('should reject invalid JSON syntax', async () => {
      const invalidFile = path.join(testDir, 'invalid.json');
      await fs.writeFile(invalidFile, '{ invalid json }', 'utf-8');

      await validate(invalidFile, {});

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Validation failed'));
    });

    it('should reject empty file', async () => {
      const emptyFile = path.join(testDir, 'empty.json');
      await fs.writeFile(emptyFile, '', 'utf-8');

      await validate(emptyFile, {});

      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should reject empty object {}', async () => {
      const emptyObjFile = await writeTestFile('empty-obj.json', {});

      await validate(emptyObjFile, {});

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Validation failed'));
    });
  });

  describe('schema validation', () => {
    it('should validate correct recording', async () => {
      const validFile = await writeTestFile('valid.json', createValidRecording());

      await validate(validFile, {});

      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Recording is valid'));
    });

    it('should reject missing id field', async () => {
      const invalidFile = await writeTestFile('no-id.json', createInvalidRecording('id'));

      await validate(invalidFile, {});

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Validation failed'));
    });

    it('should reject missing testName field', async () => {
      const invalidFile = await writeTestFile(
        'no-testName.json',
        createInvalidRecording('testName')
      );

      await validate(invalidFile, {});

      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should reject missing url field', async () => {
      const invalidFile = await writeTestFile('no-url.json', createInvalidRecording('url'));

      await validate(invalidFile, {});

      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should reject missing version field', async () => {
      const invalidFile = await writeTestFile('no-version.json', createInvalidRecording('version'));

      await validate(invalidFile, {});

      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should reject missing actions array', async () => {
      const invalidFile = await writeTestFile('no-actions.json', createInvalidRecording('actions'));

      await validate(invalidFile, {});

      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should accept empty actions array', async () => {
      const recording = createValidRecording();
      recording.actions = [];
      const validFile = await writeTestFile('empty-actions.json', recording);

      await validate(validFile, {});

      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Warning: Recording has no actions')
      );
    });
  });

  describe('output formats', () => {
    it('should show success message for valid recording', async () => {
      const validFile = await writeTestFile('success.json', createValidRecording());

      await validate(validFile, {});

      expect(consoleLogSpy).toHaveBeenCalledWith('\n✅ Recording is valid!\n');
      expect(consoleLogSpy).toHaveBeenCalledWith('📄 File Information:');
      expect(consoleLogSpy).toHaveBeenCalledWith('📝 Recording Details:');
    });

    it('should display recording details on success', async () => {
      const recording = createValidRecording();
      const validFile = await writeTestFile('details.json', recording);

      await validate(validFile, {});

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(recording.testName));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(recording.id));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(recording.url));
    });

    it('should show verbose field list with --verbose', async () => {
      const validFile = await writeTestFile('verbose.json', createValidRecording());

      await validate(validFile, { verbose: true });

      expect(consoleLogSpy).toHaveBeenCalledWith('✓ Validated Fields:');
      expect(consoleLogSpy).toHaveBeenCalledWith('  • id (string)');
      expect(consoleLogSpy).toHaveBeenCalledWith('  • testName (string)');
      expect(consoleLogSpy).toHaveBeenCalledWith('  • url (valid URL)');
    });

    it('should output JSON format with --json', async () => {
      const recording = createValidRecording();
      const validFile = await writeTestFile('json-output.json', recording);

      await validate(validFile, { json: true });

      expect(exitSpy).toHaveBeenCalledWith(0);
      // Verify JSON structure was logged
      const jsonCall = consoleLogSpy.mock.calls.find((call) => call[0].includes('"valid"'));
      expect(jsonCall).toBeDefined();
      const output = JSON.parse(jsonCall![0]);
      expect(output.valid).toBe(true);
      expect(output.recording.testName).toBe(recording.testName);
    });

    it('should format Zod errors user-friendly', async () => {
      const invalidFile = await writeTestFile('zod-error.json', createInvalidRecording('id'));

      await validate(invalidFile, {});

      expect(consoleErrorSpy).toHaveBeenCalledWith('\n❌ Validation failed for: zod-error.json\n');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Errors found:\n');
    });
  });

  describe('edge cases', () => {
    it('should handle very large recordings (1000+ actions)', async () => {
      const recording = createValidRecording();
      // Create 1000 actions
      recording.actions = Array.from({ length: 1000 }, (_, i) => ({
        id: `act_${String(i + 1).padStart(3, '0')}`,
        type: 'click' as const,
        timestamp: Date.now() + i,
        url: 'https://example.com',
        selector: {
          strategies: [{ type: 'id' as const, value: 'test-button' }],
        },
        element: { tagName: 'button', attributes: {} },
        position: { x: 100, y: 200 },
      }));

      const largeFile = await writeTestFile('large-actions.json', recording);

      await validate(largeFile, {});

      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Warning: Large recording (1000 actions)')
      );
    });

    it('should handle Unicode in field values', async () => {
      const recording = createValidRecording();
      recording.testName = 'Test with emoji 🚀 and Chinese 中文';
      const unicodeFile = await writeTestFile('unicode.json', recording);

      await validate(unicodeFile, {});

      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Test with emoji 🚀 and Chinese 中文')
      );
    });

    it('should handle old schema versions', async () => {
      const recording = createValidRecording();
      recording.version = '0.9.0';
      const oldVersionFile = await writeTestFile('old-version.json', recording);

      await validate(oldVersionFile, {});

      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Warning: Schema version 0.9.0')
      );
    });

    it('should handle missing optional fields', async () => {
      const recording = createValidRecording();
      delete recording.endTime;
      const noEndTimeFile = await writeTestFile('no-endtime.json', recording);

      await validate(noEndTimeFile, {});

      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Info: endTime is missing')
      );
    });
  });

  describe('error handling', () => {
    it('should exit with code 1 on validation failure (file not found)', async () => {
      await validate('fake.json', {});

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('File not found'));
    });

    it('should exit with code 0 on validation success', async () => {
      const validFile = await writeTestFile('success-exit.json', createValidRecording());

      await validate(validFile, {});

      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Recording is valid'));
    });

    it('should exit with code 1 on parsing errors', async () => {
      const invalidFile = await writeTestFile('parse-error.json', createInvalidRecording('id'));

      await validate(invalidFile, {});

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Validation failed'));
    });

    // TODO: Re-enable when we can properly mock statSync in Vitest
    it.skip('should exit with code 1 on files exceeding 50MB hard limit', async () => {
      const validFile = await writeTestFile('over-limit.json', createValidRecording());

      // Mock statSync to return huge file size (51MB)
      vi.spyOn(await import('node:fs'), 'statSync').mockReturnValue({
        size: 51 * 1024 * 1024,
      } as any);

      await validate(validFile, {});

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('File too large'));
    });

    it('should handle JSON output on error', async () => {
      await validate('nonexistent.json', { json: true });

      expect(exitSpy).toHaveBeenCalledWith(1);
      const jsonCall = consoleLogSpy.mock.calls.find((call) => call[0].includes('"valid"'));
      expect(jsonCall).toBeDefined();
      const output = JSON.parse(jsonCall![0]);
      expect(output.valid).toBe(false);
      expect(output.errors[0]).toContain('File not found:');
    });
  });
});

/**
 * Create a valid recording object for testing
 */
function createValidRecording(): Recording {
  return {
    id: 'rec_test_123',
    testName: 'Test Recording',
    url: 'https://example.com',
    version: '1.0.0',
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Test)',
    actions: [
      {
        id: 'act_001',
        type: 'click',
        timestamp: Date.now(),
        url: 'https://example.com',
        selector: {
          strategies: [{ type: 'id', value: 'test-button' }],
        },
        element: { tagName: 'button', attributes: {} },
        position: { x: 100, y: 200 },
      },
    ],
  };
}

/**
 * Create an invalid recording missing a specific field
 */
function createInvalidRecording(missingField: string): any {
  const recording = createValidRecording() as any;
  delete recording[missingField];
  return recording;
}

/**
 * Write test file to disk and return absolute path
 */
async function writeTestFile(name: string, content: any): Promise<string> {
  const testDir = path.join(__dirname, '__test_fixtures__');
  const filePath = path.join(testDir, name);
  await fs.writeFile(filePath, JSON.stringify(content, null, 2), 'utf-8');
  return filePath;
}
