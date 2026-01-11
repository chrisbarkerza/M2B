# M2B Repository Split Implementation Plan

## Context

This document contains the complete implementation plan for splitting the M2B repository into two repositories to restore privacy while maintaining all functionality.

**Current Problem:**
- M2B repo is PUBLIC (required for free GitHub Pages hosting)
- All markdown files containing personal data (shopping lists, todos, notes, projects) are publicly visible
- Need to separate the public PWA app from private data

**Solution:**
- Split into two repos: M2B (public, PWA only) and M2B-Data (private, all data)
- PWA accesses private data via GitHub API using personal access token
- GitHub Actions workflow operates across both repos

## Architecture Overview

```
┌─────────────────────────────────────┐
│  M2B (PUBLIC)                       │
│  - PWA app files (docs/)            │
│  - GitHub Actions workflow          │
│  - Documentation (README, guides)   │
│  - No sensitive data                │
│  - No skills (moved to private)     │
└─────────────────────────────────────┘
                ↓
           GitHub Pages
        (hosts PWA app)

┌─────────────────────────────────────┐
│  M2B-Data (PRIVATE)                 │
│  - All markdown files (md/)         │
│  - Shopping lists                   │
│  - Todo items                       │
│  - Projects                         │
│  - Notes                            │
│  - inbox-log.md                     │
│  - Claude skills (.claude/skills/)  │
│  - CLAUDE.md (with data locations)  │
└─────────────────────────────────────┘
                ↑
          GitHub API
     (PWA accesses via token)
```

## Why This Works

The PWA already uses the **GitHub REST API** (not GitHub Pages) to read/write markdown files:

1. PWA app shell is served from GitHub Pages (public, static files)
2. When user opens PWA, they enter a GitHub Personal Access Token
3. PWA makes API calls to `api.github.com` with that token
4. Token can access **private repositories** if it has `repo` scope
5. All data operations happen through authenticated API calls

**Key insight:** The PWA repository can be public while the data repository is private, because they communicate via API, not direct file access.

## Implementation Steps

### Phase 0: Pre-Migration Backup

**CRITICAL: Do this first to prevent data loss**

```bash
# Create backup branch in current M2B repo
git checkout -b backup-before-split
git push origin backup-before-split

# Also create local backup
cd /Users/chrisbarker/Repos
cp -r M2B M2B-backup-$(date +%Y%m%d)
```

### Phase 1: Create Private M2B-Data Repository

#### Step 1.1: Create Repository on GitHub

1. Go to https://github.com/new
2. Repository name: `M2B-Data`
3. Description: "Private data storage for M2B personal knowledge management system"
4. **Visibility: Private** ✓
5. Initialize with README: Yes
6. Click "Create repository"

#### Step 1.2: Clone and Set Up M2B-Data

```bash
# Clone the new private repo
cd /Users/chrisbarker/Repos
git clone https://github.com/chrisbarkerza/M2B-Data.git
cd M2B-Data

# Copy files from M2B to M2B-Data
cp -r ../M2B/md ./
cp -r ../M2B/.claude ./
cp ../M2B/CLAUDE.md ./

# Verify structure
tree -L 2
# Should show:
# .
# ├── README.md
# ├── CLAUDE.md
# ├── .claude/
# │   └── skills/
# └── md/
#     ├── Shopping/
#     ├── ToDo/
#     ├── Projects/
#     ├── Notes/
#     └── inbox-log.md
```

#### Step 1.3: Update M2B-Data README

Edit `README.md` in M2B-Data:

```markdown
# M2B-Data

Private data storage for the M2B (My Second Brain) personal knowledge management system.

## What This Repo Contains

- **md/** - All markdown files organized by type:
  - Shopping/ - Shopping lists and completed items
  - ToDo/ - Task lists and completed tasks
  - Projects/ - Project files with actions and notes
  - Notes/ - General notes and meeting notes
  - inbox-log.md - Audit trail of all captures

- **.claude/** - Claude Code skills for local CLI usage
  - skills/m2b-inbox/ - Capture and classification skill

- **CLAUDE.md** - Instructions for Claude Code when working with this repo

## Related Repository

The public M2B repository (https://github.com/chrisbarkerza/M2B) contains:
- PWA web application for browsing and capturing
- GitHub Actions workflow for automated processing
- Public documentation

## Privacy

This repository is **private** and contains personal data. The PWA accesses this data through the GitHub API using a personal access token.

## Usage

For local CLI usage with Claude Code:
1. Clone this repository
2. Open in Claude Code
3. Use `/m2b-inbox` skill to capture items
4. Files are updated directly in the `md/` directory
```

