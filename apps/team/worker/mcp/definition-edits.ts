import {
  type CategoryTarget,
  type TargetEnvironmentSpec,
  type TestCase,
  type TestDefinition,
} from "@qarows/shared";

/** MCP からの定義編集で起きる、AI に伝えるべき入力エラー */
export class DefinitionEditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DefinitionEditError";
  }
}

export interface TestCaseInput {
  id: string;
  category: { major: string; medium?: string; minor?: string };
  description: string;
  prerequisites?: string;
  targetEnvironments?: TargetEnvironmentSpec;
}

export interface TestCasePatch {
  category?: { major: string; medium?: string; minor?: string };
  description?: string;
  /** 空文字で削除 */
  prerequisites?: string;
  /** null で個別指定を外す（カテゴリ・全体の既定に戻す） */
  targetEnvironments?: TargetEnvironmentSpec | null;
  /** true なら version を 1 上げる（既存の結果は未実施扱いになる） */
  bumpVersion?: boolean;
}

function findTestCase(definition: TestDefinition, testCaseId: string): TestCase {
  const testCase = definition.testCases.find((tc) => tc.id === testCaseId);
  if (!testCase) throw new DefinitionEditError(`Unknown test case id: ${testCaseId}`);
  return testCase;
}

function assertTargetsExist(definition: TestDefinition, spec: TargetEnvironmentSpec | undefined): void {
  const ids = new Set(definition.environments.map((env) => env.id));
  for (const id of spec?.targets ?? []) {
    if (!ids.has(id)) throw new DefinitionEditError(`Unknown environment id: ${id}`);
  }
}

function cleanCategory(category: TestCaseInput["category"]): TestCase["category"] {
  const major = category.major.trim();
  if (!major) throw new DefinitionEditError("category.major is required");
  return {
    major,
    ...(category.medium?.trim() ? { medium: category.medium.trim() } : {}),
    ...(category.minor?.trim() ? { minor: category.minor.trim() } : {}),
  };
}

export function addTestCase(definition: TestDefinition, input: TestCaseInput): TestDefinition {
  const id = input.id.trim();
  if (!id) throw new DefinitionEditError("id is required");
  if (definition.testCases.some((tc) => tc.id === id)) {
    throw new DefinitionEditError(`Test case id already exists: ${id}`);
  }
  const description = input.description.trim();
  if (!description) throw new DefinitionEditError("description is required");
  assertTargetsExist(definition, input.targetEnvironments);

  const testCase: TestCase = {
    id,
    category: cleanCategory(input.category),
    description,
    ...(input.prerequisites?.trim() ? { prerequisites: input.prerequisites.trim() } : {}),
    ...(input.targetEnvironments ? { targetEnvironments: input.targetEnvironments } : {}),
  };
  return { ...definition, testCases: [...definition.testCases, testCase] };
}

/** ID は変更できない（結果・バグ・シナリオの参照が壊れるため） */
export function updateTestCase(
  definition: TestDefinition,
  testCaseId: string,
  patch: TestCasePatch,
): TestDefinition {
  const current = findTestCase(definition, testCaseId);
  if (patch.targetEnvironments) assertTargetsExist(definition, patch.targetEnvironments);

  const next: TestCase = { ...current };
  if (patch.category) next.category = cleanCategory(patch.category);
  if (patch.description !== undefined) {
    const description = patch.description.trim();
    if (!description) throw new DefinitionEditError("description cannot be empty");
    next.description = description;
  }
  if (patch.prerequisites !== undefined) {
    const prerequisites = patch.prerequisites.trim();
    if (prerequisites) next.prerequisites = prerequisites;
    else delete next.prerequisites;
  }
  if (patch.targetEnvironments === null) delete next.targetEnvironments;
  else if (patch.targetEnvironments) next.targetEnvironments = patch.targetEnvironments;
  if (patch.bumpVersion) next.version = (current.version ?? 1) + 1;

  return {
    ...definition,
    testCases: definition.testCases.map((tc) => (tc.id === testCaseId ? next : tc)),
  };
}

