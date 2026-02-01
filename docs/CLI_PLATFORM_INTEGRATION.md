# CLI Platform Integration

This document describes how to use the SaveAction CLI to fetch and run recordings from the SaveAction Platform API, enabling CI/CD pipeline integration.

## Overview

The CLI can now fetch recordings directly from the SaveAction Platform instead of requiring local JSON files. This enables:

- **CI/CD Integration**: Run tests in pipelines without storing recordings in the repository
- **Centralized Test Management**: Store and manage recordings in the platform
- **Tag-Based Execution**: Run all tests matching specific tags (e.g., smoke tests)
- **Environment Flexibility**: Override base URLs for different environments (staging, production)

## Authentication

### Options

1. **Command-line flags** (suitable for CI/CD):
   ```bash
   saveaction run --api-url https://api.saveaction.io --api-token <token> --recording-id <id>
   ```

2. **Environment variables** (recommended for CI/CD):
   ```bash
   export SAVEACTION_API_URL=https://api.saveaction.io
   export SAVEACTION_API_TOKEN=your-api-token
   saveaction run --recording-id <id>
   ```

### Getting an API Token

1. Login to the platform API:
   ```bash
   curl -X POST https://api.saveaction.io/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "your@email.com", "password": "your-password"}'
   ```

2. Use the `accessToken` from the response (valid for 15 minutes)

3. For long-lived tokens, create an API token via the platform (recommended for CI/CD)

## New CLI Options

### Platform Connection

| Option | Environment Variable | Description |
|--------|---------------------|-------------|
| `--api-url <url>` | `SAVEACTION_API_URL` | SaveAction Platform API URL |
| `--api-token <token>` | `SAVEACTION_API_TOKEN` | API authentication token |

### Recording Selection

| Option | Description |
|--------|-------------|
| `--recording-id <id>` | Run a specific recording by ID |
| `--tag <tag>` | Run all recordings matching a tag |

### URL Override

| Option | Description |
|--------|-------------|
| `--base-url <url>` | Override the base URL for all actions |

## Usage Examples

### Run a Single Recording by ID

```bash
# Using command-line options
saveaction run --recording-id rec_abc123 \
  --api-url https://api.saveaction.io \
  --api-token $API_TOKEN

# Using environment variables
export SAVEACTION_API_URL=https://api.saveaction.io
export SAVEACTION_API_TOKEN=$API_TOKEN
saveaction run --recording-id rec_abc123
```

### Run All Recordings with a Tag

```bash
# Run all smoke tests
saveaction run --tag smoke --api-url https://api.saveaction.io --api-token $TOKEN

# Run all login tests
saveaction run --tag login --api-url https://api.saveaction.io --api-token $TOKEN
```

### Override Base URL for Different Environments

```bash
# Recording was created on production, run against staging
saveaction run --recording-id rec_abc123 \
  --api-url https://api.saveaction.io \
  --api-token $TOKEN \
  --base-url https://staging.myapp.com

# Run smoke tests against local development
saveaction run --tag smoke \
  --api-url https://api.saveaction.io \
  --api-token $TOKEN \
  --base-url http://localhost:3000
```

### JSON Output for CI/CD

```bash
# Single recording with JSON output
saveaction run --recording-id rec_abc123 \
  --api-url https://api.saveaction.io \
  --api-token $TOKEN \
  --output json

# Tag-based execution with JSON output saved to file
saveaction run --tag smoke \
  --api-url https://api.saveaction.io \
  --api-token $TOKEN \
  --output json \
  --output-file results.json
```

## JSON Output Format

### Single Recording Result

```json
{
  "version": "1.0",
  "status": "passed",
  "recording": {
    "file": "",
    "testName": "Login Test",
    "url": "https://app.example.com/login",
    "actionsTotal": 5,
    "source": "platform",
    "recordingId": "rec_abc123"
  },
  "execution": {
    "browser": "chromium",
    "headless": true,
    "timingEnabled": true,
    "timingMode": "realistic",
    "timeout": 30000,
    "baseUrlOverride": "https://staging.example.com"
  },
  "result": {
    "duration": 5234,
    "actionsExecuted": 5,
    "actionsPassed": 5,
    "actionsFailed": 0,
    "errors": []
  },
  "timestamps": {
    "startedAt": "2026-02-01T10:00:00.000Z",
    "completedAt": "2026-02-01T10:00:05.234Z"
  },
  "ci": {
    "detected": true,
    "provider": "github-actions",
    "commit": "a1b2c3d4e5f67890abcdef1234567890abcdef12",
    "branch": "main",
    "pr": "42",
    "workflow": "E2E Tests",
    "buildNumber": "123",
    "repository": "owner/repo"
  }
}
```

