# Browser Extension — Platform Integration Instructions

> **For:** AI Agent working on the SaveAction Chrome Extension repository  
> **Purpose:** Implement Settings Page + Auto-Upload to SaveAction Platform  
> **Date:** February 2026

---

## Background & Context

SaveAction is a test automation platform. It has two main parts:

1. **Chrome Extension** (your repo) — Records browser interactions (clicks, inputs, navigation, etc.) and produces JSON recording files
2. **Platform** (separate monorepo) — REST API + Web Dashboard that stores recordings, executes them with Playwright, and shows results

Currently the extension's **only output** is downloading a JSON file to the user's computer. These two tasks connect the extension to the platform so recordings can be **uploaded directly** via API instead of manual download → upload.

---

## Task 1: Extension Settings Page

### What to Build

Add a **Settings page** to the extension popup that lets users configure their SaveAction platform connection. This is stored in `chrome.storage.sync` so it persists across browser sessions and syncs across devices.

### Settings Fields

| Field | Type | Storage Key | Default | Description |
|-------|------|-------------|---------|-------------|
| Platform URL | text input | `platformUrl` | `""` (empty) | Base URL of the SaveAction API (e.g., `https://saveaction.example.com`) |
| API Token | password input | `apiToken` | `""` (empty) | API token starting with `sa_live_` (generated in platform Settings → API Tokens) |
| Project | dropdown | `selectedProjectId` | `""` (empty) | Project where recordings will be uploaded (fetched from API after auth) |
| Auto-Upload | toggle/checkbox | `autoUpload` | `false` | When enabled, recordings auto-upload after stopping. When disabled, recordings only download locally |
| Upload Tags | text input | `defaultTags` | `""` (empty) | Comma-separated default tags to attach to uploads (e.g., `smoke,login`) |

### UI Requirements

- Add a **gear icon (⚙️)** or **"Settings"** button/link in the extension popup (visible whether recording or not)
- Settings should be on a **separate view/panel** within the popup (not a new tab/window) — toggle between main view and settings view
- Include a **"Test Connection"** button that verifies the platform URL + API token are valid
- After successful connection test, **fetch and populate the Project dropdown** with user's projects
- Include a **"Save"** button that persists settings to `chrome.storage.sync`
- Show **visual feedback**: green checkmark on successful connection test, red X with error message on failure
- Show the **connection status** on the main popup view (e.g., small indicator: "Connected to platform" or "Not configured")

### Connection Test Logic

The "Test Connection" button should do this:

```
1. Take the Platform URL from the input field
2. Strip trailing slashes
3. Make a GET request to: {platformUrl}/api/health
4. If that succeeds (status 200, response has `status: "ok"`), the server is reachable
5. Then verify the API token by making a GET request to: {platformUrl}/api/v1/projects?limit=100
   with header: Authorization: Bearer {apiToken}
6. If that succeeds (status 200), the token is valid — populate Project dropdown with the returned projects
7. If step 4 fails → show "Cannot reach platform at {url}"
8. If step 5 fails with 401 → show "Invalid API token"
9. If step 5 fails with other error → show "Connection error: {status}"
```

**Fetch Projects Response (200):**
```json
{
  "success": true,
  "data": [
    { "id": "550e8400-e29b-41d4-a716-446655440000", "name": "My Tests", "isDefault": true },
    { "id": "660e8400-e29b-41d4-a716-446655440001", "name": "Smoke Tests", "isDefault": false }
  ],
  "pagination": { "page": 1, "limit": 100, "total": 2 }
}
```

Populate the Project dropdown with these projects. Pre-select the one with `isDefault: true` if no project was previously selected.

### Storage Schema

```typescript
interface ExtensionSettings {
  platformUrl: string;      // e.g., "https://saveaction.example.com"
  apiToken: string;         // e.g., "sa_live_abc123..."
  selectedProjectId: string; // UUID of selected project (required for upload)
  selectedProjectName: string; // For display purposes
  autoUpload: boolean;      // default: false
  defaultTags: string;      // comma-separated, e.g., "smoke,regression"
}
```

Use `chrome.storage.sync.get()` and `chrome.storage.sync.set()` to read/write.

