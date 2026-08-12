import type {
  CategoryTarget,
  Environment,
  TestCase,
  TestDefinition,
  TestScenario,
} from "./types";
import type { TranslateFn } from "./i18n/translate";
import { createTranslator, messageCatalogs } from "./i18n";
import { getClientLocale } from "./i18n/client-locale";

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

export interface ScenarioChange {
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
  scenarios: {
    added: TestScenario[];
    removed: string[];
    modified: ScenarioChange[];
  };
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

function scenarioFields(before: TestScenario, after: TestScenario): FieldChange[] {
  const fields: FieldChange[] = [];
  if (before.name !== after.name) {
    fields.push({ field: "name", before: before.name, after: after.name });
  }
  const bDesc = before.description ?? "";
  const aDesc = after.description ?? "";
  if (bDesc !== aDesc) {
    fields.push({ field: "description", before: bDesc, after: aDesc });
  }
  const bSteps = before.steps.join(", ");
  const aSteps = after.steps.join(", ");
  if (bSteps !== aSteps) {
    fields.push({ field: "steps", before: bSteps, after: aSteps });
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

  const beforeScenarios = before.scenarios ?? [];
  const afterScenarios = after.scenarios ?? [];
  const beforeScenarioMap = new Map(beforeScenarios.map((s) => [s.id, s]));
  const afterScenarioMap = new Map(afterScenarios.map((s) => [s.id, s]));
  const scenarioAdded: TestScenario[] = [];
  const scenarioRemoved: string[] = [];
  const scenarioModified: ScenarioChange[] = [];

  for (const scenario of afterScenarios) {
    if (!beforeScenarioMap.has(scenario.id)) scenarioAdded.push(scenario);
  }
  for (const scenario of beforeScenarios) {
    if (!afterScenarioMap.has(scenario.id)) scenarioRemoved.push(scenario.id);
  }
  for (const [id, afterScenario] of afterScenarioMap) {
    const beforeScenario = beforeScenarioMap.get(id);
    if (!beforeScenario) continue;
    const fields = scenarioFields(beforeScenario, afterScenario);
    if (fields.length > 0) scenarioModified.push({ id, fields });
  }

  const scenarios = {
    added: scenarioAdded,
    removed: scenarioRemoved,
    modified: scenarioModified,
  };

  const hasChanges =
    project.length > 0 ||
    envAdded.length > 0 ||
    envRemoved.length > 0 ||
    envModified.length > 0 ||
    tcAdded.length > 0 ||
    tcRemoved.length > 0 ||
    tcModified.length > 0 ||
    categoryTargets != null ||
    scenarioAdded.length > 0 ||
    scenarioRemoved.length > 0 ||
    scenarioModified.length > 0;

  return {
    project,
    environments: { added: envAdded, removed: envRemoved, modified: envModified },
    testCases: { added: tcAdded, removed: tcRemoved, modified: tcModified },
    categoryTargets,
    scenarios,
    hasChanges,
  };
}

export function definitionDiffSummary(diff: DefinitionDiff, t?: TranslateFn): string {
  const tr = t ?? createTranslator(getClientLocale(), messageCatalogs);
  const parts: string[] = [];
  const { testCases } = diff;
  if (testCases.added.length) parts.push(tr("definition.diffSummary.tcAdded", { n: testCases.added.length }));
  if (testCases.removed.length) parts.push(tr("definition.diffSummary.tcRemoved", { n: testCases.removed.length }));
  if (testCases.modified.length) parts.push(tr("definition.diffSummary.tcModified", { n: testCases.modified.length }));
  if (diff.environments.added.length) parts.push(tr("definition.diffSummary.envAdded", { n: diff.environments.added.length }));
  if (diff.environments.removed.length) parts.push(tr("definition.diffSummary.envRemoved", { n: diff.environments.removed.length }));
  if (diff.environments.modified.length) parts.push(tr("definition.diffSummary.envModified", { n: diff.environments.modified.length }));
  if (diff.scenarios.added.length) parts.push(tr("definition.diffSummary.scenarioAdded", { n: diff.scenarios.added.length }));
  if (diff.scenarios.removed.length) parts.push(tr("definition.diffSummary.scenarioRemoved", { n: diff.scenarios.removed.length }));
  if (diff.scenarios.modified.length) parts.push(tr("definition.diffSummary.scenarioModified", { n: diff.scenarios.modified.length }));
  if (diff.project.length) parts.push(tr("definition.diffSummary.projectSettings"));
  if (diff.categoryTargets) parts.push(tr("definition.diffSummary.categoryTargets"));
  return parts.length > 0 ? parts.join(" / ") : tr("definition.diffSummary.none");
}
