import { useMemo, type ReactNode } from "react";
import {
  RunnerWorkspaceProvider,
  type RunnerWorkspaceValue,
} from "@qarows/runner-ui";
import { useProjectSync } from "@/context/ProjectSyncContext";

export function RunnerWorkspaceBridge({ children }: { children: ReactNode }) {
  const sync = useProjectSync();

  const value = useMemo<RunnerWorkspaceValue>(
    () => ({
      definition: sync.definition,
      results: sync.results,
      session: sync.session,
      lastUpdatedTestId: sync.lastUpdatedTestId,
      updateResults: sync.updateResults,
      updateResultsBatch: sync.updateResultsBatch,
      updateResultsFile: sync.updateResultsFile,
      updateTestCase: sync.updateTestCase,
      clearTestResult: sync.clearTestResult,
    }),
    [
      sync.definition,
      sync.results,
      sync.session,
      sync.lastUpdatedTestId,
      sync.updateResults,
      sync.updateResultsBatch,
      sync.updateResultsFile,
      sync.updateTestCase,
      sync.clearTestResult,
    ],
  );

  return <RunnerWorkspaceProvider value={value}>{children}</RunnerWorkspaceProvider>;
}
