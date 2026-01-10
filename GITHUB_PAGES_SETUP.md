# GitHub Pages Setup for M2B PWA

Your PWA is ready! Now you need to enable GitHub Pages to host it.

## Option 1: Make Repository Public (Free)

GitHub Pages is free for public repositories:

1. Go to your repository: https://github.com/chrisbarkerza/M2B
2. Click "Settings"
3. Scroll down to "Danger Zone"
4. Click "Change visibility" → "Change to public"
5. Confirm by typing the repository name
6. Go back to "Settings" → "Pages" (in sidebar)
7. Under "Source", select:
   - Branch: `main`
   - Folder: `/docs`
8. Click "Save"
9. Wait 1-2 minutes for deployment
10. Your PWA will be live at: **https://chrisbarkerza.github.io/M2B**

## Option 2: Keep Repository Private (Paid)

If you have GitHub Pro or above, you can use Pages with private repos:

1. Go to repository Settings → Pages
2. Under "Source", select:
   - Branch: `main`
   - Folder: `/docs`
3. Click "Save"
4. Your PWA will be live at: **https://chrisbarkerza.github.io/M2B**

## Option 3: Local Development (No GitHub Pages)

You can run the PWA locally without GitHub Pages:

```bash
cd ~/Repos/M2B/docs
python3 -m http.server 8000
```

Then visit: http://localhost:8000

**Note**: Offline features and service worker require HTTPS, so they won't work fully on localhost. You can use ngrok for HTTPS locally:

```bash
# Install ngrok first
ngrok http 8000
# Use the HTTPS URL it provides
```

## After Enabling Pages

Once GitHub Pages is live:

1. Visit your PWA URL
2. Click settings icon (⚙️)
3. Add your GitHub token (from https://github.com/settings/tokens/new)
   - Name: "M2B PWA"
   - Permissions: `repo` (full control)
4. Save and test connection
5. Start using your PWA!

## Install as Mobile App

### Android
1. Visit the PWA URL in Chrome
2. Menu → "Add to Home screen"

### iOS
1. Visit the PWA URL in Safari
2. Share → "Add to Home Screen"

---

**Recommended**: Make the repository public so your PWA is always accessible from anywhere, even without laptop access!
