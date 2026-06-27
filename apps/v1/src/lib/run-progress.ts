import {
  isTestInScope,
  isTestIncomplete,
  resolveSessionTestTargets,
  strongerStatus,
  type TestDefinition,
  type TestResults,
  type TestStatus,
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
  OK_NG: 0,
};

function aggregateTestStatus(
  testCaseId: string,
  definition: TestDefinition,
  sessionEnvironmentIds: string[],
  results: TestResults,
): ProgressBucket {
  const testCase = definition.testCases.find((tc) => tc.id === testCaseId);
  if (!testCase) return "incomplete";

  if (isTestIncomplete(testCase, definition, sessionEnvironmentIds, results)) {
    return "incomplete";
  }

  const targets = resolveSessionTestTargets(testCase, definition, sessionEnvironmentIds);
  const byEnv = results[testCaseId] ?? {};
  let strongest: TestStatus | null = null;

  for (const envId of targets.environmentIds) {
    const status = byEnv[envId]?.status;
    if (!status) continue;
    strongest = strongest ? strongerStatus(strongest, status) : status;
  }

  return strongest ?? "incomplete";
}

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
    const bucket = aggregateTestStatus(testCase.id, definition, sessionEnvironmentIds, results);
    buckets[bucket]++;
  }

  return {
    total,
    completed: total - buckets.incomplete,
    buckets,
  };
}

export function computeRunProgressForTestCases(
  testCases: Array<{ id: string }>,
  definition: TestDefinition,
  sessionEnvironmentIds: string[],
  results: TestResults,
): RunProgressStats {
  const buckets = { ...EMPTY_BUCKETS };
  const total = testCases.length;

  for (const testCase of testCases) {
    const bucket = aggregateTestStatus(testCase.id, definition, sessionEnvironmentIds, results);
    buckets[bucket]++;
  }

  return {
    total,
    completed: total - buckets.incomplete,
    buckets,
  };
}

/** プログレスバー上の表示順 */
export const PROGRESS_SEGMENT_ORDER: ProgressBucket[] = ["OK", "SKIP", "OK_NG", "NG", "incomplete"];

export const PROGRESS_SEGMENT_LABELS: Record<ProgressBucket, string> = {
  OK: "OK",
  NG: "NG",
  SKIP: "SKIP",
  OK_NG: "OK→NG",
  incomplete: "未実施",
};
