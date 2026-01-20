import { RecordingParser } from '@saveaction/core';
import type { Recording } from '@saveaction/core';
import { z } from 'zod';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

interface ValidateOptions {
  verbose?: boolean;
  json?: boolean;
}

/**
 * Validate recording file structure without running it
 * Checks: JSON syntax, schema compliance, field types, required fields
 */
export async function validate(file: string, options: ValidateOptions = {}): Promise<void> {
  const verbose = options.verbose || false;
  const jsonOutput = options.json || false;

  // Step 1: Resolve absolute path
  const filePath = path.resolve(file);

  // Step 2: File existence validation
  if (!existsSync(filePath)) {
    const error = `File not found: ${filePath}`;
    if (jsonOutput) {
      outputJSON({ valid: false, file: getBasename(filePath), fileSize: 0, errors: [error] });
    } else {
      console.error(`❌ Error: ${error}`);
    }
    process.exit(1);
    return;
  }

  // Step 3: File extension validation
  const ext = getFileExtension(filePath);
  if (ext !== '.json') {
    const error = `Invalid file type. Expected .json, got ${ext}`;
    if (jsonOutput) {
      outputJSON({ valid: false, file: getBasename(filePath), fileSize: 0, errors: [error] });
    } else {
      console.error(`❌ Error: ${error}`);
    }
    process.exit(1);
    return;
  }

  // Step 4: Get file size and check hard limit
  const stats = statSync(filePath);
  const fileSize = stats.size;

  // Hard limit: 50MB to prevent memory issues
  const HARD_LIMIT = 50 * 1024 * 1024; // 50MB
  if (fileSize > HARD_LIMIT) {
    const error = `File too large (${formatFileSize(fileSize)}). Maximum supported size: 50MB`;
    if (jsonOutput) {
      outputJSON({ valid: false, file: getBasename(filePath), fileSize, errors: [error] });
    } else {
      console.error(`❌ Error: ${error}`);
    }
    process.exit(1);
    return;
  }

  // Step 4: Parse and validate with RecordingParser
  const parser = new RecordingParser();
  let recording: Recording;

  try {
    recording = await parser.parseFile(filePath);
  } catch (error) {
    // Handle parsing/validation errors
    const errors = extractErrors(error);
    if (jsonOutput) {
      outputJSON({ valid: false, file: getBasename(filePath), fileSize, errors });
    } else {
      displayErrors(errors, filePath);
    }
    process.exit(1);
    return; // Explicit return for testing (when process.exit is mocked)
  }

  // Step 5: Perform semantic validation
  const warnings = performSemanticValidation(recording, fileSize);

  // Step 6: Output results
  if (jsonOutput) {
    outputJSON({
      valid: true,
      file: getBasename(filePath),
      fileSize,
      warnings: warnings.length > 0 ? warnings : undefined,
      recording: {
        testName: recording.testName,
        recordingId: recording.id,
        startURL: recording.url,
        schemaVersion: recording.version,
        actionCount: recording.actions.length,
        viewport: recording.viewport,
      },
    });
  } else {
    displaySuccess(recording, filePath, fileSize, verbose, warnings);
  }

  // Exit with success
  process.exit(0);
}

/**
 * Get cross-platform basename from file path
 * Avoids issue #13 bug where path.basename() fails on cross-platform paths
 */
function getBasename(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath;
}

/**
 * Get file extension using cross-platform approach
 */
function getFileExtension(filePath: string): string {
  const basename = getBasename(filePath);
  const dotIndex = basename.lastIndexOf('.');
  return dotIndex === -1 ? '' : basename.substring(dotIndex);
}

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Extract error messages from various error types
 */
function extractErrors(error: unknown): string[] {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => {
      const path = issue.path.join('.');
      return `${path || 'root'}: ${issue.message}`;
    });
  }
  if (error instanceof SyntaxError) {
    // JSON parsing error - extract position info if available
    const posMatch = error.message.match(/position (\d+)/);
    if (posMatch) {
      const position = parseInt(posMatch[1], 10);
      return [`JSON syntax error at position ${position}: ${error.message}`];
    }
    return [`JSON syntax error: ${error.message}`];
  }
  if (error instanceof Error) {
    return [error.message];
  }
  return [String(error)];
}

/**
 * Display validation errors in user-friendly format
 */
