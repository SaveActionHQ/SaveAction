# SaveAction: Projects, Suites & Environments Plan

> **Status:** Ready for Implementation  
> **Created:** February 12, 2026  
> **Updated:** February 15, 2026  
> **Goal:** Progressive complexity - simple by default, powerful when needed

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Feature Overview](#2-feature-overview)
3. [User Experience](#3-user-experience)
4. [Database Schema Changes](#4-database-schema-changes)
5. [API Changes](#5-api-changes)
6. [UI Changes](#6-ui-changes)
7. [CLI Changes](#7-cli-changes)
8. [Chrome Extension Changes](#8-chrome-extension-changes)
9. [Implementation Phases](#9-implementation-phases)
10. [Breaking Changes & Migration](#10-breaking-changes--migration)
11. [Success Metrics](#11-success-metrics)
12. [Design Decisions](#12-design-decisions)
13. [References](#13-references)

---

## 1. Problem Statement

### Current State
- Recordings are flat list with tags
- Works for personal use / single product
- Doesn't scale for enterprise with multiple products

### Target Users
| User Type | Needs |
|-----------|-------|
| Personal / Solo Dev | Simple, zero config, just works |
| Small Team | Light organization, maybe 1-2 products |
| Enterprise | Multiple products, teams, environments |

### Core Principle
**Don't force structure. Let it emerge.**

Same app, different depth of usage based on user needs.

---

## 2. Feature Overview

### 2.1 Projects (Product/App Container)

**What:** Top-level container for grouping recordings by product/application

**Behavior:**
- Every user gets a default project ("My Tests") on signup
- Default project is hidden in UI if user has only one project
- When user creates second project, sidebar shows project switcher
- Recordings belong to exactly one project

**Use Cases:**
- Enterprise: Separate project per product (E-commerce, Mobile App, Admin Panel)
- Agency: Separate project per client
- Personal: Ignore it, use default project

### 2.2 Suites (Test Folder/Collection)

**What:** Optional grouping of recordings within a project

**Behavior:**
- Completely optional - recordings can exist at project root
- Suite = folder of related tests
- Can run entire suite with one click
- Can schedule entire suite
- Suites can have their own tags (inherited by recordings inside)

**Use Cases:**
- "Checkout Flow" suite with 8 tests
- "Authentication" suite with 5 tests
- "Smoke Tests" suite for quick validation

### 2.3 Environments (Future - Phase 2)

**What:** Base URL configuration per environment

**Behavior:**
- Define environments at project level (staging, production, local)
- Each environment has base URL + optional headers
- Same recording runs against different environments
- Results tracked per environment

**Use Cases:**
- Test checkout on staging before production deploy
- Run same tests against local dev server
- Compare results across environments

---

## 3. User Experience

### 3.1 Personal User (Default)

```
┌─────────────────────────────────────────────────────┐
│ SaveAction                                          │
├─────────────────────────────────────────────────────┤
│                                                     │
│ My Tests                          [+ New Recording] │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 📋 Login test              [Run] [Schedule]     │ │
│ │ 📋 Checkout test           [Run] [Schedule]     │ │
│ │ 📋 Cart test               [Run] [Schedule]     │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ No projects shown - just recordings                 │
│ Feels like current UX                               │
└─────────────────────────────────────────────────────┘
```

### 3.2 Growing User (2+ Projects)

```
┌─────────────────────────────────────────────────────┐
│ SaveAction                  [Project: E-commerce ▼] │
├─────────────────────────────────────────────────────┤
│                                                     │
│ E-commerce App                   [+ New Recording]  │
│                                  [+ New Suite]      │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 📁 Checkout Suite (5 tests)    [Run All]        │ │
│ │ 📁 Auth Suite (3 tests)        [Run All]        │ │
│ │ ─────────────────────────────────────────────── │ │
│ │ 📋 Homepage test               [Run]            │ │
│ │ 📋 Footer links test           [Run]            │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 3.3 Enterprise User (Full Hierarchy)

```
┌────────────────────┬────────────────────────────────┐
│ PROJECTS           │ E-commerce App                 │
│                    │                                │
│ ▶ E-commerce App   │ Health: 95% passing            │
│   ├─ Checkout      │ Last run: 2 hours ago          │
│   ├─ Auth          │                                │
│   └─ Cart          │ ┌────────────────────────────┐ │
│                    │ │ Checkout Suite    [Run All]│ │
│ ▶ Mobile API       │ │ ├─ Add to cart ✓          │ │
│   └─ Auth          │ │ ├─ Apply coupon ✓         │ │
│                    │ │ ├─ Payment flow ✗         │ │
│ ▶ Admin Panel      │ │ └─ Order confirm ✓        │ │
│                    │ └────────────────────────────┘ │
│                    │                                │
│ [+ New Project]    │ [+ New Suite] [+ New Recording]│
└────────────────────┴────────────────────────────────┘
```

---

## 4. Database Schema Changes

### 4.1 New Tables

```sql
-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(7),  -- Hex color for UI (#FF5733)
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,
  
  UNIQUE(user_id, name)
);

-- Suites table
CREATE TABLE suites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  tags TEXT[],  -- Inherited by recordings
  order_index INTEGER DEFAULT 0,  -- For manual ordering
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,
  
  UNIQUE(project_id, name)
);

-- Environments table (Phase 2)
CREATE TABLE environments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  name VARCHAR(100) NOT NULL,  -- staging, production, local
  base_url VARCHAR(2048) NOT NULL,
  headers JSONB,  -- Optional headers
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(project_id, name)
);
```

### 4.2 Modified Tables

```sql
-- Add to recordings table
ALTER TABLE recordings 
  ADD COLUMN project_id UUID NOT NULL REFERENCES projects(id),
  ADD COLUMN suite_id UUID REFERENCES suites(id);  -- Optional

-- Add to runs table
ALTER TABLE runs
  ADD COLUMN project_id UUID NOT NULL REFERENCES projects(id),
  ADD COLUMN suite_id UUID REFERENCES suites(id),
  ADD COLUMN environment_id UUID REFERENCES environments(id);

-- Add to schedules table  
ALTER TABLE schedules
  ADD COLUMN project_id UUID NOT NULL REFERENCES projects(id),
  ADD COLUMN suite_id UUID REFERENCES suites(id),
  ADD COLUMN environment_id UUID REFERENCES environments(id);
```

### 4.3 Indexes for Performance

```sql
-- Project queries
CREATE INDEX idx_recordings_project_id ON recordings(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_runs_project_id ON runs(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_schedules_project_id ON schedules(project_id) WHERE deleted_at IS NULL;

-- Suite queries
CREATE INDEX idx_recordings_suite_id ON recordings(suite_id) WHERE suite_id IS NOT NULL;
CREATE INDEX idx_runs_suite_id ON runs(suite_id) WHERE suite_id IS NOT NULL;
CREATE INDEX idx_suites_project_id ON suites(project_id) WHERE deleted_at IS NULL;

-- Composite indexes for common queries
CREATE INDEX idx_recordings_project_suite ON recordings(project_id, suite_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_runs_project_created ON runs(project_id, created_at DESC) WHERE deleted_at IS NULL;
```

### 4.4 Deletion Cascade Rules

| Entity | On Delete | Behavior |
|--------|-----------|----------|
| Project | Soft delete | All recordings, runs, schedules, suites marked `deleted_at` |
| Suite | Soft delete | Recordings moved to project root (suite_id = NULL) |
| Recording | Soft delete | Associated runs and schedules kept for history |
| User | Hard delete | All projects cascade deleted (GDPR compliance) |

**Project Deletion Flow:**
```
1. User requests DELETE /api/v1/projects/:id
2. Check: Cannot delete default project (400 error)
3. Soft delete: Set deleted_at on project
4. Cascade: Set deleted_at on all project's recordings, suites
5. Cascade: Set deleted_at on all project's runs, schedules
6. Response: 204 No Content
```

### 4.5 Migration Strategy

1. Create `projects` table
2. Create default project for each existing user
3. Add `project_id` column to recordings, runs, schedules (nullable first)
4. Backfill all tables with default project_id per user
5. Make `project_id` NOT NULL on all tables
6. Create indexes
7. Create `suites` table (optional relationship)
8. Create `environments` table (Phase 3)

---

## 5. API Changes

### 5.1 New Endpoints

```
# Projects
GET    /api/v1/projects              - List user's projects
POST   /api/v1/projects              - Create project
GET    /api/v1/projects/:id          - Get project details
PUT    /api/v1/projects/:id          - Update project
DELETE /api/v1/projects/:id          - Delete project (soft)
GET    /api/v1/projects/:id/stats    - Project health/stats

# Suites
GET    /api/v1/projects/:projectId/suites           - List suites
POST   /api/v1/projects/:projectId/suites           - Create suite
GET    /api/v1/suites/:id                           - Get suite details
PUT    /api/v1/suites/:id                           - Update suite
DELETE /api/v1/suites/:id                           - Delete suite
POST   /api/v1/suites/:id/run                       - Run all tests in suite
POST   /api/v1/suites/:id/schedule                  - Schedule suite

# Environments (Phase 2)
GET    /api/v1/projects/:projectId/environments     - List environments
POST   /api/v1/projects/:projectId/environments     - Create environment
PUT    /api/v1/environments/:id                     - Update environment
DELETE /api/v1/environments/:id                     - Delete environment
```

### 5.2 Modified Endpoints

**Breaking Changes:** `projectId` is now REQUIRED. No backwards compatibility.

```
# Recordings - projectId REQUIRED
GET  /api/v1/recordings?projectId=xxx              - REQUIRED filter
GET  /api/v1/recordings?projectId=xxx&suiteId=xxx  - With suite filter
POST /api/v1/recordings  - Body MUST include projectId, suiteId (optional)

# Runs - projectId REQUIRED for listing
POST /api/v1/runs  - Body MUST include recordingId (unchanged) OR suiteId (run all in suite)
GET  /api/v1/runs?projectId=xxx                    - REQUIRED filter
GET  /api/v1/runs?projectId=xxx&suiteId=xxx        - With suite filter

# Schedules - projectId REQUIRED for listing  
GET  /api/v1/schedules?projectId=xxx               - REQUIRED filter
POST /api/v1/schedules  - Body MUST include recordingId OR suiteId
```

**Removed Endpoints:**
```
GET /api/v1/recordings      - No longer works without projectId (400 error)
GET /api/v1/runs            - No longer works without projectId (400 error)
GET /api/v1/schedules       - No longer works without projectId (400 error)
```

### 5.3 Unchanged Endpoints (No projectId Required)

Single-item endpoints work by ID alone (ownership verified via recording→project→user):

```
# These endpoints don't change - ID lookup handles authorization
GET    /api/v1/recordings/:id      - Get by ID (no projectId needed)
PUT    /api/v1/recordings/:id      - Update by ID
DELETE /api/v1/recordings/:id      - Delete by ID

GET    /api/v1/runs/:id            - Get by ID
DELETE /api/v1/runs/:id            - Cancel/delete by ID

GET    /api/v1/schedules/:id       - Get by ID
PUT    /api/v1/schedules/:id       - Update by ID  
DELETE /api/v1/schedules/:id       - Delete by ID
```

**Why:** When you have the ID, you already know the specific resource. The API verifies ownership through the relationship chain (resource → project → user).

### 5.4 Error Response Format

**Missing projectId (400 Bad Request):**
```json
{
  "success": false,
  "error": {
    "code": "PROJECT_ID_REQUIRED",
    "message": "projectId query parameter is required",
    "details": {
      "endpoint": "GET /api/v1/recordings",
      "hint": "Use GET /api/v1/projects to list your projects"
    }
  }
}
```

**Invalid projectId (404 Not Found):**
```json
{
  "success": false,
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "Project not found or access denied"
  }
}
```

**Attempting to delete default project (400 Bad Request):**
```json
{
  "success": false,
  "error": {
    "code": "CANNOT_DELETE_DEFAULT_PROJECT",
    "message": "Default project cannot be deleted. Create another project first."
  }
}
```

---

## 6. UI Changes

### 6.1 Navigation

**Current:**
```
Dashboard | Recordings | Runs | Schedules | Settings
```

**New:**
```
Dashboard | Projects | Recordings | Runs | Schedules | Settings
           ^^^^^^^^
           New page
```

Or integrate into sidebar:
```
┌──────────────────┐
│ 🏠 Dashboard     │
│ 📁 Projects      │  ← Click to see projects list
│   └─ E-commerce  │  ← Active project
│   └─ Mobile App  │
│ 📋 Recordings    │  ← Scoped to active project
│ ▶️ Runs          │  ← Scoped to active project
│ 📅 Schedules     │  ← Scoped to active project
│ ⚙️ Settings      │
└──────────────────┘
```

### 6.2 Project Context

- Show current project name in header/breadcrumb
- Project switcher dropdown in top nav
- All recordings/runs/schedules filtered by active project

### 6.3 Suite UI

- Collapsible folders in recordings list
- Suite badges showing test count and health
- "Run Suite" button
- Drag-drop to move recordings between suites

### 6.4 Dashboard Changes

**Project Dashboard (when viewing specific project):**
- Suite health overview
- Recent runs for this project
- Failing tests in this project

**Global Dashboard:**
- All projects health summary
- Cross-project run activity
- Notifications across all projects

---

## 7. CLI Changes

### 7.1 Two Distinct Modes

The CLI operates in two modes - **local mode** requires no API/database, **platform mode** integrates with SaveAction platform.

#### Local Mode (Default for JSON files)

Running a local JSON file executes independently - no project ID, no database, no API:

```bash
# Just run the test locally with Playwright
saveaction run test.json                    # Runs independently, outputs to console
saveaction run test.json --headless false   # Watch it run
saveaction run test.json --output json      # Output JSON results
saveaction run test.json --video ./videos   # Record video locally

# These work offline - no authentication needed
saveaction validate test.json               # Validate recording structure
saveaction info test.json                   # Show recording details
saveaction list ./recordings                # List local JSON files
```

**Why:** Developers in CI/CD, testers debugging locally, or anyone who just wants to run a recording shouldn't need platform integration.

#### Platform Mode (Explicit opt-in)

Platform integration requires explicit flags and project context:

```bash
# Run from platform (fetches recording from API, stores results)
saveaction run --recording-id <uuid>                    # Uses recording's project
saveaction run --recording-id <uuid> --project-id <id>  # Override project

# Upload local recording to platform
saveaction upload test.json --project-id <uuid>
saveaction upload test.json --project "E-commerce"      # By name

# Run local file AND upload results to platform
saveaction run test.json --upload --project-id <uuid>
saveaction run test.json --upload --project "E-commerce"

# Project management (requires auth)
saveaction projects list
saveaction projects create "New Project"
saveaction projects default                  # Show current default
saveaction projects default <id>             # Set new default
```

### 7.2 Configuration File (Platform Mode Only)

Support `.saveactionrc.json` for persistent platform configuration:

```json
{
  "projectId": "uuid-here",
  "projectName": "E-commerce",
  "apiUrl": "https://api.saveaction.dev"
}
```

**Lookup order for project (when `--upload` or `--recording-id` used):**
1. `--project-id` flag (highest priority)
2. `--project` flag (name lookup)
3. `SAVEACTION_PROJECT_ID` environment variable
4. `.saveactionrc.json` in current directory
5. User's default project from API

### 7.3 Command Summary

| Command | Mode | Project Required |
|---------|------|------------------|
| `saveaction run test.json` | Local | **No** - runs independently |
| `saveaction run test.json --upload` | Platform | **Yes** - stores results |
| `saveaction run --recording-id <id>` | Platform | No (uses recording's project) |
| `saveaction validate test.json` | Local | **No** |
| `saveaction info test.json` | Local | **No** |
| `saveaction list [dir]` | Local | **No** |
| `saveaction upload test.json` | Platform | **Yes** |
| `saveaction projects *` | Platform | N/A |

---

## 8. Chrome Extension Changes

### 8.1 Project Picker

When user records a test, they select which project it belongs to:

```
┌─────────────────────────────────────────┐
│ SaveAction Recorder                     │
├─────────────────────────────────────────┤
│                                         │
│ Project: [E-commerce ▼]                 │
│          └─ My Tests                    │
│             E-commerce                  │
│             Mobile App                  │
│                                         │
│ Suite: [None (Project Root) ▼]          │
│        └─ None (Project Root)           │
│           Checkout Flow                 │
│           Authentication                │
│                                         │
│ Test Name: [                     ]      │
│                                         │
│ [Start Recording]                       │
└─────────────────────────────────────────┘
```

### 8.2 Persistent Selection

- Remember last-used project/suite per browser profile
- Store in `chrome.storage.sync` for cross-device consistency
- Default to user's default project if no selection saved

### 8.3 Quick Actions

- "Upload to default project" (one-click, no prompts)
- "Upload to..." (opens project/suite picker)
- Keyboard shortcut for quick recording start

### 8.4 Extension Settings

```
┌─────────────────────────────────────────┐
│ SaveAction Extension Settings           │
├─────────────────────────────────────────┤
│                                         │
│ Default Project: [E-commerce ▼]         │
│ Default Suite: [None ▼]                 │
│                                         │
│ ☑ Remember last used project            │
│ ☐ Always ask before upload              │
│ ☑ Auto-open result after run            │
│                                         │
│ [Save]                                  │
└─────────────────────────────────────────┘
```

---

## 9. Implementation Phases

### Timeline Summary

| Phase | Priority | Scope | Estimate | Dependencies |
|-------|----------|-------|----------|--------------|
| **Phase 1** | HIGH | Projects (Foundation) | 2-3 days | None |
| **Phase 3** | HIGH | CLI & Extension | 2-3 days | Phase 1 |
| **Phase 2** | MEDIUM | Suites | 3-4 days | Phase 1 |
| **Phase 4** | LOW | Environments | 2-3 days | Phase 1+2 |
| **Phase 5** | LOW | Polish | 2-3 days | All above |

**Total MVP (Phases 1+3):** ~5 days  
**Full Feature (Phases 1-3):** ~8 days  
**Complete (All Phases):** ~12-15 days

### Phase 1: Projects (Foundation)
**Priority: HIGH**

- [ ] Database: Create projects table
- [ ] Database: Migration for existing users (default project)
- [ ] Database: Add project_id to recordings, runs, schedules
- [ ] Database: Create performance indexes
- [ ] API: Projects CRUD endpoints
- [ ] API: Modify recordings to require projectId
- [ ] API: Modify runs listing to require projectId
- [ ] API: Modify schedules listing to require projectId
- [ ] API: Add error responses for missing projectId
- [ ] UI: Project switcher in nav
- [ ] UI: Projects list page
- [ ] UI: Create/edit project dialog
- [ ] UI: Filter all pages by active project
- [ ] Tests: Unit tests for all new endpoints
- [ ] Tests: Integration tests for project workflows

**Estimated: 2-3 days**

### Phase 2: Suites (Organization)
**Priority: MEDIUM**

- [ ] Database: Create suites table
- [ ] Database: Add suite_id to recordings, runs, schedules
- [ ] Database: Create suite indexes
- [ ] API: Suites CRUD endpoints
- [ ] API: Run suite endpoint (bulk run)
- [ ] API: Schedule suite endpoint
- [ ] API: Suite stats endpoint
- [ ] UI: Suites in recordings page (folders)
- [ ] UI: Create/edit suite dialog
- [ ] UI: Drag-drop recordings to suites
- [ ] UI: Suite health badges
- [ ] UI: "Run All in Suite" button
- [ ] Worker: Handle suite runs (multiple recordings)
- [ ] Worker: Suite run status aggregation
- [ ] Tests: Unit tests for suite endpoints
- [ ] Tests: Integration tests for suite runs

**Estimated: 3-4 days**

### Phase 3: CLI & Extension Updates
**Priority: HIGH** (must ship with Phase 1)

**CLI - Local Mode (no changes needed, already works):**
- [x] `saveaction run test.json` - runs independently, no API
- [x] `saveaction validate/info/list` - local only, no API

**CLI - Platform Mode (new features):**
- [ ] CLI: Add `--upload` flag to upload results to platform
- [ ] CLI: Add `--recording-id` flag to run from platform
- [ ] CLI: Add `--project-id` and `--project` flags (for --upload)
- [ ] CLI: Add `upload` command (upload local JSON to platform)
- [ ] CLI: Add `projects` command (list, create, default)
- [ ] CLI: Support `.saveactionrc.json` configuration
- [ ] CLI: Auto-fetch default project when --upload used without project
- [ ] CLI: Update help text and documentation

**Extension:**
- [ ] Extension: Add project picker to recording dialog
- [ ] Extension: Add suite picker to recording dialog  
- [ ] Extension: Persistent project selection in settings
- [ ] Extension: \"Quick upload\" to default project
- [ ] Extension: Update manifest for new permissions

**Documentation & Tests:**
- [ ] Docs: Update CLI documentation (local vs platform mode)
- [ ] Docs: Update API migration guide
- [ ] Tests: CLI project command tests
- [ ] Tests: CLI flag parsing tests

**Estimated: 2-3 days**

### Phase 4: Environments (Power Feature)
**Priority: LOW (Future)**

- [ ] Database: Create environments table
- [ ] Database: Add environment_id to runs
- [ ] API: Environments CRUD
- [ ] API: Run with environment override
- [ ] Core: URL rewriting logic in runner
- [ ] UI: Environment picker in run dialog
- [ ] UI: Environment management in project settings
- [ ] UI: Results comparison across environments

**Estimated: 2-3 days**

### Phase 5: Polish
**Priority: LOW**

- [ ] Dashboard: Project health widgets
- [ ] Dashboard: Suite status overview
- [ ] Analytics: Per-project stats
- [ ] Onboarding: Project creation flow
- [ ] Export: Project-level data export

---

## 10. Breaking Changes & Migration

### For Existing Users

1. **Automatic migration:** All existing recordings assigned to "Default Project"
2. **No action required:** App works exactly as before
3. **Optional upgrade:** Users can create projects to organize

### For API Users

**BREAKING CHANGES - No Backwards Compatibility**

1. **projectId REQUIRED:** All recordings, runs, schedules endpoints require `projectId`
2. **400 error:** Requests without projectId return `{ error: { code: 'PROJECT_ID_REQUIRED' } }`
3. **Update required:** CLI, extension, and custom scripts must be updated
4. **Migration path:**
   - Get user's default project: `GET /api/v1/projects` → find `is_default: true`
   - Include projectId in all subsequent requests

**Why no backwards compatibility:**
- Explicit is better than implicit
- No "where did my recording go?" confusion
- Cleaner API design
- All clients (UI, CLI, extension) are controlled - we update them together

### For Self-Hosted

1. **Migration script:** Included in release
2. **Rollback possible:** Keep backup before upgrade
3. **Documentation:** Clear upgrade guide

### Migration Checklist

**Before Release:**
- [ ] Update all API clients to use projectId
- [ ] Test CLI with new `--project-id` flag
- [ ] Test extension project picker
- [ ] Run integration tests
- [ ] Update documentation

**Release Day:**
- [ ] Run database migration
- [ ] Deploy new API version
- [ ] Deploy new CLI version
- [ ] Publish new extension version
- [ ] Monitor error rates

**Post-Release:**
- [ ] Check for 400 errors (missing projectId)
- [ ] Verify user recordings migrated correctly
- [ ] Monitor feedback channels

### Testing Migration Locally

```bash
# 1. Backup database
pg_dump saveaction > backup.sql

# 2. Run migration
cd packages/api && pnpm db:migrate

# 3. Verify default projects created
SELECT u.email, p.name, p.is_default 
FROM users u 
JOIN projects p ON p.user_id = u.id 
WHERE p.is_default = true;

# 4. Verify recordings assigned
SELECT COUNT(*) FROM recordings WHERE project_id IS NULL;  -- Should be 0

# 5. Test API
curl -H \"Authorization: Bearer $TOKEN\" \\
  \"http://localhost:3001/api/v1/recordings\"  # Should return 400

curl -H \"Authorization: Bearer $TOKEN\" \\
  \"http://localhost:3001/api/v1/recordings?projectId=$PROJECT_ID\"  # Should work
```

---

## 11. Success Metrics

| Metric | Target |
|--------|--------|
| Users with 2+ projects | 30% within 3 months |
| Users using suites | 20% within 3 months |
| Suite run usage | 40% of all runs |
| User retention | +10% improvement |

---

## 12. Design Decisions

Documenting key decisions for future reference:

| # | Question | Decision | Rationale |
|---|----------|----------|----------|
| 1 | Suite nesting? | **No** - Single level only | Tags handle sub-organization. Deep nesting causes UX complexity. |
| 2 | Cross-project recordings? | **No** - One project per recording | Use duplicate feature if needed. Keeps data model simple. |
| 3 | Project permissions? | **Future** - Start with user ownership | Teams/roles are Phase 5+. Ship MVP first. |
| 4 | Default project name? | **"My Tests"** | Friendly, clear, non-technical. |
| 5 | Suite limits? | **No hard limit** | UI warns at 100+ recordings for performance. |
| 6 | projectId backwards compatibility? | **No** - Breaking change | Explicit is better. All clients are controlled. [2026-02-15] |
| 7 | Project deletion behavior? | **Cascade soft delete** | All child recordings, runs, schedules get deleted_at set. |
| 8 | Default project deletable? | **No** | User must have at least one project. 400 error if attempted. |
| 9 | CLI local run needs projectId? | **No** - Local mode is independent | `saveaction run test.json` runs Playwright locally, no API/DB needed. CI/dev use case. [2026-02-15] |

---

## 13. References

- Current database schema: `packages/api/src/db/schema/`
- Current API routes: `packages/api/src/routes/`
- Current UI: `packages/web/src/app/(dashboard)/`

---

## Changelog

| Date | Change |
|------|--------|
| 2026-02-12 | Initial plan created |
| 2026-02-15 | Decision: projectId REQUIRED (no backwards compatibility) |
| 2026-02-15 | Added: project_id to runs & schedules tables (direct FK, no JOIN needed) |
| 2026-02-15 | Added: Database indexes for performance |
| 2026-02-15 | Added: Deletion cascade rules |
| 2026-02-15 | Added: Section 5.3 - Unchanged endpoints (single-item lookups) |
| 2026-02-15 | Added: Section 5.4 - Error response format |
| 2026-02-15 | Added: Section 7 - CLI Changes |
| 2026-02-15 | Added: Section 8 - Chrome Extension Changes |
| 2026-02-15 | Added: Phase 3 - CLI & Extension Updates |
| 2026-02-15 | Converted: Open Questions → Design Decisions |
| 2026-02-15 | Updated: CLI local vs platform mode - local JSON runs need no projectId |
