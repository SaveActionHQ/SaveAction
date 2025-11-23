import { RecordingParser, PlaywrightRunner, ConsoleReporter } from '@saveaction/core';
import type { RunOptions } from '@saveaction/core';
import chalk from 'chalk';

interface RunCommandOptions {
  headless: boolean | string;
  browser: 'chromium' | 'firefox' | 'webkit';
  video: boolean;
  timeout: string;
}

export async function runCommand(file: string, options: RunCommandOptions) {
  try {
    console.log(chalk.blue(`\n📂 Loading recording from: ${file}\n`));

    // Parse recording
    const parser = new RecordingParser();
    const recording = await parser.parseFile(file);

    console.log(chalk.green(`✓ Recording parsed successfully`));
    console.log(chalk.gray(`  Test: ${recording.testName}`));
    console.log(chalk.gray(`  Actions: ${recording.actions.length}`));
    console.log(chalk.gray(`  Start URL: ${recording.url}\n`));

    // Parse headless option (handle both boolean and string "false")
    const headless = options.headless === 'false' ? false : Boolean(options.headless);

    // Prepare run options
    const runOptions: RunOptions = {
      headless,
      browser: options.browser,
      video: options.video,
      timeout: parseInt(options.timeout, 10),
    };

    // Create reporter
    const reporter = new ConsoleReporter();

    // Run test
    const runner = new PlaywrightRunner(runOptions, reporter);
    const result = await runner.execute(recording);

    // Exit with appropriate code
    if (result.status === 'success') {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}\n`));
    process.exit(1);
  }
}
