# Info Command Documentation

## Overview

The `info` command analyzes recording files without executing them, providing detailed insights about test structure, timing, and navigation patterns. This is useful for:

- Quick inspection of recording contents
- Understanding test complexity before execution
- Debugging recording structure issues
- Generating test reports for documentation
- CI/CD pipeline metadata extraction

## Usage

```bash
# Console output (default)
saveaction info <file.json>

# JSON output
saveaction info <file.json> --json
saveaction info <file.json> --format json

# Display help
saveaction info --help
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--json` | boolean | `false` | Output analysis as JSON instead of formatted console |
| `--format <type>` | string | `console` | Output format: `console` or `json` |
| `-h, --help` | - | - | Display help for command |

## Output Formats

### Console Output

The console format provides a human-readable, formatted view with emoji indicators and progress bars:

```
📊 Recording Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📁 File
  Name:         test_recording.json

📝 Metadata
  Test Name:    Login Flow Test
  Recording ID: rec_1768467712498
  Start URL:    https://example.com/login
  Recorded:     1/15/2026, 11:01:52 AM
  Completed:    1/15/2026, 11:02:08 AM
  Schema:       v1.0.0
  User Agent:   Chrome 120.0

📱 Viewport
  Category:     Desktop
  Dimensions:   1536x695

📊 Actions
  Total:        16

  By Type:
    click          7 █████████████░░░░░░░░░░░░░░░░░ 43.8%
    input          7 █████████████░░░░░░░░░░░░░░░░░ 43.8%
    submit         1 ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 6.3%
    navigation     1 ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 6.3%

  By Page:
    https://example.com/login                          14
    https://example.com/dashboard                       2

⏱️  Timing
  Recording:    16.32s
  Action Span:  15.53s

  Gaps Between Actions:
    Min:        0ms
    Max:        3.22s
    Average:    1.04s
    Median:     1.09s

🗺️  Navigation
  Flow Type:    MPA
  Unique Pages: 2
  Transitions:  1
```

#### Console Output Features

- **Emoji Indicators**: Visual section markers for quick scanning
- **Progress Bars**: 30-character visual representation of percentages
- **Smart Truncation**: URLs truncated to 50 characters with ellipsis
- **Duration Formatting**: Human-readable format (ms/s/m)
- **User Agent Parsing**: Extracts browser name and version
- **Viewport Categorization**: Mobile (≤768px), Tablet (≤1024px), Desktop (>1024px)

### JSON Output

The JSON format provides machine-readable output for CI/CD pipelines and automation:

```json
{
  "version": "1.0",
  "file": "test_recording.json",
  "metadata": {
    "testName": "Login Flow Test",
    "recordingId": "rec_1768467712498",
    "startURL": "https://example.com/login",
    "recordedAt": "2026-01-15T09:01:52.498Z",
    "completedAt": "2026-01-15T09:02:08.818Z",
    "schemaVersion": "1.0.0",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
  },
  "viewport": {
    "category": "Desktop",
    "width": 1536,
    "height": 695
  },
  "statistics": {
    "total": 16,
    "byType": {
      "click": 7,
      "input": 7,
      "submit": 1,
      "navigation": 1
    },
    "byPage": {
      "https://example.com/login": 14,
      "https://example.com/dashboard": 2
    },
    "percentages": {
      "click": 43.75,
      "input": 43.75,
      "submit": 6.25,
      "navigation": 6.25
    }
  },
  "timing": {
    "recordingDuration": 16320,
    "actionSpan": 15526,
    "gaps": {
      "min": 0,
      "max": 3219,
      "avg": 1035.0666666666666,
      "median": 1089
    }
  },
  "navigation": {
    "uniquePages": 2,
    "transitions": 1,
    "flowType": "MPA"
  }
}
```

#### JSON Output Fields

**Version (`version`)**
- Schema version of the output format (currently `"1.0"`)
- Always the first field for backward compatibility

**File (`file`)**
- Basename of the recording file
- Cross-platform compatible (uses `path.basename()`)

**Metadata (`metadata`)**
- `testName`: User-provided test name from recording
- `recordingId`: Unique recording identifier
- `startURL`: Initial URL when recording started
- `recordedAt`: ISO 8601 timestamp of recording start
- `completedAt`: ISO 8601 timestamp of recording end
- `schemaVersion`: Recording schema version
- `userAgent`: Full browser user agent string

**Viewport (`viewport`)** (optional)
- `category`: "Mobile", "Tablet", "Desktop", or "Unknown"
- `width`: Viewport width in pixels
- `height`: Viewport height in pixels

**Statistics (`statistics`)**
- `total`: Total number of actions
- `byType`: Action counts grouped by type (click, input, etc.)
- `byPage`: Action counts grouped by normalized URL
- `percentages`: Percentage breakdown by action type

**Timing (`timing`)**
- `recordingDuration`: Total time from start to end (milliseconds)
- `actionSpan`: Time from first to last action (milliseconds)
- `gaps`: Statistics about delays between consecutive actions
  - `min`: Shortest gap (milliseconds)
  - `max`: Longest gap (milliseconds)
  - `avg`: Average gap (milliseconds)
  - `median`: Median gap (milliseconds)

