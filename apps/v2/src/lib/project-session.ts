import { isValidSession } from "@qarows/shared";
import type { ProjectSummary } from "@/lib/api/projects";
import { buildLocalSession, loadLocalSelectedEnvironmentIds } from "@/lib/local-session";

export function computeHasValidSession(projectId: string, userEmail: string | null): boolean {
  const localEnvironmentIds =
    userEmail != null ? loadLocalSelectedEnvironmentIds(projectId, userEmail) : null;
  const session = buildLocalSession(userEmail, localEnvironmentIds);
  return session != null && isValidSession(session);
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
