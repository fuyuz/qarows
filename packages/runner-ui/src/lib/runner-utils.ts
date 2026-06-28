import {
  resolveRunnerTestCases,
  type RunnerFilters,
  type SessionConfig,
  type TestCase,
  type TestDefinition,
  type TestResults,
} from "@qarows/shared";

export function getMajorCategories(definition: TestDefinition): string[] {
  const set = new Set<string>();
  for (const tc of definition.testCases) {
    set.add(tc.category.major);
  }
  return [...set].sort();
}

export function getMediumCategories(
  definition: TestDefinition,
  majorFilter?: string,
): string[] {
  const set = new Set<string>();
  for (const tc of definition.testCases) {
    if (majorFilter && tc.category.major !== majorFilter) continue;
    if (tc.category.medium) set.add(tc.category.medium);
  }
  return [...set].sort();
}

export function getMinorCategories(
  definition: TestDefinition,
  majorFilter?: string,
  mediumFilter?: string,
): string[] {
  const set = new Set<string>();
  for (const tc of definition.testCases) {
    if (majorFilter && tc.category.major !== majorFilter) continue;
    if (mediumFilter && tc.category.medium !== mediumFilter) continue;
    if (tc.category.minor) set.add(tc.category.minor);
  }
  return [...set].sort();
}

/** @deprecated resolveRunnerTestCases を使用 */
export function filterTestCases(
  definition: TestDefinition,
  session: SessionConfig,
  filters: RunnerFilters,
  results: TestResults,
): TestCase[] {
  return resolveRunnerTestCases(definition, session, filters, results);
}

export {
  formatTestCaseLabel,
  getRunnerTargetMode,
  getTestCaseAggregateStatus,
  isTestInScope,
  isTestIncomplete,
  resolveRunnerTestCases,
} from "@qarows/shared";

export function formatRunnerFilterTitle(
  definition: TestDefinition | null,
  filters: RunnerFilters,
): string {
  const mode = filters.targetMode ?? "filter";
  if (mode === "scenario") {
    const scenario = definition?.scenarios?.find((entry) => entry.id === filters.scenarioId);
    return scenario ? `シナリオ（${scenario.name}）` : "シナリオ";
  }

  const parts = [
    filters.majorCategoryFilter,
    filters.mediumCategoryFilter,
    filters.minorCategoryFilter,
  ].filter(Boolean);
  if (parts.length === 0) return "フィルタ";
  return `フィルタ（${parts.join(" › ")}）`;
}