**Navigation (`navigation`)**
- `uniquePages`: Number of distinct pages visited
- `transitions`: Number of page navigations (uniquePages - 1)
- `flowType`: "SPA" (single page), "MPA" (multi-page), or "N/A" (no actions)

## Analysis Features

### URL Normalization

URLs are normalized for grouping and comparison:
- Removes trailing slashes (except root `/`)
- Removes hash fragments (`#section`)
- Preserves query parameters (`?key=value`)
- Handles invalid URLs gracefully

**Examples:**
```
https://example.com/page/   → https://example.com/page
https://example.com/page#top → https://example.com/page
https://example.com/?q=test  → https://example.com/?q=test
```

### Viewport Categories

Automatic categorization based on width:
- **Mobile**: width ≤ 768px (e.g., 375x667 - iPhone)
- **Tablet**: 768px < width ≤ 1024px (e.g., 768x1024 - iPad)
- **Desktop**: width > 1024px (e.g., 1920x1080)
- **Unknown**: Missing viewport data

### Flow Type Detection

Automatically detects test navigation pattern:
- **SPA**: Single Page Application (1 unique page, JavaScript routing)
- **MPA**: Multi-Page Application (2+ pages, traditional navigation)
- **N/A**: No actions recorded

### Timing Analysis

Provides insights into test pacing and delays:
- **Recording Duration**: Total time including setup/teardown
- **Action Span**: Pure test execution time (first to last action)
- **Gap Statistics**: Identifies longest waits and average pacing
- **Median vs Average**: Median is more robust to outliers (e.g., long page loads)

## Implementation Details

### Core Components

**RecordingAnalyzer** (`@saveaction/core`)
- Pure analysis logic, no I/O operations
- Cross-platform file path handling
- 99.14% test coverage
- Handles edge cases: invalid timestamps, missing fields, Unicode URLs

**info Command** (`@saveaction/cli`)
- File validation (existence, `.json` extension)
- Dual output formatters (console and JSON)
- Helper functions for formatting, truncation, progress bars
- Error handling with clear user messages

### Performance

**Benchmarks:**
- 50 actions: <100ms
- 500 actions: <500ms
- 1000 actions: 114ms (actual)
- 5000 actions: <2s (estimated)

**Memory:**
- Peak usage: <50MB for 1000 actions
- No memory leaks or excessive GC

**Test Coverage:**
- RecordingAnalyzer: 99.14% (55 tests)
- info command: 80%+ (21 tests)
- Total: 157 tests passing

## Examples

### Quick Inspection

```bash
# View recording summary
saveaction info recording.json
```

### CI/CD Pipeline

```bash
# Extract test metadata as JSON
saveaction info recording.json --json > metadata.json

# Parse in CI script
node -e "
  const analysis = JSON.parse(fs.readFileSync('metadata.json', 'utf8'));
  console.log(\`Test: \${analysis.metadata.testName}\`);
  console.log(\`Actions: \${analysis.statistics.total}\`);
  console.log(\`Duration: \${analysis.timing.recordingDuration}ms\`);
"
```

### Batch Analysis

```bash
# Analyze all recordings in directory
for file in recordings/*.json; do
  echo "=== $file ==="
  saveaction info "$file" --json | jq '.statistics.total'
done
```

### Documentation Generation

```bash
# Generate test inventory
saveaction info test1.json --json > report.json
saveaction info test2.json --json >> report.json
```

## Error Handling

**File Not Found:**
```bash
$ saveaction info fake.json
❌ Error: File not found: fake.json
```

**Invalid Extension:**
```bash
$ saveaction info README.md
❌ Error: File must have .json extension
```

**Invalid JSON:**
```bash
$ saveaction info corrupt.json
❌ Error: Failed to parse recording: Unexpected token...
```

**Missing Required Fields:**
```bash
$ saveaction info invalid.json
❌ Error: Invalid recording format: Missing field "testName"
```

## Version Compatibility

**Schema Version Warning:**

If the recording uses a different schema version, a warning is displayed:

```
⚠️  Recording uses schema v1.0.0 (current: v1.0)
Some fields may not be available.
```

This is informational only and does not prevent analysis.

## Related Commands

- [`saveaction run`](./RUN_COMMAND.md): Execute recordings
- [`saveaction validate`](./VALIDATE_COMMAND.md): Validate recording structure (planned)
- [`saveaction list`](./LIST_COMMAND.md): List recordings in directory (planned)

## API Reference

See TypeScript interfaces in `@saveaction/core/types/analyzer.ts`:

- `RecordingAnalysis`: Complete analysis result
- `RecordingMetadata`: Recording metadata fields
- `ViewportInfo`: Viewport data and category
- `ActionStatistics`: Action counts and percentages
- `TimingAnalysis`: Timing and gap statistics
- `NavigationInsights`: Navigation pattern analysis

## Changelog

**v0.1.0** (January 2026)
- Initial implementation
- Console and JSON output formats
- RecordingAnalyzer with 99.14% coverage
- 76 new tests (55 core + 21 CLI)
- Cross-platform file path support
- Viewport categorization
- Timing analysis with median calculation
- Navigation flow detection
