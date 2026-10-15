#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f cloudflare.config.ts ]; then
  echo "cloudflare.config.ts がありません: cp cloudflare.config.example.ts cloudflare.config.ts" >&2
  exit 1
fi

# AUTH_DEV_BYPASS は localhost:8787 でのみ効くので本番に届いても無視されるが、
# 設定したまま deploy するのは事故なので落とす（多層防御を env var 任せにしない）。
# ローカル用の値は .dev.vars に置き、cloudflare.config.ts には書かない
if grep -Eq '^[^/]*AUTH_DEV_BYPASS' cloudflare.config.ts; then
  echo "Refusing to deploy: AUTH_DEV_BYPASS is set in cloudflare.config.ts." >&2
  echo "Keep it in .dev.vars only (it is only for local dev on localhost:8787)." >&2
  exit 1
fi

bun run build
# --mode production: cloudflare.config.ts はこのときだけカスタムドメインを付ける（example 参照）。
# mode なしでデプロイするとカスタムドメインが外れるので、直接 cf deploy しないこと
cf deploy --mode production --message "qarows-team deploy"
