import type { Action } from '../types/index.js';

/**
 * Screenshot capture mode for test runs
 */
export type ScreenshotMode = 'on-failure' | 'always' | 'never';

/**
 * Result of a test run
 */
export interface RunResult {
  status: 'success' | 'failed' | 'partial' | 'cancelled';
  duration: number; // milliseconds
  actionsTotal: number;
  actionsExecuted: number;
  actionsFailed: number;
  errors: ActionError[];
  video?: string; // path to video file
  screenshots?: string[]; // paths to screenshot files
  timingEnabled?: boolean; // Whether timing delays were used
  skippedActions?: SkippedAction[]; // Phase 2: Track skipped optional actions
}

/**
 * Error during action execution
 */
export interface ActionError {
  actionId: string;
  actionType: string;
  error: string;
  timestamp: number;
  screenshotPath?: string; // Screenshot captured on error
}

/**
 * Skipped action (Phase 2)
 */
export interface SkippedAction {
  action: Action;
  reason: string; // Why skipped
}

/**
 * Action execution result (Phase 2)
 */
export interface ActionResult {
  action: Action;
  status: 'success' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  screenshotPath?: string; // Screenshot path if captured
}

/**
 * Options for running tests
 */
export interface RunOptions {
  headless?: boolean; // Default: true
  browser?: 'chromium' | 'firefox' | 'webkit'; // Default: chromium
  video?: boolean; // Default: false
  screenshot?: boolean; // Default: false - enable screenshot capture
  screenshotMode?: ScreenshotMode; // Default: 'on-failure'
  screenshotDir?: string; // Default: './screenshots'
  timeout?: number; // Default: 30000ms

  // Timing options for realistic playback
  enableTiming?: boolean; // Default: true - use recorded timing delays
  timingMode?: 'realistic' | 'fast' | 'instant'; // Preset timing modes
  speedMultiplier?: number; // Default: 1.0 - manual speed control
  maxActionDelay?: number; // Default: 30000ms - safety cap for delays

  // Phase 2: Error handling
  continueOnError?: boolean; // Default: false - continue after non-fatal errors

  // Cancellation support
  abortSignal?: AbortSignal; // Signal to cancel the run

  // Run identification (for screenshot naming)
  runId?: string; // Unique run identifier for screenshot filenames
}

/**
 * Result reporter interface
 */
export interface Reporter {
  onStart(recording: { testName: string; actionsTotal: number }): void;
  onActionStart(action: Action, index: number): void;
  onActionSuccess(action: Action, index: number, duration: number): void;
  onActionError(action: Action, index: number, error: Error): void;
  onComplete(result: RunResult): void;
}
