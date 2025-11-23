/**
 * @saveaction/core - Test execution engine
 * Parses JSON recordings and replays them using Playwright
 */

// Parser
export { RecordingParser } from './parser/RecordingParser.js';

// Runner
export { PlaywrightRunner } from './runner/PlaywrightRunner.js';
export { ElementLocator } from './runner/ElementLocator.js';

// Reporter
export { ConsoleReporter } from './reporter/ConsoleReporter.js';

// Types
export type {
  Recording,
  Action,
  ClickAction,
  InputAction,
  ScrollAction,
  NavigationAction,
  SelectAction,
  KeypressAction,
  SubmitAction,
  SelectorStrategy,
} from './types/index.js';

export type { RunResult, RunOptions, Reporter } from './types/runner.js';
