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
import { NavigationHistoryManager } from './NavigationHistoryManager.js';
import { NavigationAnalyzer } from './NavigationAnalyzer.js';
import { RecordingParser } from '../parser/RecordingParser.js';
import { isClickAction, isInputAction, isScrollAction } from '../types/index.js';

/**
 * Error severity classification
 */
enum ErrorSeverity {
  FATAL, // Cannot continue (browser closed, page destroyed)
  RECOVERABLE, // Can potentially recover (element not found, timeout)
  EXPECTED, // Not really an error (navigation after submit)
}

/**
 * Main Playwright test runner with enhanced error recovery and intelligent navigation
 */
export class PlaywrightRunner {
  private options: Required<RunOptions>;
  private elementLocator: ElementLocator;
  private navigationHistory: NavigationHistoryManager;
  private navigationAnalyzer: NavigationAnalyzer;
  private reporter?: Reporter;
  private lastAction?: { action: Action; timestamp: number };
  private processedRecording?: Recording;

  constructor(options: RunOptions = {}, reporter?: Reporter) {
    this.options = {
      headless: options.headless ?? true,
      browser: options.browser ?? 'chromium',
      video: options.video ?? false,
      screenshot: options.screenshot ?? false,
      timeout: options.timeout ?? 30000,
      enableTiming: options.enableTiming ?? true,
      timingMode: options.timingMode ?? 'realistic',
      speedMultiplier: options.speedMultiplier ?? 1.0,
      maxActionDelay: options.maxActionDelay ?? 30000,
    };
    this.elementLocator = new ElementLocator();
    this.navigationHistory = new NavigationHistoryManager();
    this.navigationAnalyzer = new NavigationAnalyzer();
    this.reporter = reporter;
  }

