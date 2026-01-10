#!/usr/bin/env bash
set -euo pipefail

cd "${HOME}/Repos/M2B/docs"

# Kill any existing server on port 8000
if lsof -ti :8000 >/dev/null 2>&1; then
  echo "Killing existing server on port 8000..."
  lsof -ti :8000 | xargs kill -9 2>/dev/null || true
  sleep 1
fi

python3 -m http.server 8000 &
server_pid=$!

# Give the server a moment to start
sleep 1

if command -v open >/dev/null 2>&1; then
  open "http://localhost:8000"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://localhost:8000"
else
  printf 'Server running at http://localhost:8000\n' >&2
fi

wait "${server_pid}"
