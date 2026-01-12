# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

M2B (My Second Brain) is a privacy-first Progressive Web App (PWA) for personal knowledge management with AI-powered capture and classification. It uses a two-repository architecture:

- **M2B** (this repo) - Public PWA application hosted on GitHub Pages
- **M2B-Data** (private repo) - Personal markdown files (shopping lists, todos, projects, notes)

The PWA is a client-side only application that accesses private data through the GitHub API using a personal access token stored in the browser's localStorage.

## Development Commands

### Local Development Server
```bash
cd docs
python3 -m http.server 8000
# Visit http://localhost:8000
```

There are no build steps, tests, or compilation required. The app is pure HTML/CSS/JavaScript served directly from the `docs` folder.

### GitHub Actions Workflow
```bash
# Install dependencies for capture processing script
cd .github/scripts
npm install
```

## Architecture

### Two-Repository Pattern
- PWA code lives in public `M2B` repository
- User's personal data lives in private `M2B-Data` repository
- GitHub Actions workflow in M2B processes captures and writes to M2B-Data
- PWA authenticates with GitHub token (stored in browser localStorage) to read/write M2B-Data

### Local-First Sync System
The app implements a local-first architecture to reduce GitHub API calls and improve responsiveness:

1. **LocalStorageManager** ([docs/js/LocalStorageManager.js](docs/js/LocalStorageManager.js)) - IndexedDB wrapper for storing files locally with dirty tracking
2. **SyncManager** ([docs/js/SyncManager.js](docs/js/SyncManager.js)) - Orchestrates sync between IndexedDB and GitHub, handles conflict detection
3. **Viewer** ([docs/js/viewer.js](docs/js/viewer.js)) - Renders views (Tasks, Projects, Notes, Shopping) from local storage
4. **GitHubAPI** (in [docs/js/app.js](docs/js/app.js)) - GitHub API wrapper for CRUD operations

### Data Flow

**On Edit:**
```
User Edit → Update AppState → LocalStorageManager.saveFile() → Mark Dirty → Update UI
```

**On Sync:**
```
Sync Button → SyncManager.syncAll() → Push Dirty Files to GitHub → Update Metadata → Clear Dirty Flags
```

**On Initial Load:**
```
App Start → Check LocalStorageManager → If empty, load from GitHub → Store in IndexedDB → Render
```

### File Structure
```
docs/
├── index.html           # PWA entry point (1000+ lines, all views in one file)
├── manifest.json        # PWA manifest
├── service-worker.js    # Offline support
├── css/styles.css       # All styling
└── js/
    ├── app.js           # Main app logic, GitHubAPI, UI, AppState (1745 lines)
    ├── viewer.js        # Shared accordion viewer for list-based views (1263 lines)
    ├── LocalStorageManager.js   # IndexedDB wrapper (353 lines)
    └── SyncManager.js   # Sync orchestration (412 lines)

.github/
├── workflows/
│   ├── process-capture.yml    # AI classification workflow
│   └── pages.yml              # GitHub Pages deployment
└── scripts/
    ├── process-capture.js     # Claude API integration for capture classification
    └── package.json
```

## Key Components

### AppState (app.js)
Global state object containing:
- `token` - GitHub personal access token
- `repo` - Data repository name (default: `chrisbarkerza/M2B-Data`)
- `issuesRepo` - Issues repository name (default: `chrisbarkerza/M2B`)
- `isOnline` - Network connectivity status
- `currentView` - Active view name
- `data` - Cached view data
- `syncStatus` - Sync state (dirty count, conflicts, last sync time)

### Viewer Object (viewer.js)
Shared accordion renderer for Tasks, Projects, Notes, Shopping views. Key methods:
- `load(viewName)` - Load view from local storage (or GitHub on first load)
- `parseCheckboxItems(markdown)` - Parse markdown checkboxes into items
- `render(viewName)` - Render accordion UI
- `updateSourceFile(path, content, message, toastMessage)` - Save file to local storage and mark dirty

### LocalStorageManager (LocalStorageManager.js)
IndexedDB wrapper with schema:
```javascript
{
  path: "md/ToDo/Work.md",
  content: "- [ ] Task 1\n...",
  lastModified: 1736729400000,
  isDirty: true,
  githubSHA: "abc123...",
  lastSynced: 1736729000000,
  syncStatus: "dirty" | "synced" | "conflict"
}
```

Key methods:
- `saveFile(path, content, markDirty)` - Save to IndexedDB
- `getFile(path)` - Retrieve from IndexedDB
- `getDirtyFiles()` - Query files needing sync
- `markClean(path, githubSHA)` - Clear dirty flag after successful sync

### SyncManager (SyncManager.js)
Orchestrates syncing with conflict detection:
- `syncAll()` - Main sync entry point
- `syncDirtyFiles()` - Push dirty files to GitHub
- `loadAllFromGitHub(viewName)` - Initial data load
- Conflict detection: compares local `githubSHA` with current GitHub SHA
- Manual conflict resolution (user chooses "Keep Local" or "Use Remote")

## Capture Flow

Three capture methods all converge on GitHub Issues:

1. **GitHub Issue** - User creates issue with `capture` label
2. **PWA Capture** - PWA creates issue via GitHub API with `capture` label
3. **Claude Code Skill** - CLI tool creates issue with `capture` label

Once labeled with `capture`:
1. GitHub Actions workflow triggers ([.github/workflows/process-capture.yml](.github/workflows/process-capture.yml))
2. Claude API classifies the capture (Shopping, Todo, Project, or Note)
3. Script appends to appropriate markdown file in M2B-Data repo
4. Workflow comments result on issue and closes it

## Important Patterns

### All edits write to local storage first
Never write directly to GitHub API during user interaction. Always:
```javascript
await LocalStorageManager.saveFile(path, content, true); // markDirty=true
UI.showToast('Saved locally', 'success');
UI.updateSyncBadge();
```

### Sync badge shows dirty file count
The sync button badge ([docs/index.html](docs/index.html) `#syncBadge`) displays count of files with unsaved changes. Update it after any edit.

### Conflict resolution is manual
When local `githubSHA` doesn't match GitHub's current SHA, mark as conflict and show modal for user to resolve. Never auto-merge.

### Service worker caches for offline
[service-worker.js](docs/service-worker.js) implements cache-first strategy for static assets and network-first for API calls.

## GitHub Secrets Required

For the GitHub Actions workflow to function:
- `ANTHROPIC_API_KEY` - Claude API key for AI classification
- `DATA_REPO_TOKEN` - GitHub PAT with `repo` scope for M2B-Data access

## Important Notes

- The entire PWA UI is in a single [index.html](docs/index.html) file (900+ lines)
- No framework used - vanilla JavaScript with manual DOM manipulation
- All state lives in the global `AppState` object
- Views (Tasks, Projects, Notes, Shopping, Ideas, People) share the same accordion rendering logic via `Viewer`
- GitHub token is stored in browser localStorage - app is client-side only
- IndexedDB provides ~50MB+ storage vs localStorage's ~5MB limit
- The app works fully offline once cached, syncing when connection returns
