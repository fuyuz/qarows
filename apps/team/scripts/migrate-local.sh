#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# cf d1 migrations は名前を受け付けず ID 必須。ローカル D1 も binding の id で
# 区別されるので、cloudflare.config.ts の DB binding から id を拾って渡す。
DB_ID="$(grep -oE 'bindings\.d1\(\{[^}]*id: "[^"]+"' cloudflare.config.ts | grep -oE '[0-9a-f-]{36}' | head -1 || true)"
if [[ -z "${DB_ID:-}" ]]; then
  echo "cloudflare.config.ts の DB binding に id がありません（bindings.d1({ name, id })）。" >&2
  exit 1
fi

# cf の既定の保存先 (~/.config/cloudflare/state) ではなく、cf dev（Wrangler に委譲）が
# 読む .wrangler/state に揃える。
#
# cf 1.0.0-beta.14 の --local は適用結果（JSON 配列）を出力したあとプロセスが終了しない。
# 結果の閉じ括弧が出たら止める。エラー時は cf 自身が終了する。
OUT="$(mktemp)"
trap 'rm -f "$OUT"' EXIT
cf d1 migrations apply "$DB_ID" --local --persist-to .wrangler/state --dir migrations >"$OUT" 2>&1 &
PID=$!
for _ in $(seq 1 120); do
  if grep -qE '^(\[)?\]$' "$OUT" || ! kill -0 "$PID" 2>/dev/null; then
    break
  fi
  sleep 0.5
done
kill "$PID" 2>/dev/null || true
wait "$PID" 2>/dev/null || true
cat "$OUT"
grep -qE '^(\[)?\]$' "$OUT"
