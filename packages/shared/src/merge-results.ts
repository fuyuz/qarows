import { strongerStatus } from "./status";
import type { Bug, ResultsFile, TestResultEntry } from "./types";

const MEMO_SEPARATOR = "\n---\n";

function mergeMemos(a?: string, b?: string): string | undefined {
  const left = a?.trim();
  const right = b?.trim();
  if (!left) return right;
  if (!right) return left;
  if (left === right) return left;
  return `${left}${MEMO_SEPARATOR}${right}`;
}

function mergeEntry(a: TestResultEntry, b: TestResultEntry): TestResultEntry {
  const status = strongerStatus(a.status, b.status);
  const prefer =
    status === a.status && status !== b.status
      ? a
      : status === b.status && status !== a.status
        ? b
        : (a.executedAt ?? "") >= (b.executedAt ?? "")
          ? a
          : b;

  return {
    status,
    version: prefer.version ?? a.version ?? b.version,
    executedAt: prefer.executedAt ?? a.executedAt ?? b.executedAt,
    executedBy: prefer.executedBy ?? a.executedBy ?? b.executedBy,
    memo: mergeMemos(a.memo, b.memo),
  };
}

function mergeBugs(base: Bug[], incoming: Bug[]): Bug[] {
  const map = new Map<string, Bug>();
  for (const bug of base) map.set(bug.id, bug);
  for (const bug of incoming) {
    const existing = map.get(bug.id);
    map.set(bug.id, existing ? { ...existing, ...bug } : bug);
  }
  return [...map.values()];
}

export function mergeResultsFiles(base: ResultsFile, incoming: ResultsFile): ResultsFile {
  if (base.projectId !== incoming.projectId) {
    throw new Error(
      `projectId が一致しません: ${base.projectId} と ${incoming.projectId}`,
    );
  }

  const results = structuredClone(base.results);

  for (const [testCaseId, envMap] of Object.entries(incoming.results)) {
    if (!results[testCaseId]) results[testCaseId] = {};
    for (const [envId, entry] of Object.entries(envMap)) {
      const existing = results[testCaseId][envId];
      results[testCaseId][envId] = existing ? mergeEntry(existing, entry) : entry;
    }
  }

  return {
    version: Math.max(base.version, incoming.version),
    projectId: base.projectId,
    updatedAt: new Date().toISOString(),
    results,
    bugs: mergeBugs(base.bugs, incoming.bugs),
  };
}
