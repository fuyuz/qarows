import {
  getTestCaseAggregateStatus,
  isTestInScope,
  sortLocaleFor,
  type Locale,
  type TestCase,
  type TestDefinition,
  type TestResults,
  type TestStatus,
  type TranslateFn,
} from "@qarows/shared";

export type ProgressBucket = TestStatus | "incomplete";

export interface RunProgressStats {
  total: number;
  completed: number;
  buckets: Record<ProgressBucket, number>;
}

const EMPTY_BUCKETS: Record<ProgressBucket, number> = {
  incomplete: 0,
  OK: 0,
  NG: 0,
  SKIP: 0,
};

export function computeRunProgress(
  definition: TestDefinition,
  sessionEnvironmentIds: string[],
  results: TestResults,
): RunProgressStats {
  const buckets = { ...EMPTY_BUCKETS };
  let total = 0;

  for (const testCase of definition.testCases) {
    if (!isTestInScope(testCase, definition, sessionEnvironmentIds)) continue;
    total++;
    const bucket = getTestCaseAggregateStatus(testCase, definition, sessionEnvironmentIds, results);
    buckets[bucket]++;
  }

  return {
    total,
    completed: total - buckets.incomplete,
    buckets,
  };
}

export function computeRunProgressForTestCases(
  testCases: TestCase[],
  definition: TestDefinition,
  sessionEnvironmentIds: string[],
  results: TestResults,
): RunProgressStats {
  const buckets = { ...EMPTY_BUCKETS };
  const total = testCases.length;

  for (const testCase of testCases) {
    const bucket = getTestCaseAggregateStatus(testCase, definition, sessionEnvironmentIds, results);
    buckets[bucket]++;
  }

  return {
    total,
    completed: total - buckets.incomplete,
    buckets,
  };
}

/** プログレスバー上の表示順 */
export const PROGRESS_SEGMENT_ORDER: ProgressBucket[] = ["OK", "SKIP", "NG", "incomplete"];

export function progressSegmentLabels(t: TranslateFn): Record<ProgressBucket, string> {
  return {
    OK: "OK",
    NG: "NG",
    SKIP: "SKIP",
    incomplete: t("runner.notRun"),
  };
}

export function getAllEnvironmentIds(definition: TestDefinition): string[] {
  return definition.environments.map((env) => env.id);
}

export interface CategoryProgressRow {
  major: string;
  stats: RunProgressStats;
}

export function computeCategoryProgress(
  definition: TestDefinition,
  environmentIds: string[],
  results: TestResults,
  locale?: Locale | string,
): CategoryProgressRow[] {
  const byMajor = new Map<string, TestCase[]>();

  for (const testCase of definition.testCases) {
    if (!isTestInScope(testCase, definition, environmentIds)) continue;
    const list = byMajor.get(testCase.category.major) ?? [];
    list.push(testCase);
    byMajor.set(testCase.category.major, list);
  }

  const localeTag = sortLocaleFor(locale);
  return [...byMajor.entries()]
    .sort(([a], [b]) => a.localeCompare(b, localeTag))
    .map(([major, cases]) => ({
      major,
      stats: computeRunProgressForTestCases(cases, definition, environmentIds, results),
    }));
}

export function formatRate(count: number, total: number): string {
  if (total === 0) return "—";
  return `${Math.round((count / total) * 100)}%`;
}
