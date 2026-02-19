# SaveAction: Project-Centric UI/UX Architecture

> **Status:** Planning  
> **Created:** February 16, 2026  
> **Last Updated:** February 16, 2026  
> **Goal:** Implement GitHub/Google Analytics-style container pattern with Test Suites hierarchy

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Industry Analysis](#2-industry-analysis)
3. [Entity Model & Hierarchy](#3-entity-model--hierarchy)
4. [Chrome Extension Integration](#4-chrome-extension-integration)
5. [CLI Behavior](#5-cli-behavior)
6. [Recording Library](#6-recording-library)
7. [URL Structure](#7-url-structure)
8. [Database Schema](#8-database-schema)
9. [Navigation Design](#9-navigation-design)
10. [Key User Flows](#10-key-user-flows)
11. [Component Architecture](#11-component-architecture)
12. [API Endpoints](#12-api-endpoints)
13. [Implementation Plan](#13-implementation-plan)
14. [Migration Strategy](#14-migration-strategy)
15. [Success Criteria](#15-success-criteria)

---

## 1. Problem Statement

### 1.1 Current Implementation Issues

**Issue 1: Filter/Dropdown Pattern (Wrong Mental Model)**

```
┌─────────────────────────────────────────────────────────┐
│ SaveAction              [Project: My Tests ▼]    [User]│
├───────────────────┬─────────────────────────────────────┤
│ Dashboard         │                                     │
│ Recordings        │  Recordings filtered by dropdown    │
│ Runs              │                                     │
│ Schedules         │                                     │
│ Settings          │                                     │
└───────────────────┴─────────────────────────────────────┘
URL: /recordings (same URL regardless of project)
```

**Issue 2: No Test Organization (Flat Structure)**

```
Current: Recordings are flat list, no logical grouping
- checkout_flow.json
- login_test.json  
- user_registration.json
- add_to_cart.json
- payment_process.json

Problem: 50+ recordings = Unmanageable chaos
```

**Issue 3: Reconfigure Every Run (Tedious)**

```
Every time user wants to run a test:
1. Select recording
2. Choose browser → Chrome
3. Toggle headless → off
4. Enable video → on
5. Set timeout → 30000
6. Click Run

Next run of SAME test:
1. Select same recording
2. Choose browser → Chrome   ← Repeat same steps!
3. Toggle headless → off     ← Why?!
4. Enable video → on
5. Set timeout → 30000
6. Click Run
```

**Issue 4: No Multi-Browser Testing**

```
User wants to test on Chrome + Firefox + Safari:
- Run test on Chrome → wait → get results
- Run SAME test on Firefox → wait → get results  
- Run SAME test on Safari → wait → get results
- Manually compare results across 3 tabs

No matrix view, no combined run.
```

### 1.2 Target Implementation (Enterprise-Grade)

**Hierarchy: Projects → Test Suites → Tests**

```
┌─────────────────────────────────────────────────────────┐
│ SaveAction    E-commerce Tests              [User Menu]│
├───────────────────┬─────────────────────────────────────┤
│ 📊 Overview       │                                     │
│                   │  Test Suite: Checkout Flow          │
│ 📁 Test Suites    │  ─────────────────────────────────  │
│   └ Checkout Flow │                                     │
│   └ User Auth     │  Tests:                             │
│   └ Product Search│  ┌─────────────────────────────┐    │
│                   │  │ Add to Cart Test            │    │
│ 📅 Schedules      │  │ Chrome ✅ Firefox ✅ Safari ✅│   │
│ 📜 Run History    │  │ Last run: 2 min ago         │    │
│ ⚙️ Settings       │  │             [▶ Run] [⚙️]    │    │
│                   │  └─────────────────────────────┘    │
│                   │  ┌─────────────────────────────┐    │
│ 📁 All Projects   │  │ Payment Process Test        │    │
│                   │  │ Chrome ✅ Firefox ❌ Safari ✅│   │
│                   │  │ Last run: 15 min ago        │    │
│                   │  │             [▶ Run] [⚙️]    │    │
│                   │  └─────────────────────────────┘    │
└───────────────────┴─────────────────────────────────────┘
URL: /projects/abc123/suites/xyz789/tests
```

**Benefits:**
- URLs unique per project, suite, test
- One-click runs (config is saved)
- Multi-browser matrix with combined results
- Logical grouping via Test Suites
- Professional, enterprise-ready UX

---

## 2. Industry Analysis

### 2.1 How Top Testing/QA Products Handle This

| Product | Hierarchy | URL Pattern | Key Feature |
|---------|-----------|-------------|-------------|
| **Playwright Test** | Project → File → Test | N/A (CLI) | `projects: [{name: 'Chrome'}, {name: 'Firefox'}]` |
| **Cypress Cloud** | Project → Spec → Test | `cloud.cypress.io/projects/{id}/runs` | Parallelization, Flake detection |
| **TestRail** | Project → Suite → Case | `testrail.io/index.php?/suites/{id}` | Test case management |
| **BrowserStack** | App → Suite → Test | `app.browserstack.com/projects/{id}` | Device/Browser matrix |
| **Sauce Labs** | Team → Project → Test | `app.saucelabs.com/tests` | Cross-browser matrix |
| **qTest** | Project → Module → Test Case | `qtest.com/modules/{id}` | Requirements traceability |
| **Xray (Jira)** | Project → Test Plan → Test | Jira URLs | Jira integration |

### 2.2 Testing Matrix Pattern (Industry Standard)

All serious testing platforms show results in a **matrix view**:

```
┌─────────────────────────────────────────────────────────────┐
│ Test Suite: Checkout Flow              Run #156 Results     │
├─────────────────────────────────────────────────────────────┤
│                    │ Chrome │ Firefox │ Safari │ Edge      │
│ ───────────────────┼────────┼─────────┼────────┼────────── │
│ Add to Cart        │   ✅   │    ✅   │   ✅   │    ✅     │
│ Apply Coupon       │   ✅   │    ❌   │   ✅   │    ✅     │
│ Payment (Card)     │   ✅   │    ✅   │   ❌   │    ✅     │
│ Payment (PayPal)   │   ✅   │    ✅   │   ✅   │    ✅     │
│ Order Confirmation │   ✅   │    ✅   │   ✅   │    ✅     │
│ ───────────────────┼────────┼─────────┼────────┼────────── │
│ Suite Pass Rate    │  100%  │   80%   │   80%  │   100%    │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 SaveAction Target Model

```
GitHub Model:           SaveAction Model:
──────────────          ─────────────────
Organization      →     (Future: Team)
Repository        →     Project
Folder/Directory  →     Test Suite  
Test File         →     Test (= Recording + Config)
Test Case         →     (Actions within recording)
```

---

## 3. Entity Model & Hierarchy

### 3.1 Hierarchy Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                              USER                                   │
│                               │                                     │
│            ┌──────────────────┼──────────────────┐                 │
│            ▼                  ▼                  ▼                 │
│      ┌──────────┐      ┌──────────┐      ┌──────────┐             │
│      │ Project  │      │ Project  │      │ Project  │             │
│      │ E-comm   │      │ Mobile   │      │ Admin    │             │
│      └────┬─────┘      └──────────┘      └──────────┘             │
│           │                                                        │
│     ┌─────┴──────┬─────────────┐                                  │
│     ▼            ▼             ▼                                  │
│ ┌────────┐  ┌────────┐   ┌────────┐                              │
│ │ Suite  │  │ Suite  │   │ Suite  │                              │
│ │Checkout│  │Auth    │   │Search  │                              │
│ └───┬────┘  └────────┘   └────────┘                              │
│     │                                                              │
│   ┌─┴────────────────┬─────────────────┐                          │
│   ▼                  ▼                 ▼                          │
│ ┌──────┐          ┌──────┐          ┌──────┐                     │
│ │ Test │          │ Test │          │ Test │                     │
│ │Add to│          │Apply │          │Check │                     │
│ │ Cart │          │Coupon│          │ out  │                     │
│ └──┬───┘          └──────┘          └──────┘                     │
│    │                                                               │
│    ├── Recording Data (JSON)                                       │
│    ├── Browsers: [Chrome, Firefox, Safari]                         │
│    ├── Config: { headless: true, video: true, timeout: 30000 }    │
│    └── Schedules: [Every 6 hours]                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Entity Definitions

#### Project
```typescript
interface Project {
  id: string;           // proj_abc123
  name: string;         // "E-commerce Tests"
  description?: string;
  color?: string;       // For UI identification
  userId: string;       // Owner
  createdAt: Date;
  updatedAt: Date;
}
```

#### Test Suite
```typescript
interface TestSuite {
  id: string;           // suite_xyz789
  name: string;         // "Checkout Flow"
  description?: string;
  projectId: string;    // Parent project
  order: number;        // Display order in sidebar
  createdAt: Date;
  updatedAt: Date;
}
```

#### Test (Recording + Config + Browsers)
```typescript
interface Test {
  id: string;           // test_def456
  slug: string;         // add-to-cart-test (unique within project)
  name: string;         // "Add to Cart Test"
  description?: string;
  suiteId: string;      // Parent suite
  projectId: string;    // Denormalized for queries
  
  // Recording data (embedded or reference)
  recordingData: Recording;  // Full JSON recording
  // OR recordingId for separate storage:
  // recordingId: string;
  
  // Saved configuration
  browsers: Browser[];  // ['chromium', 'firefox', 'webkit']
  config: TestConfig;   // Saved run configuration
  
  // Metadata
  order: number;        // Display order in suite
  createdAt: Date;
  updatedAt: Date;
}

interface TestConfig {
  headless: boolean;
  video: boolean;
  screenshot: 'on' | 'off' | 'only-on-failure';
  timeout: number;      // ms
  retries: number;
  slowMo: number;       // ms delay between actions
  viewport?: { width: number; height: number };
}

type Browser = 'chromium' | 'firefox' | 'webkit';
```

#### Run (Execution Instance)
```typescript
interface Run {
  id: string;           // run_ghi789
  projectId: string;
  
  // What was run
  testId?: string;      // Single test run
  suiteId?: string;     // Suite run (all tests in suite)
  
  // Results per browser
  results: BrowserResult[];
  
  // Aggregate status
  status: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled';
  
  // Timing
  startedAt: Date;
  completedAt?: Date;
  duration?: number;    // ms
  
  // Trigger
  triggeredBy: 'manual' | 'schedule' | 'api';
  scheduleId?: string;
  
  createdAt: Date;
}

interface BrowserResult {
  browser: Browser;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  duration?: number;
  error?: string;
  screenshotUrl?: string;
  videoUrl?: string;
  actionResults: ActionResult[];
}
```

#### Schedule
```typescript
interface Schedule {
  id: string;           // sched_jkl012
  name: string;
  projectId: string;
  
  // What to run
  targetType: 'test' | 'suite' | 'project';
  targetId: string;     // testId, suiteId, or projectId
  
  // When to run
  cronExpression: string;
  timezone: string;
  
  // Override config (optional)
  overrideConfig?: Partial<TestConfig>;
  overrideBrowsers?: Browser[];
  
  // State
  enabled: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}
```

### 3.3 Comparison: Old vs New Model

| Aspect | Old Model | New Model |
|--------|-----------|-----------|
| **Organization** | Flat recordings list | Projects → Suites → Tests |
| **Recording + Config** | Separate entities | Test = Recording + Config |
| **Browser Selection** | Every run | Saved per test |
| **Configuration** | Every run | Saved per test |
| **Run Scope** | Single recording | Test, Suite, or Project |
| **Results View** | Per-run | Matrix (Test × Browser) |
| **Scheduling** | Per recording | Per Test, Suite, or Project |
| **Mental Model** | "Run this recording" | "Run this test on these browsers" |

---

## 4. Chrome Extension Integration

### 4.1 Extension Setup Flow

```
First Time Setup:
┌─────────────────────────────────────────────┐
│ SaveAction Extension Setup             [✕] │
├─────────────────────────────────────────────┤
│                                             │
│ Connect to your SaveAction account:         │
│                                             │
│ API Key: [_____________________________]    │
│          (Get from app.saveaction.io/settings)
│                                             │
│ [Verify Connection]                         │
│                                             │
│ ─────────────────────────────────────────── │
│                                             │
│ Or skip for now:                            │
│ [Skip - Just Download Recordings]           │
│                                             │
└─────────────────────────────────────────────┘
```

### 4.2 After Recording - Save Options

```
Recording Complete!
┌─────────────────────────────────────────────┐
│ Recording: "checkout_flow" (12 actions)     │
├─────────────────────────────────────────────┤
│                                             │
│ What would you like to do?                  │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ 📥 Save to Library                      │ │ ← Default (if connected)
│ │    Upload to SaveAction for later use   │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ 🔄 Update Existing Test                 │ │ ← Re-record a test
│ │    Replace recording in an existing test│ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ 💾 Download JSON                        │ │ ← Offline / no account
│ │    Save file locally                    │ │
│ └─────────────────────────────────────────┘ │
│                                             │
└─────────────────────────────────────────────┘
```

### 4.3 "Save to Library" Flow

```
User clicks [Save to Library]:

1. Recording uploads to /api/v1/recordings with projectId (optional)
2. Stored in Recording Library (inbox)
3. User goes to platform to create Test from Recording
```

### 4.4 "Update Existing Test" Flow

```
User clicks [Update Existing Test]:
┌─────────────────────────────────────────────┐
│ Select Test to Update                  [✕] │
├─────────────────────────────────────────────┤
│                                             │
│ Project: [E-commerce Tests ▼]               │
│                                             │
│ Suite: [Checkout Flow ▼]                    │
│                                             │
│ Test: [Add to Cart Test ▼]                  │
│                                             │
│ ⚠️ This will replace the recording data    │
│    in "Add to Cart Test". Config and        │
│    browsers will remain unchanged.          │
│                                             │
│           [Cancel]  [Update Test]           │
└─────────────────────────────────────────────┘

1. User selects project → suite → test
2. Recording data replaces existing test's recordingData
3. Test config/browsers preserved
4. User notified of success
```

### 4.5 Extension API Endpoints

```
# For extension authentication
POST /api/v1/extension/verify
  Headers: X-API-Key: {user_api_key}
  Response: { success: true, user: {...}, projects: [...] }

# Save to library (inbox)
POST /api/v1/recordings
  Headers: X-API-Key: {user_api_key}
  Body: { projectId?: string, recordingData: {...} }

# Update existing test
PUT /api/v1/tests/{testId}/recording
  Headers: X-API-Key: {user_api_key}
  Body: { recordingData: {...} }

# Get projects/suites/tests for dropdown
GET /api/v1/projects?includeStats=false
GET /api/v1/suites?projectId={id}
GET /api/v1/tests?suiteId={id}
```

---

## 5. CLI Behavior

### 5.1 Test Identification

Tests can be identified by:
1. **Slug** (human-readable) - auto-generated from name, unique within project
2. **ID** (machine) - `test_01HQXYZ...`

```typescript
interface Test {
  id: string;           // test_01HQXYZ (ULID)
  slug: string;         // add-to-cart-test (auto from name)
  name: string;         // "Add to Cart Test"
  // ...
}
```

**Slug generation rules:**
- Lowercase
- Spaces → hyphens
- Remove special characters
- Unique within project (append `-2`, `-3` if needed)

### 5.2 CLI Commands

```bash
# Run single test by slug (within project context)
saveaction run add-to-cart-test --project ecommerce

# Run single test by ID (precise)
saveaction run test_01HQXYZ

# Run entire suite
saveaction run --suite checkout-flow --project ecommerce

# Run all tests in project
saveaction run --project ecommerce

# Run with override (one-time)
saveaction run add-to-cart-test --project ecommerce --browser firefox --headless false

# List tests in project
saveaction list --project ecommerce

# List suites
saveaction list --project ecommerce --suites

# Show test details
saveaction info add-to-cart-test --project ecommerce
```

### 5.3 CLI Output

```bash
$ saveaction run add-to-cart-test --project ecommerce

SaveAction v2.0.0

Project: E-commerce Tests
Suite:   Checkout Flow  
Test:    Add to Cart Test

Running on browsers: chromium, firefox, webkit

chromium ████████████████████ 100% (1.2s) ✓ passed
firefox  ████████████████████ 100% (1.4s) ✓ passed
webkit   ████████████████████ 100% (1.3s) ✓ passed

Results: 3/3 passed (100%)
Duration: 1.4s (parallel)

Run ID: run_01HQABC
View: https://app.saveaction.io/projects/ecommerce/runs/run_01HQABC
```

### 5.4 CI/CD Integration

```yaml
# GitHub Actions example
- name: Run E2E Tests
  run: |
    npx saveaction run --project ecommerce --suite checkout-flow
  env:
    SAVEACTION_API_KEY: ${{ secrets.SAVEACTION_API_KEY }}
```

---

## 6. Recording Library

### 6.1 Concept

The Recording Library is an **inbox** for recordings before they become tests.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Recording Library                             │
│                        (Inbox for new recordings)                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  These recordings are waiting to be added to tests:                  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ 📄 checkout_v2.json                                        │     │
│  │    Uploaded: 5 min ago • 12 actions                        │     │
│  │    Starting URL: https://shop.example.com/cart             │     │
│  │                                                            │     │
│  │    [Create Test]  [Download]  [Delete]                     │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ 📄 login_flow.json                                         │     │
│  │    Uploaded: 2 hours ago • 8 actions                       │     │
│  │    Starting URL: https://shop.example.com/login            │     │
│  │                                                            │     │
│  │    [Create Test]  [Download]  [Delete]                     │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 "Create Test" Flow

```
User clicks [Create Test] on a recording:
┌─────────────────────────────────────────────┐
│ Create Test from Recording             [✕] │
├─────────────────────────────────────────────┤
│                                             │
│ Recording: checkout_v2.json                 │
│ 12 actions • Starting: shop.example.com     │
│                                             │
│ ─────────────────────────────────────────── │
│                                             │
│ Test Name: [Checkout Flow Test_______]      │
│                                             │
│ Project: [E-commerce Tests ▼]               │
│                                             │
│ Suite: [Checkout Flow ▼] [+ New Suite]      │
│                                             │
│ ─────────────────────────────────────────── │
│                                             │
│ Browsers to test:                           │
│ ☑ Chrome  ☑ Firefox  ☐ Safari              │
│                                             │
│ Configuration:                              │
│ Headless: ◉ Yes  ○ No                      │
│ Video:    ○ Yes  ◉ No                      │
│ Timeout:  [30000]ms                         │
│                                             │
│ ─────────────────────────────────────────── │
│                                             │
│ ☐ Delete recording from library after      │
│   creating test                             │
│                                             │
│           [Cancel]  [Create Test]           │
└─────────────────────────────────────────────┘

Result: Recording data is COPIED into new test
```

### 6.3 Copy, Not Share

**Decision:** Recording data is **copied** into tests, not referenced.

```
Recording Library                    Tests
┌──────────────────┐                ┌──────────────────┐
│ checkout_v2.json │──(copy)──────▶ │ Test: Checkout   │
│   12 actions     │                │ recordingData:   │
│                  │                │   { ...copy... } │
└──────────────────┘                └──────────────────┘
        │
        │ Can delete from library
        │ Test still works!
        ▼
     [Deleted]
```

**Why copy, not reference:**
- Tests are self-contained
- Can delete from library without breaking tests
- Edit one test doesn't affect others
- Simple JSONB storage
- No foreign key complexity

### 6.4 Recording Library Table

The existing `recordings` table stays and becomes the library:

```sql
-- recordings table = Recording Library (inbox)
CREATE TABLE recordings (
    id VARCHAR(26) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    project_id VARCHAR(26) REFERENCES projects(id), -- Optional
    user_id VARCHAR(26) NOT NULL REFERENCES users(id),
    recording_data JSONB NOT NULL,
    source VARCHAR(20) DEFAULT 'extension', -- 'extension' | 'upload' | 'api'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- Note: No changes needed! recordings table already exists.
-- Tests table will have its own copy of recording_data.
```

### 6.5 Library Access

```
URL: /projects/{projectId}/library
     or
     /library (global - all projects)

API:
GET /api/v1/recordings?projectId={id}  # Project-specific
GET /api/v1/recordings                  # All user's recordings
```

---

## 7. URL Structure

### 7.1 Route Definitions

| Route | Purpose | Access |
|-------|---------|--------|
| `/` | Marketing/Landing | Public |
| `/login`, `/register` | Authentication | Public |
| **Global** | | |
| `/projects` | Project list (HOME) | Auth |
| `/settings` | User account settings | Auth |
| **Project-Scoped** | | |
| `/projects/{projectId}` | Project overview | Auth + project |
| `/projects/{projectId}/suites` | All suites list | Auth + project |
| `/projects/{projectId}/suites/new` | Create new suite | Auth + project |
| `/projects/{projectId}/suites/{suiteId}` | Suite detail + tests | Auth + project |
| `/projects/{projectId}/suites/{suiteId}/tests/new` | Create test (upload recording) | Auth + project |
| `/projects/{projectId}/suites/{suiteId}/tests/{testId}` | Test detail | Auth + project |
| `/projects/{projectId}/suites/{suiteId}/tests/{testId}/edit` | Edit test config | Auth + project |
| `/projects/{projectId}/runs` | All runs (history) | Auth + project |
| `/projects/{projectId}/runs/{runId}` | Run detail + matrix | Auth + project |
| `/projects/{projectId}/schedules` | All schedules | Auth + project |
| `/projects/{projectId}/schedules/{scheduleId}` | Schedule detail | Auth + project |
| `/projects/{projectId}/settings` | Project settings | Auth + admin |
| **Recording Library** | | |
| `/projects/{projectId}/library` | Recording inbox | Auth + project |
| `/projects/{projectId}/library/{recordingId}` | Recording detail/create test | Auth + project |

### 7.2 File System Structure (Next.js App Router)

```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── register/page.tsx
├── (global)/
│   ├── layout.tsx
│   ├── projects/
│   │   └── page.tsx                    # /projects
│   └── settings/
│       └── page.tsx                    # /settings
└── (project)/projects/[projectId]/
    ├── layout.tsx                      # Project layout with sidebar
    ├── page.tsx                        # /projects/{id} (overview)
    ├── suites/
    │   ├── page.tsx                    # /projects/{id}/suites
    │   ├── new/page.tsx                # /projects/{id}/suites/new
    │   └── [suiteId]/
    │       ├── page.tsx                # /projects/{id}/suites/{suiteId}
    │       └── tests/
    │           ├── new/page.tsx        # Upload recording as new test
    │           └── [testId]/
    │               ├── page.tsx        # Test detail
    │               └── edit/page.tsx   # Edit test config
    ├── runs/
    │   ├── page.tsx                    # /projects/{id}/runs
    │   └── [runId]/page.tsx            # /projects/{id}/runs/{runId}
    ├── schedules/
    │   ├── page.tsx                    # /projects/{id}/schedules
    │   └── [scheduleId]/page.tsx       # Schedule detail
    ├── library/
    │   ├── page.tsx                    # /projects/{id}/library (recording inbox)
    │   └── [recordingId]/page.tsx      # Recording detail / create test
    └── settings/
        └── page.tsx                    # /projects/{id}/settings
```

---

## 8. Database Schema

### 8.1 New Tables

```sql
-- Test Suites table
CREATE TABLE test_suites (
    id VARCHAR(26) PRIMARY KEY,         -- ULID format: suite_xxx
    name VARCHAR(255) NOT NULL,
    description TEXT,
    project_id VARCHAR(26) NOT NULL REFERENCES projects(id),
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP                -- Soft delete
);

CREATE INDEX idx_suites_project ON test_suites(project_id) WHERE deleted_at IS NULL;

-- Tests table (Recording + Config + Browsers)
CREATE TABLE tests (
    id VARCHAR(26) PRIMARY KEY,         -- ULID format: test_xxx
    slug VARCHAR(255) NOT NULL,         -- URL-friendly unique identifier within project
    name VARCHAR(255) NOT NULL,
    description TEXT,
    suite_id VARCHAR(26) NOT NULL REFERENCES test_suites(id),
    project_id VARCHAR(26) NOT NULL REFERENCES projects(id),
    
    -- Recording data (JSONB for flexibility)
    recording_data JSONB NOT NULL,
    
    -- Browser configuration
    browsers TEXT[] NOT NULL DEFAULT ARRAY['chromium'],
    
    -- Test configuration (JSONB)
    config JSONB NOT NULL DEFAULT '{
        "headless": true,
        "video": false,
        "screenshot": "only-on-failure",
        "timeout": 30000,
        "retries": 0,
        "slowMo": 0
    }',
    
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    
    UNIQUE(project_id, slug)            -- Slug unique within project
);

CREATE INDEX idx_tests_suite ON tests(suite_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tests_project ON tests(project_id) WHERE deleted_at IS NULL;

-- Runs table (updated)
CREATE TABLE runs (
    id VARCHAR(26) PRIMARY KEY,
    project_id VARCHAR(26) NOT NULL REFERENCES projects(id),
    
    -- What was run (one of these will be set)
    test_id VARCHAR(26) REFERENCES tests(id),
    suite_id VARCHAR(26) REFERENCES test_suites(id),
    
    -- Overall status
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    
    -- Timing
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms INTEGER,
    
    -- Trigger info
    triggered_by VARCHAR(20) NOT NULL DEFAULT 'manual',
    schedule_id VARCHAR(26) REFERENCES schedules(id),
    
    -- Config snapshot (what was used for this run)
    config_snapshot JSONB,
    browsers_snapshot TEXT[],
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_runs_project ON runs(project_id);
CREATE INDEX idx_runs_test ON runs(test_id);
CREATE INDEX idx_runs_suite ON runs(suite_id);
CREATE INDEX idx_runs_status ON runs(status);

-- Run results per browser
CREATE TABLE run_browser_results (
    id VARCHAR(26) PRIMARY KEY,
    run_id VARCHAR(26) NOT NULL REFERENCES runs(id),
    test_id VARCHAR(26) NOT NULL REFERENCES tests(id),
    browser VARCHAR(20) NOT NULL,       -- 'chromium' | 'firefox' | 'webkit'
    
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    duration_ms INTEGER,
    error TEXT,
    
    -- Artifacts
    screenshot_url TEXT,
    video_url TEXT,
    
    -- Per-action results (JSONB array)
    action_results JSONB,
    
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX idx_browser_results_run ON run_browser_results(run_id);
CREATE INDEX idx_browser_results_test ON run_browser_results(test_id);

-- Schedules table (updated)
CREATE TABLE schedules (
    id VARCHAR(26) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    project_id VARCHAR(26) NOT NULL REFERENCES projects(id),
    
    -- Target (what to run)
    target_type VARCHAR(20) NOT NULL,   -- 'test' | 'suite' | 'project'
    target_id VARCHAR(26) NOT NULL,     -- test_id, suite_id, or project_id
    
    -- Cron settings
    cron_expression VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Optional overrides
    override_config JSONB,
    override_browsers TEXT[],
    
    -- State
    enabled BOOLEAN DEFAULT true,
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_schedules_project ON schedules(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_schedules_next_run ON schedules(next_run_at) WHERE enabled = true;
```

### 8.2 Drizzle Schema (TypeScript)

```typescript
// packages/api/src/db/schema/testSuites.ts
import { pgTable, varchar, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';

export const testSuites = pgTable('test_suites', {
  id: varchar('id', { length: 26 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  projectId: varchar('project_id', { length: 26 })
    .notNull()
    .references(() => projects.id),
  displayOrder: integer('display_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// packages/api/src/db/schema/tests.ts
import { pgTable, varchar, text, timestamp, integer, jsonb, unique } from 'drizzle-orm/pg-core';
import { testSuites } from './testSuites.js';
import { projects } from './projects.js';

export const tests = pgTable('tests', {
  id: varchar('id', { length: 26 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull(),  // URL-friendly, unique within project
  description: text('description'),
  suiteId: varchar('suite_id', { length: 26 })
    .notNull()
    .references(() => testSuites.id),
  projectId: varchar('project_id', { length: 26 })
    .notNull()
    .references(() => projects.id),
  
  recordingData: jsonb('recording_data').notNull(),
  browsers: text('browsers').array().notNull().default(['chromium']),
  config: jsonb('config').notNull().default({
    headless: true,
    video: false,
    screenshot: 'only-on-failure',
    timeout: 30000,
    retries: 0,
    slowMo: 0,
  }),
  
  displayOrder: integer('display_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  slugUnique: unique().on(table.projectId, table.slug),
}));
```

### 8.3 Migration from Old Schema

```sql
-- Migration: Convert recordings to tests format
-- Run this during Phase 2 of implementation

-- 1. Create "Default Suite" for each project
INSERT INTO test_suites (id, name, project_id, display_order)
SELECT 
    'suite_' || gen_random_uuid()::text,
    'Default Suite',
    id,
    0
FROM projects;

-- 2. Convert recordings to tests
INSERT INTO tests (id, name, suite_id, project_id, recording_data, browsers, config)
SELECT 
    REPLACE(r.id, 'rec_', 'test_'),
    r.name,
    (SELECT id FROM test_suites WHERE project_id = r.project_id LIMIT 1),
    r.project_id,
    r.recording_data,
    ARRAY['chromium'],
    '{"headless": true, "video": false, "screenshot": "only-on-failure", "timeout": 30000}'
FROM recordings r
WHERE r.deleted_at IS NULL;

-- 3. Update existing runs to reference tests
ALTER TABLE runs ADD COLUMN test_id VARCHAR(26);
UPDATE runs SET test_id = REPLACE(recording_id, 'rec_', 'test_')
WHERE recording_id IS NOT NULL;
```

---

## 9. Navigation Design

### 9.1 Global Header

```
┌─────────────────────────────────────────────────────────────────────┐
│ [≡] SaveAction    │ E-commerce Tests ▼ │           🔍  🔔  [👤 JD]│
│                   │ (Project Switcher) │                           │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.2 Project Sidebar

```
┌────────────────────────┐
│                        │
│  E-commerce Tests      │  ← Project Name (bold)
│  3 suites • 12 tests   │  ← Quick stats
│                        │
│  ────────────────────  │
│                        │
│  📊 Overview           │  ← /projects/{id}
│                        │
│  📁 TEST SUITES        │  ← Section header
│     ▶ Checkout Flow (4)│  ← Expandable
│       ├ Add to Cart    │
│       ├ Apply Coupon   │
│       ├ Payment Card   │
│       └ Confirmation   │
│     ▷ User Auth (3)    │  ← Collapsed
│     ▷ Product Search(5)│
│     [+ New Suite]      │
│                        │
│  ────────────────────  │
│                        │
│  📜 Run History   (42) │  ← /projects/{id}/runs
│  📅 Schedules     (3)  │  ← /projects/{id}/schedules
│                        │
│  ────────────────────  │
│                        │
│  ⚙️ Project Settings   │  ← /projects/{id}/settings
│                        │
│  ────────────────────  │
│                        │
│  📁 All Projects       │  ← /projects
│                        │
└────────────────────────┘
```

### 9.3 Projects List Page (/projects)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Your Projects                                    [+ New Project]    │
│ Select a project to manage your test suites                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  🔍 Search projects...                                              │
│                                                                     │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐  │
│  │ 🟣 E-commerce Tests         │  │ 🔵 Mobile App               │  │
│  │                             │  │                             │  │
│  │    3 suites • 12 tests      │  │    2 suites • 8 tests       │  │
│  │    156 runs • 95% pass      │  │    42 runs • 87% pass       │  │
│  │    3 schedules active       │  │    1 schedule active        │  │
│  │                             │  │                             │  │
│  │    ✅ Chrome  ✅ Firefox    │  │    ✅ Chrome  ❌ Safari      │  │
│  │    Last run: 2 hours ago    │  │    Last run: 1 day ago      │  │
│  │                        [→]  │  │                        [→]  │  │
│  └─────────────────────────────┘  └─────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.4 Test Suite Page (/projects/{id}/suites/{suiteId})

```
┌─────────────────────────────────────────────────────────────────────┐
│ ← Back to Suites     Checkout Flow                [▶ Run Suite]    │
│                      4 tests in this suite                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Tests                                         [+ Add Test]  │   │
│  │                                                             │   │
│  │  ┌───────────────────────────────────────────────────────┐ │   │
│  │  │ 🧪 Add to Cart Test                                   │ │   │
│  │  │    Browsers: Chrome ✅ Firefox ✅ Safari ✅           │ │   │
│  │  │    Last run: 2 min ago • passed                       │ │   │
│  │  │                            [▶ Run]  [⚙️ Edit]  [📋]  │ │   │
│  │  └───────────────────────────────────────────────────────┘ │   │
│  │                                                             │   │
│  │  ┌───────────────────────────────────────────────────────┐ │   │
│  │  │ 🧪 Apply Coupon Test                                  │ │   │
│  │  │    Browsers: Chrome ✅ Firefox ❌ Safari ✅           │ │   │
│  │  │    Last run: 15 min ago • 1 failed                    │ │   │
│  │  │                            [▶ Run]  [⚙️ Edit]  [📋]  │ │   │
│  │  └───────────────────────────────────────────────────────┘ │   │
│  │                                                             │   │
│  │  ┌───────────────────────────────────────────────────────┐ │   │
│  │  │ 🧪 Payment Card Test                                  │ │   │
│  │  │    Browsers: Chrome ✅                                │ │   │
│  │  │    Last run: 1 hour ago • passed                      │ │   │
│  │  │                            [▶ Run]  [⚙️ Edit]  [📋]  │ │   │
│  │  └───────────────────────────────────────────────────────┘ │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.5 Test Detail Page (/projects/{id}/suites/{suiteId}/tests/{testId})

```
┌─────────────────────────────────────────────────────────────────────┐
│ ← Checkout Flow    Add to Cart Test         [▶ Run Now]  [⚙️ Edit]│
│                    Last run: 2 min ago • passed                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────┐  ┌─────────────────────────────────┐  │
│  │ Configuration           │  │ Browsers                        │  │
│  │                         │  │                                 │  │
│  │ Headless: Yes           │  │ ☑ Chrome                        │  │
│  │ Video: Yes              │  │ ☑ Firefox                       │  │
│  │ Screenshot: On failure  │  │ ☑ Safari                        │  │
│  │ Timeout: 30s            │  │                                 │  │
│  │ Retries: 0              │  │                                 │  │
│  └─────────────────────────┘  └─────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Recent Runs                                   [View All →]  │   │
│  │                                                             │   │
│  │  Run #156 • 2 min ago                                       │   │
│  │  ┌──────────┬──────────┬──────────┐                        │   │
│  │  │ Chrome   │ Firefox  │ Safari   │                        │   │
│  │  │   ✅     │    ✅    │    ✅    │                        │   │
│  │  │  1.2s    │   1.4s   │   1.3s   │                        │   │
│  │  └──────────┴──────────┴──────────┘                        │   │
│  │                                                             │   │
│  │  Run #155 • 1 hour ago                                      │   │
│  │  ┌──────────┬──────────┬──────────┐                        │   │
│  │  │ Chrome   │ Firefox  │ Safari   │                        │   │
│  │  │   ✅     │    ❌    │    ✅    │                        │   │
│  │  │  1.1s    │   error  │   1.2s   │                        │   │
│  │  └──────────┴──────────┴──────────┘                        │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Recording Preview                             [View JSON]   │   │
│  │                                                             │   │
│  │ 5 actions • Starting URL: https://shop.example.com         │   │
│  │                                                             │   │
│  │ 1. Navigate → https://shop.example.com                      │   │
│  │ 2. Click → button.add-to-cart                               │   │
│  │ 3. Wait → 500ms                                             │   │
│  │ 4. Click → .cart-icon                                       │   │
│  │ 5. Assert → .cart-count = "1"                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.6 Run Detail Page with Matrix (/projects/{id}/runs/{runId})

```
┌─────────────────────────────────────────────────────────────────────┐
│ ← Run History          Run #156                      [↻ Re-run All]│
│                        Checkout Flow Suite • 4 tests               │
│                        Started: 2 min ago • Duration: 4.8s         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Summary: 11/12 passed (91.7%)                                      │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Results Matrix                                              │   │
│  │                                                             │   │
│  │                    │ Chrome │ Firefox │ Safari │            │   │
│  │ ───────────────────┼────────┼─────────┼────────┤            │   │
│  │ Add to Cart        │   ✅   │    ✅   │   ✅   │ [details] │   │
│  │                    │  1.2s  │   1.4s  │  1.3s  │            │   │
│  │ ───────────────────┼────────┼─────────┼────────┤            │   │
│  │ Apply Coupon       │   ✅   │    ❌   │   ✅   │ [details] │   │
│  │                    │  0.9s  │  error  │  1.1s  │            │   │
│  │ ───────────────────┼────────┼─────────┼────────┤            │   │
│  │ Payment Card       │   ✅   │    ✅   │   ✅   │ [details] │   │
│  │                    │  2.1s  │   2.3s  │  2.0s  │            │   │
│  │ ───────────────────┼────────┼─────────┼────────┤            │   │
│  │ Confirmation       │   ✅   │    ✅   │   ✅   │ [details] │   │
│  │                    │  1.5s  │   1.6s  │  1.4s  │            │   │
│  │ ───────────────────┴────────┴─────────┴────────┤            │   │
│  │ Browser Total      │  100%  │   75%   │  100%  │            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ❌ Failed: Apply Coupon - Firefox                          │   │
│  │                                                             │   │
│  │ Error: Element not found: .coupon-input                     │   │
│  │ Action: Input text "SAVE20"                                 │   │
│  │                                                             │   │
│  │ [📷 Screenshot]  [🎬 Video]  [📋 Full Log]                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.7 Mobile Navigation

```
┌─────────────────────────────┐
│ ≡  E-commerce Tests    👤  │
└─────────────────────────────┘

Drawer:
┌─────────────────────────────┐
│ E-commerce Tests      [✕]  │
│ ─────────────────────────  │
│ 📊 Overview                │
│ 📁 Test Suites             │
│    • Checkout Flow (4)     │
│    • User Auth (3)         │
│    • Product Search (5)    │
│ 📜 Run History             │
│ 📅 Schedules               │
│ ⚙️ Settings                │
│ ─────────────────────────  │
│ 📁 Switch Project          │
│ 👤 Account                 │
│ 🚪 Logout                  │
└─────────────────────────────┘
```

---

## 10. Key User Flows

### 10.1 Create New Test (Upload Recording)

```
User Flow:
1. Navigate to /projects/{id}/suites/{suiteId}
2. Click [+ Add Test]
3. Dialog opens:
   ┌─────────────────────────────────────────────┐
   │ Add New Test                           [✕] │
   ├─────────────────────────────────────────────┤
   │                                             │
   │ Test Name: [_________________________]      │
   │                                             │
   │ Upload Recording:                           │
   │ ┌─────────────────────────────────────┐    │
   │ │                                     │    │
   │ │     📁 Drop JSON file here         │    │
   │ │        or click to browse          │    │
   │ │                                     │    │
   │ └─────────────────────────────────────┘    │
   │                                             │
   │ Browsers to test:                           │
   │ ☑ Chrome  ☑ Firefox  ☑ Safari              │
   │                                             │
   │ Configuration:                              │
   │ Headless:   ◉ Yes  ○ No                    │
   │ Video:      ○ Yes  ◉ No                    │
   │ Screenshot: [Only on failure ▼]            │
   │ Timeout:    [30000]ms                      │
   │                                             │
   │             [Cancel]  [Create Test]        │
   └─────────────────────────────────────────────┘

4. Click [Create Test]
5. Redirected to /projects/{id}/suites/{suiteId}/tests/{newTestId}
6. Test is immediately runnable with saved config!
```

### 10.2 Run a Test (One-Click)

```
User Flow:
1. Navigate to test page or suite page
2. Click [▶ Run] button
3. Run starts immediately with SAVED config (no dialog!)
4. Progress indicator shows
5. Redirected to /projects/{id}/runs/{runId}
6. Watch results appear in real-time matrix view

Note: Config is PRE-SAVED. No reconfiguration needed!
```

### 10.3 Run a Test with Override

```
User Flow:
1. Navigate to test page
2. Click [▶ Run ▼] dropdown arrow
3. Options appear:
   ┌───────────────────────┐
   │ ▶ Run with defaults   │
   │ ⚙️ Run with options... │
   │ 🔄 Run last config    │
   └───────────────────────┘

4. Click [⚙️ Run with options...]
5. Dialog opens with CURRENT config pre-filled:
   ┌─────────────────────────────────────────────┐
   │ Run Test with Options                  [✕] │
   ├─────────────────────────────────────────────┤
   │                                             │
   │ Override browsers for this run:             │
   │ ☑ Chrome  ☐ Firefox  ☐ Safari              │
   │                                             │
   │ Override configuration:                     │
   │ Headless:   ○ Yes  ◉ No  (watching)        │
   │ Video:      ◉ Yes  ○ No                    │
   │                                             │
   │ ☐ Save as new defaults                     │
   │                                             │
   │             [Cancel]  [▶ Run]              │
   └─────────────────────────────────────────────┘

6. Click [▶ Run]
7. Run executes with overrides (saved defaults unchanged)
```

### 10.4 Run Entire Suite

```
User Flow:
1. Navigate to /projects/{id}/suites/{suiteId}
2. Click [▶ Run Suite]
3. All tests in suite execute in parallel
4. Each test runs on its configured browsers
5. Results page shows full matrix:

   Test Suite: Checkout Flow - Run #157
   ┌─────────────────────────────────────────────┐
   │                 Chrome  Firefox  Safari     │
   │ Add to Cart       ✅      ✅       ✅       │
   │ Apply Coupon      ✅      ✅       ✅       │
   │ Payment Card      ✅      ✅       ✅       │
   │ Confirmation      ✅      ✅       ✅       │
   │─────────────────────────────────────────────│
   │ Total            100%    100%     100%     │
   └─────────────────────────────────────────────┘
```

### 10.5 Schedule a Test

```
User Flow:
1. Navigate to test detail page
2. Click [📅 Schedule] button
3. Dialog opens:
   ┌─────────────────────────────────────────────┐
   │ Schedule Test                          [✕] │
   ├─────────────────────────────────────────────┤
   │                                             │
   │ Schedule Name: [Add to Cart - Hourly____]  │
   │                                             │
   │ Run:                                        │
   │ ◉ This test only                           │
   │ ○ Entire suite                             │
   │                                             │
   │ Frequency:                                  │
   │ ○ Every hour                               │
   │ ○ Every 6 hours                            │
   │ ◉ Daily at [14:00 ▼]                       │
   │ ○ Custom cron: [_____________]             │
   │                                             │
   │ Timezone: [UTC ▼]                          │
   │                                             │
   │ Use default config & browsers              │
   │ ☐ Override...                              │
   │                                             │
   │             [Cancel]  [Create Schedule]    │
   └─────────────────────────────────────────────┘

4. Click [Create Schedule]
5. Schedule appears in /projects/{id}/schedules
6. Next run shows in project overview
```

---

## 11. Component Architecture

### 11.1 New Components

| Component | Path | Purpose |
|-----------|------|---------|
| **Layout** | | |
| `ProjectLayout` | `app/(project)/projects/[projectId]/layout.tsx` | Project-scoped layout |
| `ProjectSidebar` | `components/layout/project-sidebar.tsx` | Navigation with suites tree |
| `ProjectHeader` | `components/layout/project-header.tsx` | Header with project switcher |
| `SuiteTreeNav` | `components/layout/suite-tree-nav.tsx` | Expandable suite/test tree |
| **Projects** | | |
| `ProjectCard` | `components/projects/project-card.tsx` | Project card with stats |
| `ProjectsGrid` | `components/projects/projects-grid.tsx` | Grid of project cards |
| `ProjectOverview` | `components/projects/project-overview.tsx` | Project dashboard |
| `ProjectSwitcher` | `components/projects/project-switcher.tsx` | Quick switch modal |
| **Suites** | | |
| `SuiteList` | `components/suites/suite-list.tsx` | List of suites |
| `SuiteCard` | `components/suites/suite-card.tsx` | Suite card with tests |
| `CreateSuiteDialog` | `components/suites/create-suite-dialog.tsx` | Create new suite |
| **Tests** | | |
| `TestList` | `components/tests/test-list.tsx` | List of tests in suite |
| `TestCard` | `components/tests/test-card.tsx` | Test card with status |
| `TestDetail` | `components/tests/test-detail.tsx` | Full test view |
| `CreateTestDialog` | `components/tests/create-test-dialog.tsx` | Upload recording as test |
| `EditTestConfigDialog` | `components/tests/edit-test-config-dialog.tsx` | Edit test config |
| `BrowserSelector` | `components/tests/browser-selector.tsx` | Multi-browser checkbox |
| `TestConfigForm` | `components/tests/test-config-form.tsx` | Config form fields |
| `RecordingPreview` | `components/tests/recording-preview.tsx` | Show actions list |
| **Runs** | | |
| `RunsList` | `components/runs/runs-list.tsx` | Run history table |
| `RunMatrix` | `components/runs/run-matrix.tsx` | Test × Browser matrix |
| `BrowserResultCell` | `components/runs/browser-result-cell.tsx` | Matrix cell |
| `RunOverviewDialog` | `components/runs/run-overview-dialog.tsx` | Quick run options |
| `FailedTestDetails` | `components/runs/failed-test-details.tsx` | Error details |
| **Schedules** | | |
| `SchedulesList` | `components/schedules/schedules-list.tsx` | List of schedules |
| `CreateScheduleDialog` | `components/schedules/create-schedule-dialog.tsx` | Create schedule |
| `ScheduleDetail` | `components/schedules/schedule-detail.tsx` | Schedule view |

### 11.2 Data Fetching Pattern

```tsx
// Server Component (pages)
export default async function SuitePage({
  params,
}: {
  params: { projectId: string; suiteId: string };
}) {
  const suite = await api.getSuite(params.suiteId);
  const tests = await api.listTests({ suiteId: params.suiteId });
  
  return (
    <SuiteDetail suite={suite}>
      <TestList initialData={tests} suiteId={params.suiteId} />
    </SuiteDetail>
  );
}

// Client Component (interactive)
'use client';
function TestList({ initialData, suiteId }: Props) {
  const { data: tests } = useQuery({
    queryKey: ['tests', suiteId],
    queryFn: () => api.listTests({ suiteId }),
    initialData,
  });
  // ...
}
```

---

## 12. API Endpoints

### 12.1 Test Suites Endpoints

```
POST   /api/v1/suites                    # Create suite
GET    /api/v1/suites?projectId={id}     # List suites in project
GET    /api/v1/suites/{id}               # Get suite details
PUT    /api/v1/suites/{id}               # Update suite
DELETE /api/v1/suites/{id}               # Delete suite
PUT    /api/v1/suites/{id}/reorder       # Reorder suites
```

### 12.2 Tests Endpoints

```
POST   /api/v1/tests                     # Create test (upload recording)
GET    /api/v1/tests?suiteId={id}        # List tests in suite
GET    /api/v1/tests?projectId={id}      # List all tests in project
GET    /api/v1/tests/{id}                # Get test details
PUT    /api/v1/tests/{id}                # Update test (name, config, browsers)
DELETE /api/v1/tests/{id}                # Delete test
PUT    /api/v1/tests/{id}/config         # Update just config
PUT    /api/v1/tests/{id}/browsers       # Update just browsers
PUT    /api/v1/tests/{id}/move           # Move to different suite
```

### 12.3 Runs Endpoints (Updated)

```
POST   /api/v1/runs                      # Create run
  Body: {
    testId?: string,      // Run single test
    suiteId?: string,     // Run all tests in suite
    projectId?: string,   // Run all tests in project
    overrideConfig?: {...},
    overrideBrowsers?: [...]
  }

GET    /api/v1/runs?projectId={id}       # List runs in project
GET    /api/v1/runs/{id}                 # Get run with full matrix
GET    /api/v1/runs/{id}/results         # Get browser results
DELETE /api/v1/runs/{id}                 # Cancel/delete run
```

### 12.4 Project Stats (Updated)

```
GET /api/v1/projects/{id}/stats

Response:
{
  "success": true,
  "data": {
    "suiteCount": 3,
    "testCount": 12,
    "runCount": 156,
    "passRate": 95,
    "browserStats": {
      "chromium": { "runs": 150, "passed": 145, "rate": 96.7 },
      "firefox": { "runs": 140, "passed": 130, "rate": 92.9 },
      "webkit": { "runs": 120, "passed": 118, "rate": 98.3 }
    },
    "activeSchedules": 3,
    "lastRunAt": "...",
    "recentRuns": [...],
    "upcomingSchedules": [...]
  }
}
```

### 12.5 Schedules (Updated)

```
POST   /api/v1/schedules
  Body: {
    name: string,
    projectId: string,
    targetType: 'test' | 'suite' | 'project',
    targetId: string,
    cronExpression: string,
    timezone?: string,
    overrideConfig?: {...},
    overrideBrowsers?: [...]
  }

GET    /api/v1/schedules?projectId={id}
GET    /api/v1/schedules/{id}
PUT    /api/v1/schedules/{id}
DELETE /api/v1/schedules/{id}
PUT    /api/v1/schedules/{id}/toggle     # Enable/disable
```

---

## 13. Implementation Plan

### Phase 1: Database Schema (Day 1)

**Goal:** Add new tables without breaking existing functionality

**Tasks:**
- [ ] Create `test_suites` table in Drizzle schema
- [ ] Create `tests` table in Drizzle schema
- [ ] Update `runs` table to support test/suite runs
- [ ] Create `run_browser_results` table
- [ ] Update `schedules` table for target types
- [ ] Generate and run migration
- [ ] Create repository classes (TestSuiteRepository, TestRepository)
- [ ] Write unit tests for repositories

**Files:**
```
packages/api/src/db/schema/
├── testSuites.ts (new)
├── tests.ts (new)
├── runBrowserResults.ts (new)
├── runs.ts (modify)
├── schedules.ts (modify)
└── index.ts (update exports)

packages/api/src/repositories/
├── TestSuiteRepository.ts (new)
├── TestSuiteRepository.test.ts (new)
├── TestRepository.ts (new)
├── TestRepository.test.ts (new)
├── RunBrowserResultRepository.ts (new)
└── RunBrowserResultRepository.test.ts (new)
```

### Phase 2: API Services & Routes (Day 1-2)

**Goal:** Build API endpoints for new entities

**Tasks:**
- [ ] Create TestSuiteService with CRUD operations
- [ ] Create TestService with CRUD and config management
- [ ] Update RunService for multi-browser runs
- [ ] Update ScheduleService for target types
- [ ] Create API routes for suites
- [ ] Create API routes for tests
- [ ] Update runs routes
- [ ] Update schedules routes
- [ ] Write integration tests

**Files:**
```
packages/api/src/services/
├── TestSuiteService.ts (new)
├── TestSuiteService.test.ts (new)
├── TestService.ts (new)
├── TestService.test.ts (new)
├── RunService.ts (modify)
└── ScheduleService.ts (modify)

packages/api/src/routes/
├── suites.ts (new)
├── tests.ts (new)
├── runs.ts (modify)
└── schedules.ts (modify)
```

### Phase 3: Worker Updates (Day 2)

**Goal:** Update worker to support multi-browser runs

**Tasks:**
- [ ] Update job processor for new run structure
- [ ] Implement parallel browser execution
- [ ] Store results per browser in run_browser_results
- [ ] Update progress events for real-time updates
- [ ] Handle suite runs (multiple tests)
- [ ] Write worker integration tests

**Files:**
```
packages/api/src/queues/
├── runProcessor.ts (major update)
└── runProcessor.test.ts

packages/api/src/services/
└── RunExecutionService.ts (modify for multi-browser)
```

### Phase 4: UI Route Structure (Day 2-3)

**Goal:** Create new Next.js route structure

**Tasks:**
- [ ] Create `app/(global)/` route group
- [ ] Create `app/(project)/projects/[projectId]/` structure
- [ ] Add suite and test route groups
- [ ] Create ProjectLayout with sidebar
- [ ] Create placeholder pages
- [ ] Test navigation works

**Files:**
```
packages/web/src/app/
├── (global)/
│   ├── layout.tsx
│   ├── projects/page.tsx
│   └── settings/page.tsx
└── (project)/projects/[projectId]/
    ├── layout.tsx
    ├── page.tsx
    ├── suites/...
    ├── runs/...
    ├── schedules/...
    └── settings/page.tsx
```

### Phase 5: Navigation Components (Day 3)

**Goal:** Build project sidebar with suite tree

**Tasks:**
- [ ] Create ProjectSidebar with expandable suite tree
- [ ] Create SuiteTreeNav component
- [ ] Create ProjectHeader with switcher
- [ ] Create ProjectSwitcher modal
- [ ] Add mobile responsive navigation
- [ ] Style active states

**Files:**
```
packages/web/src/components/layout/
├── project-sidebar.tsx
├── project-header.tsx
├── suite-tree-nav.tsx
└── project-mobile-nav.tsx

packages/web/src/components/projects/
└── project-switcher.tsx
```

### Phase 6: Projects & Suites Pages (Day 3-4)

**Goal:** Build project and suite management UI

**Tasks:**
- [ ] Build ProjectsGrid and ProjectCard
- [ ] Build project overview page
- [ ] Build SuiteList and SuiteCard
- [ ] Create CreateSuiteDialog
- [ ] Build suite detail page with test list
- [ ] Add loading states and error handling

**Files:**
```
packages/web/src/components/projects/
├── project-card.tsx
├── projects-grid.tsx
└── project-overview.tsx

packages/web/src/components/suites/
├── suite-list.tsx
├── suite-card.tsx
└── create-suite-dialog.tsx
```

### Phase 7: Test Management UI (Day 4)

**Goal:** Build test CRUD and configuration UI

**Tasks:**
- [ ] Create TestList and TestCard components
- [ ] Build CreateTestDialog with recording upload
- [ ] Build BrowserSelector component
- [ ] Build TestConfigForm component
- [ ] Create EditTestConfigDialog
- [ ] Build TestDetail page
- [ ] Add RecordingPreview component

**Files:**
```
packages/web/src/components/tests/
├── test-list.tsx
├── test-card.tsx
├── test-detail.tsx
├── create-test-dialog.tsx
├── edit-test-config-dialog.tsx
├── browser-selector.tsx
├── test-config-form.tsx
└── recording-preview.tsx
```

### Phase 8: Run Execution & Matrix UI (Day 4-5)

**Goal:** Build run execution and results matrix

**Tasks:**
- [ ] Build RunMatrix component
- [ ] Build BrowserResultCell component
- [ ] Update RunsList for new data format
- [ ] Create FailedTestDetails component
- [ ] Build run detail page with matrix
- [ ] Add real-time updates via SSE
- [ ] Test one-click run flow

**Files:**
```
packages/web/src/components/runs/
├── runs-list.tsx (update)
├── run-matrix.tsx
├── browser-result-cell.tsx
├── run-detail.tsx
└── failed-test-details.tsx
```

### Phase 9: Schedules & Migration (Day 5)

**Goal:** Update schedules and migrate existing data

**Tasks:**
- [ ] Update SchedulesList for target types
- [ ] Update CreateScheduleDialog
- [ ] Build schedule detail page
- [ ] Write data migration script
- [ ] Create "Default Suite" for existing projects
- [ ] Convert existing recordings to tests
- [ ] Test migration on sample data

**Files:**
```
packages/web/src/components/schedules/
├── schedules-list.tsx (update)
├── create-schedule-dialog.tsx (update)
└── schedule-detail.tsx

packages/api/scripts/
└── migrate-recordings-to-tests.ts
```

### Phase 10: Cleanup & Polish (Day 5-6)

**Goal:** Remove old code, add redirects, polish UX

**Tasks:**
- [ ] Add next.config.ts redirects
- [ ] Remove old (dashboard) routes
- [ ] Remove old components (recordings-list, etc.)
- [ ] Update post-login redirect
- [ ] Test all user flows
- [ ] Test mobile responsiveness
- [ ] Add error boundaries
- [ ] Accessibility review
- [ ] Performance testing

---

## 14. Migration Strategy

### 14.1 Data Migration

```typescript
// packages/api/scripts/migrate-recordings-to-tests.ts

async function migrateRecordingsToTests() {
  // 1. Get all projects
  const projects = await db.select().from(projectsTable);
  
  for (const project of projects) {
    // 2. Create "Default Suite" for each project
    const suiteId = generateId('suite');
    await db.insert(testSuitesTable).values({
      id: suiteId,
      name: 'Default Suite',
      projectId: project.id,
      displayOrder: 0,
    });
    
    // 3. Get all recordings for this project
    const recordings = await db.select()
      .from(recordingsTable)
      .where(eq(recordingsTable.projectId, project.id));
    
    // 4. Convert each recording to a test
    for (const recording of recordings) {
      const testId = recording.id.replace('rec_', 'test_');
      await db.insert(testsTable).values({
        id: testId,
        name: recording.name,
        suiteId: suiteId,
        projectId: project.id,
        recordingData: recording.recordingData,
        browsers: ['chromium'],
        config: {
          headless: true,
          video: false,
          screenshot: 'only-on-failure',
          timeout: 30000,
          retries: 0,
          slowMo: 0,
        },
      });
    }
    
    // 5. Update existing runs to reference tests
    await db.update(runsTable)
      .set({ testId: sql`REPLACE(recording_id, 'rec_', 'test_')` })
      .where(eq(runsTable.projectId, project.id));
  }
}
```

### 14.2 API Version Strategy

```
/api/v1/ - Keep existing endpoints working during transition
  /recordings/* - Deprecated but functional (returns tests in old format)
  /tests/*      - New endpoints
  /suites/*     - New endpoints

After migration complete:
/api/v1/recordings/* → Returns 301 redirect to /api/v1/tests/*
```

### 14.3 URL Redirects

```typescript
// next.config.ts
const nextConfig = {
  async redirects() {
    return [
      { source: '/dashboard', destination: '/projects', permanent: true },
      { source: '/recordings', destination: '/projects', permanent: true },
      { source: '/recordings/:id', destination: '/projects', permanent: true },
      { source: '/runs', destination: '/projects', permanent: true },
      { source: '/schedules', destination: '/projects', permanent: true },
    ];
  },
};
```

---

## 15. Success Criteria

### 15.1 Functional Requirements

- [ ] User can create Projects with Test Suites hierarchy
- [ ] User can upload recordings as Tests with saved config
- [ ] User can select multiple browsers per test (Chrome, Firefox, Safari)
- [ ] Tests run with ONE CLICK using saved configuration
- [ ] User can run entire suite (all tests, all browsers)
- [ ] Results display in Test × Browser matrix view
- [ ] Schedules support test, suite, or project scope
- [ ] URLs are unique and bookmarkable per project/suite/test

### 15.2 UX Requirements

- [ ] Mental model: "Projects contain Suites which contain Tests"
- [ ] One-click run: No reconfiguration needed
- [ ] Matrix view: Clear pass/fail per test per browser
- [ ] Quick access: Suite tree in sidebar
- [ ] Easy navigation: Breadcrumbs show context
- [ ] Professional: Matches GitHub/Cypress pattern

### 15.3 Technical Requirements

- [ ] All new tables have proper indexes
- [ ] API endpoints follow REST conventions
- [ ] Worker handles parallel browser execution
- [ ] Real-time updates for run progress
- [ ] All existing tests pass
- [ ] New tests added for all features
- [ ] Clean migration path for existing data

### 15.4 Performance Requirements

- [ ] Suite with 50 tests loads < 2s
- [ ] Test run starts < 1s after click
- [ ] Matrix view renders < 500ms
- [ ] Parallel browser runs complete faster than sequential

---

## Timeline Summary

| Day | Focus | Deliverables |
|-----|-------|--------------|
| **Day 1** | Database + API | New tables, repositories, services |
| **Day 2** | API + Worker | Routes, multi-browser execution |
| **Day 3** | UI Routes + Nav | Next.js structure, sidebar, header |
| **Day 4** | Suite + Test UI | CRUD dialogs, test config forms |
| **Day 5** | Run Matrix + Polish | Matrix view, schedules, migration |
| **Day 6** | Testing + Cleanup | E2E tests, old code removal |

**Total Estimate:** 6 working days

---

## Notes & Decisions

1. **Recording data embedded in test** - Simpler than separate table, JSONB allows flexibility
2. **Browsers as array** - Flexible for future browsers (Edge, etc.)
3. **Config as JSONB** - Easy to extend without migrations
4. **Suite tree in sidebar** - GitHub style, familiar to developers
5. **One-click run** - Core UX improvement, save config per test
6. **Matrix view** - Industry standard for cross-browser testing
7. **Parallel execution** - Run all browsers simultaneously for speed

---

*Document created: February 16, 2026*  
*Last updated: February 16, 2026*
