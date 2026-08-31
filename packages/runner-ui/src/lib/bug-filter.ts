import {
  getRunnerTargetMode,
  type Bug,
  type RunnerFilters,
  type TestDefinition,
  type TestResults,
} from "@qarows/shared";
import { type BugFilters, matchesBugFilters } from "./bug-query";
import { resolveMatrixTestCases } from "./matrix-test-cases";

/**
 * バグ一覧はセッションの端末選択で絞り込まない。
 * バグ対応は端末をまたいで行うため、常に全端末を対象にする
 */
export function resolveFilteredBugs(
  definition: TestDefinition,
  runnerFilters: RunnerFilters,
  bugs: Bug[],
  results: TestResults,
  environmentIds: string[],
  bugFilters: BugFilters = { priorities: [], statuses: [] },
): Bug[] {
  const scopeFilters: RunnerFilters = { ...runnerFilters, onlyIncomplete: false };
  const filteredTestCaseIds = new Set(
    resolveMatrixTestCases(definition, scopeFilters, results, environmentIds, null).map(
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
