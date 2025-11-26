import type { Action } from '../types/index.js';
import type { Reporter, RunResult } from '../types/runner.js';

/**
 * Enhanced console reporter with detailed error context
 */
export class ConsoleReporter implements Reporter {
  onStart(recording: { testName: string; actionsTotal: number }): void {
    console.log(`\n🎬 Starting test: ${recording.testName}`);
    console.log(`📊 Total actions: ${recording.actionsTotal}\n`);
  }

  onActionStart(action: Action, index: number): void {
    const timing = action.timestamp ? ` (at ${(action.timestamp / 1000).toFixed(1)}s)` : '';
    console.log(`⏳ [${index}] Executing ${action.type}${timing}...`);
  }

  onActionSuccess(action: Action, index: number, duration: number): void {
    console.log(`✅ [${index}] ${action.type} completed (${duration}ms)`);
  }

  onActionError(action: Action, index: number, error: Error): void {
    console.error(`❌ [${index}] ${action.type} failed: ${error.message}`);
  }

  onComplete(result: RunResult): void {
    const duration = (result.duration / 1000).toFixed(2);
    console.log(`\n${'='.repeat(50)}`);

    if (result.status === 'success') {
      console.log(`✅ Test completed successfully!`);
    } else if (result.status === 'partial') {
      console.log(`⚠️  Test partially completed with errors`);
    } else {
      console.log(`❌ Test failed`);
    }

    const timingMode = result.timingEnabled ? 'realistic timing' : 'instant mode';

    console.log(`\n📊 Summary:`);
    console.log(`   Duration: ${duration}s (${timingMode})`);
    console.log(`   Total actions: ${result.actionsTotal}`);
    console.log(`   Executed: ${result.actionsExecuted}`);
    console.log(`   Failed: ${result.actionsFailed}`);

    if (result.errors.length > 0) {
      console.log(`\n🐛 Errors:`);
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. [${error.actionId}] ${error.error}`);
      });

      // Add helpful suggestions
      console.log(`\n💡 Troubleshooting tips:`);
      console.log(`   - Run with --headless false to observe browser behavior`);
      console.log(`   - Check if earlier actions completed as expected`);
      console.log(`   - Increase timeout with --timeout 60000 if elements load slowly`);
      console.log(`   - Review failed action selectors for accuracy`);
    }

    if (result.video) {
      console.log(`\n🎥 Video: ${result.video}`);
    }

    console.log(`${'='.repeat(50)}\n`);
  }
}