#### Step 1.4: Commit and Push Initial Structure

```bash
cd /Users/chrisbarker/Repos/M2B-Data
git add .
git commit -m "Initial data migration from M2B repo

- Move md/ directory with all markdown files
- Move .claude/ directory with skills
- Move CLAUDE.md configuration
- Add README explaining repository purpose"
git push origin main
```

#### Step 1.5: Verify Private Repo Access

Test that your token can access the private repo:

```bash
# Replace YOUR_TOKEN with your actual GitHub PAT
curl -H "Authorization: token YOUR_TOKEN" \
  https://api.github.com/repos/chrisbarkerza/M2B-Data/contents/md/Shopping/Shopping.md
```

Should return JSON with base64-encoded file content.

---

### Phase 2: Update GitHub Actions Workflow

#### Step 2.1: Create GitHub Personal Access Token

**Important:** You'll need to create a GitHub Personal Access Token (PAT) for both:
1. GitHub Actions workflow (to access M2B-Data repo)
2. PWA settings (to access M2B-Data from your browser)

You can use the **same token** for both, or create separate tokens.

**To create a new token:**

1. Go to https://github.com/settings/tokens/new
   - Or navigate: GitHub Profile → Settings → Developer settings → Personal access tokens → Tokens (classic)

2. Fill in token details:
   - **Note:** "M2B Data Access Token" (or any descriptive name)
   - **Expiration:** Choose based on preference:
     - 1 year (more secure, need to regenerate annually)
     - No expiration (convenient, but less secure)
   - **Scopes:** Check **`repo`** (full control of private repositories)
     - This gives read/write access to all your repos (public and private)
     - This is the minimum required scope for M2B to work

3. Click "Generate token" at the bottom

4. **CRITICAL: Copy the token immediately!**
   - Token looks like: `ghp_abc123...xyz789` (starts with `ghp_`)
   - GitHub shows it only once
   - If you lose it, you'll need to regenerate a new one

5. **Save the token securely:**
   - Option 1: Password manager (1Password, Bitwarden, etc.)
   - Option 2: Secure notes app
   - Option 3: Write it down temporarily (delete after setup complete)

**What if you lose the token?**
- You can't recover a lost token
- Simply delete the old token and create a new one
- Update the new token in:
  1. GitHub Actions secrets (M2B repo)
  2. PWA settings (each device/browser)

#### Step 2.2: Add Token as Repository Secret

1. Go to https://github.com/chrisbarkerza/M2B/settings/secrets/actions
2. Click "New repository secret"
3. Name: `DATA_REPO_TOKEN`
4. Secret: Paste the token you just created
5. Click "Add secret"

#### Step 2.3: Update Workflow File

Edit `.github/workflows/process-capture.yml`:

```yaml
name: Process Capture

on:
  issues:
    types: [labeled]

jobs:
  process:
    if: github.event.label.name == 'capture'
    runs-on: ubuntu-latest

    env:
      DATA_REPO: chrisbarkerza/M2B-Data
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      DATA_REPO_TOKEN: ${{ secrets.DATA_REPO_TOKEN }}
      ISSUE_NUMBER: ${{ github.event.issue.number }}
      ISSUE_TITLE: ${{ github.event.issue.title }}
      ISSUE_BODY: ${{ github.event.issue.body }}

    steps:
      - name: Checkout M2B repo (for scripts)
        uses: actions/checkout@v3
        with:
          path: m2b

      - name: Checkout M2B-Data repo (for markdown files)
        uses: actions/checkout@v3
        with:
          repository: chrisbarkerza/M2B-Data
          token: ${{ secrets.DATA_REPO_TOKEN }}
          path: m2b-data

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd m2b/.github/scripts
          npm install

      - name: Process capture
        run: |
          cd m2b/.github/scripts
          node process-capture.js
        env:
          DATA_REPO_PATH: ../../m2b-data

      - name: Commit changes to M2B-Data
        run: |
          cd m2b-data
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add .
          git commit -m "M2B: Process capture from issue #${{ github.event.issue.number }}" || echo "No changes to commit"
          git push

      - name: Comment on issue
        uses: actions/github-script@v6
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          script: |
            const fs = require('fs');
            const result = JSON.parse(fs.readFileSync('m2b/.github/result.json', 'utf8'));

            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: result.comment
            });

      - name: Close issue
        uses: actions/github-script@v6
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          script: |
            await github.rest.issues.update({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              state: 'closed'
            });
```

