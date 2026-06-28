import {
  isTestInScope,
  isValidSession,
  resolveRunnerTestCases,
  type ResultsFile,
  type RunnerFilters,
  type SessionConfig,
  type TestDefinition,
} from "@qarows/shared";

export function findRunnerIndex(
  testCaseId: string,
  definition: TestDefinition,
  session: SessionConfig,
  results: ResultsFile,
  filters: RunnerFilters,
): number | null {
  const targets = resolveRunnerTestCases(definition, session, filters, results.results);
  const index = targets.findIndex((tc) => tc.id === testCaseId);
  return index >= 0 ? index : null;
}

export function canJumpToRunner(
  testCaseId: string,
  definition: TestDefinition,
  session: SessionConfig | null,
): boolean {
  if (!session || !isValidSession(session)) return false;
  const testCase = definition.testCases.find((tc) => tc.id === testCaseId);
  if (!testCase) return false;
  return isTestInScope(testCase, definition, session.selectedEnvironmentIds);
}
