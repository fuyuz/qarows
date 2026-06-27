#!/usr/bin/env bash
set -euo pipefail

stop_listeners() {
  local port=$1
  local pids
  pids=$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "Stopping listener on port $port (PIDs: $pids)"
    kill -9 $pids 2>/dev/null || true
  fi
}

for port in 5173 5174 4173; do
  stop_listeners "$port"
done

echo "Done."
