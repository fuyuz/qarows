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

const NO_SCOPE_FLAGS = {
  onlyIncomplete: false,
  onlyWithBugs: false,
  onlyWithNg: false,
  onlyWithSkip: false,
} as const;

/**
 * テスト実行へ移るときのフィルタ。今のフィルタで移動先が除外される（未実施のみで完了済みに飛ぶ等）と、
 * ランナーは test を捨てて使い方カードに戻してしまうため、移動先が残るところまでフィルタを緩める。
 * 1. そのまま 2. 未実施のみ・NG/SKIP/バグを含む を外す 3. 分類・シナリオも外す（フィルタモード）
 */
export function runnerFiltersForJump(
  testCaseId: string,
  definition: TestDefinition,
  session: SessionConfig,
  results: ResultsFile,
  filters: RunnerFilters,
): RunnerFilters {
  const includes = (candidate: RunnerFilters) =>
    resolveRunnerTestCases(definition, session, candidate, results.results, results.bugs).some(
      (tc) => tc.id === testCaseId,
    );
  if (includes(filters)) return filters;
  const withoutScopeFlags = { ...filters, ...NO_SCOPE_FLAGS };
  if (includes(withoutScopeFlags)) return withoutScopeFlags;
  return { targetMode: "filter", ...NO_SCOPE_FLAGS };
}
