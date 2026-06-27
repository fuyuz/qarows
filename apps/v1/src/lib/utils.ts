import type { SessionConfig, TestCase, TestDefinition, TestResults } from "@qarows/shared";

export function getMajorCategories(definition: TestDefinition): string[] {
  const set = new Set<string>();
  for (const tc of definition.testCases) {
    set.add(tc.category.major);
  }
  return [...set].sort();
}

export function isTestIncomplete(
  testCase: TestCase,
  environmentIds: string[],
  results: TestResults,
): boolean {
  const byEnv = results[testCase.id] ?? {};
  return environmentIds.some((envId) => !byEnv[envId]?.status);
}

export function filterTestCases(
  definition: TestDefinition,
  session: SessionConfig,
  results: TestResults,
): TestCase[] {
  return definition.testCases.filter((tc) => {
    if (session.majorCategoryFilter && tc.category.major !== session.majorCategoryFilter) {
      return false;
    }
    if (
      session.onlyIncomplete &&
      !isTestIncomplete(tc, session.selectedEnvironmentIds, results)
    ) {
      return false;
    }
    return true;
  });
}

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