### Important Notes

- The API token is sensitive — use `type="password"` for the input
- Do NOT store the token in `localStorage` — only use `chrome.storage.sync` (encrypted by Chrome)
- The Platform URL should NOT include `/api` at the end — just the base domain
- Validate URL format before saving (must start with `http://` or `https://`)
- The settings page styling should match the existing extension popup design (colors, fonts, spacing)

---

## Task 2: Auto-Upload to Platform

### What to Build

When a user **stops a recording** and the auto-upload setting is enabled, automatically upload the recording JSON to the SaveAction platform API, then show a success/failure notification. Always still offer the local download as fallback.

### Upload Flow

```
User clicks "Stop Recording"
        │
        ▼
  Generate recording JSON (existing logic)
        │
        ├── Always trigger local download (existing behavior — keep this!)
        │
        ▼
  Check: Is auto-upload enabled?
  (chrome.storage.sync → autoUpload === true && platformUrl && apiToken && selectedProjectId)
        │
       NO → Done (just the local download)
        │
       YES ↓
        │
  Show "Uploading to platform..." indicator in popup
        │
        ▼
  POST {platformUrl}/api/v1/recordings
  Headers:
    Authorization: Bearer {apiToken}
    Content-Type: application/json
  Body: {
    name: recording.testName,
    tags: defaultTags.split(',').map(t => t.trim()).filter(Boolean),
    data: <the full recording JSON object>
  }
        │
        ├── Success (201) → Show "✅ Uploaded to platform" notification
        │                    Show recording name in success message
        │                    Optionally show link to open in platform: {platformUrl}/projects
        │
        ├── Failure (401) → Show "❌ Upload failed: Invalid API token"
        │                    Recording was still saved locally (download)
        │
        ├── Failure (413/400) → Show "❌ Upload failed: Recording too large or invalid"
        │
        ├── Network error → Show "❌ Upload failed: Cannot reach platform"
        │                    Recording was still saved locally (download)
        │
        └── Retry logic:
            - Retry up to 2 times with 2-second delay between retries
            - Only retry on network errors (not on 401/400/413)
            - After all retries fail, show final error
```

### API Contract: Upload Recording

**Endpoint:** `POST /api/v1/recordings`

**Headers:**
```
Authorization: Bearer sa_live_<64 hex characters>
Content-Type: application/json
```

**Request Body:**
```json
{
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Login Flow Test",
  "tags": ["smoke", "login"],
  "data": {
    "id": "rec_1708534800000",
    "testName": "Login Flow Test",
    "url": "https://example.com/login",
    "startTime": "2026-02-21T10:00:00.000Z",
    "viewport": { "width": 1920, "height": 1080 },
    "userAgent": "Mozilla/5.0 ...",
    "actions": [
      {
        "id": "act_001",
        "type": "click",
        "timestamp": 1708534801000,
        "url": "https://example.com/login",
        "selector": { ... }
      }
    ],
    "version": "1.0.0"
  }
}
```

**`projectId`** is **required** — UUID of the project where the recording will be stored (from the Project dropdown).  
**`name`** is optional — if omitted, the API uses `data.testName` as the recording name.  
**`tags`** is optional — array of strings, max 20 tags, each max 50 chars.  
**`data`** is required — the full recording JSON object the extension already generates.

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Login Flow Test",
    "url": "https://example.com/login",
    "tags": ["smoke", "login"],
    "actionCount": 15,
    "createdAt": "2026-02-21T10:05:00.000Z"
  }
}
```

**Error Responses:**
| Status | Code | Meaning |
|--------|------|---------|
| 400 | `VALIDATION_ERROR` | Invalid recording structure |
| 401 | `UNAUTHORIZED` | Missing or invalid API token |
| 413 | `TOO_LARGE` | Recording exceeds 10MB limit |
| 409 | `DUPLICATE_ORIGINAL_ID` | Recording with same `data.id` already uploaded |

### Duplicate Handling

The API rejects duplicate uploads based on `data.id` (the `rec_<timestamp>` ID). If a user uploads the same recording twice, they get a 409 error. The extension should handle this gracefully:

- On 409: Show "Recording already exists on platform" (informational, not an error)
- Do NOT retry on 409

### Notification UI

After upload completes (success or failure), show a notification in the popup. Options:

1. **In-popup notification** — A small banner/toast at the top of the popup showing status (preferred)
2. **Chrome notification** — Use `chrome.notifications.create()` as supplementary (the popup might be closed by the time upload finishes)

Use **both**: show in popup if it's open, and always fire a Chrome notification so the user sees it even if they closed the popup.

```typescript
// Chrome notification example
chrome.notifications.create('upload-success', {
  type: 'basic',
  iconUrl: 'icons/icon48.png',
  title: 'SaveAction',
  message: 'Recording "Login Flow Test" uploaded to platform',
});
```

### Upload Function Implementation

Create a dedicated module/function for the upload logic. Here's the structure:

```typescript
interface UploadResult {
  success: boolean;
  recordingId?: string;     // Platform's UUID for the recording
  recordingName?: string;
  error?: string;
  errorCode?: string;       // API error code
  alreadyExists?: boolean;  // true if 409 duplicate
}

