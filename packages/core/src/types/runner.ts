import type { Action } from '../types/index.js';

/**
 * Result of a test run
 */
export interface RunResult {
  status: 'success' | 'failed' | 'partial';
  duration: number; // milliseconds
  actionsTotal: number;
  actionsExecuted: number;
  actionsFailed: number;
  errors: ActionError[];
  video?: string; // path to video file
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
 * Options for running tests
 */
export interface RunOptions {
  headless?: boolean; // Default: true
  browser?: 'chromium' | 'firefox' | 'webkit'; // Default: chromium
  video?: boolean; // Default: false
  screenshot?: boolean; // Default: false
  timeout?: number; // Default: 30000ms
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
