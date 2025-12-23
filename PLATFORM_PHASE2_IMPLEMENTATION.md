# SaveAction Platform - Phase 2 Runner Implementation

## 🎯 OBJECTIVE

Upgrade the PlaywrightRunner to consume the new recorder metadata from test8.json and future recordings. This enables intelligent element location, modal handling, and graceful degradation.

---

## 📋 IMPLEMENTATION TASKS

### Task 1: Multi-Strategy Selector Fallback Chain

**File**: `packages/core/src/runner/ElementLocator.ts`
**Priority**: 🔴 CRITICAL

#### Current State

```typescript
// ElementLocator tries selectors but doesn't use priority/confidence
async findElement(page: Page, selector: SelectorStrategy): Promise<Locator> {
  // Tries: id → dataTestId → ariaLabel → css → xpath → position
  // Uses first successful match
}
```

#### Required Changes

```typescript
interface SelectorWithMetadata {
  strategy: string;
  value: any;
  priority: number;    // NEW: 1-11 (lower = better)
  confidence: number;  // NEW: 0-100 (higher = better)
}

async findElement(
  page: Page,
  selectors: SelectorWithMetadata[],
  contentSignature?: ContentSignature
): Promise<Locator | null> {
  // Sort by priority (ascending)
  const sortedSelectors = [...selectors].sort((a, b) => a.priority - b.priority);

  // Try each selector in order
  for (const selector of sortedSelectors) {
    try {
      const locator = await this.getLocatorByStrategy(page, selector);

      // Check if element exists and is visible (for high-confidence selectors)
      if (selector.confidence >= 80) {
        const count = await locator.count();
        if (count === 1) {
          console.log(`✓ Found element using ${selector.strategy} (confidence: ${selector.confidence}%)`);
          return locator;
        }
      } else {
        // Lower confidence, just check existence
        const count = await locator.count();
        if (count > 0) {
          console.log(`⚠️ Found element using ${selector.strategy} (low confidence: ${selector.confidence}%)`);
          return locator.first();
        }
      }
    } catch (error) {
      console.log(`✗ Failed with ${selector.strategy}: ${error.message}`);
      continue;
    }
  }

  // Fallback: Try content signature if available
  if (contentSignature) {
    console.log('⚡ Trying content signature fallback...');
    return await this.findByContentSignature(page, contentSignature);
  }

  // Element not found - return null instead of throwing
  console.warn(`⚠️ Element not found after trying ${sortedSelectors.length} strategies`);
  return null;
}

private async findByContentSignature(
  page: Page,
  signature: ContentSignature
): Promise<Locator | null> {
  const { elementType, contentFingerprint } = signature;

  // Build content-based locator
  const selectors: string[] = [];

  if (contentFingerprint.heading) {
    selectors.push(`${elementType}:has-text("${contentFingerprint.heading}")`);
  }

  if (contentFingerprint.linkHref) {
    selectors.push(`a[href*="${contentFingerprint.linkHref}"]`);
  }

  if (contentFingerprint.imageSrc) {
    selectors.push(`img[src*="${contentFingerprint.imageSrc}"]`);
  }

  // Try each content selector
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector);
      const count = await locator.count();
      if (count > 0) {
        console.log(`✓ Found by content: ${selector}`);
        return locator.first();
      }
    } catch (error) {
      continue;
    }
  }

  return null;
}
```

**Testing**:

- Run test8.json and verify it uses priority-sorted selectors
- Test with element that changes position between recordings
- Verify content signature fallback works for dynamic lists

---

### Task 2: Modal Lifecycle Event Handling

**File**: `packages/core/src/runner/PlaywrightRunner.ts`
**Priority**: 🔴 CRITICAL

#### Current State

```typescript
// Runner doesn't recognize modal-lifecycle events
async executeAction(page: Page, action: Action): Promise<void> {
  switch (action.type) {
    case 'click': return this.executeClick(page, action);
    case 'input': return this.executeInput(page, action);
    // ... no modal-lifecycle handler
  }
}
```

#### Required Changes

