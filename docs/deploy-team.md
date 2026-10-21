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
| ホスティング | 1 つの Worker（静的アセット + API + WebSocket） |
| 永続化 | D1（プロジェクト snapshot）+ Durable Objects（リアルタイム同期） |
| 認証（本番） | Cloudflare Access（組織内メンバー限定）+ Worker 側 enforce |
| データの所在 | そのデプロイの D1 / DO のみ（他環境と非共有） |
| ローカル開発 | Vite `:5177` + `cf dev` `:8787`（Vite が `/api` を proxy） |

構成図: [architecture.md](./architecture.md#phase-2--closed-環境--リアルタイム同期)

---

## 1. 前提

- [Bun](https://bun.sh/)（リポジトリルートで `bun install`）
- [Cloudflare アカウント](https://dash.cloudflare.com/)
- cf CLI（`apps/team` の devDependency に含まれる。`apps/team` で `bunx cf ...` として実行する）
- Wrangler も devDependency に残している。`cf dev` / `cf deploy` が内部で Wrangler に委譲するため（CLI として直接実行する手順はない）

```bash
bun install
cd apps/team
bunx cf auth login     # ブラウザ（デバイス認可）でログイン。Wrangler のログインとは別
bunx cf auth whoami    # アカウント ID もここで確認できる
```

> **cf はオープンベータ。** コマンド・設定形式は stable までに変わりうる。このリポジトリは `cf` を exact で固定している（`apps/team/package.json`）。
>
> 環境変数 `CLOUDFLARE_API_TOKEN` があると cf は OAuth より優先して使う。Workers / Zero Trust の権限がないトークンが入っていると失敗するので、その場合は `env -u CLOUDFLARE_API_TOKEN bunx cf ...` のように外して実行する。

---

## 2. ローカル開発

### 初回セットアップ

```bash
cp apps/team/cloudflare.config.example.ts apps/team/cloudflare.config.ts
cp apps/team/.dev.vars.example apps/team/.dev.vars   # AUTH_DEV_BYPASS=true（ローカル専用）
```

`cloudflare.config.ts` は **gitignore** 対象。テンプレート `cloudflare.config.example.ts` のみリポジトリに含める。ローカル開発だけならテンプレートの値（仮の D1 id 含む）のままでよい。

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

`apps/team` ディレクトリで作業する。リソース作成・Access 設定・デプロイはすべて `cf` で行える（Dashboard 操作は不要）。

順番は **リソース作成 → Access Application 作成 → 設定記入 → デプロイ**。Access を先に作っておくと、デプロイ直後から保護された状態になる。

### 3.1 cloudflare.config.ts

```bash
cp cloudflare.config.example.ts cloudflare.config.ts
```

`accountId` に `bunx cf auth whoami` の `accounts[].id` を設定する（環境変数 `CLOUDFLARE_ACCOUNT_ID` でも可）。`worker.name` は任意（以下 `<worker-name>`）。`PROJECT` binding の `worker` も同じ名前にそろえる。

#### 任意: Workers AI（tests.yml AI 編集）

AI 編集パネルを使う場合のみ、`cloudflare.config.example.ts` のコメントを参考に `worker.env` へ追加する。

```ts
AI: bindings.ai(),
AI_MODEL: bindings.text("@cf/meta/llama-3.3-70b-instruct-fp8-fast"),
AI_MODEL_FALLBACK: bindings.text("@cf/meta/llama-3.1-8b-instruct-fast"),
AI_RATE_LIMIT: bindings.rateLimit({ namespace: "1001", simple: { limit: 20, period: 60 } }),
```

- `AI` が **ない** デプロイでは AI タブ・API は表示されない（opt-in）
- **`AI_RATE_LIMIT` は `AI` を有効にするなら設定すること。** 未設定でも動くが、その場合の
  レート制限は isolate ローカルの Map なので実効上限が定まらず（Cloudflare は isolate を
  多数立てる）、Workers AI の利用量に上限がかからない。設定すると Cloudflare の
  ロケーション単位で数える（グローバルではない点は要注意）。`period` は 10 か 60 のみ
- `AI_MODEL` / `AI_MODEL_FALLBACK` はデプロイごとに固定。未設定時は Worker 内デフォルト（`llama-3.3-70b-instruct-fp8-fast` / `llama-3.1-8b-instruct-fast`）を使用
- AI 編集は [Workers AI JSON Mode](https://developers.cloudflare.com/workers-ai/features/json-mode/) の `json_schema` 対応モデルのみ利用（非対応モデルは Worker が拒否）
- 編集の schema 遵守には 70B 系を推奨。容量・コストを抑える場合は 8B-fast を primary にしてもよい
- `@cf/meta/llama-3.1-8b-instruct`（非 `-fast`）は 2026-05-30 に非推奨。`-fast` / `llama-3.3-70b` を使うこと
- AI は **Web 検索・外部 API を使わない**。当該プロジェクトの tests.yml と会話内容のみ Cloudflare Workers AI へ送る

### 3.2 D1 データベース作成とマイグレーション

```bash
bunx cf d1 create --name qarows-v2
```

出力の `uuid` を `cloudflare.config.ts` の `DB` binding の `id` に設定する:

```ts
DB: bindings.d1({ name: "qarows-v2", id: "<D1_DATABASE_ID>" }),
```

リモートにマイグレーションを適用する（cf の D1 コマンドは名前ではなく **ID** を受け付ける）:

```bash
bunx cf d1 migrations apply <D1_DATABASE_ID> --dir migrations
```

Durable Objects（`ProjectRoom`）は `worker.exports` の宣言どおり、初回デプロイ時に作成される。

### 3.3 R2 バケット作成（任意: バグ添付機能）

バグへの画像・動画添付を使う場合のみ。**未設定でも他の機能はすべて動作し、添付 UI が非表示になるだけ**（AI 機能と同様のオプショナル扱い）。

```bash
bunx cf r2 buckets create --name qarows-team-attachments
```

使わない場合は `cloudflare.config.ts` から `ATTACHMENTS` binding を削除する。

- バケット名は **自分の Cloudflare アカウント内で一意** であればよい。変えたい場合は `ATTACHMENTS` の `name` を合わせて変更する
- バケットは **公開しない**（Public Access は無効のまま）。配信は必ず Worker プロキシ経由で Access 認証がかかる
- 添付の実体は `projects/<projectId>/attachments/<key>` に保存され、プロジェクト削除時に一括削除される

### 3.4 公開ホストを決める

Access Application に登録するため、公開するホストを先に決めておく。

| ホスト | 設定 |
|---|---|
| カスタムドメイン（推奨） | `cloudflare.config.ts` 冒頭の `CUSTOM_DOMAINS` に `["qarows.example.com"]` のように書く（`worker.domains` に本番デプロイ時だけ入る）。Cloudflare 上のゾーンのホストなら、デプロイ時に DNS と証明書が自動で用意される（2 階層のサブドメインでも可） |
| workers.dev | `worker.workersDev: true` で `<worker-name>.<your-subdomain>.workers.dev` が有効になる。プレビュー URL `*-<worker-name>.<your-subdomain>.workers.dev` も同じ Access に含める |

`<your-subdomain>` は Dashboard の Workers & Pages、または既存 Worker があれば `bunx cf workers list` の `subdomain.url` で確認できる。

### 3.5 Access Application 作成

[4. Cloudflare Access](#4-cloudflare-access本番認証アクセス制限) の手順で Access Application を作成し、`ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` と allow guard を `cloudflare.config.ts` に記入する。**未設定のままデプロイすると本番 API が 401 になる。**

### 3.6 ビルド & デプロイ

リポジトリルート:

```bash
bun run deploy:team
```

`apps/team/scripts/deploy.sh` が `bun run build` → `cf deploy --mode production` を実行する。

> **`cf deploy` を直接実行しない。** `cloudflare.config.ts` はカスタムドメインを `mode === "production"` のときだけ付ける（`cf dev` に付くとリクエストの URL がそのドメインになり、localhost 限定の開発用バイパスが効かずローカルの API がすべて 401 になるため）。`--mode production` なしでデプロイするとカスタムドメインが外れる。

`cf deploy` はアップロードしたバージョンをそのまま 100% に切り替える（Wrangler 時代の `versions deploy` は不要）。`cloudflare.config.ts` に `AUTH_DEV_BYPASS` が書かれていると deploy を中止する。

確認:

```bash
bunx cf workers deployments list --worker <worker-name>   # 先頭の versions[].percentage が 100
```

### 3.7 カスタムドメインを後から追加する

1. `cloudflare.config.ts` の `CUSTOM_DOMAINS` にホストを追加
2. Access Application の `self_hosted_domains` にも同じホストを追加（[4.3](#43-access-applicationcf) の `update`）
3. `bun run deploy:team`

証明書の発行に数分かかることがある（その間は TLS ハンドシェイクが失敗する）。

---

## 4. Cloudflare Access（本番認証・アクセス制限）

Team 版 Worker は **Cloudflare Access 必須** で動作する（`AUTH_DEV_BYPASS` を設定しない限り常に有効）。

**1 デプロイ内の全認証ユーザーは全プロジェクトを操作できます**（プロジェクト単位の RBAC は未実装）。チーム全員で共有する closed 環境向けの設計です。

| レイヤ | 役割 |
|---|---|
| Cloudflare Access | 未認証ユーザーをログイン画面へリダイレクト |
| Worker JWT 検証 | `Cf-Access-Jwt-Assertion` を署名検証（ヘッダー偽装対策） |
| Worker allow guard（任意） | `ACCESS_ALLOWED_EMAILS` または `ACCESS_ALLOWED_EMAIL_DOMAIN` |

### 4.1 Worker 側の必須設定

本番では次の 2 つが **必須** です。Cloudflare は Worker へ自動注入しないため、Access Application 作成後に `cloudflare.config.ts` の `worker.env` に記入します。

```ts
ACCESS_TEAM_DOMAIN: bindings.text("your-team-name"),   // Zero Trust の auth domain（サブドメイン部分のみ）
ACCESS_AUD: bindings.text("xxxxxxxx..."),              // Access Application の AUD tag
```

`ACCESS_AUD` を未設定のまま本番デプロイすると、Worker は JWT 検証前に **401（サーバー設定エラー）** を返します。

JWT 検証後、メールアドレスは **JWT の claim から取得**する（`Cf-Access-Authenticated-User-Email` 単体は信頼しない）。ヘッダー email がある場合は JWT と一致することを確認する。

### 4.2 ユーザー制限 — Method A / B

Access ポリシーで許可する相手を決め、Worker 側 allow guard にも **どちらか一方** を mirror する（両方設定時は **EMAILS 優先**）。

| 方式 | Access ポリシー（`include`） | Worker（`worker.env`） |
|---|---|---|
| **A: 個人メール** | `{ "email": { "email": "alice@example.com" } }` を人数分 | `ACCESS_ALLOWED_EMAILS: bindings.text("alice@example.com,bob@example.com")` |
| **B: 組織ドメイン** | `{ "email_domain": { "domain": "example.com" } }` | `ACCESS_ALLOWED_EMAIL_DOMAIN: bindings.text("example.com")` |

- Method A: 招待メールは自動送信されない。URL を個別共有する。
- Method B: そのドメインの Google / GitHub 等 IdP でログイン可能。
- allow guard を省略すると JWT + Access ポリシーのみ（非推奨だが可）。

### 4.3 Access Application（cf）

保護対象ホスト（[3.4](#34-公開ホストを決める)）を **1 つの Application にまとめて** 登録する。ポリシーは Application と同時にインラインで作成できる。

`access-app.json`（**コミットしない**。実メールアドレスやホスト名が入る）:

```json
{
  "name": "qarows-team",
  "type": "self_hosted",
  "domain": "qarows.example.com",
  "self_hosted_domains": [
    "qarows.example.com",
    "<worker-name>.<your-subdomain>.workers.dev",
    "*-<worker-name>.<your-subdomain>.workers.dev"
  ],
  "session_duration": "24h",
  "app_launcher_visible": false,
  "policies": [
    {
      "name": "Allow members",
      "decision": "allow",
      "include": [{ "email": { "email": "alice@example.com" } }]
    }
  ]
}
```

```bash
bunx cf zero-trust access applications create --body "$(cat access-app.json)" --dry-run   # 送信内容の確認
bunx cf zero-trust access applications create --body "$(cat access-app.json)"
```

出力の `aud` が `ACCESS_AUD`、`policies[].id` が後で更新するときのポリシー ID。

ホストを追加・変更するときは `update` で Application 全体を送り直す（`policies` は既存 ID を参照する）:

```bash
# access-app.json の policies を [{ "id": "<POLICY_ID>", "precedence": 1 }] に置き換えてから
bunx cf zero-trust access applications update <APP_ID> --body "$(cat access-app.json)"
bunx cf zero-trust access applications list   # 確認
```

**workers.dev（とプレビュー URL）だけ Access 外に残すと、Layer 1 がなく JWT なしの直接アクセスが可能になる。** `workersDev: true` なら必ず同じ Application に含めること。

### 4.4 ACCESS_TEAM_DOMAIN / ACCESS_AUD の取得

```bash
bunx cf zero-trust organization get   # auth_domain: "<TEAM>.cloudflareaccess.com"
```

- `ACCESS_TEAM_DOMAIN` = `auth_domain` の `<TEAM>` 部分（例: `acme.cloudflareaccess.com` → `"acme"`）。Zero Trust の team 名を変更するとここも変わるので、変更したら記入し直して再デプロイする
- `ACCESS_AUD` = 4.3 の `create` 出力の `aud`（`bunx cf zero-trust access applications list` でも確認できる）

| 構成 | ACCESS_AUD |
|---|---|
| **1 Application に workers.dev + カスタムドメインを両方登録**（推奨） | その Application の AUD **1 つ** |
| Application をホストごとに分けた | **現状は 1 つの AUD のみ対応**。Application を 1 つに統合する |

### 4.5 ローカル開発

```bash
cp apps/team/.dev.vars.example apps/team/.dev.vars
# AUTH_DEV_BYPASS = "true"  （example に含まれる）
```

ローカルでは Access/JWT/AUD は不要（`AUTH_DEV_BYPASS=true` は **localhost / 127.0.0.1:8787 へのリクエストのみ** 有効）。`X-Qarows-User: you@example.com` ヘッダ（任意）。未指定時は `dev@local`。

### 4.6 動作確認

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://<host>/api/me
# 302 https://<TEAM>.cloudflareaccess.com/cdn-cgi/access/login/<host> ... なら Access で保護されている
```

公開した全ホスト（カスタムドメイン・workers.dev・プレビュー URL）で確認する。

- 本番: 未ログイン → Access ログイン画面（302）
- 本番: ログイン後に `/api/me` が 200
- 本番: JWT なし / 無効 JWT → 401
- 本番: `ACCESS_AUD` 未設定 → 401（サーバー設定エラー）
- 本番: 偽装ヘッダーのみ → 401（JWT 必須）
- ローカル: `AUTH_DEV_BYPASS=true` で `/projects` が表示される

---

## 6. MCP サーバー（任意）

Claude Code や claude.ai などの AI から、Team 版のデータを MCP で参照・編集できる。Worker の `/mcp`（Streamable HTTP）で提供する。

### 6.1 できること / できないこと

| 種別 | ツール |
|---|---|
| 参照 | `whoami` `list_projects` `get_project`（overview・端末・進捗） `list_test_cases`（分類・シナリオ・結果・端末・文字列で絞り込み） `get_test_case` `list_bugs` `get_bug` |
| 結果・メモ | `set_results`（OK / NG / SKIP、対象端末のみ） `clear_result`（1 セルを未実施に戻す） `set_memo` |
| バグ | `create_bug` `update_bug`（バグの削除はない） |
| テスト定義 | `add_test_case` `update_test_case`（ID は変更不可） `delete_test_case` `add_environment` `rename_environment` `delete_environment` `set_overview` |

- **できない操作**: プロジェクトの削除、結果の全クリア、results.json の取り込み、tests.yml の丸ごと置き換え、バグの削除。送れるコマンドはコードで限定している（`apps/team/worker/mcp/server.ts`）
- バグが紐づいているテストケースは削除できない（先に `update_bug` で紐づけを外す。外さずに消すとバグも消えるため）
- テストケース・端末の削除では、その結果とメモが消える。定義の履歴（直近 20 件）からは定義は戻せるが、消えた結果は戻らない
- 結果の実施者（executedBy）は Access でログインした利用者のメールアドレスになる
- 定義の編集は、画面の定義編集と同じ保存処理（履歴の記録 + 同時編集の検知）を通る。他の人が先に保存していた場合はエラーを返し、AI に読み直させる
- 書き込みは画面にリアルタイムで反映される

### 6.2 構成

Cloudflare Access の **Managed OAuth** を使い、MCP クライアントのログインを Access に任せる。Managed OAuth は Access Application 全体の設定（ブラウザ以外の未認証アクセスが 302 ではなく 401 + `WWW-Authenticate` になる）なので、**MCP 専用のホスト名と Access Application を別に作る**。画面用ホストの設定は変えない。

画面用 Application で Managed OAuth を有効にすると、MCP クライアントのトークンが画面と同じ AUD の JWT になり、`/api` を直接叩いてプロジェクトの削除などもできてしまう（Worker からはブラウザのログインと見分けられない）。同じホストに `/mcp` だけのパス限定 Application を足す方法は、Managed OAuth のドキュメントに記載がないため採らない。

- MCP 専用ホストでは `/api` などの Worker のルートは `/mcp` 以外を返さない（画面の静的ファイルは Access を通った利用者には返るが、データは含まない）
- Worker は MCP 専用ホストへのリクエストを MCP 用 Application の AUD（`MCP_ACCESS_AUD`）だけで、画面用ホストは `ACCESS_AUD` だけで検証する（トークンの使い回しを防ぐ）
- `/mcp` は Host / Origin を MCP 専用ホストに限定する（DNS rebinding・ブラウザからの越境呼び出し対策）

### 6.3 手順

1. `cloudflare.config.ts` の `CUSTOM_DOMAINS` に MCP 専用ホストを追加する（例: `["qarows.example.com", "qarows-mcp.example.com"]`）
2. MCP 専用の Access Application を作る。`mcp-access-app.json`（**コミットしない**。実メールが入る。`*access-app.json` は gitignore 済み）:

   ```json
   {
     "name": "qarows-team-mcp",
     "type": "self_hosted",
     "domain": "qarows-mcp.example.com",
     "self_hosted_domains": ["qarows-mcp.example.com"],
     "session_duration": "24h",
     "app_launcher_visible": false,
     "policies": [
       { "name": "Allow members", "decision": "allow", "include": [{ "email": { "email": "alice@example.com" } }] }
     ],
     "oauth_configuration": {
       "enabled": true,
       "dynamic_client_registration": {
         "enabled": true,
         "allow_any_on_localhost": true,
         "allow_any_on_loopback": true,
         "allowed_uris": ["https://claude.ai/api/mcp/auth_callback"]
       },
       "grant": { "access_token_lifetime": "15m", "session_duration": "336h" }
     }
   }
   ```

   ```bash
   bunx cf zero-trust access applications create --body "$(cat mcp-access-app.json)"
   ```

   - `allow_any_on_localhost` / `allow_any_on_loopback`: Claude Code（ローカルのポートで OAuth の戻り先を受ける）用
   - `allowed_uris`: claude.ai（Web / Desktop / モバイル）の固定コールバック。使わないなら外す
   - ポリシーは画面用 Application と同じ相手にする（4.2）
3. 出力の `aud` を `MCP_ACCESS_AUD` に、ホスト名を `MCP_HOSTNAME` に設定する（`cloudflare.config.example.ts` のコメント参照）
4. `bun run deploy:team`
5. 確認（証明書の発行に数分かかることがある）:

   ```bash
   curl -s -D - -o /dev/null -X POST https://qarows-mcp.example.com/mcp   # 401 と WWW-Authenticate
   curl -s https://qarows-mcp.example.com/.well-known/oauth-authorization-server   # Access の OAuth メタデータ（JSON）
   ```

### 6.4 接続

- **Claude Code**: `claude mcp add --transport http qarows https://qarows-mcp.example.com/mcp` を実行し、`/mcp` から認証するとブラウザで Access のログインが開く
- **claude.ai**: 設定 → コネクタ → カスタムコネクタを追加 で URL に `https://qarows-mcp.example.com/mcp` を入れる

ログイン後は `whoami` で自分のメールアドレスが返ることを確認する。

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
| `dev:team` で API エラー | Worker が 8787 で起動しているか。`cloudflare.config.ts` があるか |
| D1 `no such table` | ローカルは `bun run --filter @qarows/team db:migrate:local`、本番は `bunx cf d1 migrations apply <D1_DATABASE_ID> --dir migrations` |
| WebSocket 接続失敗 | 本番では Access が WebSocket Upgrade を許可しているか確認 |
| API が 401 | JWT / `ACCESS_AUD` / `ACCESS_TEAM_DOMAIN` 設定。Access ログイン済みか。[4.4](#44-access_team_domain--access_aud-の取得) を確認（Zero Trust の team 名を変えていないか）。ローカルは `AUTH_DEV_BYPASS=true` |
| workers.dev が Access 外 | **必ず** Access Application に workers.dev ホストを追加 |
| 409 on create | 同じ `project.id` の tests.yml が既に存在。上書きまたは id を変更 |
| `cloudflare.config.ts` がない | `cp cloudflare.config.example.ts cloudflare.config.ts` |
| カスタムドメインで TLS エラー | 証明書の発行待ち。数分待って再確認する |
| cf が権限エラー | `CLOUDFLARE_API_TOKEN` が OAuth より優先されている。`env -u CLOUDFLARE_API_TOKEN` を付けて実行する |

---

## セキュリティ

- `cloudflare.config.ts`（accountId・Access 設定・許可メール等）、`access-app.json`、`.dev.vars`、API トークンは **コミットしない**
- 本番は `ACCESS_TEAM_DOMAIN` + JWT 検証必須。allow guard は Method A（`ACCESS_ALLOWED_EMAILS`）または B（`ACCESS_ALLOWED_EMAIL_DOMAIN`）を推奨
- workers.dev とカスタムドメイン **両方** を Access Application に登録する
- `AUTH_DEV_BYPASS` はローカル dev サーバー（`localhost` / `127.0.0.1:8787`）でのみ有効。本番ホストでは設定しても無視される。
  値は `.dev.vars` にだけ置く。`bun run deploy:team` は `cloudflare.config.ts` に `AUTH_DEV_BYPASS` があると deploy を中止する
- `workersDev` はテンプレートで `false`。カスタムドメイン運用なら露出を減らせる。`true` にする場合は
  Access Application に workers.dev とプレビュー URL のホストも含める（[4.3](#43-access-applicationcf)）
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
| 2026-10-15 | Wrangler から cf CLI（`cloudflare.config.ts`）へ移行。Access Application も cf で作成 |
| 2026-10-19 | MCP サーバー（専用ホスト + Managed OAuth）を追加 |
