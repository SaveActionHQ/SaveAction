/**
 * @saveaction/core - Test execution engine
 * Parses JSON recordings and replays them using Playwright
 */

// Parser
export { RecordingParser } from './parser/RecordingParser.js';

// Analyzer
export { RecordingAnalyzer } from './analyzer/RecordingAnalyzer.js';

// Runner
export { PlaywrightRunner } from './runner/PlaywrightRunner.js';
export { ElementLocator } from './runner/ElementLocator.js';
export { NavigationHistoryManager } from './runner/NavigationHistoryManager.js';
export { NavigationAnalyzer } from './runner/NavigationAnalyzer.js';

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

export type {
  RecordingAnalysis,
  RecordingAnalysisJSON,
  RecordingMetadata,
  ViewportInfo,
  ActionStatistics,
  TimingAnalysis,
  NavigationInsights,
} from './types/analyzer.js';
