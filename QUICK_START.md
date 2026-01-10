# Second Brain - Quick Start

## ✅ Setup (Do Once - 10 minutes)

### 1. Get Claude API Key (3 min)
1. https://console.anthropic.com/ → Sign in
2. "API Keys" → "Create Key"
3. Copy key (starts with `sk-ant-...`)

### 2. Add to GitHub (2 min)
1. GitHub.com → M2B repo → Settings
2. Secrets and variables → Actions → New secret
3. Name: `ANTHROPIC_API_KEY`
4. Paste key → Add secret

### 3. Test (5 min)
1. GitHub.com → M2B repo → Issues → New issue
2. Select "📥 Capture" template
3. Type: "Buy test item"
4. Submit → Wait 30 seconds → Issue auto-closes with confirmation

**Done!** System is now running 24/7.

---

## 📱 Daily Use

### Mobile (GitHub App)

1. Open GitHub app
2. M2B repo → Issues → "+"
3. Select "Capture"
4. Type: "Buy milk" or "Idea: Recipe app" or "Call dentist tomorrow"
5. Submit

**Within 30 seconds:**
- Classified by AI
- Filed to appropriate markdown file
- Committed to repo
- Issue closed with confirmation

### Laptop (View/Edit)

```bash
cd ~/Repos/M2B
git pull  # Get latest captures from mobile
```

View files:
- `shopping.md` - Shopping list
- `admin/personal/urgent.md` - Urgent tasks
- `ideas/tech/` - Tech ideas
- `inbox/inbox-log.md` - Audit trail

---

## 🎯 What to Capture

| Type | Example |
|------|---------|
| **Shopping** | "Buy milk, eggs, bread" |
| **Tasks** | "Call dentist tomorrow" |
| **Ideas** | "Idea: Build plant watering tracker app" |
| **People** | "Met Sarah - wants to collaborate on podcast" |
| **Projects** | "Website redesign blocked on client feedback" |
| **Notes** | "Meeting notes: client wants mobile-first design" |

Just type naturally - AI figures out the category!

---

## 💰 Cost

- **GitHub Actions**: Free (2000 min/month)
- **Claude API**: ~$3-5/month (100-200 captures)
- **Total**: $3-5/month

Compare to: Slack + Notion + Zapier = $38/month

---

## 📊 Next Steps

### Daily (Morning)
On laptop, run digest:
```bash
cd ~/Repos/M2B
claude
```
Then: `/m2b-digest`

### Weekly (Sunday)
On laptop, run review:
```bash
cd ~/Repos/M2B
claude
```
Then: `/m2b-review`

### As Needed
Capture whenever you think of something:
- Mobile → GitHub Issues
- Laptop → GitHub Issues or Claude Code CLI

---

## 🔧 Files Created

All pushed to GitHub:
- `.github/workflows/process-capture.yml` - Auto-processor
- `.github/scripts/process-capture.js` - Classification logic
- `.github/ISSUE_TEMPLATE/capture.yml` - Issue template
- `GITHUB_ACTIONS_SETUP.md` - Full setup guide

---

## ❓ Help

**Issue doesn't process?**
- Check "Actions" tab for errors
- Verify API key in Settings → Secrets

**Wrong classification?**
- Edit file manually on laptop
- Or refine `.claude/skills/m2b-inbox/skill.md`

**View captures on mobile?**
- GitHub app → M2B repo → Files → shopping.md (or other files)

---

**You're all set!** 🎉 Capture away.
