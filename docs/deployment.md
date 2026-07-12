# デプロイ方針

## 概要

Local 版と Team 版は **別アプリとして独立デプロイ・独立利用** できる。

構成図・データフロー: [architecture.md](./architecture.md)

| | Local 版 | Team 版 |
|---|---|---|
| **誰がデプロイ** | メンテナ（公式インスタンス） | 利用者各自（組織・個人） |
| **誰が使う** | 誰でも（公開 URL） | **そのデプロイの Access ポリシー内のメンバーのみ** |
| **環境** | 公開 | **closed**（各自専用・データ非共有） |
| **ホスティング** | Cloudflare Pages（静的） | Worker（assets）+ DO + D1 + Access |

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

### 手順書

Pages 連携・ビルド設定・カスタムドメインは **別ドキュメント** にまとめる。

→ **[deploy-v1.md](./deploy-v1.md)**（メンテナ向け・正本）

### 利用者

URL にアクセスするだけ。アカウント不要。

---

## Team 版: セルフデプロイ（各自 closed 環境）

Team 版に **公式の共通ホストはない**。fork / clone した利用者が、自分の Cloudflare アカウントに Worker + D1 + DO をデプロイし、Cloudflare Access で組織内に閉じる。A 社のデプロイと B 社のデプロイは完全に独立（マルチテナント SaaS ではない）。

### 構成

| コンポーネント | 用途 |
|---|---|
| Worker（`[assets]`） | フロントエンド配信 + Hono API + WebSocket |
| Durable Objects | プロジェクト単位のリアルタイム同期 |
| D1 | プロジェクト snapshot の永続化 |
| Cloudflare Access | 組織内メール認証（Worker 側でも JWT 検証） |

### 手順書

ローカル開発・D1・本番デプロイ・Access（AUD / ポリシー）・トラブルシューティングは **別ドキュメント** にまとめる。

→ **[deploy-v2.md](./deploy-v2.md)**（利用者向け・正本）

概要だけ:

1. `wrangler.toml.example` をコピーし `account_id` / D1 を設定
2. Access Application を作成し `ACCESS_AUD` / `ACCESS_TEAM_DOMAIN` を Worker に設定
3. `bun run deploy:v2` でデプロイ
4. Dashboard で Access ポリシー（許可メール / ドメイン）を設定

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
| 2026-07-12 | Team 版手順を deploy-v2.md へ集約。構成表記を現行（Worker assets）に更新 |
