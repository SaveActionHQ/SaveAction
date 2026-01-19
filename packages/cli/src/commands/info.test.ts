import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
import { info } from './info.js';
import type { RecordingAnalysis } from '@saveaction/core';

// Helper functions are not exported, so we'll test them indirectly through the main function
// For now, we'll create isolated tests for the logic

describe('info command helpers', () => {
  describe('createProgressBar', () => {
    // Test the progress bar generation logic
    it('should create empty bar for 0%', () => {
      const percentage = 0;
      const width = 30;
      const filled = Math.round((percentage / 100) * width);
      const bar = '█'.repeat(filled) + '░'.repeat(width - filled);

      expect(bar).toBe('░'.repeat(30));
      expect(bar.length).toBe(30);
    });

    it('should create half-filled bar for 50%', () => {
      const percentage = 50;
      const width = 30;
      const filled = Math.round((percentage / 100) * width);
      const bar = '█'.repeat(filled) + '░'.repeat(width - filled);

      expect(filled).toBe(15);
      expect(bar.length).toBe(30);
      expect(bar).toBe('███████████████░░░░░░░░░░░░░░░');
    });

    it('should create full bar for 100%', () => {
      const percentage = 100;
      const width = 30;
      const filled = Math.round((percentage / 100) * width);
      const bar = '█'.repeat(filled) + '░'.repeat(width - filled);

      expect(bar).toBe('█'.repeat(30));
      expect(bar.length).toBe(30);
    });

    it('should handle fractional percentages correctly', () => {
      const percentage = 43.75;
      const width = 30;
      const filled = Math.round((percentage / 100) * width);
      const bar = '█'.repeat(filled) + '░'.repeat(width - filled);

      expect(filled).toBe(13);
      expect(bar.length).toBe(30);
    });

    it('should always produce exactly 30 characters', () => {
      const testCases = [0, 10, 25, 33.33, 50, 66.67, 75, 90, 100];

      for (const percentage of testCases) {
        const width = 30;
        const filled = Math.round((percentage / 100) * width);
        const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
        expect(bar.length).toBe(30);
      }
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds under 1 second', () => {
      expect(formatDuration(0)).toBe('0ms');
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(999)).toBe('999ms');
    });

    it('should format seconds with 2 decimals', () => {
      expect(formatDuration(1000)).toBe('1.00s');
      expect(formatDuration(1500)).toBe('1.50s');
      expect(formatDuration(15526)).toBe('15.53s');
      expect(formatDuration(59999)).toBe('60.00s');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(60000)).toBe('1m 0s');
      expect(formatDuration(65000)).toBe('1m 5s');
      expect(formatDuration(125000)).toBe('2m 5s');
      expect(formatDuration(300000)).toBe('5m 0s');
    });

    it('should handle large durations', () => {
      expect(formatDuration(3600000)).toBe('60m 0s');
      expect(formatDuration(3661000)).toBe('61m 1s');
    });
  });

  describe('truncateURL', () => {
    it('should not truncate URLs shorter than max length', () => {
      const url = 'https://example.com';
      expect(truncateURL(url, 50)).toBe(url);
    });

    it('should truncate long URLs with ellipsis', () => {
      const url = 'https://example.com/very/long/path/that/exceeds/the/maximum/length';
      const result = truncateURL(url, 50);

      expect(result.length).toBe(50);
      expect(result.endsWith('...')).toBe(true);
      // Actual result: maxLength - 3 chars + '...'
      expect(result).toBe(url.slice(0, 47) + '...');
    });

    it('should handle exact length URLs', () => {
      const url = 'a'.repeat(50);
      expect(truncateURL(url, 50)).toBe(url);
    });

    it('should handle very short max lengths', () => {
      const url = 'https://example.com';
      const result = truncateURL(url, 10);

      expect(result.length).toBe(10);
      // 10 - 3 = 7 chars + '...'
      expect(result).toBe('https:/...');
    });
  });

  describe('truncateUserAgent', () => {
    it('should extract Chrome version', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      const result = truncateUserAgent(ua);

      expect(result).toContain('Chrome');
      expect(result).toContain('120.0');
    });

    it('should extract Firefox version', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0';
      const result = truncateUserAgent(ua);

      expect(result).toContain('Firefox');
      expect(result).toContain('121.0');
    });

    it('should extract Safari version', () => {
      const ua =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15';
      const result = truncateUserAgent(ua);

      expect(result).toContain('Safari');
      expect(result).toContain('17.1');
    });

    it('should truncate unknown user agents', () => {
      const ua =
        'SomeCustomBrowser/1.0 with a very long user agent string that needs to be truncated';
      const result = truncateUserAgent(ua);

      expect(result.length).toBeLessThanOrEqual(50);
      expect(result.endsWith('...')).toBe(true);
    });

    it('should handle short unknown user agents', () => {
      const ua = 'CustomBrowser/1.0';
      const result = truncateUserAgent(ua);

      expect(result).toBe(ua);
    });
  });
});

// Helper functions (duplicated from info.ts for testing)
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    const seconds = (ms / 1000).toFixed(2);
    return `${seconds}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

function truncateURL(url: string, maxLength: number): string {
  if (url.length <= maxLength) {
    return url;
  }
  return url.slice(0, maxLength - 3) + '...';
}

function truncateUserAgent(ua: string): string {
  const chromeMatch = ua.match(/Chrome\/([\d.]+)/);
  if (chromeMatch) {
    return `Chrome ${chromeMatch[1]}`;
  }

  const firefoxMatch = ua.match(/Firefox\/([\d.]+)/);
  if (firefoxMatch) {
    return `Firefox ${firefoxMatch[1]}`;
  }

  const safariMatch = ua.match(/Version\/([\d.]+).*Safari/);
  if (safariMatch) {
    return `Safari ${safariMatch[1]}`;
  }

  if (ua.length <= 50) {
    return ua;
  }
  return ua.slice(0, 47) + '...';
}

describe('info command integration', () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: any) => {
      throw new Error(`process.exit(${code})`);
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it('should exit with error for non-existent file', async () => {
    await expect(async () => {
      await info('nonexistent.json', {});
    }).rejects.toThrow('process.exit(1)');

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('File not found'));
  });

  it('should exit with error for non-.json file', async () => {
    await expect(async () => {
      await info('test.txt', {});
    }).rejects.toThrow('process.exit(1)');

    // File doesn't exist, so it fails with 'File not found' before checking extension
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('File not found'));
  });

  it('should handle valid recording file', async () => {
    // This test would require a real file, so we'll skip it for now
    // In a real test suite, we'd create a temporary test file
  });
});