#### Step 2.4: Update process-capture.js Script

Edit `.github/scripts/process-capture.js`:

**Key changes:**
1. Accept `DATA_REPO_PATH` environment variable
2. Use that path for all file operations instead of hardcoded paths
3. Continue to use `GITHUB_TOKEN` for issue operations (M2B repo)

At the top of the file, add:

```javascript
const DATA_REPO_PATH = process.env.DATA_REPO_PATH || '../../';
```

Then replace all file path references from:
```javascript
const filePath = `md/Shopping/Shopping.md`;
```

To:
```javascript
const filePath = path.join(DATA_REPO_PATH, 'md/Shopping/Shopping.md');
```

And at the very top, add:
```javascript
const path = require('path');
```

**Full file operation changes:**

Find this pattern:
```javascript
const shoppingPath = 'md/Shopping/Shopping.md';
const todoPath = 'md/ToDo/ToDo.md';
const inboxLogPath = 'md/inbox-log.md';
```

Replace with:
```javascript
const shoppingPath = path.join(DATA_REPO_PATH, 'md/Shopping/Shopping.md');
const todoPath = path.join(DATA_REPO_PATH, 'md/ToDo/ToDo.md');
const inboxLogPath = path.join(DATA_REPO_PATH, 'md/inbox-log.md');
```

Apply this pattern to all file reads and writes in the script.

#### Step 2.5: Test the Workflow

```bash
# Commit the workflow changes
cd /Users/chrisbarker/Repos/M2B
git add .github/
git commit -m "Update workflow to use separate M2B-Data repository"
git push

# Create a test issue
# Go to https://github.com/chrisbarkerza/M2B/issues/new
# Title: "Test Capture"
# Body: "Buy milk and eggs"
# Create issue, then add "capture" label

# Watch the workflow run:
# https://github.com/chrisbarkerza/M2B/actions

# Verify:
# 1. Workflow completes successfully
# 2. M2B-Data repo has new commit with updated Shopping.md
# 3. Issue has bot comment with classification
# 4. Issue is closed
```

---

### Phase 3: Update PWA Configuration

#### Step 3.1: Update app.js Default Repository

Edit `docs/js/app.js`, find line 8:

**Before:**
```javascript
const REPO = localStorage.getItem('github_repo') || 'chrisbarkerza/M2B';
```

**After:**
```javascript
const REPO = localStorage.getItem('github_repo') || 'chrisbarkerza/M2B-Data';
```

#### Step 3.2: Update Settings Modal Help Text

Edit `docs/index.html`, find the settings modal section (around line 343):

**Before:**
```html
<small class="help-text">
    Token needs 'repo' scope. Get one at
    <a href="https://github.com/settings/tokens/new" target="_blank">GitHub Settings</a>
</small>
```

**After:**
```html
<small class="help-text">
    Token needs 'repo' scope to access your private M2B-Data repository.
    <a href="https://github.com/settings/tokens/new" target="_blank">Create new token</a> |
    <a href="#" onclick="showTokenInstructions(); return false;">How to get a token?</a>
</small>
```

**Optional: Add token instructions modal/section:**

You can enhance the PWA by adding a help section that explains token creation. Add this to `docs/index.html` after the settings modal:

```html
<!-- Token Instructions Modal (optional) -->
<div id="token-instructions" style="display: none;">
    <h3>How to Get a GitHub Token</h3>
    <ol>
        <li>Go to <a href="https://github.com/settings/tokens/new" target="_blank">GitHub Token Settings</a></li>
        <li>Click "Generate new token (classic)"</li>
        <li>Give it a name: "M2B Access"</li>
        <li>Select expiration (1 year recommended)</li>
        <li>Check the <strong>repo</strong> scope (full control of private repositories)</li>
        <li>Click "Generate token" at the bottom</li>
        <li>Copy the token immediately (starts with ghp_)</li>
        <li>Paste it in the GitHub Token field above</li>
    </ol>
    <p><strong>Note:</strong> Keep your token secure. Don't share it with anyone.</p>
</div>
```

