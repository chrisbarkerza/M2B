# Second Brain Usage Guide

## Quick Start

Your Second Brain is now ready to use! Here's everything you need to know.

## 🎯 Core Concept

**Your brain is for thinking, not storing.** This system captures, classifies, and surfaces information automatically so you can focus on what matters.

## 📱 Setting Up Claude Project (IMPORTANT - Do This First!)

1. Open Claude (web or Android app)
2. Create a new Project
3. Name it: **"My Second Brain - Inbox"**
4. In Project Knowledge, add this instruction:

```
This is my Second Brain capture interface. When I provide thoughts, tasks, ideas, or information:

1. Use the m2b-inbox skill to classify and file them
2. Show confidence score for each classification
3. Ask for clarification if confidence < 75%
4. Confirm what was saved and where

I may also run:
- /m2b-digest for daily summary
- /m2b-review for weekly review
- /m2b-fix to correct misclassifications
```

5. Save the Project

## 💬 Daily Capture (The Core Workflow)

Just open your "My Second Brain - Inbox" project and type naturally:

### Examples

**Shopping:**
```
Buy milk, eggs, and bread
```
→ Added to shopping.md

**Tasks:**
```
Call dentist tomorrow to schedule cleaning
```
→ Filed in admin/personal/urgent.md (due: 2026-01-11)

**Ideas:**
```
Idea: Build an AI app that suggests recipes based on ingredients you have
```
→ Created ideas/tech/ai-recipe-app.md

**People:**
```
Had coffee with Sarah today - she wants to collaborate on podcast project
```
→ Updated people/friends/sarah.md + created projects/personal/active/podcast-collab.md

**Projects:**
```
Website redesign project is blocked - waiting on client to send brand guidelines
```
→ Created/updated projects/work/blocked/website-redesign.md

**Notes:**
```
Meeting notes from client call: They want mobile-first design, launch by March
```
→ Created notes/meetings/client-call-2026-01-10.md

## 🤖 AI Classification & Confidence

Every capture gets a **confidence score (0-100)**:

- **90-100%**: High confidence - filed automatically
- **75-89%**: Medium confidence - filed with flag for review
- **< 75%**: Low confidence - **Bouncer asks for clarification**

### Example Bouncer Interaction

**You:** "Remember the thing about the project"

**AI:**
```
I'm not sure how to categorize this (confidence: 45%). Could you clarify:
- Which project?
- What specifically should I remember?
- Is this a task, note, or something else?
```

**You:** "Website redesign - client wants mobile-first approach"

**AI:**
```
✓ Saved as note: "Website redesign - mobile-first approach" (confidence: 100%)
Location: notes/meetings/website-redesign-notes.md
Linked to: projects/work/active/website-redesign.md
```

## 📊 Daily Digest

Every morning (or when you want a summary):

**In Claude Project, type:** `/m2b-digest`

You'll get a <150 word summary:

```markdown
# Daily Digest - Friday, January 10

## Urgent (3 tasks)
- Call dentist (due tomorrow)
- Submit report (due Jan 12)

## Active Projects (2 need attention)
- Home Renovation: No update in 9 days
- Learn Rust: Next action ready

## Upcoming
- Mom's birthday (Jan 15)

## Quick Wins
- Update resume
- Research standing desk
```

Takes 2 minutes to read, tells you what needs attention today.

## 📅 Weekly Review

Every Sunday evening (or weekly):

**In Claude Project, type:** `/m2b-review`

You'll get a comprehensive review:

```markdown
# Weekly Review - Week of January 6-12, 2026

## Wins This Week 🎉
- 8 tasks completed
- Home Renovation moved from blocked to waiting
- Added 3 new ideas

## Needs Attention ⚠️
- Stale Projects (2): "Learn Rust" (21 days), "Side Hustle" (18 days)
- Low-Confidence Items (3): Review these classifications

## Looking Ahead 📅
- 6 urgent tasks due this week
- Mom's birthday (Jan 15)

## System Health 📊
- Projects: 14 active (8 personal, 6 work)
- Tasks: 9 urgent, 27 longer-term
- Captures This Week: 12 (avg confidence: 89%)

## Actions for Next Week ✅
1. Review "Learn Rust" - still active or archive?
2. Verify 3 low-confidence classifications
3. Celebrate completing 8 tasks!
```

