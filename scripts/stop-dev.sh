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

TARGET="${1:-all}"

stop_local_ports() {
  for port in 5173 5174 5178; do
    stop_listeners "$port"
  done
}

stop_team_ports() {
  for port in 5176 5177 8787; do
    stop_listeners "$port"
  done
}

case "$TARGET" in
  local) stop_local_ports ;;
  team) stop_team_ports ;;
  all)
    stop_local_ports
    stop_team_ports
    ;;
  *)
    echo "Usage: $0 [all|local|team]" >&2
    exit 1
    ;;
esac

echo "Done."
