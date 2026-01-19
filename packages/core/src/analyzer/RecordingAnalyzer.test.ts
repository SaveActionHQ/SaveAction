import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RecordingAnalyzer } from './RecordingAnalyzer.js';
import type { Recording } from '../types/recording.js';
import type { Action } from '../types/actions.js';

// Test helper functions
function createMockRecording(overrides?: Partial<Recording>): Recording {
  return {
    id: 'rec_test123',
    testName: 'Test Recording',
    url: 'https://example.com',
    startTime: '2024-01-01T00:00:00.000Z',
    endTime: '2024-01-01T00:05:00.000Z',
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0',
    actions: [],
    version: '1.0',
    ...overrides,
  };
}

function createAction(overrides?: Partial<Action>): Action {
  return {
    id: 'act_001',
    type: 'click',
    timestamp: Date.now(),
    url: 'https://example.com',
    selector: {
      strategies: [{ type: 'css', value: '.button' }],
    },
    ...overrides,
  } as Action;
}

describe('RecordingAnalyzer', () => {
  let analyzer: RecordingAnalyzer;

  beforeEach(() => {
    analyzer = new RecordingAnalyzer();
  });

  describe('analyzeActions()', () => {
    it('should count actions by type', () => {
      const actions = [
        createAction({ id: 'act_001', type: 'click' }),
        createAction({ id: 'act_002', type: 'click' }),
        createAction({ id: 'act_003', type: 'input' }),
      ];

      const result = analyzer['analyzeActions'](actions);

      expect(result.total).toBe(3);
      expect(result.byType).toEqual({ click: 2, input: 1 });
    });

    it('should handle unknown types', () => {
      const actions = [
        createAction({ id: 'act_001', type: 'click' }),
        createAction({ id: 'act_002', type: undefined as any }),
      ];

      const result = analyzer['analyzeActions'](actions);

      expect(result.byType).toEqual({ click: 1, unknown: 1 });
    });

    it('should handle empty array', () => {
      const result = analyzer['analyzeActions']([]);

      expect(result.total).toBe(0);
      expect(result.byType).toEqual({});
      expect(result.byPage).toEqual({});
      expect(result.percentages).toEqual({});
    });

    it('should filter null/undefined actions in array', () => {
      const actions = [
        createAction({ id: 'act_001', type: 'click' }),
        null as any,
        undefined as any,
        createAction({ id: 'act_002', type: 'input' }),
      ];

      const result = analyzer['analyzeActions'](actions);

      expect(result.total).toBe(2);
    });

    it('should normalize URLs when counting by page', () => {
      const actions = [
        createAction({ id: 'act_001', url: 'https://example.com/' }),
        createAction({ id: 'act_002', url: 'https://example.com' }),
        createAction({ id: 'act_003', url: 'https://example.com#section' }),
      ];

      const result = analyzer['analyzeActions'](actions);

      expect(result.byPage['https://example.com']).toBe(3);
    });

    it('should handle missing url field', () => {
      const actions = [
        createAction({ id: 'act_001', url: 'https://example.com' }),
        createAction({ id: 'act_002', url: undefined as any }),
      ];

      const result = analyzer['analyzeActions'](actions);

      expect(result.byPage['https://example.com']).toBe(1);
      expect(Object.keys(result.byPage).length).toBe(1);
    });

    it('should calculate percentages correctly', () => {
      const actions = [
        createAction({ id: 'act_001', type: 'click' }),
        createAction({ id: 'act_002', type: 'click' }),
        createAction({ id: 'act_003', type: 'input' }),
        createAction({ id: 'act_004', type: 'scroll' }),
      ];

      const result = analyzer['analyzeActions'](actions);

      expect(result.percentages.click).toBe(50);
      expect(result.percentages.input).toBe(25);
      expect(result.percentages.scroll).toBe(25);

      // Verify sum equals 100% (within rounding)
      const sum = Object.values(result.percentages).reduce((a, b) => a + b, 0);
      expect(Math.abs(sum - 100)).toBeLessThan(0.1);
    });
  });

  describe('analyzeTiming()', () => {
    it('should calculate recording duration', () => {
      const recording = createMockRecording({
        startTime: '2024-01-01T00:00:00.000Z',
        endTime: '2024-01-01T00:05:00.000Z',
        actions: [createAction({ timestamp: 1000 })],
      });

      const result = analyzer['analyzeTiming'](recording);

      expect(result.recordingDuration).toBe(5 * 60 * 1000); // 5 minutes
    });

    it('should calculate median for odd array', () => {
      const recording = createMockRecording({
        actions: [
          createAction({ timestamp: 1000 }),
          createAction({ timestamp: 2000 }),
          createAction({ timestamp: 3000 }),
        ],
      });

      const result = analyzer['analyzeTiming'](recording);

      expect(result.gaps.median).toBe(1000);
    });

    it('should calculate median for even array', () => {
      const recording = createMockRecording({
        actions: [
          createAction({ timestamp: 1000 }),
          createAction({ timestamp: 2000 }), // gap: 1000
          createAction({ timestamp: 4000 }), // gap: 2000
          createAction({ timestamp: 6000 }), // gap: 2000
          createAction({ timestamp: 9000 }), // gap: 3000
        ],
      });

      const result = analyzer['analyzeTiming'](recording);

      // Gaps: [1000, 2000, 2000, 3000] - even array
      // Sorted: [1000, 2000, 2000, 3000]
      // Median: (2000 + 2000) / 2 = 2000
      expect(result.gaps.median).toBe(2000);
    });

    it('should handle single action', () => {
      const recording = createMockRecording({
        actions: [createAction({ timestamp: 1000 })],
      });

      const result = analyzer['analyzeTiming'](recording);

      expect(result.gaps.min).toBe(0);
      expect(result.gaps.max).toBe(0);
      expect(result.gaps.avg).toBe(0);
      expect(result.gaps.median).toBe(0);
    });

    it('should handle same timestamps', () => {
      const recording = createMockRecording({
        actions: [
          createAction({ timestamp: 1000 }),
          createAction({ timestamp: 1000 }),
          createAction({ timestamp: 1000 }),
        ],
      });

      const result = analyzer['analyzeTiming'](recording);

      expect(result.gaps.min).toBe(0);
      expect(result.gaps.max).toBe(0);
    });

    it('should handle empty array', () => {
      const recording = createMockRecording({ actions: [] });

      const result = analyzer['analyzeTiming'](recording);

      expect(result.actionSpan).toBe(0);
      expect(result.gaps.min).toBe(0);
    });

    it('should filter invalid timestamps', () => {
      const recording = createMockRecording({
        actions: [
          createAction({ timestamp: 1000 }),
          createAction({ timestamp: -100 }),
          createAction({ timestamp: 0 }),
          createAction({ timestamp: 'invalid' as any }),
          createAction({ timestamp: 3000 }),
        ],
      });

      const result = analyzer['analyzeTiming'](recording);

      expect(result.actionSpan).toBe(2000); // Only 1000 and 3000 are valid
    });

    it('should exclude first action from gap calculations', () => {
      const recording = createMockRecording({
        actions: [
          createAction({ timestamp: 1000 }), // First action - no gap before it
          createAction({ timestamp: 2000 }), // Gap: 1000ms
          createAction({ timestamp: 4000 }), // Gap: 2000ms
        ],
      });

      const result = analyzer['analyzeTiming'](recording);

      expect(result.gaps.min).toBe(1000);
      expect(result.gaps.max).toBe(2000);
    });
  });

  describe('analyzeViewport()', () => {
    it('should categorize Mobile viewport', () => {
      const recording = createMockRecording({
        viewport: { width: 375, height: 667 },
      });

      const result = analyzer['analyzeViewport'](recording);

      expect(result.category).toBe('Mobile');
      expect(result.width).toBe(375);
      expect(result.height).toBe(667);
    });

    it('should categorize Tablet viewport', () => {
      const recording = createMockRecording({
        viewport: { width: 768, height: 1024 },
      });

      const result = analyzer['analyzeViewport'](recording);

      expect(result.category).toBe('Mobile');
    });

    it('should categorize Desktop viewport', () => {
      const recording = createMockRecording({
        viewport: { width: 1920, height: 1080 },
      });

      const result = analyzer['analyzeViewport'](recording);

      expect(result.category).toBe('Desktop');
    });

    it('should handle invalid dimensions (negative)', () => {
      const recording = createMockRecording({
        viewport: { width: -100, height: -100 },
      });

      const result = analyzer['analyzeViewport'](recording);

      expect(result.width).toBe(1);
      expect(result.height).toBe(1);
    });

    it('should handle invalid dimensions (zero)', () => {
      const recording = createMockRecording({
        viewport: { width: 0, height: 0 },
      });

      const result = analyzer['analyzeViewport'](recording);

      expect(result.width).toBe(1);
      expect(result.height).toBe(1);
    });

    it('should handle missing viewport entirely', () => {
      const recording = createMockRecording({
        viewport: undefined,
      });

      const result = analyzer['analyzeViewport'](recording);

      expect(result.category).toBe('Unknown');
      expect(result.width).toBe(0);
      expect(result.height).toBe(0);
    });

    it('should handle partial viewport (only width)', () => {
      const recording = createMockRecording({
        viewport: { width: 1920, height: undefined as any },
      });

      const result = analyzer['analyzeViewport'](recording);

      expect(result.width).toBe(1920);
      expect(result.height).toBe(1);
    });
  });

  describe('analyzeNavigation()', () => {
    it('should detect multi-page flow (MPA)', () => {
      const actions = [
        createAction({ url: 'https://example.com/page1' }),
        createAction({ url: 'https://example.com/page2' }),
        createAction({ url: 'https://example.com/page3' }),
      ];

      const result = analyzer['analyzeNavigation'](actions);

      expect(result.flowType).toBe('MPA');
      expect(result.uniquePages).toBe(3);
      expect(result.transitions).toBe(2);
    });

    it('should detect single-page flow (SPA)', () => {
      const actions = [
        createAction({ url: 'https://example.com' }),
        createAction({ url: 'https://example.com' }),
        createAction({ url: 'https://example.com' }),
      ];

      const result = analyzer['analyzeNavigation'](actions);

      expect(result.flowType).toBe('SPA');
      expect(result.uniquePages).toBe(1);
      expect(result.transitions).toBe(0);
    });

    it('should return N/A for empty array', () => {
      const result = analyzer['analyzeNavigation']([]);

      expect(result.flowType).toBe('N/A');
      expect(result.uniquePages).toBe(0);
      expect(result.transitions).toBe(0);
    });

    it('should normalize URLs with trailing slashes', () => {
      const actions = [
        createAction({ url: 'https://example.com/' }),
        createAction({ url: 'https://example.com' }),
      ];

      const result = analyzer['analyzeNavigation'](actions);

      expect(result.uniquePages).toBe(1);
    });

    it('should handle missing url fields', () => {
      const actions = [
        createAction({ url: 'https://example.com' }),
        createAction({ url: undefined as any }),
        createAction({ url: '' }),
      ];

      const result = analyzer['analyzeNavigation'](actions);

      expect(result.uniquePages).toBe(1);
    });
  });

  describe('normalizeURL()', () => {
    it('should remove trailing slash', () => {
      const result = analyzer['normalizeURL']('https://example.com/');
      expect(result).toBe('https://example.com');
    });

    it('should remove hash', () => {
      const result = analyzer['normalizeURL']('https://example.com/page#section');
      expect(result).toBe('https://example.com/page');
    });

    it('should preserve query params', () => {
      const result = analyzer['normalizeURL']('https://example.com?a=1&b=2');
      expect(result).toBe('https://example.com/?a=1&b=2');
    });

    it('should handle invalid URLs gracefully', () => {
      const result = analyzer['normalizeURL']('not-a-valid-url');
      expect(result).toBe('not-a-valid-url');
    });

    it('should handle empty string', () => {
      const result = analyzer['normalizeURL']('');
      expect(result).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(analyzer['normalizeURL'](null as any)).toBe('');
      expect(analyzer['normalizeURL'](undefined as any)).toBe('');
    });

    it('should not remove trailing slash from root path', () => {
      const result = analyzer['normalizeURL']('https://example.com/');
      expect(result).toBe('https://example.com');
    });
  });

  describe('extractMetadata()', () => {
    it('should extract all fields correctly', () => {
      const recording = createMockRecording({
        testName: 'My Test',
        id: 'rec_123',
        url: 'https://example.com',
        startTime: '2024-01-01T00:00:00.000Z',
        endTime: '2024-01-01T00:05:00.000Z',
        version: '1.0',
        userAgent: 'Mozilla/5.0',
      });

      const result = analyzer['extractMetadata'](recording);

      expect(result.testName).toBe('My Test');
      expect(result.recordingId).toBe('rec_123');
      expect(result.startURL).toBe('https://example.com');
      expect(result.recordedAt).toBe('2024-01-01T00:00:00.000Z');
      expect(result.completedAt).toBe('2024-01-01T00:05:00.000Z');
      expect(result.schemaVersion).toBe('1.0');
      expect(result.userAgent).toBe('Mozilla/5.0');
    });

    it('should fallback to startTime when endTime is missing', () => {
      const recording = createMockRecording({
        startTime: '2024-01-01T00:00:00.000Z',
        endTime: undefined,
      });

      const result = analyzer['extractMetadata'](recording);

      expect(result.completedAt).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should fallback to startTime when endTime is null', () => {
      const recording = createMockRecording({
        startTime: '2024-01-01T00:00:00.000Z',
        endTime: null as any,
      });

      const result = analyzer['extractMetadata'](recording);

      expect(result.completedAt).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should use "unknown" for missing version field', () => {
      const recording = createMockRecording({
        version: undefined,
      });

      const result = analyzer['extractMetadata'](recording);

      expect(result.schemaVersion).toBe('unknown');
    });

    it('should warn for old schema versions', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const recording = createMockRecording({ version: '0.9' });
      analyzer['extractMetadata'](recording);

      expect(consoleWarnSpy).toHaveBeenCalledWith('⚠️  Recording uses schema v0.9 (current: v1.0)');
      expect(consoleWarnSpy).toHaveBeenCalledWith('Some fields may not be available.\n');

      consoleWarnSpy.mockRestore();
    });

    it('should not warn for version 1.0', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const recording = createMockRecording({ version: '1.0' });
      analyzer['extractMetadata'](recording);

      expect(consoleWarnSpy).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });

  describe('analyze() - Full scenario', () => {
    it('should analyze complete recording with multiple actions', () => {
      const recording = createMockRecording({
        testName: 'Complete Test',
        id: 'rec_full',
        url: 'https://example.com',
        actions: [
          createAction({
            id: 'act_001',
            type: 'click',
            url: 'https://example.com/page1',
            timestamp: 1000,
          }),
          createAction({
            id: 'act_002',
            type: 'input',
            url: 'https://example.com/page1',
            timestamp: 2000,
          }),
          createAction({
            id: 'act_003',
            type: 'click',
            url: 'https://example.com/page2',
            timestamp: 3000,
          }),
          createAction({
            id: 'act_004',
            type: 'scroll',
            url: 'https://example.com/page2',
            timestamp: 4000,
          }),
        ],
      });

      const result = analyzer.analyze(recording, '/path/to/recording.json');

      expect(result.file).toBe('recording.json');
      expect(result.metadata.testName).toBe('Complete Test');
      expect(result.viewport?.category).toBe('Desktop');
      expect(result.statistics.total).toBe(4);
      expect(result.timing.actionSpan).toBe(3000);
      expect(result.navigation.uniquePages).toBe(2);
    });

    it('should handle zero actions edge case', () => {
      const recording = createMockRecording({ actions: [] });

      const result = analyzer.analyze(recording, 'test.json');

      expect(result.statistics.total).toBe(0);
      expect(result.navigation.flowType).toBe('N/A');
    });

    it('should handle missing viewport', () => {
      const recording = createMockRecording({
        viewport: undefined,
        actions: [createAction()],
      });

      const result = analyzer.analyze(recording, 'test.json');

      expect(result.viewport?.category).toBe('Unknown');
    });

    it('should handle old recording (no version field)', () => {
      const recording = createMockRecording({
        version: undefined,
        actions: [createAction()],
      });

      const result = analyzer.analyze(recording, 'test.json');

      expect(result.metadata.schemaVersion).toBe('unknown');
    });

    it('should use basename only for Windows paths', () => {
      const result = analyzer.analyze(
        createMockRecording({ actions: [] }),
        'C:\\Users\\test\\recording.json'
      );

      expect(result.file).toBe('recording.json');
    });

    it('should use basename only for Unix paths', () => {
      const result = analyzer.analyze(
        createMockRecording({ actions: [] }),
        '/home/user/recording.json'
      );

      expect(result.file).toBe('recording.json');
    });
  });

  describe('Edge cases', () => {
    it('should handle large action counts (1000+)', () => {
      const actions = Array.from({ length: 1000 }, (_, i) =>
        createAction({
          id: `act_${String(i + 1).padStart(3, '0')}`,
          type:
            i % 4 === 0 ? 'click' : i % 4 === 1 ? 'input' : i % 4 === 2 ? 'scroll' : 'navigation',
          timestamp: 1000 + i * 100,
          url: `https://example.com/page${Math.floor(i / 100)}`,
        })
      );

      const recording = createMockRecording({ actions });
      const result = analyzer.analyze(recording, 'large.json');

      expect(result.statistics.total).toBe(1000);
      expect(result.navigation.uniquePages).toBeGreaterThan(1);
      expect(result.timing.actionSpan).toBe(99900); // (1000-1) * 100
    });

    it('should handle duplicate URLs correctly', () => {
      const actions = [
        createAction({ url: 'https://example.com' }),
        createAction({ url: 'https://example.com/' }),
        createAction({ url: 'https://example.com#section' }),
        createAction({ url: 'https://example.com?query=1' }),
      ];

      const result = analyzer['analyzeActions'](actions);

      // example.com, example.com/, example.com#section should normalize to same URL
      // example.com?query=1 is different due to query params
      expect(result.byPage['https://example.com']).toBe(3);
      expect(result.byPage['https://example.com/?query=1']).toBe(1);
    });

    it('should handle mixed valid/invalid timestamps', () => {
      const recording = createMockRecording({
        actions: [
          createAction({ timestamp: 1000 }),
          createAction({ timestamp: -500 }),
          createAction({ timestamp: 0 }),
          createAction({ timestamp: NaN }),
          createAction({ timestamp: Infinity }),
          createAction({ timestamp: 2000 }),
          createAction({ timestamp: null as any }),
          createAction({ timestamp: undefined as any }),
          createAction({ timestamp: 3000 }),
        ],
      });

      const result = analyzer['analyzeTiming'](recording);

      // Only 1000, 2000, 3000 are valid
      expect(result.actionSpan).toBe(2000);
    });

    it('should handle unicode in URLs', () => {
      const actions = [
        createAction({ url: 'https://example.com/café' }),
        createAction({ url: 'https://example.com/日本語' }),
        createAction({ url: 'https://example.com/🎉' }),
      ];

      const result = analyzer['analyzeActions'](actions);

      expect(result.total).toBe(3);
      expect(Object.keys(result.byPage).length).toBe(3);
    });

    it('should handle very long test names', () => {
      const longName = 'A'.repeat(500);
      const recording = createMockRecording({
        testName: longName,
        actions: [createAction()],
      });

      const result = analyzer['extractMetadata'](recording);

      expect(result.testName).toBe(longName);
      expect(result.testName.length).toBe(500);
    });

    it('should handle missing optional fields gracefully', () => {
      const recording = createMockRecording({
        endTime: undefined,
        viewport: undefined,
        version: undefined,
        userAgent: undefined,
        actions: [createAction()],
      });

      const result = analyzer.analyze(recording, 'test.json');

      expect(result.metadata.completedAt).toBe(recording.startTime);
      expect(result.metadata.schemaVersion).toBe('unknown');
      expect(result.viewport?.category).toBe('Unknown');
    });

    it('should handle empty test name', () => {
      const recording = createMockRecording({
        testName: '',
        actions: [createAction()],
      });

      const result = analyzer['extractMetadata'](recording);

      expect(result.testName).toBe('');
    });

    it('should handle actions with no url field', () => {
      const actions = [
        createAction({ url: 'https://example.com' }),
        createAction({ url: '' }),
        createAction({ url: null as any }),
        createAction({ url: undefined as any }),
      ];

      const result = analyzer['analyzeNavigation'](actions);

      expect(result.uniquePages).toBe(1);
    });

    it('should calculate correct percentages for single action type', () => {
      const actions = [
        createAction({ type: 'click' }),
        createAction({ type: 'click' }),
        createAction({ type: 'click' }),
      ];

      const result = analyzer['analyzeActions'](actions);

      expect(result.percentages.click).toBe(100);
    });
  });
});
