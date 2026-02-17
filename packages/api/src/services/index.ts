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
  QueueTestRunRequest,
  QueueSuiteRunRequest,
} from './RunnerService.js';
export {
  createRunSchema,
  listRunsQuerySchema,
  queueTestRunSchema,
  queueSuiteRunSchema,
} from './RunnerService.js';

export { ScheduleService, ScheduleError, ScheduleErrors } from './ScheduleService.js';
export type {
  ScheduleServiceOptions,
  CreateScheduleInput,
  UpdateScheduleInput,
} from './ScheduleService.js';
export { createScheduleSchema, updateScheduleSchema } from './ScheduleService.js';

export {
  ProjectService,
  ProjectError,
  ProjectErrors,
  DEFAULT_PROJECT_NAME,
} from './ProjectService.js';
export type {
  ProjectServiceConfig,
  CreateProjectRequest,
  UpdateProjectRequest,
  ListProjectsQuery,
  ProjectResponse,
} from './ProjectService.js';
export {
  createProjectSchema,
  updateProjectSchema,
  listProjectsQuerySchema,
} from './ProjectService.js';

export {
  TestSuiteService,
  TestSuiteError,
  TestSuiteErrors,
  DEFAULT_SUITE_NAME,
} from './TestSuiteService.js';
export type {
  TestSuiteServiceConfig,
  CreateTestSuiteRequest,
  UpdateTestSuiteRequest,
  ListTestSuitesQuery,
  ReorderTestSuitesRequest,
  TestSuiteResponse,
  TestSuiteWithStatsResponse,
} from './TestSuiteService.js';
export {
  createTestSuiteSchema,
  updateTestSuiteSchema,
  listTestSuitesQuerySchema,
  reorderTestSuitesSchema,
} from './TestSuiteService.js';

export {
  TestService,
  TestError,
  TestErrors,
  DEFAULT_TEST_CONFIG,
} from './TestService.js';
export type {
  TestServiceConfig,
  CreateTestRequest,
  UpdateTestRequest,
  ListTestsQuery,
  MoveTestsRequest,
  ReorderTestsRequest,
  TestResponse,
  TestSummaryResponse,
  BrowserType,
  TestConfig,
} from './TestService.js';
export {
  createTestSchema,
  updateTestSchema,
  listTestsQuerySchema,
  moveTestsSchema,
  reorderTestsSchema,
} from './TestService.js';
