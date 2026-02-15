/**
 * Database Schema - Central Export
 *
 * All tables, types, and enums are exported from here.
 * Import from '@saveaction/api/db/schema' or './schema/index.js'
 */

// Users
export { users, type User, type NewUser } from './users.js';

// Projects
export { projects, DEFAULT_PROJECT_NAME, type Project, type NewProject } from './projects.js';

// API Tokens
export { apiTokens, type ApiToken, type NewApiToken } from './api-tokens.js';

// Recordings
export { recordings, type Recording, type NewRecording, type RecordingData } from './recordings.js';

// Runs
export {
  runs,
  runStatusEnum,
  browserEnum,
  type Run,
  type NewRun,
  type RunStatus,
  type BrowserType,
} from './runs.js';

// Run Actions
export {
  runActions,
  actionStatusEnum,
  type RunAction,
  type NewRunAction,
  type ActionStatus,
} from './run-actions.js';

// Schedules
export {
  schedules,
  scheduleStatusEnum,
  type Schedule,
  type NewSchedule,
  type ScheduleStatus,
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
  runs: 'runs',
  runActions: 'run_actions',
  schedules: 'schedules',
  webhooks: 'webhooks',
  webhookDeliveries: 'webhook_deliveries',
} as const;
