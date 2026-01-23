import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { list } from './list.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';

describe('list command', () => {
  const testDir = path.join(__dirname, '__test_fixtures_list__');
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    exitSpy.mockRestore();
  });

  /**
   * Create a valid recording JSON file
   */
  async function createRecordingFile(
    filename: string,
    testName: string,
    url: string,
    actionCount: number
  ): Promise<string> {
    const recording = {
      id: `rec_${Date.now()}`,
      version: '1.0.0',
      testName,
      url,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Test User Agent',
      actions: Array.from({ length: actionCount }, (_, i) => ({
        id: `act_${String(i + 1).padStart(3, '0')}`,
        type: 'click',
        timestamp: Date.now() + i * 1000,
        url,
        selector: {
          css: 'button',
          xpath: '//button',
          priority: ['css', 'xpath'],
        },
      })),
    };

    const filePath = path.join(testDir, filename);
    await fs.writeFile(filePath, JSON.stringify(recording, null, 2), 'utf-8');
    return filePath;
  }

  /**
   * Create an invalid JSON file (not a recording)
   */
  async function createInvalidFile(filename: string, content: unknown): Promise<string> {
    const filePath = path.join(testDir, filename);
    await fs.writeFile(
      filePath,
      typeof content === 'string' ? content : JSON.stringify(content, null, 2),
      'utf-8'
    );
    return filePath;
  }

  describe('directory validation', () => {
    it('should reject non-existent directory', async () => {
      await list('/nonexistent/directory', {});

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Directory not found'));
    });

    it('should reject file path instead of directory', async () => {
      await createRecordingFile('test.json', 'Test', 'https://example.com', 5);

      await list(path.join(testDir, 'test.json'), {});

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Not a directory'));
    });

    it('should output JSON error for non-existent directory with --json flag', async () => {
      await list('/nonexistent/directory', { json: true });

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(output.count).toBe(0);
      expect(output.recordings).toEqual([]);
      expect(output.errors).toBeDefined();
    });
  });

  describe('empty directory', () => {
    it('should handle empty directory gracefully', async () => {
      await list(testDir, {});

      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No recording files'));
    });

    it('should output JSON for empty directory', async () => {
      await list(testDir, { json: true });

      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(output.count).toBe(0);
      expect(output.recordings).toEqual([]);
    });
  });

  describe('directory with valid recordings', () => {
    it('should list single recording file', async () => {
      await createRecordingFile('login-test.json', 'Login Test', 'https://example.com/login', 8);

      await list(testDir, {});

      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Found 1 recording'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Login Test'));
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('https://example.com/login')
      );
    });

    it('should list multiple recording files', async () => {
      await createRecordingFile('login.json', 'Login Test', 'https://example.com/login', 8);
      await createRecordingFile('checkout.json', 'Checkout Flow', 'https://example.com/cart', 15);
      await createRecordingFile('search.json', 'Search Feature', 'https://example.com', 5);

      await list(testDir, {});

      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Found 3 recording'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Total: 3 recording'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('28 action'));
    });

    it('should output JSON format for recordings', async () => {
      await createRecordingFile('test1.json', 'Test One', 'https://one.com', 5);
      await createRecordingFile('test2.json', 'Test Two', 'https://two.com', 10);

      await list(testDir, { json: true });

      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(output.count).toBe(2);
      expect(output.recordings).toHaveLength(2);
      expect(output.recordings[0]).toHaveProperty('file');
      expect(output.recordings[0]).toHaveProperty('testName');
      expect(output.recordings[0]).toHaveProperty('url');
      expect(output.recordings[0]).toHaveProperty('actionCount');
    });

    it('should include correct action counts', async () => {
      await createRecordingFile('a.json', 'Test A', 'https://a.com', 3);
      await createRecordingFile('b.json', 'Test B', 'https://b.com', 7);

      await list(testDir, { json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      const totalActions = output.recordings.reduce(
        (sum: number, r: { actionCount: number }) => sum + r.actionCount,
        0
      );
      expect(totalActions).toBe(10);
    });
  });

  describe('directory with mixed files', () => {
    it('should skip non-JSON files', async () => {
      await createRecordingFile('valid.json', 'Valid Test', 'https://example.com', 5);
      await fs.writeFile(path.join(testDir, 'readme.txt'), 'This is a text file', 'utf-8');
      await fs.writeFile(path.join(testDir, 'config.yml'), 'key: value', 'utf-8');

      await list(testDir, {});

      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Found 1 recording'));
    });

    it('should skip invalid JSON files and report them', async () => {
      await createRecordingFile('valid.json', 'Valid Test', 'https://example.com', 5);
      await createInvalidFile('invalid.json', '{ invalid json }');
      await createInvalidFile('empty.json', {});

      await list(testDir, {});

      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Found 1 recording'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Skipped: 2 invalid'));
    });

    it('should include errors in JSON output for invalid files', async () => {
      await createRecordingFile('valid.json', 'Valid Test', 'https://example.com', 5);
      await createInvalidFile('broken.json', '{ invalid }');

      await list(testDir, { json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(output.count).toBe(1);
      expect(output.errors).toBeDefined();
      expect(output.errors).toHaveLength(1);
      expect(output.errors[0].file).toBe('broken.json');
    });

    it('should handle directory with only invalid JSON files', async () => {
      await createInvalidFile('bad1.json', '{ not valid }');
      await createInvalidFile('bad2.json', { random: 'object' });

      await list(testDir, {});

      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('No valid recording files')
      );
    });
  });

  describe('default directory', () => {
    it('should use current directory when "." is specified', async () => {
      await createRecordingFile('test.json', 'Test', 'https://example.com', 3);

      // Use absolute path that resolves from '.' (the test dir)
      await list(testDir, {});

      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Found 1 recording'));
    });

    it('should resolve relative paths correctly', async () => {
      await createRecordingFile('relative.json', 'Relative Test', 'https://example.com', 5);

      // Test with relative-like path (resolve will make it absolute)
      await list(testDir, {});

      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Found 1 recording'));
    });
  });

  describe('truncate helper', () => {
    it('should handle long test names in console output', async () => {
      const longName = 'This is a very long test name that should be truncated in the table';
      await createRecordingFile('long-name.json', longName, 'https://example.com', 5);

      await list(testDir, {});

      expect(exitSpy).toHaveBeenCalledWith(0);
      // The name should appear truncated with ellipsis
      const calls = consoleLogSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(calls).toContain('...');
    });

    it('should handle long URLs in console output', async () => {
      const longUrl = 'https://example.com/very/long/path/that/exceeds/the/maximum/width/allowed';
      await createRecordingFile('long-url.json', 'Test', longUrl, 5);

      await list(testDir, {});

      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should preserve full data in JSON output even for long values', async () => {
      const longName = 'This is a very long test name that would be truncated in console';
      const longUrl = 'https://example.com/very/long/path/that/exceeds/normal/display/width';
      await createRecordingFile('full-data.json', longName, longUrl, 5);

      await list(testDir, { json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(output.recordings[0].testName).toBe(longName);
      expect(output.recordings[0].url).toBe(longUrl);
    });
  });

  describe('edge cases', () => {
    it('should handle recording with zero actions', async () => {
      await createRecordingFile('empty-actions.json', 'Empty Test', 'https://example.com', 0);

      await list(testDir, { json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(output.recordings[0].actionCount).toBe(0);
    });

    it('should handle recording with many actions', async () => {
      await createRecordingFile('many-actions.json', 'Big Test', 'https://example.com', 100);

      await list(testDir, { json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(output.recordings[0].actionCount).toBe(100);
    });

    it('should handle special characters in test name', async () => {
      const specialName = 'Test with "quotes" & <brackets>';
      await createRecordingFile('special.json', specialName, 'https://example.com', 5);

      await list(testDir, { json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(output.recordings[0].testName).toBe(specialName);
    });

    it('should handle unicode characters', async () => {
      const unicodeName = 'Test 测试 テスト 🧪';
      await createRecordingFile('unicode.json', unicodeName, 'https://example.com', 5);

      await list(testDir, { json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(output.recordings[0].testName).toBe(unicodeName);
    });
  });
});
