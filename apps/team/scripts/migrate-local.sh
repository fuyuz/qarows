#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# cf d1 migrations は名前を受け付けず ID 必須。ローカル D1 も binding の id で
# 区別されるので、cloudflare.config.ts の DB binding から id を拾って渡す。
# 書式（改行・整形）に左右されないよう、grep ではなく設定を実際に読み込む。
# defineConfig / worker には関数（mode 別の設定）も渡せるので、その場合は評価してから読む
DB_ID="$(node --experimental-strip-types --no-warnings --input-type=module -e '
const ctx = { mode: undefined, isPreview: false };
const unwrap = async (value) => (typeof value === "function" ? unwrap(await value(ctx)) : value);
const config = await unwrap((await import(process.argv[1])).default);
const worker = await unwrap(config?.worker);
const id = worker?.env?.DB?.id;
if (typeof id === "string") console.log(id);
' "$PWD/cloudflare.config.ts" || true)"
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