Takes 10-15 minutes, keeps your system healthy.

## 🔧 Fixing Mistakes

Made a mistake? No problem:

**In Claude Project, type:** `/m2b-fix [description]`

### Examples

**Wrong category:**
```
That side hustle note should actually be a project
```
→ AI moves it from notes/ to projects/personal/active/, reformats with project template

**Wrong context:**
```
That Q4 slides task is for work, not personal
```
→ AI moves from admin/personal/ to admin/work/

**Missing info:**
```
John's birthday is March 15
```
→ AI updates people/friends/john-smith.md with birthday

**Split items:**
```
That recipe app idea should be split - keep the idea, but "research existing apps" should be a task
```
→ AI keeps idea, creates separate task, links them

## 📁 File Structure (Where Things Live)

```
projects/
  personal/active/    ← Active personal projects
  work/active/        ← Active work projects

people/
  family/             ← Family members
  friends/            ← Friends
  professional/       ← Work contacts

ideas/
  tech/               ← Tech ideas
  business/           ← Business ideas
  personal/           ← Personal/lifestyle ideas
  creative/           ← Creative projects

admin/
  personal/urgent.md      ← Tasks due within 7 days
  personal/longer-term.md ← Future tasks
  work/urgent.md
  work/longer-term.md

shopping.md         ← Shopping list (root for quick mobile access)

notes/
  meetings/           ← Meeting notes
  daily/              ← Daily notes
  reference/          ← Reference material
```

## 🔄 Git Sync (For Multi-Device Access)

Your Second Brain is version-controlled with Git. To sync:

### On Desktop (after captures):
```bash
cd ~/Repos/M2B
git add .
git commit -m "Update second brain"
git push
```

### On Desktop (before checking):
```bash
cd ~/Repos/M2B
git pull
```

### Mobile Access:
- **Claude Project** (always synced via cloud)
- **shopping.md**: View on GitHub mobile app
- **Full repo**: Clone via MGit (Android) or Working Copy (iOS)

## 🎨 Multi-Category Captures

Some captures belong in multiple places:

**Input:** "Idea: Start consulting business. Need to research LLC formation by next week."

**AI Response:**
```
✓ Saved in 2 places (confidence: 87%):
1. Idea: "Consulting business" in ideas/business/consulting-business.md
2. Task: "Research LLC formation" in admin/personal/urgent.md (due: 2026-01-17)
   → Task linked to idea file
```

## 🚫 Duplicate Detection

AI checks for duplicates before adding:

**You:** "Buy milk"
→ Added to shopping.md

**You:** "Buy milk" (again)

**AI:**
```
I notice you mentioned "milk" earlier today (in shopping.md).
Did you want to:
A) Add another entry (different type?)
B) Skip this duplicate
C) Update the existing entry
```

## 📈 Success Metrics (Track Your Progress)

### Trust Indicators
- Average confidence score trending up? → Classifier learning your patterns
- Using `/m2b-fix` less? → Fewer mistakes
- Bouncer clarifications helpful? → System asking right questions

### Usage Indicators
- Capturing daily? → Habit forming
- Reading daily digest? → System providing value
- Completing weekly review? → System staying healthy

### System Health
- Inbox size near zero? → Captures processed quickly
- Fewer stale projects? → Active project management
- Tasks getting done? → Realistic task list

## 🎯 Best Practices

### 1. Capture Without Thinking
Don't organize at capture time. Just type:
- "Buy milk"
- "Idea: AI recipe app"
- "Call mom tomorrow"

Let AI handle classification.

