import type { Action } from '../types/index.js';

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
}

/**
 * Options for running tests
 */
export interface RunOptions {
  headless?: boolean; // Default: true
  browser?: 'chromium' | 'firefox' | 'webkit'; // Default: chromium
  video?: boolean; // Default: false
  screenshot?: boolean; // Default: false
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
