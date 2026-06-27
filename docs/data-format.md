# データファイル形式

Phase 1 および Phase 2（インポート/エクスポート）で用いるデータファイルの概要。

> **Note:** 正式スキーマ（JSON Schema）は未作成。実装前に確定する。

---

## ファイル構成

```
project/
├── tests.yml       # テスト定義（人が読み書き）
└── results.json    # 実行結果 + バグ（アプリが生成・更新）
```

| ファイル | 形式 | 更新頻度 | マージ対象 |
|---|---|---|---|
| `tests.yml` | YAML | 低（定義変更時） | Phase 1: 対象外 |
| `results.json` | JSON | 高（テスト実行中） | Phase 1: 対象 |

---

## tests.yml

### プロジェクト設定

```yaml
# 例（草案）
project:
  name: "My App QA"
  version: 1

# 端末/環境（プロジェクト固定リスト）
environments:
  - id: chrome-desktop
    name: "Chrome (Desktop)"
  - id: ios-safari
    name: "iOS Safari"
  - id: prod
    name: "本番環境"
```

### テストケース

```yaml
testCases:
  - id: TC-001
    category:
      major: "認証"
      minor: "ログイン"
    prerequisites: "未ログイン状態であること"
    description: "正しいメールアドレスとパスワードでログインできる"

  - id: TC-002
    category:
      major: "認証"
      minor: "ログイン"
    prerequisites: "未ログイン状態であること"
    description: "誤ったパスワードでログインできない"
```

### フィールド定義

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | string | ✓ | 一意識別子 |
| `category.major` | string | ✓ | 大分類 |
| `category.minor` | string | | 小分類 |
| `prerequisites` | string | | テスト前提条件 |
| `description` | string | ✓ | 確認内容 |

---

## results.json

### 構造（草案）

```json
{
  "version": 1,
  "projectId": "my-app-qa",
  "updatedAt": "2026-06-27T12:00:00Z",
  "results": {
    "TC-001": {
      "chrome-desktop": {
        "status": "OK",
        "executedAt": "2026-06-27T10:00:00Z",
        "executedBy": "tanaka@example.com",
        "memo": "問題なし"
      },
      "ios-safari": {
        "status": "NG",
        "executedAt": "2026-06-27T11:00:00Z",
        "executedBy": "suzuki@example.com",
        "memo": "レイアウト崩れあり"
      }
    }
  },
  "bugs": [
    {
      "id": "BUG-001",
      "testCaseId": "TC-001",
      "title": "iOS Safari でレイアウト崩れ",
      "severity": "high",
      "assignee": "dev@example.com",
      "status": "open",
      "steps": "1. iOS Safari でログイン画面を開く\n2. ...",
      "expected": "フォームが画面幅に収まる",
      "actual": "右端がはみ出す"
    }
  ]
}
```

### ステータス

| 値 | 説明 | 優先度 |
|---|---|---|
| `OK` | 合格 | 1（最弱） |
| `SKIP` | スキップ | 2 |
| `OK_NG` | 以前 OK だったが NG に変化 | 3 |
| `NG` | 不合格 | 4（最強） |

マージ時は優先度の高いステータスが採用される。

### バグステータス（例）

| 値 | 説明 |
|---|---|
| `open` | 未対応 |
| `in_progress` | 対応中 |
| `fixed` | 修正済み |

---

## マージルール（Phase 1）

`results.json` を複数ファイルからマージする際のルール。

### ステータス

同一 `testCaseId` × `environmentId` に複数の結果がある場合、優先度の高いステータスを採用する。

```
OK < SKIP < OK_NG < NG
```

### メモ

両方のメモを保持する。表示時は改行で連結する。区切り線（`---`）を挟んでもよい。

```
問題なし
---
iOS Safari でレイアウト崩れあり（suzuki）
```

### バグ

詳細ルールは未確定。実装時に ID ベースのマージ方針を定義する。

---

## IndexedDB（Phase 1 ローカル保存）

ブラウザ内の IndexedDB に、現在の `tests.yml` パース結果と `results.json` 相当のデータを保存する。

- ファイルアップロード時に読み込み
- 結果入力のたびに自動保存
- エクスポート時に JSON / YAML として書き出し

スキーマは `results.json` と整合させる。
