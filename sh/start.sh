#!/usr/bin/env bash
set -euo pipefail

cd "${HOME}/Repos/M2B/docs"
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
