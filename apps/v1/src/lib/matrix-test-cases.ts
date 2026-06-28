import {
  resolveRunnerTestCases,
  type Bug,
  type RunnerFilters,
  type SessionConfig,
  type TestCase,
  type TestDefinition,
  type TestResults,
} from "@qarows/shared";

export function resolveMatrixTestCases(
  definition: TestDefinition,
  runnerFilters: RunnerFilters,
  results: TestResults,
  environmentIds: string[],
  session: SessionConfig | null,
  bugs: Bug[] = [],
): TestCase[] {
  if (session) {
    return resolveRunnerTestCases(definition, session, runnerFilters, results, bugs);
  }

  const pseudoSession: SessionConfig = {
    executorName: "",
    selectedEnvironmentIds: environmentIds,
  };
  return resolveRunnerTestCases(definition, pseudoSession, runnerFilters, results, bugs);
}