And add this JavaScript function to `docs/js/app.js`:

```javascript
function showTokenInstructions() {
    const instructions = document.getElementById('token-instructions');
    if (instructions) {
        instructions.style.display = instructions.style.display === 'none' ? 'block' : 'none';
    }
}
```

Also update the repository input help text (around line 349):

**Before:**
```html
<small class="help-text">Format: username/repository</small>
```

**After:**
```html
<small class="help-text">Default: chrisbarkerza/M2B-Data (your private data repo)</small>
```

#### Step 3.3: Update Service Worker Cache Version

Edit `docs/service-worker.js`, increment the cache version (line 1):

**Before:**
```javascript
const CACHE_NAME = 'm2b-v1';
```

**After:**
```javascript
const CACHE_NAME = 'm2b-v2';
```

This ensures users get the updated PWA code.

#### Step 3.4: Test PWA Locally

```bash
cd /Users/chrisbarker/Repos/M2B/docs
python3 -m http.server 8000

# Open browser to http://localhost:8000
```

**Configure PWA with your GitHub token:**

1. Click the **Settings** icon (⚙️) in the bottom navigation

2. In the Settings modal, you'll see:
   - **GitHub Token** field (password input)
   - **Repository** field (should default to `chrisbarkerza/M2B-Data`)

3. **Enter your GitHub token:**
   - Paste the token you created in Step 2.1
   - Format: `ghp_abc123...xyz789`
   - The token is stored in your browser's localStorage
   - It's never sent anywhere except GitHub API

4. Click **Test Connection** button (if available)
   - This validates your token has access to M2B-Data
   - You should see "Connection successful" or similar

5. Click **Save**

6. **Verify everything works:**
   - Navigate to Shopping tab - should load your shopping list from M2B-Data
   - Navigate to Todo tab - should load your todos from M2B-Data
   - Try adding a new item - should commit to M2B-Data
   - Try submitting a capture - should create issue and process

**Troubleshooting token entry:**

- **"Failed to load data"** → Token invalid or doesn't have `repo` scope
- **"404 Not Found"** → Token doesn't have access to M2B-Data (check repo is private and token has `repo` scope)
- **"Unauthorized"** → Token might be expired or revoked
- **Data loads but can't save** → Token might have read-only access (ensure `repo` scope, not just `public_repo`)

**To get a fresh token if needed:**
See "Step 2.1: Create GitHub Personal Access Token" above for detailed instructions.

#### Step 3.5: Deploy to GitHub Pages

```bash
cd /Users/chrisbarker/Repos/M2B
git add docs/
git commit -m "Update PWA to use M2B-Data private repository"
git push

# GitHub Pages will auto-deploy from docs/ folder
# Wait 1-2 minutes, then visit:
# https://chrisbarkerza.github.io/M2B/

# Test on mobile:
# 1. Open PWA URL on phone
# 2. Enter GitHub token in settings
# 3. Verify data loads from M2B-Data
# 4. Test offline mode works
# 5. Submit test capture
```

---

### Phase 4: Verify Claude Skills Work

#### Step 4.1: Clone M2B-Data Locally

```bash
cd /Users/chrisbarker/Repos
# Already cloned in Phase 1, so just navigate
cd M2B-Data
```

#### Step 4.2: Open in Claude Code

```bash
cd /Users/chrisbarker/Repos/M2B-Data
# Open in your IDE or Claude Code CLI
```

#### Step 4.3: Test m2b-inbox Skill

In Claude Code:
```
/m2b-inbox

Then provide input: "Buy protein powder"
```

Verify:
1. Skill runs successfully
2. `md/Shopping/Shopping.md` is updated with new item under appropriate section
3. `md/inbox-log.md` has new entry
4. Git shows uncommitted changes

#### Step 4.4: Commit Skill Test

```bash
cd /Users/chrisbarker/Repos/M2B-Data
git add .
git commit -m "Test: Verify m2b-inbox skill works in M2B-Data repo"
git push
```

---

### Phase 5: Clean Up Public M2B Repository

**ONLY do this after verifying everything works in Phases 1-4!**

#### Step 5.1: Delete Sensitive Directories

```bash
cd /Users/chrisbarker/Repos/M2B

# Double-check you're in the right repo!
pwd
# Should output: /Users/chrisbarker/Repos/M2B

# Delete directories (they're safe in M2B-Data)
git rm -r md/
git rm -r .claude/
git rm CLAUDE.md

# Verify what will be deleted
git status
```

