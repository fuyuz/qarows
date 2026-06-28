# デプロイ方針

## 概要

Local 版と Team 版は **別アプリとして独立デプロイ・独立利用** できる。

構成図・データフロー: [architecture.md](./architecture.md)

| | Local 版 | Team 版 |
|---|---|---|
| **誰がデプロイ** | メンテナ（公式インスタンス） | 利用者各自（組織・個人） |
| **誰が使う** | 誰でも（公開 URL） | **そのデプロイの Access ポリシー内のメンバーのみ** |
| **環境** | 公開 | **closed**（各自専用・データ非共有） |
| **ホスティング** | Cloudflare Pages（静的） | Cloudflare Pages + Workers + DO 等 |

---

## リポジトリ構成（予定）

```
qarows/
├── apps/
│   ├── v1/              # Local 版: 静的 SPA
│   └── v2/              # Team 版: Workers + DO + Access
├── packages/
│   └── shared/          # 共通型定義・スキーマ・i18n
├── docs/                # ドキュメント（本ディレクトリ）
├── .gitignore
└── README.md
```

---

## Git に含めないもの

本リポジトリは **公開** を前提とする。以下はコミットしない。

| 種類 | 例 | 管理方法 |
|---|---|---|
| 認証情報 | API トークン、Access シークレット | `.env` / `.dev.vars`（gitignore） |
| アカウント固有情報 | Account ID、Zone ID | デプロイ時に各自設定 |
| 社内限定設定 | 許可メールドメイン、Access ポリシー ID | サンプルファイル + 手順書 |
| デプロイ先 URL | 公式 Local 版本番 URL | CI Secrets または README 外管理 |

### リポジトリに含めるもの

| ファイル | 用途 |
|---|---|
| `.env.example` | 環境変数のキー名一覧 |
| `wrangler.toml.example` | Wrangler 設定テンプレート（プレースホルダー） |
| `docs/deploy-v1.md` | Local 版公式デプロイ手順（メンテナ向け） |
| `docs/deploy-v2.md` | Team 版セルフデプロイ手順（利用者向け） |

---

## Local 版: 公式公開インスタンス

### 構成

- **React + Vite** をビルドした静的ファイルのみ
- Cloudflare Pages にデプロイ
- サーバー API 不要（IndexedDB + ファイル I/O のみ）

### デプロイフロー（メンテナ向け）

1. `apps/v1` をビルド
2. Cloudflare Pages にデプロイ
3. 固定 URL を公開

ビルド・デプロイ用トークンは **GitHub Actions Secrets** 等で管理し、リポジトリには含めない。

### 利用者

URL にアクセスするだけ。アカウント不要。

---

## Team 版: セルフデプロイ（各自 closed 環境）

Team 版に **公式の共通ホストはない**。fork / clone した利用者が、自分の Cloudflare アカウントに Worker + D1 + DO をデプロイし、Cloudflare Access で組織内に閉じる。A 社のデプロイと B 社のデプロイは完全に独立（マルチテナント SaaS ではない）。

### 構成

| コンポーネント | 用途 |
|---|---|
| Cloudflare Pages | フロントエンド |
| Pages Functions / Workers | API |
| Durable Objects | WebSocket 接続・状態管理 |
| D1 等 | 永続ストレージ |
| Cloudflare Access | 社内メール認証 |

### デプロイフロー（利用者向け）

1. リポジトリを fork または clone
2. 設定ファイルをコピーして編集:
   ```bash
   cp apps/v2/wrangler.toml.example apps/v2/wrangler.toml
   cp apps/v2/.dev.vars.example apps/v2/.dev.vars
   ```
3. `wrangler.toml` に Account ID 等を記入
4. `.dev.vars` に Access 関連シークレットを設定
5. デプロイ:
   ```bash
   cd apps/v2
   npx wrangler deploy
   ```
6. Cloudflare ダッシュボードで Access ポリシーを設定（許可メールドメイン等）

### 認証

- **Cloudflare Access** によるメールアドレス認証
- 一つの会社内での利用を想定
- 許可ドメイン・ポリシーは各自の Cloudflare ダッシュボードで設定（リポジトリには含めない）

---

## Local / Team 版の共存

- 両方とも独立したアプリとして開発・デプロイ・利用可能
- Team 版リリース後も Local 版は公式 URL で公開を継続
- Local 版のオフラインモード（ファイル + IndexedDB + マージ）を Team 版に統合するかは **状況次第**

---

## .gitignore 方針

以下を gitignore 対象とする（実装時に `.gitignore` へ追記）。

```
# Environment / secrets
.env
.env.*
!.env.example
.dev.vars

# Cloudflare local config (個人・組織固有)
wrangler.toml
# wrangler.toml.example はコミットする

# Wrangler local state
.wrangler/
```

`wrangler.toml` を gitignore する場合、テンプレートは `wrangler.toml.example` としてコミットする。

---

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-06-27 | 初版 |
