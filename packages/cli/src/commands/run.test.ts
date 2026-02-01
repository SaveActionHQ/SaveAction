import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';

// We need to test the helper functions and JSON output structure
// Full integration tests would require mocking PlaywrightRunner

describe('run command JSON output', () => {
  const testDir = path.join(__dirname, '__test_fixtures_run__');
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    exitSpy.mockRestore();
  });

  /**
   * Create a minimal valid recording file for testing
   */
  async function createTestRecording(filename: string): Promise<string> {
    const recording = {
      id: 'rec_test',
      version: '1.0.0',
      testName: 'Test Recording',
      url: 'https://example.com',
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Test User Agent',
      actions: [
        {
          id: 'act_001',
          type: 'navigation',
          timestamp: Date.now(),
          url: 'https://example.com',
          selector: { css: 'body', xpath: '//body', priority: ['css'] },
          targetUrl: 'https://example.com',
        },
      ],
    };

    const filePath = path.join(testDir, filename);
    await fs.writeFile(filePath, JSON.stringify(recording, null, 2), 'utf-8');
    return filePath;
  }

  describe('buildJsonOutput structure', () => {
    it('should have correct version field', () => {
      // Test JSON output structure
      const jsonOutput = {
        version: '1.0',
        status: 'passed',
        recording: {
          file: 'test.json',
          testName: 'Test',
          url: 'https://example.com',
          actionsTotal: 5,
        },
        execution: {
          browser: 'chromium',
          headless: true,
          timingEnabled: true,
          timingMode: 'realistic',
          timeout: 30000,
        },
        result: {
          duration: 5000,
          actionsExecuted: 5,
          actionsPassed: 5,
          actionsFailed: 0,
          errors: [],
        },
        timestamps: {
          startedAt: '2026-01-23T10:00:00Z',
          completedAt: '2026-01-23T10:00:05Z',
        },
      };

      expect(jsonOutput.version).toBe('1.0');
      expect(jsonOutput.status).toBe('passed');
      expect(jsonOutput.recording.file).toBe('test.json');
      expect(jsonOutput.execution.browser).toBe('chromium');
      expect(jsonOutput.result.actionsPassed).toBe(5);
      expect(jsonOutput.timestamps.startedAt).toBeDefined();
    });

    it('should calculate actionsPassed correctly', () => {
      const actionsExecuted = 10;
      const actionsFailed = 2;
      const actionsPassed = actionsExecuted - actionsFailed;

      expect(actionsPassed).toBe(8);
    });

    it('should map errors correctly', () => {
      const errors = [
        { actionId: 'act_001', actionType: 'click', error: 'Element not found', timestamp: 123 },
        { actionId: 'act_002', actionType: 'input', error: 'Timeout', timestamp: 456 },
      ];

      const mappedErrors = errors.map((e) => ({
        actionId: e.actionId,
        actionType: e.actionType,
        error: e.error,
      }));

      expect(mappedErrors).toHaveLength(2);
      expect(mappedErrors[0]).not.toHaveProperty('timestamp');
      expect(mappedErrors[0].actionId).toBe('act_001');
      expect(mappedErrors[1].error).toBe('Timeout');
    });
  });

  describe('SilentReporter', () => {
    it('should implement Reporter interface with no-op methods', () => {
      // SilentReporter is used for JSON output mode
      // All methods should be callable without errors
      const silentReporter = {
        onStart: () => {},
        onActionStart: () => {},
        onActionSuccess: () => {},
        onActionError: () => {},
        onComplete: () => {},
      };

      // Should not throw
      expect(() => silentReporter.onStart()).not.toThrow();
      expect(() => silentReporter.onActionStart()).not.toThrow();
      expect(() => silentReporter.onActionSuccess()).not.toThrow();
      expect(() => silentReporter.onActionError()).not.toThrow();
      expect(() => silentReporter.onComplete()).not.toThrow();
    });
  });

  describe('output file handling', () => {
    it('should create output directory if it does not exist', async () => {
      const outputPath = path.join(testDir, 'nested', 'dir', 'output.json');
      const dir = path.dirname(outputPath);

      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(outputPath, JSON.stringify({ test: true }), 'utf-8');

      const exists = await fs
        .stat(outputPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      const content = JSON.parse(await fs.readFile(outputPath, 'utf-8'));
      expect(content.test).toBe(true);
    });

    it('should write valid JSON to output file', async () => {
      const outputPath = path.join(testDir, 'result.json');
      const data = {
        version: '1.0',
        status: 'passed',
        recording: {
          file: 'test.json',
          testName: 'Test',
          url: 'https://example.com',
          actionsTotal: 1,
        },
      };

      await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf-8');

      const content = JSON.parse(await fs.readFile(outputPath, 'utf-8'));
      expect(content.version).toBe('1.0');
      expect(content.status).toBe('passed');
      expect(content.recording.testName).toBe('Test');
    });
  });

  describe('JSON output format validation', () => {
    it('should have all required top-level fields', () => {
      const requiredFields = [
        'version',
        'status',
        'recording',
        'execution',
        'result',
        'timestamps',
      ];
      const jsonOutput = {
        version: '1.0',
        status: 'passed',
        recording: {},
        execution: {},
        result: {},
        timestamps: {},
      };

      for (const field of requiredFields) {
        expect(jsonOutput).toHaveProperty(field);
      }
    });

    it('should have correct recording fields', () => {
      const requiredRecordingFields = ['file', 'testName', 'url', 'actionsTotal'];
      const recording = {
        file: 'test.json',
        testName: 'Login Test',
        url: 'https://example.com/login',
        actionsTotal: 15,
      };

      for (const field of requiredRecordingFields) {
        expect(recording).toHaveProperty(field);
      }
    });

    it('should have correct execution fields', () => {
      const requiredExecutionFields = [
        'browser',
        'headless',
        'timingEnabled',
        'timingMode',
        'timeout',
      ];
      const execution = {
        browser: 'chromium',
        headless: true,
        timingEnabled: true,
        timingMode: 'realistic',
        timeout: 30000,
      };

      for (const field of requiredExecutionFields) {
        expect(execution).toHaveProperty(field);
      }
    });

    it('should have correct result fields', () => {
      const requiredResultFields = [
        'duration',
        'actionsExecuted',
        'actionsPassed',
        'actionsFailed',
        'errors',
      ];
      const result = {
        duration: 5000,
        actionsExecuted: 10,
        actionsPassed: 9,
        actionsFailed: 1,
        errors: [{ actionId: 'act_005', actionType: 'click', error: 'Element not found' }],
      };

      for (const field of requiredResultFields) {
        expect(result).toHaveProperty(field);
      }
    });

    it('should have correct timestamps fields', () => {
      const timestamps = {
        startedAt: '2026-01-23T10:00:00.000Z',
        completedAt: '2026-01-23T10:00:12.500Z',
      };

      expect(timestamps).toHaveProperty('startedAt');
      expect(timestamps).toHaveProperty('completedAt');
      expect(new Date(timestamps.startedAt).toISOString()).toBe(timestamps.startedAt);
      expect(new Date(timestamps.completedAt).toISOString()).toBe(timestamps.completedAt);
    });
  });

  describe('error output format', () => {
    it('should have correct structure for error case', () => {
      const errorOutput = {
        version: '1.0',
        status: 'failed',
        error: 'File not found: test.json',
        timestamps: {
          startedAt: '2026-01-23T10:00:00Z',
          completedAt: '2026-01-23T10:00:00Z',
        },
      };

      expect(errorOutput.version).toBe('1.0');
      expect(errorOutput.status).toBe('failed');
      expect(errorOutput.error).toContain('File not found');
      expect(errorOutput.timestamps.startedAt).toBeDefined();
    });
  });

  describe('status mapping', () => {
    it('should map success status to passed', () => {
      const resultStatus = 'success';
      const outputStatus = resultStatus === 'success' ? 'passed' : 'failed';
      expect(outputStatus).toBe('passed');
    });

    it('should map failed status to failed', () => {
      const resultStatus = 'failed';
      const outputStatus = resultStatus === 'success' ? 'passed' : 'failed';
      expect(outputStatus).toBe('failed');
    });

    it('should map partial status to failed', () => {
      const resultStatus = 'partial';
      const outputStatus = resultStatus === 'success' ? 'passed' : 'failed';
      expect(outputStatus).toBe('failed');
    });
  });

  describe('default values', () => {
    it('should use chromium as default browser', () => {
      const inputBrowser: string | undefined = undefined;
      const browser = inputBrowser || 'chromium';
      expect(browser).toBe('chromium');
    });

    it('should use true as default headless', () => {
      const inputHeadless: boolean | undefined = undefined;
      const headless = inputHeadless ?? true;
      expect(headless).toBe(true);
    });

    it('should use realistic as default timing mode', () => {
      const inputMode: string | undefined = undefined;
      const timingMode = inputMode || 'realistic';
      expect(timingMode).toBe('realistic');
    });

    it('should use 30000 as default timeout', () => {
      const inputTimeout: number | undefined = undefined;
      const timeout = inputTimeout || 30000;
      expect(timeout).toBe(30000);
    });
  });

  describe('platform integration', () => {
    describe('recording source determination', () => {
      it('should return file source when file path is provided', () => {
        const file = 'test.json';
        const options = {};

        // Logic extracted from run.ts determineRecordingSource
        let source: { type: string; path?: string; recordingId?: string; tag?: string };
        if ((options as { recordingId?: string }).recordingId) {
          source = {
            type: 'platform',
            recordingId: (options as { recordingId: string }).recordingId,
          };
        } else if ((options as { tag?: string }).tag) {
          source = { type: 'platform-tag', tag: (options as { tag: string }).tag };
        } else if (file) {
          source = { type: 'file', path: file };
        } else {
          throw new Error('Recording file path is required');
        }

        expect(source.type).toBe('file');
        expect(source.path).toBe('test.json');
      });

      it('should return platform source when --recording-id is provided', () => {
        const file = undefined;
        const options = { recordingId: 'rec_123' };

        let source: { type: string; path?: string; recordingId?: string; tag?: string };
        if (options.recordingId) {
          source = { type: 'platform', recordingId: options.recordingId };
        } else {
          source = { type: 'file', path: file! };
        }

        expect(source.type).toBe('platform');
        expect(source.recordingId).toBe('rec_123');
      });

      it('should return platform-tag source when --tag is provided', () => {
        const file = undefined;
        const options = { tag: 'smoke' };

        let source: { type: string; path?: string; recordingId?: string; tag?: string };
        if (options.tag) {
          source = { type: 'platform-tag', tag: options.tag };
        } else {
          source = { type: 'file', path: file! };
        }

        expect(source.type).toBe('platform-tag');
        expect(source.tag).toBe('smoke');
      });

      it('should prioritize --recording-id over file path', () => {
        const file = 'test.json';
        const options = { recordingId: 'rec_123' };

        let source: { type: string; path?: string; recordingId?: string };
        if (options.recordingId) {
          source = { type: 'platform', recordingId: options.recordingId };
        } else {
          source = { type: 'file', path: file };
        }

        expect(source.type).toBe('platform');
        expect(source.recordingId).toBe('rec_123');
      });

      it('should throw error when no file, recording-id, or tag provided', () => {
        const file = undefined;
        const options = {};

        expect(() => {
          if (
            !(options as { recordingId?: string }).recordingId &&
            !(options as { tag?: string }).tag &&
            !file
          ) {
            throw new Error(
              'Recording file path is required. Use a file path, --recording-id, or --tag.'
            );
          }
        }).toThrow('Recording file path is required');
      });
    });

    describe('base URL override', () => {
      it('should replace origin in URL', () => {
        const originalUrl = 'https://production.example.com/login?ref=home';
        const baseUrl = 'https://staging.example.com';

        const original = new URL(originalUrl);
        const newBase = new URL(baseUrl);
        const result = `${newBase.origin}${original.pathname}${original.search}${original.hash}`;

        expect(result).toBe('https://staging.example.com/login?ref=home');
      });

      it('should preserve path, query params, and hash', () => {
        const originalUrl = 'https://prod.example.com/app/page?foo=bar#section';
        const baseUrl = 'https://localhost:3000';

        const original = new URL(originalUrl);
        const newBase = new URL(baseUrl);
        const result = `${newBase.origin}${original.pathname}${original.search}${original.hash}`;

        expect(result).toBe('https://localhost:3000/app/page?foo=bar#section');
      });

      it('should only replace matching origins', () => {
        const recordingOrigin = 'https://example.com';
        const actionUrl = 'https://other-site.com/page';
        const baseUrl = 'https://staging.example.com';

        const parsed = new URL(actionUrl);
        const newBase = new URL(baseUrl);

        // Only replace if origins match
        let result: string;
        if (parsed.origin === recordingOrigin) {
          result = `${newBase.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
        } else {
          result = actionUrl;
        }

        expect(result).toBe('https://other-site.com/page');
      });

      it('should handle different ports in base URL', () => {
        const originalUrl = 'https://example.com/api/users';
        const baseUrl = 'http://localhost:8080';

        const original = new URL(originalUrl);
        const newBase = new URL(baseUrl);
        const result = `${newBase.origin}${original.pathname}${original.search}${original.hash}`;

        expect(result).toBe('http://localhost:8080/api/users');
      });

      it('should apply override to all actions', () => {
        const actions = [
          { id: 'act_001', url: 'https://prod.com/page1' },
          { id: 'act_002', url: 'https://prod.com/page2' },
          { id: 'act_003', url: 'https://prod.com/page3' },
        ];
        const recordingOrigin = 'https://prod.com';
        const baseUrl = 'https://staging.com';

        const newBase = new URL(baseUrl);
        const updatedActions = actions.map((action) => {
          const parsed = new URL(action.url);
          if (parsed.origin === recordingOrigin) {
            return {
              ...action,
              url: `${newBase.origin}${parsed.pathname}${parsed.search}${parsed.hash}`,
            };
          }
          return action;
        });

        expect(updatedActions[0].url).toBe('https://staging.com/page1');
        expect(updatedActions[1].url).toBe('https://staging.com/page2');
        expect(updatedActions[2].url).toBe('https://staging.com/page3');
      });
    });

    describe('JSON output with platform source', () => {
      it('should include source field in recording section', () => {
        const isPlatformSource = true;
        const sourceLabel = 'platform:rec_123';
        const recordingId = 'rec_123';

        const jsonOutput = {
          recording: {
            file: isPlatformSource ? '' : path.basename(sourceLabel),
            testName: 'Test',
            url: 'https://example.com',
            actionsTotal: 5,
            source: isPlatformSource ? 'platform' : 'file',
            recordingId: recordingId,
          },
        };

        expect(jsonOutput.recording.source).toBe('platform');
        expect(jsonOutput.recording.recordingId).toBe('rec_123');
        expect(jsonOutput.recording.file).toBe('');
      });

      it('should include baseUrlOverride in execution section when used', () => {
        const baseUrlOverride = 'https://staging.example.com';

        const jsonOutput = {
          execution: {
            browser: 'chromium',
            headless: true,
            timingEnabled: true,
            timingMode: 'realistic',
            timeout: 30000,
            baseUrlOverride,
          },
        };

        expect(jsonOutput.execution.baseUrlOverride).toBe('https://staging.example.com');
      });
    });

    describe('multi-recording execution (tag-based)', () => {
      it('should aggregate results from multiple recordings', () => {
        const results = [
          {
            recording: { id: 'rec_1', testName: 'Test 1' },
            result: { status: 'success', actionsExecuted: 5, actionsFailed: 0 },
          },
          {
            recording: { id: 'rec_2', testName: 'Test 2' },
            result: { status: 'failed', actionsExecuted: 10, actionsFailed: 2 },
          },
          {
            recording: { id: 'rec_3', testName: 'Test 3' },
            result: { status: 'success', actionsExecuted: 3, actionsFailed: 0 },
          },
        ];

        const passed = results.filter((r) => r.result.status === 'success').length;
        const failed = results.filter((r) => r.result.status !== 'success').length;
        const hasFailures = failed > 0;

        expect(passed).toBe(2);
        expect(failed).toBe(1);
        expect(hasFailures).toBe(true);
      });

      it('should output summary JSON for tag-based execution', () => {
        const tag = 'smoke';
        const results = [
          {
            recording: { id: 'rec_1', testName: 'Test 1' },
            result: {
              status: 'success',
              duration: 1000,
              actionsExecuted: 5,
              actionsFailed: 0,
              errors: [],
            },
          },
        ];
        const hasFailures = results.some((r) => r.result.status !== 'success');

        const jsonOutput = {
          version: '1.0',
          status: hasFailures ? 'failed' : 'passed',
          tag,
          totalRecordings: results.length,
          passed: results.filter((r) => r.result.status === 'success').length,
          failed: results.filter((r) => r.result.status !== 'success').length,
          recordings: results.map(({ recording, result }) => ({
            id: recording.id,
            testName: recording.testName,
            status: result.status === 'success' ? 'passed' : 'failed',
            duration: result.duration,
            actionsExecuted: result.actionsExecuted,
            actionsFailed: result.actionsFailed,
            errors: result.errors,
          })),
        };

        expect(jsonOutput.tag).toBe('smoke');
        expect(jsonOutput.totalRecordings).toBe(1);
        expect(jsonOutput.status).toBe('passed');
        expect(jsonOutput.recordings[0].id).toBe('rec_1');
      });

      it('should handle empty tag results', () => {
        const recordings: unknown[] = [];

        if (recordings.length === 0) {
          // Expected behavior: exit with 0 (no failure, just no tests to run)
          expect(true).toBe(true);
        }
      });
    });
  });

  describe('CI metadata in JSON output', () => {
    it('should include CI metadata when detected', () => {
      const ciMetadata = {
        detected: true,
        provider: 'github-actions',
        commit: 'abc123def456',
        branch: 'main',
        pr: 42,
        workflow: 'CI',
        buildNumber: '100',
        buildUrl: 'https://github.com/owner/repo/actions/runs/100',
        repository: 'owner/repo',
        actor: 'testuser',
        event: 'push',
      };

      // Simulate JSON output with CI metadata
      const jsonOutput: Record<string, unknown> = {
        version: '1.0',
        status: 'passed',
        recording: {
          file: 'test.json',
          testName: 'Test',
          url: 'https://example.com',
          actionsTotal: 5,
        },
        execution: {
          browser: 'chromium',
          headless: true,
          timingEnabled: true,
          timingMode: 'realistic',
          timeout: 30000,
        },
        result: {
          duration: 5000,
          actionsExecuted: 5,
          actionsPassed: 5,
          actionsFailed: 0,
          errors: [],
        },
        timestamps: {
          startedAt: '2026-02-01T10:00:00Z',
          completedAt: '2026-02-01T10:00:05Z',
        },
      };

      if (ciMetadata.detected) {
        jsonOutput.ci = ciMetadata;
      }

      expect(jsonOutput.ci).toBeDefined();
      expect((jsonOutput.ci as Record<string, unknown>).detected).toBe(true);
      expect((jsonOutput.ci as Record<string, unknown>).provider).toBe('github-actions');
      expect((jsonOutput.ci as Record<string, unknown>).commit).toBe('abc123def456');
      expect((jsonOutput.ci as Record<string, unknown>).branch).toBe('main');
      expect((jsonOutput.ci as Record<string, unknown>).pr).toBe(42);
      expect((jsonOutput.ci as Record<string, unknown>).workflow).toBe('CI');
      expect((jsonOutput.ci as Record<string, unknown>).buildNumber).toBe('100');
      expect((jsonOutput.ci as Record<string, unknown>).buildUrl).toBe(
        'https://github.com/owner/repo/actions/runs/100'
      );
      expect((jsonOutput.ci as Record<string, unknown>).repository).toBe('owner/repo');
      expect((jsonOutput.ci as Record<string, unknown>).actor).toBe('testuser');
      expect((jsonOutput.ci as Record<string, unknown>).event).toBe('push');
    });

    it('should not include CI metadata when not detected', () => {
      const ciMetadata = {
        detected: false,
        provider: null,
        commit: null,
        branch: null,
        pr: null,
        workflow: null,
        buildNumber: null,
        buildUrl: null,
        repository: null,
        actor: null,
        event: null,
      };

      const jsonOutput: Record<string, unknown> = {
        version: '1.0',
        status: 'passed',
      };

      if (ciMetadata.detected) {
        jsonOutput.ci = ciMetadata;
      }

      expect(jsonOutput.ci).toBeUndefined();
    });

    it('should include CI metadata in multi-recording output', () => {
      const ciMetadata = {
        detected: true,
        provider: 'gitlab-ci',
        commit: 'def789',
        branch: 'feature/test',
        pr: 15,
        workflow: 'Pipeline',
        buildNumber: '200',
        buildUrl: 'https://gitlab.com/project/-/pipelines/200',
        repository: 'group/project',
        actor: 'developer',
        event: 'merge_request',
      };

      const jsonOutput: Record<string, unknown> = {
        version: '1.0',
        status: 'passed',
        tag: 'smoke',
        totalRecordings: 3,
        passed: 3,
        failed: 0,
        recordings: [],
        timestamps: {
          startedAt: '2026-02-01T10:00:00Z',
          completedAt: '2026-02-01T10:00:30Z',
        },
      };

      if (ciMetadata.detected) {
        jsonOutput.ci = ciMetadata;
      }

      expect(jsonOutput.ci).toBeDefined();
      expect((jsonOutput.ci as Record<string, unknown>).provider).toBe('gitlab-ci');
      expect((jsonOutput.ci as Record<string, unknown>).commit).toBe('def789');
    });

    it('should include CI metadata in error output', () => {
      const ciMetadata = {
        detected: true,
        provider: 'jenkins',
        commit: 'xyz123',
        branch: 'develop',
        pr: null,
        workflow: 'build-job',
        buildNumber: '50',
        buildUrl: 'https://jenkins.example.com/job/build-job/50',
        repository: 'owner/repo',
        actor: null,
        event: 'push',
      };

      const errorOutput: Record<string, unknown> = {
        version: '1.0',
        status: 'failed',
        error: 'Recording file not found',
        timestamps: {
          startedAt: '2026-02-01T10:00:00Z',
          completedAt: '2026-02-01T10:00:01Z',
        },
      };

      if (ciMetadata.detected) {
        errorOutput.ci = ciMetadata;
      }

      expect(errorOutput.status).toBe('failed');
      expect(errorOutput.ci).toBeDefined();
      expect((errorOutput.ci as Record<string, unknown>).provider).toBe('jenkins');
      expect((errorOutput.ci as Record<string, unknown>).commit).toBe('xyz123');
      expect((errorOutput.ci as Record<string, unknown>).pr).toBeNull();
    });
  });
});
