import {
  chromium,
  firefox,
  webkit,
  type Browser,
  type BrowserContext,
  type Page,
} from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import type {
  Recording,
  Action,
  ClickAction,
  InputAction,
  ScrollAction,
  HoverAction,
  SelectAction,
  SelectorStrategy,
  ModalLifecycleAction,
} from '../types/index.js';
import type { RunOptions, RunResult, Reporter } from '../types/runner.js';
import { ElementLocator } from './ElementLocator.js';
import { NavigationHistoryManager } from './NavigationHistoryManager.js';
import { NavigationAnalyzer } from './NavigationAnalyzer.js';
import { RecordingParser } from '../parser/RecordingParser.js';
import {
  isClickAction,
  isInputAction,
  isScrollAction,
  isHoverAction,
  isSelectAction,
  isModalLifecycleAction,
} from '../types/index.js';

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
  private options: Required<Omit<RunOptions, 'abortSignal' | 'runId'>> & {
    runId?: string;
  };
  private elementLocator: ElementLocator;
  private navigationHistory: NavigationHistoryManager;
  private navigationAnalyzer: NavigationAnalyzer;
  private reporter?: Reporter;
  private lastAction?: { action: Action; timestamp: number };
  private processedRecording?: Recording;
  private skippedActionGroups: Set<string> = new Set();
  private lastClickedElement?: { selector: SelectorStrategy; timestamp: number };

  // Phase 2: Modal state tracking
  private modalState = new Map<string, boolean>();

  // Navigation stabilization tracking
  private lastNavigationTimestamp: number = 0;
  private skipNextPageValidation: boolean = false;

  // Cancellation support
  private abortSignal?: AbortSignal;

  // Screenshot tracking
  private capturedScreenshots: string[] = [];

  constructor(options: RunOptions = {}, reporter?: Reporter) {
    this.options = {
      headless: options.headless ?? true,
      browser: options.browser ?? 'chromium',
      video: options.video ?? false,
      videoDir: options.videoDir ?? './videos',
      screenshot: options.screenshot ?? false,
      screenshotMode: options.screenshotMode ?? 'on-failure',
      screenshotDir: options.screenshotDir ?? './screenshots',
      timeout: options.timeout ?? 30000,
      enableTiming: options.enableTiming ?? true,
      timingMode: options.timingMode ?? 'realistic',
      speedMultiplier: options.speedMultiplier ?? 1.0,
      maxActionDelay: options.maxActionDelay ?? 30000,
      continueOnError: options.continueOnError ?? false, // Phase 2
      runId: options.runId,
    };
    this.abortSignal = options.abortSignal;
    this.elementLocator = new ElementLocator();
    this.navigationHistory = new NavigationHistoryManager();
    this.navigationAnalyzer = new NavigationAnalyzer();
    this.reporter = reporter;
  }

  /**
   * Check if the run has been cancelled
   */
  private checkCancellation(): void {
    if (this.abortSignal?.aborted) {
      throw new Error('CANCELLED: Run was cancelled by user');
    }
  }

  /**
   * Sort actions by timestamp to ensure correct chronological execution order
   * Fixes issue where JSON array order doesn't match actual recording timeline
   */
  private sortActionsByTimestamp(actions: Action[]): Action[] {
    const sorted = [...actions].sort((a, b) => a.timestamp - b.timestamp);

    // Validate and warn if order changed significantly
    let reorderedCount = 0;
    for (let i = 0; i < actions.length; i++) {
      if (actions[i].id !== sorted[i].id) {
        reorderedCount++;
      }
    }

    if (reorderedCount > 0) {
      console.log(`   ⚠️  Reordered ${reorderedCount} actions to match actual timeline`);
    }

    return sorted;
  }

  /**
   * Deduplicate input actions - keep only the final value for each field
   * Eliminates backspace/correction noise during typing
   */
  private deduplicateInputActions(actions: Action[]): Action[] {
    const inputsByField = new Map<string, { action: InputAction; timestamp: number }>();

    // First pass: identify all input actions and keep track of latest per field BY TIMESTAMP
    actions.forEach((action) => {
      if (isInputAction(action)) {
        const fieldKey = this.getFieldKey(action);
        const existingEntry = inputsByField.get(fieldKey);

        console.log(
          `   [DEBUG] Found input action ${action.id}: fieldKey="${fieldKey}", timestamp=${action.timestamp}, value="${action.value?.substring(0, 15)}..."`
        );

        // Keep the input action with the LATEST timestamp (most recent typing)
        if (!existingEntry || action.timestamp > existingEntry.timestamp) {
          console.log(`      → Keeping ${action.id} for ${fieldKey} (newer)`);
          inputsByField.set(fieldKey, { action, timestamp: action.timestamp });
        } else {
          console.log(
            `      → Skipping ${action.id} for ${fieldKey} (older than ${existingEntry.action.id})`
          );
        }
      }
    });

    // Second pass: filter out intermediate inputs, keep only final values
    const deduplicatedActions = actions.filter((action) => {
      if (!isInputAction(action)) return true;

      const fieldKey = this.getFieldKey(action);
      const latestEntry = inputsByField.get(fieldKey);

      // Keep only the input action with the latest timestamp for this field
      return latestEntry && action.timestamp === latestEntry.timestamp;
    });

    const removedCount = actions.length - deduplicatedActions.length;
    if (removedCount > 0) {
      console.log(
        `   ✅ Removed ${removedCount} intermediate input actions (keeping final values)`
      );

      // Debug: Show which input actions were kept
      const keptInputs = deduplicatedActions.filter((a) => isInputAction(a));
      console.log(`   🔍 Kept ${keptInputs.length} final input actions:`);
      keptInputs.forEach((action) => {
        const inputAction = action as InputAction;
        const fieldId = inputAction.selector.id || inputAction.selector.name || 'unknown';
        const valuePreview = inputAction.value?.substring(0, 20) || '(empty)';
        console.log(
          `      - ${action.id}: ${fieldId} = "${valuePreview}..." (timestamp: ${action.timestamp})`
        );
      });
    }

    return deduplicatedActions;
  }

  /**
   * Generate unique key for form field (for deduplication)
   */
  private getFieldKey(action: InputAction): string {
    const selector = action.selector;
    const url = action.url;

    // Use ID + URL if available (most stable - distinguishes same field on different pages)
    if (selector.id) {
      return `${url}:id:${selector.id}`;
    }

    // Use name attribute + URL (common for forms)
    if (selector.name) {
      return `${url}:name:${selector.name}`;
    }

    // Fallback to CSS selector + URL
    if (selector.css) {
      return `${url}:css:${selector.css}`;
    }

    // Last resort: use action URL + type + timestamp
    return `${url}:${action.type}:${action.timestamp}`;
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

    // Fix #1: Sort actions by timestamp to ensure correct chronological order
    console.log('\n🔄 Sorting actions by timestamp...');
    const sortedActions = this.sortActionsByTimestamp(normalizedRecording.actions);

    // Fix #2: Deduplicate input actions - keep only final value per field
    console.log('🧹 Deduplicating input actions...');
    const deduplicatedActions = this.deduplicateInputActions(sortedActions);

    // Use normalized, sorted, and deduplicated recording
    this.processedRecording = { ...normalizedRecording, actions: deduplicatedActions };

    // Reset captured screenshots for this run
    this.capturedScreenshots = [];

    const result: RunResult = {
      status: 'success',
      duration: 0,
      actionsTotal: this.processedRecording.actions.length,
      actionsExecuted: 0,
      actionsFailed: 0,
      errors: [],
      skippedActions: [], // Phase 2
      screenshots: [], // Screenshot capture feature
    };

    try {
      // Launch browser
      console.log('\n🚀 Phase 2: Launching browser...');
      browser = await this.launchBrowser();

      // Determine viewport size based on mode and available data
      // In non-headless mode with windowSize, use windowSize for visual accuracy
      // In headless mode or without windowSize, use viewport
      const effectiveViewport =
        !this.options.headless && recording.windowSize ? recording.windowSize : recording.viewport;

      // Create context with viewport (and devicePixelRatio if available)
      const contextOptions: any = {
        viewport: effectiveViewport,
        userAgent: recording.userAgent,
        recordVideo: this.options.video ? { dir: this.options.videoDir ?? './videos' } : undefined,
        // WebKit (Safari) strictly rejects TLS certificate issues that Chromium/Firefox tolerate
        ignoreHTTPSErrors: true,
      };

      // Add devicePixelRatio for high-DPI display emulation
      if (recording.devicePixelRatio) {
        contextOptions.deviceScaleFactor = recording.devicePixelRatio;
      }

      context = await browser.newContext(contextOptions);

      // Stealth mode: Hide automation indicators
      // This script runs in browser context, so we use string to avoid TypeScript errors
      await context.addInitScript(`
        // Override navigator.webdriver
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
        
        // Add chrome property to make it look like real Chrome
        window.chrome = {
          runtime: {},
          loadTimes: function() {},
          csi: function() {},
          app: {},
        };
        
        // Override permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: 'denied' }) :
            originalQuery(parameters)
        );
        
        // Hide plugin array length
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });
        
        // Override language property
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });
      `);

      console.log('   🥷 Stealth mode enabled (automation flags hidden)');

      // Log viewport info
      if (!this.options.headless && recording.windowSize) {
        console.log(
          `📐 Using window size: ${recording.windowSize.width}x${recording.windowSize.height} (matches recording)`
        );
      } else {
        console.log(`📐 Using viewport: ${effectiveViewport.width}x${effectiveViewport.height}`);
      }

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
          // Check for cancellation before each action
          this.checkCancellation();

          // Apply timing delay before action
          if (enableTiming && i > 0) {
            const elapsedTime = Date.now() - testStartTime;
            const prevAction = this.processedRecording!.actions[i - 1];

            // Wait until previous action completes, not just starts
            // Use completedAt if available (new recordings), fallback to timestamp (old recordings)
            const prevCompletedAt = prevAction.completedAt || prevAction.timestamp;
            const targetTime = prevCompletedAt * speedMultiplier;
            const delay = Math.min(targetTime - elapsedTime, maxDelay);

            if (delay > 0) {
              await page.waitForTimeout(delay);
            }
          }

          // Enhanced duplicate detection with carousel support
          if (this.lastAction) {
            const lastAct = this.lastAction.action;
            const timeDiff = action.timestamp - lastAct.timestamp;
            const actionSelector = (action as any).selector;
            const lastActSelector = (lastAct as any).selector;
            const sameElement =
              actionSelector &&
              lastActSelector &&
              JSON.stringify(actionSelector) === JSON.stringify(lastActSelector);

            if (sameElement && action.type === lastAct.type && action.type === 'click') {
              const isCarousel = this.isCarouselNavigationElement(action);

              if (isCarousel) {
                // Carousel-specific duplicate detection
                if (timeDiff < 200) {
                  console.log(
                    `⏭️  Skipping duplicate carousel click (${timeDiff}ms - too fast, likely recording error)`
                  );
                  continue;
                } else if (timeDiff > 500) {
                  console.log(`🎠 Intentional carousel navigation click (${timeDiff}ms apart)`);
                  // Execute - intentional carousel navigation
                } else {
                  // 200-500ms: Check consecutive click count
                  const consecutiveClicks = this.countConsecutiveClicks(
                    i,
                    this.processedRecording!.actions
                  );
                  if (consecutiveClicks > 5) {
                    console.log(
                      `⏭️  Skipping excessive carousel clicks (${consecutiveClicks} consecutive, likely stuck)`
                    );
                    continue;
                  } else {
                    console.log(
                      `🎠 Carousel navigation click ${consecutiveClicks} (${timeDiff}ms apart)`
                    );
                    // Execute - reasonable carousel browsing
                  }
                }
              } else {
                // Non-carousel: use existing duplicate logic
                if (timeDiff < 200) {
                  console.log(`⏭️  Skipping duplicate click (${timeDiff}ms apart)`);
                  continue;
                }
              }
            } else if (this.isDuplicateAction(action)) {
              console.warn(`⚠️ Skipping duplicate action [${i + 1}]: ${action.type}`);
              continue;
            }
          }

          // Check if action should be skipped based on dependencies or completed groups
          if (this.shouldSkipAction(action, page)) {
            continue;
          }

          // Log navigation intent metadata if present
          this.logActionMetadata(action);

          // Solution 3: Enhanced page state validation with auto-correction
          // Skip validation if the previous action just triggered navigation
          const prevAction = i > 0 ? this.processedRecording!.actions[i - 1] : null;
          const nextAction =
            i < this.processedRecording!.actions.length - 1
              ? this.processedRecording!.actions[i + 1]
              : null;

          // Skip validation if:
          // 1. Next action is a navigation (we're about to navigate anyway)
          // 2. Actions are very close in time (<1000ms) suggesting they're part of the same interaction
          // 3. We just completed a navigation (< 3 seconds ago) - give website time to stabilize
          // 4. Skip flag is set (just after navigation)
          const timeSinceNavigation = Date.now() - this.lastNavigationTimestamp;
          const skipValidation =
            (nextAction && nextAction.type === 'navigation') ||
            (prevAction &&
              Math.abs(action.timestamp - prevAction.timestamp) < 1000 &&
              prevAction.url !== action.url) ||
            timeSinceNavigation < 3000 ||
            this.skipNextPageValidation;

          // Reset skip flag after using it
          if (this.skipNextPageValidation) {
            this.skipNextPageValidation = false;
          }

          if (!skipValidation) {
            console.log(`\n🔍 [DEBUG] Page state validation for action [${i + 1}]:`);
            console.log(`   Current URL: ${page.url()}`);
            console.log(`   Expected URL: ${action.url}`);
            console.log(`   Previous action type: ${prevAction?.type || 'N/A'}`);

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
          }

          // Enhanced console logging with page context
          const currentUrl = page.url();
          const recordingTime = action.timestamp / 1000;
          const actualElapsed = (Date.now() - testStartTime) / 1000;
          const waitTime = Math.max(0, recordingTime - actualElapsed);

          console.log(
            `⏳ [${i + 1}] Executing ${action.type} (at ${recordingTime.toFixed(1)}s)...`
          );
          console.log(`   📍 Page: ${currentUrl}`);

          if (waitTime > 2) {
            console.log(
              `   ⏱️  Waiting ${waitTime.toFixed(1)}s (recorded browsing/reading time)...`
            );
          }

          // **FIX #3: Smart wait for significant action gaps (async content loading)**
          // Detect if this action follows an input action with significant delay
          // This handles autocomplete dropdowns, API-driven content, lazy loading, etc.
          if (i > 0) {
            const prevAction = this.processedRecording!.actions[i - 1];
            const timeDelta = action.timestamp - prevAction.timestamp;

            // If there's a gap > 2 seconds after an input action, wait for dynamic content
            if (timeDelta > 2000 && prevAction.type === 'input') {
              const waitMs = Math.min(timeDelta * 0.5, 3000); // Wait up to half the gap, max 3s
              console.log(
                `   ⏳ Waiting ${waitMs}ms for dynamic content after input (gap: ${timeDelta}ms)...`
              );
              await page.waitForTimeout(waitMs);

              // Also wait for network to be idle (API responses, autocomplete, etc.)
              try {
                await page.waitForLoadState('networkidle', { timeout: 3000 });
                console.log('   ✓ Network idle - dynamic content loaded');
              } catch {
                // Network might not settle, continue anyway
                console.log('   ⚠️ Network still active, proceeding...');
              }
            }

            // If there's a gap > 1 second after ANY action, respect part of that timing
            // This preserves natural user pauses (reading, thinking, waiting for animations)
            else if (timeDelta > 1000) {
              const naturalPause = Math.min(timeDelta * 0.3, 2000); // Wait 30% of gap, max 2s
              console.log(`   ⏸️  Natural pause: ${naturalPause}ms (user was reading/waiting)`);
              await page.waitForTimeout(naturalPause);
            }
          }

          this.reporter?.onActionStart(action, i + 1);

          const urlBeforeAction = page.url();
          const actionStartTime = Date.now();
          await this.executeAction(page, action);
          const actionDuration = Date.now() - actionStartTime;

          const urlAfterAction = page.url();
          if (urlBeforeAction !== urlAfterAction) {
            console.log(`\n🔄 [DEBUG] URL changed during action execution:`);
            console.log(`   Before: ${urlBeforeAction}`);
            console.log(`   After: ${urlAfterAction}`);
          }

          result.actionsExecuted++;
          this.reporter?.onActionSuccess(action, i + 1, actionDuration);

          // Capture screenshot if 'always' mode is enabled
          if (this.shouldCaptureScreenshot(false)) {
            await this.captureScreenshot(page, action, i + 1, 'always');
          }

          // Add delay buffer after input actions for JavaScript validation
          if (action.type === 'input') {
            await page.waitForTimeout(150);
          }

          // Check for success navigation (checkout complete, form submit success, etc.)
          const isSuccess = await this.checkForSuccessNavigation(page, action, urlBeforeAction);
          if (isSuccess) {
            console.log(`🎉 TEST PASSED: Successfully completed flow`);
            result.status = 'success';
            // Continue to execute remaining non-dependent actions
            // but skip actions in the completed group
          }

          // Track last action for duplicate detection
          this.lastAction = { action, timestamp: Date.now() };
        } catch (error) {
          // Check if this is a cancellation
          if (error instanceof Error && error.message.startsWith('CANCELLED:')) {
            console.log('\n🛑 Run cancelled by user');
            result.status = 'cancelled';
            break;
          }

          // Phase 2: Check if action is optional or modal-lifecycle (modals are always optional)
          const isModalAction = action.type === 'modal-lifecycle';
          if (action.isOptional || action.skipIfNotFound || isModalAction) {
            const reason = error instanceof Error ? error.message : String(error);
            const actionDesc = isModalAction ? 'modal event' : 'optional action';
            console.log(`⏭️  Skipped ${actionDesc} ${action.id}: ${reason.split('\n')[0]}`);

            result.skippedActions!.push({
              action,
              reason: reason.split('\n')[0],
            });

            if (this.reporter && 'onActionSkipped' in this.reporter) {
              (this.reporter as any).onActionSkipped(action, i + 1, reason.split('\n')[0]);
            }

            continue; // Continue to next action
          }

          const severity = this.classifyError(error as Error);

          // Capture screenshot on failure
          let screenshotPath: string | undefined;
          if (this.shouldCaptureScreenshot(true)) {
            screenshotPath = await this.captureScreenshot(page, action, i + 1, 'failure');
          }

          result.actionsFailed++;
          result.errors.push({
            actionId: action.id,
            actionType: action.type,
            error: error instanceof Error ? error.message : String(error),
            timestamp: Date.now(),
            screenshotPath,
          });
          this.reporter?.onActionError(action, i + 1, error as Error);

          // Decide whether to continue or stop
          if (severity === ErrorSeverity.FATAL) {
            console.error('🚨 Fatal error encountered, stopping test execution');
            result.status = 'failed';
            break;
          } else if (severity === ErrorSeverity.RECOVERABLE) {
            // Phase 2: Check continueOnError option
            if (this.options.continueOnError) {
              console.warn('⚠️ Error occurred, but continuing (continueOnError=true)...');
              result.status = 'partial';
              continue;
            }

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
      result.screenshots = this.capturedScreenshots;
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
   * Check if action is carousel/swiper navigation element
   * Detects common carousel libraries: Swiper.js, Slick, Bootstrap
   */
  private isCarouselNavigationElement(action: Action): boolean {
    try {
      if (action.type !== 'click') return false;

      const selector = (action as any).selector;
      if (!selector) return false;

      const ariaLabel = (selector.ariaLabel || '').toLowerCase();
      const cssClass = (selector.css || '').toLowerCase();

      // Check aria-label patterns
      if (
        ariaLabel.includes('next slide') ||
        ariaLabel.includes('previous slide') ||
        (ariaLabel.includes('next') && ariaLabel.includes('slide')) ||
        (ariaLabel.includes('prev') && ariaLabel.includes('slide'))
      ) {
        return true;
      }

      // Check CSS class patterns for common carousel libraries
      const carouselPatterns = [
        'swiper-button-next',
        'swiper-button-prev',
        'carousel-control-next',
        'carousel-control-prev',
        'slick-next',
        'slick-prev',
      ];

      return carouselPatterns.some((pattern) => cssClass.includes(pattern));
    } catch (error) {
      console.warn(`⚠️ Carousel detection failed: ${error}`);
      return false; // Fallback to non-carousel behavior
    }
  }

  /**
   * Count consecutive clicks on the same element
   * Used to detect excessive carousel clicking (possible stuck state)
   */
  private countConsecutiveClicks(currentIndex: number, actions: Action[]): number {
    let count = 1;
    const currentSelector = JSON.stringify((actions[currentIndex] as any).selector);

    // Look backwards
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (actions[i].type !== 'click') break;
      if (JSON.stringify((actions[i] as any).selector) !== currentSelector) break;
      count++;
    }

    // Look forwards
    for (let i = currentIndex + 1; i < actions.length; i++) {
      if (actions[i].type !== 'click') break;
      if (JSON.stringify((actions[i] as any).selector) !== currentSelector) break;
      count++;
    }

    return count;
  }

  /**
   * Check if current action is a duplicate of the last action
   * Enhanced with carousel-specific logic
   */
  private isDuplicateAction(action: Action): boolean {
    if (!this.lastAction) return false;

    const lastAct = this.lastAction.action;

    // Use recording timestamps for duplicate detection, not execution time
    const timeDiff = action.timestamp - lastAct.timestamp;

    // Debug logging
    if (action.id === 'act_012' || action.id === 'act_013' || action.id === 'act_014') {
      console.log(`🔍 Duplicate check for ${action.id}:`);
      console.log(`   Current timestamp: ${action.timestamp}`);
      console.log(`   Last action: ${lastAct.id}, timestamp: ${lastAct.timestamp}`);
      console.log(`   Time diff: ${timeDiff}ms`);
      console.log(`   Same type? ${action.type === lastAct.type}`);
    }

    // Check if same type, same element, within 2000ms in the recording
    const actionSelector = (action as any).selector;
    const lastActSelector = (lastAct as any).selector;

    if (
      timeDiff < 2000 &&
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
        console.log(`   ✅ URLs match (normalized)`);
        return true; // Already on correct page
      }

      console.log(`   ⚠️ URLs don't match after normalization`);
      console.log(`   Normalized current: ${this.normalizeUrl(currentUrl)}`);
      console.log(`   Normalized expected: ${this.normalizeUrl(expectedUrl)}`);

      // Check if this is an expected success navigation (not an error)
      if (this.isSuccessNavigation(action, currentUrl, expectedUrl)) {
        console.log(`   ✅ Detected as success navigation, allowing mismatch`);
        return true; // This is expected, not an error
      }

      // Page mismatch detected - attempt auto-correction
      console.warn(`⚠️ Page state mismatch detected before action [${actionIndex + 1}]:`);
      console.warn(`   Expected: ${expectedUrl}`);
      console.warn(`   Current:  ${currentUrl}`);
      console.warn(`   Action type: ${action.type}`);
      console.warn(`   🔧 Attempting auto-correction...`);

      // Strategy 1: Check if we just need to navigate to the expected page
      try {
        // Use intelligent navigation history
        const navResult = await this.navigationHistory.navigate(
          page,
          expectedUrl,
          this.options.timeout,
          this.options.timingMode
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
        } catch (_e) {
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
      } catch (_finalError) {
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
   * Capture screenshot with error handling
   * @param page - Playwright page instance
   * @param action - Action that triggered the screenshot
   * @param actionIndex - Index of the action (1-based for display)
   * @param reason - Reason for screenshot ('failure' or 'always')
   * @returns Path to saved screenshot or undefined if capture failed
   */
  private async captureScreenshot(
    page: Page,
    action: Action,
    actionIndex: number,
    reason: 'failure' | 'always'
  ): Promise<string | undefined> {
    // Check if screenshots are enabled
    if (!this.options.screenshot) {
      return undefined;
    }

    // Check screenshot mode
    const mode = this.options.screenshotMode;
    if (mode === 'never') {
      return undefined;
    }
    if (mode === 'on-failure' && reason !== 'failure') {
      return undefined;
    }

    try {
      // Check if page is still accessible
      if (page.isClosed()) {
        console.warn('   📷 Cannot capture screenshot: page is closed');
        return undefined;
      }

      // Ensure screenshot directory exists
      const screenshotDir = this.options.screenshotDir;
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }

      // Generate filename: {runId}-{browser}-{actionIndex}-{actionId}.png
      // Use timestamp as fallback if runId is not provided
      const runId = this.options.runId || `run-${Date.now()}`;
      const browser = this.options.browser || 'chromium';
      const paddedIndex = String(actionIndex).padStart(3, '0');
      const filename = `${runId}-${browser}-${paddedIndex}-${action.id}.png`;
      const screenshotPath = path.join(screenshotDir, filename);

      // Capture screenshot
      await page.screenshot({
        path: screenshotPath,
        fullPage: false, // Only visible viewport to keep file size reasonable
        type: 'png',
      });

      console.log(`   📷 Screenshot saved: ${filename}`);

      // Track for result
      this.capturedScreenshots.push(screenshotPath);

      return screenshotPath;
    } catch (error) {
      // Don't let screenshot failure break the test
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`   📷 Screenshot capture failed: ${errorMessage}`);
      return undefined;
    }
  }

  /**
   * Check if screenshot should be captured for the current action
   * Based on screenshot mode and action outcome
   */
  private shouldCaptureScreenshot(isFailure: boolean): boolean {
    if (!this.options.screenshot) {
      return false;
    }

    const mode = this.options.screenshotMode;
    switch (mode) {
      case 'never':
        return false;
      case 'always':
        return true;
      case 'on-failure':
      default:
        return isFailure;
    }
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
        } catch (_urlError) {
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
    } catch (_error) {
      return false;
    }
  }

  /**
   * Execute individual action
   */
  private async executeAction(page: Page, action: Action): Promise<void> {
    // Phase 2: Handle modal lifecycle events
    if (isModalLifecycleAction(action)) {
      await this.handleModalLifecycle(page, action);
    } else if (isClickAction(action)) {
      await this.executeClick(page, action);
    } else if (isInputAction(action)) {
      await this.executeInput(page, action);
    } else if (isSelectAction(action)) {
      await this.executeSelect(page, action);
    } else if (isHoverAction(action)) {
      await this.executeHover(page, action);
    } else if (isScrollAction(action)) {
      await this.executeScroll(page, action);
    } else if (action.type === 'navigation') {
      await this.executeNavigation(page, action);
    } else if (action.type === 'submit') {
      // Check if this submit action is redundant (previous action clicked submit button)
      if (this.isRedundantSubmitAction(action)) {
        console.log(`✓ Form already submitted by previous button click, skipping submit action`);
        return;
      }
      await this.executeSubmit(page, action);
    }
  }

  /**
   * Phase 2: Handle modal lifecycle events with graceful error handling
   */
  private async handleModalLifecycle(page: Page, action: ModalLifecycleAction): Promise<void> {
    // Null safety checks
    if (!action.event) {
      console.warn('⚠️ Modal lifecycle action missing event, skipping');
      return;
    }

    const { event, modalElement } = action;

    // Check if modalElement exists
    if (!modalElement) {
      console.warn(`⚠️ Modal lifecycle event "${event}" missing modalElement, skipping`);
      return;
    }

    const modalId = modalElement.id || 'anonymous';
    const modalDesc = modalElement.id || modalElement.classes || 'unknown modal';

    switch (event) {
      case 'modal-opened':
        console.log(`🔓 Modal opened: ${modalDesc}`);

        // Wait for modal to be visible
        if (modalElement.id) {
          await page
            .waitForSelector(`#${modalElement.id}`, {
              state: 'visible',
              timeout: 5000,
            })
            .catch(() => {
              console.warn(`⚠️ Modal #${modalElement.id} not found, continuing...`);
            });
        } else if (modalElement.role) {
          await page
            .waitForSelector(`[role="${modalElement.role}"]`, {
              state: 'visible',
              timeout: 5000,
            })
            .catch(() => {
              console.warn(`⚠️ Modal with role="${modalElement.role}" not found, continuing...`);
            });
        }

        // Wait for animation to complete (standard 300ms + buffer)
        await page.waitForTimeout(500);

        // Track modal state
        this.modalState.set(modalId, true);
        break;

      case 'modal-closed':
        console.log(`🔒 Modal closed: ${modalDesc}`);

        // Wait for modal to be hidden
        if (modalElement.id) {
          await page
            .waitForSelector(`#${modalElement.id}`, {
              state: 'hidden',
              timeout: 5000,
            })
            .catch(() => {
              // Modal might be removed from DOM instead of hidden
              console.log('   Modal removed from DOM');
            });
        }

        // Wait for close animation
        await page.waitForTimeout(300);

        // Update state
        this.modalState.delete(modalId);
        break;

      case 'modal-state-changed':
        console.log(`🔄 Modal state changed`);
        // Wait for state transition animation
        await page.waitForTimeout(500);
        break;
    }
  }

  // NOTE: These methods are kept for potential future use with recorder flags
  // They are commented out to avoid unused method warnings
  /*
  private expectsFormSubmitNavigation(action: Action): boolean {
    const context = (action as any).context;
    if (!context) return false;
    if (context.navigationIntent === 'submit-form') {
      return true;
    }
    return false;
  }

  private nextActionIsFormSubmitNavigation(currentAction: Action): boolean {
    const nextAction = this.getNextAction(currentAction);
    if (!nextAction || nextAction.type !== 'navigation') return false;
    const navAction = nextAction as any;
    return navAction.navigationTrigger === 'form-submit';
  }
  */

  /**
   * Check if submit action is redundant because previous action clicked a submit button
   */
  private isRedundantSubmitAction(action: Action): boolean {
    if (!this.lastAction) return false;

    const lastAct = this.lastAction.action;

    // Check if last action was a click
    if (!isClickAction(lastAct)) return false;

    // Check timing - should be very close (< 500ms)
    const timeDiff = action.timestamp - lastAct.timestamp;
    if (timeDiff > 500) return false;

    // Check if it was a submit button click
    const isSubmitButton =
      lastAct.tagName?.toLowerCase() === 'button' &&
      (lastAct.text?.toLowerCase().includes('submit') ||
        lastAct.text?.toLowerCase().includes('calculate') ||
        lastAct.text?.toLowerCase().includes('send') ||
        lastAct.text?.toLowerCase().includes('donate') ||
        lastAct.text?.toLowerCase().includes('pay') ||
        lastAct.text?.toLowerCase().includes('checkout'));

    // Check if it was clicking inside a form (even if not explicitly a button)
    const clickedInForm = (lastAct as any).selector?.css?.includes('form') || false;

    return isSubmitButton || clickedInForm;
  }

  /**
   * Execute navigation action with intelligent history-based navigation
   * Solutions 1, 3, 4: Analyzes real trigger, uses history, verifies state
   */
  private async executeNavigation(page: Page, action: any): Promise<void> {
    const currentUrl = page.url();
    const targetUrl = action.to || action.url;
    const navigationTrigger = action.navigationTrigger;

    // CRITICAL: If navigation was triggered by form-submit, it already happened naturally
    // The previous click/submit action waited for the navigation and preserved cookies
    if (navigationTrigger === 'form-submit') {
      console.log('  � Form-submit navigation already happened naturally (with cookies)');

      // Verify we're at the right URL
      if (this.urlsMatch(currentUrl, targetUrl)) {
        console.log(`✓ Already on target URL: ${currentUrl}`);
        await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
        this.lastNavigationTimestamp = Date.now();
        this.skipNextPageValidation = true;
        return;
      } else {
        // Unexpected: we're not where we should be
        console.warn(`⚠️ Expected to be at ${targetUrl}, but at ${currentUrl}`);
        console.log('  � Using fallback navigation...');
        // Fall through to normal navigation logic
      }
    }

    // Check if navigation already happened by recent action (within last 2 seconds)
    if (this.lastAction && Date.now() - this.lastAction.timestamp < 2000) {
      const lastActType = this.lastAction.action.type;
      if (lastActType === 'click' || lastActType === 'submit') {
        // Check if that action already navigated us to target
        if (this.urlsMatch(currentUrl, targetUrl)) {
          console.log(`✓ Recent ${lastActType} action already navigated to target, skipping`);
          // Don't record again - click already recorded the navigation
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
        this.options.timeout,
        this.options.timingMode
      );

      if (navResult.success) {
        console.log(`✓ Navigation successful using ${navResult.method}`);

        // Wait for page to stabilize after navigation
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
          console.log('   ⏱️  Network still active after navigation');
        });

        // Track navigation timestamp and skip next validation
        this.lastNavigationTimestamp = Date.now();
        this.skipNextPageValidation = true;

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
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

        // Track navigation and skip next validation
        this.lastNavigationTimestamp = Date.now();
        this.skipNextPageValidation = true;

        return;
      }
      throw error;
    }
  }

  /**
   * Normalize URL by removing query parameters and hash fragments
   * This prevents false mismatches when websites add tracking/state params
   */
  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
    } catch {
      // If URL parsing fails, return as-is
      return url.split('?')[0].split('#')[0];
    }
  }

  /**
   * Check if two URLs match (ignoring query params and fragments)
   */
  private urlsMatch(url1: string, url2: string): boolean {
    try {
      const normalized1 = this.normalizeUrl(url1);
      const normalized2 = this.normalizeUrl(url2);
      return normalized1 === normalized2;
    } catch {
      return url1 === url2 || url1.includes(url2) || url2.includes(url1);
    }
  }

  /**
   * Get the next action after the current one
   */
  private getNextAction(currentAction: Action): Action | null {
    if (!this.processedRecording) return null;

    const currentIndex = this.processedRecording.actions.findIndex(
      (a) => a.id === currentAction.id
    );

    if (currentIndex === -1 || currentIndex >= this.processedRecording.actions.length - 1) {
      return null;
    }

    return this.processedRecording.actions[currentIndex + 1];
  }

  /**
   * Check if two selectors target the same element
   */
  private selectorsMatch(selector1: SelectorStrategy, selector2: SelectorStrategy): boolean {
    // Compare primary selectors
    if (selector1.id && selector2.id && selector1.id === selector2.id) {
      return true;
    }

    if (selector1.css && selector2.css && selector1.css === selector2.css) {
      return true;
    }

    if (selector1.xpath && selector2.xpath && selector1.xpath === selector2.xpath) {
      return true;
    }

    // Compare text content
    if (selector1.text && selector2.text && selector1.text === selector2.text) {
      return true;
    }

    return false;
  }

  /**
   * Execute form submit with human-like behavior: submit, then observe and react
   * Prefers clicking submit button to preserve JavaScript event handlers
   *
   * PRINCIPLE: Like a human - click submit and see what happens
   */
  private async executeSubmit(page: Page, action: any): Promise<void> {
    const urlBeforeSubmit = page.url();

    console.log(`ℹ️ Form submit action detected...`);

    try {
      // Try to find the form element
      const formElement = await this.elementLocator.findElement(page, action.selector);
      await formElement.waitFor({ state: 'visible', timeout: this.options.timeout });

      // Look for submit button inside the form
      const submitButton = formElement
        .locator('button[type="submit"], input[type="submit"], button:not([type])')
        .first();
      const submitButtonCount = await submitButton.count();

      if (submitButtonCount > 0) {
        console.log(`  ✓ Found submit button, clicking...`);
        await submitButton.click();
      } else {
        // Fallback: Use legacy .submit() method if no button found
        console.warn(`  ⚠️ No submit button found, using form.submit()`);
        await formElement.evaluate((el: any) => el.submit());
      }

      // ============================================================
      // HUMAN-LIKE: Observe what happened and react appropriately
      // ============================================================
      await this.observeAndReactAfterSubmit(page, urlBeforeSubmit);
    } catch (error: any) {
      // Check if form already submitted (URL changed or form not found)
      const urlAfterAttempt = page.url();

      if (urlAfterAttempt !== urlBeforeSubmit) {
        console.log(`  ✓ Form already submitted (navigated to ${urlAfterAttempt})`);
        this.navigationHistory.recordNavigation(urlAfterAttempt);
        return;
      }

      if (error.message?.includes('Element not found')) {
        // Form might have already been submitted by previous click action
        console.warn(`  ⚠️ Form not found - may have been submitted by previous action`);
        return;
      }

      throw error;
    }
  }

  /**
   * Observe what happened after form submit and react appropriately
   */
  private async observeAndReactAfterSubmit(page: Page, urlBeforeSubmit: string): Promise<void> {
    // Give JavaScript a moment to process the submit
    await page.waitForTimeout(50);

    // Check if navigation started
    let currentUrl = page.url();

    if (currentUrl !== urlBeforeSubmit) {
      // Navigation already started
      console.log(`  🔄 Navigation detected: ${urlBeforeSubmit} → ${currentUrl}`);
      await this.waitForNavigationToComplete(page, urlBeforeSubmit);

      const finalUrl = page.url();
      if (finalUrl !== urlBeforeSubmit) {
        this.navigationHistory.recordNavigation(finalUrl);
        console.log(`  ✅ Form submit navigation complete: ${finalUrl}`);
      }

      // Extra wait for auth pages
      if (this.isAuthPage(urlBeforeSubmit)) {
        console.log('  🔐 Auth form detected, waiting for session...');
        await page.waitForTimeout(2000);
        await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
      }

      return;
    }

    // No immediate navigation - poll for changes
    const maxWaitTime = 3000;
    const checkInterval = 100;
    const startTime = Date.now();

    let networkSettled = false;
    const networkIdlePromise = page
      .waitForLoadState('networkidle', { timeout: maxWaitTime })
      .then(() => {
        networkSettled = true;
      })
      .catch(() => {});

    while (Date.now() - startTime < maxWaitTime) {
      await page.waitForTimeout(checkInterval);

      currentUrl = page.url();
      if (currentUrl !== urlBeforeSubmit) {
        console.log(`  🔄 Delayed navigation detected: ${urlBeforeSubmit} → ${currentUrl}`);
        await this.waitForNavigationToComplete(page, urlBeforeSubmit);

        const finalUrl = page.url();
        if (finalUrl !== urlBeforeSubmit) {
          this.navigationHistory.recordNavigation(finalUrl);
          console.log(`  ✅ Form submit navigation complete: ${finalUrl}`);
        }

        if (this.isAuthPage(urlBeforeSubmit)) {
          console.log('  🔐 Auth form detected, waiting for session...');
          await page.waitForTimeout(2000);
          await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
        }

        return;
      }

      if (networkSettled) {
        break;
      }
    }

    // Wait for network to complete
    await Promise.race([networkIdlePromise, page.waitForTimeout(500)]);

    // Final check
    currentUrl = page.url();
    if (currentUrl !== urlBeforeSubmit) {
      console.log(`  ✅ Form submit triggered navigation: ${currentUrl}`);
      this.navigationHistory.recordNavigation(currentUrl);
    } else {
      console.log('  ✓ Form submitted (AJAX - no navigation)');
      await page.waitForTimeout(150);
    }
  }

  /**
   * Execute click action with human-like behavior: click first, observe, then react
   *
   * PRINCIPLE: Like a human, we don't predict what will happen - we click and see.
   * - Click the element
   * - Observe: Did URL change? Is network active? Did page load?
   * - React: Wait appropriately based on what actually happened
   */
  private async executeClick(page: Page, action: ClickAction): Promise<void> {
    const urlBeforeClick = page.url();

    // DEFENSIVE FIX: Convert right-clicks on <select> elements to left-clicks
    // Browser generates synthetic right-click events when opening native dropdowns
    let effectiveButton = action.button;
    if (action.tagName === 'select' && action.button === 'right') {
      console.warn(
        `⚠️ Correcting invalid right-click on <select> element to left-click (recorder bug)`
      );
      effectiveButton = 'left';
    }

    try {
      // Phase 2: Check if action requires modal to be open
      if (action.modalContext?.requiresModalState) {
        const modalId = action.modalContext.modalId;

        if (modalId && !this.modalState.get(modalId)) {
          console.warn(`⚠️ Action requires modal "${modalId}" but it's not open, waiting...`);

          await page
            .waitForSelector(`#${modalId}, [role="dialog"], [role="alertdialog"]`, {
              state: 'visible',
              timeout: 5000,
            })
            .catch(() => {
              console.warn(`Modal "${modalId}" never appeared, proceeding anyway`);
            });

          if (modalId) {
            this.modalState.set(modalId, true);
          }

          await page.waitForTimeout(500);
        }
      }

      // Find element using multi-strategy selectors
      let element;
      if (action.selectors && action.selectors.length > 0) {
        element = await this.elementLocator.findElement(
          page,
          action.selectors,
          action.contentSignature
        );

        if (!element) {
          throw new Error(
            `Element not found using multi-strategy selectors for action ${action.id}`
          );
        }
      } else {
        element = await this.elementLocator.findElement(page, action.selector);
      }

      await element.waitFor({ state: 'visible', timeout: this.options.timeout });

      // Dismiss any overlays that might be blocking the element
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(100);

      // ============================================================
      // HUMAN-LIKE CLICK: Click first, then observe and react
      // ============================================================

      // Perform the actual click
      await this.performClick(page, element, action, effectiveButton);

      // Observe what happened and react appropriately
      await this.observeAndReactAfterClick(page, urlBeforeClick, action);

      // Track this click to detect duplicates
      this.lastClickedElement = {
        selector: action.selector,
        timestamp: action.timestamp,
      };
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
   * Perform the actual click on an element
   * Extracted to reduce duplication and improve readability
   */
  private async performClick(
    page: Page,
    element: any,
    action: ClickAction,
    effectiveButton: string
  ): Promise<void> {
    const buttonOption =
      effectiveButton === 'left' ? 'left' : effectiveButton === 'right' ? 'right' : 'middle';

    if (action.coordinates && action.coordinatesRelativeTo === 'element') {
      const box = await element.boundingBox();
      if (box) {
        const absoluteX = box.x + action.coordinates.x;
        const absoluteY = box.y + action.coordinates.y;
        await page.mouse.click(absoluteX, absoluteY, {
          button: buttonOption,
          clickCount: action.clickCount,
        });
        return;
      }
    }

    // Fallback to element.click()
    await element.click({
      button: buttonOption,
      clickCount: action.clickCount,
      timeout: this.options.timeout,
      force: false,
    });
  }

  /**
   * Observe what happened after a click and react appropriately
   *
   * This is the core of the "human-like" approach:
   * 1. Check immediately if URL changed (navigation started)
   * 2. If yes: wait for page to load
   * 3. If no: wait briefly for any AJAX/DOM updates, then proceed
   */
  private async observeAndReactAfterClick(
    page: Page,
    urlBeforeClick: string,
    _action: ClickAction
  ): Promise<void> {
    // Give JavaScript a moment to start any navigation or AJAX
    // This is crucial - some sites have slight delays before navigation starts
    await page.waitForTimeout(50);

    // Phase 1: Quick check - did navigation start?
    let urlAfterClick = page.url();
    const navigationDetected = urlAfterClick !== urlBeforeClick;

    if (navigationDetected) {
      // Navigation already started! Wait for it to complete
      console.log(`  🔄 Navigation detected: ${urlBeforeClick} → ${urlAfterClick}`);

      await this.waitForNavigationToComplete(page, urlBeforeClick);

      // Record the navigation
      const finalUrl = page.url();
      if (finalUrl !== urlBeforeClick) {
        this.navigationHistory.recordNavigation(finalUrl);
        console.log(`  ✅ Navigation complete: ${finalUrl}`);
      }

      // Extra wait for auth pages to establish session
      if (this.isAuthPage(urlBeforeClick)) {
        console.log('  🔐 Auth page detected, waiting for session...');
        await page.waitForTimeout(1500);
        await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
      }

      return;
    }

    // Phase 2: No immediate navigation - wait a bit more and check for:
    // - Delayed navigation (some sites have JS that triggers navigation after a delay)
    // - AJAX requests completing
    // - DOM updates finishing

    // Use a smart polling approach: check for URL changes multiple times
    const maxWaitTime = 3000; // Maximum 3 seconds to wait
    const checkInterval = 100; // Check every 100ms
    const startTime = Date.now();

    let networkSettled = false;

    // Create a promise that resolves when network is idle
    const networkIdlePromise = page
      .waitForLoadState('networkidle', { timeout: maxWaitTime })
      .then(() => {
        networkSettled = true;
      })
      .catch(() => {
        // Network didn't settle - that's OK for some sites
      });

    // Poll for URL changes while waiting for network
    while (Date.now() - startTime < maxWaitTime) {
      await page.waitForTimeout(checkInterval);

      urlAfterClick = page.url();
      if (urlAfterClick !== urlBeforeClick) {
        console.log(`  🔄 Delayed navigation detected: ${urlBeforeClick} → ${urlAfterClick}`);

        // Wait for the navigation to complete
        await this.waitForNavigationToComplete(page, urlBeforeClick);

        const finalUrl = page.url();
        if (finalUrl !== urlBeforeClick) {
          this.navigationHistory.recordNavigation(finalUrl);
          console.log(`  ✅ Navigation complete: ${finalUrl}`);
        }

        // Extra wait for auth pages
        if (this.isAuthPage(urlBeforeClick)) {
          console.log('  🔐 Auth page detected, waiting for session...');
          await page.waitForTimeout(1500);
          await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
        }

        return;
      }

      // If network already settled and no navigation, we can proceed
      if (networkSettled) {
        break;
      }
    }

    // Wait for the network idle promise to complete (if it hasn't already)
    await Promise.race([
      networkIdlePromise,
      page.waitForTimeout(500), // Don't wait more than 500ms extra
    ]);

    // Final URL check
    urlAfterClick = page.url();
    if (urlAfterClick !== urlBeforeClick) {
      console.log(`  ✅ Click triggered navigation: ${urlBeforeClick} → ${urlAfterClick}`);
      this.navigationHistory.recordNavigation(urlAfterClick);
    } else {
      // No navigation - this was likely an AJAX action or UI update
      // Add a small delay for any remaining DOM updates
      await page.waitForTimeout(150);
    }
  }

  /**
   * Wait for a navigation to fully complete
   * Handles various page load states and edge cases
   */
  private async waitForNavigationToComplete(page: Page, originalUrl: string): Promise<void> {
    try {
      // Wait for DOM to be ready first (fastest)
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 });

      // Then wait for network to settle (catches AJAX-heavy pages)
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
        // Network might not fully settle on some sites - that's OK
        console.log('  ⏳ Network still active, proceeding...');
      });

      // Small buffer for any final JS execution
      await page.waitForTimeout(100);
    } catch (error: any) {
      // If we're on a different URL, navigation succeeded even if load states failed
      if (page.url() !== originalUrl) {
        console.log('  ⚠️ Page load had issues but navigation completed');
        return;
      }
      throw error;
    }
  }

  /**
   * Check if a URL is an authentication-related page
   */
  private isAuthPage(url: string): boolean {
    const authPatterns = [
      'signin',
      'sign-in',
      'login',
      'log-in',
      'auth',
      'authenticate',
      'signup',
      'sign-up',
      'register',
    ];
    const urlLower = url.toLowerCase();
    return authPatterns.some((pattern) => urlLower.includes(pattern));
  }

  /**
   * Execute hover action with exact duration timing
   */
  private async executeHover(page: Page, action: HoverAction): Promise<void> {
    try {
      // Strategy 1: Skip hovers on modal infrastructure (non-functional elements)
      const modalInfrastructurePatterns = [
        '.swal2-container',
        '.swal2-backdrop',
        '.modal-backdrop',
        '.modal-overlay',
        '.overlay',
        '.sweetalert-overlay',
        'div[role="presentation"]',
      ];

      const cssSelector = action.selector.css || '';
      const isModalInfrastructure = modalInfrastructurePatterns.some((pattern) =>
        cssSelector.includes(pattern)
      );

      if (isModalInfrastructure) {
        console.log(`⏭️  Skipping hover on modal infrastructure: ${cssSelector}`);
        return;
      }

      // Strategy 2: Skip brief hovers (< 300ms) - likely incidental mouse movement
      if (action.duration && action.duration < 300) {
        console.log(`⏭️  Skipping brief hover (${action.duration}ms) - incidental movement`);
        return;
      }

      // Strategy 3: Check if next action is a click on the same element
      const nextAction = this.getNextAction(action);
      if (
        nextAction?.type === 'click' &&
        this.selectorsMatch(action.selector, nextAction.selector)
      ) {
        console.log(`⏭️  Skipping hover - next action clicks same element`);
        return;
      }

      const element = await this.elementLocator.findElement(page, action.selector);
      await element.waitFor({ state: 'visible', timeout: this.options.timeout });

      // Hover over the element
      await element.hover();

      // NOTE: We don't wait for action.duration here because the timestamp-based
      // timing between actions already accounts for hover duration. The next action's
      // timestamp tells us exactly when to proceed, so adding duration would double
      // the wait time and make execution longer than the original recording.
    } catch (error: any) {
      // Hover is non-critical - if element not found, hidden, or timeout, just continue
      if (
        error.message?.includes('Element not found') ||
        error.message?.includes('Timeout') ||
        error.message?.includes('visible')
      ) {
        console.warn(`⚠️ Hover failed (non-critical): ${error.message.split('\n')[0]}`);
        return;
      }
      throw error;
    }
  }

  /**
   * Execute input action
   */
  private async executeInput(page: Page, action: InputAction): Promise<void> {
    // Phase 2: Use multi-strategy selectors if available
    let element;
    if (action.selectors && action.selectors.length > 0) {
      element = await this.elementLocator.findElement(
        page,
        action.selectors,
        action.contentSignature
      );

      if (!element) {
        throw new Error(`Element not found using multi-strategy selectors for action ${action.id}`);
      }
    } else {
      // Legacy: use single selector
      element = await this.elementLocator.findElement(page, action.selector);
    }

    // Wait for element to be visible and stable
    await element.waitFor({ state: 'visible', timeout: this.options.timeout });

    // Handle checkboxes by clicking instead of filling
    if (action.inputType === 'checkbox') {
      await element.click();
      // Wait for any UI updates after checkbox toggle
      await page.waitForTimeout(300);
      return;
    }

    // Handle file inputs with special file upload API
    if (action.inputType === 'file') {
      console.log(`   📎 File upload detected: ${action.value}`);

      // Extract filename from fakepath (browser security feature)
      // "C:\\fakepath\\filename.png" → "filename.png"
      let filename = action.value;
      if (filename.includes('\\fakepath\\')) {
        filename = filename.split('\\fakepath\\').pop() || filename;
        console.log(`   📝 Extracted filename: ${filename}`);
      } else if (filename.includes('\\\\fakepath\\\\')) {
        filename = filename.split('\\\\fakepath\\\\').pop() || filename;
      }

      // Try to find the file in common locations
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');

      // Possible file locations to check
      const searchPaths = [
        filename, // Exact path provided
        path.join(process.cwd(), filename), // Current directory
        path.join(process.cwd(), 'test-files', filename), // test-files directory
        path.join(process.cwd(), 'fixtures', filename), // fixtures directory
        path.join(os.homedir(), 'Downloads', filename), // User's Downloads
        path.join(os.homedir(), 'Desktop', filename), // User's Desktop
      ];

      let foundFile = null;
      for (const searchPath of searchPaths) {
        try {
          if (fs.existsSync(searchPath)) {
            foundFile = searchPath;
            console.log(`   ✅ Found file: ${foundFile}`);
            break;
          }
        } catch (_err) {
          // Skip invalid paths
        }
      }

      if (foundFile) {
        // Upload the file
        await element.setInputFiles(foundFile);
        console.log(`   📤 File uploaded successfully`);
      } else {
        // File not found - create a placeholder image if possible
        console.warn(`   ⚠️ File not found: ${filename}`);
        console.warn(`   💡 Searched in: ${searchPaths.slice(0, 6).join(', ')}`);

        // Try to create a minimal 1x1 pixel PNG as placeholder
        try {
          const placeholderDir = path.join(process.cwd(), '.saveaction-temp');
          if (!fs.existsSync(placeholderDir)) {
            fs.mkdirSync(placeholderDir, { recursive: true });
          }

          const placeholderPath = path.join(placeholderDir, 'placeholder.png');

          // Create a minimal 1x1 transparent PNG (69 bytes)
          const pngData = Buffer.from([
            0x89,
            0x50,
            0x4e,
            0x47,
            0x0d,
            0x0a,
            0x1a,
            0x0a, // PNG signature
            0x00,
            0x00,
            0x00,
            0x0d,
            0x49,
            0x48,
            0x44,
            0x52, // IHDR chunk
            0x00,
            0x00,
            0x00,
            0x01,
            0x00,
            0x00,
            0x00,
            0x01, // 1x1 dimensions
            0x08,
            0x06,
            0x00,
            0x00,
            0x00,
            0x1f,
            0x15,
            0xc4,
            0x89,
            0x00,
            0x00,
            0x00,
            0x0a,
            0x49,
            0x44,
            0x41,
            0x54,
            0x78,
            0x9c,
            0x63,
            0x00,
            0x01,
            0x00,
            0x00,
            0x05,
            0x00,
            0x01,
            0x0d,
            0x0a,
            0x2d,
            0xb4,
            0x00,
            0x00,
            0x00,
            0x00,
            0x49,
            0x45,
            0x4e,
            0x44,
            0xae,
            0x42,
            0x60,
            0x82,
          ]);

          fs.writeFileSync(placeholderPath, pngData);

          await element.setInputFiles(placeholderPath);
          console.log(`   🖼️ Uploaded placeholder image (file not found)`);
        } catch (placeholderError: any) {
          console.error(`   ❌ Could not create placeholder: ${placeholderError.message}`);
          throw new Error(
            `File upload failed: "${filename}" not found. Please place the file in: ${searchPaths[1]}`
          );
        }
      }

      // Wait for file processing (preview generation, validation, etc.)
      await page.waitForTimeout(500);
      return;
    }

    // Handle regular text inputs
    // Clear existing value
    await element.clear();

    // Type value with realistic delay if captured
    if (action.typingDelay && action.typingDelay > 0) {
      // Use recorded typing delay for realistic simulation
      await element.type(action.value, { delay: action.typingDelay });
    } else if (action.simulationType === 'type') {
      // Default typing delay if simulationType is 'type' but no delay recorded
      await element.type(action.value, { delay: 100 });
    } else {
      // Instant fill for setValue simulation type
      await element.fill(action.value);
    }

    // Wait for autocomplete dropdowns or suggestions to appear
    await page.waitForTimeout(300);
  }

  /**
   * Execute select dropdown action
   */
  private async executeSelect(page: Page, action: SelectAction): Promise<void> {
    // Find the select element
    const element = await this.elementLocator.findElement(page, action.selector);

    // Wait for element to be visible and stable
    await element.waitFor({ state: 'visible', timeout: this.options.timeout });

    // Select by value (preferred), fallback to label/text, then index
    if (action.selectedValue) {
      await element.selectOption({ value: action.selectedValue });
    } else if (action.selectedText) {
      await element.selectOption({ label: action.selectedText });
    } else if (action.selectedIndex !== undefined) {
      await element.selectOption({ index: action.selectedIndex });
    } else {
      throw new Error(
        `Select action ${action.id} missing selection criteria (value, text, or index)`
      );
    }

    // Wait for any UI updates after selection
    await page.waitForTimeout(300);
  }

  /**
   * Execute scroll action with smooth animation
   */
  private async executeScroll(page: Page, action: ScrollAction): Promise<void> {
    if (action.element === 'window') {
      // Get current scroll position
      const currentScroll = await page.evaluate(() => ({
        x: (globalThis as any).window.scrollX,
        y: (globalThis as any).window.scrollY,
      }));

      const targetX = action.scrollX;
      const targetY = action.scrollY;
      const deltaX = targetX - currentScroll.x;
      const deltaY = targetY - currentScroll.y;

      // Calculate distance and steps for smooth scrolling
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const duration = Math.min(800, Math.max(200, distance / 2)); // 200-800ms based on distance
      const steps = Math.ceil(duration / 16); // 60fps = 16ms per frame

      // Smooth scroll animation
      for (let i = 1; i <= steps; i++) {
        const progress = i / steps;
        // Ease-out cubic for natural deceleration
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentX = currentScroll.x + deltaX * eased;
        const currentY = currentScroll.y + deltaY * eased;

        await page.evaluate(
          ({ x, y }: { x: number; y: number }) => {
            (globalThis as any).window.scrollTo(x, y);
          },
          { x: Math.round(currentX), y: Math.round(currentY) }
        );

        // Wait one frame (16ms for 60fps)
        if (i < steps) {
          await page.waitForTimeout(16);
        }
      }

      // Ensure we reached exact target
      await page.evaluate(
        ({ x, y }: { x: number; y: number }) => {
          (globalThis as any).window.scrollTo(x, y);
        },
        { x: targetX, y: targetY }
      );

      // Wait for scroll to settle
      await page.waitForTimeout(100);
    } else {
      // Element scroll - use instant for now (can enhance later)
      const element = await this.elementLocator.findElement(page, action.element);
      await element.evaluate(
        (el: any, { x, y }: { x: number; y: number }) => {
          el.scrollLeft = x;
          el.scrollTop = y;
        },
        { x: action.scrollX, y: action.scrollY }
      );

      await page.waitForTimeout(100);
    }
  }

  /**
   * Launch browser based on options
   */
  private async launchBrowser(): Promise<Browser> {
    // Browser-specific stealth arguments
    // Chromium args don't work on Firefox/Webkit and can cause issues
    // Firefox misinterprets "--disable-blink-features=AutomationControlled" as URL "http://automationcontrolled"
    const chromiumStealthArgs = [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-infobars',
      '--window-position=0,0',
      '--ignore-certificate-errors',
      '--ignore-certificate-errors-spki-list',
    ];

    // Firefox-specific args (Firefox doesn't use Chromium's arg format)
    const firefoxStealthArgs: string[] = [
      // Firefox doesn't need most stealth args as it doesn't expose webdriver by default
    ];

    // Webkit-specific args (Safari engine, minimal args needed)
    const webkitStealthArgs: string[] = [
      // Webkit has limited CLI arg support
    ];

    switch (this.options.browser) {
      case 'chromium':
        return await chromium.launch({
          headless: this.options.headless,
          args: chromiumStealthArgs,
        });
      case 'firefox':
        return await firefox.launch({
          headless: this.options.headless,
          args: firefoxStealthArgs,
        });
      case 'webkit':
        return await webkit.launch({
          headless: this.options.headless,
          args: webkitStealthArgs,
        });
      default:
        throw new Error(`Unknown browser: ${this.options.browser}`);
    }
  }

  /**
   * Check if action should be skipped based on dependencies
   */
  private shouldSkipAction(action: Action, page: Page): boolean {
    const context = action.context;

    // Check 0: Is this a duplicate click (same element clicked recently)?
    if (action.type === 'click' && this.lastClickedElement) {
      const timeSinceLastClick = action.timestamp - this.lastClickedElement.timestamp;
      const sameElement = this.selectorsMatch(action.selector, this.lastClickedElement.selector);

      // If same element clicked within 500ms, it's likely a duplicate recording
      if (sameElement && timeSinceLastClick < 500) {
        console.log(`⏭️  Skipping duplicate click on same element (${timeSinceLastClick}ms apart)`);
        return true;
      }
    }

    if (!context) return false;

    // Check 1: Is this action's group already completed?
    if (context.actionGroup && this.skippedActionGroups.has(context.actionGroup)) {
      console.log(`⏭️  SKIPPING action ${action.id}: Group already completed`);
      return true;
    }

    // Check 2: Does this action have dependencies?
    if (!context.dependentActions || context.dependentActions.length === 0) {
      return false;
    }

    // Check 3: Find the terminal action it depends on
    let terminalAction: Action | null = null;
    for (const depId of context.dependentActions) {
      const depAction = this.processedRecording?.actions.find((a) => a.id === depId);
      if (depAction?.context?.isTerminalAction) {
        terminalAction = depAction;
        break;
      }
    }

    if (!terminalAction) return false;

    // Check 4: Did the terminal action cause navigation?
    const currentUrl = page.url();
    const terminalUrl = terminalAction.url;

    if (currentUrl !== terminalUrl) {
      const actionText = (action as any).text || action.type;
      console.log(`⏭️  SKIPPING action ${action.id}: ${actionText}`);
      console.log(`   Reason: Terminal action navigated away`);
      console.log(`   From: ${terminalUrl}`);
      console.log(`   To: ${currentUrl}`);
      return true;
    }

    // Check 5: If action is inside modal, does modal still exist?
    if (context.isInsideModal && context.modalId) {
      try {
        const modalVisible = page.locator(`#${context.modalId}`).isVisible();
        if (!modalVisible) {
          console.log(`⏭️  SKIPPING action ${action.id}: Modal closed`);
          console.log(`   Modal ID: ${context.modalId}`);
          return true;
        }
      } catch {
        // Modal check failed, assume it doesn't exist
        return true;
      }
    }

    return false;
  }

  /**
   * Check if action navigated to a success URL
   */
  private async checkForSuccessNavigation(
    page: Page,
    action: Action,
    urlBeforeAction: string
  ): Promise<boolean> {
    const context = action.context;
    if (!context?.expectedUrlChange?.isSuccessFlow) {
      return false;
    }

    const expectedChange = context.expectedUrlChange;
    const patterns = expectedChange.patterns || [];

    // Wait for potential navigation (max 5 seconds)
    try {
      await page.waitForLoadState('load', { timeout: 5000 });
    } catch {
      // No navigation or timeout
    }

    // Check current URL
    const currentUrl = page.url().toLowerCase();
    const urlChanged = currentUrl !== urlBeforeAction.toLowerCase();

    if (!urlChanged) {
      // No navigation occurred
      return false;
    }

    // Check if current URL matches any success pattern
    const isSuccessUrl = patterns.some((pattern) => currentUrl.includes(pattern.toLowerCase()));

    if (isSuccessUrl) {
      console.log(`✅ SUCCESS DETECTED: Navigated to ${currentUrl}`);
      console.log(`   Matched pattern from: ${patterns.join(', ')}`);

      // Mark action group as completed if applicable
      if (context.actionGroup) {
        this.skippedActionGroups.add(context.actionGroup);
        console.log(`⏭️  Skipping remaining actions in group: ${context.actionGroup}`);
      }

      return true;
    }

    return false;
  }

  /**
   * Log action navigation intent metadata for debugging
   */
  private logActionMetadata(action: Action): void {
    const context = action.context;
    if (!context) return;

    const { navigationIntent, isTerminalAction, expectedUrlChange, actionGroup, dependentActions } =
      context;

    if (navigationIntent && navigationIntent !== 'none') {
      console.log(`  🧭 Navigation Intent: ${navigationIntent}`);
    }

    if (isTerminalAction) {
      console.log(`  🏁 TERMINAL ACTION (completes flow)`);
    }

    if (expectedUrlChange) {
      console.log(`  🔄 Expected URL Change:`);
      console.log(`     Type: ${expectedUrlChange.type}`);
      console.log(`     Success Flow: ${expectedUrlChange.isSuccessFlow}`);
      if (expectedUrlChange.patterns.length > 0) {
        console.log(`     Patterns: ${expectedUrlChange.patterns.join(', ')}`);
      }
    }

    if (actionGroup) {
      console.log(`  📦 Action Group: ${actionGroup}`);
    }

    if (dependentActions && dependentActions.length > 0) {
      console.log(`  🔗 Depends on: ${dependentActions.join(', ')}`);
    }
  }

  /**
   * Enhanced page state validation that considers success navigation
   */
  private isSuccessNavigation(action: Action, currentUrl: string, expectedUrl: string): boolean {
    // URLs match - not a mismatch
    if (this.urlsMatch(currentUrl, expectedUrl)) {
      return false;
    }

    // Check if this is an expected success navigation
    const context = action.context;
    if (!context?.expectedUrlChange?.isSuccessFlow) {
      return false;
    }

    const patterns = context.expectedUrlChange.patterns || [];
    const currentUrlLower = currentUrl.toLowerCase();

    // Check if current URL matches success patterns
    const matchesPattern = patterns.some((pattern) =>
      currentUrlLower.includes(pattern.toLowerCase())
    );

    if (matchesPattern) {
      console.log(`ℹ️  URL changed but this is EXPECTED (success flow)`);
      console.log(`   From: ${expectedUrl}`);
      console.log(`   To: ${currentUrl}`);
      return true;
    }

    return false;
  }
}
