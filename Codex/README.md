# Second Brain (Codex)

This folder contains the second-brain system. The repo root stays clean.

## Workflow (Option 1: GitHub Issues -> Markdown)
1) Capture: create a GitHub Issue with one thought per issue.
2) Triage: run Codex CLI to classify and write a structured card file.
3) Store: cards live in /Codex/<type>/.
4) Nudge: generate daily/weekly digests from /Codex/indexes/manifest.json.

## Folder layout
- /Codex/inbox: raw captures staged for processing
- /Codex/people: structured person cards
- /Codex/projects: structured project cards
- /Codex/ideas: structured idea cards
- /Codex/admin: structured admin/task cards
- /Codex/logs/daily: daily/weekly digests
- /Codex/indexes: machine-readable indexes for fast retrieval
- /Codex/templates: file templates
