# Road to Being a Real E2E Platform

> **Created:** March 5, 2026
> **Goal:** Transform SaveAction from a "browser recorder + replayer" into a real E2E test automation platform that QA engineers and developers trust for production testing.

---

## Current State — What We've Built

### Browser Extension (SaveAction Recorder)
- **Tests:** 270 (261 passing, 9 failing — 2 carousel selector priority tests)
- **Action Types:** click, input, select, scroll, keypress, submit, hover, navigation, modal-lifecycle, checkpoint (type defined but never generated)
- **Smart Recording:** Multi-strategy selectors with confidence scores, content signatures for dynamic lists, element state capture (visible, enabled, viewport), modal/dialog detection, AJAX form detection, carousel detection, dropdown state tracking, navigation intent classification
- **Sensitive Data:** Variable masking for passwords (`${PASSWORD}`)
- **Platform Integration:** Upload to API with project selection, auto-upload toggle, connection test

### Core Engine (@saveaction/core)
- **Tests:** 163 unit + 43 integration (browser)
- **Replay:** All 8 action types executed with Playwright
- **Element Location:** 6 selector strategies with exponential backoff retry (500ms → 1000ms → 2000ms)
- **Navigation:** NavigationHistoryManager + NavigationAnalyzer for URL change detection and recovery
- **Screenshots:** `screenshotMode: 'on-failure' | 'always' | 'never'` — captures PNG after each action
- **Video:** Full replay recording via Playwright
- **Timing:** 3 modes (realistic, fast, instant) with speed multiplier
- **Error Recovery:** `continueOnError` mode, abort signal support
- **Cross-Browser:** Chromium, Firefox, WebKit

### CLI (@saveaction/cli)
- **Tests:** 173 (3 skipped)
- **Commands:** run, validate, info, list
- **CI/CD:** CIDetector (8 providers), PlatformClient (fetch recordings by ID or tag), base URL override
- **Output:** Console + JSON (`--output json --output-file results.json`)

### API (@saveaction/api)
- **Tests:** 821+ unit + integration
- **Auth:** JWT + API tokens + account lockout + password reset
- **CRUD:** Recordings, runs, projects, suites, tests, schedules
- **Worker:** BullMQ with 3 workers (test runs, scheduled tests, cleanup)
- **Real-Time:** SSE via Redis pub/sub for live run progress
- **Security:** Helmet, rate limiting, CSRF, Swagger docs
- **Storage:** Local filesystem for videos/screenshots with cleanup jobs

### Web UI (@saveaction/web)
- **Framework:** Next.js 15 + Tailwind CSS + shadcn/ui
- **Pages:** Dashboard, recordings library, run results (with video + screenshot gallery), schedules, settings (profile, tokens, security), projects, suites, tests
- **Features:** Drag-and-drop upload, SSE live progress, lightbox with zoom/pan, keyboard navigation

### Infrastructure
- **CI:** GitHub Actions (lint, typecheck, test, integration)
- **Git Hooks:** Husky (pre-commit, commit-msg, pre-push)
- **Deployment:** Docker Compose (API + Worker + Web + PostgreSQL + Redis + Nginx), self-hosting docs

---

## The Gap — What Makes an E2E Platform "Real"

### The Core Problem

**Today:** A test "passes" if all actions execute without throwing an exception.
**Reality:** The page could show an error message, wrong data, broken layout, or be completely blank — and the test still "passes."

Every real E2E tool (Cypress, Playwright Test, Selenium) has **assertions** — the ability to verify that the page state is correct after each action. Without assertions, test results are meaningless.

---

## Steps to Complete

### Step 1: Implicit Assertions via CheckpointAction ⭐ HIGHEST PRIORITY

**Why:** This is the #1 gap. Makes SaveAction go from "did it crash?" to "did it work?" — with zero extra effort from the user.

**Key Insight:** The `CheckpointAction` type already exists in both the extension and core types:
```typescript
interface CheckpointAction extends BaseAction {
  type: 'checkpoint';
  checkType: 'urlMatch' | 'elementVisible' | 'elementText' | 'pageLoad';
  expectedUrl?: string;
  expectedValue?: string;
  actualValue?: string;
  passed: boolean;
}
```
But **nobody generates them** and **nobody verifies them**.