```typescript
// Add to Action type union in packages/core/src/types/actions.ts
interface ModalLifecycleAction {
  id: string;
  type: 'modal-lifecycle';
  event: 'modal-opened' | 'modal-state-changed' | 'modal-closed';
  timestamp: number;
  url: string;
  modalElement: {
    id: string | null;
    classes: string | null;
    role: string | null;
    zIndex: string | null;
  };
}

// In PlaywrightRunner.ts
private modalState = new Map<string, boolean>(); // Track open modals

async executeAction(page: Page, action: Action): Promise<void> {
  switch (action.type) {
    case 'modal-lifecycle':
      return this.handleModalLifecycle(page, action);
    case 'click':
      return this.executeClick(page, action);
    // ... existing cases
  }
}

private async handleModalLifecycle(
  page: Page,
  action: ModalLifecycleAction
): Promise<void> {
  const { event, modalElement } = action;

  switch (event) {
    case 'modal-opened':
      console.log(`🔓 Modal opened: ${modalElement.id || modalElement.classes}`);

      // Wait for modal to be visible
      if (modalElement.id) {
        await page.waitForSelector(`#${modalElement.id}`, {
          state: 'visible',
          timeout: 5000
        });
      } else if (modalElement.role) {
        await page.waitForSelector(`[role="${modalElement.role}"]`, {
          state: 'visible',
          timeout: 5000
        });
      }

      // Wait for animation to complete (standard 300ms + buffer)
      await page.waitForTimeout(500);

      // Track modal state
      this.modalState.set(modalElement.id || 'anonymous', true);
      break;

    case 'modal-closed':
      console.log(`🔒 Modal closed: ${modalElement.id || modalElement.classes}`);

      // Wait for modal to be hidden
      if (modalElement.id) {
        await page.waitForSelector(`#${modalElement.id}`, {
          state: 'hidden',
          timeout: 5000
        }).catch(() => {
          // Modal might be removed from DOM instead of hidden
          console.log('Modal removed from DOM');
        });
      }

      // Wait for close animation
      await page.waitForTimeout(300);

      // Update state
      this.modalState.delete(modalElement.id || 'anonymous');
      break;

    case 'modal-state-changed':
      console.log(`🔄 Modal state changed`);
      // Wait for state transition animation
      await page.waitForTimeout(500);
      break;
  }
}
```

**Testing**:

- Record modal interaction on test2.json website (mybouquet.co.uk)
- Verify runner waits for modal open before clicking inside
- Verify runner waits for modal state transition
- Test modal close button clicking after state change

---

### Task 3: Handle `requiresModalState` in Actions

**File**: `packages/core/src/runner/PlaywrightRunner.ts`
**Priority**: 🔴 CRITICAL

#### Required Changes

```typescript
// Update executeClick to check modal requirements
private async executeClick(page: Page, action: ClickAction): Promise<void> {
  const { selector, context } = action;

  // Check if action requires modal to be open
  if (context?.requiresModalState && context?.modalContext) {
    const modalId = context.modalContext.modalId;

    if (!this.modalState.get(modalId)) {
      console.warn(`⚠️ Action requires modal "${modalId}" but it's not open, waiting...`);

      // Wait for modal to appear
      await page.waitForSelector(
        `#${modalId}, [role="dialog"], [role="alertdialog"]`,
        { state: 'visible', timeout: 5000 }
      ).catch(() => {
        console.warn(`Modal "${modalId}" never appeared, proceeding anyway`);
      });

      // Update state
      this.modalState.set(modalId, true);

      // Wait for modal animation
      await page.waitForTimeout(500);
    }
  }

  // Find element using new multi-strategy approach
  const element = await this.elementLocator.findElement(
    page,
    action.selectors, // NEW: pass all selectors with priority
    action.contentSignature // NEW: pass content signature for fallback
  );

  if (!element) {
    // Check if action is optional
    if (action.isOptional || action.skipIfNotFound) {
      console.log(`⏭️ Skipping optional action: ${action.text || action.id}`);
      return; // Don't fail test
    }

    throw new Error(`Element not found for action ${action.id}`);
  }

  // Execute click
  await element.click({ timeout: this.options.actionTimeout });

  // Existing navigation detection and delays
  await page.waitForTimeout(300);
}
```

**Testing**:

- Test with modal actions that have `requiresModalState: true`
- Verify runner waits for modal before executing action
- Test with missing modal (should wait then proceed gracefully)
- Test optional actions (should skip without failing)

---

### Task 4: Graceful Action Failure Handling

**File**: `packages/core/src/runner/PlaywrightRunner.ts`
**Priority**: 🟡 HIGH

#### Current State

```typescript
// Runner fails entire test if one action fails
async execute(recording: Recording, options?: RunOptions): Promise<RunResult> {
  for (const action of recording.actions) {
    await this.executeAction(page, action); // Throws on failure
  }
}
```

#### Required Changes

```typescript
async execute(recording: Recording, options?: RunOptions): Promise<RunResult> {
  const result: RunResult = {
    success: true,
    actions: [],
    skippedActions: [], // NEW
    errors: []
  };

  for (let i = 0; i < recording.actions.length; i++) {
    const action = recording.actions[i];

    try {
      await this.executeAction(page, action);

      result.actions.push({
        action,
        status: 'success',
        duration: /* track duration */
      });

    } catch (error) {
      // Check if action is optional
      if (action.isOptional || action.skipIfNotFound) {
        console.log(`⏭️ Skipped optional action ${action.id}: ${error.message}`);

        result.skippedActions.push({
          action,
          reason: error.message
        });

        continue; // Continue to next action
      }

      // Critical action failed
      console.error(`❌ Critical action ${action.id} failed: ${error.message}`);

      result.errors.push({
        action,
        error: error.message
      });

      result.success = false;

      // Decide: continue or stop?
      if (options?.continueOnError) {
        console.log('⚠️ Continuing despite error...');
        continue;
      } else {
        break; // Stop execution
      }
    }
  }

  return result;
}
```

**Testing**:

- Test with missing element (should skip if optional)
- Test with critical failure (should stop execution)
- Test with `continueOnError: true` option
- Verify skipped actions reported correctly

---

### Task 5: Update Type Definitions

**File**: `packages/core/src/types/actions.ts`
**Priority**: 🟡 HIGH

#### Required Changes

```typescript
// Add to base Action interface
interface BaseAction {
  id: string;
  type: string;
  timestamp: number;
  url: string;

