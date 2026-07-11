import type { Environment, TestCase, TestDefinition } from "@qarows/shared";
import { AiModelError } from "./run-model";

export interface TestCasePatchSection {
  added?: TestCase[];
  removed?: string[];
  modified?: Array<Partial<TestCase> & { id: string }>;
}

export interface EnvironmentPatchSection {
  added?: Environment[];
  removed?: string[];
  modified?: Array<Partial<Environment> & { id: string }>;
}

export interface ProjectPatchSection {
  name?: string;
}

export interface DefinitionPatch {
  testCases?: TestCasePatchSection;
  environments?: EnvironmentPatchSection;
  project?: ProjectPatchSection;
}

export function hasDefinitionPatch(patch: DefinitionPatch): boolean {
  const tc = patch.testCases;
  const env = patch.environments;
  return (
    (tc?.added?.length ?? 0) > 0 ||
    (tc?.removed?.length ?? 0) > 0 ||
    (tc?.modified?.length ?? 0) > 0 ||
    (env?.added?.length ?? 0) > 0 ||
    (env?.removed?.length ?? 0) > 0 ||
    (env?.modified?.length ?? 0) > 0 ||
    patch.project?.name != null
  );
}

function normalizeAddedTestCase(raw: Record<string, unknown>): TestCase {
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const description = typeof raw.description === "string" ? raw.description.trim() : "";
  const categoryRaw = raw.category;
  if (!id || !description || !categoryRaw || typeof categoryRaw !== "object") {
    throw new AiModelError("patch.testCases.added の形式が不正です");
  }
  const category = categoryRaw as Record<string, unknown>;
  const major = typeof category.major === "string" ? category.major.trim() : "";
  if (!major) {
    throw new AiModelError("patch.testCases.added.category.major が必要です");
  }
  const prerequisites =
    typeof raw.prerequisites === "string" ? raw.prerequisites.trim() : undefined;
  const medium = typeof category.medium === "string" ? category.medium.trim() : undefined;
  const minor = typeof category.minor === "string" ? category.minor.trim() : undefined;
  return {
    id,
    description,
    prerequisites: prerequisites || undefined,
    category: {
      major,
      medium: medium || undefined,
      minor: minor || undefined,
    },
  };
}

function normalizeModifiedTestCase(raw: Record<string, unknown>): Partial<TestCase> & { id: string } {
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (!id) throw new AiModelError("patch.testCases.modified.id が必要です");
  const patch: Partial<TestCase> & { id: string } = { id };
  if (typeof raw.description === "string") patch.description = raw.description.trim();
  if (typeof raw.prerequisites === "string") patch.prerequisites = raw.prerequisites.trim();
  if (raw.category && typeof raw.category === "object") {
    const category = raw.category as Record<string, unknown>;
    patch.category = {
      major: typeof category.major === "string" ? category.major.trim() : "",
      medium: typeof category.medium === "string" ? category.medium.trim() : undefined,
      minor: typeof category.minor === "string" ? category.minor.trim() : undefined,
    };
    if (!patch.category.major) {
      throw new AiModelError("patch.testCases.modified.category.major が空です");
    }
  }
  return patch;
}

function normalizeAddedEnvironment(raw: Record<string, unknown>): Environment {
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!id || !name) throw new AiModelError("patch.environments.added の形式が不正です");
  return { id, name };
}

function normalizeModifiedEnvironment(
  raw: Record<string, unknown>,
): Partial<Environment> & { id: string } {
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (!id) throw new AiModelError("patch.environments.modified.id が必要です");
  const patch: Partial<Environment> & { id: string } = { id };
  if (typeof raw.name === "string") patch.name = raw.name.trim();
  return patch;
}

function parseStringArray(value: unknown, label: string): string[] | undefined {
  if (value == null) return undefined;
  if (!Array.isArray(value)) throw new AiModelError(`${label} は配列である必要があります`);
  return value
    .filter((item): item is string => typeof item === "string" && item.trim() !== "")
    .map((item) => item.trim());
}

