# Phase 1 デプロイ手順（Cloudflare Pages）

メンテナ向け。**qarows Phase 1**（`apps/v1`）を公式 Cloudflare Pages インスタンスとして公開する手順。

**採用方式:** Cloudflare Dashboard + GitHub 連携（方法 A）。デプロイは Cloudflare 側が行い、GitHub Actions の deploy workflow は使わない。

利用者向けの一般方針は [deployment.md](./deployment.md) を参照。

---

## 概要

| 項目 | 内容 |
|---|---|
| 成果物 | `apps/v1/dist`（Vite ビルドの静的 SPA） |
| ホスティング | Cloudflare Pages（Git 連携） |
| 本番 URL | **https://qarows.fuyuz.dev** |
| 本番ブランチ | `main` |
| ルーティング | `apps/v1/public/_redirects` → SPA フォールバック |

---

## 1. ローカル確認（初回のみ）

リポジトリルートで:

```bash
bun install
bun run typecheck
bun run test
bun run build
bun run preview:start   # http://localhost:5173
```

`/load` からサンプル読み込み、セッション開始、各画面遷移が問題ないことを確認する。

---

## 2. Cloudflare Pages プロジェクト作成

### Workers と Pages の見分け（重要）

**Create application** を押すと **Workers タブがデフォルト** になっている。ここで Git 連携すると **Workers Builds** 用の設定になり、Build output directory も出ない。

| | Workers（間違い） | Pages（正しい） |
|---|---|---|
| デプロイ先 | `*.workers.dev` | `*.pages.dev` |
| qarows Phase 1 | 向いていない | **これ** |
| 設定画面 | Worker script / bindings | Build command / output directory |

**手順:**

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages**
2. **Create application**（または **Create**）
3. 画面上部のタブで **Pages** を選ぶ（**Workers ではない**）
4. **Connect to Git** を選ぶ
5. GitHub を認可し、**fuyuz/qarows** を選択 → **Begin setup**

すでに Workers プロジェクトを作ってしまった場合は、Dashboard から削除し、上記の **Pages** タブから作り直す。

### ビルド設定

| 設定 | 値 |
|---|---|
| Project name | `qarows`（任意。Pages URL の一部になる） |
| Production branch | `main` |
| Framework preset | **Vite** または **None** |
| **Root directory (advanced) → Path** | **`apps/v1`**（monorepo 用。ここが重要） |
| Build command | `bun run build` |
| Build output directory | **`dist`**（Vite preset なら自動。Path を `apps/v1` にした場合の相対パス） |

Root directory を `apps/v1` にすると、成果物は `apps/v1/dist` に出力され、Cloudflare は `dist` を参照する。リポジトリルートのまま使う場合は output を `apps/v1/dist` にする（項目が見えない場合は Root directory 方式を推奨）。

5. **Environment variables**  
   通常は不要（Phase 1 にビルド時シークレットはない）。

6. **Save and Deploy**

### Bun が使えない場合

Cloudflare のビルドログで `bun: not found` となる場合、Build command を次に変更:

```bash
curl -fsSL https://bun.sh/install | bash && export PATH="$HOME/.bun/bin:$PATH" && bun install && bun run build
```

---

## 3. 初回デプロイ後の確認

Dashboard → Pages → **qarows** → 最新 Deployment、または本番 URL **https://qarows.fuyuz.dev** で次を確認:

- [ ] `/load` が表示される
- [ ] 「サンプルを試す」→ セッション開始 → `/run` まで進める
- [ ] 直接 `/p/qarows/dashboard` にアクセスしても 404 にならない
- [ ] リロード後も IndexedDB から状態が復元される
- [ ] ナビから results.json / tests.yml をエクスポートできる

リグレッション用チェックリストは `apps/v1/public/samples/tests.yml` のシナリオを参照。

---

## 4. 継続運用

| イベント | 動作 |
|---|---|
| `main` へ push / merge | 本番デプロイ（自動） |
| PR 作成 | プレビューデプロイ（自動。Dashboard 設定で有効） |
| CI（`.github/workflows/ci.yml`） | テストのみ。デプロイは Cloudflare が担当 |

本番 URL: **https://qarows.fuyuz.dev**（カスタムドメイン）。`*.pages.dev` からも引き続きアクセス可能な場合あり。

---

## 5. カスタムドメイン

本番: **https://qarows.fuyuz.dev**（`fuyuz.dev` ゾーン上の Pages カスタムドメイン）。

変更・追加する場合:

1. Dashboard → Pages → **qarows** → **Custom domains**
2. ドメインを追加・編集し、DNS 指示に従う

---

## トラブルシューティング

| 症状 | 対処 |
|---|---|
| ビルド失敗 | ローカルで `bun run build` が通るか確認。output path が `apps/v1/dist` か確認 |
| 深い URL で 404 | `dist/_redirects` に `/* /index.html 200` があるか確認 |
| Bun 未検出 | 上記 Build command のフォールバックを使う |
| 古い JS が読まれる | ハードリロード。Dashboard で最新 Deployment が Success か確認 |

---

## 参考: Wrangler 手動デプロイ

Dashboard 障害時や一度だけ上げたい場合:

```bash
bunx wrangler login
bun run build
bunx wrangler pages deploy apps/v1/dist --project-name=qarows --branch=main
```

---

## セキュリティ

- API トークン・Account ID は **リポジトリにコミットしない**
- 本番 URL（https://qarows.fuyuz.dev）は公開デモ用のため README / 本 doc に記載してよい
- Phase 1 は静的 SPA のため、ビルド時に秘密情報を埋め込む必要はない
- Git 連携の OAuth 権限は Cloudflare Dashboard 上で管理する

---

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-06-28 | 初版 |
| 2026-06-28 | 本番 URL（qarows.fuyuz.dev）を追記 |
