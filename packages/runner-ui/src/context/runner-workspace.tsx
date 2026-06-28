import { createContext, useContext, type ReactNode } from "react";
import type {
  ResultsFile,
  SessionConfig,
  TestCase,
  TestDefinition,
  TestResultEntry,
  TestStatus,
} from "@qarows/shared";

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
    partial: Pick<TestResultEntry, "status" | "memo"> & { status: TestStatus },
  ) => Promise<void>;
  updateResultsFile: (updater: (prev: ResultsFile) => ResultsFile) => Promise<void>;
  updateTestCase: (
    testCaseId: string,
    patch: Partial<Pick<TestCase, "category" | "prerequisites" | "description" | "version">>,
  ) => Promise<void>;
  clearTestResult: (testCaseId: string, envId: string) => Promise<void>;
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
