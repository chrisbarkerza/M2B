# My Second Brain (M2B)

An AI-powered "Second Brain" system built with Claude Code CLI, markdown files, and Git. Capture thoughts effortlessly, let AI classify and organize them automatically, and receive daily/weekly digests - all with zero additional subscriptions.

## Overview

This system implements the "Second Brain" concept using the 8 essential building blocks:

1. **Dropbox (Capture)**: Claude Project "My Second Brain - Inbox" for frictionless natural language capture
2. **Sorter (Classifier)**: AI classification with confidence scoring
3. **Form (Schema)**: Structured frontmatter templates for consistency
4. **Filing Cabinet**: Organized markdown files in git
5. **Receipt (Audit Trail)**: Complete log in `inbox/inbox-log.md`
6. **Bouncer**: Asks for clarification when confidence < 75%
7. **Tap on Shoulder**: Daily digest and weekly review skills
8. **Fix Button**: Easy corrections via `/m2b-fix` skill

## Tech Stack

- **Capture**: Claude Projects (Android app + web)
- **Storage**: Markdown files with YAML frontmatter
- **Version Control**: Git + GitHub (private repo)
- **AI**: Claude via Claude Code CLI skills
- **Cost**: $0 (using existing Claude Pro subscription)

## Directory Structure

```
M2B/
├── projects/          # Multi-step projects
│   ├── personal/      # Personal projects
│   │   ├── active/
│   │   ├── waiting/
│   │   ├── blocked/
│   │   └── done/
│   └── work/          # Work projects
│       └── (same structure)
├── people/            # Relationship management
│   ├── family/
│   ├── friends/
│   └── professional/
├── ideas/             # Future possibilities
│   ├── tech/
│   ├── business/
│   ├── personal/
│   └── creative/
├── admin/             # Tasks and todos
│   ├── personal/
│   │   ├── urgent.md        # Due within 7 days
│   │   └── longer-term.md   # Future tasks
│   └── work/
│       ├── urgent.md
│       └── longer-term.md
├── notes/             # General notes
│   ├── daily/
│   ├── meetings/
│   └── reference/
├── shopping.md        # Shopping list (at root for quick mobile access)
├── inbox/
│   └── inbox-log.md   # Audit trail of all captures
└── templates/         # Frontmatter schemas
```

## Quick Start

### Daily Capture (Mobile or Desktop)

1. Open Claude Project "My Second Brain - Inbox"
2. Type naturally: "Buy milk and eggs"
3. AI classifies and saves (or asks for clarification)
4. See confirmation: "✓ Saved to shopping.md (confidence: 95%)"
5. Forget about it - your second brain remembers

### Examples

- "Idea: Build an AI-powered recipe app"
- "Call mom tomorrow about her birthday"
- "Met John at coffee shop - wants to collaborate on podcast project"
- "Buy milk, eggs, bread"
- "Website redesign project blocked waiting on client feedback"

## Skills

### `/m2b-inbox` - Process Captures (Coming in Phase 2)

Automatically classifies natural language input into appropriate categories:
- **Projects**: Multi-step endeavors (personal/work)
- **People**: Relationships and interactions
- **Ideas**: Future possibilities with domain tags
- **Admin**: Tasks (urgent <7 days, longer-term)
- **Shopping**: Items to purchase
- **Notes**: General information

**Confidence Scoring**: Shows confidence (0-100) for every classification
**Bouncer Pattern**: Asks clarification if confidence < 75%

### `/m2b-digest` - Daily Digest (Coming in Phase 4)

Generates <150 word actionable summary each morning:
- Urgent tasks due soon
- Projects needing attention
- Upcoming important dates
- Quick wins from longer-term tasks

### `/m2b-review` - Weekly Review (Coming in Phase 4)

Comprehensive weekly system health check:
- Wins this week (completed tasks)
- Stale projects (no update >14 days)
- Low-confidence items to verify
- Looking ahead (next 14 days)
- System health metrics
- Suggested actions

### `/m2b-fix` - Fix Misclassifications (Coming in Phase 3)

Correct classification errors conversationally:
- "That should be a project, not a note"
- AI moves, reformats, updates audit log
- Confidence updated to 100% (user-corrected)

## How It Works

### Capture → Classify → Store → Retrieve

1. **Capture**: Type natural language in Claude Project
2. **Classify**: AI detects context (personal/work), category, extracts data
3. **Confidence Check**: If < 75%, ask for clarification (bouncer)
4. **Store**: Write to appropriate file with correct frontmatter
5. **Audit**: Log entry in inbox-log.md with timestamp and confidence
6. **Retrieve**: Daily digest and weekly review surface what matters

### Context Detection

- **Work keywords**: "work", "office", "manager", "client", "meeting"
- **Personal keywords**: "family", "home", "personal", "weekend", "friend"
- **Default**: personal (safer assumption)

### Category Classification

| Input Pattern | Category | Example |
|--------------|----------|---------|
| "Buy X" or list | shopping | "Buy milk and eggs" |
| Person + relationship | people | "Met Sarah for coffee" |
| "Idea:" or "what if" | ideas | "Idea: AI recipe app" |
| Due date + action | admin (urgent) | "Call dentist tomorrow" |
| Multi-step + goal | project | "Website redesign - need to research frameworks" |
| General info | note | "Meeting notes from client call" |

### Idea Domain Tagging

Ideas are automatically tagged by domain:
- **Tech**: app, software, AI, code, tool, automation
- **Business**: startup, revenue, customer, market, product
- **Personal**: habit, health, fitness, relationship, home
- **Creative**: writing, art, music, design, story

