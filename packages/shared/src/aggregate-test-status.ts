import { isResultEntryValid } from "./test-case-version";
import { strongerStatus } from "./status";
import type { TestCase, TestResults, TestStatus } from "./types";

/** 有効な結果エントリのみを集約し、最も強いステータスを返す */
export function aggregateValidTestStatus(
  testCase: TestCase,
  environmentIds: string[],
  results: TestResults,
): TestStatus | null {
  const byEnv = results[testCase.id] ?? {};
  let strongest: TestStatus | null = null;

  for (const envId of environmentIds) {
    const entry = byEnv[envId];
    if (!isResultEntryValid(entry, testCase)) continue;
    strongest = strongest ? strongerStatus(strongest, entry!.status) : entry!.status;
  }

  return strongest;
}
