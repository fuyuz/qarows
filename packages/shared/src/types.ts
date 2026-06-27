export type TestStatus = "OK" | "SKIP" | "OK_NG" | "NG";

export type BugStatus = "open" | "in_progress" | "fixed";

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
  executedAt?: string;
  executedBy?: string;
  memo?: string;
}

/** testCaseId -> environmentId -> result */
export type TestResults = Record<string, Record<string, TestResultEntry>>;

export interface Bug {
  id: string;
  testCaseId: string;
  title: string;
  severity: BugSeverity;
  assignee?: string;
  status: BugStatus;
  steps?: string;
  expected?: string;
  actual?: string;
}

export interface ResultsFile {
  version: number;
  projectId: string;
  updatedAt: string;
  results: TestResults;
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