async function uploadRecording(
  platformUrl: string,
  apiToken: string,
  projectId: string,         // Required: UUID of the selected project
  recording: Recording,      // The recording JSON object
  tags: string[]
): Promise<UploadResult> {
  const url = `${platformUrl.replace(/\/+$/, '')}/api/v1/recordings`;
  
  const maxRetries = 2;
  let lastError: string | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: projectId,
          name: recording.testName,
          tags: tags,
          data: recording,
        }),
      });

      if (response.status === 201) {
        const result = await response.json();
        return {
          success: true,
          recordingId: result.data.id,
          recordingName: result.data.name,
        };
      }
      
      if (response.status === 409) {
        return {
          success: false,
          alreadyExists: true,
          error: 'Recording already exists on platform',
          errorCode: 'DUPLICATE',
        };
      }
      
      // Don't retry client errors (400, 401, 413)
      if (response.status >= 400 && response.status < 500) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error?.message || `Upload failed (${response.status})`,
          errorCode: errorData.error?.code || 'UPLOAD_FAILED',
        };
      }
      
      // Server errors (5xx) — retry
      lastError = `Server error (${response.status})`;
    } catch (err) {
      // Network errors — retry
      lastError = err instanceof Error ? err.message : 'Network error';
    }
    
    // Wait before retry (not on last attempt)
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return {
    success: false,
    error: lastError || 'Upload failed after retries',
    errorCode: 'NETWORK_ERROR',
  };
}
```

### Integration Point

The upload should be triggered from whatever function currently handles "stop recording". The flow is:

```
existing stopRecording()
  │
  ├── existing: build recording JSON
  ├── existing: trigger download
  │
  └── NEW: call uploadIfEnabled(recording)
          │
          ├── load settings from chrome.storage.sync
          ├── check autoUpload === true && platformUrl && apiToken && selectedProjectId
          ├── if yes → call uploadRecording(platformUrl, apiToken, selectedProjectId, recording, tags)
          ├── show notification based on result
          └── if no → do nothing (download-only mode)
```

**Do NOT block the download** on the upload. The download should happen immediately. The upload runs in parallel (async, fire-and-forget from the user's perspective).

---

## Architecture Notes

### API Token Format

SaveAction API tokens look like: `sa_live_<64 hex characters>`  
Example: `sa_live_a1b2c3d4e5f6...` (68 characters total)

The token is sent in the `Authorization` header as a Bearer token:
```
Authorization: Bearer sa_live_a1b2c3d4e5f6...
```

### Required Token Scopes

To upload recordings, the API token needs the **`recordings:write`** scope. Users create tokens in the SaveAction web UI at **Settings → API Tokens**.

When the connection test hits `GET /api/v1/recordings?limit=1`, it needs the **`recordings:read`** scope. So the token needs at minimum:
- `recordings:read` (for connection test)
- `recordings:write` (for upload)

If the user's token doesn't have these scopes, the API returns `403 Forbidden`. Handle this in the connection test by showing: "API token does not have recording permissions".

### CORS Considerations

The extension makes requests from a Chrome extension context (`chrome-extension://...` origin). The SaveAction API has CORS configured with `credentials: true`. For Chrome extensions:

- Extensions are **exempt from CORS** when using `chrome.runtime` or when the host is declared in the `manifest.json` `permissions`
- Add the platform URL pattern to the extension's `host_permissions` in `manifest.json`:
  ```json
  {
    "host_permissions": [
      "https://*/*",
      "http://localhost:*/*"
    ]
  }
  ```
- If `host_permissions` already has broad patterns like `<all_urls>`, no changes needed
- Alternatively, use `fetch()` from the **background script (service worker)** which is not subject to CORS

### Recording JSON Structure

The extension already produces this JSON. For reference, this is what the `data` field in the upload body must contain:

```typescript
interface Recording {
  id: string;           // "rec_<timestamp>" — generated by extension
  testName: string;     // User-provided name from the "Start Recording" dialog
  url: string;          // Starting URL when recording began
  startTime: string;    // ISO 8601 timestamp
  endTime?: string;     // ISO 8601 timestamp (set when recording stops)
  viewport: {
    width: number;
    height: number;
  };
  userAgent: string;    // Browser user agent string
  actions: Action[];    // Array of recorded user actions
  version: string;      // Schema version (currently "1.0.0")
}
```

You do NOT need to modify the recording structure. Just send the existing recording object as-is inside the `data` field of the upload request.

---

## File Organization Suggestion

```
extension/
├── popup/
│   ├── popup.html          # Add settings view toggle
│   ├── popup.js            # Add settings view logic
│   └── popup.css           # Add settings styles
├── settings/               # NEW (or inline in popup)
│   ├── settings.html       # Settings panel template
│   └── settings.js         # Settings logic + connection test
├── platform/               # NEW
│   ├── upload.js           # uploadRecording() function
│   └── connection.js       # testConnection() function
├── background/
│   └── service-worker.js   # Add upload trigger on recording stop
└── manifest.json           # May need host_permissions update
```

Or if the extension uses a different structure, adapt accordingly. The key is:
- **Settings logic** is separate and reusable
- **Upload logic** is in its own module
- **Connection test** is shared between settings and upload (e.g., to pre-validate before upload)

---

## Testing Checklist

After implementing, verify these scenarios:

### Settings Page
- [ ] Settings icon visible in popup (both recording and idle states)
- [ ] Can switch between main view and settings view
- [ ] Platform URL input validates format (rejects invalid URLs)
- [ ] API token input is masked (password type)
- [ ] Auto-upload toggle works and persists
- [ ] Default tags input saves comma-separated values
- [ ] "Test Connection" with valid URL + token → green success
- [ ] "Test Connection" with invalid URL → shows "Cannot reach platform"
- [ ] "Test Connection" with invalid token → shows "Invalid API token"
- [ ] "Test Connection" with valid URL but wrong scope → shows permission error
- [ ] Settings persist after closing and reopening popup
- [ ] Connection status indicator shows on main view

### Auto-Upload
- [ ] Recording with auto-upload OFF → only downloads locally (no API call)
- [ ] Recording with auto-upload ON but no settings → only downloads locally
- [ ] Recording with auto-upload ON + valid settings → downloads locally AND uploads
- [ ] Download is NOT blocked/delayed by upload
- [ ] Successful upload → shows success notification with recording name
- [ ] Failed upload (401) → shows auth error, local download still works
- [ ] Failed upload (network) → retries 2 times, then shows error
- [ ] Duplicate upload (409) → shows "already exists" message (not an error)
- [ ] Chrome notification fires even if popup is closed
- [ ] Very large recording (near 10MB) → handles gracefully
- [ ] Multiple recordings uploaded in sequence → each gets separate notification

---

## Summary

| Task | What | Why |
|------|------|-----|
| **Settings Page** | UI for platform URL, API token, auto-upload toggle, connection test | Users need to configure where recordings go |
| **Auto-Upload** | POST recording JSON to platform API after recording stops | Eliminates manual download → upload workflow, enables seamless CI/CD pipeline |

The recording JSON the extension already produces is exactly what the API expects in the `data` field. No format changes needed — just wrap it in `{ name, tags, data }` and POST it with the API token.