  // NEW: Optional action flags
  isOptional?: boolean;
  skipIfNotFound?: boolean;
  reason?: string; // Why optional (e.g., "modal-close-button", "hover-preview")

  // NEW: Multi-strategy selectors
  selectors?: SelectorWithMetadata[];

  // NEW: Content signature for fallback
  contentSignature?: ContentSignature;
}

interface SelectorWithMetadata {
  strategy:
    | 'id'
    | 'aria-label'
    | 'name'
    | 'text-content'
    | 'src-pattern'
    | 'css'
    | 'xpath'
    | 'position';
  value: any;
  priority: number; // 1-11 (lower = higher priority)
  confidence: number; // 0-100 (higher = more reliable)
}

interface ContentSignature {
  elementType: string; // 'div', 'li', 'article', etc.
  listContainer?: string; // CSS selector for parent list
  contentFingerprint: {
    heading?: string;
    subheading?: string;
    imageAlt?: string;
    imageSrc?: string;
    linkHref?: string;
    price?: string;
    rating?: string;
  };
  visualHints?: {
    position?: number;
    nearText?: string;
  };
  fallbackPosition?: number; // Last resort: position in list
}

interface ModalLifecycleAction extends BaseAction {
  type: 'modal-lifecycle';
  event: 'modal-opened' | 'modal-state-changed' | 'modal-closed';
  modalElement: {
    id: string | null;
    classes: string | null;
    role: string | null;
    zIndex: string | null;
  };
}

// Add to Action union type
export type Action =
  | ClickAction
  | InputAction
  | ScrollAction
  | NavigationAction
  | SelectAction
  | KeypressAction
  | SubmitAction
  | ModalLifecycleAction; // NEW

