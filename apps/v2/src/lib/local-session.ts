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

/** サーバー同期 session とブラウザ保存の端末/環境選択を合成する（端末/環境は常にローカル優先） */
export function mergeSessionWithLocalEnvironments(
  serverSession: SessionConfig | null,
  localEnvironmentIds: string[] | null,
  userEmail: string | null = null,
): SessionConfig | null {
  const selectedEnvironmentIds = localEnvironmentIds ?? [];
  const executorName = userEmail?.trim() || serverSession?.executorName || "";

  if (selectedEnvironmentIds.length === 0 && executorName.trim().length === 0) {
    return null;
  }

  return { executorName, selectedEnvironmentIds };
}