> **Note:** The `ci` field is only included when running in a detected CI environment.
```

### Tag-Based Execution Result

```json
{
  "version": "1.0",
  "status": "passed",
  "tag": "smoke",
  "totalRecordings": 3,
  "passed": 3,
  "failed": 0,
  "recordings": [
    {
      "id": "rec_abc123",
      "testName": "Login Test",
      "status": "passed",
      "duration": 5234,
      "actionsExecuted": 5,
      "actionsFailed": 0,
      "errors": []
    },
    {
      "id": "rec_def456",
      "testName": "Dashboard Test",
      "status": "passed",
      "duration": 8123,
      "actionsExecuted": 12,
      "actionsFailed": 0,
      "errors": []
    }
  ],
  "timestamps": {
    "startedAt": "2026-02-01T10:00:00.000Z",
    "completedAt": "2026-02-01T10:00:15.000Z"
  },
  "ci": {
    "detected": true,
    "provider": "gitlab-ci",
    "commit": "abc123def456",
    "branch": "feature/tests",
    "pr": "15",
    "workflow": "E2E Pipeline",
    "buildNumber": "789"
  }
}
```

> **Note:** The `ci` field is only included when running in a detected CI environment.
```

## CI/CD Examples

### GitHub Actions

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install SaveAction CLI
        run: npm install -g @saveaction/cli
      
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
      
      - name: Run smoke tests
        env:
          SAVEACTION_API_URL: ${{ secrets.SAVEACTION_API_URL }}
          SAVEACTION_API_TOKEN: ${{ secrets.SAVEACTION_API_TOKEN }}
        run: |
          saveaction run --tag smoke \
            --base-url ${{ github.event_name == 'pull_request' && 'https://staging.myapp.com' || 'https://myapp.com' }} \
            --output json \
            --output-file results.json
      
      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: results.json
```

### GitLab CI

```yaml
e2e-tests:
  image: mcr.microsoft.com/playwright:v1.40.0
  stage: test
  variables:
    SAVEACTION_API_URL: $SAVEACTION_API_URL
    SAVEACTION_API_TOKEN: $SAVEACTION_API_TOKEN
  script:
    - npm install -g @saveaction/cli
    - saveaction run --tag smoke --base-url $CI_ENVIRONMENT_URL --output json --output-file results.json
  artifacts:
    when: always
    paths:
      - results.json
    reports:
      junit: results.json
```

### Jenkins Pipeline

```groovy
pipeline {
    agent any
    
    environment {
        SAVEACTION_API_URL = credentials('saveaction-api-url')
        SAVEACTION_API_TOKEN = credentials('saveaction-api-token')
    }
    
    stages {
        stage('E2E Tests') {
            steps {
                sh '''
                    npm install -g @saveaction/cli
                    npx playwright install --with-deps chromium
                    saveaction run --tag smoke \
                        --base-url ${STAGING_URL} \
                        --output json \
                        --output-file results.json
                '''
            }
            post {
                always {
                    archiveArtifacts artifacts: 'results.json'
                }
            }
        }
    }
}
```

## Error Handling

### Common Errors

| Error Code | Description | Solution |
|------------|-------------|----------|
| `MISSING_API_URL` | API URL not provided | Set `--api-url` or `SAVEACTION_API_URL` |
| `MISSING_API_TOKEN` | API token not provided | Set `--api-token` or `SAVEACTION_API_TOKEN` |
| `UNAUTHORIZED` | Invalid or expired token | Refresh token or use API token |
| `RECORDING_NOT_FOUND` | Recording ID doesn't exist | Verify recording ID in platform |
| `FORBIDDEN` | No access to recording | Check permissions |
| `NETWORK_ERROR` | Cannot connect to API | Check network/firewall settings |

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | All tests passed |
| `1` | One or more tests failed or error occurred |

## CI Environment Detection

The CLI automatically detects when running in a CI/CD environment and captures relevant metadata for inclusion in JSON output. This helps with:

- **Traceability**: Link test results to specific commits, branches, and PRs
- **Debugging**: Know exactly which CI run produced a result
- **Reporting**: Aggregate results by branch, PR, or workflow

### Supported CI Providers

| Provider | Detection Method |
|----------|-----------------|
| GitHub Actions | `GITHUB_ACTIONS=true` |
| GitLab CI | `GITLAB_CI=true` |
| Jenkins | `JENKINS_URL` set |
| CircleCI | `CIRCLECI=true` |
| Azure Pipelines | `TF_BUILD=True` |
| Travis CI | `TRAVIS=true` |
| Bitbucket Pipelines | `BITBUCKET_BUILD_NUMBER` set |
| TeamCity | `TEAMCITY_VERSION` set |
| Generic CI | `CI=true` (fallback) |

### CI Metadata Captured

When running in CI, the following metadata is captured (when available):

| Field | Description | Example |
|-------|-------------|---------|
| `provider` | CI provider name | `github-actions`, `gitlab-ci` |
| `commit` | Git commit SHA | `a1b2c3d4e5f6...` |
| `branch` | Git branch name | `main`, `feature/login` |
| `pr` | Pull/Merge request number | `123` |
| `workflow` | Workflow/pipeline name | `CI`, `E2E Tests` |
| `buildNumber` | Build/run number | `456` |
| `buildUrl` | Link to build | `https://github.com/.../actions/runs/...` |
| `repository` | Repository name | `owner/repo` |
| `actor` | User who triggered | `username` |
| `event` | Trigger event | `push`, `pull_request` |