**What to build:**

| # | Change | Package | Details |
|---|--------|---------|---------|
| 1a | Auto-generate CheckpointActions | Extension (`event-listener.ts`) | After navigation → emit checkpoint with `expectedUrl`. After click on text element → emit checkpoint with `expectedValue = text`. After input → emit checkpoint verifying field value. |
| 1b | Capture `document.title` per action | Extension (`event-listener.ts`) | Add `pageTitle: document.title` to `BaseAction` — enables title assertion |
| 1c | Verify checkpoints during replay | Core (`PlaywrightRunner.ts`) | When encountering a `checkpoint` action, call `page.url()`, `page.title()`, `locator.textContent()` and compare against expected values |
| 1d | Store assertion results | API (`run_actions` table) | Add `assertion_passed`, `assertion_expected`, `assertion_actual` columns |
| 1e | Display assertion results | Web (run detail page) | Show green checkmark / red X per assertion in actions table, show expected vs actual on failure |

**Estimated effort:** 2-3 days
**Lines of code:** ~400 across 4 packages

---

### Step 2: Wire Up Existing Wait Conditions

**Why:** The extension already records `waitConditions` per action (`networkIdle`, `elementVisible`, `elementStable`, `imageLoaded`, `parentVisible`). The runner **completely ignores them** — it uses hardcoded 300ms delays instead.

**What to build:**

| # | Change | Package | Details |
|---|--------|---------|---------|
| 2a | Read `waitConditions` from action | Core (`PlaywrightRunner.ts`) | Before executing each action, check `action.waitConditions` |
| 2b | Implement waiters | Core (`PlaywrightRunner.ts`) | `elementVisible` → `locator.waitFor({ state: 'visible' })`, `networkIdle` → `page.waitForLoadState('networkidle')`, `imageLoaded` → wait for `img.complete`, `elementStable` → poll position until stable |
| 2c | Respect `alternativeSelectors` | Core (`ElementLocator.ts`) | Try `action.alternativeSelectors` array in priority order as fallback |

**Estimated effort:** 1 day
**Lines of code:** ~150

---

### Step 3: Visual Regression Testing (Screenshot Comparison)

**Why:** Catches UI bugs that functional tests miss — CSS breaks, wrong images, layout shifts, invisible buttons.

**How it works:**
1. Run #1 with `screenshotMode: 'always'` → user clicks "Set as Baseline"
2. Run #2 → each action's screenshot compared pixel-by-pixel against baseline using `pixelmatch`
3. Diff images highlight what changed, threshold controls sensitivity

**What to build:**

| # | Change | Package | Details |
|---|--------|---------|---------|
| 3a | Add comparison logic | Core (new `VisualComparator.ts`) | `pixelmatch` + `pngjs` — load baseline PNG, compare with current, produce diff PNG |
| 3b | Add `baselineRunId` to RunOptions | Core (`runner.ts`) | Pass baseline screenshots directory |
| 3c | Add `is_baseline` column | API (`runs` schema) | Mark a run as the baseline for its test |
| 3d | `POST /runs/:id/set-baseline` | API (`runs` routes) | Endpoint to mark a run as baseline |
| 3e | Pass baseline to worker | API (`testRunProcessor.ts`) | Load baseline screenshots and pass to runner |
| 3f | Add `diff_path` + `diff_percent` | API (`run_actions` schema) | Store diff results per action |
| 3g | "Set as Baseline" button | Web (run detail page) | Only for passed runs with screenshots |
| 3h | Diff viewer in lightbox | Web (screenshot gallery) | Baseline / Current / Diff three-way toggle with slider |

**Estimated effort:** 3 days
**Lines of code:** ~600

---

### Step 4: iframe Support

**Why:** Many real apps use iframes (payment forms, embedded widgets, third-party integrations). Tests that can't interact with iframes are incomplete.

**Key Insight:** The extension already captures `frameId`, `frameUrl`, `frameSelector` on every action. The runner ignores them.

**What to build:**

