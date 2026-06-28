#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
V2="$ROOT/apps/v2"

bash "$ROOT/scripts/stop-dev.sh" v2
sleep 0.5

cd "$V2"

if [ ! -f wrangler.toml ]; then
  echo "wrangler.toml がありません。初回は次を実行してください:"
  echo "  cp apps/v2/wrangler.toml.example apps/v2/wrangler.toml"
  exit 1
fi

echo "Applying local D1 migrations…"
bun run db:migrate:local

echo "Starting worker on http://127.0.0.1:8787 …"
bun run dev:worker &
WORKER_PID=$!

cleanup() {
  kill "$WORKER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

sleep 2
echo "Starting frontend on http://localhost:5177 …"
exec vite --port 5177 --strictPort
