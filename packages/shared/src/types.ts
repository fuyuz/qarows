export type TestStatus = "OK" | "SKIP" | "OK_NG" | "NG";

export type BugStatus = "open" | "in_progress" | "fixed";

export type BugSeverity = "low" | "medium" | "high" | "critical";

export interface Environment {
  id: string;
  name: string;
}

export interface TestCase {
  id: string;
  category: {
    major: string;
    minor?: string;
  };
  prerequisites?: string;
  description: string;
}

export interface TestDefinition {
  project: {
    name: string;
    id?: string;
    version?: number;
  };
  environments: Environment[];
  testCases: TestCase[];
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
  majorCategoryFilter?: string;
  onlyIncomplete: boolean;
  executorName: string;
}
