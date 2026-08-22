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
  if (spec.targets != null) {
    nextPool =
      spec.targets.length === 0
        ? []
        : pool.filter((id) => spec.targets!.includes(id));
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

/**
 * categoryTargets を match.major で索引する。matchesCategoryLevel は最初に major を
 * 見るので、全件走査 × テストケース数（O(N×C)）になっていた。
 * definition は差し替えで更新される不変オブジェクトなので WeakMap で持てる
 */
const categoryTargetIndexes = new WeakMap<TestDefinition, Map<string, CategoryTarget[]>>();

function categoryTargetsByMajor(definition: TestDefinition): Map<string, CategoryTarget[]> {
  const cached = categoryTargetIndexes.get(definition);
  if (cached) return cached;

  const index = new Map<string, CategoryTarget[]>();
  for (const entry of definition.categoryTargets ?? []) {
    const list = index.get(entry.match.major);
    if (list) list.push(entry);
    else index.set(entry.match.major, [entry]);
  }
  categoryTargetIndexes.set(definition, index);
  return index;
}

function findCategoryTarget(
  definition: TestDefinition,
  level: "major" | "medium" | "minor",
  category: TestCase["category"],
): CategoryTarget | undefined {
  const candidates = categoryTargetsByMajor(definition).get(category.major);
  if (!candidates) return undefined;
  return candidates.find((entry) => matchesCategoryLevel(entry, level, category));
}

/**
 * (definition, testCase) ごとの解決結果。1 テストケースの判定で 3〜4 回呼ばれるうえ、
 * 呼ぶたびに environments の配列を作り直していた。
 * 結果は定義単位で共有されるので、返す配列は freeze して破壊的変更を実行時に落とす
 * （resolveIncompleteCheckTargets はこの配列を参照でそのまま返す）
 */
const resolvedTargets = new WeakMap<TestDefinition, WeakMap<TestCase, ResolvedTestTargets>>();

export function resolveTestTargets(
  testCase: TestCase,
  definition: TestDefinition,
): ResolvedTestTargets {
  const perDefinition = resolvedTargets.get(definition) ?? new WeakMap<TestCase, ResolvedTestTargets>();
  const cached = perDefinition.get(testCase);
  if (cached) return cached;
  resolvedTargets.set(definition, perDefinition);

  let pool = definition.environments.map((env) => env.id);
  let required: TargetRequirement = "all";

  const layers: Array<{ required?: TargetRequirement; targets?: string[] } | undefined> = [
    findCategoryTarget(definition, "major", testCase.category),
    testCase.category.medium
      ? findCategoryTarget(definition, "medium", testCase.category)
      : undefined,
    testCase.category.minor
      ? findCategoryTarget(definition, "minor", testCase.category)
      : undefined,
    testCase.targetEnvironments,
  ];

  for (const layer of layers) {
    const next = applyTargetLayer(pool, required, layer);
    pool = next.pool;
    required = next.required;
  }

  Object.freeze(pool);
  const resolved: ResolvedTestTargets = { environmentIds: pool, required };
  perDefinition.set(testCase, resolved);
  return resolved;
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

/**
 * 未実施フィルタ・進捗・ランナー完了判定で参照する環境 id。
 * - any: プロジェクト有効プール全体（セッション外の結果も完了に含める）
 * - all: セッションとの交差のみ（自分の担当端末が揃えば未実施に含めない）
 */
export function resolveIncompleteCheckTargets(
  testCase: TestCase,
  definition: TestDefinition,
  sessionEnvironmentIds: string[],
): SessionTestTargets {
  const sessionTargets = resolveSessionTestTargets(testCase, definition, sessionEnvironmentIds);
  if (!sessionTargets.inScope) return sessionTargets;

  if (sessionTargets.required === "any") {
    const projectTargets = resolveTestTargets(testCase, definition);
    return {
      environmentIds: projectTargets.environmentIds,
      required: "any",
      inScope: true,
    };
  }

  return sessionTargets;
}

/** 与えた env 別結果（入力直後の仮状態を含む）でセッション上の完了条件を満たすか */
export function wouldCompleteTestCase(
  testCase: TestCase,
  definition: TestDefinition,
  sessionEnvironmentIds: string[],
  byEnv: Record<string, TestResultEntry | undefined>,
): boolean {
  const targets = resolveIncompleteCheckTargets(testCase, definition, sessionEnvironmentIds);

  if (targets.required === "any") {
    return targets.environmentIds.some((envId) => hasResult(byEnv[envId], testCase));
  }

  return targets.environmentIds.every((envId) => hasResult(byEnv[envId], testCase));
}

/** 真の完了条件（有効プール全体。all は全端末、any はいずれか1端末） */
export function isTestGloballyComplete(
  testCase: TestCase,
  definition: TestDefinition,
  results: TestResults,
): boolean {
  const targets = resolveTestTargets(testCase, definition);
  if (targets.environmentIds.length === 0) return true;

  const byEnv = results[testCase.id] ?? {};

  if (targets.required === "any") {
    return targets.environmentIds.some((envId) => hasResult(byEnv[envId], testCase));
  }

  return targets.environmentIds.every((envId) => hasResult(byEnv[envId], testCase));
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
  const targets = resolveIncompleteCheckTargets(testCase, definition, sessionEnvironmentIds);
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

  const targets = resolveIncompleteCheckTargets(testCase, definition, sessionEnvironmentIds);
  const byEnv = results[testCase.id] ?? {};

  return targets.environmentIds.some((envId) => {
    const entry = byEnv[envId];
    return entry?.status != null && !isResultEntryValid(entry, testCase);
  });
}
