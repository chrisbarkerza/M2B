# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## System Overview

M2B (My Second Brain) is an AI-powered personal knowledge management system with three complementary capture interfaces:

1. **GitHub Issues** (mobile/desktop) - Primary capture method via issues with "capture" label
2. **PWA Web App** (docs/) - Progressive Web App with offline support for browsing and quick capture
3. **Claude Code Skills** (.claude/skills/) - Direct CLI-based capture and management

The system follows a "Dropbox → Classifier → Filing Cabinet" pattern where captures flow through AI classification into organized markdown files.

## Architecture

### Data Flow

```
Capture Input (GitHub Issue OR PWA OR CLI)
    ↓
AI Classifier (Claude Sonnet 4 via m2b-inbox skill)
    ↓
Classification Result (JSON with confidence score)
    ↓
File Operations (append/create markdown files)
    ↓
Audit Trail (inbox-log.md)
    ↓
GitHub Commit (automated)
```

### Three-Tier Architecture

**1. Capture Layer**
- GitHub Issues: Creates issue with "capture" label → triggers GitHub Actions workflow
- PWA: Posts to GitHub Issues API, polls for result, displays classification
- CLI: Uses m2b-inbox skill directly

**2. Processing Layer**
- GitHub Actions (`.github/workflows/process-capture.yml`): Triggered by issue label
- Node.js script (`.github/scripts/process-capture.js`): Calls Claude API with m2b-inbox prompt
- Returns JSON with classification and file operations
- Comments result back to issue, closes it

**3. Storage Layer**
- Markdown files with YAML frontmatter in `md/` directory
- Structured by type and context (personal/work)
- Git version control for history
- Audit trail in `md/inbox/inbox-log.md`

### Critical Design Patterns

**Bouncer Pattern**: When AI confidence < 75%, system asks for clarification instead of auto-filing

**Dual Output Modes** in m2b-inbox skill:
- **Interactive Mode** (CLI): Conversational, writes files directly using tools
- **Automation Mode** (GitHub Actions): JSON-only output with file operations for script execution

**Confidence Scoring**: Every classification includes 0-100 confidence score
- ≥75%: Auto-file
- <75%: Ask for clarification
- 100%: User-corrected (via m2b-fix skill)

## Data Model

### Frontmatter Schema

All markdown files use structured YAML frontmatter. Templates in `md/templates/`:

**Projects** (`md/projects/{context}/{status}/{slug}.md`):
```yaml
type: project
title: string
context: personal | work
status: active | waiting | blocked | done
priority: low | medium | high | critical
created: YYYY-MM-DD
updated: YYYY-MM-DD
tags: []
blockers: []          # if blocked
waiting_on: string    # if waiting
linked_ideas: []
next_actions: []
confidence: 0-100
```

**People** (`md/people/{relationship}/{slug}.md`):
```yaml
type: person
name: string
relationship: family | friends | professional | business
context: personal | work
created: YYYY-MM-DD
updated: YYYY-MM-DD
tags: []
birthday: YYYY-MM-DD (optional)
confidence: 0-100
```

**Ideas** (`md/ideas/{domain}/{slug}.md`):
```yaml
type: idea
title: string
domain: tech | business | personal | creative
maturity: seed | developing | validated | mature | abandoned
created: YYYY-MM-DD
updated: YYYY-MM-DD
tags: []
linked_projects: []
potential_value: low | medium | high
effort: low | medium | high | unknown
confidence: 0-100
```

**Tasks** (inline in `md/admin/{context}/{urgency}.md`):
```markdown
## Active
- [ ] **Task description** (due: YYYY-MM-DD) [confidence: 85] #tag

## Completed
- [x] **Task description** (completed: YYYY-MM-DD) [confidence: 92]
```

**Shopping** (inline in `md/shopping.md`):
```markdown
## {Category}
- [ ] Item name
- [x] Completed item
```

### File Organization

```
md/
├── projects/{context}/{status}/     # personal|work / active|waiting|blocked|done
├── people/{relationship}/            # family|friends|professional|business
├── ideas/{domain}/                   # tech|business|personal|creative
├── admin/{context}/                  # personal|work
│   ├── urgent.md                    # Due within 7 days
│   └── longer-term.md               # Due later or no deadline
├── notes/{category}/                 # daily|meetings|reference
├── shopping.md                       # Shopping list (root level for quick access)
├── inbox/inbox-log.md               # Audit trail
└── templates/                        # Frontmatter schemas
```

## Development Commands

### GitHub Actions (Automated Capture)

No manual commands needed - workflow triggers automatically on GitHub Issue with "capture" label.

