import { RecordingParser } from '@saveaction/core';
import { promises as fs } from 'node:fs';
import path from 'node:path';

interface ListOptions {
  json?: boolean;
}

interface RecordingSummary {
  file: string;
  testName: string;
  url: string;
  actionCount: number;
}

interface ListResult {
  directory: string;
  count: number;
  recordings: RecordingSummary[];
  errors?: Array<{ file: string; error: string }>;
}

/**
 * List all JSON recording files in a directory
 * Shows name, URL, and action count for each recording
 */
export async function list(dir: string = '.', options: ListOptions = {}): Promise<void> {
  const jsonOutput = options.json || false;
  const directory = path.resolve(dir);

  // Validate directory exists
  try {
    const stats = await fs.stat(directory);
    if (!stats.isDirectory()) {
      const error = `Not a directory: ${directory}`;
      if (jsonOutput) {
        outputJSON({ directory, count: 0, recordings: [], errors: [{ file: directory, error }] });
      } else {
        console.error(`❌ Error: ${error}`);
      }
      process.exit(1);
      return;
    }
  } catch {
    const error = `Directory not found: ${directory}`;
    if (jsonOutput) {
      outputJSON({ directory, count: 0, recordings: [], errors: [{ file: directory, error }] });
    } else {
      console.error(`❌ Error: ${error}`);
    }
    process.exit(1);
    return;
  }

  // Get all JSON files in directory
  const files = await fs.readdir(directory);
  const jsonFiles = files.filter((file) => file.endsWith('.json'));

  if (jsonFiles.length === 0) {
    if (jsonOutput) {
      outputJSON({ directory, count: 0, recordings: [] });
    } else {
      console.log(`\n📁 No recording files found in: ${directory}\n`);
    }
    process.exit(0);
    return;
  }

  // Parse each JSON file and collect recording info
  const parser = new RecordingParser();
  const recordings: RecordingSummary[] = [];
  const errors: Array<{ file: string; error: string }> = [];

  for (const file of jsonFiles) {
    const filePath = path.join(directory, file);
    try {
      const recording = await parser.parseFile(filePath);
      recordings.push({
        file,
        testName: recording.testName,
        url: recording.url,
        actionCount: recording.actions.length,
      });
    } catch (error) {
      // File is not a valid recording, skip it
      errors.push({
        file,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Output results
  if (jsonOutput) {
    const result: ListResult = {
      directory,
      count: recordings.length,
      recordings,
    };
    if (errors.length > 0) {
      result.errors = errors;
    }
    outputJSON(result);
  } else {
    outputConsole(directory, recordings, errors);
  }

  process.exit(0);
}

/**
 * Output result as JSON
 */
function outputJSON(result: ListResult): void {
  console.log(JSON.stringify(result, null, 2));
}

/**
 * Output result in human-readable console format
 */
function outputConsole(
  directory: string,
  recordings: RecordingSummary[],
  errors: Array<{ file: string; error: string }>
): void {
  console.log('');

  if (recordings.length === 0) {
    console.log(`📁 No valid recording files found in: ${directory}`);
    if (errors.length > 0) {
      console.log(`   (${errors.length} JSON file(s) skipped due to invalid format)`);
    }
    console.log('');
    return;
  }

  console.log(`📁 Found ${recordings.length} recording(s) in: ${directory}`);
  console.log('');

  // Calculate column widths for table
  const nameWidth = Math.max(
    12,
    Math.min(30, Math.max(...recordings.map((r) => r.testName.length)))
  );
  const urlWidth = Math.max(20, Math.min(45, Math.max(...recordings.map((r) => r.url.length))));

  // Table header
  const header = `${'Name'.padEnd(nameWidth)} │ ${'URL'.padEnd(urlWidth)} │ Actions`;
  const separator = '─'.repeat(nameWidth) + '─┼─' + '─'.repeat(urlWidth) + '─┼─' + '─'.repeat(8);

  console.log(header);
  console.log(separator);

  // Table rows
  for (const recording of recordings) {
    const name = truncate(recording.testName, nameWidth).padEnd(nameWidth);
    const url = truncate(recording.url, urlWidth).padEnd(urlWidth);
    const actions = String(recording.actionCount).padStart(7);
    console.log(`${name} │ ${url} │ ${actions}`);
  }

  console.log('');

  // Summary
  const totalActions = recordings.reduce((sum, r) => sum + r.actionCount, 0);
  console.log(`Total: ${recordings.length} recording(s), ${totalActions} action(s)`);

  if (errors.length > 0) {
    console.log(`Skipped: ${errors.length} invalid JSON file(s)`);
  }

  console.log('');
}

/**
 * Truncate string to max length with ellipsis
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}
