import type {
  CategoryTarget,
  ResolvedTestTargets,
  SessionTestTargets,
  TargetRequirement,
  TestCase,
  TestDefinition,
  TestResultEntry,
  TestResults,
} from "./types";
import { isResultEntryValid } from "./test-case-version";

function applyTargetLayer(
  pool: string[],
  required: TargetRequirement,
  spec?: { required?: TargetRequirement; targets?: string[] },
): { pool: string[]; required: TargetRequirement } {
  if (!spec) return { pool, required };

  let nextPool = pool;
  if (spec.targets && spec.targets.length > 0) {
    const allowed = new Set(spec.targets);
    nextPool = pool.filter((id) => allowed.has(id));
  }

  return {
    pool: nextPool,
    required: spec.required ?? required,
  };
}

function matchesCategoryLevel(
  entry: CategoryTarget,
  level: "major" | "medium" | "minor",
  category: TestCase["category"],
): boolean {
  if (entry.match.major !== category.major) return false;

  if (level === "major") {
    return entry.match.medium == null && entry.match.minor == null;
  }

  if (level === "medium") {
    if (!category.medium) return false;
    return entry.match.medium === category.medium && entry.match.minor == null;
  }

  if (!category.minor) return false;
  if (entry.match.minor !== category.minor) return false;
  if (entry.match.medium != null) {
    return entry.match.medium === category.medium;
  }
  return true;
}

function findCategoryTarget(
  categoryTargets: CategoryTarget[] | undefined,
  level: "major" | "medium" | "minor",
  category: TestCase["category"],
): CategoryTarget | undefined {
  if (!categoryTargets) return undefined;
  return categoryTargets.find((entry) => matchesCategoryLevel(entry, level, category));
}

export function resolveTestTargets(
  testCase: TestCase,
  definition: TestDefinition,
): ResolvedTestTargets {
  const allEnvironmentIds = definition.environments.map((env) => env.id);
  let pool = [...allEnvironmentIds];
  let required: TargetRequirement = "all";

  const layers: Array<{ required?: TargetRequirement; targets?: string[] } | undefined> = [
    findCategoryTarget(definition.categoryTargets, "major", testCase.category),
    testCase.category.medium
      ? findCategoryTarget(definition.categoryTargets, "medium", testCase.category)
      : undefined,
    testCase.category.minor
      ? findCategoryTarget(definition.categoryTargets, "minor", testCase.category)
      : undefined,
    testCase.targetEnvironments,
  ];

  for (const layer of layers) {
    const next = applyTargetLayer(pool, required, layer);
    pool = next.pool;
    required = next.required;
  }

  return { environmentIds: pool, required };
}

export function resolveSessionTestTargets(
  testCase: TestCase,
  definition: TestDefinition,
  sessionEnvironmentIds: string[],
): SessionTestTargets {
  const resolved = resolveTestTargets(testCase, definition);
  const sessionSet = new Set(sessionEnvironmentIds);
  const environmentIds = resolved.environmentIds.filter((id) => sessionSet.has(id));

  return {
    environmentIds,
    required: resolved.required,
    inScope: environmentIds.length > 0,
  };
}

function hasResult(entry: TestResultEntry | undefined, testCase: TestCase): boolean {
  return isResultEntryValid(entry, testCase);
}

export function isTestInScope(
  testCase: TestCase,
  definition: TestDefinition,
  sessionEnvironmentIds: string[],
): boolean {
  return resolveSessionTestTargets(testCase, definition, sessionEnvironmentIds).inScope;
}

export function isTestIncomplete(
  testCase: TestCase,
  definition: TestDefinition,
  sessionEnvironmentIds: string[],
  results: TestResults,
): boolean {
  const targets = resolveSessionTestTargets(testCase, definition, sessionEnvironmentIds);
  if (!targets.inScope) return false;

  const byEnv = results[testCase.id] ?? {};

  if (targets.required === "any") {
    return !targets.environmentIds.some((envId) => hasResult(byEnv[envId], testCase));
  }

  return targets.environmentIds.some((envId) => !hasResult(byEnv[envId], testCase));
}

export function isTestComplete(
  testCase: TestCase,
  definition: TestDefinition,
  sessionEnvironmentIds: string[],
  results: TestResults,
): boolean {
  return (
    isTestInScope(testCase, definition, sessionEnvironmentIds) &&
    !isTestIncomplete(testCase, definition, sessionEnvironmentIds, results)
  );
}

/** セッション内に version 不一致の旧結果が残っている（再テスト未完了） */
export function testCaseNeedsRetest(
  testCase: TestCase,
  definition: TestDefinition,
  sessionEnvironmentIds: string[],
  results: TestResults,
): boolean {
  if (isTestComplete(testCase, definition, sessionEnvironmentIds, results)) {
    return false;
  }

  const targets = resolveSessionTestTargets(testCase, definition, sessionEnvironmentIds);
  const byEnv = results[testCase.id] ?? {};

  return targets.environmentIds.some((envId) => {
    const entry = byEnv[envId];
    return entry?.status != null && !isResultEntryValid(entry, testCase);
  });
}
