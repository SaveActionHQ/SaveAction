/**
 * Repository exports
 */

export { UserRepository } from './UserRepository.js';
export type {
  UserUpdateData,
  UserCreateData,
  UserWithPassword,
  SafeUser,
} from './UserRepository.js';

export { ProjectRepository } from './ProjectRepository.js';
export type {
  ProjectCreateData,
  ProjectUpdateData,
  ProjectListFilters,
  SafeProject,
  ProjectWithStats,
} from './ProjectRepository.js';

export { ApiTokenRepository } from './ApiTokenRepository.js';
export type { ApiTokenCreateData, SafeApiToken, ApiTokenWithHash } from './ApiTokenRepository.js';

export { RecordingRepository } from './RecordingRepository.js';
export type {
  RecordingCreateData,
  RecordingUpdateData,
  RecordingListFilters,
  PaginationOptions,
  PaginatedResult,
  SafeRecording,
  RecordingSummary,
} from './RecordingRepository.js';

export { RunRepository } from './RunRepository.js';
export type {
  RunCreateData,
  RunUpdateData,
  RunListFilters,
  SafeRun,
  RunSummary,
  RunActionCreateData,
  SafeRunAction,
} from './RunRepository.js';

export { ScheduleRepository } from './ScheduleRepository.js';
export type {
  ScheduleCreateData,
  ScheduleUpdateData,
  ScheduleListFilters,
  SafeSchedule,
  ScheduleSummary,
} from './ScheduleRepository.js';

export { TestSuiteRepository, DEFAULT_SUITE_NAME } from './TestSuiteRepository.js';
export type {
  TestSuiteCreateData,
  TestSuiteUpdateData,
  TestSuiteListFilters,
  SafeTestSuite,
  TestSuiteWithStats,
} from './TestSuiteRepository.js';

export { TestRepository, generateSlug } from './TestRepository.js';
export type {
  TestCreateData,
  TestUpdateData,
  TestLastRunUpdate,
  TestListFilters,
  SafeTest,
  TestSummary,
} from './TestRepository.js';

export { RunBrowserResultRepository } from './RunBrowserResultRepository.js';
export type {
  BrowserResultCreateData,
  BrowserResultUpdateData,
  SafeBrowserResult,
  BrowserResultSummary,
} from './RunBrowserResultRepository.js';