function parseObjectArray<T>(
  value: unknown,
  label: string,
  normalize: (raw: Record<string, unknown>) => T,
): T[] | undefined {
  if (value == null) return undefined;
  if (!Array.isArray(value)) throw new AiModelError(`${label} は配列である必要があります`);
  return value.map((item) => {
    if (!item || typeof item !== "object") {
      throw new AiModelError(`${label} の要素が不正です`);
    }
    return normalize(item as Record<string, unknown>);
  });
}

function parseTestCaseSection(raw: unknown): TestCasePatchSection | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== "object") throw new AiModelError("patch.testCases の形式が不正です");
  const section = raw as Record<string, unknown>;
  return {
    added: parseObjectArray(section.added, "patch.testCases.added", normalizeAddedTestCase),
    removed: parseStringArray(section.removed, "patch.testCases.removed"),
    modified: parseObjectArray(
      section.modified,
      "patch.testCases.modified",
      normalizeModifiedTestCase,
    ),
  };
}

function parseEnvironmentSection(raw: unknown): EnvironmentPatchSection | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== "object") throw new AiModelError("patch.environments の形式が不正です");
  const section = raw as Record<string, unknown>;
  return {
    added: parseObjectArray(section.added, "patch.environments.added", normalizeAddedEnvironment),
    removed: parseStringArray(section.removed, "patch.environments.removed"),
    modified: parseObjectArray(
      section.modified,
      "patch.environments.modified",
      normalizeModifiedEnvironment,
    ),
  };
}

function parsePatchObject(raw: Record<string, unknown>): DefinitionPatch {
  const projectRaw = raw.project;
  let project: ProjectPatchSection | undefined;
  if (projectRaw != null) {
    if (typeof projectRaw !== "object" || Array.isArray(projectRaw)) {
      throw new AiModelError("patch.project の形式が不正です");
    }
    const projectObj = projectRaw as Record<string, unknown>;
    const nameRaw = projectObj.name;
    const name = typeof nameRaw === "string" ? nameRaw.trim() : undefined;
    if (name) project = { name };
  }

  return {
    testCases: parseTestCaseSection(raw.testCases),
    environments: parseEnvironmentSection(raw.environments),
    project,
  };
}

function tryParseJsonObject(raw: string): Record<string, unknown> | null {
  const candidates = [raw, quoteBareObjectKeys(raw)];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

/** Models often emit JS-like `{ modified: [...] }` instead of JSON `{ "modified": [...] }`. */
function quoteBareObjectKeys(raw: string): string {
  return raw.replace(/([{,]\s*)([A-Za-z_][\w]*)\s*:/g, '$1"$2":');
}

/** Extract a JSON object that starts at the first `{` after `marker`. */
export function extractObjectAfterMarker(text: string, marker: string): unknown | null {
  const idx = text.indexOf(marker);
  if (idx < 0) return null;
  const start = text.indexOf("{", idx + marker.length);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return tryParseJsonObject(text.slice(start, i + 1));
      }
    }
  }
  return null;
}

/**
 * Models sometimes put the patch in reply text or at the top level instead of `patch`.
 * Recover those shapes so edit mode does not fail with an empty patch.
 */
export function coerceAiPatchPayload(parsed: {
  reply?: string;
  patch?: unknown;
  testCases?: unknown;
  environments?: unknown;
  project?: unknown;
}): unknown {
  if (typeof parsed.patch === "string") {
    const asObject = tryParseJsonObject(parsed.patch.trim());
    if (asObject) return asObject;
  }
  if (parsed.patch && typeof parsed.patch === "object" && !Array.isArray(parsed.patch)) {
    const patchObj = parsed.patch as Record<string, unknown>;
    if (
      patchObj.testCases != null ||
      patchObj.environments != null ||
      patchObj.project != null
    ) {
      return parsed.patch;
    }
  }

  if (parsed.testCases != null || parsed.environments != null || parsed.project != null) {
    return {
      testCases: parsed.testCases,
      environments: parsed.environments,
      project: parsed.project,
    };
  }

  const reply = parsed.reply?.trim();
  if (!reply) return parsed.patch ?? null;

  const embedded = tryParseJsonObject(reply);
  if (embedded?.patch && typeof embedded.patch === "object") return embedded.patch;
  if (embedded?.testCases != null || embedded?.environments != null || embedded?.project != null) {
    return {
      testCases: embedded.testCases,
      environments: embedded.environments,
      project: embedded.project,
    };
  }

  const testCases = extractObjectAfterMarker(reply, "patch.testCases");
  const environments = extractObjectAfterMarker(reply, "patch.environments");
  const project = extractObjectAfterMarker(reply, "patch.project");
  const nestedPatch = extractObjectAfterMarker(reply, '"patch"') ?? extractObjectAfterMarker(reply, "patch:");
  if (nestedPatch && typeof nestedPatch === "object") return nestedPatch;
  if (testCases != null || environments != null || project != null) {
    return { testCases, environments, project };
  }

  return parsed.patch ?? null;
}

