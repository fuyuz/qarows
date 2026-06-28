import { useMemo } from "react";
import { AppNav } from "@/components/AppNav";
import { RunnerFilterBar } from "@/components/RunnerFilterBar";
import { TestMatrixTable } from "@/components/TestMatrixTable";
import { useApp } from "@/context/AppContext";
import { useRunnerQueryState } from "@/hooks/useRunnerQueryState";
import { getAllEnvironmentIds } from "@/lib/run-progress";
import { resolveMatrixTestCases } from "@/lib/matrix-test-cases";

export function MatrixPage() {
  const { definition, results, session } = useApp();
  const { runnerFilters } = useRunnerQueryState();

  const testCases = useMemo(() => {
    if (!definition || !results) return [];
    const allEnvIds = getAllEnvironmentIds(definition);
    return resolveMatrixTestCases(
      definition,
      runnerFilters,
      results.results,
      allEnvIds,
      session,
      results.bugs,
    );
  }, [definition, results, runnerFilters, session]);

  if (!definition || !results) return null;

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <AppNav />
      <RunnerFilterBar className="shrink-0 z-10" maxWidthClass="max-w-[min(100%,1400px)]" />
      <main className="mx-auto flex min-h-0 w-full max-w-[min(100%,1400px)] flex-1 flex-col overflow-hidden px-5 py-4">
        <div className="shrink-0">
          <h1 className="mb-1 text-lg font-bold tracking-tight">マトリクス</h1>
          <p className="mb-3 text-xs text-muted-foreground">
            環境列は右方向へスクロールして確認できます
          </p>
        </div>
        <div className="min-h-0 flex-1">
          <TestMatrixTable testCases={testCases} />
        </div>
      </main>
    </div>
  );
}
