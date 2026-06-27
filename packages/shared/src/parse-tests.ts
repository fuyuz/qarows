import yaml from "js-yaml";
import type { Environment, TestCase, TestDefinition } from "./types";

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
  let minor: string | undefined;
  if (typeof categoryRaw === "object" && categoryRaw !== null) {
    const cat = categoryRaw as Record<string, unknown>;
    major = String(cat.major ?? "");
    minor = cat.minor != null ? String(cat.minor) : undefined;
  } else if (typeof categoryRaw === "string") {
    major = categoryRaw;
  }
  if (!major) throw new Error(`testCases[${index}].category.major は必須です`);

  return {
    id,
    category: { major, minor },
    prerequisites: obj.prerequisites != null ? String(obj.prerequisites) : undefined,
    description,
  };
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

  const testCasesRaw = root.testCases;
  if (!Array.isArray(testCasesRaw) || testCasesRaw.length === 0) {
    throw new Error("testCases は1件以上必要です");
  }
  const testCases = testCasesRaw.map(parseTestCase);

  const ids = new Set<string>();
  for (const tc of testCases) {
    if (ids.has(tc.id)) throw new Error(`重複したテストケース ID: ${tc.id}`);
    ids.add(tc.id);
  }

  const envIds = new Set<string>();
  for (const env of environments) {
    if (envIds.has(env.id)) throw new Error(`重複した環境 ID: ${env.id}`);
    envIds.add(env.id);
  }

  return {
    project: {
      name: projectName,
      id: projectObj.id != null ? String(projectObj.id) : slugify(projectName),
      version: projectObj.version != null ? Number(projectObj.version) : 1,
    },
    environments,
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