function displayErrors(errors: string[], filePath: string): void {
  console.error(`\n❌ Validation failed for: ${getBasename(filePath)}\n`);
  console.error('Errors found:\n');
  errors.forEach((error) => {
    console.error(`  ❌ ${error}`);
  });
  console.error('');
}

/**
 * Validation result structure for JSON output
 */
interface ValidationResult {
  valid: boolean;
  file: string;
  fileSize: number;
  errors?: string[];
  warnings?: string[];
  recording?: {
    testName: string;
    recordingId: string;
    startURL: string;
    schemaVersion: string;
    actionCount: number;
    viewport: { width: number; height: number };
  };
}

/**
 * Output validation result as JSON
 */
function outputJSON(result: ValidationResult): void {
  console.log(JSON.stringify(result, null, 2));
}

/**
 * Display successful validation result
 */
function displaySuccess(
  recording: Recording,
  filePath: string,
  fileSize: number,
  verbose: boolean,
  warnings: string[]
): void {
  console.log('\n✅ Recording is valid!\n');
  console.log('📄 File Information:');
  console.log(`  File:         ${getBasename(filePath)}`);
  console.log(`  Size:         ${formatFileSize(fileSize)}`);
  console.log('');
  console.log('📝 Recording Details:');
  console.log(`  Test Name:    ${recording.testName}`);
  console.log(`  Recording ID: ${recording.id}`);
  console.log(`  Start URL:    ${recording.url}`);
  console.log(`  Schema:       v${recording.version}`);
  console.log(`  Actions:      ${recording.actions.length}`);
  console.log(`  Viewport:     ${recording.viewport.width}x${recording.viewport.height}`);

  if (verbose) {
    console.log('');
    console.log('✓ Validated Fields:');
    console.log('  • id (string)');
    console.log('  • testName (string)');
    console.log('  • url (valid URL)');
    console.log('  • version (string)');
    console.log('  • startTime (ISO 8601)');
    console.log('  • endTime (ISO 8601, optional)');
    console.log('  • viewport.width (number)');
    console.log('  • viewport.height (number)');
    console.log('  • userAgent (string)');
    console.log('  • actions (array)');
  }

  if (warnings.length > 0) {
    console.log('');
    console.log('Warnings:');
    warnings.forEach((warning) => {
      console.log(`  ${warning}`);
    });
  }

  console.log('');
}

/**
 * Perform additional semantic validation beyond schema
 */
function performSemanticValidation(recording: Recording, fileSize: number): string[] {
  const warnings: string[] = [];

  // Check 1: Large file size (> 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (fileSize > maxSize) {
    warnings.push(
      `⚠️  Warning: Large file size (${formatFileSize(fileSize)}) may impact performance`
    );
  }

  // Check 2: Empty actions array (valid but suspicious)
  if (recording.actions.length === 0) {
    warnings.push('⚠️  Warning: Recording has no actions');
  }

  // Check 3: Very large action count (performance warning)
  if (recording.actions.length > 500) {
    warnings.push(
      `⚠️  Warning: Large recording (${recording.actions.length} actions) may be slow to execute`
    );
  }

  // Check 4: Schema version compatibility
  if (recording.version !== '1.0.0' && recording.version !== '1.0') {
    warnings.push(
      `⚠️  Warning: Schema version ${recording.version} may not be fully supported (current: v1.0.0)`
    );
  }

  // Check 5: Missing optional but recommended fields
  if (!recording.endTime) {
    warnings.push('ℹ️  Info: endTime is missing (recording may have been interrupted)');
  }

  // Check 6: Viewport dimensions (common screen sizes)
  const { width, height } = recording.viewport;
  if (width < 320 || height < 240) {
    warnings.push(`⚠️  Warning: Unusual viewport dimensions (${width}x${height})`);
  }

  // Check 7: Check for duplicate action IDs
  const actionIds = recording.actions.map((a) => a.id);
  const duplicates = actionIds.filter((id, index) => actionIds.indexOf(id) !== index);
  if (duplicates.length > 0) {
    warnings.push(`❌ Error: Duplicate action IDs found: ${duplicates.join(', ')}`);
  }

  // Check 8: Check action timestamp ordering
  for (let i = 1; i < recording.actions.length; i++) {
    if (recording.actions[i].timestamp < recording.actions[i - 1].timestamp) {
      warnings.push(
        `⚠️  Warning: Action timestamps not in chronological order (${recording.actions[i - 1].id} → ${recording.actions[i].id})`
      );
      break; // Only warn once
    }
  }

  return warnings;
}
