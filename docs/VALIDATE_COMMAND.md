# Validate Command Documentation

## Overview

The `validate` command checks the structure and integrity of SaveAction recording files without executing them. It performs comprehensive validation including file checks, JSON syntax validation, schema compliance, and semantic analysis.

## Usage

```bash
saveaction validate <file> [options]
```

### Arguments

- `<file>` - Path to the recording file (.json)

### Options

- `--verbose` - Show detailed field validation information
- `--json` - Output validation result as JSON

## Features

### 1. File Validation
- ✅ File existence check
- ✅ File extension validation (.json required)
- ✅ File size limits:
  - Warning for files > 10MB
  - Hard limit at 50MB (prevents memory issues)

### 2. JSON Syntax Validation
- ✅ Parse JSON with detailed error messages
- ✅ Handle empty files
- ✅ Handle invalid JSON syntax
- ✅ User-friendly error formatting

### 3. Schema Validation (Zod)
- ✅ Required fields verification:
  - `id` - Recording ID
  - `testName` - Test name
  - `url` - Starting URL
  - `version` - Schema version
  - `actions` - Array of actions
- ✅ Field type checking
- ✅ Format validation

### 4. Semantic Validation
- ✅ Empty actions array detection
- ✅ Large recording warnings (>500 actions)
- ✅ Schema version compatibility check
- ✅ Action ID uniqueness (optional)
- ✅ URL format validation
- ✅ Timestamp ordering (optional)

## Exit Codes

- `0` - Recording is valid
- `1` - Validation failed (errors found)

## Output Formats

### Console Output (Default)

**Success:**
```
✅ Recording is valid!

📄 File Information:
  File: test.json
  Size: 34.01 KB

📝 Recording Details:
  Test Name: My Test
  Recording ID: rec_1234567890
  Actions: 16
  Start URL: https://example.com/
  Version: 1.0.0
```

**With Warnings:**
```
✅ Recording is valid!

📄 File Information:
  File: large-test.json
  Size: 12.50 MB

📝 Recording Details:
  Test Name: Large Test
  Recording ID: rec_1234567890
  Actions: 750
  Start URL: https://example.com/
  Version: 1.0.0

⚠️  Warnings:
  ⚠️  Warning: Large file size (12.50 MB) may impact performance
  ⚠️  Warning: Large recording (750 actions) may be slow to execute
```

**Error:**
```
❌ Validation failed for test.json

Errors found:
  • id: Required
  • testName: Expected string, received number
```

### Verbose Output

Add `--verbose` flag to see all validated fields:

```bash
saveaction validate test.json --verbose
```

```
✅ Recording is valid!

📄 File Information:
  File: test.json
  Size: 34.01 KB

📝 Recording Details:
  Test Name: My Test
  Recording ID: rec_1234567890
  Actions: 16
  Start URL: https://example.com/
  Version: 1.0.0

✓ Validated Fields:
  ✓ id: rec_1234567890
  ✓ testName: My Test
  ✓ url: https://example.com/
  ✓ startTime: 2025-01-14T17:55:12.498Z
  ✓ viewport: 1850x924
  ✓ userAgent: Mozilla/5.0...
  ✓ actions: 16 actions
  ✓ version: 1.0.0
  ✓ endTime: 2025-01-14T17:55:36.625Z
  ✓ devicePixelRatio: 1
```

### JSON Output

Add `--json` flag for machine-readable output:

```bash
saveaction validate test.json --json
```

**Success:**
```json
{
  "valid": true,
  "file": "test.json",
  "fileSize": 34822,
  "recording": {
    "testName": "My Test",
    "id": "rec_1234567890",
    "url": "https://example.com/",
    "version": "1.0.0",
    "actionCount": 16
  }
}
```

**With Warnings:**
```json
{
  "valid": true,
  "file": "large-test.json",
  "fileSize": 13107200,
  "warnings": [
    "⚠️  Warning: Large file size (12.50 MB) may impact performance",
    "⚠️  Warning: Large recording (750 actions) may be slow to execute"
  ],
  "recording": {
    "testName": "Large Test",
    "id": "rec_1234567890",
    "url": "https://example.com/",
    "version": "1.0.0",
    "actionCount": 750
  }
}
```

**Error:**
```json
{
  "valid": false,
  "file": "test.json",
  "fileSize": 1234,
  "errors": [
    "id: Required",
    "testName: Expected string, received number"
  ]
}
```

