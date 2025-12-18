import { promises as fs } from 'fs';
import { z } from 'zod';
import type { Recording } from '../types/index.js';

/**
 * Zod schema for recording validation
 */
const recordingSchema = z.object({
  id: z.string(),
  version: z.string(),
  testName: z.string(),
  url: z.string().url(),
  startTime: z.string(),
  endTime: z.string().optional(),
  viewport: z.object({
    width: z.number(),
    height: z.number(),
  }),
  windowSize: z
    .object({
      width: z.number(),
      height: z.number(),
    })
    .optional(),
  screenSize: z
    .object({
      width: z.number(),
      height: z.number(),
    })
    .optional(),
  devicePixelRatio: z.number().optional(),
  userAgent: z.string(),
  actions: z.array(z.any()), // We'll validate individual actions later
});

/**
 * Parses and validates JSON recording files
 */
export class RecordingParser {
  /**
   * Parse recording from JSON file
   */
  async parseFile(filePath: string): Promise<Recording> {
    const content = await fs.readFile(filePath, 'utf-8');
    return this.parseString(content);
  }

  /**
   * Parse recording from JSON string
   */
  parseString(json: string): Recording {
    const data = JSON.parse(json);
    return this.validate(data);
  }

  /**
   * Validate recording structure
   */
  private validate(data: unknown): Recording {
    const result = recordingSchema.safeParse(data);

    if (!result.success) {
      throw new Error(`Invalid recording format: ${result.error.message}`);
    }

    return result.data as Recording;
  }

  /**
   * Sort actions by ID to preserve recording sequence order
   * IDs are sequential (act_001, act_002...) and always reflect actual recording order
   */
  private sortActionsByID(actions: any[]): any[] {
    return [...actions].sort((a, b) => {
      const idA = parseInt(a.id.replace(/\D/g, ''), 10);
      const idB = parseInt(b.id.replace(/\D/g, ''), 10);
      return idA - idB;
    });
  }

  /**
   * Detect and fix illogical action sequences (e.g., click button before typing in input)
   * Common pattern: Input action with timestamp after button click on same form
   *
   * Strategy: Find inputs that come AFTER form submission actions in the same form.
   * Move the input to just before the first submission-related action.
   */
  private detectAndFixIllogicalSequences(actions: any[]): any[] {
    const result = [...actions];
    let hasSwaps = false;

    // Scan for inputs that appear after submit-related actions in same form
    for (let i = 0; i < result.length; i++) {
      const action = result[i];

      // Look for input actions
      if (action.type === 'input') {
        // Look backwards to find if there's a submit action that should come AFTER this input
        for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
          const prevAction = result[j];

          // Check if previous action is form submission related
          const isSubmitRelated =
            prevAction.type === 'submit' ||
            (prevAction.type === 'click' && this.isFormSubmitButton(prevAction));

          if (isSubmitRelated && this.areInSameForm(prevAction, action)) {
            // Check if within reasonable time window (5 seconds)
            const timeDiff = action.timestamp - prevAction.timestamp;
            if (timeDiff >= 0 && timeDiff < 5000) {
              console.log(
                `🔄 Swapping illogical sequence: Moving ${action.id} (input) before ${prevAction.id} (${prevAction.type})`
              );
              console.log(`   Reason: Must type value BEFORE clicking submit (not after)`);

              // Remove input from current position
              result.splice(i, 1);

              // Insert input just before the submit action
              result.splice(j, 0, action);

              hasSwaps = true;

              // Restart scan from beginning since we modified the array
              i = -1;
              break;
            }
          }
        }
      }
    }

    if (hasSwaps) {
      console.log(`✓ Fixed illogical action sequences (reordered for correct behavior)`);
    }

    return result;
  }

  /**
   * Check if action is a form submit button click
   */
  private isFormSubmitButton(action: any): boolean {
    if (action.type !== 'click') return false;

    const selector = action.selector;
    const text = action.text?.toLowerCase() || '';

    // Check for submit button patterns
    return (
      selector?.css?.includes('button') &&
      (text.includes('submit') ||
        text.includes('calculate') ||
        text.includes('send') ||
        text.includes('save') ||
        selector?.css?.includes('[type="submit"]'))
    );
  }

  /**
   * Check if two actions are in the same form
   */
  private areInSameForm(action1: any, action2: any): boolean {
    const css1 = action1.selector?.css || '';
    const css2 = action2.selector?.css || '';

    // Extract form ID or class from CSS selectors
    const formPattern = /form[#.][\w-]+/;
    const form1Match = css1.match(formPattern);
    const form2Match = css2.match(formPattern);

    if (form1Match && form2Match) {
      return form1Match[0] === form2Match[0];
    }

    // Also check if input has same parent as button
    const parentPattern = />(.*?)>/g;
    const parents1 = css1.match(parentPattern) || [];
    const parents2 = css2.match(parentPattern) || [];

    // If they share common parent elements, likely same form
    return parents1.some((p1: string) => parents2.some((p2: string) => p1 === p2));
  }

  /**
   * Fix timestamp inversions where action timestamps go backwards
   * NOTE: Now that the runner sorts by timestamp, we just detect inversions without modifying them
   */
  private normalizeActionTimestamps(actions: any[]): any[] {
    const result = [...actions];

    for (let i = 1; i < result.length; i++) {
      const prev = result[i - 1];
      const curr = result[i];

      // Check for timestamp inversion (current before previous in JSON array)
      if (curr.timestamp < prev.timestamp) {
        const anomalyDiff = prev.timestamp - curr.timestamp;
        console.log(
          `⚠️ Detected timestamp inversion in JSON: ${curr.id} (${curr.timestamp}ms) comes after ${prev.id} (${prev.timestamp}ms) but has earlier timestamp (${anomalyDiff}ms difference)`
        );
        console.log(`   ℹ️  Runner will sort by timestamp to fix this automatically`);
      } else if (i > 0) {
        // Check for very close timestamps (< 5ms) from different action types
        const timeDiff = curr.timestamp - prev.timestamp;
        if (timeDiff < 5 && curr.type !== prev.type) {
          // This is suspicious but not necessarily wrong - just log for debugging
          if (timeDiff < 2) {
            console.log(
              `⚠️ Very close timestamps: ${prev.id} and ${curr.id} (${timeDiff}ms apart)`
            );
          }
        }
      }
    }

    return result;
  }

  /**
   * Normalize timestamps to relative format (milliseconds since recording start)
   * Auto-detects if timestamps are absolute (Unix epoch) or relative and converts if needed
   */
  normalizeTimestamps(recording: Recording): Recording {
    if (recording.actions.length === 0) {
      return recording;
    }

    // Step 1: Sort actions by ID to preserve recording sequence
    const sortedActions = this.sortActionsByID(recording.actions);

    const firstTimestamp = sortedActions[0].timestamp;

    // If first timestamp > 1 billion, it's absolute Unix epoch time
    // Convert to relative by subtracting first timestamp from all actions
    let processedActions = sortedActions;

    if (firstTimestamp > 1_000_000_000_000) {
      const startTime = firstTimestamp;
      processedActions = sortedActions.map((action) => ({
        ...action,
        timestamp: action.timestamp - startTime,
      }));
    }

    // Step 2: Detect and fix illogical sequences (e.g., submit before input)
    const logicalActions = this.detectAndFixIllogicalSequences(processedActions);

    // Step 3: Fix any timestamp inversions (where timestamps go backwards)
    const normalizedActions = this.normalizeActionTimestamps(logicalActions);

    return {
      ...recording,
      actions: normalizedActions,
    };
  }
}
