import { RecordingParser, PlaywrightRunner, ConsoleReporter } from '@saveaction/core';
import type { RunOptions, RunResult, Reporter, Recording } from '@saveaction/core';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { createPlatformClient, PlatformError } from '../platform/index.js';

/**
 * Options for the run command
 */
export interface RunCommandOptions {
  headless: boolean | string;
  browser: 'chromium' | 'firefox' | 'webkit';
  video: boolean;
  timeout: string;
  timing: boolean | string;
  timingMode: 'realistic' | 'fast' | 'instant';
  speed: string;
  maxDelay: string;
  output?: 'console' | 'json';
  outputFile?: string;
  // Platform integration options
  apiUrl?: string;
  apiToken?: string;
  recordingId?: string;
  tag?: string;
  baseUrl?: string;
}

/**
 * Source of the recording (local file or platform)
 */
type RecordingSource =
  | { type: 'file'; path: string }
  | { type: 'platform'; recordingId: string }
  | { type: 'platform-tag'; tag: string };

/**
 * JSON output structure for run results
 */
export interface RunJsonOutput {
  version: string;
  status: 'passed' | 'failed';
  recording: {
    file: string;
    testName: string;
    url: string;
    actionsTotal: number;
    source?: 'file' | 'platform';
    recordingId?: string;
  };
  execution: {
    browser: string;
    headless: boolean;
    timingEnabled: boolean;
    timingMode: string;
    timeout: number;
    baseUrlOverride?: string;
  };
  result: {
    duration: number;
    actionsExecuted: number;
    actionsPassed: number;
    actionsFailed: number;
    errors: Array<{
      actionId: string;
      actionType: string;
      error: string;
    }>;
    video?: string;
  };
  timestamps: {
    startedAt: string;
    completedAt: string;
  };
}

/**
 * Silent reporter that captures results without console output
 */
class SilentReporter implements Reporter {
  onStart(): void {
    // Silent
  }
  onActionStart(): void {
    // Silent
  }
  onActionSuccess(): void {
    // Silent
  }
  onActionError(): void {
    // Silent
  }
  onComplete(): void {
    // Silent
  }
}

/**
 * Determine the source of the recording based on command options
 */
function determineRecordingSource(
  file: string | undefined,
  options: RunCommandOptions
): RecordingSource {
  if (options.recordingId) {
    return { type: 'platform', recordingId: options.recordingId };
  }

  if (options.tag) {
    return { type: 'platform-tag', tag: options.tag };
  }

  if (!file) {
    throw new Error(
      'Recording file path is required. Use a file path, --recording-id, or --tag to specify the recording(s).'
    );
  }

  return { type: 'file', path: file };
}

/**
 * Apply base URL override to a recording
 * Replaces the URL in the recording and all actions with the new base URL
 */