// Update ClickAction interface
interface ClickAction extends BaseAction {
  type: 'click';
  selectors: SelectorWithMetadata[]; // NEW: changed from single SelectorStrategy
  text?: string;
  elementTag?: string;
  contentSignature?: ContentSignature; // NEW
  context?: {
    requiresModalState?: boolean; // NEW
    modalContext?: {
      withinModal: boolean;
      modalDetected: boolean;
      modalId?: string;
    };
    // ... existing context fields
  };
}
```

**Testing**:

- Run `pnpm build` and verify TypeScript compilation
- Test type guards still work (`isClickAction()`, etc.)
- Verify new fields are optional (backward compatibility)

---

### Task 6: Update RunResult Interface

**File**: `packages/core/src/types/runner.ts`
**Priority**: 🟢 MEDIUM

#### Required Changes

```typescript
interface RunResult {
  success: boolean;
  duration: number;
  actions: ActionResult[];
  skippedActions?: SkippedAction[]; // NEW
  errors: ActionError[];
}

interface SkippedAction {
  action: Action;
  reason: string; // Why skipped
}

interface ActionResult {
  action: Action;
  status: 'success' | 'failed' | 'skipped'; // NEW: added 'skipped'
  duration: number;
  error?: string;
}
```

---

### Task 7: Update ConsoleReporter

**File**: `packages/core/src/reporter/ConsoleReporter.ts`
**Priority**: 🟢 MEDIUM

#### Required Changes

```typescript
onActionSuccess(action: Action, index: number, duration: number): void {
  const emoji = this.getActionEmoji(action.type);
  const actionText = this.getActionDescription(action);

  // Show which selector strategy was used
  if (action.selectors && action.selectors.length > 0) {
    const usedStrategy = action.selectors[0].strategy; // Assume first priority was used
    console.log(
      `  ${emoji} Action ${index + 1}: ${actionText} ` +
      `${chalk.gray(`[${usedStrategy}]`)} ${chalk.green(`✓ ${duration}ms`)}`
    );
  } else {
    console.log(
      `  ${emoji} Action ${index + 1}: ${actionText} ${chalk.green(`✓ ${duration}ms`)}`
    );
  }
}

onActionSkipped(action: Action, index: number, reason: string): void {
  const emoji = this.getActionEmoji(action.type);
  const actionText = this.getActionDescription(action);
  console.log(
    `  ${emoji} Action ${index + 1}: ${actionText} ` +
    `${chalk.yellow(`⏭️ Skipped`)} ${chalk.gray(`(${reason})`)}`
  );
}

onComplete(result: RunResult): void {
  console.log('\n' + chalk.bold('═'.repeat(50)));

  if (result.success) {
    console.log(chalk.green.bold('✅ Recording completed successfully!'));
  } else {
    console.log(chalk.red.bold('❌ Recording completed with errors'));
  }

  console.log(chalk.bold('═'.repeat(50)));
  console.log(`⏱️  Duration: ${chalk.cyan(result.duration + 'ms')}`);
  console.log(`✅ Successful: ${chalk.green(result.actions.length)}`);

  if (result.skippedActions && result.skippedActions.length > 0) {
    console.log(`⏭️  Skipped: ${chalk.yellow(result.skippedActions.length)}`);
  }

  if (result.errors.length > 0) {
    console.log(`❌ Failed: ${chalk.red(result.errors.length)}`);
  }

  console.log(chalk.bold('═'.repeat(50)) + '\n');
}

private getActionEmoji(type: string): string {
  const emojiMap: Record<string, string> = {
    click: '👆',
    input: '⌨️',
    scroll: '📜',
    navigation: '🌐',
    select: '📋',
    keypress: '⌨️',
    submit: '📤',
    hover: '🖱️',
    'modal-lifecycle': '🔔', // NEW
  };
  return emojiMap[type] || '•';
}
```

---

## 🧪 TESTING STRATEGY

### Phase 1: Unit Tests

```bash
# Test ElementLocator with multi-strategy selectors
pnpm test packages/core/src/runner/ElementLocator.test.ts

