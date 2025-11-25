import {
  chromium,
  firefox,
  webkit,
  type Browser,
  type BrowserContext,
  type Page,
} from 'playwright';
import type { Recording, Action, ClickAction, InputAction, ScrollAction } from '../types/index.js';
import type { RunOptions, RunResult, Reporter } from '../types/runner.js';
import { ElementLocator } from './ElementLocator.js';
import { isClickAction, isInputAction, isScrollAction } from '../types/index.js';

/**
 * Main Playwright test runner
 */
export class PlaywrightRunner {
  private options: Required<RunOptions>;
  private elementLocator: ElementLocator;
  private reporter?: Reporter;

  constructor(options: RunOptions = {}, reporter?: Reporter) {
    this.options = {
      headless: options.headless ?? true,
      browser: options.browser ?? 'chromium',
      video: options.video ?? false,
      screenshot: options.screenshot ?? false,
      timeout: options.timeout ?? 30000,
    };
    this.elementLocator = new ElementLocator();
    this.reporter = reporter;
  }

  /**
   * Execute recording
   */
  async execute(recording: Recording): Promise<RunResult> {
    const startTime = Date.now();
    let browser: Browser | null = null;
    let context: BrowserContext | null = null;
    let page: Page | null = null;

    const result: RunResult = {
      status: 'success',
      duration: 0,
      actionsTotal: recording.actions.length,
      actionsExecuted: 0,
      actionsFailed: 0,
      errors: [],
    };

    try {
      // Launch browser
      browser = await this.launchBrowser();

      // Create context with viewport
      context = await browser.newContext({
        viewport: recording.viewport,
        userAgent: recording.userAgent,
        recordVideo: this.options.video ? { dir: './videos' } : undefined,
      });

      // Create page
      page = await context.newPage();

      // Set default timeout
      page.setDefaultTimeout(this.options.timeout);

      // Navigate to start URL
      await page.goto(recording.url, { waitUntil: 'domcontentloaded' });

      // Notify start
      this.reporter?.onStart({
        testName: recording.testName,
        actionsTotal: recording.actions.length,
      });

      // Execute each action
      for (let i = 0; i < recording.actions.length; i++) {
        const action = recording.actions[i];

        try {
          this.reporter?.onActionStart(action, i + 1);

          const actionStartTime = Date.now();
          await this.executeAction(page, action);
          const actionDuration = Date.now() - actionStartTime;

          result.actionsExecuted++;
          this.reporter?.onActionSuccess(action, i + 1, actionDuration);
        } catch (error) {
          result.actionsFailed++;
          result.errors.push({
            actionId: action.id,
            actionType: action.type,
            error: error instanceof Error ? error.message : String(error),
            timestamp: Date.now(),
          });
          this.reporter?.onActionError(action, i + 1, error as Error);

          // If any action fails, mark as partial/failed
          result.status = result.actionsFailed === recording.actions.length ? 'failed' : 'partial';
        }
      }

      // Get video path if recorded
      if (this.options.video && page.video()) {
        result.video = await page.video()!.path();
      }
    } finally {
      // Cleanup
      if (page) await page.close();
      if (context) await context.close();
      if (browser) await browser.close();

      result.duration = Date.now() - startTime;
      this.reporter?.onComplete(result);
    }

    return result;
  }

  /**
   * Execute individual action
   */
  private async executeAction(page: Page, action: Action): Promise<void> {
    if (isClickAction(action)) {
      await this.executeClick(page, action);
    } else if (isInputAction(action)) {
      await this.executeInput(page, action);
    } else if (isScrollAction(action)) {
      await this.executeScroll(page, action);
    } else if (action.type === 'navigation') {
      // Navigation is often triggered by click/submit, so we just wait
      await page.waitForURL(action.url, { timeout: this.options.timeout });
    }
    // Add more action types as needed
  }

  /**
   * Execute click action
   */
  private async executeClick(page: Page, action: ClickAction): Promise<void> {
    try {
      const element = await this.elementLocator.findElement(page, action.selector);

      // Wait for element to be visible, enabled, and stable (not animating)
      await element.waitFor({ state: 'visible', timeout: this.options.timeout });
      
      // Click with automatic retry and waiting for actionability
      // This might trigger navigation, so we handle it gracefully
      await Promise.race([
        element.click({
          button: action.button === 'left' ? 'left' : action.button === 'right' ? 'right' : 'middle',
          clickCount: action.clickCount,
          timeout: this.options.timeout,
          force: false, // Don't force click - wait for element to be properly clickable
        }),
        page.waitForNavigation({ timeout: 1000 }).catch(() => {
          // Navigation might not happen, that's ok
        }),
      ]);

      // Wait for any animations/dropdowns to close after click
      await page.waitForTimeout(300);
    } catch (error: any) {
      // If element not found and page URL has changed, consider click successful (form already submitted)
      if (error.message?.includes('Element not found') && page.url() !== action.url) {
        return; // Page navigated, element no longer exists - that's expected
      }
      // If page is closed or navigating, consider the click successful
      if (error.message?.includes('Target page, context or browser has been closed') ||
          error.message?.includes('Navigation')) {
        return; // Click succeeded, page navigated
      }
      throw error;
    }
  }

  /**
   * Execute input action
   */
  private async executeInput(page: Page, action: InputAction): Promise<void> {
    const element = await this.elementLocator.findElement(page, action.selector);

    // Wait for element to be visible and stable
    await element.waitFor({ state: 'visible', timeout: this.options.timeout });

    // Clear existing value
    await element.clear();

    // Type value
    if (action.simulationType === 'type' && action.typingDelay) {
      await element.type(action.value, { delay: action.typingDelay });
    } else {
      await element.fill(action.value);
    }

    // Wait for autocomplete dropdowns or suggestions to appear
    await page.waitForTimeout(300);
  }

  /**
   * Execute scroll action
   */
  private async executeScroll(page: Page, action: ScrollAction): Promise<void> {
    if (action.element === 'window') {
      // Scroll window
      await page.evaluate(
        ({ x, y }: { x: number; y: number }) => {
          (globalThis as any).window.scrollTo(x, y);
        },
        { x: action.scrollX, y: action.scrollY }
      );
    } else {
      // Scroll element
      const element = await this.elementLocator.findElement(page, action.element);
      await element.evaluate(
        (el: any, { x, y }: { x: number; y: number }) => {
          el.scrollLeft = x;
          el.scrollTop = y;
        },
        { x: action.scrollX, y: action.scrollY }
      );
    }

    // Wait for scroll to complete
    await page.waitForTimeout(200);
  }

  /**
   * Launch browser based on options
   */
  private async launchBrowser(): Promise<Browser> {
    const launchOptions = {
      headless: this.options.headless,
    };

    switch (this.options.browser) {
      case 'chromium':
        return await chromium.launch(launchOptions);
      case 'firefox':
        return await firefox.launch(launchOptions);
      case 'webkit':
        return await webkit.launch(launchOptions);
      default:
        throw new Error(`Unknown browser: ${this.options.browser}`);
    }
  }
}
