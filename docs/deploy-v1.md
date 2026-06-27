# Phase 1 デプロイ手順（Cloudflare Pages）

メンテナ向け。**qarows Phase 1**（`apps/v1`）を公式 Cloudflare Pages インスタンスとして公開する手順。

利用者向けの一般方針は [deployment.md](./deployment.md) を参照。

---

## 概要

| 項目 | 内容 |
|---|---|
| 成果物 | `apps/v1/dist`（Vite ビルドの静的 SPA） |
| ホスティング | Cloudflare Pages |
| サーバー | 不要（IndexedDB + ファイル I/O のみ） |
| ルーティング | `public/_redirects` で SPA フォールバック |

---

## 事前準備

### 1. ローカルでビルド確認

リポジトリルートで:

```bash
bun install
bun run typecheck
bun run test
bun run build
bun run preview:start   # http://localhost:5173
```

`/load` からサンプル読み込み、セッション開始、各画面遷移が問題ないことを確認する。

### 2. Cloudflare API トークン

[Cloudflare Dashboard](https://dash.cloudflare.com/) → **My Profile** → **API Tokens** → **Create Token**

推奨: **Edit Cloudflare Workers** テンプレートをベースに、Pages 編集権限を含める。

最低限の権限例:

- Account → **Cloudflare Pages** → Edit

トークンと **Account ID**（Dashboard 右サイドバー）は **GitHub Secrets** または手元の `.env` に保存し、**リポジトリにはコミットしない**。

| Secret 名 | 用途 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Pages デプロイ用 API トークン |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare アカウント ID |

任意（デフォルト `qarows`）:

| Variable 名 | 用途 |
|---|---|
| `CLOUDFLARE_PAGES_PROJECT` | Pages プロジェクト名 |

---

## 初回公開

### 方法 A: Cloudflare Dashboard + Git 連携（推奨）

継続デプロイが簡単。PR プレビューも利用できる。

1. Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. GitHub リポジトリ `qarows` を選択
3. ビルド設定:

| 設定 | 値 |
|---|---|
| Production branch | `main` |
| Framework preset | None |
| Build command | `bun run build` |
| Build output directory | `apps/v1/dist` |
| Root directory | `/`（リポジトリルート） |

4. **Environment variables**（Bun 利用時）  
   Cloudflare が `bun.lock` を検出すれば Bun を使う。うまくいかない場合は Build command を次に変更:

   ```bash
   curl -fsSL https://bun.sh/install | bash && ~/.bun/bin/bun install && ~/.bun/bin/bun run build
   ```

5. **Save and Deploy**
6. 初回デプロイ完了後、`*.pages.dev` の URL で動作確認

**注意:** Dashboard 連携だけの場合、GitHub Actions の `deploy-v1.yml` は不要（二重デプロイを避けるため、どちらか一方を選ぶ）。

---

### 方法 B: Wrangler CLI（手動・初回向け）

Dashboard を使わず、手元から一度だけ上げる場合。

```bash
# ログイン（初回）
bunx wrangler login

# プロジェクト作成（初回のみ）
bunx wrangler pages project create qarows

# ビルド & デプロイ
bun run build
bunx wrangler pages deploy apps/v1/dist --project-name=qarows --branch=main
```

デプロイ URL はコマンド出力、または Dashboard → Pages → **qarows** → **Deployments** で確認。

---

### 方法 C: GitHub Actions（`deploy-v1.yml`）

`main` への push、または手動実行（`workflow_dispatch`）でデプロイ。

#### セットアップ

1. リポジトリ → **Settings** → **Secrets and variables** → **Actions**
2. 上記 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` を登録
3. （任意）**Variables** に `CLOUDFLARE_PAGES_PROJECT` = `qarows`
4. **初回のみ** Dashboard または `wrangler pages project create qarows` で Pages プロジェクトを作成
5. **方法 A（Git 連携）を使っている場合は `deploy-v1.yml` を無効化または削除**（二重デプロイ防止）

#### 実行

- `main` へ merge すると自動デプロイ
- または Actions タブ → **Deploy Phase 1** → **Run workflow**

---

## 公開後の確認

公式 URL（`*.pages.dev` またはカスタムドメイン）で次を確認:

- [ ] `/load` が表示される
- [ ] 「サンプルを試す」→ セッション開始 → `/run` まで進める
- [ ] 直接 `/p/qarows/dashboard` 等にアクセスしても 404 にならない（SPA フォールバック）
- [ ] リロード後も IndexedDB から状態が復元される
- [ ] ナビから results.json / tests.yml をエクスポートできる

リグレッション用チェックリストは `apps/v1/public/samples/tests.yml` のシナリオを参照。

---

## カスタムドメイン（任意）

1. Dashboard → Pages → **qarows** → **Custom domains**
2. ドメインを追加し、DNS 指示に従う
3. 本番 URL は README や issue 等で告知（リポジトリに固定 URL を書く必要はない）

---

## トラブルシューティング

| 症状 | 対処 |
|---|---|
| 深い URL で 404 | `apps/v1/public/_redirects` がビルドに含まれているか確認。`dist/_redirects` に `/* /index.html 200` があること |
| lazy chunk 読み込み失敗 | 古い HTML と新しい asset の不整合。ハードリロード、またはキャッシュクリア |
| Dashboard ビルド失敗 | ルートで `bun run build` が通るかローカル確認。monorepo の output path が `apps/v1/dist` か確認 |
| Actions デプロイ失敗 | Secrets の typo、Pages プロジェクト未作成、トークン権限不足を確認 |
| 二重デプロイ | Git 連携と `deploy-v1.yml` を同時に有効にしていないか確認 |

---

## セキュリティ

- API トークン・Account ID・本番 URL は **コミットしない**
- Phase 1 は静的 SPA のため、ビルド時に秘密情報を埋め込む必要はない
- 将来 Phase 2 用の `wrangler.toml` / `.dev.vars` は [deployment.md](./deployment.md) の gitignore 方針に従う

---

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-06-28 | 初版 |
