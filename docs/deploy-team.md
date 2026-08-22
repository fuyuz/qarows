# Team 版デプロイ手順（Cloudflare Workers）

**qarows Team**（`apps/team`）を **各自の closed 環境** にセルフデプロイする手順。

- 公式の共通 Team 版インスタンスは **提供しない**
- 1 デプロイ = 1 組織（または 1 チーム）の閉じた QA 環境
- D1 / Durable Objects / Access ポリシーはデプロイごとに独立

一般方針は [deployment.md](./deployment.md) を参照。Local 版公式インスタンスは [deploy-local.md](./deploy-local.md)。

---

## 概要

| 項目 | 内容 |
|---|---|
| 成果物 | `apps/team/dist`（SPA）+ `apps/team/worker`（Hono API + Durable Objects） |
| ホスティング | 1 つの Worker（`[assets]` + API + WebSocket） |
| 永続化 | D1（プロジェクト snapshot）+ Durable Objects（リアルタイム同期） |
| 認証（本番） | Cloudflare Access（組織内メンバー限定）+ Worker 側 enforce |
| データの所在 | そのデプロイの D1 / DO のみ（他環境と非共有） |
| ローカル開発 | Vite `:5177` + Wrangler `:8787`（Vite が `/api` を proxy） |

構成図: [architecture.md](./architecture.md#phase-2--closed-環境--リアルタイム同期)

---

## 1. 前提

- [Bun](https://bun.sh/)（リポジトリルートで `bun install`）
- [Cloudflare アカウント](https://dash.cloudflare.com/)
- Wrangler CLI（`apps/team` の devDependency に含まれる）

```bash
bun install
bunx wrangler login
```

---

## 2. ローカル開発

### 初回セットアップ

```bash
cp apps/team/wrangler.toml.example apps/team/wrangler.toml
# 必要なら account_id を wrangler.toml に記入（deploy 時必須）

cp apps/team/.dev.vars.example apps/team/.dev.vars   # 任意（シークレット不要）
```

`wrangler.toml` は **gitignore** 対象。テンプレートのみリポジトリに含める。

### 起動

リポジトリルート:

```bash
bun run dev:team
```

| URL | 用途 |
|---|---|
| http://localhost:5177 | フロント（HMR） |
| http://127.0.0.1:8787 | Worker 直アクセス |

`dev:team` は Worker と Vite を同時起動し、ローカル D1 マイグレーションを適用する。

Worker のみ / フロントのみ:

```bash
bun run dev:team:worker          # Worker のみ（8787）
bun run --filter @qarows/team dev:frontend   # Vite のみ（5177。Worker は別ターミナルで）
```

停止:

```bash
bun run dev:stop               # Local + Team 版の dev ポートを解放
```

### ローカル確認チェックリスト

- [ ] `/projects` でプロジェクト一覧が表示される
- [ ] サンプル tests.yml または空プロジェクトを作成できる
- [ ] 「続ける」→ セッション設定 → 実行画面へ進める
- [ ] 実行画面で OK/NG を付けるとヘッダの revision が増える
- [ ] 別タブで同じプロジェクトを開くと結果が同期される

---

## 3. 本番デプロイ

`apps/team` ディレクトリで作業する。

### 3.1 wrangler.toml

```bash
cp wrangler.toml.example wrangler.toml
```

`wrangler.toml` に **account_id** を設定する（Dashboard → アカウント概要）。

#### 任意: Workers AI（tests.yml AI 編集）

AI 編集パネルを使う場合のみ、`wrangler.toml.example` のコメントを参考に以下を追加する。

```toml
[ai]
binding = "AI"

[vars]
AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
AI_MODEL_FALLBACK = "@cf/meta/llama-3.1-8b-instruct-fast"
```

- `[ai]` が **ない** デプロイでは AI タブ・API は表示されない（opt-in）
- `AI_MODEL` / `AI_MODEL_FALLBACK` はデプロイごとに固定。未設定時は Worker 内デフォルト（`llama-3.3-70b-instruct-fp8-fast` / `llama-3.1-8b-instruct-fast`）を使用
- AI 編集は [Workers AI JSON Mode](https://developers.cloudflare.com/workers-ai/features/json-mode/) の `json_schema` 対応モデルのみ利用（非対応モデルは Worker が拒否）
- 編集の schema 遵守には 70B 系を推奨。容量・コストを抑える場合は 8B-fast を primary にしてもよい
- `@cf/meta/llama-3.1-8b-instruct`（非 `-fast`）は 2026-05-30 に非推奨。`-fast` / `llama-3.3-70b` を使うこと
- ローカルで AI を試す場合は `wrangler dev --remote` が必要（通常の `dev:team` の Worker 部分を remote 起動に切り替える）
- AI は **Web 検索・外部 API を使わない**。当該プロジェクトの tests.yml と会話内容のみ Cloudflare Workers AI へ送る

### 3.2 D1 データベース作成

```bash
cd apps/team
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

### 3.3b R2 バケット作成（任意: バグ添付機能）

バグへの画像・動画添付を使う場合のみ。**未設定でも他の機能はすべて動作し、添付 UI が非表示になるだけ**（AI 機能と同様のオプショナル扱い）。

```bash
bunx wrangler r2 bucket create qarows-team-attachments
```

`wrangler.toml` にバインディングを追加（`wrangler.toml.example` に記載済み）:

```toml
[[r2_buckets]]
binding = "ATTACHMENTS"
bucket_name = "qarows-team-attachments"
```

- バケット名は **自分の Cloudflare アカウント内で一意** であればよい（S3 と異なりグローバル一意性は不要）。変えたい場合は `bucket_name` を合わせて変更する
- バケットは **公開しない**（Public Access は無効のまま）。配信は必ず Worker プロキシ経由で Access 認証がかかる
- 添付の実体は `projects/<projectId>/attachments/<key>` に保存され、プロジェクト削除時に一括削除される

### 3.4 ビルド & デプロイ

**Access Application を作成し、`ACCESS_AUD` / `ACCESS_TEAM_DOMAIN` を設定してから** デプロイする（[4.4](#44-access_aud--access_team_domain-の取得と設定)）。未設定のままだと本番 API が 401 になる。

リポジトリルート:

```bash
bun run deploy:team
```

または `apps/team` で:

```bash
bun run build
bunx wrangler deploy --config wrangler.toml
```

デプロイ後、Wrangler が表示する `*.workers.dev` URL で `/projects` にアクセスして確認する。

---

## 4. Cloudflare Access（本番認証・アクセス制限）

Team 版 Worker は **Cloudflare Access 必須** で動作する（`AUTH_DEV_BYPASS` を設定しない限り常に有効）。

**1 デプロイ内の全認証ユーザーは全プロジェクトを操作できます**（プロジェクト単位の RBAC は未実装）。チーム全員で共有する closed 環境向けの設計です。

| レイヤ | 役割 |
|---|---|
| Cloudflare Access（Dashboard） | 未認証ユーザーをログイン画面へリダイレクト |
| Worker JWT 検証 | `Cf-Access-Jwt-Assertion` を署名検証（ヘッダー偽装対策） |
| Worker allow guard（任意） | `ACCESS_ALLOWED_EMAILS` または `ACCESS_ALLOWED_EMAIL_DOMAIN` |

### 4.1 Worker 側の必須設定

本番では次の 2 つが **必須** です。Cloudflare は Worker へ自動注入しないため、**Access Application 作成後に Dashboard からコピーして設定**します（手順は [4.4](#44-access_aud--access_team_domain-の取得と設定)）。

```toml
[vars]
ACCESS_TEAM_DOMAIN = "your-team-name"   # Zero Trust の auth domain（サブドメイン部分のみ）
ACCESS_AUD = "xxxxxxxx..."              # Access Application の AUD tag
```

設定方法は次のいずれか:

| 方法 | 向いているケース |
|---|---|
| `wrangler.toml` の `[vars]` | 個人・小チーム。ファイルは gitignore 済み |
| Dashboard → Worker → **Settings** → **Variables and Secrets** | `wrangler.toml` に書きたくない場合。デプロイ後も Dashboard から更新可 |

`ACCESS_AUD` を未設定のまま本番デプロイすると、Worker は JWT 検証前に **401（サーバー設定エラー）** を返します。

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

1. Dashboard → **Zero Trust** → **Access** → **Applications** → **Add an application**
2. **Self-hosted** を選び、保護対象ホストを **1 アプリケーションにまとめて** 登録する（推奨）:
   - カスタムドメイン（例: `qarows.example.com`）
   - **`*.workers.dev` の Worker URL**（例: `qarows-v2.your-subdomain.workers.dev`）
3. 上記 [4.2](#42-ユーザー追加dashboardmethod-a--b) の Method A または B でポリシーを作成
4. 保存後、[4.4](#44-access_aud--access_team_domain-の取得と設定) の手順で AUD を Worker に設定する

**workers.dev だけ Access 外に残すと、Layer 1 がなく JWT なしの直接アクセスが可能になる。** 必ず workers.dev も同じ Access Application（または別 app だが AUD を別途設定）に含めること。

#### workers.dev をワンクリックで保護する場合

1. Dashboard → **Workers & Pages** → 対象 Worker → **Settings** → **Domains & Routes**
2. `workers.dev` または Preview URLs の **Enable Cloudflare Access** をクリック
3. 表示されるモーダルに **Application Audience (AUD)** と **Team domain** が出る → [4.4](#44-access_aud--access_team_domain-の取得と設定) へ

カスタムドメインを追加した場合は、Zero Trust の Application にそのホストも追加する（1 app に複数ホスト推奨）。

### 4.4 ACCESS_AUD / ACCESS_TEAM_DOMAIN の取得と設定

Cloudflare Access を有効にしても、Worker 環境変数は **自動では埋まりません**。初回デプロイ前（または Access 有効化直後）に、次を **1 回** 設定してください。

#### ACCESS_TEAM_DOMAIN の確認

Zero Trust の team 名（`https://<TEAM>.cloudflareaccess.com` の `<TEAM>` 部分）:

1. Dashboard → **Zero Trust** → **Settings** → **Custom pages**（または組織設定）
2. ブラウザ URL が `https://<TEAM>.cloudflareaccess.com/...` になっている → `<TEAM>` を `ACCESS_TEAM_DOMAIN` に設定

例: URL が `https://acme.cloudflareaccess.com` → `ACCESS_TEAM_DOMAIN = "acme"`

#### ACCESS_AUD の確認

Application ごとに 1 つ。JWT の `aud` と一致させる必要があります。

1. Dashboard → **Zero Trust** → **Access** → **Applications**
2. qarows 用 Application を開く → **Overview**（または **Configure**）
3. **Application Audience (AUD) Tag** をコピー（64 文字前後の英数字）
4. `wrangler.toml` の `[vars]` または Dashboard の Worker Variables に貼り付け:

```toml
ACCESS_AUD = "32eafc7626e974616deaf0dc3ce63d7bcbed58a2731e84d06bc3cdf1b53c4228"
```

#### ホストが複数ある場合

| 構成 | ACCESS_AUD |
|---|---|
| **1 Application に workers.dev + カスタムドメインを両方登録**（推奨） | その Application の AUD **1 つ** |
| Application をホストごとに分けた | **現状は 1 つの AUD のみ対応**。Application を 1 つに統合するか、不要なホスト用 app を削除して単一 AUD に揃える |

設定後、本番 URL にアクセスし、Access ログイン → `/api/me` が 200 になることを確認する（[4.6](#46-動作確認)）。

### 4.5 ローカル開発

```bash
cp apps/team/.dev.vars.example apps/team/.dev.vars
# AUTH_DEV_BYPASS = "true"  （example に含まれる）
```

ローカルでは Access/JWT/AUD は不要（`AUTH_DEV_BYPASS=true` は **localhost / 127.0.0.1:8787 へのリクエストのみ** 有効）。`X-Qarows-User: you@example.com` ヘッダ（任意）。未指定時は `dev@local`。

### 4.6 動作確認

- 本番: 未ログイン → Access ログイン画面
- 本番: JWT なし / 無効 JWT → 401
- 本番: `ACCESS_AUD` 未設定 → 401（サーバー設定エラー）
- 本番: 偽装ヘッダーのみ → 401（JWT 必須）
- ローカル: `AUTH_DEV_BYPASS=true` で `/projects` が表示される

---

## 5. カスタムドメイン（任意）

1. Dashboard → **Workers & Pages** → デプロイした Worker
2. **Settings** → **Domains & Routes** → **Add**
3. DNS 指示に従い、Access アプリケーションの対象ホストも更新する

---

## アーキテクチャ

詳細な構成図・シーケンス図は [architecture.md](./architecture.md#phase-2--closed-環境--リアルタイム同期) を参照。

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
| `dev:team` で API エラー | Worker が 8787 で起動しているか。`wrangler.toml` があるか |
| D1 `no such table` | `bun run db:migrate:local` または `--remote` で migrations 適用 |
| WebSocket 接続失敗 | 本番では Access が WebSocket Upgrade を許可しているか確認 |
| API が 401 | JWT / `ACCESS_AUD` / `ACCESS_TEAM_DOMAIN` 設定。Access ログイン済みか。[4.4](#44-access_aud--access_team_domain-の取得と設定) を確認。ローカルは `AUTH_DEV_BYPASS=true` |
| workers.dev が Access 外 | **必ず** Access Application に workers.dev ホストを追加 |
| 409 on create | 同じ `project.id` の tests.yml が既に存在。上書きまたは id を変更 |
| `wrangler.toml` がない | `cp wrangler.toml.example wrangler.toml` |

---

## セキュリティ

- `wrangler.toml`（account_id 等）、`.dev.vars`、API トークンは **コミットしない**
- 本番は `ACCESS_TEAM_DOMAIN` + JWT 検証必須。allow guard は Method A（`ACCESS_ALLOWED_EMAILS`）または B（`ACCESS_ALLOWED_EMAIL_DOMAIN`）を推奨
- workers.dev とカスタムドメイン **両方** を Access Application に登録する
- `AUTH_DEV_BYPASS` はローカル `wrangler`（`localhost` / `127.0.0.1:8787`）でのみ有効。本番ホストでは設定しても無視される
- 状態変更 API は Origin（または `Sec-Fetch-Site: same-origin`）を検証する。`clear-results` は JSON + `expectedGeneration` 必須
- AI propose はメール単位の簡易レート制限あり（isolate 内）。本番では Cloudflare Rate Limiting の併用を推奨
- Access JWT は `email` claim 必須（`common_name` は使わない）
- WebSocket は本番で Origin 必須。`PUT /definition` も `expectedGeneration` 必須
- AI の提案はサーバー保存（30分 TTL）。適用専用 API は無く、エディタの draft に読み込んでから通常の定義編集として保存する。
  TTL が効くのは提案を続けて編集する（`/ai/propose` のチェーン）経路

---

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-06-28 | 初版 |
| 2026-07-12 | README / deployment.md から手順の正本として明示 |
