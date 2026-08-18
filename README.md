# qarows

QA シート（テストケース × 端末/環境）に特化した Web アプリ。

## 概要

スプレッドシートの QA マトリクス運用を、ブラウザ上の専用 UI に置き換える。

**解決したいこと**

- 行・列が多くてスクロールが大変
- ステータス入力が面倒
- フィルタ・絞り込みがしづらい
- 自分と関係ない端末/環境まで見えて作業しにくい

**誰向けか**

| 役割 | 主な操作 |
|---|---|
| QA 担当 | テストケースの作成・実行、結果入力 |
| 開発者 | バグ対応、修正確認 |

**使い方の中心**

マトリクス表は補助。主操作は **1 テストずつ集中入力** する。

1. 作業開始時に端末/環境を選ぶ
2. 大分類・未実施のみなどでフィルタ
3. 結果（OK / NG / SKIP）を入力 → 自動で次へ
4. 必要なら戻って上書き編集
5. 選択中の端末/環境へ一括 OK / NG も可能

**データの持ち方**

| ファイル | 形式 | 内容 |
|---|---|---|
| `tests.yml` | YAML | テストケース、端末/環境、プロジェクト設定 |
| `results.json` | JSON | 実行結果（status・実施日・実施者・メモ）、バグ |

UI 言語は日本語メイン（将来 i18n で英語対応を予定）。詳細要件は [docs/requirements.md](docs/requirements.md)。

## やれること

### 共通（Local / Team）

- `tests.yml` からテストケースと端末/環境を読み込み
- 1 件ずつ集中入力するテストランナー（OK / NG / SKIP、キーボード操作）
- 端末/環境の選択、大・中・小分類フィルタ、シナリオモード、未実施のみ
- メモ入力、選択中環境への一括 OK / NG
- バグの起票・編集・閲覧（テストとの関連付け）
- ダッシュボード・マトリクスでの進捗確認
- アプリ内でのテスト定義編集（draft → Diff → Apply）
- `tests.yml` / `results.json` のエクスポート

### Local 版のみ

- 複数プロジェクトを IndexedDB に保存して切り替え（サーバー不要）
- 作業内容の自動保存（ページを閉じても復元）
- 複数人分の `results.json` をマージ（ステータスは強い方が勝ち、メモは両方残す）
- 公式デモ（https://qarows.fuyuz.dev）ですぐ試せる

### Team 版のみ

- 同一デプロイ内での結果・定義・バグのリアルタイム同期
- Web UI でのプロジェクト作成、または `tests.yml` アップロード
- Cloudflare Access によるメンバー限定（closed 環境）
- （任意）Workers AI による `tests.yml` の対話編集

## デモ（Local 版）

**https://qarows.fuyuz.dev**

## 名称

**qarows** は **QA**（Quality Assurance）と **rows**（行）を組み合わせた名前。テストケースと端末/環境のマトリクス表をイメージしている。

| | |
|---|---|
| 読み（日本語） | **カローズ** |
| 発音記号（IPA） | /ˈkæroʊz/ |

*qa* を「カ」、*rows* を「ローズ」（末尾は *z* 音）と続けて読む。

## エディション

Local 版と Team 版は **別アプリ**。独立デプロイ・独立利用できる。

| | Local 版 (`apps/local`) | Team 版 (`apps/team`) |
|---|---|---|
| 提供 | 公式 URL で誰でも利用 | **各自 closed 環境**にセルフデプロイ |
| サーバー | 不要（静的 SPA） | Workers + Durable Objects + D1 |
| データ | IndexedDB + ファイル | デプロイ内で永続化（環境間非共有） |
| 協調 | `results.json` マージ | 同一デプロイ内でリアルタイム同期（LWW） |
| 認証 | なし | Cloudflare Access |

## Local 版

ブラウザだけで完結する公式インスタンス。アカウント不要で、[デモ](https://qarows.fuyuz.dev) からすぐ使える。

- テスト定義は `tests.yml`、実行結果は `results.json`
- 作業内容は IndexedDB に自動保存。ファイルの import / export も可能
- メイン操作は **1 テストずつ集中入力**（マトリクス表は補助）
- 複数人のローカル結果は `results.json` のマージで統合

| | リンク |
|---|---|
| 開発 | `bun run dev` → http://localhost:5174 |
| 本番ビルド確認 | `bun run preview:start` → http://localhost:5173 |
| 公式デプロイ手順（メンテナ向け） | [docs/deploy-local.md](docs/deploy-local.md) |
| データ形式 | [docs/data-format.md](docs/data-format.md) |

## Team 版

組織（または個人）ごとに Cloudflare へデプロイする **closed** な QA 環境。公式の共通 Team 版インスタンスは提供しない。

- 同一デプロイ内でプロジェクト・結果・定義をリアルタイム同期
- Cloudflare Access でメンバーを限定（Worker 側でも JWT を検証）
- 同時編集は Last Write Wins（Local 版のマージルールとは別）

セットアップ・Access 設定・トラブルシューティングは次のドキュメントにまとめてある。

| | リンク |
|---|---|
| **セルフデプロイ手順** | **[docs/deploy-team.md](docs/deploy-team.md)** |
| ローカル開発 | `bun run dev:team` → http://localhost:5177 |
| デプロイ方針の概要 | [docs/deployment.md](docs/deployment.md) |
| アーキテクチャ | [docs/architecture.md](docs/architecture.md) |

## ドキュメント

詳細は [docs/](docs/) を参照。

| ドキュメント | 内容 |
|---|---|
| [docs/requirements.md](docs/requirements.md) | 要件定義 |
| [docs/ui-ux.md](docs/ui-ux.md) | UI / UX |
| [docs/data-format.md](docs/data-format.md) | `tests.yml` / `results.json` |
| [docs/deployment.md](docs/deployment.md) | デプロイ方針・セキュリティ |
| [docs/deploy-local.md](docs/deploy-local.md) | Local 版公式デプロイ |
| [docs/deploy-team.md](docs/deploy-team.md) | Team 版セルフデプロイ |

## ライセンス

[MIT License](LICENSE)
