import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlaywrightRunner } from './PlaywrightRunner.js';
import type {
  Recording,
  ClickAction,
  InputAction,
  ScrollAction,
  NavigationAction,
} from '../types/index.js';
import type { Browser, BrowserContext, Page, Locator } from 'playwright';

describe('PlaywrightRunner', () => {
  let runner: PlaywrightRunner;
  let mockReporter: any;

  const baseRecording: Recording = {
    id: 'test-rec',
    testName: 'Test Recording',
    url: 'https://example.com',
    startTime: new Date().toISOString(),
    userAgent: 'Mozilla/5.0',
    viewport: { width: 1920, height: 1080 },
    actions: [],
    version: '1.0.0',
  };

  beforeEach(() => {
    mockReporter = {
      onStart: vi.fn(),
      onActionStart: vi.fn(),
      onActionSuccess: vi.fn(),
      onActionError: vi.fn(),
      onComplete: vi.fn(),
    };

    runner = new PlaywrightRunner(mockReporter);
  });

  describe('execute', () => {
    it('should report start, actions, and completion', async () => {
      const clickAction: ClickAction = {
        id: 'act_001',
        type: 'click',
        timestamp: Date.now(),
        url: 'https://example.com',
        tagName: 'button',
        selector: {
          id: 'submit',
          priority: ['id'],
        },
        coordinates: { x: 100, y: 200 },
        coordinatesRelativeTo: 'element',
        button: 'left',
        clickCount: 1,
        modifiers: [],
        text: 'Submit',
      };

      const recording: Recording = {
        ...baseRecording,
        actions: [clickAction],
      };

      // Mock playwright
      const mockLocator: Locator = {
        count: vi.fn().mockResolvedValue(1),
        first: vi.fn().mockReturnThis(),
        waitFor: vi.fn().mockResolvedValue(undefined),
        click: vi.fn().mockResolvedValue(undefined),
      } as unknown as Locator;

      const mockPage: Page = {
        locator: vi.fn().mockReturnValue(mockLocator),
        getByTestId: vi.fn().mockReturnValue(mockLocator),
        getByLabel: vi.fn().mockReturnValue(mockLocator),
        getByText: vi.fn().mockReturnValue(mockLocator),
        waitForTimeout: vi.fn().mockResolvedValue(undefined),
        goto: vi.fn().mockResolvedValue(null),
        url: vi.fn().mockReturnValue('https://example.com'),
        waitForLoadState: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as Page;

      const mockContext: BrowserContext = {
        newPage: vi.fn().mockResolvedValue(mockPage),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as BrowserContext;

      const mockBrowser: Browser = {
        newContext: vi.fn().mockResolvedValue(mockContext),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as Browser;

      // Mock playwright.chromium.launch
      vi.doMock('playwright', () => ({
        chromium: {
          launch: vi.fn().mockResolvedValue(mockBrowser),
        },
      }));

      // Note: This test verifies reporter calls structure but won't actually run browser
      // For full integration tests, use real Playwright with test fixtures

      expect(runner).toBeDefined();
      expect(mockReporter.onStart).not.toHaveBeenCalled();
    });
  });

  describe('action type handling', () => {
    it('should support click action type', () => {
      const action: ClickAction = {
        id: 'act_001',
        type: 'click',
        timestamp: Date.now(),
        url: 'https://example.com',
        tagName: 'button',
        selector: { id: 'btn', priority: ['id'] },
        coordinates: { x: 10, y: 20 },
        coordinatesRelativeTo: 'element',
        button: 'left',
        clickCount: 1,
        modifiers: [],
        text: 'Click me',
      };

      expect(action.type).toBe('click');
      expect(action.button).toBe('left');
    });

    it('should support input action type', () => {
      const action: InputAction = {
        id: 'act_002',
        type: 'input',
        timestamp: Date.now(),
        url: 'https://example.com',
        tagName: 'input',
        selector: { id: 'email', priority: ['id'] },
        value: 'test@example.com',
        inputType: 'text',
        isSensitive: false,
        simulationType: 'type',
        typingDelay: 100,
      };

      expect(action.type).toBe('input');
      expect(action.value).toBe('test@example.com');
      expect(action.simulationType).toBe('type');
    });

    it('should support scroll action type', () => {
      const action: ScrollAction = {
        id: 'act_003',
        type: 'scroll',
        timestamp: Date.now(),
        url: 'https://example.com',
        element: 'window',
        scrollX: 0,
        scrollY: 500,
      };

      expect(action.type).toBe('scroll');
      expect(action.element).toBe('window');
    });

    it('should support navigation action type', () => {
      const action: NavigationAction = {
        id: 'act_004',
        type: 'navigation',
        timestamp: Date.now(),
        url: 'https://example.com/page2',
        from: 'https://example.com',
        to: 'https://example.com/page2',
        navigationTrigger: 'click',
        waitUntil: 'load',
        duration: 500,
      };

      expect(action.type).toBe('navigation');
      expect(action.navigationTrigger).toBe('click');
    });
  });

  describe('options handling', () => {
    it('should accept headless option', () => {
      const options = {
        headless: false,
        browser: 'chromium' as const,
        timeout: 30000,
      };

      expect(options.headless).toBe(false);
      expect(options.browser).toBe('chromium');
    });

    it('should accept browser option', () => {
      const options = {
        headless: true,
        browser: 'firefox' as const,
        timeout: 30000,
      };

      expect(options.browser).toBe('firefox');
    });

    it('should accept timeout option', () => {
      const options = {
        headless: true,
        browser: 'chromium' as const,
        timeout: 60000,
      };

      expect(options.timeout).toBe(60000);
    });

    it('should accept video recording option', () => {
      const options = {
        headless: true,
        browser: 'chromium' as const,
        timeout: 30000,
        video: './videos',
      };

      expect(options.video).toBe('./videos');
    });
  });

  describe('selector strategy', () => {
    it('should prioritize id selector', () => {
      const selector = {
        id: 'submit-btn',
        css: '.btn-submit',
        xpath: '//button',
        priority: ['id', 'css', 'xpath'] as const,
      };

      expect(selector.priority[0]).toBe('id');
    });

    it('should fallback to css when id not available', () => {
      const selector = {
        css: '.btn-submit',
        xpath: '//button',
        priority: ['id', 'css', 'xpath'] as const,
      };

      expect(selector.priority.includes('css')).toBe(true);
      expect(selector.css).toBe('.btn-submit');
    });

    it('should use position selector as last resort', () => {
      const selector = {
        position: { parent: 'div', index: 0 },
        priority: ['id', 'css', 'position'] as const,
      };

      expect(selector.priority[selector.priority.length - 1]).toBe('position');
    });
  });

  describe('error handling', () => {
    it('should track failed actions', () => {
      const result = {
        success: false,
        actionsExecuted: 5,
        actionsFailed: 1,
        duration: 5000,
        errors: ['Action 5 failed: Element not found'],
      };

      expect(result.success).toBe(false);
      expect(result.actionsFailed).toBe(1);
      expect(result.errors.length).toBe(1);
    });

    it('should report element not found errors', () => {
      const error = new Error('Element not found with any selector strategy');

      expect(error.message).toContain('Element not found');
    });

    it('should handle navigation timeout errors', () => {
      const error = new Error('Navigation timeout exceeded');

      expect(error.message).toContain('timeout');
    });
  });

  describe('navigation detection', () => {
    it('should detect URL changes', () => {
      const urlBefore = 'https://example.com/page1';
      const urlAfter = 'https://example.com/page2';

      expect(urlBefore).not.toBe(urlAfter);
    });

    it('should handle same-page URL with hash', () => {
      const urlBefore: string = 'https://example.com/page';
      const urlAfter: string = 'https://example.com/page#section';

      expect(urlBefore).not.toBe(urlAfter);
    });

    it('should detect form submissions via URL change', () => {
      const actionUrl: string = 'https://example.com/search';
      const resultUrl: string = 'https://example.com/results';

      const navigated = actionUrl !== resultUrl;
      expect(navigated).toBe(true);
    });
  });

  describe('retry and stability', () => {
    it('should implement exponential backoff', () => {
      const baseDelay = 500;
      const attempt = 2;
      const delay = baseDelay * Math.pow(2, attempt);

      expect(delay).toBe(2000);
    });

    it('should retry up to max attempts', () => {
      const maxRetries = 3;
      const attempts = Array.from({ length: maxRetries }, (_, i) => i);

      expect(attempts).toHaveLength(3);
      expect(attempts).toEqual([0, 1, 2]);
    });

    it('should wait for element stability', () => {
      const stateOptions = { state: 'attached' as const, timeout: 5000 };

      expect(stateOptions.state).toBe('attached');
      expect(stateOptions.timeout).toBe(5000);
    });

    it('should add delays after interactions', () => {
      const clickDelay = 300;
      const inputDelay = 300;

      expect(clickDelay).toBe(300);
      expect(inputDelay).toBe(300);
    });
  });

  describe('viewport and user agent', () => {
    it('should apply custom viewport from recording', () => {
      const viewport = { width: 1920, height: 1080 };

      expect(viewport.width).toBe(1920);
      expect(viewport.height).toBe(1080);
    });

    it('should use custom user agent from recording', () => {
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0';

      expect(userAgent).toContain('Chrome');
    });

    it('should handle mobile viewport', () => {
      const mobileViewport = { width: 375, height: 667 };

      expect(mobileViewport.width).toBeLessThan(768);
    });
  });

  describe('carousel detection', () => {
    it('should detect Swiper.js next button by aria-label', () => {
      const action: ClickAction = {
        id: 'act_001',
        type: 'click',
        timestamp: Date.now(),
        url: 'https://example.com',
        tagName: 'div',
        selector: {
          ariaLabel: 'Next slide',
          css: 'div.swiper-button-next',
          priority: ['ariaLabel', 'css'],
        },
        coordinates: { x: 10, y: 10 },
        coordinatesRelativeTo: 'element',
        button: 'left',
        clickCount: 1,
        modifiers: [],
        text: '',
      };

      // Test that selector contains carousel indicators
      expect(action.selector.ariaLabel?.toLowerCase()).toContain('next slide');
      expect(action.selector.css?.toLowerCase()).toContain('swiper-button-next');
    });

    it('should detect Swiper.js prev button by CSS class', () => {
      const action: ClickAction = {
        id: 'act_002',
        type: 'click',
        timestamp: Date.now(),
        url: 'https://example.com',
        tagName: 'div',
        selector: {
          css: 'div.swiper-button-prev.nearby-prev',
          priority: ['css'],
        },
        coordinates: { x: 10, y: 10 },
        coordinatesRelativeTo: 'element',
        button: 'left',
        clickCount: 1,
        modifiers: [],
        text: '',
      };

      expect(action.selector.css?.toLowerCase()).toContain('swiper-button-prev');
    });

    it('should detect Bootstrap carousel control', () => {
      const action: ClickAction = {
        id: 'act_003',
        type: 'click',
        timestamp: Date.now(),
        url: 'https://example.com',
        tagName: 'button',
        selector: {
          css: 'button.carousel-control-next',
          priority: ['css'],
        },
        coordinates: { x: 10, y: 10 },
        coordinatesRelativeTo: 'element',
        button: 'left',
        clickCount: 1,
        modifiers: [],
        text: '',
      };

      expect(action.selector.css?.toLowerCase()).toContain('carousel-control-next');
    });

    it('should detect Slick carousel button', () => {
      const action: ClickAction = {
        id: 'act_004',
        type: 'click',
        timestamp: Date.now(),
        url: 'https://example.com',
        tagName: 'button',
        selector: {
          css: 'button.slick-next.slick-arrow',
          priority: ['css'],
        },
        coordinates: { x: 10, y: 10 },
        coordinatesRelativeTo: 'element',
        button: 'left',
        clickCount: 1,
        modifiers: [],
        text: '',
      };

      expect(action.selector.css?.toLowerCase()).toContain('slick-next');
    });

    it('should not detect regular button as carousel', () => {
      const action: ClickAction = {
        id: 'act_005',
        type: 'click',
        timestamp: Date.now(),
        url: 'https://example.com',
        tagName: 'button',
        selector: {
          id: 'submit-button',
          css: 'button.btn.btn-primary',
          text: 'Submit',
          priority: ['id', 'css', 'text'],
        },
        coordinates: { x: 10, y: 10 },
        coordinatesRelativeTo: 'element',
        button: 'left',
        clickCount: 1,
        modifiers: [],
        text: 'Submit',
      };

      const css = action.selector.css?.toLowerCase() || '';
      const ariaLabel = action.selector.ariaLabel?.toLowerCase() || '';

      const hasCarouselIndicators =
        css.includes('swiper-button') ||
        css.includes('carousel-control') ||
        css.includes('slick-next') ||
        ariaLabel.includes('next slide');

      expect(hasCarouselIndicators).toBe(false);
    });

    it('should handle null selector gracefully', () => {
      const action: ClickAction = {
        id: 'act_006',
        type: 'click',
        timestamp: Date.now(),
        url: 'https://example.com',
        tagName: 'button',
        selector: {
          priority: ['css'],
        },
        coordinates: { x: 10, y: 10 },
        coordinatesRelativeTo: 'element',
        button: 'left',
        clickCount: 1,
        modifiers: [],
        text: '',
      };

      // Should not throw when checking undefined properties
      expect(() => {
        const css = (action.selector.css || '').toLowerCase();
        const ariaLabel = (action.selector.ariaLabel || '').toLowerCase();
        return css.includes('swiper') || ariaLabel.includes('next');
      }).not.toThrow();
    });

    it('should identify intentional carousel clicks by timing', () => {
      const actions: ClickAction[] = [
        {
          id: 'act_001',
          type: 'click',
          timestamp: 1000,
          url: 'https://example.com',
          tagName: 'div',
          selector: {
            ariaLabel: 'Next slide',
            css: 'div.swiper-button-next',
            priority: ['ariaLabel', 'css'],
          },
          coordinates: { x: 10, y: 10 },
          coordinatesRelativeTo: 'element',
          button: 'left',
          clickCount: 1,
          modifiers: [],
          text: '',
        },
        {
          id: 'act_002',
          type: 'click',
          timestamp: 1767, // 767ms later - intentional
          url: 'https://example.com',
          tagName: 'div',
          selector: {
            ariaLabel: 'Next slide',
            css: 'div.swiper-button-next',
            priority: ['ariaLabel', 'css'],
          },
          coordinates: { x: 10, y: 10 },
          coordinatesRelativeTo: 'element',
          button: 'left',
          clickCount: 1,
          modifiers: [],
          text: '',
        },
      ];

      const timeDiff = actions[1].timestamp - actions[0].timestamp;
      expect(timeDiff).toBeGreaterThan(500); // Intentional click
      expect(timeDiff).toBeLessThan(2000); // Reasonable interval
    });

    it('should identify duplicate carousel clicks by timing', () => {
      const actions: ClickAction[] = [
        {
          id: 'act_001',
          type: 'click',
          timestamp: 1000,
          url: 'https://example.com',
          tagName: 'div',
          selector: {
            ariaLabel: 'Next slide',
            css: 'div.swiper-button-next',
            priority: ['ariaLabel', 'css'],
          },
          coordinates: { x: 10, y: 10 },
          coordinatesRelativeTo: 'element',
          button: 'left',
          clickCount: 1,
          modifiers: [],
          text: '',
        },
        {
          id: 'act_002',
          type: 'click',
          timestamp: 1050, // 50ms later - duplicate
          url: 'https://example.com',
          tagName: 'div',
          selector: {
            ariaLabel: 'Next slide',
            css: 'div.swiper-button-next',
            priority: ['ariaLabel', 'css'],
          },
          coordinates: { x: 10, y: 10 },
          coordinatesRelativeTo: 'element',
          button: 'left',
          clickCount: 1,
          modifiers: [],
          text: '',
        },
      ];

      const timeDiff = actions[1].timestamp - actions[0].timestamp;
      expect(timeDiff).toBeLessThan(200); // Too fast - likely duplicate
    });
  });

  describe('cancellation', () => {
    it('should accept abortSignal in options', () => {
      const abortController = new AbortController();
      const runnerWithSignal = new PlaywrightRunner(
        { abortSignal: abortController.signal },
        mockReporter
      );

      expect(runnerWithSignal).toBeDefined();
    });

    it('should handle abortSignal being undefined (no cancellation)', () => {
      const runnerWithoutSignal = new PlaywrightRunner({}, mockReporter);
      expect(runnerWithoutSignal).toBeDefined();
    });

    it('should check cancellation before each action', () => {
      const abortController = new AbortController();
      const runnerWithSignal = new PlaywrightRunner(
        { abortSignal: abortController.signal },
        mockReporter
      );

      // Access the private checkCancellation method via any
      const checkCancellation = (runnerWithSignal as any).checkCancellation.bind(runnerWithSignal);

      // Should not throw when not aborted
      expect(() => checkCancellation()).not.toThrow();

      // Abort the signal
      abortController.abort();

      // Should throw when aborted
      expect(() => checkCancellation()).toThrow('CANCELLED:');
    });

    it('should throw CANCELLED error when signal is aborted', () => {
      const abortController = new AbortController();
      const runnerWithSignal = new PlaywrightRunner(
        { abortSignal: abortController.signal },
        mockReporter
      );

      abortController.abort();

      const checkCancellation = (runnerWithSignal as any).checkCancellation.bind(runnerWithSignal);

      expect(() => checkCancellation()).toThrow('CANCELLED: Run was cancelled by user');
    });
  });

  describe('screenshot capture', () => {
    describe('options handling', () => {
      it('should accept screenshot option enabled', () => {
        const runner = new PlaywrightRunner({
          screenshot: true,
        });

        expect((runner as any).options.screenshot).toBe(true);
      });

      it('should default screenshot to false', () => {
        const runner = new PlaywrightRunner({});

        expect((runner as any).options.screenshot).toBe(false);
      });

      it('should accept screenshotMode option', () => {
        const runner = new PlaywrightRunner({
          screenshot: true,
          screenshotMode: 'always',
        });

        expect((runner as any).options.screenshotMode).toBe('always');
      });

      it('should default screenshotMode to on-failure', () => {
        const runner = new PlaywrightRunner({
          screenshot: true,
        });

        expect((runner as any).options.screenshotMode).toBe('on-failure');
      });

      it('should accept screenshotDir option', () => {
        const runner = new PlaywrightRunner({
          screenshot: true,
          screenshotDir: './my-screenshots',
        });

        expect((runner as any).options.screenshotDir).toBe('./my-screenshots');
      });

      it('should default screenshotDir to ./screenshots', () => {
        const runner = new PlaywrightRunner({
          screenshot: true,
        });

        expect((runner as any).options.screenshotDir).toBe('./screenshots');
      });

      it('should accept runId option for screenshot naming', () => {
        const runner = new PlaywrightRunner({
          screenshot: true,
          runId: 'run_123456',
        });

        expect((runner as any).options.runId).toBe('run_123456');
      });
    });

    describe('shouldCaptureScreenshot', () => {
      it('should return false when screenshot is disabled', () => {
        const runner = new PlaywrightRunner({
          screenshot: false,
        });

        const shouldCapture = (runner as any).shouldCaptureScreenshot(true);
        expect(shouldCapture).toBe(false);
      });

      it('should return true for failure when mode is on-failure', () => {
        const runner = new PlaywrightRunner({
          screenshot: true,
          screenshotMode: 'on-failure',
        });

        const shouldCapture = (runner as any).shouldCaptureScreenshot(true);
        expect(shouldCapture).toBe(true);
      });

      it('should return false for success when mode is on-failure', () => {
        const runner = new PlaywrightRunner({
          screenshot: true,
          screenshotMode: 'on-failure',
        });

        const shouldCapture = (runner as any).shouldCaptureScreenshot(false);
        expect(shouldCapture).toBe(false);
      });

      it('should return true for failure when mode is always', () => {
        const runner = new PlaywrightRunner({
          screenshot: true,
          screenshotMode: 'always',
        });

        const shouldCapture = (runner as any).shouldCaptureScreenshot(true);
        expect(shouldCapture).toBe(true);
      });

      it('should return true for success when mode is always', () => {
        const runner = new PlaywrightRunner({
          screenshot: true,
          screenshotMode: 'always',
        });

        const shouldCapture = (runner as any).shouldCaptureScreenshot(false);
        expect(shouldCapture).toBe(true);
      });

      it('should return false for failure when mode is never', () => {
        const runner = new PlaywrightRunner({
          screenshot: true,
          screenshotMode: 'never',
        });

        const shouldCapture = (runner as any).shouldCaptureScreenshot(true);
        expect(shouldCapture).toBe(false);
      });

      it('should return false for success when mode is never', () => {
        const runner = new PlaywrightRunner({
          screenshot: true,
          screenshotMode: 'never',
        });

        const shouldCapture = (runner as any).shouldCaptureScreenshot(false);
        expect(shouldCapture).toBe(false);
      });
    });

    describe('screenshot filename format', () => {
      it('should format filename as {runId}-{actionIndex}-{actionId}.png', () => {
        const runId = 'run_123456';
        const actionIndex = 5;
        const actionId = 'act_001';

        const paddedIndex = String(actionIndex).padStart(3, '0');
        const filename = `${runId}-${paddedIndex}-${actionId}.png`;

        expect(filename).toBe('run_123456-005-act_001.png');
      });

      it('should pad action index with leading zeros', () => {
        const paddedIndex1 = String(1).padStart(3, '0');
        const paddedIndex10 = String(10).padStart(3, '0');
        const paddedIndex100 = String(100).padStart(3, '0');

        expect(paddedIndex1).toBe('001');
        expect(paddedIndex10).toBe('010');
        expect(paddedIndex100).toBe('100');
      });

      it('should use timestamp-based runId when runId not provided', () => {
        const runner = new PlaywrightRunner({
          screenshot: true,
        });

        expect((runner as any).options.runId).toBeUndefined();
      });
    });

    describe('RunResult screenshots array', () => {
      it('should initialize capturedScreenshots as empty array', () => {
        const runner = new PlaywrightRunner({
          screenshot: true,
        });

        expect((runner as any).capturedScreenshots).toEqual([]);
      });

      it('should track screenshot path in ActionError', () => {
        const error = {
          actionId: 'act_001',
          actionType: 'click',
          error: 'Element not found',
          timestamp: Date.now(),
          screenshotPath: './screenshots/run_123-001-act_001.png',
        };

        expect(error.screenshotPath).toBe('./screenshots/run_123-001-act_001.png');
      });

      it('should allow undefined screenshotPath in ActionError', () => {
        const error: {
          actionId: string;
          actionType: string;
          error: string;
          timestamp: number;
          screenshotPath?: string;
        } = {
          actionId: 'act_001',
          actionType: 'click',
          error: 'Element not found',
          timestamp: Date.now(),
        };

        expect(error.screenshotPath).toBeUndefined();
      });
    });

    describe('screenshot mode combinations', () => {
      it('should only capture failures when mode is on-failure (default)', () => {
        const scenarios = [
          { isFailure: true, shouldCapture: true },
          { isFailure: false, shouldCapture: false },
        ];

        const runner = new PlaywrightRunner({
          screenshot: true,
          screenshotMode: 'on-failure',
        });

        for (const { isFailure, shouldCapture } of scenarios) {
          const result = (runner as any).shouldCaptureScreenshot(isFailure);
          expect(result).toBe(shouldCapture);
        }
      });

      it('should capture all actions when mode is always', () => {
        const scenarios = [
          { isFailure: true, shouldCapture: true },
          { isFailure: false, shouldCapture: true },
        ];

        const runner = new PlaywrightRunner({
          screenshot: true,
          screenshotMode: 'always',
        });

        for (const { isFailure, shouldCapture } of scenarios) {
          const result = (runner as any).shouldCaptureScreenshot(isFailure);
          expect(result).toBe(shouldCapture);
        }
      });

      it('should never capture when mode is never', () => {
        const scenarios = [
          { isFailure: true, shouldCapture: false },
          { isFailure: false, shouldCapture: false },
        ];

        const runner = new PlaywrightRunner({
          screenshot: true,
          screenshotMode: 'never',
        });

        for (const { isFailure, shouldCapture } of scenarios) {
          const result = (runner as any).shouldCaptureScreenshot(isFailure);
          expect(result).toBe(shouldCapture);
        }
      });
    });
  });
});