Can have multiple domains and links to related projects.

## Git Workflow

### Initial Setup (Do Once)

```bash
cd /Users/chrisbarker/Repos/M2B
git init
git config user.name "Your Name"
git config user.email "your-email@example.com"

# Create GitHub private repo
gh repo create M2B --private --source=. --remote=origin
git add .
git commit -m "Initial commit: Second Brain structure"
git push -u origin main
```

### Daily Workflow

**Option A: Manual commits** (recommended for start)
```bash
git add .
git commit -m "Update second brain"
git push
```

**Option B: Auto-commit** (skills handle this automatically)
- Each skill commits after writing files
- Message format: "Add [category]: [title] (confidence: XX%)"

### Mobile Sync

- GitHub acts as central repository
- Desktop: `git pull` before work, `git push` after
- Mobile: Claude Project (cloud-based) always current
- Shopping list accessible via GitHub mobile app
- Optional: Clone repo on mobile via MGit (Android) or Working Copy (iOS)

## Templates

All markdown files use YAML frontmatter for structure. See [templates/](templates/) for schemas:

- [project.md](templates/project.md) - Projects (title, status, priority, next actions)
- [person.md](templates/person.md) - People (name, relationship, birthday, interactions)
- [idea.md](templates/idea.md) - Ideas (title, domain, maturity, linked projects)
- [note.md](templates/note.md) - Notes (title, source, key takeaways)

Admin tasks and shopping use inline formats in their respective files.

## Trust Mechanisms

1. **Transparency**: Confidence scores on every classification
2. **Audit trail**: inbox-log.md preserves all captures
3. **Non-destructive**: Git history, nothing ever deleted
4. **Explicit confirmations**: "✓ Saved as X in Y (confidence: Z%)"
5. **Easy corrections**: `/m2b-fix` skill is conversational
6. **Regular reviews**: Daily/weekly digests surface issues

## Edge Cases

- **Duplicates**: System checks recent captures and asks before adding duplicates
- **Multi-category**: Creates entries in multiple locations with cross-links
- **Vague input**: Bouncer asks for clarification
- **Bulk captures**: "Buy milk, eggs. Call mom. Idea for app" → parsed as 3 separate items
- **Conflicts**: File name conflicts handled via context suffix or timestamp

## Success Metrics

Track these to ensure system health:

### Trust Indicators
- Average confidence score trending up
- Correction rate (m2b-fix usage) trending down
- Bouncer clarifications resolving ambiguity

### Usage Indicators
- Daily captures happening consistently
- Daily digest read each morning
- Weekly review completed on schedule

### System Health
- Inbox size stays near zero
- Fewer stale projects over time
- Task completion rate stable/increasing

### Efficiency Gains
- Capture time < 30 seconds
- Retrieval time < 1 minute
- Weekly maintenance < 10 minutes

## Implementation Status

### ✅ Phase 1: Foundation (COMPLETE)
- Directory structure created
- Template files with frontmatter schemas
- Initial admin and shopping files
- inbox-log.md audit trail initialized
- README documentation
- Git repository ready

### 🔄 Phase 2: Core Classifier (NEXT)
- Build `/m2b-inbox` skill
- Implement confidence scoring
- Implement bouncer pattern
- Test with sample captures

### ⏳ Phase 3: Storage & Audit (UPCOMING)
- File writing logic
- inbox-log.md append system
- Edge case handling
- `/m2b-fix` skill

### ⏳ Phase 4: Digests & Reviews (UPCOMING)
- `/m2b-digest` skill
- `/m2b-review` skill

### ⏳ Phase 5: Automation (UPCOMING)
- Git auto-commit (optional)
- GitHub Actions for daily digest (optional)

### ⏳ Phase 6: Real-World Usage (ONGOING)
- 2 weeks daily use
- Refinement based on corrections
- Adjust confidence threshold if needed

## Files Reference

### Critical Files Created
- [README.md](README.md) - This file
- [.gitignore](.gitignore) - Ignore patterns
- [templates/project.md](templates/project.md) - Project schema
- [templates/person.md](templates/person.md) - Person schema
- [templates/idea.md](templates/idea.md) - Idea schema
- [templates/note.md](templates/note.md) - Note schema
- [admin/personal/urgent.md](admin/personal/urgent.md) - Urgent tasks
- [admin/personal/longer-term.md](admin/personal/longer-term.md) - Future tasks
- [shopping.md](shopping.md) - Shopping list
- [inbox/inbox-log.md](inbox/inbox-log.md) - Audit trail

### Skills (To Be Created)
- `.claude/skills/m2b-inbox/` - Classifier skill
- `.claude/skills/m2b-digest/` - Daily digest skill
- `.claude/skills/m2b-review/` - Weekly review skill
- `.claude/skills/m2b-fix/` - Correction skill

## Future Enhancements

- Smart linking between files (auto-detect references)
- Natural language search across all files
- Habit tracking for recurring tasks
- Project templates for common types
- OCR for receipts and business cards
- Voice capture via dictation
- Analytics dashboard for trends
- AI suggestions for stale items

## Support

For issues or questions:
- Check [inbox-log.md](inbox/inbox-log.md) for audit trail
- Review confidence scores if classifications seem off
- Use `/m2b-fix` to correct misclassifications
- Adjust confidence threshold if too many bouncer requests

## License

Personal use system - all rights reserved.

---

**Remember**: Your brain is for thinking, not storing. Let your Second Brain remember, so you can focus on creating.
