# GitHub Actions 24/7 Capture Setup

This guide will set up your Second Brain to run 24/7 using GitHub Issues + Actions.

## How It Works

1. **You** create a GitHub Issue on mobile (or desktop)
2. **GitHub Action** triggers automatically (24/7, cloud-hosted)
3. **Claude API** classifies the capture using m2b-inbox logic
4. **Action** writes to appropriate markdown file(s)
5. **Action** commits and pushes changes
6. **Action** closes issue with confirmation comment
7. **You** pull changes on laptop to see updated files

## Setup Steps (10 minutes)

### Step 1: Get Claude API Key

1. Go to https://console.anthropic.com/
2. Sign up or sign in
3. Click "API Keys" in sidebar
4. Click "Create Key"
5. Name it: "M2B GitHub Actions"
6. Copy the key (starts with `sk-ant-...`)
7. **Save it somewhere** - you'll need it in Step 2

**Cost**: ~$0.01 per capture (very cheap - $3-5/month for typical usage)

### Step 2: Add API Key to GitHub Secrets

1. Go to your M2B repository on GitHub
2. Click "Settings" tab
3. Click "Secrets and variables" → "Actions"
4. Click "New repository secret"
5. Name: `ANTHROPIC_API_KEY`
6. Value: Paste the key from Step 1
7. Click "Add secret"

### Step 3: Push GitHub Action Files

These files have been created locally:
- `.github/workflows/process-capture.yml` - GitHub Action workflow
- `.github/scripts/process-capture.js` - Classification script
- `.github/ISSUE_TEMPLATE/capture.yml` - Issue template

Push them to GitHub:

```bash
cd ~/Repos/M2B
git add .github/
git commit -m "Add GitHub Actions for 24/7 capture processing"
git push
```

### Step 4: Test It!

**On Desktop (first test):**

1. Go to your M2B repo on GitHub
2. Click "Issues" tab
3. Click "New issue"
4. Select "📥 Capture" template
5. Type: "Buy mortein and snacks"
6. Click "Submit new issue"

**What happens:**
- Within 30 seconds, GitHub Action processes it
- Writes to `shopping.md`
- Commits the change
- Comments on issue with confirmation
- Closes issue

**On Mobile (GitHub app):**

1. Install GitHub mobile app (if not already)
2. Open M2B repository
3. Tap "Issues" tab
4. Tap "+" → "New issue"
5. Select "Capture" template
6. Type: "Buy milk and eggs"
7. Submit

Same automatic processing happens!

### Step 5: Pull Changes on Laptop

After capturing on mobile:

```bash
cd ~/Repos/M2B
git pull
```

Your markdown files are now updated with the captures!

## Mobile Usage

### Quick Capture (GitHub Mobile App)

1. Open GitHub app
2. Navigate to M2B repo
3. Tap "Issues" → "+"
4. Select "Capture" template
5. Type naturally (no special syntax)
6. Submit

**Examples:**
- "Buy milk, eggs, bread"
- "Idea: Build an app that tracks plant watering"
- "Call dentist tomorrow"
- "Met John for coffee - wants to collaborate"

### View Confirmation

After submitting:
1. GitHub Action processes it (15-30 seconds)
2. Issue auto-closes
3. Comment shows what was filed:
   ```
   ✓ Capture processed successfully!

   Classification: shopping
   Confidence: 95%
   Location: shopping.md

   View changes: [Commit link]
   ```

### View Your Files

**Option 1: GitHub mobile app**
- Navigate to files
- View shopping.md, admin/personal/urgent.md, etc.
- See updates in real-time

**Option 2: Pull on laptop**
```bash
git pull
```

## Daily Digest (Coming Soon)

Once we add the digest workflow, you'll automatically receive:
- Daily summary at 8am (via GitHub Issue or email)
- Weekly review on Sundays

For now, run manually on laptop:
```bash
cd ~/Repos/M2B
claude
# Then: "/m2b-digest"
```

## Cost Breakdown

| Service | Cost | Usage |
|---------|------|-------|
| **GitHub Actions** | Free | 2000 minutes/month (way more than needed) |
| **Claude API** | ~$3-5/month | 100-200 captures @ $0.01-0.02 each |
| **GitHub Storage** | Free | Unlimited for markdown files |

**Total: ~$3-5/month** (just Claude API)

Much cheaper than Slack ($8/month) + Notion ($10/month) + Zapier ($20/month) = $38/month!

## Troubleshooting

### Issue doesn't auto-close

**Check:**
1. Does issue have "capture" label? (Should auto-add from template)
2. Go to "Actions" tab - did the workflow run?
3. Click on the workflow run to see logs

### "Secret not found" error

You didn't add the Claude API key to GitHub Secrets:
1. Go to repo Settings → Secrets and variables → Actions
2. Add `ANTHROPIC_API_KEY` with your API key

### Files not updated

**Check:**
1. Did the workflow run successfully? (Actions tab)
2. Did it commit? (Look at commit history)
3. Did you pull on laptop? (`git pull`)

### Classification seems wrong

The classifier uses the m2b-inbox skill logic. You can:
1. Edit the file manually on laptop
2. Improve the skill prompt in `.claude/skills/m2b-inbox/skill.md`
3. Push changes to refine classification

### API costs too high

Typical costs:
- 1 capture = ~500 tokens = $0.01
- 10 captures/day = $3/month
- 20 captures/day = $6/month

If costs are high, you're probably making hundreds of captures. Consider:
- Batch multiple items in one issue
- Review your capture habits

## Advanced: Scheduled Digest

Want automatic daily digest at 8am?

Add this file: `.github/workflows/daily-digest.yml`

```yaml
name: Daily Digest

on:
  schedule:
    - cron: '0 8 * * *'  # 8am UTC daily
  workflow_dispatch:  # Manual trigger

jobs:
  digest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Generate digest
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          node .github/scripts/generate-digest.js

      - name: Create issue with digest
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const digest = fs.readFileSync('.github/digest.md', 'utf8');

            await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: '📊 Daily Digest',
              body: digest,
              labels: ['digest']
            });
```

You'll receive a new issue every morning with your daily digest!

## Next Steps

1. ✅ Complete setup above
2. ✅ Test with 5-10 captures
3. ✅ Check that files are updating correctly
4. ✅ Use for 1 week
5. ⏳ Add scheduled digest (optional)
6. ⏳ Refine classification prompts based on corrections

---

**You now have a true 24/7 Second Brain!** 🎉

Capture from anywhere, anytime, and it automatically files everything for you.