**Testing the workflow locally**:
```bash
cd .github/scripts
npm install
ANTHROPIC_API_KEY="your-key" ISSUE_BODY="Buy milk" ISSUE_TITLE="Capture" ISSUE_NUMBER="1" node process-capture.js
```

### PWA Development

**Serve locally**:
```bash
cd docs
python3 -m http.server 8000
# Visit http://localhost:8000
```

**Deploy to GitHub Pages**:
```bash
git add docs/
git commit -m "Update PWA"
git push
# Automatic deployment via .github/workflows/pages.yml
```

**PWA App Structure**:
- `docs/index.html` - Single page app with bottom navigation
- `docs/js/app.js` - All JavaScript (no build step)
- `docs/css/styles.css` - All styles
- `docs/service-worker.js` - Offline caching and background sync
- `docs/manifest.json` - PWA manifest for installation

**Key PWA Classes**:
- `GitHubAPI` - GitHub REST API client
- `DataParser` - Parse markdown frontmatter
- `UI` - View management and rendering
- `QueueManager` - Offline sync queue

### Claude Code Skills

**Invoke capture skill**:
```bash
# In Claude Code CLI
/m2b-inbox
# Then provide natural language: "Buy milk and eggs"
```

**Available skills** (in `.claude/skills/`):
- `m2b-inbox/` - Capture and classify input (ACTIVE)
- `m2b-digest/` - Daily digest generator (PLANNED)
- `m2b-review/` - Weekly review (PLANNED)
- `m2b-fix/` - Fix misclassifications (PLANNED)

## Making Changes

### Adding New Categories

1. Update `m2b-inbox` skill classification logic
2. Add template to `md/templates/{category}.md`
3. Create directory structure in `md/`
4. Update PWA views in `docs/js/app.js` if needed
5. Update `process-capture.js` file operations handler

### Modifying Classification Logic

Edit `.claude/skills/m2b-inbox/skill.md`:
- Classification rules are in system prompt
- Context detection keywords
- Confidence scoring heuristics
- Output format (JSON schema for automation mode)

### Adding PWA Features

The PWA uses vanilla JavaScript (no build step):
1. Edit `docs/js/app.js` for logic
2. Edit `docs/index.html` for structure
3. Edit `docs/css/styles.css` for styling
4. Update `docs/service-worker.js` for offline caching

**Key PWA patterns**:
- Bottom navigation switches views by toggling `.active` class
- Data loaded lazily when view first accessed
- Offline queue stored in `localStorage`
- GitHub API pagination for large result sets

### Modifying Frontmatter Schema

1. Update template file in `md/templates/`
2. Update m2b-inbox skill output format
3. Update PWA parser in `docs/js/app.js` (`DataParser.parseFrontmatter()`)
4. Update GitHub Actions script if automation mode affected

## Important Constraints

### Confidence Scoring Rules

Calculate confidence based on:
- **High (90-100)**: Explicit keywords ("buy", "idea:", due date with task)
- **Medium (75-89)**: Clear intent, minor ambiguity (context unclear)
- **Low (<75)**: Vague or multi-interpretable input → trigger Bouncer

### Context Detection Priority

1. Explicit keywords: "work", "office" → work; "personal", "home" → personal
2. Time heuristic: 9am-5pm weekdays slightly favor work
3. Default: personal (safer assumption for privacy)

### File Naming Conventions

- Slugify titles: lowercase, hyphens, no special chars
- Conflict resolution: append `-{context}` or `-{timestamp}`
- Preserve original title in frontmatter `title` field

### Git Commit Messages

Format: `M2B: Process capture from issue #{number}`
- Automated commits by "M2B Bot" user
- Manual commits can use any format

## Testing Capture Flow

**End-to-end test**:
1. Create GitHub issue with "capture" label and body: "Buy milk and eggs"
2. Verify GitHub Actions workflow runs successfully
3. Check `md/shopping.md` for new items
4. Check `md/inbox/inbox-log.md` for audit entry
5. Verify issue has bot comment with classification result
6. Verify issue is closed

**PWA test**:
1. Open PWA in browser
2. Enter GitHub token in settings
3. Submit capture: "Call dentist tomorrow"
4. Verify GitHub issue created
5. Wait 2-10 seconds for result card to appear
6. Check result shows confidence and file location

## Special Files

- `md/shopping.md` - At root level (not in subdirectory) for quick mobile access
- `md/inbox/inbox-log.md` - Append-only audit trail, never delete entries
- `.github/result.json` - Temporary file created by process-capture.js, read by workflow

## User Context

- User: Chris Barker (chrisbarkerza)
- Primary usage: Mobile capture throughout day, desktop review
- Preferences: Prefers todo lists with priority, manual archiving, custom ordering
- Working style: Big todo list view, tick items off, archive completed work
