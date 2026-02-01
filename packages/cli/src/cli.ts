import { Command } from 'commander';
import { runCommand } from './commands/run.js';
import { info } from './commands/info.js';
import { validate } from './commands/validate.js';
import { list } from './commands/list.js';

export async function cli() {
  const program = new Command();

  program
    .name('saveaction')
    .description('SaveAction CLI - Run browser test recordings')
    .version('0.1.0');

  // Run command
  program
    .command('run [file]')
    .description('Run a test recording from file or platform')
    .option('--headless [value]', 'Run in headless mode', true)
    .option('--browser <name>', 'Browser to use (chromium, firefox, webkit)', 'chromium')
    .option('--video', 'Record video', false)
    .option('--timeout <ms>', 'Action timeout in milliseconds', '30000')
    .option('--timing [value]', 'Use recorded timing delays (use --no-timing to disable)', true)
    .option('--timing-mode <mode>', 'Timing mode: realistic, fast, instant', 'realistic')
    .option('--speed <multiplier>', 'Speed multiplier (0.5 = half speed, 2.0 = double speed)')
    .option('--max-delay <ms>', 'Maximum delay between actions in milliseconds', '30000')
    .option('--output <format>', 'Output format: console or json', 'console')
    .option('--output-file <path>', 'Save results to JSON file')
    // Platform integration options
    .option('--api-url <url>', 'SaveAction platform API URL (or set SAVEACTION_API_URL)')
    .option('--api-token <token>', 'SaveAction platform API token (or set SAVEACTION_API_TOKEN)')
    .option('--recording-id <id>', 'Fetch and run a recording by ID from the platform')
    .option('--tag <tag>', 'Fetch and run all recordings with the specified tag')
    .option('--base-url <url>', 'Override the base URL for all actions in the recording')
    .action(runCommand);

  // Info command
  program
    .command('info <file>')
    .description('Display recording information without running it')
    .option('--json', 'Output in JSON format', false)
    .option('--format <type>', 'Output format: console or json', 'console')
    .action(info);

  // Validate command
  program
    .command('validate <file>')
    .description('Validate recording file structure without running it')
    .option('--verbose', 'Show detailed validation information', false)
    .option('--json', 'Output validation result as JSON', false)
    .action(validate);

  // List command
  program
    .command('list [dir]')
    .description('List all recording files in a directory')
    .option('--json', 'Output in JSON format', false)
    .action(list);

  await program.parseAsync(process.argv);
}
