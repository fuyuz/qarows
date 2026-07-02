import { isValidSession } from "@qarows/shared";
import type { ProjectSummary } from "@/lib/api/projects";
import {
  loadLocalSelectedEnvironmentIds,
  mergeSessionWithLocalEnvironments,
} from "@/lib/local-session";

export function computeHasValidSession(projectId: string, userEmail: string | null): boolean {
  if (!userEmail) return false;
  const localEnvironmentIds = loadLocalSelectedEnvironmentIds(projectId, userEmail);
  const merged = mergeSessionWithLocalEnvironments(null, localEnvironmentIds, userEmail);
  return merged != null && isValidSession(merged);
}

export function enrichSummariesWithSession<T extends ProjectSummary>(
  summaries: T[],
  userEmail: string | null,
): (T & { hasValidSession: boolean })[] {
  return summaries.map((summary) => ({
    ...summary,
    hasValidSession: computeHasValidSession(summary.id, userEmail),
  }));
}
