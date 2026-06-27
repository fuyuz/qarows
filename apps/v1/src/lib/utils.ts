import {
  isTestIncomplete,
  isTestInScope,
  type SessionConfig,
  type TestCase,
  type TestDefinition,
  type TestResults,
  type RunnerFilters,
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

export function filterTestCases(
  definition: TestDefinition,
  session: SessionConfig,
  filters: RunnerFilters,
  results: TestResults,
): TestCase[] {
  return definition.testCases.filter((tc) => {
    if (!isTestInScope(tc, definition, session.selectedEnvironmentIds)) {
      return false;
    }
    if (filters.majorCategoryFilter && tc.category.major !== filters.majorCategoryFilter) {
      return false;
    }
    if (filters.mediumCategoryFilter && tc.category.medium !== filters.mediumCategoryFilter) {
      return false;
    }
    if (
      filters.onlyIncomplete &&
      !isTestIncomplete(tc, definition, session.selectedEnvironmentIds, results)
    ) {
      return false;
    }
    return true;
  });
}

export { isTestIncomplete, isTestInScope };

export function downloadText(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("ファイル読み込みに失敗しました"));
    reader.readAsText(file);
  });
}
