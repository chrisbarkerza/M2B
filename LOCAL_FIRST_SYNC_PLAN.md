# Local-First File Storage with Sync Plan

## Executive Summary

**Current Problem:**
- Every edit writes directly to GitHub API (slow, burns free tier quota)
- Unnecessary network traffic for every keystroke/interaction
- Poor UX: edits feel laggy waiting for GitHub responses

**Proposed Solution:**
- Store all files locally in IndexedDB (structured, high-capacity client storage)
- Track "dirty" (modified) files with timestamps
- Sync only changed files when user presses sync button or on app open
- Implement conflict detection to prevent data loss

**Complexity Assessment:** Medium
- Good foundation: clean separation of concerns, existing offline queue pattern
- Need to add: storage layer, dirty tracking, conflict resolution
- Estimated scope: ~400-600 lines of new code + refactoring existing write paths

---

## Architecture Overview

### Current Flow (Immediate Write)
```
User Edit → Update AppState → GitHub API Write → Show Toast
   ↓                                    ↓
  UI Update                    (or enqueue if offline)
```

### Proposed Flow (Local-First)
```
User Edit → Update AppState → Write to IndexedDB → Mark Dirty → UI Update
                                      ↓
                            (no network call)

Sync Button → Detect Dirty Files → Check Conflicts → Push to GitHub → Clear Dirty Flags
```

---

## Technical Design

### 1. Storage Layer: IndexedDB

