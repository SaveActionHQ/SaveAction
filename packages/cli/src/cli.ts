import { Command } from 'commander';
import { runCommand } from './commands/run.js';
import { info } from './commands/info.js';

export async function cli() {
  const program = new Command();

  program
    .name('saveaction')
    .description('SaveAction CLI - Run browser test recordings')
    .version('0.1.0');

  // Run command
  program
    .command('run <file>')
    .description('Run a test recording')
    .option('--headless [value]', 'Run in headless mode', true)
    .option('--browser <name>', 'Browser to use (chromium, firefox, webkit)', 'chromium')
    .option('--video', 'Record video', false)
    .option('--timeout <ms>', 'Action timeout in milliseconds', '30000')
    .option('--timing [value]', 'Use recorded timing delays (use --no-timing to disable)', true)
    .option('--timing-mode <mode>', 'Timing mode: realistic, fast, instant', 'realistic')
    .option('--speed <multiplier>', 'Speed multiplier (0.5 = half speed, 2.0 = double speed)')
    .option('--max-delay <ms>', 'Maximum delay between actions in milliseconds', '30000')
    .action(runCommand);

  // Info command
  program
    .command('info <file>')
    .description('Display recording information without running it')
    .option('--json', 'Output in JSON format', false)
    .option('--format <type>', 'Output format: console or json', 'console')
    .action(info);

  await program.parseAsync(process.argv);
}
