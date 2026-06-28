import { useMemo, type ReactNode } from "react";
import {
  RunnerWorkspaceProvider,
  type RunnerWorkspaceValue,
} from "@qarows/runner-ui";
import { useApp } from "@/context/AppContext";

export function RunnerWorkspaceBridge({ children }: { children: ReactNode }) {
  const app = useApp();

  const value = useMemo<RunnerWorkspaceValue>(
    () => ({
      definition: app.definition,
      results: app.results,
      session: app.session,
      lastUpdatedTestId: app.lastUpdatedTestId,
      updateResults: app.updateResults,
      updateResultsBatch: app.updateResultsBatch,
      updateResultsFile: app.updateResultsFile,
      updateTestCase: app.updateTestCase,
      clearTestResult: app.clearTestResult,
    }),
    [
      app.definition,
      app.results,
      app.session,
      app.lastUpdatedTestId,
      app.updateResults,
      app.updateResultsBatch,
      app.updateResultsFile,
      app.updateTestCase,
      app.clearTestResult,
    ],
  );

  return <RunnerWorkspaceProvider value={value}>{children}</RunnerWorkspaceProvider>;
}
