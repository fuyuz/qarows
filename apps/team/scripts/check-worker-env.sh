#!/usr/bin/env bash
set -euo pipefail

# worker/cloudflare-env.d.ts が cloudflare.config.example.ts のバインディングを網羅しているか確認する。
#
# この型を cf に生成させる（cf workers types）ことはできない。生成される Env は渡された
# 1 つの構成の全バインディングを必須にするが、こちらは AI・R2 を積まないデプロイも
# 表すために任意プロパティを持つ（cloudflare-env.d.ts の冒頭を参照）。
# そこで「example から推論した Env にあるのに宣言側に無いバインディング」だけを型で検出する。
# example に足して型に足し忘れる、という実際に起きるズレを拾う。

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TEAM="$ROOT/apps/team"
cd "$TEAM"

# 生成物は gitignore 済みの .cloudflare/ に置く（tsconfig の extends / import を相対で解決するため）
WORK="$TEAM/.cloudflare/check-worker-env"
rm -rf "$WORK"
mkdir -p "$WORK"
trap 'rm -rf "$WORK"' EXIT

cat > "$WORK/check.ts" <<'TS'
import type { InferEnv, UnwrapConfig } from "wrangler/experimental-config";
import type config from "../../cloudflare.config.example";

type ExampleWorker = UnwrapConfig<UnwrapConfig<typeof config>["worker"]>;
type Missing = Exclude<keyof InferEnv<ExampleWorker>, keyof Cloudflare.Env>;

// Missing が never でなければ、足りないバインディング名がエラーに出る
export const missingBindings: [Missing] extends [never] ? true : { missing: Missing } = true;
TS

cat > "$WORK/tsconfig.json" <<'JSON'
{
  "extends": "../../tsconfig.worker.json",
  "include": ["check.ts", "../../worker/cloudflare-env.d.ts"]
}
JSON

if ! bunx tsc -p "$WORK/tsconfig.json"; then
  echo "" >&2
  echo "cloudflare.config.example.ts にあるのに worker/cloudflare-env.d.ts に無いバインディングがあります（上の missing を参照）。" >&2
  echo "worker/cloudflare-env.d.ts の Cloudflare.Env に追加してください。" >&2
  exit 1
fi

echo "worker/cloudflare-env.d.ts は cloudflare.config.example.ts のバインディングを網羅しています。"
