import { isValidSession } from "./session";
import type { Bug, ResultsFile, SessionConfig, TestDefinition, TestResults } from "./types";

/** tests.yml 置換時: 新定義に存在する TC/env の結果だけ残す */
export function reconcileResultsOnDefinitionReplace(
  results: ResultsFile,
  definition: TestDefinition,
): ResultsFile {
  const projectId = definition.project.id ?? results.projectId;
  const testCaseIds = new Set(definition.testCases.map((tc) => tc.id));
  const environmentIds = new Set(definition.environments.map((env) => env.id));

  const nextResults: TestResults = {};
  for (const [testCaseId, envMap] of Object.entries(results.results)) {
    if (!testCaseIds.has(testCaseId)) continue;
    const filtered: NonNullable<(typeof results.results)[string]> = {};
    for (const [envId, entry] of Object.entries(envMap ?? {})) {
      if (environmentIds.has(envId)) {
        filtered[envId] = entry;
      }
    }
    if (Object.keys(filtered).length > 0) {
      nextResults[testCaseId] = filtered;
    }
  }

  const nextBugs: Bug[] = [];
  for (const bug of results.bugs) {
    if (bug.testCaseId != null && !testCaseIds.has(bug.testCaseId)) continue;
    const envIds = bug.environmentIds?.filter((id) => environmentIds.has(id));
    nextBugs.push({
      ...bug,
      environmentIds: envIds && envIds.length > 0 ? envIds : undefined,
    });
  }

  return {
    version: results.version,
    projectId,
    updatedAt: new Date().toISOString(),
    results: nextResults,
    bugs: nextBugs,
  };
}

/** tests.yml 置換時: 選択 env を新定義に合わせて整理 */
export function sanitizeSessionOnDefinitionReplace(
  session: SessionConfig | null,
  definition: TestDefinition,
): SessionConfig | null {
  if (!session) return null;
  const validEnvIds = new Set(definition.environments.map((env) => env.id));
  const selectedEnvironmentIds = session.selectedEnvironmentIds.filter((id) => validEnvIds.has(id));
  const next: SessionConfig = { ...session, selectedEnvironmentIds };
  return isValidSession(next) ? next : null;
}