| # | Change | Package | Details |
|---|--------|---------|---------|
| 4a | Detect and switch to iframe | Core (`PlaywrightRunner.ts`) | If `action.frameSelector` exists, use `page.frameLocator(frameSelector)` to get frame context |
| 4b | Execute action inside frame | Core (`PlaywrightRunner.ts`) | Use frame locator for element finding instead of page |
| 4c | Switch back to main frame | Core (`PlaywrightRunner.ts`) | After action in iframe, return to main page context |

**Estimated effort:** 1 day
**Lines of code:** ~100

---

### Step 5: File Upload Recording & Replay

**Why:** File uploads are common in real apps (profile pictures, documents, CSV imports). Can't test them today.

**What to build:**

| # | Change | Package | Details |
|---|--------|---------|---------|
| 5a | Detect `<input type="file">` | Extension (`event-listener.ts`) | Capture file name, size, MIME type (not content) when user selects a file |
| 5b | Define `FileUploadAction` type | Extension + Core (`actions.ts`) | New action type with `fileName`, `fileSize`, `mimeType` |
| 5c | Replay file upload | Core (`PlaywrightRunner.ts`) | Use `page.setInputFiles()` with a test fixture file, or create a dummy file matching the expected size/type |
| 5d | Test file management | API + Web | Allow users to upload test fixture files that the runner uses during replay |

**Estimated effort:** 2 days
**Lines of code:** ~300

---

### Step 6: Test Data / Parameterization

**Why:** Run the same test with different data — different users, different products, different inputs. Essential for data-driven testing.

**Key Insight:** The extension already has `${VARIABLE}` syntax for passwords. Extend this to any field.

**What to build:**

| # | Change | Package | Details |
|---|--------|---------|---------|
| 6a | Generic variable support | Extension (`event-listener.ts`) | Allow users to mark any input as a variable (not just passwords) |
| 6b | Variable resolution at runtime | Core (`PlaywrightRunner.ts`) | Replace `${VAR_NAME}` with values from environment variables or a variables JSON file |
| 6c | Variables UI | Web (test config) | Define variable sets (e.g., "staging-admin", "production-readonly") with key-value pairs |
| 6d | `--variables` CLI option | CLI (`run` command) | `--variables vars.json` or `--var USERNAME=admin` |

**Estimated effort:** 1-2 days
**Lines of code:** ~250

---

### Step 7: Multi-Tab Support

**Why:** Many apps open links in new tabs, or have flows that involve popups (OAuth, payment, file preview).

**What to build:**

| # | Change | Package | Details |
|---|--------|---------|---------|
| 7a | Detect new tab/window | Extension (`event-listener.ts`) | Track `window.open()` calls and `target="_blank"` link clicks |
| 7b | Define `TabAction` type | Extension + Core (`actions.ts`) | `switchTab`, `closeTab`, `newTab` action types |
| 7c | Tab management in runner | Core (`PlaywrightRunner.ts`) | Use `context.waitForEvent('page')` for new tabs, switch between pages in context |

**Estimated effort:** 2 days
**Lines of code:** ~300

---

### Step 8: Drag & Drop Recording

**Why:** Kanban boards, file managers, sortable lists, range sliders — all use drag & drop.

**What to build:**

| # | Change | Package | Details |
|---|--------|---------|---------|
| 8a | Detect drag events | Extension (`event-listener.ts`) | Track `dragstart`, `drag`, `dragend`, `drop` events |
| 8b | Define `DragDropAction` type | Extension + Core (`actions.ts`) | Source selector, target selector, coordinates |
| 8c | Replay drag & drop | Core (`PlaywrightRunner.ts`) | Use `page.dragAndDrop(source, target)` |

**Estimated effort:** 1-2 days
**Lines of code:** ~200

---

### Step 9: Flaky Test Detection & Auto-Retry

**Why:** E2E tests are inherently flaky. A platform must handle this gracefully.

**What to build:**

| # | Change | Package | Details |
|---|--------|---------|---------|
| 9a | Auto-retry on failure | Core (`PlaywrightRunner.ts`) | `retryCount: 2` — re-run the entire test on failure |
| 9b | Flaky test marking | API (`tests` table) | Track pass/fail ratio over last N runs, flag as flaky if ratio < threshold |
| 9c | Flaky badge in UI | Web (test list, run results) | Show "Flaky" badge on tests with inconsistent results |
| 9d | Retry in worker | API (`testRunProcessor.ts`) | On failure, re-queue the job up to N times automatically |