**Why IndexedDB?**
- ✅ Large capacity (50MB+ typically, up to 100s of MB)
- ✅ Structured data with indexes for fast queries
- ✅ Async API (non-blocking)
- ✅ Native browser support (all modern browsers)
- ✅ Survives browser refresh/close
- ❌ More complex API than localStorage (but we'll abstract it)

**Alternative Considered: localStorage**
- ❌ 5-10MB limit (might hit limit with many files)
- ❌ Synchronous (blocks UI)
- ✅ Simpler API

**Decision:** IndexedDB for capacity and performance

**Database Schema:**

```javascript
Database: "M2B-LocalStorage"
Version: 1

ObjectStore: "files"
  - keyPath: "path" (e.g., "md/ToDo/Work.md")
  - Indexes:
    - "isDirty" (boolean index for fast dirty file queries)
    - "lastModified" (timestamp index for sorting)

File Record Structure:
{
  path: "md/ToDo/Work.md",           // Primary key
  content: "- [ ] Task 1\n...",      // Full file content
  lastModified: 1736729400000,       // Local edit timestamp
  isDirty: true,                     // Has unsaved changes?
  githubSHA: "abc123...",            // Last known GitHub SHA
  lastSynced: 1736729000000,         // Last successful push timestamp
  syncStatus: "dirty" | "synced" | "conflict"
}
```

### 2. New Component: LocalStorageManager

**Responsibilities:**
- Wrap IndexedDB in clean async API
- CRUD operations on local files
- Query dirty files
- Manage sync metadata

**API Design:**

```javascript
class LocalStorageManager {
  // Initialization
  static async init()

  // File operations
  static async getFile(path)
  static async saveFile(path, content, markDirty = true)
  static async getAllFiles(directory = null)
  static async deleteFile(path)

  // Dirty tracking
  static async getDirtyFiles()
  static async markClean(path, githubSHA)
  static async markConflict(path)

  // Sync metadata
  static async updateSHA(path, sha)
  static async getFileMetadata(path)

  // Bulk operations
  static async bulkSave(filesArray)
  static async clearAll() // For debugging
}
```

### 3. Modified Component: GitHubAPI

**Add Methods for Initial Load:**

```javascript
class GitHubAPI {
  // Existing methods remain unchanged

  // NEW: Fetch directory contents (already exists, document it)
  async getDirectoryContents(path)

  // NEW: Fetch single file with metadata
  async getFile(path) {
    // Returns: { content, sha, lastModified }
  }

  // NEW: Batch fetch multiple files
  async getFiles(paths) {
    // Returns array of file objects
  }
}
```

### 4. New Component: SyncManager

**Responsibilities:**
- Orchestrate sync process
- Detect conflicts
- Handle sync errors
- Report sync status to UI

**Conflict Detection Strategy:**

```javascript
Conflict occurs when:
  localFile.githubSHA !== currentGitHubSHA

Meaning: GitHub file changed since last local sync

Resolution Strategy (SIMPLE & SAFE):
  1. Detect conflict
  2. Show user a conflict modal:
     - "Remote file changed. Choose:"
     - [Keep Local] [Use Remote] [View Diff]
  3. User decides (no auto-merge)
  4. If "Keep Local": force push (update with old SHA fails, re-fetch SHA and retry)
  5. If "Use Remote": overwrite local, mark clean
```

**API Design:**

```javascript
class SyncManager {
  // Main sync entry point
  static async syncAll()

  // Sync workflow
  static async syncDirtyFiles()
  static async pushFile(path, content, localSHA)
  static async detectConflicts(dirtyFiles)
  static async resolveConflict(path, resolution)

  // Initial load (on app open)
  static async loadAllFromGitHub()

  // Status reporting
  static getSyncStatus() // { dirty: 3, conflicts: 1, lastSync: timestamp }
}
```

**Sync Algorithm:**

```javascript
async syncAll() {
  1. Check if online (if not, show toast and abort)
  2. Get all dirty files from LocalStorageManager
  3. For each dirty file:
     a. Fetch current GitHub file metadata (SHA)
     b. Compare localFile.githubSHA with current SHA
     c. If match:
        - Push content to GitHub
        - Update local githubSHA
        - Mark file clean
     d. If mismatch (conflict):
        - Mark file as conflict
        - Add to conflicts array
  4. Show sync summary toast:
     - "Synced 5 files, 2 conflicts"
  5. If conflicts exist, show conflict resolution UI
}
```

### 5. Modified Component: Viewer

**Changes to Write Paths:**

All methods that currently call `updateSourceFile()` remain mostly unchanged, but the implementation changes:

```javascript
// BEFORE (current)
async updateSourceFile(path, content, message, toastMessage) {
  const api = new GitHubAPI(AppState.token, AppState.repo);
  if (AppState.isOnline) {
    await api.updateFile(path, content, message);
    UI.showToast(toastMessage, 'success');
  } else {
    await QueueManager.enqueue({...});
    UI.showToast('Queued for sync', 'info');
  }
}

// AFTER (local-first)
async updateSourceFile(path, content, message, toastMessage) {
  // Save to local storage immediately
  await LocalStorageManager.saveFile(path, content, markDirty: true);

  // Update in-memory state
  // (existing code already does this)

  // Show instant feedback
  UI.showToast('Saved locally', 'success');

  // Update sync button badge
  UI.updateSyncBadge();
}
```

**Methods to Update:**
- `updateItemText()` → calls `updateSourceFile()`
- `completeItem()` / `moveItemToDone()` → calls `updateFile()` twice
- `reorderItems()` → calls `updateSourceFile()`
- `applyHighlight()` → calls `updateSourceFile()`

**Initial Load Changes:**

```javascript
// BEFORE (current)
async load(viewName) {
  const api = new GitHubAPI(AppState.token, AppState.repo);
  const files = await api.request(`/repos/${repo}/contents/${dir}`);
  // Parse and render
}

// AFTER (local-first)
async load(viewName) {
  // Try local first
  let files = await LocalStorageManager.getAllFiles(AppState.views[viewName].dir);

  if (files.length === 0) {
    // First load: fetch from GitHub
    await SyncManager.loadFromGitHub(viewName);
    files = await LocalStorageManager.getAllFiles(AppState.views[viewName].dir);
  }

  // Parse and render from local files
}
```

### 6. UI Changes

**Sync Button Enhancement:**

```javascript
// Current: Simple sync icon
// Proposed: Sync icon + badge

<button id="syncBtn">
  <span class="material-icons">sync</span>
  <span class="sync-badge" data-count="0">0</span>
</button>

Badge shows:
  - Count of dirty files
  - Color coding:
    - Blue: dirty files (normal)
    - Red: conflicts exist
    - Gray: all synced
```

**New: Sync Status Modal**

```javascript
Triggered by: Click sync button

Content:
  - List of dirty files
  - Last sync timestamp
  - Sync progress indicator
  - Conflict list (if any)
  - Actions:
    - [Sync Now]
    - [Resolve Conflicts]
    - [Cancel]
```

**New: Conflict Resolution Modal**

```javascript
Triggered by: Conflict detected during sync

Content per conflict:
  - File path
  - Local last modified: timestamp
  - Remote last modified: timestamp
  - Options:
    - [Keep Local] - Push your changes
    - [Use Remote] - Discard local, pull remote
    - [View Diff] - Show side-by-side (optional/future)
```

**Sync Toast Messages:**

```javascript
// On edit
"Saved locally"

// On sync start
"Syncing 3 files..."

// On sync success
"Synced 3 files successfully"

// On sync with conflicts
"Synced 2 files, 1 conflict detected"

// On sync error
"Sync failed: [error message]"
```

---

## Implementation Plan

### Phase 1: Foundation (No Breaking Changes)

**Goal:** Add local storage layer without changing existing behavior

**Tasks:**
1. Create `LocalStorageManager` class
   - Implement IndexedDB wrapper
   - Add file CRUD operations
   - Add dirty tracking queries
   - Test in browser console

2. Create `SyncManager` class skeleton
   - Add placeholder methods
   - Add status reporting
   - No sync logic yet

3. Update AppState
   - Add `AppState.syncStatus` object
   - Add listeners for dirty file count changes

**Testing:**
- Manual IndexedDB inspection in DevTools
- Test file save/load round-trips
- Verify dirty flag persistence

**Estimated Effort:** ~200 lines of code, 2-4 hours

---

### Phase 2: Wire Up Writes (Local-First Enabled)

**Goal:** All edits write to local storage instead of GitHub

**Tasks:**
1. Modify `Viewer.updateSourceFile()`
   - Call `LocalStorageManager.saveFile()`
   - Remove GitHub API calls
   - Update toast messages

2. Update all edit operations
   - `updateItemText()`
   - `moveItemToDone()` (both writes)
   - `reorderItems()`
   - `applyHighlight()`

3. Update initial load in `Viewer.load()`
   - Check local storage first
   - Fall back to GitHub on first run

4. Update sync button UI
   - Add badge to show dirty count
   - Wire up badge updates

**Testing:**
- Make edits, verify no GitHub calls (check Network tab)
- Verify edits persist in IndexedDB
- Verify dirty badge updates
- Refresh page, verify edits still present locally

**Estimated Effort:** ~100 lines changed, 1-2 hours

---

### Phase 3: Implement Sync Logic

**Goal:** Sync button pushes dirty files to GitHub

**Tasks:**
1. Implement `SyncManager.syncAll()`
   - Query dirty files
   - For each file, push to GitHub
   - Update local metadata (SHA, lastSynced)
   - Mark files clean

2. Implement conflict detection
   - Compare local SHA with GitHub SHA
   - Mark conflicts in local storage
   - Collect conflict list

3. Wire up sync button
   - Call `SyncManager.syncAll()` on click
   - Show progress indicator
   - Show results toast

4. Implement initial load optimization
   - On app open, check if online
   - If online, background sync dirty files
   - Load from local immediately (don't wait for sync)

**Testing:**
- Make local edits
- Click sync
- Verify files pushed to GitHub
- Verify dirty flags cleared
- Verify SHA updated

**Estimated Effort:** ~150 lines of code, 2-3 hours

---

### Phase 4: Conflict Resolution

**Goal:** Handle conflicts gracefully

**Tasks:**
1. Create conflict resolution modal HTML
   - Add to index.html
   - Style in styles.css

2. Implement `SyncManager.resolveConflict()`
   - "Keep Local": force push with new SHA
   - "Use Remote": fetch and overwrite local

3. Wire up conflict modal
   - Show on sync completion if conflicts exist
   - Populate with conflict details
   - Handle user choices

4. Add conflict indicator to sync badge
   - Red badge if conflicts present
   - Click badge opens conflict modal

**Testing:**
- Create conflict scenario:
  1. Edit file locally
  2. Edit same file on GitHub web
  3. Click sync
  4. Verify conflict detected
  5. Verify resolution options work

**Estimated Effort:** ~150 lines of code, 2-3 hours

---

### Phase 5: Polish & Edge Cases

**Goal:** Handle edge cases and improve UX

**Tasks:**
1. Handle offline queue migration
   - Process existing offline queue items
   - Migrate to new sync system
   - Remove old QueueManager (or keep for captures only)

2. Add sync status modal
   - Show detailed sync status
   - List dirty files
   - Show last sync time
   - Add manual "Fetch All from GitHub" button

3. Add error handling
   - Network errors during sync
   - GitHub API rate limit errors
   - Corrupted local storage recovery

4. Add settings
   - "Clear local storage" button
   - "Force full re-sync" button
   - Show storage usage

5. Optimize performance
   - Batch GitHub API calls where possible
   - Add debouncing to dirty badge updates
   - Lazy load files (don't load all at once)

**Testing:**
- Test offline → online transition
- Test rate limit handling
- Test local storage corruption recovery
- Test with large number of files

**Estimated Effort:** ~200 lines of code, 3-5 hours

---

## Migration Strategy (Zero Data Loss)

**Key Principle:** Don't delete anything until confirmed synced

**Migration Steps for Users:**

1. **Before Deployment:**
   - Ensure all offline queue items are synced
   - Verify no pending edits

2. **On First Load with New Code:**
   - Check if local storage is empty
   - If empty: perform initial load from GitHub
   - Populate IndexedDB with all files
   - Mark all as clean (synced)

3. **Offline Queue Handling:**
   - Keep QueueManager for now (backward compatibility)
   - On first load, process any existing queue
   - After queue processed, disable old queue
   - New edits use new local storage

**Code Migration Path:**

```javascript
// On app init
async function migrate() {
  const hasLocalStorage = await LocalStorageManager.hasData();

  if (!hasLocalStorage) {
    // First run with new code
    console.log("Migrating to local-first storage...");

    // Process old queue first
    await QueueManager.processQueue();

    // Load all files from GitHub
    await SyncManager.loadAllFromGitHub();

    localStorage.setItem('migrated_to_local_first', 'true');
  }
}
```

---

## Data Loss Prevention Strategies

### 1. **Never Auto-Merge Conflicts**
   - Always require user decision
   - Show clear options
   - Preserve both versions until user chooses

### 2. **Backup Before Destructive Operations**
   - Before "Use Remote", save local version to backup store
   - Keep last 10 backups
   - Add "Restore Backup" feature in settings

### 3. **Sync on App Open (Optional Background)**
   - On app open, if online, background sync
   - Don't block UI
   - Notify user of conflicts via badge

### 4. **Periodic Sync Reminder**
   - If dirty files exist for > 1 hour, show reminder toast
   - "You have 3 unsaved files. Sync now?"

### 5. **Export/Import Feature**
   - Add "Export local storage" button (download JSON)
   - Add "Import local storage" button
   - Manual backup option for paranoid users

---

## Performance Considerations

### Expected Improvements

**Before (Current):**
- Edit latency: 200-500ms (GitHub API round-trip)
- Network requests: 1 per edit
- Data transferred: ~1KB per edit (with GitHub API overhead)
- View load time: 200-500ms (fetch from GitHub)

**After (Local-First):**
- Edit latency: 5-10ms (IndexedDB write)
- Network requests: 0 during editing, batch on sync
- Data transferred: Only dirty files on sync
- View load time: 5-10ms (IndexedDB read)

**Estimated Improvements:**
- Edit responsiveness: **20-50x faster**
- GitHub API calls: **~90% reduction** (assuming 10 edits per sync)
- Data transfer: **~80% reduction** (no redundant writes)

### Potential Bottlenecks

1. **Initial load from GitHub**
   - Could be slow if many files
   - Solution: Show progress indicator, lazy load by directory

2. **Large files in IndexedDB**
   - IndexedDB is fast but not instant for large datasets
   - Solution: Pagination, virtual scrolling (already exists in viewer)

3. **Sync with many dirty files**
   - GitHub API rate limit: 5000 req/hour (authenticated)
   - Solution: Batch updates, throttle if approaching limit

---

## Rollback Plan

**If things go wrong:**

1. **Keep old code in git branch**
   - Tag current version: `v1-immediate-write`
   - Create new branch: `local-first`
   - Can revert easily

2. **Feature flag**
   - Add setting: "Use local-first mode"
   - Default: enabled
   - If disabled: use old immediate write mode
   - Keep both code paths until stable

3. **Data recovery**
   - Export local storage before major changes
   - Keep old queue system functional
   - GitHub is source of truth (can always re-fetch)

---

## Testing Strategy

### Manual Testing Checklist

**Core Functionality:**
- [ ] Edit item text → saves locally
- [ ] Complete item → saves locally
- [ ] Reorder items → saves locally
- [ ] Apply highlight → saves locally
- [ ] Switch views → loads from local
- [ ] Refresh page → local edits persist
- [ ] Click sync → pushes to GitHub
- [ ] Verify GitHub updated (check web UI)

**Conflict Scenarios:**
- [ ] Edit locally + edit on GitHub → conflict detected
- [ ] Resolve with "Keep Local" → local pushed
- [ ] Resolve with "Use Remote" → local overwritten
- [ ] Multiple conflicts → all resolved

**Edge Cases:**
- [ ] Offline editing → queues locally
- [ ] Go online → sync works
- [ ] Network error during sync → graceful retry
- [ ] Empty local storage → loads from GitHub
- [ ] Corrupted local storage → recovers

**Performance:**
- [ ] Edit 100 items rapidly → no lag
- [ ] Load view with 500 items → fast
- [ ] Sync 50 dirty files → completes in reasonable time

### Automated Testing (Optional Future Work)

```javascript
// Example unit tests
describe('LocalStorageManager', () => {
  it('should save and retrieve files', async () => {
    await LocalStorageManager.saveFile('test.md', 'content');
    const file = await LocalStorageManager.getFile('test.md');
    expect(file.content).toBe('content');
  });

  it('should track dirty files', async () => {
    await LocalStorageManager.saveFile('test.md', 'content', true);
    const dirty = await LocalStorageManager.getDirtyFiles();
    expect(dirty).toContainEqual(expect.objectContaining({ path: 'test.md' }));
  });
});
```

---

## Security Considerations

**No New Risks:**
- GitHub token already in localStorage (unchanged)
- IndexedDB is client-side only (same origin policy)
- No new authentication required

**Improved Security:**
- Fewer API calls = less token exposure over network
- Local storage encrypted by browser (same as localStorage)

**Considerations:**
- Shared device: Local storage visible to anyone with browser access
  - Solution: Already a risk with current token storage
  - Recommendation: Use browser profiles/incognito for sensitive data

---

## Open Questions for User

Before implementation, confirm:

1. **Conflict Resolution:**
   - Is manual resolution acceptable, or need auto-merge?
   - **Recommendation:** Manual is safer for personal data

2. **Sync Trigger:**
   - Only on button click, or also on app open?
   - **Recommendation:** Both (button for explicit, app open for background)

3. **Offline Queue:**
   - Keep for captures, remove for file edits?
   - **Recommendation:** Remove for edits (replaced by sync), keep for captures

4. **Backup Frequency:**
   - Should we auto-export backups periodically?
   - **Recommendation:** Optional manual export, no auto-backup

5. **Migration:**
   - Automatic on next deploy, or feature flag?
   - **Recommendation:** Automatic (simpler)

---

## Summary

**Feasibility:** ✅ Definitely doable
**Complexity:** Medium (not trivial, but well-scoped)
**Risk:** Low (good rollback options, GitHub is source of truth)
**Benefit:** High (major UX improvement, API usage reduction)

**Recommended Approach:**
- Implement in phases (foundation → writes → sync → conflicts → polish)
- Test thoroughly at each phase
- Keep old code available for rollback
- Ship incrementally if possible

**Estimated Total Effort:**
- Code: ~600-800 lines new + ~200 lines modified
- Time: 10-15 hours (spread across phases)
- Testing: 3-5 hours

**Key Success Factors:**
1. Solid conflict detection (prevent data loss)
2. Clear user feedback (sync status, conflicts)
3. Robust error handling (network failures, rate limits)
4. Good migration path (zero data loss during transition)

This plan prioritizes **simplicity and safety** over complexity. No fancy CRDT or auto-merge algorithms—just straightforward local storage with explicit sync and user-driven conflict resolution.
