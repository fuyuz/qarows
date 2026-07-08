import type {
  CategoryTarget,
  Environment,
  TestCase,
  TestDefinition,
  TestScenario,
} from "./types";

export interface FieldChange {
  field: string;
  before: string;
  after: string;
}

export interface EnvChange {
  id: string;
  fields: FieldChange[];
}

export interface TestCaseChange {
  id: string;
  fields: FieldChange[];
}

export interface ArraySectionChange {
  added: number;
  removed: number;
  modified: number;
}

export interface DefinitionDiff {
  project: FieldChange[];
  environments: {
    added: Environment[];
    removed: string[];
    modified: EnvChange[];
  };
  testCases: {
    added: TestCase[];
    removed: string[];
    modified: TestCaseChange[];
  };
  categoryTargets: ArraySectionChange | null;
  scenarios: ArraySectionChange | null;
  hasChanges: boolean;
}

function stringify(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function projectFields(before: TestDefinition["project"], after: TestDefinition["project"]): FieldChange[] {
  const fields: FieldChange[] = [];
  if (before.name !== after.name) {
    fields.push({ field: "name", before: before.name, after: after.name });
  }
  if ((before.version ?? 1) !== (after.version ?? 1)) {
    fields.push({
      field: "version",
      before: String(before.version ?? 1),
      after: String(after.version ?? 1),
    });
  }
  return fields;
}

function envFields(before: Environment, after: Environment): FieldChange[] {
  const fields: FieldChange[] = [];
  if (before.name !== after.name) {
    fields.push({ field: "name", before: before.name, after: after.name });
  }
  return fields;
}

function testCaseFields(before: TestCase, after: TestCase): FieldChange[] {
  const fields: FieldChange[] = [];
  if (before.description !== after.description) {
    fields.push({ field: "description", before: before.description, after: after.description });
  }
  if (before.prerequisites !== after.prerequisites) {
    fields.push({
      field: "prerequisites",
      before: before.prerequisites ?? "",
      after: after.prerequisites ?? "",
    });
  }
  if ((before.version ?? 1) !== (after.version ?? 1)) {
    fields.push({
      field: "version",
      before: String(before.version ?? 1),
      after: String(after.version ?? 1),
    });
  }
  const bCat = before.category;
  const aCat = after.category;
  if (bCat.major !== aCat.major) {
    fields.push({ field: "category.major", before: bCat.major, after: aCat.major });
  }
  if (bCat.medium !== aCat.medium) {
    fields.push({
      field: "category.medium",
      before: bCat.medium ?? "",
      after: aCat.medium ?? "",
    });
  }
  if (bCat.minor !== aCat.minor) {
    fields.push({
      field: "category.minor",
      before: bCat.minor ?? "",
      after: aCat.minor ?? "",
    });
  }
  const bTarget = stringify(before.targetEnvironments);
  const aTarget = stringify(after.targetEnvironments);
  if (bTarget !== aTarget) {
    fields.push({ field: "targetEnvironments", before: bTarget, after: aTarget });
  }
  return fields;
}

function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function diffArraySection<T>(before: T[] | undefined, after: T[] | undefined): ArraySectionChange | null {
  const b = before ?? [];
  const a = after ?? [];
  if (jsonEqual(b, a)) return null;
  return { added: 0, removed: 0, modified: 1 };
}

export function computeDefinitionDiff(
  before: TestDefinition,
  after: TestDefinition,
): DefinitionDiff {
  const project = projectFields(before.project, after.project);

  const beforeEnvMap = new Map(before.environments.map((env) => [env.id, env]));
  const afterEnvMap = new Map(after.environments.map((env) => [env.id, env]));
  const envAdded: Environment[] = [];
  const envRemoved: string[] = [];
  const envModified: EnvChange[] = [];

  for (const env of after.environments) {
    if (!beforeEnvMap.has(env.id)) envAdded.push(env);
  }
  for (const env of before.environments) {
    if (!afterEnvMap.has(env.id)) envRemoved.push(env.id);
  }
  for (const [id, afterEnv] of afterEnvMap) {
    const beforeEnv = beforeEnvMap.get(id);
    if (!beforeEnv) continue;
    const fields = envFields(beforeEnv, afterEnv);
    if (fields.length > 0) envModified.push({ id, fields });
  }

  const beforeTcMap = new Map(before.testCases.map((tc) => [tc.id, tc]));
  const afterTcMap = new Map(after.testCases.map((tc) => [tc.id, tc]));
  const tcAdded: TestCase[] = [];
  const tcRemoved: string[] = [];
  const tcModified: TestCaseChange[] = [];

  for (const tc of after.testCases) {
    if (!beforeTcMap.has(tc.id)) tcAdded.push(tc);
  }
  for (const tc of before.testCases) {
    if (!afterTcMap.has(tc.id)) tcRemoved.push(tc.id);
  }
  for (const [id, afterTc] of afterTcMap) {
    const beforeTc = beforeTcMap.get(id);
    if (!beforeTc) continue;
    const fields = testCaseFields(beforeTc, afterTc);
    if (fields.length > 0) tcModified.push({ id, fields });
  }

  const categoryTargets = diffArraySection<CategoryTarget>(
    before.categoryTargets,
    after.categoryTargets,
  );
  const scenarios = diffArraySection<TestScenario>(before.scenarios, after.scenarios);

  const hasChanges =
    project.length > 0 ||
    envAdded.length > 0 ||
    envRemoved.length > 0 ||
    envModified.length > 0 ||
    tcAdded.length > 0 ||
    tcRemoved.length > 0 ||
    tcModified.length > 0 ||
    categoryTargets != null ||
    scenarios != null;

  return {
    project,
    environments: { added: envAdded, removed: envRemoved, modified: envModified },
    testCases: { added: tcAdded, removed: tcRemoved, modified: tcModified },
    categoryTargets,
    scenarios,
    hasChanges,
  };
}

export function definitionDiffSummary(diff: DefinitionDiff): string {
  const parts: string[] = [];
  const { testCases } = diff;
  if (testCases.added.length) parts.push(`+${testCases.added.length} TC`);
  if (testCases.removed.length) parts.push(`-${testCases.removed.length} TC`);
  if (testCases.modified.length) parts.push(`変更 ${testCases.modified.length} TC`);
  if (diff.environments.added.length) parts.push(`端末 +${diff.environments.added.length}`);
  if (diff.environments.removed.length) parts.push(`端末 -${diff.environments.removed.length}`);
  if (diff.project.length) parts.push("プロジェクト設定");
  if (diff.categoryTargets) parts.push("categoryTargets");
  if (diff.scenarios) parts.push("scenarios");
  return parts.length > 0 ? parts.join(" / ") : "変更なし";
}
