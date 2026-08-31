#!/usr/bin/env bash
set -euo pipefail

# worker/cloudflare-env.d.ts が wrangler.toml.example のバインディングを網羅しているか確認する。
#
# この型を wrangler に生成させることはできない。wrangler は渡された 1 つの構成しか
# 知らないので全バインディングを必須で出力するが、こちらは AI・R2 を積まないデプロイも
# 表すために任意プロパティを持つ（cloudflare-env.d.ts の冒頭を参照）。
# そこで「生成した参照用の Env にあるのに宣言側に無いバインディング」だけを落とす。
# example に足して型に足し忘れる、という実際に起きるズレを拾う。
#
# wrangler は wrangler.toml / wrangler.json(c) という名前しか設定ファイルとして
# 読まない。wrangler.toml.example を --config に直接渡すと黙って無視され、
# バインディングも compatibility_date も無い扱いで生成される（かつて
# types:worker がそうなっていた）。認識される名前へ複製してから渡すこと。

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TEAM="$ROOT/apps/team"
cd "$TEAM"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cp wrangler.toml.example "$TMP/wrangler.toml"
# main と Durable Object クラスの解決に必要。dist / migrations は型生成では要らない
ln -s "$TEAM/worker" "$TMP/worker"

# --include-runtime=false: ランタイム型は @cloudflare/workers-types 側で入る
# --strict-vars=false: example の値をリテラル型にされると "your-team-name" しか
#                      代入できない型になる
bunx wrangler types \
  --config "$TMP/wrangler.toml" \
  --env-interface CloudflareEnv \
  --include-runtime=false \
  --strict-vars=false \
  "$TMP/generated.d.ts" >/dev/null

# 指定した interface の直下メンバー名だけを拾う
members() {
  awk -v want="$2" '
    $0 ~ ("interface " want " ?\\{") { inside = 1; next }
    inside && /^[[:space:]]*\}/ { inside = 0 }
    inside && match($0, /[A-Za-z_][A-Za-z0-9_]*\??[[:space:]]*:/) {
      name = substr($0, RSTART, RLENGTH)
      gsub(/[[:space:]?:]/, "", name)
      print name
    }
  ' "$1" | sort -u
}

members "$TMP/generated.d.ts" __BaseEnv_CloudflareEnv > "$TMP/from-config"
members "$TEAM/worker/cloudflare-env.d.ts" Env > "$TMP/declared"

if [ ! -s "$TMP/from-config" ]; then
  echo "参照用 Env のバインディングを読めませんでした。wrangler types の出力形式が変わった可能性があります。" >&2
  exit 1
fi

missing="$(comm -23 "$TMP/from-config" "$TMP/declared")"
extra="$(comm -13 "$TMP/from-config" "$TMP/declared")"

if [ -n "$extra" ]; then
  echo "example では無効だが宣言側にあるバインディング（任意バインディングなら想定どおり）:"
  echo "$extra" | sed 's/^/  - /'
fi

if [ -n "$missing" ]; then
  echo "" >&2
  echo "wrangler.toml.example にあるのに worker/cloudflare-env.d.ts に無いバインディング:" >&2
  echo "$missing" | sed 's/^/  - /' >&2
  echo "" >&2
  echo "worker/cloudflare-env.d.ts の Cloudflare.Env に追加してください。" >&2
  exit 1
fi

echo "worker/cloudflare-env.d.ts は wrangler.toml.example のバインディングを網羅しています。"