## Examples

### Example 1: Validate Before Running

```bash
# Check if recording is valid before running
saveaction validate recording.json && saveaction run recording.json
```

### Example 2: Batch Validation

```bash
# Validate all recordings in a directory
for file in recordings/*.json; do
  echo "Validating $file..."
  saveaction validate "$file" || echo "❌ Failed: $file"
done
```

### Example 3: CI/CD Integration

```bash
# In your CI pipeline
saveaction validate tests/*.json --json > validation-results.json
if [ $? -eq 0 ]; then
  echo "All recordings valid"
else
  echo "Validation failed - check validation-results.json"
  exit 1
fi
```

### Example 4: Programmatic Validation

```javascript
// Node.js script using JSON output
const { execSync } = require('child_process');

try {
  const result = execSync('saveaction validate recording.json --json', {
    encoding: 'utf-8'
  });
  const validation = JSON.parse(result);
  
  if (validation.valid) {
    console.log(`✅ ${validation.file} is valid`);
    console.log(`Actions: ${validation.recording.actionCount}`);
  }
} catch (error) {
  const validation = JSON.parse(error.stdout);
  console.error(`❌ Validation failed: ${validation.errors.join(', ')}`);
  process.exit(1);
}
```

## Error Types

### File Errors
- **File not found**: `❌ Error: File not found: path/to/file.json`
- **Invalid extension**: `❌ Error: Invalid file type. Expected .json, got .txt`
- **File too large**: `❌ Error: File too large (52.50 MB). Maximum supported size: 50MB`

### JSON Errors
- **Invalid syntax**: `Invalid JSON syntax: Unexpected token 'x' at position 10`
- **Empty file**: `Invalid JSON syntax: Unexpected end of JSON input`

### Schema Errors
- **Missing field**: `id: Required`
- **Wrong type**: `testName: Expected string, received number`
- **Invalid format**: `url: Invalid URL format`

### Semantic Warnings
- **Empty actions**: `⚠️  Warning: Recording has no actions`
- **Large file**: `⚠️  Warning: Large file size (12.50 MB) may impact performance`
- **Many actions**: `⚠️  Warning: Large recording (750 actions) may be slow to execute`

## Technical Details

### Implementation
- **Package**: `@saveaction/cli`
- **File**: `packages/cli/src/commands/validate.ts`
- **Test Coverage**: 89.35% (25 unit tests)
- **Dependencies**:
  - `@saveaction/core` - RecordingParser with Zod validation
  - `zod` - Schema validation library

### Performance
- File size limit: 50MB (hard limit)
- Performance warning: 10MB (soft limit)
- Action count warning: 500 actions
- Validation time: ~50ms for typical recordings (16 actions, 34KB)

### Cross-Platform Support
- ✅ Windows
- ✅ Linux
- ✅ macOS
- Path resolution handled automatically
- Cross-platform basename extraction (fixes Issue #13)

## Related Commands

- [`run`](./RUN_COMMAND.md) - Execute a recording
- [`info`](./INFO_COMMAND.md) - Display recording metadata and statistics

## Troubleshooting

### Issue: "Cannot find module 'zod'"
**Solution**: Run `pnpm install` in the workspace root

### Issue: Path errors on Windows
**Solution**: Use forward slashes or let the command resolve paths automatically

### Issue: Large file warnings
**Solution**: 
- Files > 10MB may impact performance
- Files > 50MB will be rejected
- Consider splitting large recordings into smaller tests

### Issue: Schema version mismatch
**Solution**: Update recordings to match current schema version (1.0.0)

## Changelog

### v0.2.0 (2026-01-20)
- ✅ Initial implementation
- ✅ File validation (existence, extension, size)
- ✅ JSON syntax validation
- ✅ Zod schema validation
- ✅ Semantic validation (warnings)
- ✅ Console output with emojis
- ✅ JSON output format
- ✅ Verbose mode
- ✅ Cross-platform support
- ✅ Exit codes
- ✅ User-friendly error messages
- ✅ 89.35% test coverage

## See Also

- [SaveAction Documentation](../README.md)
- [CLI Commands](../README.md#-cli-commands)
- [Recording Format](./RECORDING_FORMAT.md)
- [Issue #11](https://github.com/SaveActionHQ/SaveAction/issues/11) - Original feature request
