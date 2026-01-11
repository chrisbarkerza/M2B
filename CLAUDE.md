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
Audit Trail (md/inbox-log.md)
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
- Markdown files in simplified `md/` structure
- No frontmatter (keep it simple!)
- Git version control for history
- Audit trail in `md/inbox-log.md`

### Critical Design Patterns

**Bouncer Pattern**: When AI confidence < 75%, system asks for clarification instead of auto-filing

**Dual Output Modes** in m2b-inbox skill:
- **Interactive Mode** (CLI): Conversational, writes files directly using tools
- **Automation Mode** (GitHub Actions): JSON-only output with file operations for script execution

**Confidence Scoring**: Every classification includes 0-100 confidence score
- ≥75%: Auto-file
- <75%: Ask for clarification

## Data Model

### File Organization

```
md/
├── Shopping/
│   ├── Shopping.md              # Main shopping list
│   └── Done.md                  # Completed items with dates
├── ToDo.md                      # All tasks organized by urgency
├── Done.md                      # Completed tasks with dates
├── Projects/
│   ├── {project-name}.md        # One file per project
│   └── Done/                    # Manually moved completed projects
├── Notes/
│   ├── {note-name}.md           # One file per note
│   └── Done/                    # Manually moved archived notes
└── inbox-log.md                 # Audit trail
```

### File Formats

**Shopping** (`md/Shopping/Shopping.md`):
```markdown
# Shopping List

## Supplements
- [ ] Protein powder
- [ ] Multivitamins

## Pharmacy
- [ ] Pain relievers
- [ ] First aid supplies

## Food
- [ ] Milk
- [ ] Eggs
```

**Shopping Done** (`md/Shopping/Done.md`):
```markdown
# Shopping - Completed

- [x] Protein powder (completed: 2026-01-11)
- [x] Milk (completed: 2026-01-10)
```

**ToDo** (`md/ToDo.md`):
```markdown
# To Do

## Today
- [ ] Call dentist
- [ ] Submit report

## Soon
- [ ] Review project proposal
- [ ] Book flight

## Long term
- [ ] Research new framework
- [ ] Plan summer vacation
```

**ToDo Done** (`md/Done.md`):
```markdown
# To Do - Completed

- [x] Call dentist (completed: 2026-01-11)
- [x] Submit report (completed: 2026-01-11)
```

**Projects** (`md/Projects/website-redesign.md`):
```markdown
# Website Redesign

## Actions
- [ ] Research design trends
- [ ] Create wireframes
- [ ] Get client approval
- [x] Initial discovery meeting (completed: 2026-01-10)

## Notes
Client wants modern, clean look. Focus on mobile-first design.
Budget: $10k. Timeline: 6 weeks.
```

**Notes** (`md/Notes/meeting-jan-11.md`):
```markdown
# Team Meeting - January 11

## Key Points
- Q1 goals finalized
- New hire starting next week
- Budget approved for new tools

## Action Items
- [ ] Send welcome email to new hire
- [ ] Order equipment
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

### Claude Code Skills

**Invoke capture skill**:
```bash
# In Claude Code CLI
/m2b-inbox
# Then provide natural language: "Buy milk and eggs"
```

**Available skills** (in `.claude/skills/`):
- `m2b-inbox/` - Capture and classify input (ACTIVE)

## Making Changes

### Adding New Categories

To add a new category type:

1. Update `m2b-inbox` skill classification logic in `.claude/skills/m2b-inbox/skill.md`
2. Add section to existing file OR create new directory structure
3. Update `process-capture.js` file operations handler
4. Update PWA views in `docs/js/app.js` if needed

### Modifying Classification Logic

Edit `.claude/skills/m2b-inbox/skill.md`:
- Classification rules are in system prompt
- Urgency detection keywords
- Shopping category detection
- Confidence scoring heuristics
- Output format (JSON schema for automation mode)

### Adding PWA Features

The PWA uses vanilla JavaScript (no build step):
1. Edit `docs/js/app.js` for logic
2. Edit `docs/index.html` for structure
3. Edit `docs/css/styles.css` for styling
4. Update `docs/service-worker.js` for offline caching

## Important Constraints

### Confidence Scoring Rules

Calculate confidence based on:
- **High (90-100)**: Explicit keywords ("buy", "today", specific category)
- **Medium (75-89)**: Clear intent, minor ambiguity
- **Low (<75)**: Vague or multi-interpretable input → trigger Bouncer

### Urgency Detection (for ToDo)

**Today**: "today", "tonight", "ASAP", "urgent", "now"
**Soon**: "tomorrow", "this week", weekday names, "next few days"
**Long term**: "next week", "next month", "eventually", "sometime", no deadline

### Shopping Category Detection

**Supplements**: vitamins, protein, supplements, health products
**Pharmacy**: medications, first aid, healthcare items
**Food**: groceries, snacks, beverages, food items

### File Naming Conventions

- Slugify titles: lowercase, hyphens, no special chars
- Max 50 characters
- Conflict resolution: append `-2`, `-3`, etc.
- Example: "AI-Powered Recipe App" → "ai-powered-recipe-app.md"

### Git Commit Messages

Format: `M2B: Process capture from issue #{number}`
- Automated commits by GitHub Actions
- Manual commits can use any format

## Testing Capture Flow

**End-to-end test**:
1. Create GitHub issue with "capture" label and body: "Buy milk and eggs"
2. Verify GitHub Actions workflow runs successfully
3. Check `md/Shopping/Shopping.md` for new items under ## Food
4. Check `md/inbox-log.md` for audit entry
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

- `md/Shopping/Shopping.md` - Main shopping list with 3 sections
- `md/ToDo.md` - All tasks organized by urgency (Today/Soon/Long term)
- `md/Done.md` - Completed tasks with dates
- `md/Shopping/Done.md` - Completed shopping items with dates
- `md/inbox-log.md` - Append-only audit trail, never delete entries
- `.github/result.json` - Temporary file created by process-capture.js, read by workflow

## Completion Workflow

### Shopping Items

When user checks an item in Shopping.md:
1. Move item from Shopping.md to Shopping/Done.md
2. Add completion date: `- [x] Item (completed: YYYY-MM-DD)`

### ToDo Items

When user checks a task in ToDo.md:
1. Move item from ToDo.md to Done.md
2. Add completion date: `- [x] Task (completed: YYYY-MM-DD)`

### Project Actions

When user checks an action item in a project file:
1. Keep in same file (don't move to separate file)
2. Move to bottom of ## Actions section
3. Add completion date: `- [x] Action (completed: YYYY-MM-DD)`

When entire project is complete:
1. User manually moves file from `md/Projects/` to `md/Projects/Done/`

### Notes

When user checks an action item in a note:
1. Keep in same file
2. Move to bottom of section
3. Add completion date: `- [x] Item (completed: YYYY-MM-DD)`

When entire note should be archived:
1. User manually moves file from `md/Notes/` to `md/Notes/Done/`

## UI/UX Guidelines

**Icons**: This app uses Lucide SVG icons only (https://lucide.dev). All icons should be inline SVG from Lucide.

## User Context

- User: Chris Barker (chrisbarkerza)
- Primary usage: Mobile capture throughout day, desktop review
- Preferences: Simple structure, minimal frontmatter, manual archiving
- Working style: Big todo list view, tick items off, archive when done
