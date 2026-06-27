import { getRunnerTargetMode, type Bug, type RunnerFilters, type SessionConfig, type TestDefinition, type TestResults } from "@qarows/shared";
import { type BugFilters, matchesBugFilters } from "@/lib/bug-query";
import { resolveMatrixTestCases } from "@/lib/matrix-test-cases";

export function resolveFilteredBugs(
  definition: TestDefinition,
  runnerFilters: RunnerFilters,
  bugs: Bug[],
  results: TestResults,
  environmentIds: string[],
  session: SessionConfig | null,
  bugFilters: BugFilters = { priorities: [], statuses: [] },
): Bug[] {
  const scopeFilters: RunnerFilters = { ...runnerFilters, onlyIncomplete: false };
  const filteredTestCaseIds = new Set(
    resolveMatrixTestCases(definition, scopeFilters, results, environmentIds, session).map(
      (testCase) => testCase.id,
    ),
  );

  const mode = getRunnerTargetMode(scopeFilters);
  const hasCategoryFilter = Boolean(
    scopeFilters.majorCategoryFilter ||
      scopeFilters.mediumCategoryFilter ||
      scopeFilters.minorCategoryFilter,
  );
  const includeUnlinked = mode === "filter" && !hasCategoryFilter;

  return bugs.filter((bug) => {
    if (!matchesBugFilters(bug, bugFilters)) return false;
    if (!bug.testCaseId) return includeUnlinked;
    return filteredTestCaseIds.has(bug.testCaseId);
  });
}
