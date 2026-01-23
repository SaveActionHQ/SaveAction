# JSON Output Format Documentation

## Overview

The `run` command supports JSON output for programmatic integration with CI/CD pipelines, custom dashboards, and scripting workflows. This feature allows you to:

- Capture test results in a structured, machine-readable format
- Save results to files for later analysis
- Pipe output to other tools (e.g., `jq`, custom scripts)
- Aggregate results from multiple test runs
- Integrate with notification systems (Slack, email, etc.)

## Usage

```bash
# Output results as JSON to console (stdout)
saveaction run test.json --output json

# Save results to a file (console output still shown)
saveaction run test.json --output-file ./reports/result.json

# Both: JSON to console AND save to file
saveaction run test.json --output json --output-file ./reports/result.json

# Combine with other options
saveaction run test.json --output json --browser firefox --headless true
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--output <format>` | string | `console` | Output format: `console` or `json` |
| `--output-file <path>` | string | - | Save results to JSON file at specified path |

## JSON Output Structure

### Successful Run

```json
{
  "version": "1.0",
  "status": "passed",
  "recording": {
    "file": "login-test.json",
    "testName": "Login Flow Test",
    "url": "https://example.com/login",
    "actionsTotal": 13
  },
  "execution": {
    "browser": "chromium",
    "headless": true,
    "timingEnabled": true,
    "timingMode": "realistic",
    "timeout": 30000
  },
  "result": {
    "duration": 12500,
    "actionsExecuted": 13,
    "actionsPassed": 13,
    "actionsFailed": 0,
    "errors": [],
    "video": null
  },
  "timestamps": {
    "startedAt": "2026-01-23T10:00:00.000Z",
    "completedAt": "2026-01-23T10:00:12.500Z"
  }
}
```

### Failed Run

```json
{
  "version": "1.0",
  "status": "failed",
  "recording": {
    "file": "checkout-test.json",
    "testName": "Checkout Flow",
    "url": "https://example.com/cart",
    "actionsTotal": 25
  },
  "execution": {
    "browser": "chromium",
    "headless": true,
    "timingEnabled": true,
    "timingMode": "realistic",
    "timeout": 30000
  },
  "result": {
    "duration": 8500,
    "actionsExecuted": 15,
    "actionsPassed": 14,
    "actionsFailed": 1,
    "errors": [
      {
        "actionId": "act_015",
        "actionType": "click",
        "error": "Element not found: [data-testid=\"checkout-button\"]"
      }
    ],
    "video": "./videos/checkout-test.webm"
  },
  "timestamps": {
    "startedAt": "2026-01-23T10:05:00.000Z",
    "completedAt": "2026-01-23T10:05:08.500Z"
  }
}
```

### Error Output (Invalid Recording)

When the recording file cannot be parsed or is invalid:

```json
{
  "version": "1.0",
  "status": "failed",
  "error": "File not found: missing-test.json",
  "timestamps": {
    "startedAt": "2026-01-23T10:10:00.000Z",
    "completedAt": "2026-01-23T10:10:00.050Z"
  }
}
```

## Field Reference

### Top-Level Fields

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | JSON output schema version (currently "1.0") |
| `status` | string | `"passed"` or `"failed"` |
| `error` | string | Error message (only present when recording fails to load) |
| `recording` | object | Recording metadata |
| `execution` | object | Execution configuration used |
| `result` | object | Execution results and statistics |
| `timestamps` | object | ISO 8601 timestamps |

### Recording Object

| Field | Type | Description |
|-------|------|-------------|
| `file` | string | Recording filename (basename only) |
| `testName` | string | Test name from recording |
| `url` | string | Starting URL |
| `actionsTotal` | number | Total actions in recording |

### Execution Object

| Field | Type | Description |
|-------|------|-------------|
| `browser` | string | Browser used: `chromium`, `firefox`, or `webkit` |
| `headless` | boolean | Whether browser ran in headless mode |
| `timingEnabled` | boolean | Whether timing delays were used |
| `timingMode` | string | Timing mode: `realistic`, `fast`, or `instant` |
| `timeout` | number | Action timeout in milliseconds |

