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
- `apps/v1`, `apps/v2`, `packages/shared` は **未作成**（これから scaffold）
- 実装は **Phase 1 優先**

## フェーズ

Phase 1 と Phase 2 は **別アプリ**。独立デプロイ・独立利用を維持する。

| | Phase 1 (`apps/v1`) | Phase 2 (`apps/v2`) |
|---|---|---|
| 提供 | 公式 URL で誰でも利用 | 各自 Cloudflare にセルフデプロイ |
| サーバー | 不要（静的 SPA） | Workers + DO + D1 等 |
| データ | IndexedDB + ファイル | サーバー永続化 + リアルタイム同期 |
| 協調 | `results.json` マージ | WebSocket リアルタイム（LWW） |

## 技術スタック

- **Frontend**: React + Vite
- **Hosting**: Cloudflare Pages
- **Phase 1 保存**: IndexedDB（自動保存）、ファイル import/export
- **Phase 2（予定）**: Pages Functions, Durable Objects, D1, Cloudflare Access（社内メール認証）

Cloudflare 関連は公式ドキュメントを優先すること。

## リポジトリ構成（予定）

```
qarows/
├── apps/v1/           # Phase 1: 静的 SPA
├── apps/v2/           # Phase 2: Workers + DO
├── packages/shared/   # 共通型・スキーマ・i18n
└── docs/              # 人間向け詳細ドキュメント
```

## データモデル（要点）

| ファイル | 形式 | 内容 |
|---|---|---|
| `tests.yml` | YAML | テストケース、端末/環境リスト、プロジェクト設定 |
| `results.json` | JSON | 実行結果（status, 実施日, 実施者, メモ）、バグ |

- **ステータス**: `OK`, `NG`, `SKIP`, `OK→NG`（コード上は `OK_NG` 等の snake_case も検討）
- **優先度（マージ時）**: `OK < SKIP < OK→NG < NG`
- **詳細**: [docs/data-format.md](docs/data-format.md)

## Phase 1 UX（最重要）

マトリクス表は補助。**1 テストずつ集中入力**が主操作。

1. 作業開始時に端末/環境を手動選択
2. 大分類・未実施のみ等でフィルタ
3. 結果入力 → **自動で次へ**
4. 前のテストに戻って **上書き編集** 可能
5. 選択した端末/環境すべてに **一括 OK / NG**

## マージ（Phase 1）

- 対象: `results.json` のみ
- ステータス競合: 強い方が勝つ
- メモ競合: 両方残す（改行連結、`---` 区切り可）

## Phase 2（参考）

- 全データをリアルタイム同期
- 同時編集: **Last Write Wins**（Phase 1 マージルールとは別）
- 認証: Cloudflare Access（メールアドレス、社内想定）
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

## ドキュメント

| ファイル | 内容 |
|---|---|
| [docs/requirements.md](docs/requirements.md) | 要件定義 |
| [docs/data-format.md](docs/data-format.md) | データファイル形式（草案） |
| [docs/deployment.md](docs/deployment.md) | デプロイ・セキュリティ |

実装でスキーマや API が確定したら、該当 doc を更新すること。
