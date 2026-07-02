import type { SessionConfig, TestDefinition } from "@qarows/shared";

const STORAGE_PREFIX = "qarows-v2:selected-envs:";

function storageKey(projectId: string, userEmail: string): string {
  return `${STORAGE_PREFIX}${userEmail.toLowerCase()}:${projectId}`;
}

export function loadLocalSelectedEnvironmentIds(
  projectId: string,
  userEmail: string,
): string[] | null {
  try {
    const raw = localStorage.getItem(storageKey(projectId, userEmail));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === "string")) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveLocalSelectedEnvironmentIds(
  projectId: string,
  userEmail: string,
  selectedEnvironmentIds: string[],
): void {
  try {
    localStorage.setItem(
      storageKey(projectId, userEmail),
      JSON.stringify(selectedEnvironmentIds),
    );
  } catch {
    // ignore storage errors
  }
}

export function clearLocalSelectedEnvironmentIds(
  projectId: string,
  userEmail: string,
): void {
  try {
    localStorage.removeItem(storageKey(projectId, userEmail));
  } catch {
    // ignore storage errors
  }
}

export function sanitizeLocalSelectedEnvironmentIds(
  selectedEnvironmentIds: string[],
  definition: TestDefinition,
): string[] {
  const validEnvIds = new Set(definition.environments.map((env) => env.id));
  return selectedEnvironmentIds.filter((id) => validEnvIds.has(id));
}

/** Team 版: 認証メール + ブラウザ保存の端末/環境選択からセッションを組み立てる */
export function buildLocalSession(
  userEmail: string | null,
  localEnvironmentIds: string[] | null,
): SessionConfig | null {
  const executorName = userEmail?.trim() ?? "";
  const selectedEnvironmentIds = localEnvironmentIds ?? [];

  if (selectedEnvironmentIds.length === 0 && executorName.length === 0) {
    return null;
  }

  return { executorName, selectedEnvironmentIds };
}