**Estimated effort:** 2 days
**Lines of code:** ~300

---

### Step 10: Webhooks (Already Planned)

**Why:** Notify external systems (Slack, email, PagerDuty) on test failure.

**What to build:**

| # | Change | Package | Details |
|---|--------|---------|---------|
| 10a | Webhook delivery service | API (`WebhookService.ts`) | Send POST with HMAC signature on events |
| 10b | Webhook routes | API (`webhooks.ts` routes) | CRUD for webhook config |
| 10c | Webhook management UI | Web (settings) | Configure webhook URLs, events, secrets |
| 10d | Delivery logs | API + Web | Show delivery history with retry |

**Estimated effort:** 2-3 days (schema already exists)

---

### Step 11: Team / Organization Support

**Why:** Real companies need multiple users sharing projects, tests, and results.

**What to build:**

| # | Change | Package | Details |
|---|--------|---------|---------|
| 11a | Organizations table | API (schema) | `organizations` with owner, plan |
| 11b | Organization membership | API (schema) | `org_members` with roles (owner, admin, member, viewer) |
| 11c | Invite flow | API (routes) + Web | Invite by email, accept/decline |
| 11d | Permission checks | API (middleware) | Check user role before every operation |
| 11e | Org switcher | Web (layout) | Switch between personal and org workspaces |

**Estimated effort:** 5-7 days

---

## Priority Order

| Priority | Step | Impact | Effort | Why First |
|----------|------|--------|--------|-----------|
| **P0** | Step 1: Implicit Assertions | 🔴 Critical | 2-3 days | Without this, tests don't actually verify anything |
| **P0** | Step 2: Wire Up Wait Conditions | 🟠 High | 1 day | Data already captured, just needs wiring |
| **P1** | Step 3: Visual Regression | 🟠 High | 3 days | Screenshots already captured, adds visual verification |
| **P1** | Step 6: Test Data / Parameterization | 🟠 High | 1-2 days | Variable syntax already exists, just extend it |
| **P1** | Step 9: Flaky Test Detection | 🟡 Medium | 2 days | Essential for real-world reliability |
| **P2** | Step 4: iframe Support | 🟡 Medium | 1 day | Types already exist |
| **P2** | Step 5: File Upload | 🟡 Medium | 2 days | Common in real apps |
| **P2** | Step 7: Multi-Tab | 🟡 Medium | 2 days | OAuth, payment flows need this |
| **P2** | Step 10: Webhooks | 🟡 Medium | 2-3 days | Schema already exists |
| **P3** | Step 8: Drag & Drop | 🟢 Low | 1-2 days | Niche but important for some apps |
| **P3** | Step 11: Team Support | 🟢 Low | 5-7 days | Needed for enterprise but not for platform correctness |

**Total estimated effort:** ~22-32 days for all steps

---

## How to Work Through This

1. Pick a step from the priority list
2. Create a branch: `feat/<step-name>` (e.g., `feat/implicit-assertions`)
3. Implement across all affected packages (extension, core, API, web)
4. Write tests for each change
5. Update this file — mark the step as ✅ DONE with completion date
6. Move to the next step

---

## Progress Tracker

| Step | Status | Branch | Date |
|------|--------|--------|------|
| Step 1: Implicit Assertions | ⏳ TODO | — | — |
| Step 2: Wire Up Wait Conditions | ⏳ TODO | — | — |
| Step 3: Visual Regression | ⏳ TODO | — | — |
| Step 4: iframe Support | ⏳ TODO | — | — |
| Step 5: File Upload | ⏳ TODO | — | — |
| Step 6: Test Data / Parameterization | ⏳ TODO | — | — |
| Step 7: Multi-Tab Support | ⏳ TODO | — | — |
| Step 8: Drag & Drop | ⏳ TODO | — | — |
| Step 9: Flaky Test Detection | ⏳ TODO | — | — |
| Step 10: Webhooks | ⏳ TODO | — | — |
| Step 11: Team Support | ⏳ TODO | — | — |