/** シナリオの手順からも外す（空になったシナリオは削除）。結果は定義の置き換え時に整理される */
export function deleteTestCase(definition: TestDefinition, testCaseId: string): TestDefinition {
  findTestCase(definition, testCaseId);
  if (definition.testCases.length <= 1) {
    throw new DefinitionEditError("Cannot delete the last test case");
  }
  const scenarios = definition.scenarios
    ?.map((scenario) => ({ ...scenario, steps: scenario.steps.filter((id) => id !== testCaseId) }))
    .filter((scenario) => scenario.steps.length > 0);
  return {
    ...definition,
    testCases: definition.testCases.filter((tc) => tc.id !== testCaseId),
    ...(scenarios ? { scenarios } : {}),
  };
}

export function addEnvironment(
  definition: TestDefinition,
  input: { id: string; name?: string },
): TestDefinition {
  const id = input.id.trim();
  if (!id) throw new DefinitionEditError("environment id is required");
  if (definition.environments.some((env) => env.id === id)) {
    throw new DefinitionEditError(`Environment id already exists: ${id}`);
  }
  const name = input.name?.trim() || id;
  return { ...definition, environments: [...definition.environments, { id, name }] };
}

export function renameEnvironment(
  definition: TestDefinition,
  environmentId: string,
  name: string,
): TestDefinition {
  if (!definition.environments.some((env) => env.id === environmentId)) {
    throw new DefinitionEditError(`Unknown environment id: ${environmentId}`);
  }
  const trimmed = name.trim();
  if (!trimmed) throw new DefinitionEditError("environment name cannot be empty");
  return {
    ...definition,
    environments: definition.environments.map((env) =>
      env.id === environmentId ? { ...env, name: trimmed } : env,
    ),
  };
}

function withoutTarget<T extends { targets?: string[] }>(spec: T, environmentId: string): T | null {
  if (!spec.targets?.includes(environmentId)) return spec;
  const targets = spec.targets.filter((id) => id !== environmentId);
  // 対象を全部外したら個別指定ごと外す（定義編集画面の端末削除と同じ扱い）
  return targets.length > 0 ? { ...spec, targets } : null;
}

/** 端末を参照しているテストケース・カテゴリ既定の対象からも外す */
export function deleteEnvironment(definition: TestDefinition, environmentId: string): TestDefinition {
  if (!definition.environments.some((env) => env.id === environmentId)) {
    throw new DefinitionEditError(`Unknown environment id: ${environmentId}`);
  }
  if (definition.environments.length <= 1) {
    throw new DefinitionEditError("Cannot delete the last environment");
  }
  const testCases = definition.testCases.map((tc) => {
    if (!tc.targetEnvironments) return tc;
    const spec = withoutTarget(tc.targetEnvironments, environmentId);
    if (spec === tc.targetEnvironments) return tc;
    const { targetEnvironments: _removed, ...rest } = tc;
    return spec ? { ...rest, targetEnvironments: spec } : rest;
  });
  // カテゴリ既定は required の指定を残し、対象が空になったら targets だけ外す
  const categoryTargets = definition.categoryTargets?.map((ct): CategoryTarget => {
    const spec = withoutTarget(ct, environmentId);
    if (spec) return spec;
    const { targets: _removed, ...rest } = ct;
    return rest;
  });
  return {
    ...definition,
    environments: definition.environments.filter((env) => env.id !== environmentId),
    testCases,
    ...(categoryTargets ? { categoryTargets } : {}),
  };
}

/** 空文字で overview を外す */
export function setOverview(definition: TestDefinition, overview: string): TestDefinition {
  const { overview: _previous, ...rest } = definition;
  return overview.trim() ? { ...rest, overview } : rest;
}