### JSON Output with CI Metadata

When running in a CI environment with `--output json`, the CI metadata is automatically included:

```json
{
  "version": "1.0",
  "status": "passed",
  "recording": {
    "file": "test.json",
    "testName": "Login Test",
    "url": "https://app.example.com/login",
    "actionsTotal": 5
  },
  "execution": {
    "browser": "chromium",
    "headless": true,
    "timeout": 30000
  },
  "result": {
    "duration": 5234,
    "actionsExecuted": 5,
    "actionsPassed": 5,
    "actionsFailed": 0,
    "errors": []
  },
  "timestamps": {
    "startedAt": "2026-02-01T10:00:00.000Z",
    "completedAt": "2026-02-01T10:00:05.234Z"
  },
  "ci": {
    "detected": true,
    "provider": "github-actions",
    "commit": "a1b2c3d4e5f67890abcdef1234567890abcdef12",
    "branch": "main",
    "pr": "42",
    "workflow": "E2E Tests",
    "buildNumber": "123",
    "buildUrl": "https://github.com/owner/repo/actions/runs/123",
    "repository": "owner/repo",
    "actor": "developer",
    "event": "push"
  }
}
```

### CI Detection Examples

#### GitHub Actions

The CLI automatically detects GitHub Actions and captures:
- Commit SHA from `GITHUB_SHA`
- Branch from `GITHUB_REF_NAME` or parsed from `GITHUB_HEAD_REF`
- PR number from `GITHUB_REF` (e.g., `refs/pull/42/merge`)
- Workflow name from `GITHUB_WORKFLOW`
- Run number from `GITHUB_RUN_NUMBER`
- Build URL constructed from `GITHUB_SERVER_URL`, `GITHUB_REPOSITORY`, and `GITHUB_RUN_ID`

#### GitLab CI

The CLI automatically detects GitLab CI and captures:
- Commit SHA from `CI_COMMIT_SHA`
- Branch from `CI_COMMIT_BRANCH` or `CI_MERGE_REQUEST_SOURCE_BRANCH_NAME`
- MR number from `CI_MERGE_REQUEST_IID`
- Pipeline name from `CI_PIPELINE_NAME`
- Pipeline ID from `CI_PIPELINE_ID`
- Pipeline URL from `CI_PIPELINE_URL`

### Console Output in CI

When running in CI without JSON output, the CLI displays CI information:

```
📍 CI Environment Detected: github-actions
   Branch: main
   Commit: a1b2c3d
   PR: #42

🎬 Starting test execution...
```

### Disabling CI Detection

CI detection is automatic and cannot be disabled. If you need to test CI behavior locally, you can set the relevant environment variables:

```bash
# Simulate GitHub Actions locally
GITHUB_ACTIONS=true \
GITHUB_SHA=abc123 \
GITHUB_REF_NAME=feature-branch \
saveaction run test.json --output json
```

## Base URL Override Behavior

When `--base-url` is specified:

1. The recording's starting URL origin is replaced with the new base URL
2. All action URLs with the same origin are updated
3. External URLs (different origins) are left unchanged

**Example:**

Original recording URL: `https://production.myapp.com/login`  
Base URL override: `https://staging.myapp.com`

- `https://production.myapp.com/login` → `https://staging.myapp.com/login`
- `https://production.myapp.com/dashboard` → `https://staging.myapp.com/dashboard`
- `https://external-api.com/data` → `https://external-api.com/data` (unchanged)

## Best Practices

1. **Use environment variables in CI/CD** - Avoid exposing tokens in logs
2. **Use tags for test organization** - Group tests by feature, priority, or type
3. **Store results as artifacts** - For debugging failed tests
4. **Use base URL override** - Test against different environments without re-recording
5. **Set appropriate timeouts** - Increase `--timeout` for slow environments
6. **Run headless in CI** - Default behavior, faster execution

## Related Documentation

- [JSON Output Format](./JSON_OUTPUT.md)
- [API Documentation](./API.md)
- [Recording Format](../packages/core/README.md)