### Result Object

| Field | Type | Description |
|-------|------|-------------|
| `duration` | number | Total execution time in milliseconds |
| `actionsExecuted` | number | Number of actions attempted |
| `actionsPassed` | number | Number of successful actions |
| `actionsFailed` | number | Number of failed actions |
| `errors` | array | Array of error objects (see below) |
| `video` | string\|null | Path to recorded video (if `--video` was used) |

### Error Object

| Field | Type | Description |
|-------|------|-------------|
| `actionId` | string | ID of the failed action (e.g., `act_015`) |
| `actionType` | string | Type of action: `click`, `input`, `navigation`, etc. |
| `error` | string | Error message |

### Timestamps Object

| Field | Type | Description |
|-------|------|-------------|
| `startedAt` | string | ISO 8601 timestamp when run started |
| `completedAt` | string | ISO 8601 timestamp when run finished |

## Exit Codes

Exit codes work the same regardless of output format:

| Code | Meaning |
|------|---------|
| `0` | Test passed (all actions succeeded) |
| `1` | Test failed (one or more actions failed, or error occurred) |

## Integration Examples

### Check Test Status in Bash

```bash
#!/bin/bash
RESULT=$(saveaction run test.json --output json)
STATUS=$(echo "$RESULT" | jq -r '.status')

if [ "$STATUS" = "passed" ]; then
  echo "✅ Test passed!"
else
  echo "❌ Test failed!"
  echo "$RESULT" | jq '.result.errors'
fi
```

### Send Slack Notification

```bash
#!/bin/bash
saveaction run test.json --output json --output-file result.json

STATUS=$(jq -r '.status' result.json)
DURATION=$(jq -r '.result.duration' result.json)
TEST_NAME=$(jq -r '.recording.testName' result.json)

if [ "$STATUS" = "failed" ]; then
  curl -X POST -H 'Content-type: application/json' \
    --data "{\"text\":\"❌ Test '$TEST_NAME' failed after ${DURATION}ms\"}" \
    $SLACK_WEBHOOK_URL
fi
```

### Aggregate Multiple Test Results

```bash
#!/bin/bash
# Run multiple tests and collect results
for test in tests/*.json; do
  saveaction run "$test" --output json >> all-results.jsonl
done

# Count passed/failed
PASSED=$(grep '"status":"passed"' all-results.jsonl | wc -l)
FAILED=$(grep '"status":"failed"' all-results.jsonl | wc -l)

echo "Results: $PASSED passed, $FAILED failed"
```

### GitHub Actions Integration

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install SaveAction CLI
        run: npm install -g @saveaction/cli
      
      - name: Run E2E tests
        run: |
          mkdir -p reports
          saveaction run tests/login.json \
            --output json \
            --output-file reports/login-result.json \
            --video reports/
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: reports/
```

### Node.js Script

```javascript
import { execSync } from 'child_process';

function runTest(testFile) {
  try {
    const output = execSync(
      `saveaction run ${testFile} --output json`,
      { encoding: 'utf-8' }
    );
    return JSON.parse(output);
  } catch (error) {
    // Command failed, but we still have JSON output
    return JSON.parse(error.stdout);
  }
}

const result = runTest('tests/login.json');

console.log(`Status: ${result.status}`);
console.log(`Duration: ${result.result.duration}ms`);
console.log(`Actions: ${result.result.actionsPassed}/${result.recording.actionsTotal}`);

if (result.status === 'failed') {
  console.log('Errors:');
  result.result.errors.forEach(err => {
    console.log(`  - ${err.actionType} (${err.actionId}): ${err.error}`);
  });
}
```

## Notes

- When using `--output json`, console output is suppressed (no progress indicators, no colored text)
- When using only `--output-file`, console output is shown normally, and JSON is saved to the file
- The output directory for `--output-file` is created automatically if it doesn't exist
- JSON output is always pretty-printed with 2-space indentation
- Duration values are in milliseconds
- Timestamps are in ISO 8601 format (UTC)