export function parseDefinitionPatch(parsed: {
  reply?: string;
  patch?: unknown;
  testCases?: unknown;
  environments?: unknown;
  project?: unknown;
}): DefinitionPatch {
  const coerced = coerceAiPatchPayload(parsed);
  if (coerced == null) return {};
  if (typeof coerced !== "object" || Array.isArray(coerced)) {
    throw new AiModelError("patch の形式が不正です");
  }
  return parsePatchObject(coerced as Record<string, unknown>);
}

function mergeTestCase(existing: TestCase, patch: Partial<TestCase> & { id: string }): TestCase {
  const category = patch.category
    ? {
        major: patch.category.major || existing.category.major,
        medium: patch.category.medium ?? existing.category.medium,
        minor: patch.category.minor ?? existing.category.minor,
      }
    : existing.category;
  return {
    ...existing,
    description: patch.description ?? existing.description,
    prerequisites: patch.prerequisites !== undefined ? patch.prerequisites : existing.prerequisites,
    category,
    version: patch.version ?? existing.version,
    targetEnvironments: patch.targetEnvironments ?? existing.targetEnvironments,
  };
}

function mergeEnvironment(
  existing: Environment,
  patch: Partial<Environment> & { id: string },
): Environment {
  return {
    id: existing.id,
    name: patch.name?.trim() || existing.name,
  };
}

export function applyDefinitionPatch(
  base: TestDefinition,
  patch: DefinitionPatch,
): TestDefinition {
  let environments = [...base.environments];
  let testCases = [...base.testCases];
  const project = { ...base.project };

  if (patch.project?.name) {
    project.name = patch.project.name;
  }

  const envPatch = patch.environments;
  if (envPatch?.removed?.length) {
    const remove = new Set(envPatch.removed);
    environments = environments.filter((env) => !remove.has(env.id));
  }
  if (envPatch?.modified?.length) {
    const byId = new Map(environments.map((env) => [env.id, env]));
    for (const item of envPatch.modified) {
      const existing = byId.get(item.id);
      if (!existing) {
        throw new AiModelError(`存在しない端末/環境 ID です: ${item.id}`);
      }
      byId.set(item.id, mergeEnvironment(existing, item));
    }
    environments = environments.map((env) => byId.get(env.id) ?? env);
  }
  if (envPatch?.added?.length) {
    for (const env of envPatch.added) {
      if (environments.some((existing) => existing.id === env.id)) {
        throw new AiModelError(`端末/環境 ID が重複しています: ${env.id}`);
      }
      environments.push(env);
    }
  }

  const tcPatch = patch.testCases;
  if (tcPatch?.removed?.length) {
    const remove = new Set(tcPatch.removed);
    testCases = testCases.filter((tc) => !remove.has(tc.id));
  }
  if (tcPatch?.modified?.length) {
    const byId = new Map(testCases.map((tc) => [tc.id, tc]));
    for (const item of tcPatch.modified) {
      const existing = byId.get(item.id);
      if (!existing) {
        throw new AiModelError(`存在しないテストケース ID です: ${item.id}`);
      }
      byId.set(item.id, mergeTestCase(existing, item));
    }
    testCases = testCases.map((tc) => byId.get(tc.id) ?? tc);
  }
  if (tcPatch?.added?.length) {
    for (const tc of tcPatch.added) {
      if (testCases.some((existing) => existing.id === tc.id)) {
        throw new AiModelError(`テストケース ID が重複しています: ${tc.id}`);
      }
      testCases.push(tc);
    }
  }

  return {
    ...base,
    project,
    environments,
    testCases,
  };
}
