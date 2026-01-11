# M2B - My Second Brain

A progressive web app (PWA) for personal knowledge management with AI-powered capture and classification.

## Privacy-First Architecture

M2B uses a two-repository architecture to keep personal data private while keeping the app publicly available:

- M2B (this repo) - Public PWA application, GitHub Actions workflows
- M2B-Data (private repo) - Personal markdown files, shopping lists, todos, projects, notes

The PWA accesses private data through the GitHub API using a personal access token.

## Features

- Three capture methods: GitHub Issues, PWA web app, Claude Code CLI skills
- AI classification with Claude Sonnet 4
- Offline-first PWA with background sync
- Mobile-optimized and installable

## Setup Your Own Instance

### 1. Fork This Repository

Fork this repository to create your own copy of the M2B app.

### 2. Create Your Private Data Repository

Create a new private repository named `M2B-Data` and include this structure:

```
M2B-Data/
├── README.md
├── CLAUDE.md (optional)
├── .claude/
│   └── skills/
│       └── m2b-inbox/
└── md/
    ├── Shopping/
    │   ├── Shopping.md
    │   └── Done.md
    ├── ToDo/
    │   ├── ToDo.md
    │   └── Done.md
    ├── Projects/
    ├── Notes/
    └── inbox-log.md
```

### 3. Configure GitHub Actions

Add these secrets to your M2B repository:

- `ANTHROPIC_API_KEY` - Claude API key for classification
- `DATA_REPO_TOKEN` - GitHub PAT with `repo` scope for M2B-Data access

### 4. Enable GitHub Pages

- Settings -> Pages -> Deploy from `main` / `docs` folder

### 5. Configure the PWA

1. Visit your GitHub Pages URL: `https://[username].github.io/M2B/`
2. Open Settings in the PWA
3. Enter your GitHub token (needs `repo` scope)
4. PWA connects to your private M2B-Data repository

## Usage

### Capture via GitHub Issue

1. Create issue in M2B repo
2. Add the `capture` label
3. Workflow classifies and files to M2B-Data

### Capture via PWA

1. Open PWA on mobile or desktop
2. Enter capture text
3. Submit -> creates issue -> automated processing

### Browse Data

- PWA views for Shopping, Tasks, Projects, Notes
- All data synced from private M2B-Data repo

## Development

```bash
cd docs
python3 -m http.server 8000
```

Visit http://localhost:8000

## Security

- Personal data stays in private M2B-Data repository
- GitHub token stored in browser localStorage (client-side only)
- All API calls go through authenticated HTTPS

## License

MIT
