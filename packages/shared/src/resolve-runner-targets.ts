import { aggregateValidTestStatus } from "./aggregate-test-status";
import {
  isTestIncomplete,
  isTestInScope,
  resolveSessionTestTargets,
} from "./resolve-test-targets";
import { isResultEntryValid } from "./test-case-version";
import type {
  Bug,
  RunnerFilters,
  RunnerTargetMode,
  SessionConfig,
  TestCase,
  TestDefinition,
  TestResults,
  TestStatus,
} from "./types";

export type RunnerTestStatus = TestStatus | "incomplete";

export function getRunnerTargetMode(filters: RunnerFilters): RunnerTargetMode {
  return filters.targetMode ?? "filter";
}

function matchesCategoryFilters(testCase: TestCase, filters: RunnerFilters): boolean {
  if (filters.majorCategoryFilter && testCase.category.major !== filters.majorCategoryFilter) {
    return false;
  }
  if (filters.mediumCategoryFilter && testCase.category.medium !== filters.mediumCategoryFilter) {
    return false;
  }
  if (filters.minorCategoryFilter && testCase.category.minor !== filters.minorCategoryFilter) {
    return false;
  }
  return true;
}

function testCaseHasNg(
  testCase: TestCase,
  definition: TestDefinition,
  sessionEnvironmentIds: string[],
  results: TestResults,
): boolean {
  const targets = resolveSessionTestTargets(testCase, definition, sessionEnvironmentIds);
  const byEnv = results[testCase.id] ?? {};
  for (const envId of targets.environmentIds) {
    const entry = byEnv[envId];
    if (isResultEntryValid(entry, testCase) && entry!.status === "NG") {
      return true;
    }
  }
  return false;
}

function shouldIncludeTestCase(
  testCase: TestCase,
  definition: TestDefinition,
  sessionEnvironmentIds: string[],
  filters: RunnerFilters,
  results: TestResults,
  bugs: Bug[],
): boolean {
  if (!isTestInScope(testCase, definition, sessionEnvironmentIds)) return false;
  if (
    filters.onlyIncomplete &&
    !isTestIncomplete(testCase, definition, sessionEnvironmentIds, results)
  ) {
    return false;
  }
  if (filters.onlyWithBugs && !bugs.some((bug) => bug.testCaseId === testCase.id)) {
    return false;
  }
  if (
    filters.onlyWithNg &&
    !testCaseHasNg(testCase, definition, sessionEnvironmentIds, results)
  ) {
    return false;
  }
  return true;
}

export function resolveRunnerTestCases(
  definition: TestDefinition,
  session: SessionConfig,
  filters: RunnerFilters,
  results: TestResults,
  bugs: Bug[] = [],
): TestCase[] {
  const sessionEnvironmentIds = session.selectedEnvironmentIds;
  const mode = getRunnerTargetMode(filters);

  if (mode === "scenario" && filters.scenarioId && definition.scenarios) {
    const scenario = definition.scenarios.find((entry) => entry.id === filters.scenarioId);
    if (!scenario) return [];

    const byId = new Map(definition.testCases.map((testCase) => [testCase.id, testCase]));
    const ordered: TestCase[] = [];

    for (const stepId of scenario.steps) {
      const testCase = byId.get(stepId);
      if (!testCase) continue;
      if (!shouldIncludeTestCase(testCase, definition, sessionEnvironmentIds, filters, results, bugs)) {
        continue;
      }
      ordered.push(testCase);
    }

    return ordered;
  }

  return definition.testCases.filter((testCase) => {
    if (!shouldIncludeTestCase(testCase, definition, sessionEnvironmentIds, filters, results, bugs)) {
      return false;
    }
    return matchesCategoryFilters(testCase, filters);
  });
}

export function getTestCaseAggregateStatus(
  testCase: TestCase,
  definition: TestDefinition,
  sessionEnvironmentIds: string[],
  results: TestResults,
): RunnerTestStatus {
  if (isTestIncomplete(testCase, definition, sessionEnvironmentIds, results)) {
    return "incomplete";
  }

  const targets = resolveSessionTestTargets(testCase, definition, sessionEnvironmentIds);
  const strongest = aggregateValidTestStatus(testCase, targets.environmentIds, results);

  return strongest ?? "incomplete";
}

export function formatTestCaseLabel(testCase: TestCase, maxLength = 28): string {
  if (testCase.category.minor) return testCase.category.minor;
  if (testCase.description.length <= maxLength) return testCase.description;
  return `${testCase.description.slice(0, maxLength)}…`;
}
