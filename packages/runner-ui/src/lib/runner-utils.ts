import {
  resolveRunnerTestCases,
  type Locale,
  type RunnerFilters,
  type SessionConfig,
  type TestCase,
  type TestDefinition,
  type TestResults,
  type TranslateFn,
} from "@qarows/shared";

function sortLocaleTag(locale?: Locale | string): string {
  return locale === "en" ? "en" : "ja";
}

export function getMajorCategories(definition: TestDefinition, locale?: Locale | string): string[] {
  const set = new Set<string>();
  for (const tc of definition.testCases) {
    set.add(tc.category.major);
  }
  const localeTag = sortLocaleTag(locale);
  return [...set].sort((a, b) => a.localeCompare(b, localeTag));
}

export function getMediumCategories(
  definition: TestDefinition,
  majorFilter?: string,
  locale?: Locale | string,
): string[] {
  const set = new Set<string>();
  for (const tc of definition.testCases) {
    if (majorFilter && tc.category.major !== majorFilter) continue;
    if (tc.category.medium) set.add(tc.category.medium);
  }
  const localeTag = sortLocaleTag(locale);
  return [...set].sort((a, b) => a.localeCompare(b, localeTag));
}

export function getMinorCategories(
  definition: TestDefinition,
  majorFilter?: string,
  mediumFilter?: string,
  locale?: Locale | string,
): string[] {
  const set = new Set<string>();
  for (const tc of definition.testCases) {
    if (majorFilter && tc.category.major !== majorFilter) continue;
    if (mediumFilter && tc.category.medium !== mediumFilter) continue;
    if (tc.category.minor) set.add(tc.category.minor);
  }
  const localeTag = sortLocaleTag(locale);
  return [...set].sort((a, b) => a.localeCompare(b, localeTag));
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
  t: TranslateFn,
): string {
  const mode = filters.targetMode ?? "filter";
  if (mode === "scenario") {
    const scenario = definition?.scenarios?.find((entry) => entry.id === filters.scenarioId);
    return scenario ? t("runner.scenarioNamed", { name: scenario.name }) : t("runner.scenario");
  }

  const parts = [
    filters.majorCategoryFilter,
    filters.mediumCategoryFilter,
    filters.minorCategoryFilter,
  ].filter(Boolean);
  if (parts.length === 0) return t("runner.filter");
  return t("runner.filterNamed", { parts: parts.join(" › ") });
}
