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

### カテゴリ階層

```yaml
category:
  major: "認証"      # 大項目（必須）
  medium: "ログイン" # 中項目（任意）
  minor: "OAuth"     # 小項目（任意）
```

### 対象端末（TargetEnvironmentSpec）

ケース単位・カテゴリ単位で「どの端末/環境をテスト対象とするか」を指定する。
`required` と `targets` を分けて記述する。

```yaml
required: all   # all | any
targets:        # 省略可。environment id のリスト
  - chrome-desktop
  - ios-safari
```

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `required` | `"all"` \| `"any"` | | 完了条件。省略時は `all` |
| `targets` | string[] | | 対象とする environment id。省略時は「現在の有効プール全体」 |

#### `required` の意味

| 値 | 完了条件（未実施判定） |
|---|---|
| `all` | 有効プール内の**すべて**に status が入力されている |
| `any` | 有効プール内の**いずれか1つ**に status が入力されていれば完了。1件でも入力済みなら未実施に含めない |

#### `targets` の意味

- **省略** … その時点の有効プールをそのまま使う
- **指定あり** … 有効プールと `targets` の**積**（交差）を新しい有効プールとする

### カテゴリ別デフォルト（categoryTargets）

大項目 → 中項目 → 小項目の順に、上位で絞った範囲へ下位の指定をネスト適用する。
下位は上位の範囲を**広げられない**。

```yaml
categoryTargets:
  - match:
      major: "認証"
    required: all

  - match:
      major: "認証"
      medium: "ログイン"
    required: any
    targets:
      - chrome-desktop
      - ios-safari
      - firefox-desktop

  - match:
      major: "認証"
      medium: "ログイン"
      minor: "OAuth"
    required: all
    targets:
      - chrome-desktop
```

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `match.major` | string | ✓ | 大項目 |
| `match.medium` | string | | 中項目 |
| `match.minor` | string | | 小項目 |
| `required` | `"all"` \| `"any"` | | 省略時 `all` |
| `targets` | string[] | | 省略時は有効プール全体 |

### テストケース

```yaml
testCases:
  - id: TC-001
    category:
      major: "認証"
      medium: "ログイン"
      minor: "パスワード"
    prerequisites: "未ログイン状態であること"
    description: "正しいメールアドレスとパスワードでログインできる"
    # ケース単位の上書き（任意）
    targetEnvironments:
      required: any
      targets:
        - chrome-desktop
        - ios-safari

  - id: TC-002
    category:
      major: "認証"
      medium: "ログイン"
      minor: "パスワード"
    description: "誤ったパスワードでログインできない"
    # 省略時は categoryTargets を大→中→小の順で適用。いずれも無ければ all
```

### 対象端末の解決（ネスト適用）

1. 有効プール ← プロジェクトの全 `environments`
2. `required` ← `all`（デフォルト）
3. 次の順で、該当する `categoryTargets` とケースの `targetEnvironments` を適用:
   - 大項目（`match.major` のみ）
   - 中項目（`match.major` + `match.medium`）
   - 小項目（`match.major` + `match.medium` + `match.minor`）
   - ケース（`targetEnvironments`）
4. 各ステップで:
   - `targets` 指定があれば `有効プール = 有効プール ∩ targets`
   - `required` が指定されていれば上書き

**例**

| ステップ | 指定 | 有効プール | required |
|---|---|---|---|
| 初期 | — | {a,b,c,d} | all |
| 大項目 | `any` + targets [a,b,c,d] | {a,b,c,d} | any |
| 中項目 | `any` + targets [b,c] | {b,c} | any |
| ケース | 省略 | {b,c} | any |

### セッションとの交差

テスト実行時は、解決済み有効プールとセッションで選んだ端末/環境の**積**を実行対象とする。

- 実行対象が空 … そのセッションでは対象外（ランナーに出さない）
- 未実施フィルタ … 上記「完了条件」に従い判定

### フィールド定義（テストケース）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | string | ✓ | 一意識別子 |
| `version` | number | | テスト定義の版。省略時 `1`。内容変更でインクリメントし、旧版の結果は未実施扱い |
| `category.major` | string | ✓ | 大項目 |
| `category.medium` | string | | 中項目 |
| `category.minor` | string | | 小項目 |
| `prerequisites` | string | | テスト前提条件 |
| `description` | string | ✓ | 確認内容 |
| `targetEnvironments.required` | `"all"` \| `"any"` | | ケース単位の完了条件 |
| `targetEnvironments.targets` | string[] | | ケース単位の対象端末 |

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
        "status": "OK",
        "version": 2,
        "executedAt": "2026-06-27T11:30:00Z",
        "executedBy": "suzuki@example.com",
        "memo": "v2 で再確認済み"
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

各結果エントリは、記録時の `tests.yml` テストケース `version` を `version` フィールドで保持する（省略時 `1`）。テストケースの `version` と一致しない結果は未実施扱い（再テスト対象）。旧版の結果はファイル内に残してよい。

### バグステータス

| 値 | 説明 |
|---|---|
| `open` | 未対応 |
| `in_progress` | 修正中 |
| `fixed` | 修正済み |
| `resolved` | 修正確認済み |
| `wont_fix` | 対応しない |

旧形式の `pending_verification` は読み込み時に `fixed` へ正規化される。

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
