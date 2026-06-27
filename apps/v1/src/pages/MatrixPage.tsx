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
    );
  }, [definition, results, runnerFilters, session]);

  if (!definition || !results) return null;

  return (
    <div className="flex min-h-svh flex-col">
      <AppNav />
      <RunnerFilterBar className="sticky top-0 z-10" maxWidthClass="max-w-[min(100%,1400px)]" />
      <main className="mx-auto w-full max-w-[min(100%,1400px)] flex-1 px-5 py-4">
        <h1 className="mb-1 text-lg font-bold tracking-tight">マトリクス</h1>
        <p className="mb-3 text-xs text-muted-foreground">
          環境列は右方向へスクロールして確認できます
        </p>
        <TestMatrixTable testCases={testCases} />
      </main>
    </div>
  );
}
