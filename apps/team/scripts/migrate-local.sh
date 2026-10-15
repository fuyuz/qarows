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
# 読む .wrangler/state に揃える
cf d1 migrations apply "$DB_ID" --local --persist-to .wrangler/state --dir migrations
