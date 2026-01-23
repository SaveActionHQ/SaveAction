import { RecordingParser, PlaywrightRunner, ConsoleReporter } from '@saveaction/core';
import type { RunOptions, RunResult, Reporter } from '@saveaction/core';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';

interface RunCommandOptions {
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
}

/**
 * JSON output structure for run results
 */
interface RunJsonOutput {
  version: string;
  status: 'passed' | 'failed';
  recording: {
    file: string;
    testName: string;
    url: string;
    actionsTotal: number;
  };
  execution: {
    browser: string;
    headless: boolean;
    timingEnabled: boolean;
    timingMode: string;
    timeout: number;
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

export async function runCommand(file: string, options: RunCommandOptions) {
  const outputFormat = options.output || 'console';
  const isJsonOutput = outputFormat === 'json' || options.outputFile;
  const startedAt = new Date().toISOString();

  try {
    if (!isJsonOutput) {
      console.log(chalk.blue(`\n📂 Loading recording from: ${file}\n`));
    }

    // Parse recording
    const parser = new RecordingParser();
    const recording = await parser.parseFile(file);

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
        file,
        recording,
        result,
        runOptions,
        startedAt,
        completedAt
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
    const errorMessage = error instanceof Error ? error.message : String(error);

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
 * Build JSON output structure from run results
 */
function buildJsonOutput(
  file: string,
  recording: { testName: string; url: string; actions: unknown[] },
  result: RunResult,
  runOptions: RunOptions,
  startedAt: string,
  completedAt: string
): RunJsonOutput {
  return {
    version: '1.0',
    status: result.status === 'success' ? 'passed' : 'failed',
    recording: {
      file: path.basename(file),
      testName: recording.testName,
      url: recording.url,
      actionsTotal: recording.actions.length,
    },
    execution: {
      browser: runOptions.browser || 'chromium',
      headless: runOptions.headless ?? true,
      timingEnabled: runOptions.enableTiming ?? true,
      timingMode: runOptions.timingMode || 'realistic',
      timeout: runOptions.timeout || 30000,
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
