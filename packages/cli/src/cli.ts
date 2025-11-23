import { Command } from 'commander';
import { runCommand } from './commands/run.js';

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
    .action(runCommand);

  await program.parseAsync(process.argv);
}