#### Step 5.2: Create New Public README

Create `README.md` in M2B repo:

```markdown
# M2B - My Second Brain

A progressive web app (PWA) for personal knowledge management with AI-powered capture and classification.

## 🔒 Privacy-First Architecture

M2B uses a **two-repository architecture** to keep your personal data private while keeping the app publicly available:

- **M2B (this repo)** - Public PWA application, GitHub Actions workflows
- **M2B-Data (private repo)** - Your personal markdown files, shopping lists, todos, projects, notes

The PWA accesses your private data through the GitHub API using your personal access token.

## ✨ Features

- **Three Capture Methods:**
  - GitHub Issues (mobile/desktop)
  - PWA web app with offline support
  - Claude Code CLI skills

- **AI Classification:** Automatically categorizes and files your captures using Claude Sonnet 4
- **Offline-First:** PWA works offline, syncs when connection restored
- **Mobile-Optimized:** Install as app on iOS/Android

## 🚀 Setup Your Own Instance

### 1. Fork This Repository

Click "Fork" to create your own copy of the M2B app.

### 2. Create Your Private Data Repository

1. Create a new **private** repository named `M2B-Data`
2. Copy the template structure:

```
M2B-Data/
├── README.md
├── CLAUDE.md (optional - for Claude Code)
├── .claude/
│   └── skills/
│       └── m2b-inbox/
└── md/
    ├── Shopping/
    │   ├── Shopping.md
    │   └── Done.md
    ├── ToDo/
    │   ├── ToDo.md
    │   └── Done.md
    ├── Projects/
    ├── Notes/
    └── inbox-log.md
```

### 3. Configure GitHub Actions

Add these secrets to your M2B repository:
- `ANTHROPIC_API_KEY` - Your Claude API key
- `DATA_REPO_TOKEN` - GitHub PAT with `repo` scope for M2B-Data access

### 4. Enable GitHub Pages

1. Go to Settings → Pages
2. Source: Deploy from branch `main` / `docs` folder
3. Save

### 5. Configure PWA

1. Visit your GitHub Pages URL: `https://[username].github.io/M2B/`
2. Open Settings in PWA
3. Enter your GitHub token (needs `repo` scope)
4. PWA will connect to your private M2B-Data repository

## 📱 Usage

### Capture via GitHub Issue
1. Create issue in M2B repo
2. Add "capture" label
3. Workflow classifies and files to M2B-Data

### Capture via PWA
1. Open PWA on mobile/desktop
2. Enter capture text
3. Submit → creates issue → automated processing

### Browse Data
- PWA has views for Shopping, Todo, Projects, Notes
- All data synced from your private M2B-Data repo

## 🔧 Development

```bash
# Serve PWA locally
cd docs
python3 -m http.server 8000

# Visit http://localhost:8000
```

## 📚 Documentation

See the original repository for full setup guides and architecture details.

## 🛡️ Security

- Your data stays in your **private** M2B-Data repository
- GitHub token stored in browser localStorage (client-side only)
- All API calls go through authenticated HTTPS
- Public M2B repo contains no personal data

## 📄 License

MIT License - Feel free to fork and customize!

---

**Note:** This is a personal knowledge management system. The public M2B repository only contains the application code. Your actual data lives in your private M2B-Data repository.
```

#### Step 5.3: Commit Changes

```bash
cd /Users/chrisbarker/Repos/M2B
git add README.md
git commit -m "Clean up: Remove data files, add two-repo architecture README

All data files have been migrated to private M2B-Data repository:
- md/ directory removed
- .claude/ directory removed
- CLAUDE.md removed

