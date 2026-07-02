#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [ ! -d "socket-server/node_modules" ]; then
  echo "Installing socket-server dependencies..."
  (cd socket-server && npm install)
fi

echo "Starting socket server on http://localhost:8080"
(cd socket-server && PORT=8080 NODE_ENV=development npm run dev) &

echo "Starting static server on http://localhost:3000"
echo "  Frontend: http://localhost:3000/"
echo "  Admin:    http://localhost:3000/panel/"
python3 -m http.server 3000 --directory "$ROOT"
