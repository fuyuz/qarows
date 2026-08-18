import { createContext, useContext, type ReactNode } from "react";
import type {
  Bug,
  BugAttachment,
  ResultsFile,
  SessionConfig,
  TestCase,
  TestDefinition,
  TestResultEntry,
  TestStatus,
} from "@qarows/shared";

/** Team 版のみ提供。未設定（Local 版 / R2 なしデプロイ）では添付 UI を出さない */
export interface BugAttachmentsAdapter {
  upload: (file: File) => Promise<BugAttachment>;
  remove: (key: string) => Promise<void>;
  url: (key: string) => string;
}

export interface RunnerWorkspaceValue {
  definition: TestDefinition | null;
  results: ResultsFile | null;
  session: SessionConfig | null;
  lastUpdatedTestId: string | null;
  updateResults: (
    testCaseId: string,
    envId: string,
    entry: TestResultEntry,
  ) => Promise<void>;
  updateResultsBatch: (
    testCaseId: string,
    envIds: string[],
    partial: Pick<TestResultEntry, "status"> & { status: TestStatus },
  ) => Promise<void>;
  updateTestMemo: (testCaseId: string, memo: string) => Promise<void>;
  addBug: (bug: Bug) => Promise<void>;
  updateBug: (bug: Bug) => Promise<void>;
  updateTestCase: (
    testCaseId: string,
    patch: Partial<Pick<TestCase, "category" | "prerequisites" | "description" | "version">>,
  ) => Promise<void>;
  clearTestResult: (testCaseId: string, envId: string) => Promise<void>;
  attachments?: BugAttachmentsAdapter;
}

const RunnerWorkspaceContext = createContext<RunnerWorkspaceValue | null>(null);

export function RunnerWorkspaceProvider({
  value,
  children,
}: {
  value: RunnerWorkspaceValue;
  children: ReactNode;
}) {
  return (
    <RunnerWorkspaceContext.Provider value={value}>{children}</RunnerWorkspaceContext.Provider>
  );
}

export function useRunnerWorkspace(): RunnerWorkspaceValue {
  const context = useContext(RunnerWorkspaceContext);
  if (!context) {
    throw new Error("useRunnerWorkspace must be used within RunnerWorkspaceProvider");
  }
  return context;
}