# Test PlaywrightRunner with modal lifecycle
pnpm test packages/core/src/runner/PlaywrightRunner.test.ts

# Test type guards
pnpm test packages/core/src/types/
```

### Phase 2: Integration Tests with test8.json

```bash
# Run test8.json (should work with existing code)
node packages/cli/bin/saveaction.js run test8.json --headless false

# Verify:
# ✅ Multi-strategy selectors used
# ✅ Actions execute successfully
# ✅ No modal lifecycle events yet (test8 is Phase 1 only)
```

### Phase 3: Integration Tests with test9.json (When Ready)

```bash
# Run test9.json (should have modal lifecycle events)
node packages/cli/bin/saveaction.js run test9.json --headless false

# Verify:
# ✅ Modal lifecycle events handled
# ✅ Runner waits for modal open before clicking inside
# ✅ Modal close events trigger state cleanup
# ✅ Actions with requiresModalState wait for modal
```

### Phase 4: Test on Modal-Heavy Sites

```bash
# Run test2.json (mybouquet.co.uk with modal checkout)
node packages/cli/bin/saveaction.js run test2.json --headless false

# Run test3.json (mosquepay.co.uk with modal authentication)
node packages/cli/bin/saveaction.js run test3.json --headless false

# Expected results:
# ✅ Modal close buttons work (no longer hidden)
# ✅ Modal state transitions handled
# ✅ 90%+ pass rate
```

---

## 📦 IMPLEMENTATION ORDER

### Sprint 1: Foundation (Day 1-2)

1. ✅ Update type definitions (Task 5)
2. ✅ Update RunResult interface (Task 6)
3. ✅ Multi-strategy selector fallback (Task 1)

**Deliverable**: Can run test8.json with multi-strategy selectors

---

### Sprint 2: Modal Support (Day 3-4)

4. ✅ Modal lifecycle event handling (Task 2)
5. ✅ Handle `requiresModalState` (Task 3)
6. ✅ Update ConsoleReporter (Task 7)

**Deliverable**: Can run test9.json with modal lifecycle events

---

### Sprint 3: Resilience (Day 5)

7. ✅ Graceful action failure handling (Task 4)
8. ✅ Add `continueOnError` option
9. ✅ Update tests

**Deliverable**: Tests continue past optional action failures

---

## 🎯 SUCCESS CRITERIA

### Minimum Viable (Must Have)

- ✅ test8.json runs with multi-strategy selectors
- ✅ test9.json runs with modal lifecycle events
- ✅ Modal actions wait for modal to be open
- ✅ Optional actions skip without failing test

### Target (Should Have)

- ✅ test2.json passes (mybouquet.co.uk modal checkout)
- ✅ test3.json passes (mosquepay.co.uk modal auth)
- ✅ Content signature fallback works for dynamic lists
- ✅ Reporter shows which selector strategy was used

### Stretch (Nice to Have)

- ✅ Visual element matching (screenshot comparison)
- ✅ Machine learning selector adaptation
- ✅ Automatic retry with different strategies
- ✅ Performance metrics for each selector type

---

## 🚀 GETTING STARTED

Run this command to start implementation:

```bash
# Build current state
pnpm build

# Run tests to ensure baseline
pnpm test

# Start with Task 5 (type definitions)
# Edit: packages/core/src/types/actions.ts
```

---

## 📝 NOTES

**Backward Compatibility**:

- All new fields are optional
- Existing recordings (test2.json, test3.json, test4.json) still work
- New recordings (test8.json, test9.json) use enhanced features
- Old runner can't use new features but doesn't break

**Open Source Considerations**:

- ✅ No external services required
- ✅ Works on any website
- ✅ No website modification needed
- ✅ Self-contained in core package
- ✅ Easy to test and verify

**Performance**:

- Multi-strategy fallback adds ~100-500ms per element (acceptable)
- Modal lifecycle adds ~500ms per modal (necessary)
- Content signature fallback adds ~200-300ms (only when needed)
- Overall impact: +1-2 seconds per recording (negligible)

---

Ready to implement? Start with **Task 5: Update Type Definitions** and work through Sprint 1.
