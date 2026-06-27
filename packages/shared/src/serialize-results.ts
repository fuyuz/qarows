import type { Bug, ResultsFile, TestResultEntry, TestResults } from "./types";

function serializeResultEntry(entry: TestResultEntry): Record<string, unknown> {
  const obj: Record<string, unknown> = { status: entry.status };
  if (entry.version != null && entry.version > 1) obj.version = entry.version;
  if (entry.executedAt) obj.executedAt = entry.executedAt;
  if (entry.executedBy) obj.executedBy = entry.executedBy;
  if (entry.memo) obj.memo = entry.memo;
  return obj;
}

function serializeResults(results: TestResults): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const testCaseId of Object.keys(results).sort()) {
    const envMap = results[testCaseId];
    const envOut: Record<string, unknown> = {};
    for (const envId of Object.keys(envMap).sort()) {
      envOut[envId] = serializeResultEntry(envMap[envId]);
    }
    out[testCaseId] = envOut;
  }
  return out;
}

function serializeBug(bug: Bug): Record<string, unknown> {
  const obj: Record<string, unknown> = {
    id: bug.id,
    title: bug.title,
    severity: bug.severity,
    status: bug.status,
  };
  if (bug.testCaseId) obj.testCaseId = bug.testCaseId;
  if (bug.environmentIds?.length) obj.environmentIds = [...bug.environmentIds].sort();
  if (bug.assignee) obj.assignee = bug.assignee;
  if (bug.steps) obj.steps = bug.steps;
  if (bug.expected) obj.expected = bug.expected;
  if (bug.actual) obj.actual = bug.actual;
  if (bug.fixNote) obj.fixNote = bug.fixNote;
  if (bug.memo) obj.memo = bug.memo;
  return obj;
}

export function serializeResultsJson(file: ResultsFile): string {
  const payload = {
    version: file.version,
    projectId: file.projectId,
    updatedAt: file.updatedAt,
    results: serializeResults(file.results),
    bugs: file.bugs.map(serializeBug),
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}
