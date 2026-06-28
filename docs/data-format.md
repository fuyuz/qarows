# データファイル形式

Local 版および Team 版（インポート/エクスポート）で用いるデータファイルの概要。

> **Note:** 正式スキーマは [packages/shared/schemas/](../packages/shared/schemas/) に JSON Schema（draft 2020-12）として配置。パース実装は `@qarows/shared` の `parseTestsYaml` / `parseResultsJson` が正とする。

---

## ファイル構成

```
project/
├── tests.yml       # テスト定義（人が読み書き）
└── results.json    # 実行結果 + バグ（アプリが生成・更新）
```

| ファイル | 形式 | 更新頻度 | マージ対象 |
|---|---|---|---|
| `tests.yml` | YAML | 低（定義変更時） | Local 版: 対象外 |
| `results.json` | JSON | 高（テスト実行中） | Local 版: 対象 |

### JSON Schema

| ファイル | スキーマ |
|---|---|
| `tests.yml`（JSON 等価） | [`tests.schema.json`](../packages/shared/schemas/tests.schema.json) |
| `results.json` | [`results.schema.json`](../packages/shared/schemas/results.schema.json) |

インポート時、`parseResultsJson` は `tests.yml` 読み込み済みなら `testCaseId` / `environmentId` / `projectId` を定義と照合する。

---

## tests.yml

### プロジェクト設定

```yaml
# 例（草案）
project:
  name: "My App QA"
  id: my-app-qa   # 必須（name が英数字のみでない場合）。省略時は name から自動生成
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

| 値 | 真の完了条件（有効プール全体） | ランナー未実施フィルタ・進捗 |
|---|---|---|
| `all` | 有効プール内の**すべて**に status が入力されている | **セッション内**の対象端末がすべて入力済みなら未実施に含めない |
| `any` | 有効プール内の**いずれか1つ**に status が入力されていれば完了 | 同上（セッション外の端末で他者が実施済みでも完了扱い） |

有効プールは `targets` の解決結果（プロジェクト内の対象 environment id 一覧）。  
ランナーではセッション選択端末との交差で「自分の担当範囲」を決め、`all` のみフィルタ判定をセッション内に限定する。

#### `targets` の意味

- **省略** … その時点の有効プールをそのまま使う
- **指定あり** … 有効プールと `targets` の**積**（交差）を新しい有効プールとする
- **空配列** … 不可（パースエラー）。対象端末なしにしたい場合は該当テストケースを定義から外す

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
      "id": "BUG-k7m2x9",
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

アプリで新規起票するバグの `id` は `BUG-{6文字の英小文字・数字}`（例: `BUG-k7m2x9`）を自動採番する。並行作業での衝突を避けるため連番ではなくランダム suffix を使う。手動 import や旧データの `BUG-001` 形式もそのまま読み込める。

### ステータス

| 値 | 説明 | 優先度 |
|---|---|---|
| `OK` | 合格 | 1（最弱） |
| `SKIP` | スキップ | 2 |
| `NG` | 不合格 | 3（最強） |

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

## マージルール（Local 版）

`results.json` を複数ファイルからマージする際のルール。

### ステータス

同一 `testCaseId` × `environmentId` に複数の結果がある場合:

1. **version が異なる** … **高い version** の結果を採用する（再テスト結果を優先）
2. **version が同じ** … 優先度の高いステータスを採用する。同順位なら `executedAt` が新しい方

```
OK < SKIP < NG
```

メモは version 優先の有無にかかわらず、両方残す（改行連結、`---` 区切り可）。

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

## IndexedDB（Local 版ローカル保存）

ブラウザ内の IndexedDB（DB 名 `qarows-v1`、version 2）に、**プロジェクトごと**に `tests.yml` パース結果と `results.json` 相当のデータを保存する。

| ストア | キー | 内容 |
|---|---|---|
| `projects` | `project.id` | 定義・結果・セッション・`updatedAt` |
| `meta` | `"app"` | 最後に開いた `projectId` |

- ファイルアップロード時に読み込み（同一 `project.id` は上書き）
- 結果入力のたびに自動保存（アクティブプロジェクトのみ）
- エクスポート時に JSON / YAML として書き出し
- v1（単一 `"state"` レコード）は初回起動時に v2 へ自動移行

### ID のスコープ

- **`project.id`** … IndexedDB のキー。アプリ内でプロジェクトを識別する
- **`testCaseId` / `bug.id`** … **プロジェクト内でのみ一意**。別プロジェクト間で同じ ID（例: `TC-001`）が重複しうる。ストレージは `projectId` で分離する
- URL の `?test=` / `?bug=` … プロジェクト切替時に、現プロジェクトに存在しない ID は除去する

スキーマは `results.json` と整合させる。
