# Repository Guidelines

## Project Structure & Module Organization

- `docs/` contains the PWA (entry `docs/index.html`, styling in `docs/css/styles.css`, logic in `docs/js/`).
- `docs/js/` holds vanilla JS modules like `app.js`, `viewer.js`, `SyncManager.js`, and `LocalStorageManager.js`.
- `docs/manifest.json` and `docs/service-worker.js` define PWA metadata and offline caching.
- `.github/workflows/` includes GitHub Pages deploy and capture processing workflows.
- `.github/scripts/` contains the capture processing script and its `package.json`.
- `sh/` has helper shell scripts (e.g., `sh/start.sh`, `sh/sync.sh`).

## Build, Test, and Development Commands

- `cd docs && python3 -m http.server 8000` — serve the PWA locally at `http://localhost:8000`.
- `cd .github/scripts && npm install` — install dependencies for the capture processing script.

There is no build step; the app is static HTML/CSS/JS served from `docs/`.

## Coding Style & Naming Conventions

- Indentation: 4 spaces in JS and CSS (see `docs/js/app.js`, `docs/css/styles.css`).
- JavaScript: classes use `PascalCase`, functions/methods use `camelCase`, constants in `UPPER_SNAKE_CASE` where used.
- File names: `PascalCase.js` for JS modules in `docs/js/`.
- Prefer small, focused modules and keep UI edits flowing through local storage first (see `CLAUDE.md` for patterns).

## Testing Guidelines

- No automated test suite is configured.
- Validate changes manually: run the local server, load `docs/index.html`, and exercise capture, edit, and sync flows.

## Commit & Pull Request Guidelines

- Commit messages are short, descriptive, and often lowercase (e.g., `refactor into smaller files`); keep them concise and action-oriented.
- PRs should include: summary of changes, steps to test locally, and screenshots for UI changes in `docs/`.
- Link related issues when applicable (e.g., capture workflow changes tied to a specific issue).

## Security & Configuration Tips

- The app uses a GitHub PAT in browser `localStorage`; never commit tokens.
- GitHub Actions require `ANTHROPIC_API_KEY` and `DATA_REPO_TOKEN` secrets for capture processing.