  /**
   * Execute recording with intelligent preprocessing and navigation
   */
  async execute(recording: Recording): Promise<RunResult> {
    const startTime = Date.now();
    let browser: Browser | null = null;
    let context: BrowserContext | null = null;
    let page: Page | null = null;

    // Solution 5: Preprocess recording to detect issues
    console.log('\n🔍 Phase 1: Analyzing recording...');
    const { correctedActions, warnings } = this.navigationAnalyzer.preprocessRecording(recording);

    if (warnings.length > 0) {
      console.log(`\n⚠️ Found ${warnings.length} potential issues in recording:`);
      warnings.forEach((w) => console.log(`  - ${w}`));
    }

    // Detect missing prerequisite actions
    const recordingWithCorrections = { ...recording, actions: correctedActions };
    const { insertions } =
      this.navigationAnalyzer.detectMissingPrerequisites(recordingWithCorrections);

    if (insertions.length > 0) {
      console.log(`\n⚠️ Detected ${insertions.length} missing prerequisite actions:`);
      insertions.forEach((ins) => {
        console.log(`   After action ${ins.afterIndex}: ${ins.reason}`);
      });
      console.log('   ℹ️  Platform will attempt to handle these automatically.\n');
    }

    // Normalize timestamps to relative format (milliseconds since start)
    const parser = new RecordingParser();
    const normalizedRecording = parser.normalizeTimestamps(recordingWithCorrections);

    // Use normalized and corrected recording
    this.processedRecording = normalizedRecording;

    const result: RunResult = {
      status: 'success',
      duration: 0,
      actionsTotal: this.processedRecording.actions.length,
      actionsExecuted: 0,
      actionsFailed: 0,
      errors: [],
    };

    try {
      // Launch browser
      console.log('\n🚀 Phase 2: Launching browser...');
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

      // Navigate to start URL and record in history
      console.log(`\n🌐 Navigating to ${recording.url}...`);
      await page.goto(recording.url, { waitUntil: 'domcontentloaded' });
      this.navigationHistory.recordNavigation(recording.url);

      // Notify start
      this.reporter?.onStart({
        testName: recording.testName,
        actionsTotal: this.processedRecording.actions.length,
      });

      console.log('\n▶️ Phase 3: Executing actions...\n');

      // Calculate speed multiplier from options
      const speedMultiplier = this.getSpeedMultiplier();
      const enableTiming = this.options.enableTiming;
      const maxDelay = this.options.maxActionDelay;

      // Track test start time for timing calculations
      const testStartTime = Date.now();

      // Execute each action
      for (let i = 0; i < this.processedRecording!.actions.length; i++) {
        const action = this.processedRecording!.actions[i];

        try {
          // Apply timing delay before action (except first action)
          if (enableTiming && i > 0) {
            const elapsedTime = Date.now() - testStartTime;
            const targetTime = action.timestamp * speedMultiplier;
            const delay = Math.min(targetTime - elapsedTime, maxDelay);

            if (delay > 0) {
              await page.waitForTimeout(delay);
            }
          }

          // Check for duplicate action
          if (this.isDuplicateAction(action)) {
            console.warn(`⚠️ Skipping duplicate action [${i + 1}]: ${action.type}`);
            continue;
          }

          // Solution 3: Enhanced page state validation with auto-correction
          const pageStateCorrected = await this.validateAndCorrectPageState(page, action, i);
          if (!pageStateCorrected) {
            console.warn(
              `⚠️ Skipping action [${i + 1}]: Could not reach expected page (expected ${action.url}, got ${page.url()})`
            );
            result.actionsFailed++;
            result.errors.push({
              actionId: action.id,
              actionType: action.type,
              error: `Page state correction failed - expected ${action.url}`,
              timestamp: Date.now(),
            });
            continue;
          }

          this.reporter?.onActionStart(action, i + 1);

          const actionStartTime = Date.now();
          await this.executeAction(page, action);
          const actionDuration = Date.now() - actionStartTime;

          result.actionsExecuted++;
          this.reporter?.onActionSuccess(action, i + 1, actionDuration);

          // Track last action for duplicate detection
          this.lastAction = { action, timestamp: Date.now() };
        } catch (error) {
          const severity = this.classifyError(error as Error);

          result.actionsFailed++;
          result.errors.push({
            actionId: action.id,
            actionType: action.type,
            error: error instanceof Error ? error.message : String(error),
            timestamp: Date.now(),
          });
          this.reporter?.onActionError(action, i + 1, error as Error);

          // Decide whether to continue or stop
          if (severity === ErrorSeverity.FATAL) {
            console.error('🚨 Fatal error encountered, stopping test execution');
            result.status = 'failed';
            break;
          } else if (severity === ErrorSeverity.RECOVERABLE) {
            // Attempt recovery
            const recovered = await this.attemptRecovery(page, action);
            if (!recovered) {
              console.warn('⚠️ Recovery failed, but continuing with next action');
            }
            result.status = 'partial';
          } else {
            // Expected error (e.g., navigation), continue normally
            result.status =
              result.actionsFailed === recording.actions.length ? 'failed' : 'partial';
          }
        }
      }

      // Get video path if recorded
      if (this.options.video && page.video()) {
        result.video = await page.video()!.path();
      }

      // Add timing info to result
      result.timingEnabled = this.options.enableTiming;
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
   * Get speed multiplier based on timing mode or manual override
   */
  private getSpeedMultiplier(): number {
    // Manual override takes precedence
    if (this.options.speedMultiplier !== undefined && this.options.speedMultiplier !== 1.0) {
      return this.options.speedMultiplier;
    }

    // Preset timing modes
    switch (this.options.timingMode) {
      case 'instant':
        return 0; // No delays
      case 'fast':
        return 0.25; // 4x speed
      case 'realistic':
        return 1.0; // Real speed
      default:
        return 1.0;
    }
  }

  /**
   * Check if current action is a duplicate of the last action
   */
  private isDuplicateAction(action: Action): boolean {
    if (!this.lastAction) return false;

    const timeDiff = Date.now() - this.lastAction.timestamp;
    const lastAct = this.lastAction.action;

    // Check if same type, same element, within 500ms
    const actionSelector = (action as any).selector;
    const lastActSelector = (lastAct as any).selector;

    if (
      timeDiff < 500 &&
      action.type === lastAct.type &&
      actionSelector &&
      lastActSelector &&
      JSON.stringify(actionSelector) === JSON.stringify(lastActSelector)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Solution 3: Validate page state and automatically correct if wrong page
   */
  private async validateAndCorrectPageState(
    page: Page,
    action: Action,
    actionIndex: number
  ): Promise<boolean> {
    try {
      // Skip validation for navigation actions (they handle their own state)
      if (action.type === 'navigation') {
        return true;
      }

      const currentUrl = page.url();
      const expectedUrl = action.url;

      // Compare URLs
      if (this.urlsMatch(currentUrl, expectedUrl)) {
        return true; // Already on correct page
      }

      // Page mismatch detected - attempt auto-correction
      console.warn(`⚠️ Page state mismatch detected before action [${actionIndex + 1}]:`);
      console.warn(`   Expected: ${expectedUrl}`);
      console.warn(`   Current:  ${currentUrl}`);
      console.warn(`   🔧 Attempting auto-correction...`);

      // Strategy 1: Check if we just need to navigate to the expected page
      try {
        // Use intelligent navigation history
        const navResult = await this.navigationHistory.navigate(
          page,
          expectedUrl,
          this.options.timeout
        );

        if (navResult.success) {
          console.log(`✓ Auto-correction successful using ${navResult.method}`);
          return true;
        }
      } catch (navError) {
        console.warn(`⚠️ Navigation attempt failed: ${navError}`);
      }

      // Strategy 2: Look for previous actions that reached this page
      const howToReach = this.findHowToReachPage(expectedUrl, actionIndex);
      if (howToReach) {
        console.log(`✓ Found previous navigation to this page at action ${howToReach.actionIndex}`);
        // Just use direct goto as fallback
        try {
          await page.goto(expectedUrl, {
            waitUntil: 'domcontentloaded',
            timeout: this.options.timeout,
          });
          this.navigationHistory.recordNavigation(expectedUrl);
          console.log(`✓ Auto-correction successful via direct navigation`);
          return true;
        } catch (e) {
          // Direct navigation also failed
        }
      }

      // Final fallback: Try direct navigation one more time
      try {
        await page.goto(expectedUrl, {
          waitUntil: 'domcontentloaded',
          timeout: this.options.timeout,
        });
        this.navigationHistory.recordNavigation(expectedUrl);
        console.log(`✓ Auto-correction successful via direct navigation (final attempt)`);
        return true;
      } catch (finalError) {
        console.error(`❌ All auto-correction attempts failed`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Page state validation error: ${error}`);
      return true; // Allow action to proceed on validation error
    }
  }

  /**
   * Find how to reach a specific page from action history
   */
  private findHowToReachPage(
    targetUrl: string,
    beforeIndex: number
  ): { actionIndex: number; action: Action } | null {
    if (!this.processedRecording) return null;

    // Look backwards through actions to find last time we were on this page
    for (let i = beforeIndex - 1; i >= 0; i--) {
      const action = this.processedRecording.actions[i];
      if (this.urlsMatch(action.url, targetUrl)) {
        return { actionIndex: i, action };
      }
    }

    return null;
  }

  /**
   * Classify error severity to determine recovery strategy
   */
  private classifyError(error: Error): ErrorSeverity {
    const message = error.message.toLowerCase();

    // Fatal errors - cannot continue
    if (
      message.includes('browser has been closed') ||
      message.includes('context has been closed') ||
      message.includes('target closed')
    ) {
      return ErrorSeverity.FATAL;
    }

    // Expected "errors" - actually successful navigation
    if (
      (message.includes('navigation') && !message.includes('timeout')) ||
      message.includes('page navigated')
    ) {
      return ErrorSeverity.EXPECTED;
    }

    // Everything else is potentially recoverable
    return ErrorSeverity.RECOVERABLE;
  }

  /**
   * Attempt to recover from error and restore page to usable state
   */
  private async attemptRecovery(page: Page, action: Action): Promise<boolean> {
    try {
      // Check if page is still alive
      if (page.isClosed()) {
        return false;
      }

      // Strategy 1: Check if we're on wrong page (auto-recovery navigation)
      const currentUrl = page.url();
      const expectedUrl = action.url;

      if (!this.urlsMatch(currentUrl, expectedUrl)) {
        try {
          const expectedUrlObj = new URL(expectedUrl);
          const currentUrlObj = new URL(currentUrl);

          // If wrong page, navigate to expected page
          if (expectedUrlObj.hostname === currentUrlObj.hostname) {
            console.warn(`⚠️ Auto-recovery: Navigating from ${currentUrl} to ${expectedUrl}`);
            await page.goto(expectedUrl, {
              waitUntil: 'domcontentloaded',
              timeout: this.options.timeout,
            });
            await page.waitForTimeout(1000); // Wait for page to stabilize
            return true;
          }
        } catch (urlError) {
          // URL parsing failed, continue with other strategies
        }
      }

      // Strategy 2: Dismiss any open overlays/dropdowns
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Strategy 3: Wait for network to settle
      await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});

      // Strategy 4: Check if page URL changed unexpectedly (for navigation actions)
      if (currentUrl !== action.url && !currentUrl.includes('about:blank')) {
        const actionHostname = new URL(action.url).hostname;
        const currentHostname = new URL(currentUrl).hostname;

        // If we're on a different domain, that's likely intentional navigation
        if (actionHostname !== currentHostname) {
          return true; // Consider this successful navigation
        }
      }

      return true;
    } catch (error) {
      return false;
    }
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
      await this.executeNavigation(page, action);
    } else if (action.type === 'submit') {
      await this.executeSubmit(page, action);
    }
  }

  /**
   * Execute navigation action with intelligent history-based navigation
   * Solutions 1, 3, 4: Analyzes real trigger, uses history, verifies state
   */
  private async executeNavigation(page: Page, action: any): Promise<void> {
    const currentUrl = page.url();
    const targetUrl = action.to || action.url;

    // Check if navigation already happened by recent action (within last 2 seconds)
    if (this.lastAction && Date.now() - this.lastAction.timestamp < 2000) {
      const lastActType = this.lastAction.action.type;
      if (lastActType === 'click' || lastActType === 'submit') {
        // Check if that action already navigated us to target
        if (this.urlsMatch(currentUrl, targetUrl)) {
          console.log(`✓ Recent ${lastActType} action already navigated to target, skipping`);
          this.navigationHistory.recordNavigation(targetUrl);
          return;
        }
      }
    }

    // If we're already on the target URL, verify actual page content
    if (this.urlsMatch(currentUrl, targetUrl)) {
      console.log(`✓ Already on target URL, verifying content loaded`);
      await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
      return;
    }

    // Solution 1 + 4: Use intelligent navigation with history tracking
    try {
      const navResult = await this.navigationHistory.navigate(
        page,
        targetUrl,
        this.options.timeout
      );

      if (navResult.success) {
        console.log(`✓ Navigation successful using ${navResult.method}`);
        return;
      } else {
        throw new Error(`All navigation methods failed`);
      }
    } catch (error: any) {
      // If timeout but URL changed, consider partial success
      const newUrl = page.url();
      if (newUrl !== currentUrl && this.urlsMatch(newUrl, targetUrl)) {
        console.warn(`⚠️ Navigation timeout but reached target URL: ${newUrl}`);
        this.navigationHistory.recordNavigation(targetUrl);
        await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
        return;
      }
      throw error;
    }
  }

  /**
   * Check if two URLs match (ignoring query params and fragments)
   */
  private urlsMatch(url1: string, url2: string): boolean {
    try {
      const u1 = new URL(url1);
      const u2 = new URL(url2);
      return u1.hostname === u2.hostname && u1.pathname === u2.pathname;
    } catch {
      return url1 === url2 || url1.includes(url2) || url2.includes(url1);
    }
  }

  /**
   * Execute form submit with smart handling and navigation tracking
   */
  private async executeSubmit(page: Page, action: any): Promise<void> {
    const urlBeforeSubmit = page.url();

    try {
      const element = await this.elementLocator.findElement(page, action.selector);
      await element.waitFor({ state: 'visible', timeout: this.options.timeout });

      // Submit might trigger navigation, handle gracefully
      await Promise.race([
        element.evaluate((el: any) => el.submit()),
        page.waitForNavigation({ timeout: 5000 }).catch(() => {}),
      ]);

      // Track navigation if URL changed
      const urlAfterSubmit = page.url();
      if (urlAfterSubmit !== urlBeforeSubmit) {
        console.log(`✓ Form submit triggered navigation: ${urlBeforeSubmit} → ${urlAfterSubmit}`);
        this.navigationHistory.recordNavigation(urlAfterSubmit);
      }
    } catch (error: any) {
      // Check if form already submitted (URL changed or form not found)
      const urlAfterAttempt = page.url();

      if (urlAfterAttempt !== urlBeforeSubmit) {
        console.log(
          `✓ Form already submitted (URL changed from ${urlBeforeSubmit} to ${urlAfterAttempt})`
        );
        this.navigationHistory.recordNavigation(urlAfterAttempt);
        return;
      }

      if (error.message?.includes('Element not found')) {
        // Form might have already been submitted by previous click action
        console.warn(`⚠️ Form not found - may have been submitted by previous action`);
        return;
      }

      throw error;
    }
  }

  /**
   * Execute click action with enhanced error handling and navigation tracking
   */
  private async executeClick(page: Page, action: ClickAction): Promise<void> {
    const urlBeforeClick = page.url();

    try {
      const element = await this.elementLocator.findElement(page, action.selector);
      await element.waitFor({ state: 'visible', timeout: this.options.timeout });

      // Dismiss any overlays that might be blocking the element
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(100);

      await Promise.race([
        element.click({
          button:
            action.button === 'left' ? 'left' : action.button === 'right' ? 'right' : 'middle',
          clickCount: action.clickCount,
          timeout: this.options.timeout,
          force: false,
        }),
        page.waitForNavigation({ timeout: 1000 }).catch(() => {}),
      ]);

      await page.waitForTimeout(300);

      // Track navigation if URL changed
      const urlAfterClick = page.url();
      if (urlAfterClick !== urlBeforeClick) {
        console.log(`✓ Click triggered navigation: ${urlBeforeClick} → ${urlAfterClick}`);
        this.navigationHistory.recordNavigation(urlAfterClick);
      }
    } catch (error: any) {
      // If page URL changed or page closed, consider click successful
      const urlAfter = page.url();
      if (error.message?.includes('Element not found') && urlAfter !== action.url) {
        if (urlAfter !== urlBeforeClick) {
          this.navigationHistory.recordNavigation(urlAfter);
        }
        return;
      }
      if (
        error.message?.includes('Target page, context or browser has been closed') ||
        error.message?.includes('Navigation')
      ) {
        if (urlAfter !== urlBeforeClick) {
          this.navigationHistory.recordNavigation(urlAfter);
        }
        return;
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
