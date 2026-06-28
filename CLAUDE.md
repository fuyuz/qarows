# CLAUDE.md

AI コーディングアシスタント向けのプロジェクト概要。このファイルと `docs/` を最初に読むこと。

## プロジェクト

**qarows** — QA シート（テストケース × 端末/環境）特化の Web アプリ。

- **利用者**: QA 担当（テスト作成・実行）、開発者（バグ対応・修正確認）
- **目的**: スプレッドシート運用の課題（スクロール、入力の煩雑さ、絞り込み、無関係な端末の表示）を解消
- **UI 言語**: 日本語メイン（将来 i18n で英語対応）
- **詳細**: [docs/requirements.md](docs/requirements.md)

## 現状

- 要件・データ形式・デプロイ方針は `docs/` に整理済み
- `apps/v1`, `packages/shared` scaffold 済み（Step 1 ビルド通過）
- 実装は **Local 版優先**

## エディション

Local 版と Team 版は **別アプリ**。独立デプロイ・独立利用を維持する。

| | Local 版 (`apps/v1`) | Team 版 (`apps/v2`) |
|---|---|---|
| 提供 | 公式 URL で誰でも利用 | **各自 closed 環境**にセルフデプロイ（Access で限定） |
| サーバー | 不要（静的 SPA） | Workers + DO + D1 等 |
| データ | IndexedDB + ファイル | 各デプロイ内で永続化（環境間非共有） |
| 協調 | `results.json` マージ | 同一デプロイ内 WebSocket リアルタイム（LWW） |

## 技術スタック

- **Frontend**: React + Vite
- **Hosting**: Cloudflare Pages
- **Local 版保存**: IndexedDB（自動保存）、ファイル import/export
- **Team 版**: Pages Functions, Durable Objects, D1, Cloudflare Access（社内メール認証）

Cloudflare 関連は公式ドキュメントを優先すること。

## リポジトリ構成（予定）

```
qarows/
├── apps/v1/           # Local 版: 静的 SPA
├── apps/v2/           # Team 版: Workers + DO
├── packages/shared/   # 共通型・スキーマ・i18n
└── docs/              # 人間向け詳細ドキュメント
```

## データモデル（要点）

| ファイル | 形式 | 内容 |
|---|---|---|
| `tests.yml` | YAML | テストケース、端末/環境リスト、プロジェクト設定 |
| `results.json` | JSON | 実行結果（status, 実施日, 実施者, メモ）、バグ |

- **ステータス**: `OK`, `NG`, `SKIP`
- **優先度（マージ時）**: `OK < SKIP < NG`
- **詳細**: [docs/data-format.md](docs/data-format.md)

## Local 版 UX（最重要）

マトリクス表は補助。**1 テストずつ集中入力**が主操作。

1. 作業開始時に端末/環境を手動選択
2. 大分類・未実施のみ等でフィルタ
3. 結果入力 → **自動で次へ**
4. 前のテストに戻って **上書き編集** 可能
5. 選択した端末/環境すべてに **一括 OK / NG**

## マージ（Local 版）

- 対象: `results.json` のみ
- ステータス競合: 強い方が勝つ
- メモ競合: 両方残す（改行連結、`---` 区切り可）

## Team 版（参考）

- **各自専用 closed 環境**（公式共通インスタンスなし）。Cloudflare Access + Worker enforce。
- 同一デプロイ内で全データをリアルタイム同期
- 同時編集: **Last Write Wins**（Local 版マージルールとは別）
- プロジェクト作成: Web UI + `tests.yml` アップロード

## セキュリティ・Git 方針

**公開リポジトリ前提。** 以下をコミットしない:

- API トークン、Access シークレット（`.env`, `.dev.vars`）
- Account ID、Zone ID、許可メールドメイン等の固有設定（`wrangler.toml`）
- 本番 URL、CI 用トークン

テンプレート（`.env.example`, `wrangler.toml.example`）と手順書のみコミット。

詳細: [docs/deployment.md](docs/deployment.md)

## コーディング方針

- **スコープ最小**: 依頼範囲外の変更をしない
- **既存慣習に合わせる**: 新規コードも周辺と同じスタイル
- **過剰設計しない**: 必要になるまで抽象化しない
- **コメント**: 自明でないビジネスロジックのみ
- **テスト**: 依頼がない限り追加しない（意味のあるカバレッジのみ）
- **コミット**: ユーザーが明示的に依頼したときのみ

## 開発サーバー

作業時は **都度** dev サーバーを起動する（常時起動はしない）。

| コマンド | URL | 用途 |
|---|---|---|
| `bun run preview:start` | http://localhost:5173 | Local 版本番ビルド確認 |
| `bun run dev` | http://localhost:5174 | Local 版開発（HMR） |
| `bun run dev:v2` | http://localhost:5177 | Team 版開発（Vite + Worker `:8787`） |

5173 は **preview 専用**。Local 版開発中は 5174、Team 版は 5177 を使う。

```bash
# dev ポートを止める（Local + Team 版）
bun run dev:stop

# Team 版初回: cp apps/v2/wrangler.toml.example apps/v2/wrangler.toml
bun run dev:v2

# preview をビルドして 5173 で起動
bun run preview:start
```

Team 版デプロイ手順: [docs/deploy-v2.md](docs/deploy-v2.md)

## ドキュメント

| ファイル | 内容 |
|---|---|
| [docs/requirements.md](docs/requirements.md) | 要件定義 |
| [docs/ui-ux.md](docs/ui-ux.md) | UI / UX デザイン方針 |
| [docs/data-format.md](docs/data-format.md) | データファイル形式（草案） |
| [docs/deployment.md](docs/deployment.md) | デプロイ・セキュリティ |

実装でスキーマや API が確定したら、該当 doc を更新すること。

## サンプル tests.yml（リポジトリの QA リスト）

`apps/v1/public/samples/tests.yml` は **デモ用サンプル** かつ **このリポジトリ自身の手動 QA チェックリスト** として扱う。機能追加のたびに都度テストケースを増やしていく。

| 用途 | 説明 |
|---|---|
| アプリ内「サンプルを試す」 | 新規ユーザーが qarows の操作を体験する |
| リポジトリの QA | Local 版機能のリグレッション確認項目を蓄積する |
| 形式の参照実装 | `tests.yml` スキーマの living example |

### 更新ルール

- **機能を実装したら**、該当するテストケースを `tests.yml` に追加する（PR / コミットに含めてよい）
- `project.name` は **qarows**、`project.id` は **qarows** を使う
- 大分類は機能単位（例: `ファイル読み込み`, `セッション`, `テスト実行`, `バグ管理`, `エクスポート`）
- 端末/環境は qarows の確認対象に合わせて追加・整理する
- `results.json` はサンプルに含めない（実行結果は各自ローカル / export）

### AI 向け注意

- 新画面・新機能の Step 完了時に、対応する TC を忘れず追加すること
- 既存 TC の `id` は変更しない（結果の参照が壊れる）
- 削除より **非推奨・SKIP 用メモ** を優先（履歴を残す）
