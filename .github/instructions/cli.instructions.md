---
applyTo: "packages/cli/**/*.ts"
---

# CLI Implementation Guidelines

## Framework: Commander.js

Use Commander.js for CLI structure:

```typescript
import { Command } from 'commander';

const program = new Command();

program
  .name('saveaction')
  .version('0.1.0')
  .description('CLI tool for SaveAction test automation');

program
  .command('run <file>')
  .description('Run a recorded test')
  .option('--headless [value]', 'run in headless mode', 'true')
  .option('--browser <name>', 'browser to use', 'chromium')
  .option('--timeout <ms>', 'timeout in milliseconds', '30000')
  .option('--video <path>', 'record video to path')
  .action(runCommand);
```

## Option Parsing

### Boolean Options
Commander.js passes boolean options as strings. Always parse:

```typescript
const headless = options.headless === 'false' ? false : Boolean(options.headless);
```

### Number Options
```typescript
const timeout = parseInt(options.timeout, 10);
```

## Error Handling

Always use proper exit codes:
```typescript
try {
  // Run command
  process.exit(0);
} catch (error) {
  console.error(chalk.red(`Error: ${error.message}`));
  process.exit(1);
}
```

## Output

Use chalk for colored output:
- `chalk.blue()` - Info messages
- `chalk.green()` - Success messages
- `chalk.red()` - Error messages
- `chalk.yellow()` - Warnings

## Entry Point

The `bin/saveaction.js` file should:
1. Have shebang: `#!/usr/bin/env node`
2. Import and call the CLI main function
3. Be kept minimal (delegate to src/cli.ts)

Example:
```javascript
#!/usr/bin/env node
import { cli } from '../dist/cli.js';
cli();
```

## Command Structure

Each command should:
1. Be in its own file under `src/commands/`
2. Export a single async function
3. Accept `(file, options)` parameters
4. Return exit code or throw error

## Integration

Commands should:
- Create instances of core classes (RecordingParser, PlaywrightRunner, ConsoleReporter)
- Pass options correctly
- Handle errors gracefully
- Provide helpful error messages