Public M2B repo now contains only:
- PWA application (docs/)
- GitHub Actions workflow
- Public documentation"
git push
```

#### Step 5.4: Verify GitHub Pages Still Works

Visit https://chrisbarkerza.github.io/M2B/

Should see:
- PWA loads correctly
- Settings modal works
- Can connect to M2B-Data with token
- No 404 errors

---

### Phase 6: Final Verification

#### Verification Checklist

- [ ] **M2B repo is public**
  - Visit https://github.com/chrisbarkerza/M2B
  - Confirm no `md/` directory visible
  - Confirm no `.claude/` directory visible
  - Confirm no CLAUDE.md file visible

- [ ] **M2B-Data repo is private**
  - Visit https://github.com/chrisbarkerza/M2B-Data
  - Should see "404" or require login when logged out
  - Log in, verify all data files present

- [ ] **GitHub Actions workflow works**
  - Create test issue: "Buy apples"
  - Add "capture" label
  - Wait for workflow to complete
  - Check M2B-Data for updated Shopping.md
  - Verify issue has bot comment and is closed

- [ ] **PWA works on desktop**
  - Visit https://chrisbarkerza.github.io/M2B/
  - Enter GitHub token in settings
  - View Shopping list - should load from M2B-Data
  - Add new shopping item - should commit to M2B-Data
  - Submit capture - should create issue and process

- [ ] **PWA works on mobile**
  - Open PWA on phone
  - Install as app (Add to Home Screen)
  - Test offline mode
  - Test capture submission
  - Verify data syncs when back online

- [ ] **Claude Code skills work**
  - Open M2B-Data repo in Claude Code
  - Run `/m2b-inbox`
  - Provide test input: "Call dentist tomorrow"
  - Verify md/ToDo/ToDo.md updated correctly
  - Verify inbox-log.md has entry

- [ ] **No data loss**
  - Compare M2B-Data `md/` directory with backup
  - All files should be identical
  - No missing content

---

## Rollback Plan

If something goes wrong, you can rollback:

### Quick Rollback (PWA only)

Edit `docs/js/app.js` line 8:
```javascript
const REPO = localStorage.getItem('github_repo') || 'chrisbarkerza/M2B';
```

This points PWA back to old public repo until you fix the issue.

### Full Rollback

```bash
cd /Users/chrisbarker/Repos/M2B
git checkout backup-before-split
git push origin backup-before-split:main --force

# Or restore from backup directory
cd /Users/chrisbarker/Repos
rm -rf M2B
cp -r M2B-backup-YYYYMMDD M2B
cd M2B
git push origin main --force
```

**Note:** Force push will overwrite history. Only use if absolutely necessary.

---

## Troubleshooting

### Issue: GitHub Actions can't access M2B-Data

**Symptoms:** Workflow fails with "Resource not accessible by integration"

**Solution:**
1. Verify `DATA_REPO_TOKEN` secret exists in M2B repo
2. Verify token has `repo` scope (not just `public_repo`)
3. Check token hasn't expired
4. Regenerate token if needed

### Issue: PWA shows "Failed to load data"

**Symptoms:** PWA can't read files from M2B-Data

**Solution:**
1. Check GitHub token in PWA settings
2. Verify token has `repo` scope
3. Test token with curl:
```bash
curl -H "Authorization: token YOUR_TOKEN" \
  https://api.github.com/repos/chrisbarkerza/M2B-Data
