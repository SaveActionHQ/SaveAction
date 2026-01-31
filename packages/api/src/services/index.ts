/**
 * Services Index
 *
 * Export all service classes.
 */

export { EmailService, createTestEmailAccount } from './EmailService.js';
export type {
  EmailConfig,
  EmailOptions,
  EmailResult,
  PasswordResetEmailData,
} from './EmailService.js';

export { LockoutService } from './LockoutService.js';
export type { LockoutConfig, LockoutStatus, LockoutEvent } from './LockoutService.js';

export { ApiTokenService, ApiTokenError, ApiTokenErrors } from './ApiTokenService.js';
export type { ApiTokenServiceConfig } from './ApiTokenService.js';

export { RecordingService, RecordingError, RecordingErrors } from './RecordingService.js';
export type {
  RecordingServiceConfig,
  CreateRecordingRequest,
  UpdateRecordingRequest,
  ListRecordingsQuery,
  RecordingResponse,
  RecordingDetailResponse,
} from './RecordingService.js';
export {
  createRecordingSchema,
  updateRecordingSchema,
  listRecordingsQuerySchema,
  recordingDataSchema,
} from './RecordingService.js';

export { RunnerService, RunError, RunErrors } from './RunnerService.js';
export type {
  RunnerServiceOptions,
  CreateRunRequest,
  ListRunsQuery,
  ExecutionResult,
  ActionExecutionResult,
} from './RunnerService.js';
export { createRunSchema, listRunsQuerySchema } from './RunnerService.js';
