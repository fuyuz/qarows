import { useMemo } from "react";
import { useRunnerWorkspace } from "../context/runner-workspace";
import { useRunnerQueryState } from "../hooks/useRunnerQueryState";
import { ProgressRow } from "./ProgressRow";
import {
  computeRunProgress,
  computeRunProgressForTestCases,
} from "../lib/run-progress";
import { resolveRunnerTargets } from "../lib/runner-targets";
import { formatRunnerFilterTitle } from "../lib/runner-utils";

export function RunProgressBar() {
  const { definition, results, session } = useRunnerWorkspace();
  const { runnerFilters, bugFilters } = useRunnerQueryState();

  const { overall, filtered } = useMemo(() => {
    const empty = {
      total: 0,
      completed: 0,
      buckets: { incomplete: 0, OK: 0, NG: 0, SKIP: 0 },
    };
    if (!definition || !results || !session) {
      return { overall: empty, filtered: empty };
    }

    const sessionEnvIds = session.selectedEnvironmentIds;
    const overallStats = computeRunProgress(definition, sessionEnvIds, results.results);

    const filterScopeCases = resolveRunnerTargets(
      definition,
      session,
      { ...runnerFilters, onlyIncomplete: false },
      results,
      bugFilters,
    );
    const filteredStats = computeRunProgressForTestCases(
      filterScopeCases,
      definition,
      sessionEnvIds,
      results.results,
    );

    return { overall: overallStats, filtered: filteredStats };
  }, [bugFilters, definition, results, runnerFilters, session]);

  if (!definition || !session || overall.total === 0) return null;

  const filterTitle = formatRunnerFilterTitle(definition, runnerFilters);

  return (
    <footer
      className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-1.5 border-t bg-card px-5 py-2 shadow-[0_-2px_10px_rgb(0_0_0/6%)]"
      aria-label="テスト進捗"
    >
      <ProgressRow id="run-progress-filter" title={filterTitle} stats={filtered} />
      <ProgressRow id="run-progress-overall" title="全体" stats={overall} />
    </footer>
  );
}