```
4. If 404, token doesn't have access to private repo

### Issue: Service Worker not updating

**Symptoms:** PWA still shows old data or old repo

**Solution:**
1. Clear browser cache
2. Unregister service worker in DevTools → Application → Service Workers
3. Hard refresh (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
4. On mobile: Delete app and reinstall from PWA URL

### Issue: Skills can't find files

**Symptoms:** `/m2b-inbox` skill errors with "file not found"

**Solution:**
1. Verify you're in M2B-Data repo, not M2B
2. Check directory structure:
```bash
ls -la md/
```
3. Skills expect to be run from repo root where `md/` exists

---

## Key Configuration Summary

### GitHub Repository Secrets (in M2B repo)

- `ANTHROPIC_API_KEY` - Claude API key for classification
- `DATA_REPO_TOKEN` - GitHub PAT with `repo` scope for M2B-Data access
- `GITHUB_TOKEN` - Auto-provided by GitHub Actions (for issue operations)

### Environment Variables (in workflow)

- `DATA_REPO` - Set to `chrisbarkerza/M2B-Data`
- `DATA_REPO_PATH` - Set to `../../m2b-data` (relative path in workflow)

### PWA Configuration

- Default repo: `chrisbarkerza/M2B-Data` (line 8 in app.js)
- User token: Stored in browser localStorage as `github_token`
- User can override repo in settings (advanced usage)

### File Paths

**M2B (public) structure:**
```
M2B/
├── docs/
│   ├── index.html
│   ├── js/app.js
│   ├── css/styles.css
│   ├── service-worker.js
│   └── manifest.json
├── .github/
│   ├── workflows/process-capture.yml
│   └── scripts/process-capture.js
└── README.md
```

**M2B-Data (private) structure:**
```
M2B-Data/
├── md/
│   ├── Shopping/
│   │   ├── Shopping.md
│   │   └── Done.md
│   ├── ToDo/
│   │   ├── ToDo.md
│   │   └── Done.md
│   ├── Projects/
│   ├── Notes/
│   └── inbox-log.md
├── .claude/
│   └── skills/
│       └── m2b-inbox/
├── CLAUDE.md
└── README.md
```

---

## Post-Migration Tasks

After successful migration:

1. **Update any bookmarks** to point to new repo structure
2. **Update mobile PWA** - may need to reinstall to get latest
3. **Inform any collaborators** about the new architecture
4. **Test all three capture methods** at least once
5. **Monitor first few automated captures** to ensure workflow stability
6. **Delete backup after 30 days** if everything working well:
   ```bash
   git push origin :backup-before-split
   rm -rf /Users/chrisbarker/Repos/M2B-backup-*
   ```

---

## Success Criteria

You'll know the migration is complete when:

✅ Public M2B repo has no `md/`, `.claude/`, or `CLAUDE.md` files
✅ Private M2B-Data repo has all your data
✅ PWA loads on mobile and desktop
✅ PWA can read/write to private M2B-Data via API
✅ GitHub issue with "capture" label triggers workflow
✅ Workflow updates M2B-Data repo successfully
✅ Issue gets bot comment and closes automatically
✅ Claude Code skills work from M2B-Data local clone
✅ No data loss - all files intact in M2B-Data
✅ Offline mode works in PWA

---

## Additional Notes

- **Token Security:** GitHub PAT is stored in browser localStorage. Anyone with access to your browser storage can see it. Use a token with minimal permissions (only `repo` scope for M2B-Data).

- **Token Rotation:** When you rotate your GitHub token, update it in:
  1. M2B repo secrets (DATA_REPO_TOKEN)
  2. PWA settings (each device separately)

  **How to rotate/regenerate a token:**
  1. Go to https://github.com/settings/tokens
  2. Find your "M2B Data Access Token"
  3. Click "Regenerate token" (or delete and create new)
  4. Copy the new token immediately
  5. Update in GitHub Actions:
     - Go to https://github.com/chrisbarkerza/M2B/settings/secrets/actions
     - Click on `DATA_REPO_TOKEN` → "Update secret"
     - Paste new token, save
  6. Update in PWA (on each device):
     - Open PWA → Settings
     - Paste new token in GitHub Token field
     - Click Save
     - Repeat on mobile/other devices

- **Backup Strategy:** M2B-Data is git-versioned. Every change is tracked. You can always rollback:
  ```bash
  cd M2B-Data
  git log  # find commit before bad change
  git revert <commit-hash>
  ```

- **Sharing:** If you want to share M2B with others:
  1. They fork your public M2B repo
  2. They create their own private M2B-Data repo
  3. They configure their own tokens
  4. Their data stays separate from yours

- **Cost:** Completely free:
  - GitHub Pages: Free for public repos
  - GitHub Actions: Free tier (2,000 minutes/month)
  - Private repos: Free (unlimited with GitHub Free)
  - Claude API: Pay per use (captures are cheap - ~500 tokens each)

---

## Timeline Estimate

- Phase 0 (Backup): 5 minutes
- Phase 1 (Create M2B-Data): 15 minutes
- Phase 2 (Update Actions): 30 minutes
- Phase 3 (Update PWA): 20 minutes
- Phase 4 (Test Skills): 10 minutes
- Phase 5 (Clean Up): 15 minutes
- Phase 6 (Verification): 20 minutes

**Total: ~2 hours** (including testing time)

---

## Questions to Ask If Resuming This Task

If you're starting a new chat session to implement this plan, provide:

1. **Current status:** Which phase are you on?
2. **Have you created M2B-Data yet?** (Phase 1)
3. **Do you have a GitHub PAT with `repo` scope?** (Phase 2)
4. **Have you tested the workflow locally?** (Phase 2.5)
5. **Has the PWA been updated and deployed?** (Phase 3)
6. **Any errors or issues so far?**

This will help Claude resume from the right point in the implementation.

---

**Last Updated:** 2026-01-11
**Status:** Ready to implement
**Estimated Completion:** 2 hours
**Risk Level:** Medium (good rollback plan exists)