function applyBaseUrlOverride(recording: Recording, baseUrl: string): Recording {
  // Parse the original and new base URLs
  const originalUrl = new URL(recording.url);
  const newBaseUrl = new URL(baseUrl);

  // Replace the origin (protocol + host + port) while keeping the path
  const replaceOrigin = (url: string): string => {
    try {
      const parsed = new URL(url);
      // Only replace if it's the same origin as the original recording
      if (parsed.origin === originalUrl.origin) {
        return `${newBaseUrl.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
      return url;
    } catch {
      // If URL parsing fails, return original
      return url;
    }
  };

  return {
    ...recording,
    url: replaceOrigin(recording.url),
    actions: recording.actions.map((action) => ({
      ...action,
      url: replaceOrigin(action.url),
    })),
  };
}

/**
 * Fetch a recording from the platform
 */
async function fetchFromPlatform(
  recordingId: string,
  apiUrl?: string,
  apiToken?: string,
  silent: boolean = false
): Promise<Recording> {
  const client = createPlatformClient(apiUrl, apiToken);

  if (!silent) {
    console.log(chalk.blue(`\n🌐 Fetching recording from platform: ${recordingId}`));
    console.log(chalk.gray(`   API: ${client.getApiUrl()}\n`));
  }

  const recording = await client.fetchRecording(recordingId);

  if (!silent) {
    console.log(chalk.green(`✓ Recording fetched successfully`));
  }

  return recording;
}

/**
 * Fetch recordings by tag from the platform
 */
async function fetchByTagFromPlatform(
  tag: string,
  apiUrl?: string,
  apiToken?: string,
  silent: boolean = false
): Promise<Recording[]> {
  const client = createPlatformClient(apiUrl, apiToken);

  if (!silent) {
    console.log(chalk.blue(`\n🌐 Fetching recordings with tag: ${tag}`));
    console.log(chalk.gray(`   API: ${client.getApiUrl()}\n`));
  }

  const recordings = await client.fetchRecordingsByTags([tag]);

  if (!silent) {
    console.log(chalk.green(`✓ Found ${recordings.length} recording(s) with tag "${tag}"`));
  }

  return recordings;
}

export async function runCommand(file: string | undefined, options: RunCommandOptions) {
  const outputFormat = options.output || 'console';
  const isJsonOutput = outputFormat === 'json' || !!options.outputFile;
  const startedAt = new Date().toISOString();

  try {
    // Determine recording source
    const source = determineRecordingSource(file, options);

    // Handle tag-based execution (multiple recordings)
    if (source.type === 'platform-tag') {
      await runMultipleRecordings(source.tag, options, startedAt);
      return;
    }

    // Single recording execution
    let recording: Recording;
    let sourceLabel: string;

    if (source.type === 'platform') {
      recording = await fetchFromPlatform(
        source.recordingId,
        options.apiUrl,
        options.apiToken,
        isJsonOutput
      );
      sourceLabel = `platform:${source.recordingId}`;
    } else {
      if (!isJsonOutput) {
        console.log(chalk.blue(`\n📂 Loading recording from: ${source.path}\n`));
      }

      const parser = new RecordingParser();
      recording = await parser.parseFile(source.path);
      sourceLabel = source.path;
    }

    // Apply base URL override if specified
    if (options.baseUrl) {
      if (!isJsonOutput) {
        console.log(chalk.yellow(`🔄 Overriding base URL to: ${options.baseUrl}`));
      }
      recording = applyBaseUrlOverride(recording, options.baseUrl);
    }

    if (!isJsonOutput) {
      console.log(chalk.green(`✓ Recording parsed successfully`));
      console.log(chalk.gray(`  Test: ${recording.testName}`));
      console.log(chalk.gray(`  Actions: ${recording.actions.length}`));
      console.log(chalk.gray(`  Start URL: ${recording.url}\n`));
    }

    // Parse headless option (handle both boolean and string "false")
    const headless = options.headless === 'false' ? false : Boolean(options.headless);

    // Parse timing option (--no-timing sets it to false)
    const enableTiming = options.timing === 'false' ? false : Boolean(options.timing);

    // Prepare run options
    const runOptions: RunOptions = {
      headless,
      browser: options.browser,
      video: options.video,
      timeout: parseInt(options.timeout, 10),
      enableTiming,
      timingMode: options.timingMode,
      speedMultiplier: options.speed ? parseFloat(options.speed) : undefined,
      maxActionDelay: options.maxDelay ? parseInt(options.maxDelay, 10) : undefined,
    };

    // Create reporter (silent for JSON output)
    const reporter = isJsonOutput ? new SilentReporter() : new ConsoleReporter();

    // Run test
    const runner = new PlaywrightRunner(runOptions, reporter);
    const result = await runner.execute(recording);
    const completedAt = new Date().toISOString();

    // Handle JSON output
    if (isJsonOutput) {
      const jsonOutput = buildJsonOutput(
        sourceLabel,
        recording,
        result,
        runOptions,
        startedAt,
        completedAt,
        source.type === 'platform' ? source.recordingId : undefined,
        options.baseUrl
      );

      if (options.outputFile) {
        await writeOutputFile(options.outputFile, jsonOutput);
        // Still show minimal console feedback when writing to file
        if (outputFormat !== 'json') {
          console.log(chalk.green(`✓ Results saved to: ${options.outputFile}`));
        }
      }

      if (outputFormat === 'json') {
        console.log(JSON.stringify(jsonOutput, null, 2));
      }
    }

    // Exit with appropriate code
    if (result.status === 'success') {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (error) {
    const completedAt = new Date().toISOString();
    let errorMessage: string;

    if (error instanceof PlatformError) {
      errorMessage = `Platform error: ${error.message}`;
      if (error.code) {
        errorMessage += ` (${error.code})`;
      }
    } else {
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    if (isJsonOutput) {
      const errorOutput = {
        version: '1.0',
        status: 'failed',
        error: errorMessage,
        timestamps: {
          startedAt,
          completedAt,
        },
      };

      if (options.outputFile) {
        await writeOutputFile(options.outputFile, errorOutput);
      }

      if (outputFormat === 'json') {
        console.log(JSON.stringify(errorOutput, null, 2));
      }
    } else {
      console.error(chalk.red(`\n❌ Error: ${errorMessage}\n`));
    }

    process.exit(1);
  }
}

/**
 * Run multiple recordings fetched by tag
 */
async function runMultipleRecordings(
  tag: string,
  options: RunCommandOptions,
  startedAt: string
): Promise<void> {
  const outputFormat = options.output || 'console';
  const isJsonOutput = outputFormat === 'json' || !!options.outputFile;

  try {
    const recordings = await fetchByTagFromPlatform(
      tag,
      options.apiUrl,
      options.apiToken,
      isJsonOutput
    );

    if (recordings.length === 0) {
      if (!isJsonOutput) {
        console.log(chalk.yellow(`\n⚠ No recordings found with tag: ${tag}\n`));
      }
      process.exit(0);
      return;
    }

    // Parse run options once
    const headless = options.headless === 'false' ? false : Boolean(options.headless);
    const enableTiming = options.timing === 'false' ? false : Boolean(options.timing);

    const runOptions: RunOptions = {
      headless,
      browser: options.browser,
      video: options.video,
      timeout: parseInt(options.timeout, 10),
      enableTiming,
      timingMode: options.timingMode,
      speedMultiplier: options.speed ? parseFloat(options.speed) : undefined,
      maxActionDelay: options.maxDelay ? parseInt(options.maxDelay, 10) : undefined,
    };

    const results: Array<{ recording: Recording; result: RunResult }> = [];
    let hasFailures = false;

    for (const recording of recordings) {
      let processedRecording = recording;

      // Apply base URL override if specified
      if (options.baseUrl) {
        processedRecording = applyBaseUrlOverride(recording, options.baseUrl);
      }

      if (!isJsonOutput) {
        console.log(chalk.blue(`\n▶ Running: ${processedRecording.testName}`));
        console.log(chalk.gray(`  ID: ${processedRecording.id}`));
        console.log(chalk.gray(`  URL: ${processedRecording.url}\n`));
      }

      const reporter = isJsonOutput ? new SilentReporter() : new ConsoleReporter();
      const runner = new PlaywrightRunner(runOptions, reporter);
      const result = await runner.execute(processedRecording);

      results.push({ recording: processedRecording, result });

      if (result.status !== 'success') {
        hasFailures = true;
      }
    }

    const completedAt = new Date().toISOString();

    // Output summary
    if (isJsonOutput) {
      const jsonOutput = {
        version: '1.0',
        status: hasFailures ? 'failed' : 'passed',
        tag,
        totalRecordings: recordings.length,
        passed: results.filter((r) => r.result.status === 'success').length,
        failed: results.filter((r) => r.result.status !== 'success').length,
        recordings: results.map(({ recording, result }) => ({
          id: recording.id,
          testName: recording.testName,
          status: result.status === 'success' ? 'passed' : 'failed',
          duration: result.duration,
          actionsExecuted: result.actionsExecuted,
          actionsFailed: result.actionsFailed,
          errors: result.errors,
        })),
        timestamps: {
          startedAt,
          completedAt,
        },
      };

      if (options.outputFile) {
        await writeOutputFile(options.outputFile, jsonOutput);
        if (outputFormat !== 'json') {
          console.log(chalk.green(`✓ Results saved to: ${options.outputFile}`));
        }
      }

      if (outputFormat === 'json') {
        console.log(JSON.stringify(jsonOutput, null, 2));
      }
    } else {
      console.log(chalk.bold('\n📊 Summary:'));
      console.log(
        chalk.gray(
          `   Total: ${recordings.length} | ` +
            chalk.green(`Passed: ${results.filter((r) => r.result.status === 'success').length}`) +
            ' | ' +
            chalk.red(`Failed: ${results.filter((r) => r.result.status !== 'success').length}`)
        )
      );
    }

    process.exit(hasFailures ? 1 : 0);
  } catch (error) {
    const completedAt = new Date().toISOString();
    let errorMessage: string;

    if (error instanceof PlatformError) {
      errorMessage = `Platform error: ${error.message}`;
    } else {
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    if (isJsonOutput) {
      const errorOutput = {
        version: '1.0',
        status: 'failed',
        error: errorMessage,
        timestamps: { startedAt, completedAt },
      };

      if (options.outputFile) {
        await writeOutputFile(options.outputFile, errorOutput);
      }

      if (outputFormat === 'json') {
        console.log(JSON.stringify(errorOutput, null, 2));
      }
    } else {
      console.error(chalk.red(`\n❌ Error: ${errorMessage}\n`));
    }

    process.exit(1);
  }
}

/**
 * Build JSON output structure from run results
 */
function buildJsonOutput(
  sourceLabel: string,
  recording: { testName: string; url: string; actions: unknown[]; id?: string },
  result: RunResult,
  runOptions: RunOptions,
  startedAt: string,
  completedAt: string,
  recordingId?: string,
  baseUrlOverride?: string
): RunJsonOutput {
  const isPlatformSource = sourceLabel.startsWith('platform:');

  return {
    version: '1.0',
    status: result.status === 'success' ? 'passed' : 'failed',
    recording: {
      file: isPlatformSource ? '' : path.basename(sourceLabel),
      testName: recording.testName,
      url: recording.url,
      actionsTotal: recording.actions.length,
      source: isPlatformSource ? 'platform' : 'file',
      recordingId: recordingId || recording.id,
    },
    execution: {
      browser: runOptions.browser || 'chromium',
      headless: runOptions.headless ?? true,
      timingEnabled: runOptions.enableTiming ?? true,
      timingMode: runOptions.timingMode || 'realistic',
      timeout: runOptions.timeout || 30000,
      baseUrlOverride,
    },
    result: {
      duration: result.duration,
      actionsExecuted: result.actionsExecuted,
      actionsPassed: result.actionsExecuted - result.actionsFailed,
      actionsFailed: result.actionsFailed,
      errors: result.errors.map((e) => ({
        actionId: e.actionId,
        actionType: e.actionType,
        error: e.error,
      })),
      video: result.video,
    },
    timestamps: {
      startedAt,
      completedAt,
    },
  };
}

/**
 * Write JSON output to file
 */
async function writeOutputFile(filePath: string, data: unknown): Promise<void> {
  const resolvedPath = path.resolve(filePath);
  const dir = path.dirname(resolvedPath);

  // Ensure directory exists
  await fs.mkdir(dir, { recursive: true });

  // Write file
  await fs.writeFile(resolvedPath, JSON.stringify(data, null, 2), 'utf-8');
}
