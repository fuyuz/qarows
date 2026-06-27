#!/usr/bin/env bash
set -euo pipefail

bash "$(cd "$(dirname "$0")/../../.." && pwd)/scripts/stop-dev.sh"
sleep 0.5
exec vite --port 5173 --strictPort
