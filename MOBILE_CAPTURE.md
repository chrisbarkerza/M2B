# Mobile Capture Workaround

Since Claude Projects can't execute local skills, here's a pragmatic workflow:

## For Shopping Items (Simplest)

### On Mobile (Claude Project):

Add this to Project Knowledge:
```
When I provide shopping items, format them as markdown checklist and respond with just the list:

- [ ] item 1
- [ ] item 2

No conversation, just the formatted list.
```

Then capture:
```
You: "mortein, snacks, milk"

Claude:
- [ ] mortein
- [ ] snacks
- [ ] milk
```

Then YOU manually:
1. Open GitHub app on phone
2. Navigate to M2B/shopping.md
3. Copy Claude's response
4. Paste into appropriate section (Groceries, Hardware, etc.)
5. Commit

### On Laptop (Proper Processing):

```bash
cd ~/Repos/M2B
claude
```

Then:
```
You: "Process my shopping list - classify items into sections"

Claude: [Reads shopping.md, organizes by category]
✓ Organized shopping.md:
  - Groceries: milk
  - Hardware: none
  - Cleaning: mortein
  - Snacks: snacks
```

## For Full Captures (Tasks, Ideas, etc.)

### Mobile Strategy:

**Option A: Voice Memo/Notes App**
- Record voice memo or type in Notes app
- "Buy milk. Idea: recipe app. Call dentist tomorrow."
- Process on laptop later with Claude Code CLI

**Option B: Email Yourself**
- Email to yourself with subject "Second Brain Capture"
- Body: list of captures
- Process on laptop from email

**Option C: Dedicated "Inbox" Note**
- Create simple note file synced to laptop (Apple Notes, Google Keep, etc.)
- Dump captures there
- Process on laptop with Claude Code CLI reading that note

### Laptop Processing (Daily Batch):

```bash
cd ~/Repos/M2B
claude

You: "Process these captures:
- Buy mortein and snacks
- Idea: Build recipe app
- Call dentist tomorrow
- Met John for coffee"

Claude: [Uses m2b-inbox skill]
✓ Shopping: mortein, snacks → shopping.md
✓ Idea: Recipe app → ideas/tech/recipe-app.md
✓ Task: Call dentist → admin/personal/urgent.md (due: 2026-01-11)
✓ Person: John → people/professional/john.md (coffee meeting logged)
```

## The Ideal Setup (Future)

Eventually, you could build:

1. **Web API** that accepts captures
2. **Shortcuts app** (iOS/Android) that sends captures to API
3. **API processes** using m2b-inbox logic
4. **Files written** to repo, auto-committed
5. **Pull on laptop** to see changes

But that requires hosting and development.

## For Now: Batch Processing

**Most pragmatic approach:**

1. **Mobile**: Use ANY capture method (Claude Project, Notes app, voice memo)
2. **Laptop**: Once daily, open Claude Code CLI and batch process all captures
3. **Sync**: Push to git after processing

This preserves the AI classification power while working around mobile limitations.

## Alternative: Simplified Mobile-First Approach

If you want **immediate mobile filing** without laptop:

Create a simple structure in your Claude Project:

```markdown
# My Captures

## Shopping
- [ ] mortein
- [ ] snacks

## Tasks
- [ ] Call dentist tomorrow

## Ideas
- Recipe app idea

## People Notes
- John - coffee meeting today
```

Then on laptop, Claude Code CLI reads this and properly files everything.

---

**The core issue**: Claude.ai can't directly edit files on your laptop's filesystem. Only Claude Code CLI (terminal) can do that.

**The workaround**: Use Claude.ai for capture formatting, manual paste to GitHub, OR batch process on laptop with Claude Code CLI.

Let me know which approach you want to take!