### 2. Trust the Confidence Scores
- **90%+**: Trust it, move on
- **75-89%**: Check weekly review for verification
- **<75%**: Bouncer will ask - answer and continue

### 3. Daily Digest Habit
Read digest every morning:
- Takes 2 minutes
- Tells you top priorities
- Surfaces what needs attention

### 4. Weekly Review Ritual
Sunday evening, 10-15 minutes:
- Celebrate wins
- Address stale projects
- Verify low-confidence items
- Plan next week

### 5. Fix Mistakes Immediately
If you notice a mistake:
- Don't wait
- Use `/m2b-fix` right away
- AI learns from corrections

### 6. Bulk Captures Are Fine
Don't separate items yourself:

```
Buy milk, eggs, bread. Call mom tomorrow. Idea for recipe app.
```

AI will split and classify each item.

### 7. Be Specific When Needed
Vague: "Remember the thing"
Better: "Remember client wants mobile-first for website redesign"

But AI will ask if unclear (bouncer pattern).

## 🚀 Advanced Usage

### Project Linking
When you mention a project in an idea or task, AI auto-links:

**You:** "Idea: Piano practice tracker app"
→ If you have a "Learn Piano" project, AI links them

### Domain Tagging
Ideas get auto-tagged by domain:
- **Tech**: app, software, AI, code
- **Business**: startup, revenue, market
- **Personal**: health, habit, lifestyle
- **Creative**: writing, art, music

### Context Detection
AI auto-detects personal vs work:
- Keywords: "manager", "client" → work
- Keywords: "family", "home" → personal
- Time: Business hours → leans work
- Default: personal (safer)

### Task Urgency
AI determines urgent vs longer-term:
- Due within 7 days → urgent
- Due later or no date → longer-term
- You can override with `/m2b-fix`

## 🆘 Troubleshooting

### "I captured something but can't find it"
1. Check inbox-log.md (audit trail of all captures)
2. Use GitHub search or grep
3. Check confidence score - maybe it was filed differently than expected

### "Confidence scores are too low"
- Be more specific in captures
- After a few corrections, AI learns your patterns
- Low confidence triggers bouncer - that's good! It asks instead of guessing

### "Too many items in wrong category"
- Use `/m2b-fix` to correct
- AI will learn from patterns over time
- Weekly review surfaces low-confidence items for verification

### "Forgot to push to git"
- No problem - git history preserved locally
- Just push when you remember
- Optional: Set up auto-commit in skills

### "Shopping list not syncing to phone"
- Push to git from desktop
- Pull on phone, or view shopping.md on GitHub mobile app
- Or just use Claude Android app (always synced)

## 📝 Customization

### Adjust Confidence Threshold
Default is 75%. To change, edit `.claude/skills/m2b-inbox/skill.md` and change the bouncer threshold.

### Add Categories
Want a new category (e.g., "recipes")?
1. Create template in `templates/recipe.md`
2. Update m2b-inbox skill to recognize pattern
3. Create directory structure

### Modify Templates
Edit files in `templates/` to change frontmatter structure.

### Change Digest Timing
Default: manual. To automate:
- Set up GitHub Action (see plan)
- Or cron job on desktop
- Or just run `/m2b-digest` when you want

## 🎉 You're Ready!

Your Second Brain is fully set up and ready to use. Start by:

1. Creating Claude Project "My Second Brain - Inbox"
2. Capture 5-10 items today (tasks, ideas, notes, shopping)
3. Run `/m2b-digest` tomorrow morning
4. Use system for 1 week
5. Run `/m2b-review` on Sunday

## 📚 Reference

- [README.md](README.md) - Full system documentation
- [Plan](~/.claude/plans/whimsical-pondering-frog.md) - Original implementation plan
- [Templates](templates/) - Frontmatter schemas
- [Skills](.claude/skills/) - AI skill definitions

Questions? Check the inbox-log.md audit trail or ask in your Claude Project!

---

**Remember**: Your brain is for thinking, not storing. Let your Second Brain remember, so you can focus on creating. 🧠✨
