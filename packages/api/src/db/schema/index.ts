/**
 * Database Schema - Central Export
 *
 * All tables, types, and enums are exported from here.
 * Import from '@saveaction/api/db/schema' or './schema/index.js'
 */

// Users
export { users, type User, type NewUser } from './users.js';

// Projects
export {
  projects,
  DEFAULT_PROJECT_NAME,
  DEFAULT_PROJECT_SLUG,
  generateSlug,
  SLUG_REGEX,
  type Project,
  type NewProject,
} from './projects.js';

// API Tokens
export { apiTokens, type ApiToken, type NewApiToken } from './api-tokens.js';

// Recordings (Legacy - now Recording Library)
export { recordings, type Recording, type NewRecording, type RecordingData } from './recordings.js';

// Test Suites (NEW)
export { testSuites, type TestSuite, type NewTestSuite } from './test-suites.js';

// Tests (NEW)
export {
  tests,
  DEFAULT_TEST_CONFIG,
  type Test,
  type NewTest,
  type TestConfig,
  type BrowserType as TestBrowserType,
} from './tests.js';

// Run Browser Results (NEW)
export {
  runBrowserResults,
  browserResultStatusEnum,
  type RunBrowserResult,
  type NewRunBrowserResult,
  type BrowserResultStatus,
} from './run-browser-results.js';

// Runs (Updated)
export {
  runs,
  runStatusEnum,
  browserEnum,
  runTypeEnum,
  type Run,
  type NewRun,
  type RunStatus,
  type BrowserType,
  type RunType,
} from './runs.js';

// Run Actions
export {
  runActions,
  actionStatusEnum,
  type RunAction,
  type NewRunAction,
  type ActionStatus,
} from './run-actions.js';

// Schedules (Updated)
export {
  schedules,
  scheduleStatusEnum,
  scheduleTargetTypeEnum,
  type Schedule,
  type NewSchedule,
  type ScheduleStatus,
  type ScheduleTargetType,
} from './schedules.js';

// Webhooks
export {
  webhooks,
  webhookDeliveries,
  webhookEventEnum,
  webhookStatusEnum,
  type Webhook,
  type NewWebhook,
  type WebhookStatus,
  type WebhookEvent,
  type WebhookDelivery,
  type NewWebhookDelivery,
} from './webhooks.js';

/**
 * All tables for migration/introspection
 */
export const allTables = {
  users: 'users',
  projects: 'projects',
  apiTokens: 'api_tokens',
  recordings: 'recordings',
  testSuites: 'test_suites',
  tests: 'tests',
  runs: 'runs',
  runActions: 'run_actions',
  runBrowserResults: 'run_browser_results',
  schedules: 'schedules',
  webhooks: 'webhooks',
  webhookDeliveries: 'webhook_deliveries',
} as const;
