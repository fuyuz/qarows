# Phase 2 デプロイ手順（Cloudflare Workers）

**qarows Phase 2**（`apps/v2`）を各自の Cloudflare アカウントにセルフデプロイする手順。

一般方針は [deployment.md](./deployment.md) を参照。Phase 1 公式インスタンスは [deploy-v1.md](./deploy-v1.md)。

---

## 概要

| 項目 | 内容 |
|---|---|
| 成果物 | `apps/v2/dist`（SPA）+ `apps/v2/worker`（Hono API + Durable Objects） |
| ホスティング | 1 つの Worker（`[assets]` + API + WebSocket） |
| 永続化 | D1（プロジェクト snapshot）+ Durable Objects（リアルタイム同期） |
| 認証（本番） | Cloudflare Access（メールアドレス） |
| ローカル開発 | Vite `:5177` + Wrangler `:8787`（Vite が `/api` を proxy） |

---

## 1. 前提

- [Bun](https://bun.sh/)（リポジトリルートで `bun install`）
- [Cloudflare アカウント](https://dash.cloudflare.com/)
- Wrangler CLI（`apps/v2` の devDependency に含まれる）

```bash
bun install
bunx wrangler login
```

---

## 2. ローカル開発

### 初回セットアップ

```bash
cp apps/v2/wrangler.toml.example apps/v2/wrangler.toml
# 必要なら account_id を wrangler.toml に記入（deploy 時必須）

cp apps/v2/.dev.vars.example apps/v2/.dev.vars   # 任意（シークレット不要）
```

`wrangler.toml` は **gitignore** 対象。テンプレートのみリポジトリに含める。

### 起動

リポジトリルート:

```bash
bun run dev:v2
```

| URL | 用途 |
|---|---|
| http://localhost:5177 | フロント（HMR） |
| http://127.0.0.1:8787 | Worker 直アクセス |

`dev:v2` は Worker と Vite を同時起動し、ローカル D1 マイグレーションを適用する。

Worker のみ / フロントのみ:

```bash
bun run dev:v2:worker          # Worker のみ（8787）
bun run --filter @qarows/v2 dev:frontend   # Vite のみ（5177。Worker は別ターミナルで）
```

停止:

```bash
bun run dev:stop               # Phase 1 + Phase 2 の dev ポートを解放
```

### ローカル確認チェックリスト

- [ ] `/projects` でプロジェクト一覧が表示される
- [ ] サンプル tests.yml または空プロジェクトを作成できる
- [ ] 「続ける」→ セッション設定 → 実行画面へ進める
- [ ] 実行画面で OK/NG を付けるとヘッダの revision が増える
- [ ] 別タブで同じプロジェクトを開くと結果が同期される

---

## 3. 本番デプロイ

`apps/v2` ディレクトリで作業する。

### 3.1 wrangler.toml

```bash
cp wrangler.toml.example wrangler.toml
```

`wrangler.toml` に **account_id** を設定する（Dashboard → アカウント概要）。

### 3.2 D1 データベース作成

```bash
cd apps/v2
bunx wrangler d1 create qarows-v2
```

出力された `database_id` を `wrangler.toml` の `[[d1_databases]]` に追記:

```toml
[[d1_databases]]
binding = "DB"
database_name = "qarows-v2"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
migrations_dir = "migrations"
```

### 3.3 マイグレーション（リモート）

```bash
bun run db:migrate:local    # ローカル確認（任意）
bunx wrangler d1 migrations apply qarows-v2 --remote
```

Durable Objects の SQLite migration は `wrangler.toml` の `[[migrations]]` で初回 deploy 時に適用される。

### 3.4 ビルド & デプロイ

リポジトリルート:

```bash
bun run deploy:v2
```

または `apps/v2` で:

```bash
bun run build
bunx wrangler deploy --config wrangler.toml
```

デプロイ後、Wrangler が表示する `*.workers.dev` URL で `/projects` にアクセスして確認する。

---

## 4. Cloudflare Access（本番認証）

Phase 2 Worker はリクエストヘッダ `Cf-Access-Authenticated-User-Email` からユーザーを識別する（`apps/v2/worker/auth.ts`）。

1. Dashboard → **Zero Trust** → **Access** → **Applications**
2. デプロイした Worker のホスト名（カスタムドメインまたは `*.workers.dev`）を保護対象に追加
3. ポリシーで許可メールドメイン（例: `@your-company.com`）を設定

Access を設定しない場合、API は `dev@local` として動作する（**本番では必ず Access を有効化すること**）。

ローカル開発では `X-Qarows-User: you@example.com` ヘッダでユーザーを指定できる（任意）。

---

## 5. カスタムドメイン（任意）

1. Dashboard → **Workers & Pages** → デプロイした Worker
2. **Settings** → **Domains & Routes** → **Add**
3. DNS 指示に従い、Access アプリケーションの対象ホストも更新する

---

## アーキテクチャ（参考）

```
Browser
  ├─ GET /projects, /p/...     → ASSETS (dist/index.html + SPA)
  ├─ REST /api/projects/*       → Hono (Worker)
  └─ WS  /api/projects/:id/ws   → ProjectRoom (Durable Object)
                                      ↕ LWW patch
                                    D1 (projects テーブル)
```

---

## トラブルシューティング

| 症状 | 対処 |
|---|---|
| `dev:v2` で API エラー | Worker が 8787 で起動しているか。`wrangler.toml` があるか |
| D1 `no such table` | `bun run db:migrate:local` または `--remote` で migrations 適用 |
| WebSocket 接続失敗 | 本番では Access / プロキシが Upgrade を妨げていないか確認 |
| 409 on create | 同じ `project.id` の tests.yml が既に存在。上書きまたは id を変更 |
| `wrangler.toml` がない | `cp wrangler.toml.example wrangler.toml` |

---

## セキュリティ

- `wrangler.toml`（account_id 等）、`.dev.vars`、API トークンは **コミットしない**
- 許可メールドメイン・Access ポリシー ID は Dashboard で管理
- Phase 2 は組織内利用想定。Access なしの公開 Worker は避ける

---

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-06-28 | 初版 |
