import { describe, it, expect, beforeEach } from 'vitest';
import { CIDetector, createCIDetector, isCI, detectCI, type CIMetadata } from './CIDetector.js';

describe('CIDetector', () => {
  describe('constructor', () => {
    it('should use process.env by default', () => {
      const detector = new CIDetector();
      expect(detector).toBeInstanceOf(CIDetector);
    });

    it('should accept custom environment', () => {
      const customEnv = { CI: 'true' };
      const detector = new CIDetector(customEnv);
      expect(detector.isCI()).toBe(true);
    });
  });

  describe('isCI', () => {
    it('should return true when CI=true', () => {
      const detector = new CIDetector({ CI: 'true' });
      expect(detector.isCI()).toBe(true);
    });

    it('should return true when CI=1', () => {
      const detector = new CIDetector({ CI: '1' });
      expect(detector.isCI()).toBe(true);
    });

    it('should return true when CONTINUOUS_INTEGRATION=true', () => {
      const detector = new CIDetector({ CONTINUOUS_INTEGRATION: 'true' });
      expect(detector.isCI()).toBe(true);
    });

    it('should return true when BUILD_NUMBER is set', () => {
      const detector = new CIDetector({ BUILD_NUMBER: '123' });
      expect(detector.isCI()).toBe(true);
    });

    it('should return false when no CI indicators', () => {
      const detector = new CIDetector({});
      expect(detector.isCI()).toBe(false);
    });
  });

  describe('detect - GitHub Actions', () => {
    it('should detect GitHub Actions', () => {
      const env = {
        GITHUB_ACTIONS: 'true',
        GITHUB_SHA: 'abc123def456',
        GITHUB_REF_NAME: 'main',
        GITHUB_WORKFLOW: 'CI',
        GITHUB_RUN_NUMBER: '42',
        GITHUB_RUN_ID: '12345',
        GITHUB_REPOSITORY: 'owner/repo',
        GITHUB_ACTOR: 'testuser',
        GITHUB_EVENT_NAME: 'push',
        GITHUB_SERVER_URL: 'https://github.com',
      };

      const detector = new CIDetector(env);
      const result = detector.detect();

      expect(result.detected).toBe(true);
      expect(result.provider).toBe('github-actions');
      expect(result.commit).toBe('abc123def456');
      expect(result.branch).toBe('main');
      expect(result.workflow).toBe('CI');
      expect(result.buildNumber).toBe('42');
      expect(result.repository).toBe('owner/repo');
      expect(result.actor).toBe('testuser');
      expect(result.event).toBe('push');
      expect(result.buildUrl).toBe('https://github.com/owner/repo/actions/runs/12345');
    });

    it('should detect PR number from GITHUB_REF in pull_request event', () => {
      const env = {
        GITHUB_ACTIONS: 'true',
        GITHUB_SHA: 'abc123',
        GITHUB_REF: 'refs/pull/123/merge',
        GITHUB_HEAD_REF: 'feature-branch',
        GITHUB_EVENT_NAME: 'pull_request',
      };

      const detector = new CIDetector(env);
      const result = detector.detect();

      expect(result.pr).toBe(123);
      expect(result.branch).toBe('feature-branch');
    });

    it('should handle missing optional fields', () => {
      const env = {
        GITHUB_ACTIONS: 'true',
        GITHUB_SHA: 'abc123',
      };

      const detector = new CIDetector(env);
      const result = detector.detect();

      expect(result.detected).toBe(true);
      expect(result.provider).toBe('github-actions');
      expect(result.commit).toBe('abc123');
      expect(result.branch).toBeNull();
      expect(result.pr).toBeNull();
      expect(result.buildUrl).toBeNull();
    });
  });

  describe('detect - GitLab CI', () => {
    it('should detect GitLab CI', () => {
      const env = {
        GITLAB_CI: 'true',
        CI_COMMIT_SHA: 'def456abc789',
        CI_COMMIT_REF_NAME: 'develop',
        CI_PIPELINE_NAME: 'Test Pipeline',
        CI_PIPELINE_ID: '999',
        CI_PIPELINE_URL: 'https://gitlab.com/project/-/pipelines/999',
        CI_PROJECT_PATH: 'group/project',
        GITLAB_USER_LOGIN: 'gitlabuser',
        CI_PIPELINE_SOURCE: 'push',
      };

      const detector = new CIDetector(env);
      const result = detector.detect();

      expect(result.detected).toBe(true);
      expect(result.provider).toBe('gitlab-ci');
      expect(result.commit).toBe('def456abc789');
      expect(result.branch).toBe('develop');
      expect(result.workflow).toBe('Test Pipeline');
      expect(result.buildNumber).toBe('999');
      expect(result.buildUrl).toBe('https://gitlab.com/project/-/pipelines/999');
      expect(result.repository).toBe('group/project');
      expect(result.actor).toBe('gitlabuser');
      expect(result.event).toBe('push');
    });

    it('should detect merge request info', () => {
      const env = {
        GITLAB_CI: 'true',
        CI_COMMIT_SHA: 'abc123',
        CI_MERGE_REQUEST_SOURCE_BRANCH_NAME: 'feature/test',
        CI_MERGE_REQUEST_IID: '42',
      };

      const detector = new CIDetector(env);
      const result = detector.detect();

      expect(result.branch).toBe('feature/test');
      expect(result.pr).toBe(42);
    });
  });

  describe('detect - Jenkins', () => {
    it('should detect Jenkins via JENKINS_URL', () => {
      const env = {
        JENKINS_URL: 'https://jenkins.example.com',
        GIT_COMMIT: 'jenkins123abc',
        GIT_BRANCH: 'origin/main',
        JOB_NAME: 'my-job',
        BUILD_NUMBER: '100',
        BUILD_URL: 'https://jenkins.example.com/job/my-job/100',
        GIT_URL: 'https://github.com/owner/repo.git',
      };

      const detector = new CIDetector(env);
      const result = detector.detect();

      expect(result.detected).toBe(true);
      expect(result.provider).toBe('jenkins');
      expect(result.commit).toBe('jenkins123abc');
      expect(result.branch).toBe('main');
      expect(result.workflow).toBe('my-job');
      expect(result.buildNumber).toBe('100');
      expect(result.buildUrl).toBe('https://jenkins.example.com/job/my-job/100');
      expect(result.repository).toBe('owner/repo');
    });

    it('should detect Jenkins via JENKINS_HOME', () => {
      const env = {
        JENKINS_HOME: '/var/jenkins_home',
        GIT_COMMIT: 'abc123',
      };

      const detector = new CIDetector(env);
      const result = detector.detect();

      expect(result.detected).toBe(true);
      expect(result.provider).toBe('jenkins');
    });

    it('should detect PR info in Jenkins', () => {
      const env = {
        JENKINS_URL: 'https://jenkins.example.com',
        CHANGE_ID: '77',
        CHANGE_AUTHOR: 'developer',
      };

      const detector = new CIDetector(env);
      const result = detector.detect();

      expect(result.pr).toBe(77);
      expect(result.actor).toBe('developer');
      expect(result.event).toBe('pull_request');
    });

    it('should use BRANCH_NAME as fallback', () => {
      const env = {
        JENKINS_URL: 'https://jenkins.example.com',
        BRANCH_NAME: 'feature-x',
      };

      const detector = new CIDetector(env);
      const result = detector.detect();

      expect(result.branch).toBe('feature-x');
    });
  });

  describe('detect - CircleCI', () => {
    it('should detect CircleCI', () => {
      const env = {
        CIRCLECI: 'true',
        CIRCLE_SHA1: 'circle123',
        CIRCLE_BRANCH: 'master',
        CIRCLE_JOB: 'build',
        CIRCLE_BUILD_NUM: '55',
        CIRCLE_BUILD_URL: 'https://circleci.com/gh/owner/repo/55',
        CIRCLE_PROJECT_USERNAME: 'owner',
        CIRCLE_PROJECT_REPONAME: 'repo',
        CIRCLE_USERNAME: 'circleuser',
      };

      const detector = new CIDetector(env);
      const result = detector.detect();

      expect(result.detected).toBe(true);
      expect(result.provider).toBe('circleci');
      expect(result.commit).toBe('circle123');
      expect(result.branch).toBe('master');
      expect(result.workflow).toBe('build');
      expect(result.buildNumber).toBe('55');
      expect(result.buildUrl).toBe('https://circleci.com/gh/owner/repo/55');
      expect(result.repository).toBe('owner/repo');
      expect(result.actor).toBe('circleuser');
    });

    it('should detect PR in CircleCI', () => {
      const env = {
        CIRCLECI: 'true',
        CIRCLE_PR_NUMBER: '88',
      };

      const detector = new CIDetector(env);
      const result = detector.detect();

      expect(result.pr).toBe(88);
      expect(result.event).toBe('pull_request');
    });

    it('should prefer CIRCLE_WORKFLOW_JOB_NAME over CIRCLE_JOB', () => {
      const env = {
        CIRCLECI: 'true',
        CIRCLE_WORKFLOW_JOB_NAME: 'workflow-job',
        CIRCLE_JOB: 'simple-job',
      };

      const detector = new CIDetector(env);
      const result = detector.detect();

      expect(result.workflow).toBe('workflow-job');
    });
  });

  describe('detect - Azure Pipelines', () => {
    it('should detect Azure Pipelines', () => {
      const env = {
        TF_BUILD: 'True',
        BUILD_SOURCEVERSION: 'azure123',
        BUILD_SOURCEBRANCHNAME: 'main',
        BUILD_DEFINITIONNAME: 'My Pipeline',
        BUILD_BUILDNUMBER: '20260201.1',
        BUILD_BUILDID: '777',
        BUILD_REPOSITORY_NAME: 'my-repo',
        BUILD_REQUESTEDFOR: 'Azure User',
        BUILD_REASON: 'IndividualCI',
        SYSTEM_TEAMFOUNDATIONSERVERURI: 'https://dev.azure.com/myorg/',
        SYSTEM_TEAMPROJECT: 'MyProject',
      };

      const detector = new CIDetector(env);
      const result = detector.detect();

      expect(result.detected).toBe(true);
      expect(result.provider).toBe('azure-pipelines');
      expect(result.commit).toBe('azure123');
      expect(result.branch).toBe('main');
      expect(result.workflow).toBe('My Pipeline');
      expect(result.buildNumber).toBe('20260201.1');
      expect(result.repository).toBe('my-repo');
      expect(result.actor).toBe('Azure User');
      expect(result.event).toBe('individualci');
      expect(result.buildUrl).toBe(
        'https://dev.azure.com/myorg/MyProject/_build/results?buildId=777'
      );
    });

    it('should detect PR in Azure Pipelines', () => {
      const env = {
        TF_BUILD: 'True',
        SYSTEM_PULLREQUEST_PULLREQUESTID: '99',
        SYSTEM_PULLREQUEST_SOURCEBRANCH: 'refs/heads/feature/pr',
      };

      const detector = new CIDetector(env);
      const result = detector.detect();

      expect(result.pr).toBe(99);
      expect(result.branch).toBe('feature/pr');
    });
  });

  describe('detect - Travis CI', () => {
    it('should detect Travis CI', () => {
      const env = {
        TRAVIS: 'true',
        TRAVIS_COMMIT: 'travis123',
        TRAVIS_BRANCH: 'develop',
        TRAVIS_JOB_NAME: 'test',
        TRAVIS_BUILD_NUMBER: '200',
        TRAVIS_BUILD_WEB_URL: 'https://travis-ci.com/owner/repo/builds/123',
        TRAVIS_REPO_SLUG: 'owner/repo',
        TRAVIS_EVENT_TYPE: 'push',
        TRAVIS_PULL_REQUEST: 'false',
      };

      const detector = new CIDetector(env);
      const result = detector.detect();

      expect(result.detected).toBe(true);
      expect(result.provider).toBe('travis-ci');
      expect(result.commit).toBe('travis123');
      expect(result.branch).toBe('develop');
      expect(result.workflow).toBe('test');
      expect(result.buildNumber).toBe('200');
      expect(result.buildUrl).toBe('https://travis-ci.com/owner/repo/builds/123');
      expect(result.repository).toBe('owner/repo');
      expect(result.event).toBe('push');
      expect(result.pr).toBeNull();
    });

    it('should detect PR in Travis CI', () => {
      const env = {
        TRAVIS: 'true',
        TRAVIS_PULL_REQUEST: '33',
        TRAVIS_PULL_REQUEST_BRANCH: 'feature/test',
      };

      const detector = new CIDetector(env);
      const result = detector.detect();

      expect(result.pr).toBe(33);
      expect(result.branch).toBe('feature/test');
    });
  });

  describe('detect - Bitbucket Pipelines', () => {
    it('should detect Bitbucket Pipelines', () => {
      const env = {
        BITBUCKET_BUILD_NUMBER: '50',
        BITBUCKET_COMMIT: 'bitbucket123',
        BITBUCKET_BRANCH: 'main',
        BITBUCKET_STEP_NAME: 'Build and Test',
        BITBUCKET_REPO_FULL_NAME: 'workspace/repo',
      };

      const detector = new CIDetector(env);
      const result = detector.detect();

      expect(result.detected).toBe(true);
      expect(result.provider).toBe('bitbucket-pipelines');
      expect(result.commit).toBe('bitbucket123');
      expect(result.branch).toBe('main');
      expect(result.workflow).toBe('Build and Test');
      expect(result.buildNumber).toBe('50');
      expect(result.repository).toBe('workspace/repo');
      expect(result.buildUrl).toBe('https://bitbucket.org/workspace/repo/pipelines/results/50');
    });

    it('should detect PR in Bitbucket Pipelines', () => {
      const env = {
        BITBUCKET_BUILD_NUMBER: '51',
        BITBUCKET_PR_ID: '44',
      };

      const detector = new CIDetector(env);
      const result = detector.detect();

      expect(result.pr).toBe(44);
      expect(result.event).toBe('pull_request');
    });
  });

  describe('detect - TeamCity', () => {
    it('should detect TeamCity', () => {
      const env = {
        TEAMCITY_VERSION: '2023.11',
        BUILD_VCS_NUMBER: 'teamcity123',
        BRANCH_NAME: 'release/1.0',
        TEAMCITY_BUILDCONF_NAME: 'Build Config',
        BUILD_NUMBER: '300',
        BUILD_URL: 'https://teamcity.example.com/viewLog.html?buildId=300',
      };

      const detector = new CIDetector(env);
      const result = detector.detect();

      expect(result.detected).toBe(true);
      expect(result.provider).toBe('teamcity');
      expect(result.commit).toBe('teamcity123');
      expect(result.branch).toBe('release/1.0');
      expect(result.workflow).toBe('Build Config');
      expect(result.buildNumber).toBe('300');
      expect(result.buildUrl).toBe('https://teamcity.example.com/viewLog.html?buildId=300');
    });
  });

  describe('detect - Generic CI', () => {
    it('should detect generic CI environment', () => {
      const env = {
        CI: 'true',
        GIT_COMMIT: 'generic123',
        GIT_BRANCH: 'feature',
        BUILD_NUMBER: '10',
        BUILD_URL: 'https://ci.example.com/build/10',
      };

      const detector = new CIDetector(env);
      const result = detector.detect();

      expect(result.detected).toBe(true);
      expect(result.provider).toBe('generic');
      expect(result.commit).toBe('generic123');
      expect(result.branch).toBe('feature');
      expect(result.buildNumber).toBe('10');
      expect(result.buildUrl).toBe('https://ci.example.com/build/10');
    });

    it('should use alternative env vars in generic CI', () => {
      const env = {
        CI: 'true',
        COMMIT_SHA: 'alt123',
        BRANCH_NAME: 'alt-branch',
        BUILD_ID: '20',
      };

      const detector = new CIDetector(env);
      const result = detector.detect();

      expect(result.commit).toBe('alt123');
      expect(result.branch).toBe('alt-branch');
      expect(result.buildNumber).toBe('20');
    });

    it('should handle BRANCH env var', () => {
      const env = {
        CI: 'true',
        BRANCH: 'simple-branch',
      };

      const detector = new CIDetector(env);
      const result = detector.detect();

      expect(result.branch).toBe('simple-branch');
    });
  });

  describe('detect - No CI', () => {
    it('should return detected=false when not in CI', () => {
      const detector = new CIDetector({});
      const result = detector.detect();

      expect(result.detected).toBe(false);
      expect(result.provider).toBeNull();
      expect(result.commit).toBeNull();
      expect(result.branch).toBeNull();
      expect(result.pr).toBeNull();
      expect(result.workflow).toBeNull();
      expect(result.buildNumber).toBeNull();
      expect(result.buildUrl).toBeNull();
      expect(result.repository).toBeNull();
      expect(result.actor).toBeNull();
      expect(result.event).toBeNull();
    });
  });

  describe('helper functions', () => {
    describe('createCIDetector', () => {
      it('should create a CIDetector instance', () => {
        const detector = createCIDetector();
        expect(detector).toBeInstanceOf(CIDetector);
      });
    });

    describe('isCI', () => {
      // Note: This uses process.env, so we can't easily test it without mocking
      it('should be a function', () => {
        expect(typeof isCI).toBe('function');
      });
    });

    describe('detectCI', () => {
      // Note: This uses process.env, so we can't easily test it without mocking
      it('should be a function that returns CIMetadata', () => {
        expect(typeof detectCI).toBe('function');
        const result = detectCI();
        expect(result).toHaveProperty('detected');
        expect(result).toHaveProperty('provider');
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty strings as falsy', () => {
      const env = {
        GITHUB_ACTIONS: 'true',
        GITHUB_SHA: '',
        GITHUB_BRANCH: '',
      };

      const detector = new CIDetector(env);
      const result = detector.detect();

      expect(result.commit).toBe('');
    });

    it('should handle undefined values gracefully', () => {
      const env = {
        GITHUB_ACTIONS: 'true',
        GITHUB_SHA: undefined as unknown as string,
      };

      const detector = new CIDetector(env);
      const result = detector.detect();

      // undefined gets coerced to null via ?? null
      expect(result.commit).toBeNull();
    });

    it('should parse invalid PR numbers as null', () => {
      const env = {
        GITHUB_ACTIONS: 'true',
        GITHUB_REF: 'refs/heads/main', // Not a PR ref
        GITHUB_EVENT_NAME: 'pull_request',
      };

      const detector = new CIDetector(env);
      const result = detector.detect();

      expect(result.pr).toBeNull();
    });

    it('should handle non-numeric PR numbers', () => {
      const env = {
        CIRCLECI: 'true',
        CIRCLE_PR_NUMBER: 'not-a-number',
      };

      const detector = new CIDetector(env);
      const result = detector.detect();

      expect(result.pr).toBeNull();
    });

    it('should prioritize specific CI providers over generic CI', () => {
      const env = {
        CI: 'true',
        GITHUB_ACTIONS: 'true',
        GITHUB_SHA: 'abc123',
      };

      const detector = new CIDetector(env);
      const result = detector.detect();

      expect(result.provider).toBe('github-actions');
    });
  });
});
