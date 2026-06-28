# Phase 2 デプロイ手順（Cloudflare Workers）

**qarows Phase 2**（`apps/v2`）を **各自の closed 環境** にセルフデプロイする手順。

- 公式の共通 Phase 2 インスタンスは **提供しない**
- 1 デプロイ = 1 組織（または 1 チーム）の閉じた QA 環境
- D1 / Durable Objects / Access ポリシーはデプロイごとに独立

一般方針は [deployment.md](./deployment.md) を参照。Phase 1 公式インスタンスは [deploy-v1.md](./deploy-v1.md)。

---

## 概要

| 項目 | 内容 |
|---|---|
| 成果物 | `apps/v2/dist`（SPA）+ `apps/v2/worker`（Hono API + Durable Objects） |
| ホスティング | 1 つの Worker（`[assets]` + API + WebSocket） |
| 永続化 | D1（プロジェクト snapshot）+ Durable Objects（リアルタイム同期） |
| 認証（本番） | Cloudflare Access（組織内メンバー限定）+ Worker 側 enforce |
| データの所在 | そのデプロイの D1 / DO のみ（他環境と非共有） |
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

## 4. Cloudflare Access（本番認証・アクセス制限）

Phase 2 Worker は **Cloudflare Access 必須** で動作する（`wrangler.toml` の `ACCESS_REQUIRED = "true"`）。

| レイヤ | 役割 |
|---|---|
| Cloudflare Access（Dashboard） | 未認証ユーザーをログイン画面へリダイレクト |
| Worker JWT 検証 | `Cf-Access-Jwt-Assertion` を署名検証（ヘッダー偽装対策） |
| Worker allow guard（任意） | `ACCESS_ALLOWED_EMAILS` または `ACCESS_ALLOWED_EMAIL_DOMAIN` |

### 4.1 Worker 側の必須設定

```toml
[vars]
ACCESS_REQUIRED = "true"
ACCESS_TEAM_DOMAIN = "your-team-name"   # *.cloudflareaccess.com のサブドメイン
# ACCESS_AUD = "..."                    # Access Application の AUD（推奨）
```

JWT 検証後、メールアドレスは **JWT の claim から取得**する（`Cf-Access-Authenticated-User-Email` 単体は信頼しない）。ヘッダー email がある場合は JWT と一致することを確認する。

### 4.2 ユーザー追加（Dashboard）— Method A / B

Access ポリシーは Dashboard で設定する。Worker 側 allow guard は **どちらか一方** を選んで mirror する（両方設定時は **EMAILS 優先**）。

| 方式 | Dashboard（Access ポリシー） | Worker `[vars]` |
|---|---|---|
| **A: 個人メール** | Include → **Emails** に `alice@…`, `bob@…` を列挙 | `ACCESS_ALLOWED_EMAILS = "alice@…,bob@…"` |
| **B: 組織ドメイン** | Include → **Email domain** に `@your-company.com` | `ACCESS_ALLOWED_EMAIL_DOMAIN = "your-company.com"` |

- Method A: 招待メールは自動送信されない。URL を個別共有する。
- Method B: そのドメインの Google / GitHub 等 IdP でログイン可能。
- allow guard を省略すると JWT + Access ポリシーのみ（非推奨だが可）。

### 4.3 Access アプリケーション（Dashboard）

1. Dashboard → **Zero Trust** → **Access** → **Applications**
2. 保護対象ホストを **すべて** 登録する:
   - カスタムドメイン（例: `qarows.example.com`）
   - **`*.workers.dev` の Worker URL**（登録漏れが多い）
3. 上記 Method A または B でポリシーを作成
4. Application の **AUD** を `ACCESS_AUD` に設定（推奨）

**workers.dev を Access 外に残すと、Layer 1 がなく JWT なしの直接アクセスが可能になる。** ヘッダー偽装だけでは Worker JWT 検証で防げるが、**必ず workers.dev も Access Application に含めること。**

### 4.4 ローカル開発

```bash
cp apps/v2/.dev.vars.example apps/v2/.dev.vars
# ACCESS_REQUIRED = "false"
```

ローカルでは `X-Qarows-User: you@example.com` ヘッダ（任意）。未指定時は `dev@local`。

### 4.5 動作確認

- 本番: 未ログイン → Access ログイン画面
- 本番: JWT なし / 無効 JWT → 401
- 本番: 偽装ヘッダーのみ → 401（JWT 必須）
- ローカル: `ACCESS_REQUIRED=false` で `/projects` が表示される

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
| WebSocket 接続失敗 | 本番では Access が WebSocket Upgrade を許可しているか確認 |
| API が 401 | JWT / AUD / TEAM_DOMAIN 設定。Access ログイン済みか。ローカルは `ACCESS_REQUIRED=false` |
| workers.dev が Access 外 | **必ず** Access Application に workers.dev ホストを追加 |
| 409 on create | 同じ `project.id` の tests.yml が既に存在。上書きまたは id を変更 |
| `wrangler.toml` がない | `cp wrangler.toml.example wrangler.toml` |

---

## セキュリティ

- `wrangler.toml`（account_id 等）、`.dev.vars`、API トークンは **コミットしない**
- 本番は `ACCESS_TEAM_DOMAIN` + JWT 検証必須。allow guard は Method A（`ACCESS_ALLOWED_EMAILS`）または B（`ACCESS_ALLOWED_EMAIL_DOMAIN`）を推奨
- workers.dev とカスタムドメイン **両方** を Access Application に登録する

---

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-06-28 | 初版 |
