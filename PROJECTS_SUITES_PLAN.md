# SaveAction: Projects, Suites & Environments Plan

> **Status:** Planning  
> **Created:** February 12, 2026  
> **Goal:** Progressive complexity - simple by default, powerful when needed

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
  ADD COLUMN project_id UUID REFERENCES projects(id),
  ADD COLUMN suite_id UUID REFERENCES suites(id);

-- Add to runs table
ALTER TABLE runs
  ADD COLUMN suite_id UUID REFERENCES suites(id),
  ADD COLUMN environment_id UUID REFERENCES environments(id);

-- Add to schedules table
ALTER TABLE schedules
  ADD COLUMN suite_id UUID REFERENCES suites(id),
  ADD COLUMN environment_id UUID REFERENCES environments(id);
```

### 4.3 Migration Strategy

1. Create `projects` table
2. Create default project for each existing user
3. Add `project_id` column to recordings (nullable first)
4. Backfill recordings with default project_id
5. Make `project_id` NOT NULL
6. Create `suites` table (optional relationship)
7. Create `environments` table (Phase 2)

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

```
# Recordings - add project/suite context
GET  /api/v1/recordings?projectId=xxx&suiteId=xxx
POST /api/v1/recordings  - Body includes projectId, suiteId (optional)

# Runs - add suite/environment context
POST /api/v1/runs  - Body can include suiteId to run all
GET  /api/v1/runs?projectId=xxx&suiteId=xxx&environmentId=xxx
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

## 7. Implementation Phases

### Phase 1: Projects (Foundation)
**Priority: HIGH**

- [ ] Database: Create projects table
- [ ] Database: Migration for existing users (default project)
- [ ] Database: Add project_id to recordings
- [ ] API: Projects CRUD endpoints
- [ ] API: Modify recordings to require project
- [ ] UI: Project switcher in nav
- [ ] UI: Projects list page
- [ ] UI: Create/edit project dialog
- [ ] UI: Filter recordings by project

**Estimated: 2-3 days**

### Phase 2: Suites (Organization)
**Priority: MEDIUM**

- [ ] Database: Create suites table
- [ ] Database: Add suite_id to recordings, runs, schedules
- [ ] API: Suites CRUD endpoints
- [ ] API: Run suite endpoint (bulk run)
- [ ] API: Schedule suite endpoint
- [ ] UI: Suites in recordings page (folders)
- [ ] UI: Create/edit suite dialog
- [ ] UI: Drag-drop recordings to suites
- [ ] UI: Suite health badges
- [ ] Worker: Handle suite runs (multiple recordings)

**Estimated: 3-4 days**

### Phase 3: Environments (Power Feature)
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

### Phase 4: Polish
**Priority: LOW**

- [ ] Dashboard: Project health widgets
- [ ] Dashboard: Suite status overview
- [ ] Analytics: Per-project stats
- [ ] Onboarding: Project creation flow
- [ ] Export: Project-level data export

---

## 8. Breaking Changes & Migration

### For Existing Users

1. **Automatic migration:** All existing recordings assigned to "Default Project"
2. **No action required:** App works exactly as before
3. **Optional upgrade:** Users can create projects to organize

### For API Users

1. **Backwards compatible:** `POST /recordings` without project_id uses default
2. **New parameter:** `project_id` optional in requests
3. **Deprecation warning:** After 3 months, project_id recommended

### For Self-Hosted

1. **Migration script:** Included in release
2. **Rollback possible:** Keep backup before upgrade
3. **Documentation:** Clear upgrade guide

---

## 9. Success Metrics

| Metric | Target |
|--------|--------|
| Users with 2+ projects | 30% within 3 months |
| Users using suites | 20% within 3 months |
| Suite run usage | 40% of all runs |
| User retention | +10% improvement |

---

## 10. Open Questions

1. **Suite nesting:** Should suites be nestable (folders within folders)?
   - Recommendation: No, keep flat. Tags handle sub-organization.

2. **Cross-project recordings:** Can a recording be in multiple projects?
   - Recommendation: No, one project per recording. Use duplicate if needed.

3. **Project permissions:** Team access per project?
   - Recommendation: Future feature. Start with user-level ownership.

4. **Default project naming:** "My Tests" or "Default" or user's name?
   - Recommendation: "My Tests" - friendly and clear.

5. **Suite limits:** Max recordings per suite?
   - Recommendation: No hard limit, but warn at 100+ for performance.

---

## 11. References

- Current database schema: `packages/api/src/db/schema/`
- Current API routes: `packages/api/src/routes/`
- Current UI: `packages/web/src/app/(dashboard)/`

---

## Changelog

| Date | Change |
|------|--------|
| 2026-02-12 | Initial plan created |
