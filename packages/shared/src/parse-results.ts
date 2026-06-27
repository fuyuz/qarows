import { normalizeBugSeverity, normalizeBugStatus } from "./bug";
import type { Bug, ResultsFile, TestDefinition, TestResultEntry, TestResults } from "./types";
import { normalizeStatus } from "./status";
import { parseIsoTimestamp, parseOptionalIsoTimestamp } from "./validate-iso-timestamp";

export interface ParseResultsOptions {
  /** 指定時は testCaseId / environmentId / projectId を定義と照合する */
  definition?: TestDefinition;
}

function parseResultsFileVersion(raw: unknown): number {
  const parsed = Number(raw ?? 1);
  if (!Number.isFinite(parsed) || parsed < 1 || !Number.isInteger(parsed)) {
    throw new Error("version は 1 以上の整数である必要があります");
  }
  return parsed;
}

function parseResultEntry(raw: unknown, context: string): TestResultEntry {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`${context} の形式が不正です`);
  }
  const obj = raw as Record<string, unknown>;
  const versionRaw = obj.version;
  let version: number | undefined;
  if (versionRaw != null) {
    const parsed = Number(versionRaw);
    if (!Number.isFinite(parsed) || parsed < 1 || !Number.isInteger(parsed)) {
      throw new Error(`${context}.version は 1 以上の整数である必要があります`);
    }
    version = parsed === 1 ? undefined : parsed;
  }

  return {
    status: normalizeStatus(String(obj.status ?? "")),
    ...(version != null ? { version } : {}),
    executedAt: parseOptionalIsoTimestamp(obj.executedAt, `${context}.executedAt`),
    executedBy: obj.executedBy != null ? String(obj.executedBy) : undefined,
    memo: obj.memo != null ? String(obj.memo) : undefined,
  };
}

function parseResults(raw: unknown): TestResults {
  if (typeof raw !== "object" || raw === null) return {};
  const results: TestResults = {};
  for (const [testCaseId, envMap] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof envMap !== "object" || envMap === null) continue;
    results[testCaseId] = {};
    for (const [envId, entry] of Object.entries(envMap as Record<string, unknown>)) {
      results[testCaseId][envId] = parseResultEntry(entry, `results.${testCaseId}.${envId}`);
    }
  }
  return results;
}

function parseEnvironmentIds(raw: unknown, context: string): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const ids = raw.map((item, index) => {
    const id = String(item).trim();
    if (!id) {
      throw new Error(`${context}[${index}] は空でない文字列である必要があります`);
    }
    return id;
  });
  return ids.length > 0 ? ids : undefined;
}

function parseBug(raw: unknown, index: number): Bug {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`bugs[${index}] の形式が不正です`);
  }
  const obj = raw as Record<string, unknown>;
  const id = String(obj.id ?? "").trim();
  const title = String(obj.title ?? "").trim();
  if (!id || !title) {
    throw new Error(`bugs[${index}] の id, title は必須です`);
  }
  const testCaseIdRaw = obj.testCaseId;
  const testCaseId =
    testCaseIdRaw != null && String(testCaseIdRaw).trim() !== ""
      ? String(testCaseIdRaw).trim()
      : undefined;
  const severity = normalizeBugSeverity(String(obj.severity ?? "medium"));
  const status = normalizeBugStatus(String(obj.status ?? "open"));
  return {
    id,
    testCaseId,
    environmentIds: parseEnvironmentIds(obj.environmentIds, `bugs[${index}].environmentIds`),
    title,
    severity,
    status,
    assignee: obj.assignee != null ? String(obj.assignee) : undefined,
    steps: obj.steps != null ? String(obj.steps) : undefined,
    expected: obj.expected != null ? String(obj.expected) : undefined,
    actual: obj.actual != null ? String(obj.actual) : undefined,
    fixNote: obj.fixNote != null ? String(obj.fixNote) : undefined,
    memo: obj.memo != null ? String(obj.memo) : undefined,
  };
}

function validateResultsReferences(file: ResultsFile, definition: TestDefinition): void {
  const projectId = definition.project.id ?? "project";
  if (file.projectId !== projectId) {
    throw new Error(
      `results.json の projectId (${file.projectId}) が tests.yml (${projectId}) と一致しません`,
    );
  }

  const testCaseIds = new Set(definition.testCases.map((tc) => tc.id));
  const environmentIds = new Set(definition.environments.map((env) => env.id));

  for (const testCaseId of Object.keys(file.results)) {
    if (!testCaseIds.has(testCaseId)) {
      throw new Error(`未定義の testCaseId: ${testCaseId}`);
    }
    const envMap = file.results[testCaseId];
    if (!envMap) continue;
    for (const envId of Object.keys(envMap)) {
      if (!environmentIds.has(envId)) {
        throw new Error(`未定義の environmentId: ${envId} (testCaseId: ${testCaseId})`);
      }
    }
  }

  for (const bug of file.bugs) {
    if (bug.testCaseId != null && !testCaseIds.has(bug.testCaseId)) {
      throw new Error(`未定義の testCaseId: ${bug.testCaseId} (bug: ${bug.id})`);
    }
    if (bug.environmentIds) {
      for (const envId of bug.environmentIds) {
        if (!environmentIds.has(envId)) {
          throw new Error(`未定義の environmentId: ${envId} (bug: ${bug.id})`);
        }
      }
    }
  }
}

export function parseResultsJson(content: string, options?: ParseResultsOptions): ResultsFile {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(content) as Record<string, unknown>;
  } catch {
    throw new Error("results.json の JSON 形式が不正です");
  }

  const projectId = String(data.projectId ?? "").trim();
  if (!projectId) throw new Error("projectId は必須です");

  const bugsRaw = data.bugs;
  const bugs = Array.isArray(bugsRaw) ? bugsRaw.map(parseBug) : [];
  const bugIds = new Set<string>();
  for (const bug of bugs) {
    const key = bug.id.toLowerCase();
    if (bugIds.has(key)) {
      throw new Error(`重複したバグ ID: ${bug.id}`);
    }
    bugIds.add(key);
  }

  const updatedAtRaw = data.updatedAt;
  const updatedAt =
    updatedAtRaw != null
      ? parseIsoTimestamp(updatedAtRaw, "updatedAt")
      : new Date().toISOString();

  const file: ResultsFile = {
    version: parseResultsFileVersion(data.version),
    projectId,
    updatedAt,
    results: parseResults(data.results ?? {}),
    bugs,
  };

  if (options?.definition) {
    validateResultsReferences(file, options.definition);
  }

  return file;
}

export function createEmptyResults(projectId: string): ResultsFile {
  return {
    version: 1,
    projectId,
    updatedAt: new Date().toISOString(),
    results: {},
    bugs: [],
  };
}
