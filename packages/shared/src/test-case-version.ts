import type { TestCase, TestResultEntry } from "./types";

export function getTestCaseVersion(testCase: Pick<TestCase, "version">): number {
  return testCase.version ?? 1;
}

export function getResultEntryVersion(entry: Pick<TestResultEntry, "version">): number {
  return entry.version ?? 1;
}

export function isResultEntryValid(
  entry: TestResultEntry | undefined,
  testCase: Pick<TestCase, "version">,
): boolean {
  if (entry?.status == null) return false;
  return getResultEntryVersion(entry) === getTestCaseVersion(testCase);
}
