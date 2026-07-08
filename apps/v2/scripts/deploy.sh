#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

bun run build
DEPLOY_OUTPUT="$(bunx wrangler deploy --config wrangler.toml 2>&1)"
printf '%s\n' "$DEPLOY_OUTPUT"

# Wrangler 4 はアップロードとトラフィック切替が別。deploy 出力の Version ID を 100% にする。
VERSION_ID="$(printf '%s\n' "$DEPLOY_OUTPUT" | grep -oE 'Current Version ID: [0-9a-f-]+' | awk '{print $4}' | head -1)"
if [[ -z "${VERSION_ID:-}" ]]; then
  VERSION_ID="$(bunx wrangler versions list --config wrangler.toml 2>/dev/null | awk '/^Version ID:/{id=$3} END{print id}')"
fi
if [[ -z "${VERSION_ID:-}" ]]; then
  echo "Could not resolve deployed Worker version ID; check Cloudflare Dashboard." >&2
  exit 1
fi

echo "Promoting ${VERSION_ID} to 100% traffic..."
bunx wrangler versions deploy "${VERSION_ID}@100%" --message "qarows-v2 deploy" --yes --config wrangler.toml
