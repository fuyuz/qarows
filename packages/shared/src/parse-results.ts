import { normalizeBugStatus } from "./bug";
import type { Bug, ResultsFile, TestResultEntry, TestResults } from "./types";
import { normalizeStatus } from "./status";

function parseResultEntry(raw: unknown): TestResultEntry {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("結果エントリの形式が不正です");
  }
  const obj = raw as Record<string, unknown>;
  return {
    status: normalizeStatus(String(obj.status ?? "")),
    executedAt: obj.executedAt != null ? String(obj.executedAt) : undefined,
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
      results[testCaseId][envId] = parseResultEntry(entry);
    }
  }
  return results;
}

function parseEnvironmentIds(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const ids = raw.map((item) => String(item)).filter(Boolean);
  return ids.length > 0 ? ids : undefined;
}

function parseBug(raw: unknown, index: number): Bug {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`bugs[${index}] の形式が不正です`);
  }
  const obj = raw as Record<string, unknown>;
  const id = String(obj.id ?? "");
  const title = String(obj.title ?? "");
  if (!id || !title) {
    throw new Error(`bugs[${index}] の id, title は必須です`);
  }
  const testCaseIdRaw = obj.testCaseId;
  const testCaseId =
    testCaseIdRaw != null && String(testCaseIdRaw) !== ""
      ? String(testCaseIdRaw)
      : undefined;
  const severity = String(obj.severity ?? "medium") as Bug["severity"];
  const status = normalizeBugStatus(String(obj.status ?? "open"));
  return {
    id,
    testCaseId,
    environmentIds: parseEnvironmentIds(obj.environmentIds),
    title,
    severity,
    status,
    assignee: obj.assignee != null ? String(obj.assignee) : undefined,
    steps: obj.steps != null ? String(obj.steps) : undefined,
    expected: obj.expected != null ? String(obj.expected) : undefined,
    actual: obj.actual != null ? String(obj.actual) : undefined,
  };
}

export function parseResultsJson(content: string): ResultsFile {
  const data = JSON.parse(content) as Record<string, unknown>;
  const projectId = String(data.projectId ?? "");
  if (!projectId) throw new Error("projectId は必須です");

  const bugsRaw = data.bugs;
  const bugs = Array.isArray(bugsRaw) ? bugsRaw.map(parseBug) : [];

  return {
    version: Number(data.version ?? 1),
    projectId,
    updatedAt: String(data.updatedAt ?? new Date().toISOString()),
    results: parseResults(data.results ?? {}),
    bugs,
  };
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
