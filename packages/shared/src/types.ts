export type TestStatus = "OK" | "SKIP" | "NG";

export type BugStatus =
  | "open"
  | "in_progress"
  | "fixed"
  | "resolved"
  | "wont_fix";

export type BugSeverity = "low" | "medium" | "high" | "critical";

export type TargetRequirement = "all" | "any";

export interface Environment {
  id: string;
  name: string;
}

export interface TargetEnvironmentSpec {
  required: TargetRequirement;
  targets?: string[];
}

export interface CategoryMatch {
  major: string;
  medium?: string;
  minor?: string;
}

export interface CategoryTarget {
  match: CategoryMatch;
  required?: TargetRequirement;
  targets?: string[];
}

export interface TestCase {
  id: string;
  /** テスト定義の版。省略時 1。内容変更でインクリメントし、旧版の結果は未実施扱い */
  version?: number;
  category: {
    major: string;
    medium?: string;
    minor?: string;
  };
  prerequisites?: string;
  description: string;
  targetEnvironments?: TargetEnvironmentSpec;
}

export interface TestDefinition {
  project: {
    name: string;
    id?: string;
    version?: number;
  };
  environments: Environment[];
  categoryTargets?: CategoryTarget[];
  scenarios?: TestScenario[];
  testCases: TestCase[];
}

export interface TestScenario {
  id: string;
  name: string;
  description?: string;
  steps: string[];
}

export interface TestResultEntry {
  status: TestStatus;
  /** 記録時のテストケース version。省略時 1 */
  version?: number;
  executedAt?: string;
  executedBy?: string;
}

/** testCaseId -> environmentId -> result */
export type TestResults = Record<string, Record<string, TestResultEntry>>;

/** testCaseId -> テストケース単位メモ */
export type TestMemos = Record<string, string>;

/** Team 版のみ実体（R2）を持つ。Local 版はメタデータを保持したまま無視する */
export interface BugAttachment {
  /** サーバー生成 UUID。配信 URL とストレージキーの識別子 */
  key: string;
  /** 元のファイル名（表示用） */
  name: string;
  size: number;
  mimeType: string;
  uploadedAt?: string;
  uploadedBy?: string;
}

export interface Bug {
  id: string;
  testCaseId?: string;
  environmentIds?: string[];
  title: string;
  severity: BugSeverity;
  assignee?: string;
  status: BugStatus;
  steps?: string;
  expected?: string;
  actual?: string;
  /** 修正済みにした際の修正内容 */
  fixNote?: string;
  /** 自由記入メモ */
  memo?: string;
  /** 添付（画像・動画）。最大 MAX_BUG_ATTACHMENTS 件 */
  attachments?: BugAttachment[];
}

export interface ResultsFile {
  version: number;
  projectId: string;
  updatedAt: string;
  results: TestResults;
  /** テストケース単位メモ（環境非依存） */
  memos: TestMemos;
  bugs: Bug[];
}

export interface SessionConfig {
  selectedEnvironmentIds: string[];
  executorName: string;
}

/** テスト実行中に切り替えるフィルタ（セッション設定とは別） */
export type RunnerTargetMode = "filter" | "scenario";

export interface RunnerFilters {
  targetMode?: RunnerTargetMode;
  majorCategoryFilter?: string;
  mediumCategoryFilter?: string;
  minorCategoryFilter?: string;
  scenarioId?: string;
  onlyIncomplete: boolean;
  onlyWithBugs: boolean;
  onlyWithNg: boolean;
}

export interface ResolvedTestTargets {
  /** プロジェクト内で解決された対象端末（セッション交差前） */
  environmentIds: string[];
  required: TargetRequirement;
}

export interface SessionTestTargets extends ResolvedTestTargets {
  /** セッション選択との交差後。空ならそのセッションでは対象外 */
  inScope: boolean;
}
