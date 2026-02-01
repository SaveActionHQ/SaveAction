/**
 * CI Environment Detector
 *
 * Auto-detects CI/CD environments and captures metadata for traceability.
 * Supports: GitHub Actions, GitLab CI, Jenkins, CircleCI, Azure Pipelines,
 * Travis CI, Bitbucket Pipelines, TeamCity, and generic CI detection.
 */

/**
 * Supported CI providers
 */
export type CIProvider =
  | 'github-actions'
  | 'gitlab-ci'
  | 'jenkins'
  | 'circleci'
  | 'azure-pipelines'
  | 'travis-ci'
  | 'bitbucket-pipelines'
  | 'teamcity'
  | 'generic';

/**
 * CI environment metadata
 */
export interface CIMetadata {
  /** Whether running in a CI environment */
  detected: boolean;
  /** CI provider name */
  provider: CIProvider | null;
  /** Git commit SHA */
  commit: string | null;
  /** Git branch name */
  branch: string | null;
  /** Pull/Merge request number */
  pr: number | null;
  /** CI workflow/job name */
  workflow: string | null;
  /** CI build number */
  buildNumber: string | null;
  /** URL to the CI build/run */
  buildUrl: string | null;
  /** Repository name (owner/repo) */
  repository: string | null;
  /** Actor/user who triggered the build */
  actor: string | null;
  /** Event that triggered the build (push, pull_request, etc.) */
  event: string | null;
}

/**
 * Provider detection configuration
 */
interface ProviderConfig {
  name: CIProvider;
  detect: () => boolean;
  getMetadata: () => Partial<CIMetadata>;
}

/**
 * CI Environment Detector
 *
 * Detects CI environment and extracts metadata from environment variables.
 *
 * @example
 * ```typescript
 * const detector = new CIDetector();
 * const ci = detector.detect();
 *
 * if (ci.detected) {
 *   console.log(`Running in ${ci.provider}`);
 *   console.log(`Commit: ${ci.commit}`);
 * }
 * ```
 */
