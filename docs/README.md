# M2B Progressive Web App

Your AI-powered Second Brain, accessible from anywhere.

## Features

- 📥 **Quick Capture** - Capture thoughts, tasks, and ideas instantly
- 🛒 **Shopping List** - Interactive checklist with offline support
- ✅ **Tasks** - Manage urgent and longer-term tasks
- 💡 **Ideas** - Browse ideas by domain
- 📴 **Offline Mode** - Works without internet, syncs when online
- 📱 **Install as App** - Add to home screen for native app experience

## Access

Visit: **https://chrisbarkerza.github.io/M2B**

## First-Time Setup

1. Visit the app URL
2. Click the settings icon (⚙️)
3. Create a GitHub Personal Access Token:
   - Go to https://github.com/settings/tokens/new
   - Name: "M2B PWA"
   - Permissions: `repo` (full control)
   - Click "Generate token"
   - Copy the token (starts with `ghp_`)
4. Paste token in settings
5. Verify repository name: `chrisbarkerza/M2B`
6. Click "Save Settings"
7. Click "Test Connection" to verify

## Install as App

### Android (Chrome/Samsung Internet)
1. Visit the app URL
2. Tap the menu (⋮)
3. Select "Add to Home screen" or "Install app"
4. Confirm installation

### iOS (Safari)
1. Visit the app URL
2. Tap the Share button
3. Scroll down and tap "Add to Home Screen"
4. Confirm

## Offline Usage

The app automatically caches data and queues actions when offline:

- **Captures** are queued and submitted when back online
- **Checkbox changes** are queued and synced
- **View cached data** even without internet

When you go back online, tap the sync button (🔄) or wait for automatic sync.

## Privacy & Security

- All data stays in your private GitHub repository
- GitHub token is stored locally in your browser only
- No data sent to third parties
- Open source - audit the code yourself

## Development

To run locally:

```bash
cd docs
python3 -m http.server 8000
# Visit http://localhost:8000
```

## Troubleshooting

**App won't load data:**
- Check settings - is token correct?
- Is repository name `chrisbarkerza/M2B`?
- Click "Test Connection" to verify

**Changes not syncing:**
- Check you're online (look for offline indicator)
- Tap sync button (🔄) manually
- Check GitHub token has `repo` permissions

**Can't install as app:**
- Make sure you're using HTTPS (GitHub Pages)
- Try a different browser (Chrome works best on Android)

## Updates

The app automatically updates when you reload. To force update:
1. Settings → Clear Cache
2. Refresh the page
