import yaml from "js-yaml";
import type {
  CategoryTarget,
  Environment,
  TargetEnvironmentSpec,
  TargetRequirement,
  TestCase,
  TestDefinition,
} from "./types";

function parseTargetRequirement(raw: unknown, context: string): TargetRequirement {
  if (raw == null) return "all";
  if (raw === "all" || raw === "any") return raw;
  throw new Error(`${context}.required は all または any である必要があります`);
}

function parseTargetIdList(raw: unknown, context: string): string[] | undefined {
  if (raw == null) return undefined;
  if (!Array.isArray(raw)) {
    throw new Error(`${context}.targets は配列である必要があります`);
  }
  return raw.map((item, index) => {
    if (typeof item !== "string" || !item.trim()) {
      throw new Error(`${context}.targets[${index}] は空でない文字列である必要があります`);
    }
    return item.trim();
  });
}

function parseTargetEnvironmentSpec(
  raw: unknown,
  context: string,
): TargetEnvironmentSpec | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`${context} の形式が不正です`);
  }
  const obj = raw as Record<string, unknown>;
  const required = parseTargetRequirement(obj.required, context);
  const targets = parseTargetIdList(obj.targets, context);

  return {
    required,
    ...(targets != null ? { targets } : {}),
  };
}

function parseEnvironment(raw: unknown, index: number): Environment {
  if (typeof raw === "string") {
    return { id: raw, name: raw };
  }
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    const id = String(obj.id ?? `env-${index + 1}`);
    const name = String(obj.name ?? id);
    return { id, name };
  }
  throw new Error(`environments[${index}] の形式が不正です`);
}

function parseCategoryTarget(raw: unknown, index: number): CategoryTarget {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`categoryTargets[${index}] の形式が不正です`);
  }
  const obj = raw as Record<string, unknown>;
  const matchRaw = obj.match;
  if (typeof matchRaw !== "object" || matchRaw === null) {
    throw new Error(`categoryTargets[${index}].match は必須です`);
  }
  const matchObj = matchRaw as Record<string, unknown>;
  const major = String(matchObj.major ?? "").trim();
  if (!major) throw new Error(`categoryTargets[${index}].match.major は必須です`);

  const medium =
    matchObj.medium != null ? String(matchObj.medium).trim() || undefined : undefined;
  const minor =
    matchObj.minor != null ? String(matchObj.minor).trim() || undefined : undefined;

  const required =
    obj.required != null
      ? parseTargetRequirement(obj.required, `categoryTargets[${index}]`)
      : undefined;
  const targets = parseTargetIdList(obj.targets, `categoryTargets[${index}]`);

  return {
    match: { major, medium, minor },
    ...(required != null ? { required } : {}),
    ...(targets != null ? { targets } : {}),
  };
}

function parseTestCase(raw: unknown, index: number): TestCase {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`testCases[${index}] の形式が不正です`);
  }
  const obj = raw as Record<string, unknown>;
  const id = String(obj.id ?? "");
  const description = String(obj.description ?? "");
  if (!id) throw new Error(`testCases[${index}].id は必須です`);
  if (!description) throw new Error(`testCases[${index}].description は必須です`);

  const categoryRaw = obj.category;
  let major = "";
  let medium: string | undefined;
  let minor: string | undefined;
  if (typeof categoryRaw === "object" && categoryRaw !== null) {
    const cat = categoryRaw as Record<string, unknown>;
    major = String(cat.major ?? "");
    medium = cat.medium != null ? String(cat.medium).trim() || undefined : undefined;
    minor = cat.minor != null ? String(cat.minor).trim() || undefined : undefined;
  } else if (typeof categoryRaw === "string") {
    major = categoryRaw;
  }
  if (!major) throw new Error(`testCases[${index}].category.major は必須です`);

  const targetEnvironments = parseTargetEnvironmentSpec(
    obj.targetEnvironments,
    `testCases[${index}].targetEnvironments`,
  );

  return {
    id,
    category: { major, medium, minor },
    prerequisites: obj.prerequisites != null ? String(obj.prerequisites) : undefined,
    description,
    ...(targetEnvironments != null ? { targetEnvironments } : {}),
  };
}

function validateTargetEnvironmentIds(
  ids: string[] | undefined,
  context: string,
  envIds: Set<string>,
): void {
  if (!ids) return;
  for (const id of ids) {
    if (!envIds.has(id)) {
      throw new Error(`${context} に未知の environment id "${id}" があります`);
    }
  }
}

export function parseTestsYaml(content: string): TestDefinition {
  const data = yaml.load(content);
  if (typeof data !== "object" || data === null) {
    throw new Error("tests.yml のルートはオブジェクトである必要があります");
  }
  const root = data as Record<string, unknown>;

  const projectRaw = root.project;
  if (typeof projectRaw !== "object" || projectRaw === null) {
    throw new Error("project は必須です");
  }
  const projectObj = projectRaw as Record<string, unknown>;
  const projectName = String(projectObj.name ?? "");
  if (!projectName) throw new Error("project.name は必須です");

  const environmentsRaw = root.environments;
  if (!Array.isArray(environmentsRaw) || environmentsRaw.length === 0) {
    throw new Error("environments は1件以上必要です");
  }
  const environments = environmentsRaw.map(parseEnvironment);

  const envIds = new Set<string>();
  for (const env of environments) {
    if (envIds.has(env.id)) throw new Error(`重複した環境 ID: ${env.id}`);
    envIds.add(env.id);
  }

  const categoryTargetsRaw = root.categoryTargets;
  let categoryTargets: CategoryTarget[] | undefined;
  if (categoryTargetsRaw != null) {
    if (!Array.isArray(categoryTargetsRaw)) {
      throw new Error("categoryTargets は配列である必要があります");
    }
    categoryTargets = categoryTargetsRaw.map(parseCategoryTarget);
    categoryTargets.forEach((ct, index) => {
      validateTargetEnvironmentIds(
        ct.targets,
        `categoryTargets[${index}]`,
        envIds,
      );
    });
  }

  const testCasesRaw = root.testCases;
  if (!Array.isArray(testCasesRaw) || testCasesRaw.length === 0) {
    throw new Error("testCases は1件以上必要です");
  }
  const testCases = testCasesRaw.map(parseTestCase);
  testCases.forEach((tc, index) => {
    validateTargetEnvironmentIds(
      tc.targetEnvironments?.targets,
      `testCases[${index}].targetEnvironments`,
      envIds,
    );
  });

  const ids = new Set<string>();
  for (const tc of testCases) {
    if (ids.has(tc.id)) throw new Error(`重複したテストケース ID: ${tc.id}`);
    ids.add(tc.id);
  }

  return {
    project: {
      name: projectName,
      id: projectObj.id != null ? String(projectObj.id) : slugify(projectName),
      version: projectObj.version != null ? Number(projectObj.version) : 1,
    },
    environments,
    ...(categoryTargets != null ? { categoryTargets } : {}),
    testCases,
  };
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}