export class CIDetector {
  private env: NodeJS.ProcessEnv;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.env = env;
  }

  /**
   * Detect CI environment and gather metadata
   */
  detect(): CIMetadata {
    const providers = this.getProviders();

    for (const provider of providers) {
      if (provider.detect()) {
        const metadata = provider.getMetadata();
        return {
          detected: true,
          provider: provider.name,
          commit: metadata.commit ?? null,
          branch: metadata.branch ?? null,
          pr: metadata.pr ?? null,
          workflow: metadata.workflow ?? null,
          buildNumber: metadata.buildNumber ?? null,
          buildUrl: metadata.buildUrl ?? null,
          repository: metadata.repository ?? null,
          actor: metadata.actor ?? null,
          event: metadata.event ?? null,
        };
      }
    }

    // Check for generic CI indicators
    if (this.isGenericCI()) {
      return {
        detected: true,
        provider: 'generic',
        commit: this.env.GIT_COMMIT ?? this.env.COMMIT_SHA ?? null,
        branch: this.env.GIT_BRANCH ?? this.env.BRANCH_NAME ?? this.env.BRANCH ?? null,
        pr: null,
        workflow: null,
        buildNumber: this.env.BUILD_NUMBER ?? this.env.BUILD_ID ?? null,
        buildUrl: this.env.BUILD_URL ?? null,
        repository: null,
        actor: null,
        event: null,
      };
    }

    // Not in CI
    return {
      detected: false,
      provider: null,
      commit: null,
      branch: null,
      pr: null,
      workflow: null,
      buildNumber: null,
      buildUrl: null,
      repository: null,
      actor: null,
      event: null,
    };
  }

  /**
   * Check if running in any CI environment (quick check)
   */
  isCI(): boolean {
    return (
      this.env.CI === 'true' ||
      this.env.CI === '1' ||
      this.env.CONTINUOUS_INTEGRATION === 'true' ||
      this.env.BUILD_NUMBER !== undefined ||
      this.env.GITHUB_ACTIONS === 'true' ||
      this.env.GITLAB_CI === 'true' ||
      this.env.JENKINS_URL !== undefined ||
      this.env.CIRCLECI === 'true' ||
      this.env.TF_BUILD === 'True' ||
      this.env.TRAVIS === 'true' ||
      this.env.BITBUCKET_BUILD_NUMBER !== undefined ||
      this.env.TEAMCITY_VERSION !== undefined
    );
  }

  /**
   * Get provider configurations in detection priority order
   */
  private getProviders(): ProviderConfig[] {
    return [
      this.getGitHubActionsConfig(),
      this.getGitLabCIConfig(),
      this.getJenkinsConfig(),
      this.getCircleCIConfig(),
      this.getAzurePipelinesConfig(),
      this.getTravisCIConfig(),
      this.getBitbucketPipelinesConfig(),
      this.getTeamCityConfig(),
    ];
  }

  /**
   * GitHub Actions configuration
   */
  private getGitHubActionsConfig(): ProviderConfig {
    return {
      name: 'github-actions',
      detect: () => this.env.GITHUB_ACTIONS === 'true',
      getMetadata: () => {
        const prNumber =
          this.env.GITHUB_EVENT_NAME === 'pull_request'
            ? this.parsePRNumber(this.env.GITHUB_REF)
            : null;

        return {
          commit: this.env.GITHUB_SHA,
          branch: this.env.GITHUB_HEAD_REF || this.env.GITHUB_REF_NAME,
          pr: prNumber,
          workflow: this.env.GITHUB_WORKFLOW,
          buildNumber: this.env.GITHUB_RUN_NUMBER,
          buildUrl:
            this.env.GITHUB_SERVER_URL && this.env.GITHUB_REPOSITORY && this.env.GITHUB_RUN_ID
              ? `${this.env.GITHUB_SERVER_URL}/${this.env.GITHUB_REPOSITORY}/actions/runs/${this.env.GITHUB_RUN_ID}`
              : null,
          repository: this.env.GITHUB_REPOSITORY,
          actor: this.env.GITHUB_ACTOR,
          event: this.env.GITHUB_EVENT_NAME,
        };
      },
    };
  }

  /**
   * GitLab CI configuration
   */
  private getGitLabCIConfig(): ProviderConfig {
    return {
      name: 'gitlab-ci',
      detect: () => this.env.GITLAB_CI === 'true',
      getMetadata: () => ({
        commit: this.env.CI_COMMIT_SHA,
        branch: this.env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME || this.env.CI_COMMIT_REF_NAME,
        pr: this.parseNumber(this.env.CI_MERGE_REQUEST_IID),
        workflow: this.env.CI_PIPELINE_NAME || this.env.CI_JOB_NAME,
        buildNumber: this.env.CI_PIPELINE_ID,
        buildUrl: this.env.CI_PIPELINE_URL,
        repository: this.env.CI_PROJECT_PATH,
        actor: this.env.GITLAB_USER_LOGIN,
        event: this.env.CI_PIPELINE_SOURCE,
      }),
    };
  }

  /**
   * Jenkins configuration
   */
  private getJenkinsConfig(): ProviderConfig {
    return {
      name: 'jenkins',
      detect: () => this.env.JENKINS_URL !== undefined || this.env.JENKINS_HOME !== undefined,
      getMetadata: () => ({
        commit: this.env.GIT_COMMIT,
        branch: this.env.GIT_BRANCH?.replace('origin/', '') || this.env.BRANCH_NAME,
        pr: this.parseNumber(this.env.CHANGE_ID),
        workflow: this.env.JOB_NAME,
        buildNumber: this.env.BUILD_NUMBER,
        buildUrl: this.env.BUILD_URL,
        repository: this.env.GIT_URL?.replace(/\.git$/, '')
          .split('/')
          .slice(-2)
          .join('/'),
        actor: this.env.CHANGE_AUTHOR || this.env.BUILD_USER,
        event: this.env.CHANGE_ID ? 'pull_request' : 'push',
      }),
    };
  }

  /**
   * CircleCI configuration
   */
  private getCircleCIConfig(): ProviderConfig {
    return {
      name: 'circleci',
      detect: () => this.env.CIRCLECI === 'true',
      getMetadata: () => ({
        commit: this.env.CIRCLE_SHA1,
        branch: this.env.CIRCLE_BRANCH,
        pr: this.parseNumber(this.env.CIRCLE_PR_NUMBER),
        workflow: this.env.CIRCLE_WORKFLOW_JOB_NAME || this.env.CIRCLE_JOB,
        buildNumber: this.env.CIRCLE_BUILD_NUM,
        buildUrl: this.env.CIRCLE_BUILD_URL,
        repository:
          this.env.CIRCLE_PROJECT_USERNAME && this.env.CIRCLE_PROJECT_REPONAME
            ? `${this.env.CIRCLE_PROJECT_USERNAME}/${this.env.CIRCLE_PROJECT_REPONAME}`
            : null,
        actor: this.env.CIRCLE_USERNAME,
        event: this.env.CIRCLE_PR_NUMBER ? 'pull_request' : 'push',
      }),
    };
  }

  /**
   * Azure Pipelines configuration
   */
  private getAzurePipelinesConfig(): ProviderConfig {
    return {
      name: 'azure-pipelines',
      detect: () => this.env.TF_BUILD === 'True',
      getMetadata: () => ({
        commit: this.env.BUILD_SOURCEVERSION,
        branch:
          this.env.SYSTEM_PULLREQUEST_SOURCEBRANCH?.replace('refs/heads/', '') ||
          this.env.BUILD_SOURCEBRANCHNAME,
        pr: this.parseNumber(this.env.SYSTEM_PULLREQUEST_PULLREQUESTID),
        workflow: this.env.BUILD_DEFINITIONNAME,
        buildNumber: this.env.BUILD_BUILDNUMBER,
        buildUrl:
          this.env.SYSTEM_TEAMFOUNDATIONSERVERURI &&
          this.env.SYSTEM_TEAMPROJECT &&
          this.env.BUILD_BUILDID
            ? `${this.env.SYSTEM_TEAMFOUNDATIONSERVERURI}${this.env.SYSTEM_TEAMPROJECT}/_build/results?buildId=${this.env.BUILD_BUILDID}`
            : null,
        repository: this.env.BUILD_REPOSITORY_NAME,
        actor: this.env.BUILD_REQUESTEDFOR,
        event: this.env.BUILD_REASON?.toLowerCase(),
      }),
    };
  }

  /**
   * Travis CI configuration
   */
  private getTravisCIConfig(): ProviderConfig {
    return {
      name: 'travis-ci',
      detect: () => this.env.TRAVIS === 'true',
      getMetadata: () => ({
        commit: this.env.TRAVIS_COMMIT,
        branch: this.env.TRAVIS_PULL_REQUEST_BRANCH || this.env.TRAVIS_BRANCH,
        pr:
          this.env.TRAVIS_PULL_REQUEST !== 'false'
            ? this.parseNumber(this.env.TRAVIS_PULL_REQUEST)
            : null,
        workflow: this.env.TRAVIS_JOB_NAME,
        buildNumber: this.env.TRAVIS_BUILD_NUMBER,
        buildUrl: this.env.TRAVIS_BUILD_WEB_URL,
        repository: this.env.TRAVIS_REPO_SLUG,
        actor: null, // Travis doesn't expose actor
        event: this.env.TRAVIS_EVENT_TYPE,
      }),
    };
  }

  /**
   * Bitbucket Pipelines configuration
   */
  private getBitbucketPipelinesConfig(): ProviderConfig {
    return {
      name: 'bitbucket-pipelines',
      detect: () => this.env.BITBUCKET_BUILD_NUMBER !== undefined,
      getMetadata: () => ({
        commit: this.env.BITBUCKET_COMMIT,
        branch: this.env.BITBUCKET_BRANCH,
        pr: this.parseNumber(this.env.BITBUCKET_PR_ID),
        workflow: this.env.BITBUCKET_STEP_NAME,
        buildNumber: this.env.BITBUCKET_BUILD_NUMBER,
        buildUrl:
          this.env.BITBUCKET_REPO_FULL_NAME && this.env.BITBUCKET_BUILD_NUMBER
            ? `https://bitbucket.org/${this.env.BITBUCKET_REPO_FULL_NAME}/pipelines/results/${this.env.BITBUCKET_BUILD_NUMBER}`
            : null,
        repository: this.env.BITBUCKET_REPO_FULL_NAME,
        actor: null, // Bitbucket doesn't expose actor directly
        event: this.env.BITBUCKET_PR_ID ? 'pull_request' : 'push',
      }),
    };
  }

  /**
   * TeamCity configuration
   */
  private getTeamCityConfig(): ProviderConfig {
    return {
      name: 'teamcity',
      detect: () => this.env.TEAMCITY_VERSION !== undefined,
      getMetadata: () => ({
        commit: this.env.BUILD_VCS_NUMBER,
        branch: this.env.BRANCH_NAME,
        pr: null, // TeamCity doesn't have standard PR env vars
        workflow: this.env.TEAMCITY_BUILDCONF_NAME,
        buildNumber: this.env.BUILD_NUMBER,
        buildUrl: this.env.BUILD_URL,
        repository: null,
        actor: null,
        event: null,
      }),
    };
  }

  /**
   * Check for generic CI environment
   */
  private isGenericCI(): boolean {
    return (
      this.env.CI === 'true' || this.env.CI === '1' || this.env.CONTINUOUS_INTEGRATION === 'true'
    );
  }

  /**
   * Parse PR number from GitHub ref (refs/pull/123/merge)
   */
  private parsePRNumber(ref: string | undefined): number | null {
    if (!ref) return null;
    const match = ref.match(/refs\/pull\/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Parse string to number
   */
  private parseNumber(value: string | undefined): number | null {
    if (!value) return null;
    const num = parseInt(value, 10);
    return isNaN(num) ? null : num;
  }
}

/**
 * Create a CI detector instance with the current process environment
 */
export function createCIDetector(): CIDetector {
  return new CIDetector();
}

/**
 * Quick check if running in CI (without full detection)
 */
export function isCI(): boolean {
  return new CIDetector().isCI();
}

/**
 * Detect CI environment and return metadata
 */
export function detectCI(): CIMetadata {
  return new CIDetector().detect();
}
