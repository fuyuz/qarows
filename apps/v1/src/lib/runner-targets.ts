import {
  resolveRunnerTestCases,
  type ResultsFile,
  type RunnerFilters,
  type SessionConfig,
  type TestCase,
  type TestDefinition,
} from "@qarows/shared";
import { matchesBugFilters, type BugFilters } from "@/lib/bug-query";

export function filterTestCasesByBugFilters(
  testCases: TestCase[],
  bugs: ResultsFile["bugs"],
  bugFilters: BugFilters,
): TestCase[] {
  const hasBugFilters = bugFilters.priorities.length > 0 || bugFilters.statuses.length > 0;
  if (!hasBugFilters) return testCases;
  return testCases.filter((testCase) =>
    bugs.some(
      (bug) => bug.testCaseId === testCase.id && matchesBugFilters(bug, bugFilters),
    ),
  );
}

export function resolveRunnerTargets(
  definition: TestDefinition,
  session: SessionConfig,
  runnerFilters: RunnerFilters,
  results: ResultsFile,
  bugFilters: BugFilters = { priorities: [], statuses: [] },
): TestCase[] {
  const base = resolveRunnerTestCases(
    definition,
    session,
    runnerFilters,
    results.results,
    results.bugs,
  );
  return filterTestCasesByBugFilters(base, results.bugs, bugFilters);
}
